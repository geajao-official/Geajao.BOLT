import { useEffect, useState } from 'react';
import { BellRing, BellOff, Loader2 } from 'lucide-react';
import { enableWebPush, disableWebPush } from '@/lib/webPush';

export default function PushNotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function checkSubscription() {
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          if (!cancelled) setEnabled(Boolean(subscription));
        }
      } catch (error) {
        console.warn('Could not check push subscription:', error);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void checkSubscription();
    return () => { cancelled = true; };
  }, []);

  async function toggle() {
    setBusy(true);
    setMessage('');

    try {
      if (enabled) {
        await disableWebPush();
        setEnabled(false);
        setMessage('Push notifications disabled.');
      } else {
        await enableWebPush();
        setEnabled(true);
        setMessage('Push notifications enabled.');
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Something went wrong.';
      setMessage(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {message && (
        <p role="status" className="max-w-72 rounded-xl border border-amber-500/30 bg-[#0c1126] px-3 py-2 text-xs text-amber-100 shadow-xl">
          {message}
        </p>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={enabled ? 'Disable push notifications' : 'Enable push notifications'}
        className="flex items-center gap-2 rounded-full border border-amber-400/40 bg-[#0c1126] px-4 py-3 text-sm font-semibold text-amber-100 shadow-xl transition hover:border-amber-300 hover:bg-amber-500/10 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 size={17} className="animate-spin" />
        ) : enabled ? (
          <BellOff size={17} />
        ) : (
          <BellRing size={17} />
        )}
        {busy ? 'Please wait…' : enabled ? 'Disable push' : 'Enable push'}
      </button>
    </div>
  );
}
