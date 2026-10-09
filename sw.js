/* Core Node PWA Service Worker v2.6.2 — cache + calendar notifications */
const CACHE = 'core-node-pwa-v26-2';
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.webmanifest',
  './icon.svg'
];

/** @type {Map<string, number>} reminderId -> timeout handle */
const reminderTimers = new Map();
/** @type {Map<string, object>} */
const reminderMeta = new Map();

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isNavigate(req) {
  return req.mode === 'navigate' ||
    (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigate(req) || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  if (/\.(css|js|svg|webmanifest|woff2?|png|jpg|webp)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetched;
      })
    );
  }
});

/* ========== Calendar / Reminders ========== */

function clearReminderTimer(id) {
  const t = reminderTimers.get(id);
  if (t != null) {
    clearTimeout(t);
    reminderTimers.delete(id);
  }
  reminderMeta.delete(id);
}

function clearAllReminderTimers() {
  reminderTimers.forEach((t) => clearTimeout(t));
  reminderTimers.clear();
  reminderMeta.clear();
}

/**
 * Schedule one reminder.
 * payload: { id, title, fireAt (ms epoch), eventAt?, body?, tag? }
 */
function scheduleReminder(payload) {
  if (!payload || !payload.id) return;
  const id = String(payload.id);
  clearReminderTimer(id);

  const fireAt = Number(payload.fireAt) || 0;
  const now = Date.now();
  const delay = fireAt - now;

  if (!fireAt || delay < -60_000) {
    // already long past — skip
    return;
  }

  const meta = {
    id,
    title: payload.title || 'Напоминание Core Node',
    body: payload.body || payload.title || 'Событие из календаря',
    eventAt: payload.eventAt || fireAt,
    tag: payload.tag || ('cn-reminder-' + id)
  };
  reminderMeta.set(id, meta);

  // Cap setTimeout (~24 days max is safer; browsers often clamp ~1 day)
  const MAX = 24 * 60 * 60 * 1000;
  if (delay > MAX) {
    // re-check later; store and wake with shorter timer
    const handle = setTimeout(() => {
      reminderTimers.delete(id);
      scheduleReminder({ ...payload, fireAt });
    }, MAX);
    reminderTimers.set(id, handle);
    return;
  }

  const wait = Math.max(0, delay);
  const handle = setTimeout(() => {
    reminderTimers.delete(id);
    showReminderNotification(meta);
  }, wait);
  reminderTimers.set(id, handle);
}

function showReminderNotification(meta) {
  const title = meta.title || 'Планы и календарь';
  const when = meta.eventAt ? new Date(meta.eventAt) : null;
  const timeStr = when
    ? when.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';
  const body = meta.body || (timeStr ? ('Событие: ' + timeStr) : 'Напоминание Core Node');

  const opts = {
    body,
    icon: './icon.svg',
    badge: './icon.svg',
    tag: meta.tag || ('cn-reminder-' + meta.id),
    renotify: true,
    requireInteraction: false,
    data: {
      type: 'calendar-reminder',
      reminderId: meta.id,
      eventAt: meta.eventAt || null,
      url: './index.html?screen=calendar&reminder=' + encodeURIComponent(meta.id)
    },
    actions: [
      { action: 'open', title: 'Открыть календарь' },
      { action: 'dismiss', title: 'Скрыть' }
    ],
    vibrate: [120, 60, 120]
  };

  return self.registration.showNotification(title, opts).catch(() => {});
}

/** Sync full list from page: [{id, title, fireAt, eventAt, body}] */
function syncReminders(list) {
  const nextIds = new Set();
  (list || []).forEach((item) => {
    if (!item || !item.id) return;
    nextIds.add(String(item.id));
    scheduleReminder(item);
  });
  // cancel removed
  [...reminderTimers.keys()].forEach((id) => {
    if (!nextIds.has(id)) clearReminderTimer(id);
  });
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'SCHEDULE_REMINDER') {
    scheduleReminder(data.reminder || data);
    return;
  }

  if (data.type === 'CANCEL_REMINDER') {
    clearReminderTimer(String(data.id || ''));
    return;
  }

  if (data.type === 'SYNC_REMINDERS') {
    syncReminders(data.reminders || []);
    return;
  }

  if (data.type === 'CLEAR_REMINDERS') {
    clearAllReminderTimers();
    return;
  }

  if (data.type === 'SHOW_NOTIFICATION') {
    const title = data.title || 'Core Node';
    const opts = Object.assign({
      icon: './icon.svg',
      badge: './icon.svg',
      data: data.data || { url: './index.html' }
    }, data.options || {});
    if (data.body) opts.body = data.body;
    event.waitUntil(self.registration.showNotification(title, opts).catch(() => {}));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const targetUrl = data.url || './index.html?screen=calendar';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.registration.scope.replace(/\/$/, '')) || client.url.includes('index.html')) {
          if ('focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              reminderId: data.reminderId || null,
              open: 'calendar'
            });
            return client.focus();
          }
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('notificationclose', () => {
  /* no-op */
});

/* Push (optional future) */
self.addEventListener('push', (event) => {
  let payload = { title: 'Core Node', body: 'Уведомление', data: { url: './index.html' } };
  try {
    if (event.data) {
      const j = event.data.json();
      payload = Object.assign(payload, j);
    }
  } catch (e) {
    try {
      payload.body = event.data ? event.data.text() : payload.body;
    } catch (e2) {}
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: './icon.svg',
      badge: './icon.svg',
      data: payload.data || { url: './index.html' },
      vibrate: [100, 50, 100]
    }).catch(() => {})
  );
});
