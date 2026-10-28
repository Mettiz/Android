import { ShiftEntry, DailyProcessMap } from '../types';
import { getTodayPersianParts, getNextJalaliDate, toPersianDigits, jalaliToGregorian } from './persianDate';

export interface ShiftNotificationItem {
  id: string;
  timestamp: string; // ISO string
  persianTime: string;
  personName: string;
  type: 'swap_removed' | 'swap_added' | 'coworker_changed' | 'tomorrow_reminder' | 'today_reminder' | 'bioprocess_alert';
  title: string;
  message: string;
  shiftDate: string;
  shiftDayName: string;
  shiftKind: 'Day' | 'Night' | 'OnCall' | 'ExtraDay' | 'ExtraNight' | 'Off';
  read: boolean;
}

export interface UserAndroidSettings {
  selectedPerson: string;
  notifyOnShiftChange: boolean;
  notifyTomorrowShift: boolean;
  notifyTodayShift: boolean;
  notifyCoWorkerChange: boolean;
  notifyBioprocessOnShift: boolean;
  reminderHour: string; // e.g., "20:00"
  hapticEnabled: boolean;
  soundEnabled: boolean;
  wakeLockEnabled: boolean;
  highContrastMode: boolean;
  backgroundActiveEnabled: boolean;
}

export const DEFAULT_USER_ANDROID_SETTINGS: UserAndroidSettings = {
  selectedPerson: '',
  notifyOnShiftChange: true,
  notifyTomorrowShift: true,
  notifyTodayShift: true,
  notifyCoWorkerChange: true,
  notifyBioprocessOnShift: true,
  reminderHour: '20:00',
  hapticEnabled: true,
  soundEnabled: true,
  wakeLockEnabled: false,
  highContrastMode: false,
  backgroundActiveEnabled: true,
};

export const USER_SETTINGS_STORAGE_KEY = 'shiftflow_user_android_settings_v1';
export const USER_NOTIF_HISTORY_KEY = 'shiftflow_user_notif_history_v1';
export const USER_LAST_SCHEDULE_SNAPSHOT_KEY = 'shiftflow_user_last_sched_snapshot_v1';
export const USER_LAST_DAILY_REMINDER_KEY = 'shiftflow_user_last_daily_reminder_v1';

export function loadUserAndroidSettings(): UserAndroidSettings {
  try {
    const raw = localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_ANDROID_SETTINGS;
    return { ...DEFAULT_USER_ANDROID_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_USER_ANDROID_SETTINGS;
  }
}

export function saveUserAndroidSettings(settings: UserAndroidSettings): void {
  try {
    localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save user android settings:', e);
  }
}

export function loadNotificationHistory(): ShiftNotificationItem[] {
  try {
    const raw = localStorage.getItem(USER_NOTIF_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveNotificationHistory(items: ShiftNotificationItem[]): void {
  try {
    localStorage.setItem(USER_NOTIF_HISTORY_KEY, JSON.stringify(items.slice(0, 60)));
  } catch (e) {
    console.error('Failed to save notification history:', e);
  }
}

/**
 * Splits a shift person string (e.g., "حیدری / دهقان") and combines with extraPersons array
 */
export function getDayParticipants(entry: ShiftEntry): string[] {
  const base = (entry.dayShiftPerson || '')
    .split(/[\/،,\-\+]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== 'نامشخص' && s !== '---');
  const extras = (entry.extraDayPersons || []).map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set([...base, ...extras]));
}

export function getNightParticipants(entry: ShiftEntry): string[] {
  const base = (entry.nightShiftPerson || '')
    .split(/[\/،,\-\+]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== 'نامشخص' && s !== '---');
  const extras = (entry.extraNightPersons || []).map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set([...base, ...extras]));
}

export function getPersonRolesInShift(
  entry: ShiftEntry,
  personName: string
): {
  isDay: boolean;
  isNight: boolean;
  isOnCall: boolean;
  dayCoWorkers: string[];
  nightCoWorkers: string[];
} {
  if (!personName) {
    return { isDay: false, isNight: false, isOnCall: false, dayCoWorkers: [], nightCoWorkers: [] };
  }
  const dayAll = getDayParticipants(entry);
  const nightAll = getNightParticipants(entry);
  const isDay = dayAll.includes(personName);
  const isNight = nightAll.includes(personName);
  const isOnCall = (entry.onCallPerson || '').trim() === personName;

  return {
    isDay,
    isNight,
    isOnCall,
    dayCoWorkers: dayAll.filter((p) => p !== personName),
    nightCoWorkers: nightAll.filter((p) => p !== personName),
  };
}

/**
 * Play a pleasant dual-tone notification chime using Web Audio API
 */
export function playNotificationChime(enabled = true): void {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.setValueAtTime(880, now + 0.14); // A5

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);
  } catch {
    // Ignore audio context restrictions
  }
}

