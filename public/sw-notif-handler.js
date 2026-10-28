// ShiftFlow FMD - OS Notification & Background Schedule Sync Handler for Service Worker
const BG_STATE = {
  selectedPerson: '',
  lastUpdatedAt: '',
  lastScheduleJson: '',
  notifyOnShiftChange: true,
  pollingTimer: null,
};

function splitParticipants(raw, extras) {
  const base = String(raw || '')
    .split(/[\/،,\-\+]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== 'نامشخص' && s !== '---');
  const ext = Array.isArray(extras) ? extras.map((s) => String(s || '').trim()).filter(Boolean) : [];
  return Array.from(new Set([...base, ...ext]));
}

function getRoles(entry, personName) {
  if (!entry || !personName) return { isDay: false, isNight: false, isOnCall: false };
  const dayAll = splitParticipants(entry.dayShiftPerson, entry.extraDayPersons);
  const nightAll = splitParticipants(entry.nightShiftPerson, entry.extraNightPersons);
  return {
    isDay: dayAll.includes(personName),
    isNight: nightAll.includes(personName),
    isOnCall: String(entry.onCallPerson || '').trim() === personName,
    dayAll,
    nightAll,
  };
}

async function checkServerScheduleInBackground() {
  if (!BG_STATE.selectedPerson || !BG_STATE.notifyOnShiftChange) return;
  try {
    const res = await fetch('/api/sync', { cache: 'no-store' });
    if (!res.ok) return;
    const json = await res.json();
    if (!json || !json.exists || !json.data || !Array.isArray(json.data.schedule)) return;

    const newUpdatedAt = json.data.updatedAt || '';
    const newSchedule = json.data.schedule;
    const newScheduleJson = JSON.stringify(newSchedule);

    if (!BG_STATE.lastScheduleJson) {
      BG_STATE.lastScheduleJson = newScheduleJson;
      BG_STATE.lastUpdatedAt = newUpdatedAt;
      return;
    }

    if (newScheduleJson === BG_STATE.lastScheduleJson) return;

    // Check if any client window is currently visible; if not, SW fires OS notification directly
    const oldSchedule = JSON.parse(BG_STATE.lastScheduleJson);
    BG_STATE.lastScheduleJson = newScheduleJson;
    BG_STATE.lastUpdatedAt = newUpdatedAt;

    const oldMap = new Map();
    for (const item of oldSchedule) {
      if (item && item.date) oldMap.set(item.date, item);
    }

    const person = BG_STATE.selectedPerson;
    for (const newEntry of newSchedule) {
      if (!newEntry || !newEntry.date) continue;
      const oldEntry = oldMap.get(newEntry.date);
      if (!oldEntry) continue;

      const oldR = getRoles(oldEntry, person);
      const newR = getRoles(newEntry, person);

      if (oldR.isDay && !newR.isDay) {
        await self.registration.showNotification(
          `جابجایی/حذف از شیفت روز (${newEntry.dayName} ${newEntry.date})`,
          {
            body: `${person} عزیز، شما از شیفت روز ${newEntry.dayName} (${newEntry.date}) برداشته شدید.`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            dir: 'rtl',
            lang: 'fa',
            vibrate: [200, 100, 250, 100, 300],
            tag: `sw-day-rem-${newEntry.date}-${Date.now()}`,
            renotify: true,
            requireInteraction: true,
          }
        );
      } else if (!oldR.isDay && newR.isDay) {
        await self.registration.showNotification(
          `ثبت شیفت روز جدید (${newEntry.dayName} ${newEntry.date})`,
          {
            body: `${person} عزیز، شما برای شیفت روز ${newEntry.dayName} (${newEntry.date}) ثبت شدید.`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            dir: 'rtl',
            lang: 'fa',
            vibrate: [200, 100, 250, 100, 300],
            tag: `sw-day-add-${newEntry.date}-${Date.now()}`,
            renotify: true,
            requireInteraction: true,
          }
        );
      }

      if (oldR.isNight && !newR.isNight) {
        await self.registration.showNotification(
          `جابجایی/حذف از شیفت شب (${newEntry.dayName} ${newEntry.date})`,
          {
            body: `${person} عزیز، شما از شیفت شب ${newEntry.dayName} (${newEntry.date}) برداشته شدید.`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            dir: 'rtl',
            lang: 'fa',
            vibrate: [200, 100, 250, 100, 300],
            tag: `sw-night-rem-${newEntry.date}-${Date.now()}`,
            renotify: true,
            requireInteraction: true,
          }
        );
      } else if (!oldR.isNight && newR.isNight) {
        await self.registration.showNotification(
          `ثبت شیفت شب جدید (${newEntry.dayName} ${newEntry.date})`,
          {
            body: `${person} عزیز، شما برای شیفت شب ${newEntry.dayName} (${newEntry.date}) ثبت شدید.`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            dir: 'rtl',
            lang: 'fa',
            vibrate: [200, 100, 250, 100, 300],
            tag: `sw-night-add-${newEntry.date}-${Date.now()}`,
            renotify: true,
            requireInteraction: true,
          }
        );
      }
    }
  } catch (e) {
    // Ignore transient network errors in background
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SHOW_OS_NOTIFICATION') {
    const title = data.title || 'ShiftFlow FMD';
    const options = {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      dir: 'rtl',
      lang: 'fa',
      vibrate: [200, 100, 250, 100, 300],
      tag: data.tag || 'shiftflow-os-notif-' + Date.now(),
      renotify: true,
      requireInteraction: false,
      data: { url: '/' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } else if (data.type === 'CONFIGURE_BG_WATCHER') {
    BG_STATE.selectedPerson = data.selectedPerson || '';
    BG_STATE.notifyOnShiftChange = data.notifyOnShiftChange !== false;
    if (data.scheduleJson) {
      BG_STATE.lastScheduleJson = data.scheduleJson;
    }
    if (BG_STATE.pollingTimer) {
      clearInterval(BG_STATE.pollingTimer);
      BG_STATE.pollingTimer = null;
    }
    if (BG_STATE.selectedPerson && data.backgroundActiveEnabled !== false) {
      BG_STATE.pollingTimer = setInterval(checkServerScheduleInBackground, 10000);
    }
  } else if (data.type === 'BG_HEARTBEAT_PING') {
    event.waitUntil(checkServerScheduleInBackground());
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
