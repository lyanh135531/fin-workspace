const CACHE_PREFIX = "felix-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const PRECACHE_URLS = [
  "/offline.html",
  "/pwa-icon-192.png",
  "/pwa-icon-512.png",
  "/pwa-icon-maskable-512.png",
  "/pwa-apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.map(
            (url) => new Request(url, { cache: "reload", credentials: "same-origin" }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    request.mode !== "navigate" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match("/offline.html");
      return cached ?? Response.error();
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Felix nhắc ghi chi tiêu",
    body: "Hôm nay bạn đã ghi chi tiêu chưa? Chạm để nhập nhanh trong vài giây.",
    url: "/overview?action=new-transaction",
    tag: "felix-daily-expense-reminder",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed && typeof parsed === "object") {
        payload = {
          title:
            typeof parsed.title === "string" && parsed.title.trim()
              ? parsed.title
              : payload.title,
          body:
            typeof parsed.body === "string" && parsed.body.trim()
              ? parsed.body
              : payload.body,
          url:
            typeof parsed.url === "string" && parsed.url.startsWith("/")
              ? parsed.url
              : payload.url,
          tag:
            typeof parsed.tag === "string" && parsed.tag.trim()
              ? parsed.tag
              : payload.tag,
        };
      }
    } catch {
      const text = event.data.text();
      if (text && text.trim()) {
        payload.body = text.trim();
      }
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      tag: payload.tag,
      renotify: true,
      data: { url: payload.url },
      actions: [
        {
          action: "log-expense",
          title: "Ghi chi tiêu ngay",
        },
      ],
    }),
  );
});

const WORKSPACE_PREFIXES = [
  "/overview",
  "/dashboard",
  "/wallets",
  "/credit-cards",
  "/recurring-transactions",
  "/financial-plans",
  "/settings",
  "/members",
  "/account",
];

function isWorkspaceClientPath(pathname) {
  return WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl =
    event.notification.data && typeof event.notification.data.url === "string"
      ? event.notification.data.url
      : "/overview?action=new-transaction";
  const targetPath = rawUrl.startsWith("/")
    ? rawUrl
    : "/overview?action=new-transaction";
  const targetUrl = new URL(targetPath, self.location.origin).toString();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          try {
            const clientUrl = new URL(client.url);
            if (clientUrl.origin === self.location.origin) {
              if (
                !isWorkspaceClientPath(clientUrl.pathname) &&
                typeof client.navigate === "function"
              ) {
                await client.navigate(targetUrl);
                await client.focus();
                return;
              }
              await client.focus();
              client.postMessage({
                type: "FELIX_OPEN_QUICK_TRANSACTION",
                url: targetPath,
              });
              return;
            }
          } catch {
            // Ignore malformed client URLs.
          }
        }
        if (self.clients.openWindow) {
          await self.clients.openWindow(targetUrl);
        }
      }),
  );
});
