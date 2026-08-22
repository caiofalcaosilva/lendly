// Deliberately minimal — only handles Web Push (system notification +
// app-icon badge on installed PWAs). No `fetch` handler: this must never
// intercept or cache page requests.

// Without these two, a new sw.js deploy sits in "waiting" until every
// tab/window using the previous version closes — meaning a fix like the
// per-notification tag below wouldn't actually take effect on an
// already-installed device until the app was fully closed system-wide,
// not just reopened. skipWaiting + clients.claim make every update take
// over immediately.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

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