/**
 * Trigger Android Haptic Vibration
 */
export function triggerAndroidHaptic(pattern: number | number[] = [50, 40, 70], enabled = true): void {
  if (!enabled || typeof navigator === 'undefined') return;
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore vibration errors
  }
}

interface NativeAndroidBridge {
  showNotification?: (title: string, message: string) => void;
  requestNotificationPermission?: () => void;
  hasNotificationPermission?: () => boolean;
  setBackgroundActive?: (enabled: boolean, personName: string) => void;
}

/**
 * Requests OS-level notification permission on both Native Android 13+ and Web/PWA
 */
export async function requestSystemNotificationPermission(): Promise<string> {
  if (typeof window === 'undefined') return 'unsupported';

  const win = window as unknown as { AndroidBridge?: NativeAndroidBridge };
  if (win.AndroidBridge) {
    try {
      if (typeof win.AndroidBridge.requestNotificationPermission === 'function') {
        win.AndroidBridge.requestNotificationPermission();
      }
      return 'granted';
    } catch {}
  }

  if ('serviceWorker' in navigator) {
    try {
      const existing = await navigator.serviceWorker.getRegistration();
      if (!existing) {
        await navigator.serviceWorker.register('/sw.js');
      }
    } catch {}
  }

  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';

  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return Notification.permission;
  }
}

/**
 * Syncs the selected user & schedule snapshot with the Service Worker and Native Android background monitor
 */
export async function syncBackgroundServiceWorkerState(
  settings: UserAndroidSettings,
  schedule: ShiftEntry[]
): Promise<void> {
  if (typeof window === 'undefined') return;

  const win = window as unknown as { AndroidBridge?: NativeAndroidBridge };
  if (win.AndroidBridge && typeof win.AndroidBridge.setBackgroundActive === 'function') {
    try {
      win.AndroidBridge.setBackgroundActive(
        Boolean(settings.backgroundActiveEnabled && settings.selectedPerson),
        settings.selectedPerson || ''
      );
    } catch {}
  }

  if ('serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
      }
      const target = reg?.active || navigator.serviceWorker.controller;
      if (target) {
        target.postMessage({
          type: 'CONFIGURE_BG_WATCHER',
          selectedPerson: settings.selectedPerson,
          notifyOnShiftChange: settings.notifyOnShiftChange,
          backgroundActiveEnabled: settings.backgroundActiveEnabled,
          scheduleJson: JSON.stringify(schedule || []),
        });
      }
    } catch {}
  }
}

/**
 * Dispatch native Android Notification (via AndroidBridge, ServiceWorker, or Notification API)
 * Appears directly in the phone's main OS notification drawer (نوتیفیکیشن‌های اصلی گوشی)
 */
