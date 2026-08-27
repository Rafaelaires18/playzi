self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = typeof data?.title === "string" ? data.title : "Playzi";
  const body = typeof data?.body === "string" ? data.body : "Nouvelle notification";
  const activityId = typeof data?.activity_id === "string" ? data.activity_id : "";
  const type = typeof data?.type === "string" ? data.type : "notification";
  const fallbackUrl = activityId ? `/activities?focus=${encodeURIComponent(activityId)}` : "/notifications";
  const url = typeof data?.url === "string" ? data.url : fallbackUrl;
  const tag = typeof data?.tag === "string" ? data.tag : "playzi-notification";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { type, activity_id: activityId, url },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/notifications";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
