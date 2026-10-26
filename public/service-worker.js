// public/service-worker.js
self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Incoming Voice Call';
  const options = {
    body: data.body || 'Tap to answer the call',
    icon: '/icon.png',
    badge: '/badge.png',
    tag: 'voice-call',
    renotify: true,
    requireInteraction: true, // Keeps the notification visible until user clicks/dismisses
    actions: [
      { action: 'answer', title: 'Accept' },
      { action: 'reject', title: 'Decline' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle user clicking the native notification buttons
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'answer' || !event.action) {
    event.waitUntil(
      clients.openWindow('/chat') // Opens or focuses your app directly on the chat page
    );
  }
});