export async function sendNativeAndroidNotification(
  title: string,
  body: string,
  tag = 'shiftflow-alert'
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  let dispatched = false;

  // 1. Check Native Android WebView Bridge first (Standalone APK)
  const win = window as unknown as { AndroidBridge?: NativeAndroidBridge };
  if (win.AndroidBridge && typeof win.AndroidBridge.showNotification === 'function') {
    try {
      if (typeof win.AndroidBridge.requestNotificationPermission === 'function') {
        win.AndroidBridge.requestNotificationPermission();
      }
      win.AndroidBridge.showNotification(title, body);
      dispatched = true;
    } catch {
      // Fallback to Web Notification
    }
  }

  // 2. Standard Web / Mobile Chrome / PWA OS Notification API
  if (typeof Notification !== 'undefined') {
    let perm = Notification.permission;
    if (perm === 'default') {
      try {
        perm = await Notification.requestPermission();
      } catch {}
    }

    if (perm === 'granted') {
      const uniqueTag = `${tag}-${Date.now()}`;
      const notifOptions: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
        body,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        dir: 'rtl',
        lang: 'fa',
        tag: uniqueTag,
        renotify: true,
        vibrate: [200, 100, 250, 100, 300],
      };

      if ('serviceWorker' in navigator) {
        try {
          let reg = await navigator.serviceWorker.getRegistration();
          if (!reg) {
            reg = await navigator.serviceWorker.register('/sw.js');
          }
          if (reg && 'showNotification' in reg) {
            await reg.showNotification(title, notifOptions);
            dispatched = true;
          } else if (reg && reg.active) {
            reg.active.postMessage({
              type: 'SHOW_OS_NOTIFICATION',
              title,
              body,
              tag: uniqueTag,
            });
            dispatched = true;
          }
        } catch {}
      }

      if (!dispatched) {
        try {
          new Notification(title, notifOptions);
          dispatched = true;
        } catch {}
      }
    }
  }

  return dispatched;
}

