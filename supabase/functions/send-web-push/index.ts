
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET")!;
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@geajao.com";

const supabase = createClient(supabaseUrl, serviceRoleKey);

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (req.headers.get("x-push-secret") !== webhookSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await req.json();
    const notification = payload.record;

    if (payload.type !== "INSERT" || payload.table !== "notifications" ||
        !notification?.recipient_id) {
      return Response.json({ skipped: true });
    }

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notification.recipient_id);

    if (error) throw error;

    const message = JSON.stringify({
      type: 'social',
      title: notification.title || "Geajao",
      body: notification.body || "You have a new notification",
      url: notification.link_type === "conversation" || notification.link_type === "group"
        ? "/chat"
        : notification.link_type === "profile" && notification.link_id
          ? `/profile/${notification.link_id}`
          : "/",
      notificationId: notification.id,
    });

    const results = await Promise.allSettled(
      (subscriptions || []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            message,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            return;
          }
          throw err;
        }
      }),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    return Response.json({
      sent: results.length - failed,
      failed,
    });
  } catch (error) {
    console.error("Push delivery failed:", error);
    return Response.json({ error: "Push delivery failed" }, { status: 500 });
  }
});
