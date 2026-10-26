// Social pushes explicitly use type: "social".
// Older push payloads continue to use the existing voice-call behavior.
self.addEventListener('push', function (event) {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: 'Incoming Voice Call',
      body: event.data ? event.data.text() : 'Tap to answer the call',
    };
  }

  const isSocial = data.type === 'social';
  const isCall = !isSocial;
  const title = data.title || (isCall ? 'Incoming Voice Call' : 'Geajao');

  const options = {
    body: data.body || (isCall ? 'Tap to answer the call' : 'You have a new notification'),
    icon: '/icon.png',
    badge: '/badge.png',
    tag: isCall ? 'voice-call' : (data.notificationId || 'geajao-notification'),
    renotify: true,
    requireInteraction: isCall,
    data: {
      url: data.url || (isCall ? '/chat' : '/'),
      type: isCall ? 'voice-call' : 'social',
    },
  };

  if (isCall) {
    options.actions = [
      { action: 'answer', title: 'Accept' },
      { action: 'reject', title: 'Decline' },
    ];
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (
    event.notification.data?.type === 'voice-call' &&
    event.action === 'reject'
  ) {
    return;
  }

  const target = event.notification.data?.url || '/chat';

  event.waitUntil((async function () {
    const windows = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          await client.navigate(new URL(target, self.location.origin).href);
        }
        return;
      }
    }

    await clients.openWindow(new URL(target, self.location.origin).href);
  })());
});
