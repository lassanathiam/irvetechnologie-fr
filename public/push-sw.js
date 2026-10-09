// Service worker dédié aux notifications push (aucun cache de l'application).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: event.data && event.data.text() }; }
  const title = d.title || "IRVE Technologie";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || "",
      icon: "/app-icon-192.png",
      badge: "/app-icon-192.png",
      tag: d.tag || undefined,
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [300, 150, 300, 150, 600],
      data: { url: d.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
