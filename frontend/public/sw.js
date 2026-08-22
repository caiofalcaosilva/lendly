// Deliberately minimal — only handles Web Push (system notification +
// app-icon badge on installed PWAs). No `fetch` handler: this must never
// intercept or cache page requests.

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Lendly', {
      body: data.body || undefined,
      icon: '/icons/icon-192.png',
      // Unique per notification so several stack in the tray instead of
      // replacing each other — only a genuine re-delivery of the exact
      // same notification (same id) collapses onto one entry.
      tag: data.id || undefined,
      data,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data && event.notification.data.link
  event.waitUntil(self.clients.openWindow(link || '/'))
})
