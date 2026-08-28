self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() ?? "OpenTeams notification" }; }
  const title = typeof payload.title === "string" ? payload.title : "OpenTeams";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new secure notification.",
    tag: typeof payload.tag === "string" ? payload.tag : "openteams-notification",
    data: { url: typeof payload.url === "string" ? payload.url : "/" },
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => "focus" in client);
    if (existing) return existing.focus();
    return clients.openWindow(url);
  }));
});