function getNowPersianTimeStr(): string {
  try {
    return new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Compares previous schedule and updated schedule to detect any changes affecting `selectedPerson`
 */
export function detectScheduleChangesForPerson(
  oldSchedule: ShiftEntry[],
  newSchedule: ShiftEntry[],
  selectedPerson: string,
  settings: UserAndroidSettings
): ShiftNotificationItem[] {
  if (!selectedPerson || !oldSchedule.length || !newSchedule.length) return [];

  const oldMap = new Map<string, ShiftEntry>();
  for (const item of oldSchedule) {
    oldMap.set(item.date, item);
  }

  const notifications: ShiftNotificationItem[] = [];
  const nowIso = new Date().toISOString();
  const persianTime = getNowPersianTimeStr();

  for (const newEntry of newSchedule) {
    const oldEntry = oldMap.get(newEntry.date);
    if (!oldEntry) continue;

    const oldRoles = getPersonRolesInShift(oldEntry, selectedPerson);
    const newRoles = getPersonRolesInShift(newEntry, selectedPerson);
    const dateFa = toPersianDigits(newEntry.date);

    // 1. Day Shift Removed or Swapped Out
    if (settings.notifyOnShiftChange && oldRoles.isDay && !newRoles.isDay) {
      const newDayNames = getDayParticipants(newEntry).join(' و ') || 'نامشخص';
      notifications.push({
        id: `chg-day-rem-${newEntry.date}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        persianTime,
        personName: selectedPerson,
        type: 'swap_removed',
        title: `جابجایی/حذف از شیفت روز (${newEntry.dayName} ${dateFa})`,
        message: `${selectedPerson} عزیز، شما از شیفت روزِ ${newEntry.dayName} مورخ ${dateFa} برداشته شدید (جایگزین فعلی: ${newDayNames}).`,
        shiftDate: newEntry.date,
        shiftDayName: newEntry.dayName,
        shiftKind: 'Day',
        read: false,
      });
    }

    // 2. Day Shift Added or Assigned
    if (settings.notifyOnShiftChange && !oldRoles.isDay && newRoles.isDay) {
      const prevDayNames = getDayParticipants(oldEntry).join(' و ');
      const coWorkerText =
        newRoles.dayCoWorkers.length > 0
          ? ` (شیفت دو نفره به همراه ${newRoles.dayCoWorkers.join(' و ')})`
          : prevDayNames
          ? ` (جایگزین ${prevDayNames})`
          : '';
      notifications.push({
        id: `chg-day-add-${newEntry.date}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        persianTime,
        personName: selectedPerson,
        type: 'swap_added',
        title: `ثبت شیفت روز جدید (${newEntry.dayName} ${dateFa})`,
        message: `${selectedPerson} عزیز، شما برای «شیفت روز» ${newEntry.dayName} مورخ ${dateFa} ثبت شدید${coWorkerText}.`,
        shiftDate: newEntry.date,
        shiftDayName: newEntry.dayName,
        shiftKind: 'Day',
        read: false,
      });
    }

    // 3. Night Shift Removed or Swapped Out
    if (settings.notifyOnShiftChange && oldRoles.isNight && !newRoles.isNight) {
      const newNightNames = getNightParticipants(newEntry).join(' و ') || 'نامشخص';
      notifications.push({
        id: `chg-night-rem-${newEntry.date}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        persianTime,
        personName: selectedPerson,
        type: 'swap_removed',
        title: `جابجایی/حذف از شیفت شب (${newEntry.dayName} ${dateFa})`,
        message: `${selectedPerson} عزیز، شما از شیفت شبِ ${newEntry.dayName} مورخ ${dateFa} برداشته شدید (جایگزین فعلی: ${newNightNames}).`,
        shiftDate: newEntry.date,
        shiftDayName: newEntry.dayName,
        shiftKind: 'Night',
        read: false,
      });
    }

    // 4. Night Shift Added or Assigned
    if (settings.notifyOnShiftChange && !oldRoles.isNight && newRoles.isNight) {
      const prevNightNames = getNightParticipants(oldEntry).join(' و ');
      const coWorkerText =
        newRoles.nightCoWorkers.length > 0
          ? ` (شیفت دو نفره به همراه ${newRoles.nightCoWorkers.join(' و ')})`
          : prevNightNames
          ? ` (جایگزین ${prevNightNames})`
          : '';
      notifications.push({
        id: `chg-night-add-${newEntry.date}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        persianTime,
        personName: selectedPerson,
        type: 'swap_added',
        title: `ثبت شیفت شب جدید (${newEntry.dayName} ${dateFa})`,
        message: `${selectedPerson} عزیز، شما برای «شیفت شب» ${newEntry.dayName} مورخ ${dateFa} ثبت شدید${coWorkerText}.`,
        shiftDate: newEntry.date,
        shiftDayName: newEntry.dayName,
        shiftKind: 'Night',
        read: false,
      });
    }

    // 5. Co-worker changed while user remains in Day shift
    if (
      settings.notifyCoWorkerChange &&
      oldRoles.isDay &&
      newRoles.isDay &&
      oldRoles.dayCoWorkers.join(',') !== newRoles.dayCoWorkers.join(',')
    ) {
      const coText =
        newRoles.dayCoWorkers.length > 0
          ? `هم‌شیفتی شما در شیفت روز ${dateFa}: ${newRoles.dayCoWorkers.join(' و ')}`
          : `شیفت روز ${dateFa} شما به حالت تک‌نفره تغییر یافت.`;
      notifications.push({
        id: `chg-day-cowork-${newEntry.date}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        persianTime,
        personName: selectedPerson,
        type: 'coworker_changed',
        title: `تغییر هم‌شیفتی روز (${newEntry.dayName} ${dateFa})`,
        message: coText,
        shiftDate: newEntry.date,
        shiftDayName: newEntry.dayName,
        shiftKind: 'Day',
        read: false,
      });
    }

    // 6. Co-worker changed while user remains in Night shift
    if (
      settings.notifyCoWorkerChange &&
      oldRoles.isNight &&
      newRoles.isNight &&
      oldRoles.nightCoWorkers.join(',') !== newRoles.nightCoWorkers.join(',')
    ) {
      const coText =
        newRoles.nightCoWorkers.length > 0
          ? `هم‌شیفتی شما در شیفت شب ${dateFa}: ${newRoles.nightCoWorkers.join(' و ')}`
          : `شیفت شب ${dateFa} شما به حالت تک‌نفره تغییر یافت.`;
      notifications.push({
        id: `chg-night-cowork-${newEntry.date}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        persianTime,
        personName: selectedPerson,
        type: 'coworker_changed',
        title: `تغییر هم‌شیفتی شب (${newEntry.dayName} ${dateFa})`,
        message: coText,
        shiftDate: newEntry.date,
        shiftDayName: newEntry.dayName,
        shiftKind: 'Night',
        read: false,
      });
    }

    // 7. Supervisor On-Call Changed
    if (settings.notifyOnShiftChange && !oldRoles.isOnCall && newRoles.isOnCall) {
      notifications.push({
        id: `chg-sup-add-${newEntry.date}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        persianTime,
        personName: selectedPerson,
        type: 'swap_added',
        title: `ثبت کشیک سرپرستی (${newEntry.dayName} ${dateFa})`,
        message: `${selectedPerson} عزیز، شما به عنوان سرپرست آنکال در تاریخ ${dateFa} (${newEntry.dayName}) تعیین شدید.`,
        shiftDate: newEntry.date,
        shiftDayName: newEntry.dayName,
        shiftKind: 'OnCall',
        read: false,
      });
    } else if (settings.notifyOnShiftChange && oldRoles.isOnCall && !newRoles.isOnCall) {
      notifications.push({
        id: `chg-sup-rem-${newEntry.date}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: nowIso,
        persianTime,
        personName: selectedPerson,
        type: 'swap_removed',
        title: `تغییر سرپرست کشیک (${newEntry.dayName} ${dateFa})`,
        message: `سرپرست کشیک تاریخ ${dateFa} (${newEntry.dayName}) به ${newEntry.onCallPerson || 'نامشخص'} تغییر یافت.`,
        shiftDate: newEntry.date,
        shiftDayName: newEntry.dayName,
        shiftKind: 'OnCall',
        read: false,
      });
    }
  }

  return notifications;
}

/**
 * Generates a rich Tomorrow / Today Shift Reminder notification for `selectedPerson`
 */
export function buildDailyShiftReminder(
  schedule: ShiftEntry[],
  selectedPerson: string,
  dailyProcesses?: DailyProcessMap,
  includeBioprocess = true
): {
  todayEntry: ShiftEntry | null;
  tomorrowEntry: ShiftEntry | null;
  nextUpcomingShift: { entry: ShiftEntry; roleLabel: string; daysUntil: number } | null;
  notification: ShiftNotificationItem | null;
} {
  if (!selectedPerson || !schedule.length) {
    return { todayEntry: null, tomorrowEntry: null, nextUpcomingShift: null, notification: null };
  }

  const todayParts = getTodayPersianParts();
  const norm = (d: string) => d.split('/').map((p) => p.padStart(2, '0')).join('/');
  let todayStr = `${todayParts.year}/${todayParts.month}/${todayParts.day}`;

  // If todayStr is not inside schedule (e.g. testing outside the 4-month window), fallback to a representative active date in Aban 1405
  const hasToday = schedule.some((s) => norm(s.date) === norm(todayStr));
  if (!hasToday) {
    const abanFirst = schedule.find((s) => s.date.startsWith('1405/08'));
    todayStr = abanFirst ? abanFirst.date : schedule[0].date;
  }

  const tomorrowStr = getNextJalaliDate(todayStr, 1);
  const todayEntry = schedule.find((s) => norm(s.date) === norm(todayStr)) || null;
  const tomorrowEntry = schedule.find((s) => norm(s.date) === norm(tomorrowStr)) || null;

  // Find next upcoming shift starting from today
  const sorted = [...schedule].sort((a, b) => norm(a.date).localeCompare(norm(b.date)));
  const startIdx = Math.max(0, sorted.findIndex((s) => norm(s.date) >= norm(todayStr)));
  let nextUpcomingShift: { entry: ShiftEntry; roleLabel: string; daysUntil: number } | null = null;

  for (let i = startIdx; i < sorted.length; i++) {
    const item = sorted[i];
    const r = getPersonRolesInShift(item, selectedPerson);
    if (r.isDay || r.isNight || r.isOnCall) {
      const labels: string[] = [];
      if (r.isDay) {
        labels.push(
          r.dayCoWorkers.length > 0
            ? `شیفت روز (دو نفره با ${r.dayCoWorkers.join(' و ')})`
            : 'شیفت روز'
        );
      }
      if (r.isNight) {
        labels.push(
          r.nightCoWorkers.length > 0
            ? `شیفت شب (دو نفره با ${r.nightCoWorkers.join(' و ')})`
            : 'شیفت شب'
        );
      }
      if (r.isOnCall && !r.isDay && !r.isNight) {
        labels.push('سرپرست آنکال');
      }
      nextUpcomingShift = {
        entry: item,
        roleLabel: labels.join(' + '),
        daysUntil: i - startIdx,
      };
      break;
    }
  }

  const nowIso = new Date().toISOString();
  const persianTime = getNowPersianTimeStr();

  if (tomorrowEntry) {
    const tomRoles = getPersonRolesInShift(tomorrowEntry, selectedPerson);
    const tomDateFa = toPersianDigits(tomorrowEntry.date);
    const tasks = includeBioprocess && dailyProcesses ? dailyProcesses[tomorrowEntry.date] || [] : [];
    const taskSummary =
      tasks.length > 0
        ? ` | پروسه‌های فردا: ${tasks.map((t) => t.title).slice(0, 2).join('، ')}`
        : '';

    if (tomRoles.isDay || tomRoles.isNight) {
      const shiftTypeStr =
        tomRoles.isDay && tomRoles.isNight
          ? 'شیفت روز و شب'
          : tomRoles.isDay
          ? 'شیفت روز'
          : 'شیفت شب';
      const coWorkers = tomRoles.isDay ? tomRoles.dayCoWorkers : tomRoles.nightCoWorkers;
      const coText = coWorkers.length > 0 ? ` (به همراه ${coWorkers.join(' و ')})` : '';

      return {
        todayEntry,
        tomorrowEntry,
        nextUpcomingShift,
        notification: {
          id: `rem-tom-${tomorrowEntry.date}-${Date.now()}`,
          timestamp: nowIso,
          persianTime,
          personName: selectedPerson,
          type: 'tomorrow_reminder',
          title: `یادآور شیفت فردا (${tomorrowEntry.dayName} ${tomDateFa})`,
          message: `${selectedPerson} عزیز، فردا (${tomorrowEntry.dayName} ${tomDateFa}) شما «${shiftTypeStr}» هستید${coText}${taskSummary}.`,
          shiftDate: tomorrowEntry.date,
          shiftDayName: tomorrowEntry.dayName,
          shiftKind: tomRoles.isDay ? 'Day' : 'Night',
          read: false,
        },
      };
    } else {
      const nextText = nextUpcomingShift
        ? ` اولین شیفت بعدی شما: ${nextUpcomingShift.entry.dayName} ${toPersianDigits(nextUpcomingShift.entry.date)} (${nextUpcomingShift.roleLabel}).`
        : '';
      return {
        todayEntry,
        tomorrowEntry,
        nextUpcomingShift,
        notification: {
          id: `rem-off-${tomorrowEntry.date}-${Date.now()}`,
          timestamp: nowIso,
          persianTime,
          personName: selectedPerson,
          type: 'tomorrow_reminder',
          title: `وضعیت شیفت فردا (${tomorrowEntry.dayName} ${tomDateFa})`,
          message: `${selectedPerson} عزیز، فردا (${tomorrowEntry.dayName} ${tomDateFa}) شما شیفت ندارید (استراحت / OFF).${nextText}`,
          shiftDate: tomorrowEntry.date,
          shiftDayName: tomorrowEntry.dayName,
          shiftKind: 'Off',
          read: false,
        },
      };
    }
  }

  return { todayEntry, tomorrowEntry, nextUpcomingShift, notification: null };
}

/**
 * Generates an Android-compatible .ics Calendar file for all shifts of `selectedPerson` in a given month/schedule
 */
export function generatePersonalShiftICS(
  schedule: ShiftEntry[],
  selectedPerson: string,
  dailyProcesses?: DailyProcessMap
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ShiftFlow FMD//Persian Shift Calendar//FA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:شیفت‌های ${selectedPerson} - ShiftFlow FMD`,
    'X-WR-TIMEZONE:Asia/Tehran',
  ];

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const formatIcsDate = (y: number, m: number, d: number, hr: number, min: number) =>
    `${y}${pad2(m)}${pad2(d)}T${pad2(hr)}${pad2(min)}00`;

  for (const entry of schedule) {
    const roles = getPersonRolesInShift(entry, selectedPerson);
    if (!roles.isDay && !roles.isNight) continue;

    const parts = entry.date.split('/').map((n) => parseInt(n, 10));
    if (parts.length !== 3 || parts.some(isNaN)) continue;

    const [jy, jm, jd] = parts;
    const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
    const tasks = dailyProcesses ? dailyProcesses[entry.date] || [] : [];
    const taskDesc =
      tasks.length > 0
        ? `\\nپروسه‌های تولید: ${tasks.map((t) => t.title).join('، ')}`
        : '';

    if (roles.isDay) {
      const co = roles.dayCoWorkers.length > 0 ? ` (همراه: ${roles.dayCoWorkers.join('، ')})` : '';
      lines.push(
        'BEGIN:VEVENT',
        `UID:shiftflow-day-${entry.date.replace(/\//g, '')}-${selectedPerson}@fmd.ir`,
        `DTSTART:${formatIcsDate(gy, gm, gd, 7, 30)}`,
        `DTEND:${formatIcsDate(gy, gm, gd, 18, 30)}`,
        `SUMMARY:☀️ شیفت روز تولید FMD — ${selectedPerson}${co}`,
        `DESCRIPTION:تاریخ شمسی: ${entry.dayName} ${toPersianDigits(entry.date)}\\nسرپرست: ${entry.onCallPerson || '---'}${taskDesc}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT12H',
        'ACTION:DISPLAY',
        `DESCRIPTION:یادآوری: فردا شیفت روز هستید (${entry.dayName} ${toPersianDigits(entry.date)})`,
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT90M',
        'ACTION:DISPLAY',
        `DESCRIPTION:شروع شیفت روز تا ۹۰ دقیقه دیگر (${selectedPerson})`,
        'END:VALARM',
        'END:VEVENT'
      );
    }

    if (roles.isNight) {
      const co = roles.nightCoWorkers.length > 0 ? ` (همراه: ${roles.nightCoWorkers.join('، ')})` : '';
      lines.push(
        'BEGIN:VEVENT',
        `UID:shiftflow-night-${entry.date.replace(/\//g, '')}-${selectedPerson}@fmd.ir`,
        `DTSTART:${formatIcsDate(gy, gm, gd, 18, 30)}`,
        `DTEND:${formatIcsDate(gy, gm, gd, 23, 59)}`,
        `SUMMARY:🌙 شیفت شب تولید FMD — ${selectedPerson}${co}`,
        `DESCRIPTION:تاریخ شمسی: ${entry.dayName} ${toPersianDigits(entry.date)}\\nسرپرست: ${entry.onCallPerson || '---'}${taskDesc}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT8H',
        'ACTION:DISPLAY',
        `DESCRIPTION:یادآوری: امشب شیفت شب هستید (${entry.dayName} ${toPersianDigits(entry.date)})`,
        'END:VALARM',
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
