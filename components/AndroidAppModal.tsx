import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  Copy,
  Check,
  WifiOff,
  ExternalLink,
  Bell,
  BellRing,
  Sun,
  Moon,
  Vibrate,
  Volume2,
  Calendar,
  Share2,
  UserCheck,
  Users,
  ArrowRightLeft,
  SlidersHorizontal,
  Clock,
  Sparkles,
  Trash2,
  Eye,
  AlertTriangle,
  Coffee,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { useOnlineStatus } from '../utils/usePWAInstall';
import { ShiftEntry, Personnel, DailyProcessMap } from '../types';
import { toPersianDigits } from '../utils/persianDate';
import { getPersonColor } from '../utils/personnelColors';
import {
  UserAndroidSettings,
  ShiftNotificationItem,
  loadUserAndroidSettings,
  saveUserAndroidSettings,
  loadNotificationHistory,
  saveNotificationHistory,
  USER_LAST_SCHEDULE_SNAPSHOT_KEY,
  USER_LAST_DAILY_REMINDER_KEY,
  detectScheduleChangesForPerson,
  detectAllInvolvedScheduleChanges,
  dispatchScheduleChangeNotifications,
  isSamePersonName,
  buildDailyShiftReminder,
  getPersonRolesInShift,
  playNotificationChime,
  triggerAndroidHaptic,
  sendNativeAndroidNotification,
  requestSystemNotificationPermission,
  syncBackgroundServiceWorkerState,
  generatePersonalShiftICS,
} from '../utils/shiftNotifications';

const GITHUB_REPO = 'Mettiz/Android';
const LATEST_RELEASE_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases/latest`;
const LATEST_APK_DIRECT_URL = `https://github.com/${GITHUB_REPO}/releases/latest/download/ShiftFlow-FMD.apk`;

/**
 * آیکون رسمی ربات اندروید برای نمایش تمیز در نوار بالای نسخه موبایل و دسکتاپ
 */
export const AndroidLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M17.523 15.341a1.003 1.003 0 0 1-1.002-1.002c0-.553.45-1.002 1.002-1.002.552 0 1.002.45 1.002 1.002 0 .552-.45 1.002-1.002 1.002m-11.046 0a1.003 1.003 0 0 1-1.002-1.002c0-.553.45-1.002 1.002-1.002.552 0 1.002.45 1.002 1.002 0 .552-.45 1.002-1.002 1.002m11.405-6.02 1.997-3.46a.416.416 0 0 0-.152-.567.416.416 0 0 0-.568.152L17.112 8.95c-1.504-.686-3.222-1.073-5.112-1.073-1.89 0-3.608.387-5.112 1.073L4.841 5.446a.416.416 0 0 0-.568-.152.416.416 0 0 0-.152.567l1.997 3.46C2.688 11.186.343 14.658 0 18.761h24c-.343-4.103-2.688-7.575-6.118-9.44" />
  </svg>
);

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[9990] flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg border border-amber-400/40 print:hidden">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>حالت آفلاین فعال است — اطلاعات از حافظه داخلی برنامه نمایش داده می‌شود</span>
    </div>
  );
};

interface PWAInstallButtonProps {
  className?: string;
  schedule?: ShiftEntry[];
}

interface GitHubReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  apkDownloadUrl: string;
  apkSizeMb?: string;
}

/**
 * دکمه «اپلیکیشن اندروید»:
 * در موبایل فقط آیکون اندروید نمایش داده می‌شود تا هدر بالا شلوغ نشود.
 * با کلیک روی آن فقط لینک آخرین انتشار (Latest Releases) و دانلود مستقیم باز می‌شود.
 */
export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ className = '' }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<GitHubReleaseInfo>({
    tagName: 'v4.0.0',
    name: 'ShiftFlow FMD Android v4.0.0',
    publishedAt: '',
    htmlUrl: LATEST_RELEASE_PAGE_URL,
    apkDownloadUrl: LATEST_APK_DIRECT_URL,
  });

  useEffect(() => {
    if (!isModalOpen) return;
    document.body.style.overflow = 'hidden';

    fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const apkAsset = Array.isArray(data.assets)
          ? data.assets.find((a: { name?: string }) => a.name && a.name.endsWith('.apk'))
          : null;
        const sizeMb =
          apkAsset && typeof apkAsset.size === 'number'
            ? toPersianDigits((apkAsset.size / (1024 * 1024)).toFixed(1)) + ' مگابایت'
            : undefined;
        let pubDate = '';
        if (data.published_at) {
          try {
            pubDate = new Date(data.published_at).toLocaleDateString('fa-IR');
          } catch {}
        }
        const rawTag = data.tag_name && data.tag_name !== 'v3.0.0' ? data.tag_name : 'v4.0.0';
        const rawName =
          data.name && !String(data.name).includes('v3.0.0')
            ? data.name
            : `ShiftFlow FMD Android ${rawTag}`;
        setReleaseInfo({
          tagName: rawTag,
          name: rawName,
          publishedAt: pubDate,
          htmlUrl: data.html_url || LATEST_RELEASE_PAGE_URL,
          apkDownloadUrl: apkAsset?.browser_download_url || LATEST_APK_DIRECT_URL,
          apkSizeMb: sizeMb,
        });
      })
      .catch(() => {});

    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  const handleCopyReleaseUrl = () => {
    navigator.clipboard.writeText(releaseInfo.htmlUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const modalContent = isModalOpen ? (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-4 overflow-y-auto"
      dir="rtl"
      onClick={() => setIsModalOpen(false)}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-900 via-emerald-800 to-teal-800 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner shrink-0">
              <AndroidLogoIcon className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                <span>اپلیکیشن اندروید ( آخرین Releases )</span>
              </h2>
              <p className="text-[11px] text-emerald-100/90 mt-0.5">
                دریافت آخرین نسخه رسمی منتشرشده در GitHub Releases
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/25 text-white transition cursor-pointer shrink-0"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Single Clean Content: Latest Releases Link Only */}
        <div className="p-5 space-y-4 bg-white">
          <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-black text-emerald-950">
                {releaseInfo.name}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-black dir-ltr">
                {releaseInfo.tagName}
              </span>
            </div>

            {releaseInfo.publishedAt && (
              <div className="text-[11px] text-slate-600 font-medium">
                تاریخ آخرین انتشار: <strong>{releaseInfo.publishedAt}</strong>
                {releaseInfo.apkSizeMb ? ` · حجم: ${releaseInfo.apkSizeMb}` : ''}
              </div>
            )}

            {/* Direct Link Box */}
            <div
              className="bg-white border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2"
              dir="ltr"
            >
              <a
                href={releaseInfo.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono font-bold text-emerald-700 hover:text-emerald-900 underline truncate"
              >
                {releaseInfo.htmlUrl}
              </a>
              <button
                type="button"
                onClick={handleCopyReleaseUrl}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                dir="rtl"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>کپی شد</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>کپی لینک</span>
                  </>
                )}
              </button>
            </div>

            {/* Primary CTA: Open Latest Releases Page */}
            <a
              href={releaseInfo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs sm:text-sm px-4 py-3.5 rounded-xl shadow-md transition cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              <span>مشاهده و دانلود از صفحه آخرین Releases گیت‌هاب</span>
            </a>

            {/* Direct APK Asset Link from Latest Release */}
            <a
              href={releaseInfo.apkDownloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-3 rounded-xl transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>دانلود مستقیم فایل ShiftFlow-FMD.apk (آخرین Release)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`flex items-center justify-center gap-1.5 w-8 h-8 sm:w-9 sm:h-9 md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs border cursor-pointer shrink-0 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 ${className}`}
        title="دانلود اپلیکیشن اندروید (آخرین Releases)"
        aria-label="اپلیکیشن اندروید"
      >
        <AndroidLogoIcon className="w-4 h-4 sm:w-[18px] sm:h-[18px] shrink-0 text-emerald-600" />
        <span className="hidden md:inline whitespace-nowrap">اپلیکیشن اندروید</span>
      </button>

      {typeof document !== 'undefined' && modalContent
        ? createPortal(modalContent, document.body)
        : null}
    </>
  );
};

/* ============================================================================
 * USER SETTINGS & SMART ANDROID SHIFT NOTIFICATION CENTER (برای همه کاربران)
 * ============================================================================ */

interface UserSettingsButtonProps {
  schedule: ShiftEntry[];
  personnelList: Personnel[];
  dailyProcesses?: DailyProcessMap;
  currentMonthName?: string;
  currentYear?: number;
  currentMonthCode?: string;
}

export const UserSettingsButton: React.FC<UserSettingsButtonProps> = ({
  schedule,
  personnelList,
  dailyProcesses,
  currentMonthName = 'آبان',
  currentYear = 1405,
  currentMonthCode = '08',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'android'>('profile');
  const [settings, setSettings] = useState<UserAndroidSettings>(() => loadUserAndroidSettings());
  const [notifHistory, setNotifHistory] = useState<ShiftNotificationItem[]>(() =>
    loadNotificationHistory()
  );
  const [liveBannerNotif, setLiveBannerNotif] = useState<ShiftNotificationItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<{ release: () => Promise<void> } | null>(
    null
  );
  const [notifPermission, setNotifPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && (window as unknown as { AndroidBridge?: unknown }).AndroidBridge) {
      return 'granted';
    }
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  });
  const [isPersonDropdownOpen, setIsPersonDropdownOpen] = useState(false);

  const prevScheduleRef = useRef<ShiftEntry[] | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const updateSettings = (patch: Partial<UserAndroidSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveUserAndroidSettings(next);
      return next;
    });
  };

  // Sync Service Worker & Native Android Background Watcher whenever settings or schedule changes
  useEffect(() => {
    syncBackgroundServiceWorkerState(settings, schedule);
  }, [settings, schedule]);

  // Apply High Readability / Large Font Mode on document root if enabled
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (settings.highContrastMode) {
      document.documentElement.style.fontSize = '107%';
    } else {
      document.documentElement.style.fontSize = '';
    }
  }, [settings.highContrastMode]);

  // All personnel names (without role titles)
  const allPersonnelOptions = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();

    for (const p of personnelList) {
      if (!p.name || p.name === 'نامشخص') continue;
      map.set(p.name, {
        name: p.name,
        color: p.color || getPersonColor(p.name, personnelList),
      });
    }

    for (const s of schedule) {
      const names = [
        s.dayShiftPerson,
        s.nightShiftPerson,
        ...(s.extraDayPersons || []),
        ...(s.extraNightPersons || []),
      ];
      for (const raw of names) {
        if (!raw) continue;
        const parts = raw
          .split(/[\/،,\-\+]+/)
          .map((x) => x.trim())
          .filter((x) => x && x !== 'نامشخص' && x !== '---');
        for (const n of parts) {
          if (!map.has(n)) {
            map.set(n, {
              name: n,
              color: getPersonColor(n, personnelList),
            });
          }
        }
      }
      if (s.onCallPerson && s.onCallPerson !== 'نامشخص' && !map.has(s.onCallPerson)) {
        map.set(s.onCallPerson, {
          name: s.onCallPerson,
          color: getPersonColor(s.onCallPerson, personnelList),
        });
      }
    }

    return Array.from(map.values());
  }, [personnelList, schedule]);

  // Compute live Today / Tomorrow / Next Upcoming Shift summary for `settings.selectedPerson`
  const personalShiftSummary = useMemo(() => {
    if (!settings.selectedPerson) return null;
    const reminderData = buildDailyShiftReminder(
      schedule,
      settings.selectedPerson,
      dailyProcesses,
      settings.notifyBioprocessOnShift
    );

    const monthPrefix = `${currentYear}/${currentMonthCode}`;
    const monthEntries = schedule.filter((s) => s.date.startsWith(monthPrefix));
    let dayCount = 0;
    let nightCount = 0;
    let onCallCount = 0;
    let twoPersonCount = 0;

    for (const entry of monthEntries) {
      const r = getPersonRolesInShift(entry, settings.selectedPerson);
      if (r.isDay) {
        dayCount++;
        if (r.dayCoWorkers.length > 0) twoPersonCount++;
      }
      if (r.isNight) {
        nightCount++;
        if (r.nightCoWorkers.length > 0) twoPersonCount++;
      }
      if (r.isOnCall) {
        onCallCount++;
      }
    }

    const totalHours = dayCount * 11 + nightCount * 13;

    return {
      ...reminderData,
      dayCount,
      nightCount,
      onCallCount,
      twoPersonCount,
      totalHours,
    };
  }, [
    schedule,
    settings.selectedPerson,
    dailyProcesses,
    settings.notifyBioprocessOnShift,
    currentYear,
    currentMonthCode,
  ]);

  // Listen to direct synchronous shift swap notifications dispatched from App.tsx or cloud sync
  useEffect(() => {
    const handleNotifEvent = (e: Event) => {
      const custom = e as CustomEvent<{
        added?: ShiftNotificationItem[];
        history?: ShiftNotificationItem[];
        latest?: ShiftNotificationItem;
      }>;
      if (custom.detail?.history) {
        setNotifHistory(custom.detail.history);
      } else {
        setNotifHistory(loadNotificationHistory());
      }
      if (custom.detail?.latest) {
        setLiveBannerNotif(custom.detail.latest);
      }
    };
    window.addEventListener('shiftflow-notifications-updated', handleNotifEvent);
    return () => {
      window.removeEventListener('shiftflow-notifications-updated', handleNotifEvent);
    };
  }, []);

  // 1. Real-Time Shift Swap / Removal / Addition Watcher (Personal + All Involved People)
  useEffect(() => {
    if (!schedule || schedule.length === 0) return;

    // Use in-memory baseline first; only fall back to localStorage on initial cold start
    let baseline = prevScheduleRef.current;
    if (!baseline) {
      try {
        const savedSnap = localStorage.getItem(USER_LAST_SCHEDULE_SNAPSHOT_KEY);
        if (savedSnap) {
          baseline = JSON.parse(savedSnap);
        }
      } catch {}
    }

    if (baseline && baseline !== schedule) {
      dispatchScheduleChangeNotifications(baseline, schedule);
    }

    // Clone schedule entries so future comparisons are never affected by reference sharing
    prevScheduleRef.current = schedule.map((s) => ({
      ...s,
      extraDayPersons: s.extraDayPersons ? [...s.extraDayPersons] : undefined,
      extraNightPersons: s.extraNightPersons ? [...s.extraNightPersons] : undefined,
    }));
    try {
      localStorage.setItem(USER_LAST_SCHEDULE_SNAPSHOT_KEY, JSON.stringify(schedule));
    } catch {}
  }, [schedule, settings]);

  // 2. Automatic Daily Tomorrow Shift Reminder Watcher
  useEffect(() => {
    if (!settings.selectedPerson || !settings.notifyTomorrowShift || !schedule.length) return;

    const summary = buildDailyShiftReminder(
      schedule,
      settings.selectedPerson,
      dailyProcesses,
      settings.notifyBioprocessOnShift
    );
    if (!summary.notification || !summary.tomorrowEntry) return;

    const reminderKey = `${settings.selectedPerson}_${summary.tomorrowEntry.date}`;
    try {
      const lastSentKey = localStorage.getItem(USER_LAST_DAILY_REMINDER_KEY);
      if (lastSentKey !== reminderKey) {
        localStorage.setItem(USER_LAST_DAILY_REMINDER_KEY, reminderKey);
        const notif = summary.notification;
        setNotifHistory((prev) => {
          const exists = prev.some(
            (n) => n.type === 'tomorrow_reminder' && n.shiftDate === notif.shiftDate && n.personName === notif.personName
          );
          if (exists) return prev;
          const updated = [notif, ...prev].slice(0, 60);
          saveNotificationHistory(updated);
          return updated;
        });

        // Send OS notification & live banner if tomorrow is an active Day or Night shift
        if (notif.shiftKind === 'Day' || notif.shiftKind === 'Night') {
          setLiveBannerNotif(notif);
          sendNativeAndroidNotification(notif.title, notif.message, `tom-${reminderKey}`);
        }
      }
    } catch {}
  }, [
    settings.selectedPerson,
    settings.notifyTomorrowShift,
    settings.notifyBioprocessOnShift,
    schedule,
    dailyProcesses,
  ]);

  // Filter notifications for currently selected person (plus general involved-people alerts)
  const userNotifications = useMemo(() => {
    if (!settings.selectedPerson) return notifHistory;
    return notifHistory.filter(
      (n) =>
        isSamePersonName(n.personName, settings.selectedPerson) ||
        n.personName === 'همه افراد درگیر' ||
        n.message.includes(settings.selectedPerson)
    );
  }, [notifHistory, settings.selectedPerson]);

  const unreadCount = useMemo(
    () => userNotifications.filter((n) => !n.read).length,
    [userNotifications]
  );

  const handleMarkAllRead = () => {
    setNotifHistory((prev) => {
      const updated = prev.map((n) =>
        !settings.selectedPerson ||
        isSamePersonName(n.personName, settings.selectedPerson) ||
        n.personName === 'همه افراد درگیر' ||
        n.message.includes(settings.selectedPerson)
          ? { ...n, read: true }
          : n
      );
      saveNotificationHistory(updated);
      return updated;
    });
  };

  const handleClearNotifications = () => {
    setNotifHistory((prev) => {
      const updated = settings.selectedPerson
        ? prev.filter(
            (n) =>
              !isSamePersonName(n.personName, settings.selectedPerson) &&
              n.personName !== 'همه افراد درگیر'
          )
        : [];
      saveNotificationHistory(updated);
      return updated;
    });
    showToast('تاریخچه اعلان‌ها پاک شد.');
  };

  const handleEnablePhoneOSNotifications = async () => {
    triggerAndroidHaptic([40, 40, 60], settings.hapticEnabled);
    const perm = await requestSystemNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      const personLabel = settings.selectedPerson || 'کاربر';
      await sendNativeAndroidNotification(
        'نوتیفیکیشن اصلی گوشی فعال شد',
        `${personLabel} عزیز، از این پس تغییرات شیفت و یادآور شیفت فردا مستقیماً در نوتیفیکیشن‌های اصلی گوشی شما نمایش داده می‌شود.`,
        `os-perm-ok-${Date.now()}`
      );
      showToast('نوتیفیکیشن اصلی گوشی با موفقیت فعال و تست شد!');
    } else {
      showToast('لطفاً مجوز نمایش نوتیفیکیشن را در تنظیمات مرورگر/گوشی تایید کنید.');
    }
  };

  // Manual trigger: Send Tomorrow & Today Shift Reminder right now
  const handleSendTomorrowReminderNow = async () => {
    if (!settings.selectedPerson) {
      showToast('لطفاً ابتدا نام خود را از لیست پرسنل انتخاب کنید.');
      setActiveTab('profile');
      return;
    }

    triggerAndroidHaptic([40, 50, 40], settings.hapticEnabled);
    playNotificationChime(settings.soundEnabled);

    const perm = await requestSystemNotificationPermission();
    setNotifPermission(perm);

    const summary = buildDailyShiftReminder(
      schedule,
      settings.selectedPerson,
      dailyProcesses,
      settings.notifyBioprocessOnShift
    );

    if (summary.notification) {
      const notif: ShiftNotificationItem = {
        ...summary.notification,
        id: `manual-rem-${Date.now()}`,
        read: false,
      };
      setNotifHistory((prev) => {
        const updated = [notif, ...prev].slice(0, 60);
        saveNotificationHistory(updated);
        return updated;
      });
      setLiveBannerNotif(notif);
      await sendNativeAndroidNotification(notif.title, notif.message, notif.id);
      showToast('اعلان وضعیت شیفت فردا به نوتیفیکیشن اصلی گوشی ارسال شد!');
    }
  };

  // Simulate a Shift Swap Notification for testing
  const handleSimulateSwapAlert = async () => {
    if (!settings.selectedPerson) {
      showToast('لطفاً ابتدا نام خود را از لیست نفرات انتخاب کنید.');
      setActiveTab('profile');
      return;
    }

    triggerAndroidHaptic([80, 50, 120], settings.hapticEnabled);
    playNotificationChime(settings.soundEnabled);

    const perm = await requestSystemNotificationPermission();
    setNotifPermission(perm);

    const sampleShift =
      schedule.find((s) => {
        const r = getPersonRolesInShift(s, settings.selectedPerson);
        return r.isDay || r.isNight;
      }) || schedule[0];

    const dateFa = sampleShift ? toPersianDigits(sampleShift.date) : '۱۴۰۵/۰۸/۰۵';
    const dayName = sampleShift ? sampleShift.dayName : 'سه‌شنبه';

    const testNotif: ShiftNotificationItem = {
      id: `sim-swap-${Date.now()}`,
      timestamp: new Date().toISOString(),
      persianTime: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      personName: settings.selectedPerson,
      type: 'swap_added',
      title: `تست اعلان جابجایی شیفت (${dayName} ${dateFa})`,
      message: `${settings.selectedPerson} عزیز، شیفت شما در تاریخ ${dateFa} (${dayName}) به‌روزرسانی شد. در صورت هرگونه تغییر واقعی در جدول توسط مدیر، همین اعلان بلافاصله در نوتیفیکیشن اصلی گوشی شما نمایش داده می‌شود.`,
      shiftDate: sampleShift?.date || '1405/08/05',
      shiftDayName: dayName,
      shiftKind: 'Night',
      read: false,
    };

    setNotifHistory((prev) => {
      const updated = [testNotif, ...prev].slice(0, 60);
      saveNotificationHistory(updated);
      return updated;
    });
    setLiveBannerNotif(testNotif);
    await sendNativeAndroidNotification(testNotif.title, testNotif.message, testNotif.id);
    showToast('اعلان تست جابجایی به نوتیفیکیشن اصلی گوشی ارسال شد!');
  };

  // Toggle Android Screen Wake Lock
  const handleToggleWakeLock = async () => {
    triggerAndroidHaptic(30, settings.hapticEnabled);
    if (wakeLockActive && wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
      } catch {}
      setWakeLockSentinel(null);
      setWakeLockActive(false);
      updateSettings({ wakeLockEnabled: false });
      showToast('قفل روشن ماندن صفحه غیرفعال شد.');
      return;
    }

    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        const sentinel = await (
          navigator as unknown as {
            wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void>; addEventListener: (e: string, cb: () => void) => void }> };
          }
        ).wakeLock.request('screen');
        setWakeLockSentinel(sentinel);
        setWakeLockActive(true);
        updateSettings({ wakeLockEnabled: true });
        sentinel.addEventListener('release', () => {
          setWakeLockActive(false);
        });
        showToast('صفحه گوشی در حین کار با برنامه روشن می‌ماند (Wake Lock فعال شد).');
      } catch {
        updateSettings({ wakeLockEnabled: !settings.wakeLockEnabled });
        showToast('قفل صفحه برای محیط اندروید ذخیره شد.');
      }
    } else {
      updateSettings({ wakeLockEnabled: !settings.wakeLockEnabled });
      showToast('تنظیم روشن ماندن صفحه ذخیره شد.');
    }
  };

  // Export Personal Shifts to Android Calendar (.ics)
  const handleExportAndroidCalendar = () => {
    if (!settings.selectedPerson) {
      showToast('لطفاً ابتدا نام خود را از لیست نفرات انتخاب کنید.');
      setActiveTab('profile');
      return;
    }
    triggerAndroidHaptic(40, settings.hapticEnabled);
    const icsContent = generatePersonalShiftICS(schedule, settings.selectedPerson, dailyProcesses);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ShiftFlow-${settings.selectedPerson}-1405.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast(`فایل تقویم و آلارم اندروید برای «${settings.selectedPerson}» دانلود شد!`);
  };

  // Share Personal Monthly Shifts via Native Android Share / Clipboard
  const handleSharePersonalSchedule = async () => {
    if (!settings.selectedPerson) {
      showToast('لطفاً ابتدا نام خود را از لیست نفرات انتخاب کنید.');
      setActiveTab('profile');
      return;
    }
    triggerAndroidHaptic(35, settings.hapticEnabled);
    const monthPrefix = `${currentYear}/${currentMonthCode}`;
    const myShifts = schedule
      .filter((s) => s.date.startsWith(monthPrefix))
      .map((s) => {
        const r = getPersonRolesInShift(s, settings.selectedPerson);
        if (!r.isDay && !r.isNight && !r.isOnCall) return null;
        const parts: string[] = [];
        if (r.isDay) {
          parts.push(
            r.dayCoWorkers.length > 0 ? `روز (با ${r.dayCoWorkers.join('، ')})` : 'شیفت روز'
          );
        }
        if (r.isNight) {
          parts.push(
            r.nightCoWorkers.length > 0 ? `شب (با ${r.nightCoWorkers.join('، ')})` : 'شیفت شب'
          );
        }
        if (r.isOnCall && !r.isDay && !r.isNight) {
          parts.push('سرپرست آنکال');
        }
        return `• ${s.dayName} ${toPersianDigits(s.date)}: ${parts.join(' + ')}`;
      })
      .filter(Boolean);

    const text =
      `📅 برنامه شیفت ${settings.selectedPerson} — ${currentMonthName} ${toPersianDigits(currentYear)}\n` +
      (myShifts.length > 0 ? myShifts.join('\n') : 'بدون شیفت ثبت‌شده در این ماه') +
      `\n\n(سامانه مدیریت شیفت تولید FMD)`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `برنامه شیفت ${settings.selectedPerson}`,
          text,
        });
        return;
      } catch {}
    }

    navigator.clipboard.writeText(text);
    showToast(`لیست شیفت‌های ${settings.selectedPerson} کپی شد؛ آماده ارسال در واتساپ یا تلگرام!`);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const todayRoles =
    personalShiftSummary?.todayEntry && settings.selectedPerson
      ? getPersonRolesInShift(personalShiftSummary.todayEntry, settings.selectedPerson)
      : null;

  const tomorrowRoles =
    personalShiftSummary?.tomorrowEntry && settings.selectedPerson
      ? getPersonRolesInShift(personalShiftSummary.tomorrowEntry, settings.selectedPerson)
      : null;

  return (
    <>
      {/* Top Navbar Trigger Button for All Users (Compact on Mobile so icons never overlap) */}
      <button
        type="button"
        onClick={() => {
          triggerAndroidHaptic(25, settings.hapticEnabled);
          setIsOpen(true);
        }}
        className="relative flex items-center justify-center gap-1 sm:gap-1.5 h-8 sm:h-9 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all shadow-2xs border cursor-pointer shrink-0 bg-slate-100 hover:bg-slate-200/80 text-slate-800 border-slate-200/90"
        title="تنظیمات کاربری، انتخاب نام برای نوتیفیکیشن اصلی گوشی و امکانات اندروید"
      >
        <BellRing className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700 shrink-0" />
        {settings.selectedPerson ? (
          <span className="max-w-[54px] sm:max-w-none truncate whitespace-nowrap">
            <span className="hidden sm:inline">تنظیمات: </span>
            {settings.selectedPerson}
          </span>
        ) : (
          <>
            <span className="hidden sm:inline whitespace-nowrap">تنظیمات و اعلان شیفت</span>
            <span className="sm:hidden whitespace-nowrap">اعلان</span>
          </>
        )}
        {unreadCount > 0 && (
          <span className="flex items-center justify-center min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] px-1 rounded-full bg-rose-600 text-white text-[9px] sm:text-[10px] font-black shadow-2xs">
            {toPersianDigits(unreadCount)}
          </span>
        )}
      </button>

      {/* Live Floating Alert Banner when a shift swap/removal or tomorrow reminder arrives */}
      {liveBannerNotif &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[99990] w-[94vw] max-w-lg animate-in fade-in slide-in-from-top-3 duration-200 print:hidden"
            dir="rtl"
          >
            <div
              className={`rounded-2xl p-3.5 shadow-2xl border-2 flex items-start justify-between gap-3 ${
                liveBannerNotif.type === 'swap_removed'
                  ? 'bg-rose-950 text-white border-rose-400'
                  : liveBannerNotif.type === 'swap_added'
                  ? 'bg-emerald-950 text-white border-emerald-400'
                  : 'bg-slate-900 text-white border-teal-400'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-white/15 shrink-0 mt-0.5">
                  <BellRing className="w-5 h-5 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-amber-300 flex items-center gap-1.5 flex-wrap">
                    <span>{liveBannerNotif.title}</span>
                    <span className="text-[10px] text-white/70 font-normal">
                      {liveBannerNotif.persianTime}
                    </span>
                  </div>
                  <p className="text-xs text-white/95 mt-1 leading-relaxed">
                    {liveBannerNotif.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLiveBannerNotif(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0 cursor-pointer"
                title="بستن اعلان"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* User Settings & Android Practical Features Modal */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-2.5 sm:p-4 overflow-y-auto"
            dir="rtl"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto relative animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Toast inside modal */}
              {toastMsg && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl border border-emerald-500/40 flex items-center gap-2 whitespace-nowrap">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{toastMsg}</span>
                </div>
              )}

              {/* Modal Header */}
              <div className="bg-gradient-to-l from-slate-900 via-teal-950 to-emerald-900 p-4 sm:p-5 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                    <SlidersHorizontal className="w-6 h-6 text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black flex items-center gap-2 flex-wrap">
                      <span>تنظیمات کاربری، اعلان هوشمند شیفت و امکانات اندروید</span>
                    </h2>
                    <p className="text-[11px] text-emerald-100/85 mt-0.5">
                      انتخاب نام، نمایش در نوتیفیکیشن‌های اصلی گوشی، فعالیت در پس‌زمینه و یادآور شیفت فردا
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/25 text-white transition cursor-pointer shrink-0"
                  title="بستن"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 bg-slate-100 px-3 sm:px-5 pt-2.5 gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => {
                    triggerAndroidHaptic(20, settings.hapticEnabled);
                    setActiveTab('profile');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold transition border-b-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-white text-emerald-800 border-emerald-600 shadow-2xs'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>۱. انتخاب نام من و وضعیت شیفت</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerAndroidHaptic(20, settings.hapticEnabled);
                    setActiveTab('notifications');
                    handleMarkAllRead();
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold transition border-b-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'notifications'
                      ? 'bg-white text-emerald-800 border-emerald-600 shadow-2xs'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Bell className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>۲. نوتیفیکیشن شیفت و جابجایی‌ها</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black">
                      {toPersianDigits(unreadCount)}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerAndroidHaptic(20, settings.hapticEnabled);
                    setActiveTab('android');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold transition border-b-2 whitespace-nowrap cursor-pointer ${
                    activeTab === 'android'
                      ? 'bg-white text-emerald-800 border-emerald-600 shadow-2xs'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Smartphone className="w-4 h-4 shrink-0 text-teal-600" />
                  <span>۳. قابلیت‌های کاربردی اندروید</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-5 space-y-4 max-h-[72vh] overflow-y-auto bg-white">
                {/* OS Notification & Background Activity Bar */}
                <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-600 text-white shrink-0 mt-0.5">
                      <BellRing className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-teal-950 flex items-center gap-1.5 flex-wrap">
                        <span>نمایش در نوتیفیکیشن‌های اصلی گوشی + فعالیت در پس‌زمینه</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {notifPermission === 'granted'
                          ? 'مجوز نوتیفیکیشن اصلی گوشی فعال است و برنامه در پس‌زمینه تغییرات شیفت را رصد می‌کند.'
                          : 'برای اینکه اعلان‌ها علاوه بر داخل برنامه، در نوار نوتیفیکیشن بالای گوشی هم بیایند، دکمه روبرو را بزنید.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleEnablePhoneOSNotifications}
                    className="w-full sm:w-auto shrink-0 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-black transition cursor-pointer shadow-2xs whitespace-nowrap"
                  >
                    {notifPermission === 'granted'
                      ? 'تست ارسال به نوتیفیکیشن گوشی'
                      : 'فعال‌سازی نوتیفیکیشن اصلی گوشی'}
                  </button>
                </div>

                {/* TAB 1: SELECT USER NAME & LIVE SHIFT STATUS */}
                {activeTab === 'profile' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>انتخاب نام شما:</span>
                          </h3>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            نام خود را از منوی کشویی زیر انتخاب کنید تا اعلان‌های جابجایی، حذف یا یادآوری شیفت فردا در نوتیفیکیشن اصلی گوشی فعال شود.
                          </p>
                        </div>
                        {settings.selectedPerson && (
                          <button
                            type="button"
                            onClick={() => {
                              updateSettings({ selectedPerson: '' });
                              setIsPersonDropdownOpen(false);
                              showToast('انتخاب نام پاک شد.');
                            }}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                          >
                            حذف انتخاب
                          </button>
                        )}
                      </div>

                      {/* Sleek Custom Dropdown Menu for Personnel Selection */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            triggerAndroidHaptic(20, settings.hapticEnabled);
                            setIsPersonDropdownOpen((prev) => !prev);
                          }}
                          className="w-full flex items-center justify-between gap-3 bg-white hover:bg-slate-50/80 border-2 border-slate-200 focus:border-emerald-600 rounded-xl px-4 py-3 text-right transition cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {settings.selectedPerson ? (
                              <>
                                <span
                                  className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/15"
                                  style={{
                                    backgroundColor:
                                      allPersonnelOptions.find(
                                        (p) => p.name === settings.selectedPerson
                                      )?.color || '#10b981',
                                  }}
                                />
                                <span className="text-sm font-black text-slate-900 truncate">
                                  {settings.selectedPerson}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs sm:text-sm font-bold text-slate-400">
                                نام خود را از لیست انتخاب کنید...
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                              isPersonDropdownOpen ? 'rotate-180 text-emerald-600' : ''
                            }`}
                          />
                        </button>

                        {isPersonDropdownOpen && (
                          <div className="mt-1.5 w-full rounded-xl bg-white border border-slate-200 shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 z-30 animate-in fade-in slide-in-from-top-1 duration-150">
                            {allPersonnelOptions.map((person) => {
                              const isSelected = settings.selectedPerson === person.name;
                              return (
                                <button
                                  key={person.name}
                                  type="button"
                                  onClick={async () => {
                                    triggerAndroidHaptic(30, settings.hapticEnabled);
                                    updateSettings({ selectedPerson: person.name });
                                    setIsPersonDropdownOpen(false);
                                    const perm = await requestSystemNotificationPermission();
                                    setNotifPermission(perm);
                                    await sendNativeAndroidNotification(
                                      `اعلان هوشمند شیفت فعال شد (${person.name})`,
                                      `${person.name} عزیز، از این پس هرگونه جابجایی شیفت یا یادآوری شیفت فردا در نوتیفیکیشن‌های اصلی گوشی شما نمایش داده می‌شود.`,
                                      `select-person-${person.name}`
                                    );
                                    showToast(
                                      `نام شما (${person.name}) انتخاب شد و نوتیفیکیشن اصلی گوشی فعال گردید.`
                                    );
                                  }}
                                  className={`w-full flex items-center justify-between px-4 py-2.5 text-right transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-emerald-50 text-emerald-950 font-black'
                                      : 'hover:bg-slate-50 text-slate-800 font-bold'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                      className="w-3 h-3 rounded-full shrink-0 border border-black/15"
                                      style={{ backgroundColor: person.color }}
                                    />
                                    <span className="text-xs sm:text-sm truncate">{person.name}</span>
                                  </div>
                                  {isSelected && (
                                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Personal Shift Status Card (Today / Tomorrow / Next Shift / Stats) */}
                    {settings.selectedPerson && personalShiftSummary ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3.5">
                        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-200/70 pb-2.5">
                          <div className="text-xs sm:text-sm font-black text-emerald-950">
                            وضعیت زنده شیفت‌های «{settings.selectedPerson}»
                          </div>
                          <button
                            type="button"
                            onClick={handleSendTomorrowReminderNow}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer shadow-2xs"
                          >
                            <BellRing className="w-3.5 h-3.5" />
                            <span>ارسال اعلان وضعیت فردا روی گوشی</span>
                          </button>
                        </div>

                        {/* Today & Tomorrow Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Today Card */}
                          <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>وضعیت امروز شما</span>
                              {personalShiftSummary.todayEntry && (
                                <span className="font-mono font-bold text-slate-700">
                                  {personalShiftSummary.todayEntry.dayName}{' '}
                                  {toPersianDigits(personalShiftSummary.todayEntry.date)}
                                </span>
                              )}
                            </div>
                            {todayRoles && (todayRoles.isDay || todayRoles.isNight || todayRoles.isOnCall) ? (
                              <div className="space-y-1">
                                {todayRoles.isDay && (
                                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-700">
                                    <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span>
                                      امروز «شیفت روز» هستید
                                      {todayRoles.dayCoWorkers.length > 0
                                        ? ` (دو نفره با ${todayRoles.dayCoWorkers.join(' و ')})`
                                        : ''}
                                    </span>
                                  </div>
                                )}
                                {todayRoles.isNight && (
                                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-700">
                                    <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <span>
                                      امشب «شیفت شب» هستید
                                      {todayRoles.nightCoWorkers.length > 0
                                        ? ` (دو نفره با ${todayRoles.nightCoWorkers.join(' و ')})`
                                        : ''}
                                    </span>
                                  </div>
                                )}
                                {todayRoles.isOnCall && !todayRoles.isDay && !todayRoles.isNight && (
                                  <div className="text-xs font-black text-emerald-700">
                                    امروز در برنامه حضور دارید
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                <Coffee className="w-4 h-4 text-teal-600 shrink-0" />
                                <span>امروز شیفت ندارید (استراحت / OFF)</span>
                              </div>
                            )}
                          </div>

                          {/* Tomorrow Card */}
                          <div className="bg-white rounded-xl p-3 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>وضعیت فردای شما</span>
                              {personalShiftSummary.tomorrowEntry && (
                                <span className="font-mono font-bold text-slate-700">
                                  {personalShiftSummary.tomorrowEntry.dayName}{' '}
                                  {toPersianDigits(personalShiftSummary.tomorrowEntry.date)}
                                </span>
                              )}
                            </div>
                            {tomorrowRoles &&
                            (tomorrowRoles.isDay || tomorrowRoles.isNight || tomorrowRoles.isOnCall) ? (
                              <div className="space-y-1">
                                {tomorrowRoles.isDay && (
                                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-700">
                                    <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span>
                                      فردا «شیفت روز» هستید
                                      {tomorrowRoles.dayCoWorkers.length > 0
                                        ? ` (دو نفره با ${tomorrowRoles.dayCoWorkers.join(' و ')})`
                                        : ''}
                                    </span>
                                  </div>
                                )}
                                {tomorrowRoles.isNight && (
                                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-700">
                                    <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <span>
                                      فردا «شیفت شب» هستید
                                      {tomorrowRoles.nightCoWorkers.length > 0
                                        ? ` (دو نفره با ${tomorrowRoles.nightCoWorkers.join(' و ')})`
                                        : ''}
                                    </span>
                                  </div>
                                )}
                                {tomorrowRoles.isOnCall &&
                                  !tomorrowRoles.isDay &&
                                  !tomorrowRoles.isNight && (
                                    <div className="text-xs font-black text-emerald-700">
                                      فردا در برنامه حضور دارید
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                <Coffee className="w-4 h-4 text-teal-600 shrink-0" />
                                <span>فردا شیفت ندارید (استراحت / OFF)</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Monthly Metrics Summary */}
                        <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-700">
                          <span>
                            شیفت روز ماه جاری:{' '}
                            <strong className="font-mono tabular-nums text-amber-700">
                              {toPersianDigits(personalShiftSummary.dayCount)}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            شیفت شب ماه جاری:{' '}
                            <strong className="font-mono tabular-nums text-indigo-700">
                              {toPersianDigits(personalShiftSummary.nightCount)}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            شیفت‌های دونفره:{' '}
                            <strong className="font-mono tabular-nums text-purple-700">
                              {toPersianDigits(personalShiftSummary.twoPersonCount)}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            مجموع ساعت ماه:{' '}
                            <strong className="font-mono tabular-nums text-emerald-800">
                              {toPersianDigits(personalShiftSummary.totalHours)} ساعت
                            </strong>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          لطفاً از منوی کشویی بالا نام خود را انتخاب کنید تا وضعیت شیفت امروز و فردای شما و سیستم اعلان هوشمند جابجایی شیفت فعال شود.
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: SMART SHIFT NOTIFICATIONS & SWAP ALERTS */}
                {activeTab === 'notifications' && (
                  <div className="space-y-4">
                    {/* Notification Toggles */}
                    <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white">
                      {/* Toggle 1: Shift Swap / Removal Alert */}
                      <div className="p-3.5 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                            <ArrowRightLeft className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>اعلان فوری جابجایی، تعویض یا حذف از شیفت</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            اگر شیفتی که شما شامل آن هستید (روز، شب یا کمکی) جابجا یا حذف شود یا به شیفت جدیدی اضافه شوید، بلافاصله به شما نوتیفیکیشن می‌دهد.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateSettings({ notifyOnShiftChange: !settings.notifyOnShiftChange })
                          }
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                            settings.notifyOnShiftChange
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {settings.notifyOnShiftChange ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>

                      {/* Toggle 2: Tomorrow Shift Reminder (Day or Night) */}
                      <div className="p-3.5 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                            <BellRing className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>یادآوری هوشمند وضعیت شیفت فردا (شیفت روز یا شیفت شب)</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            به شما اعلام می‌کند که فردا شیفت روز هستید، شیفت شب هستید یا در استراحت (OFF) قرار دارید.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateSettings({ notifyTomorrowShift: !settings.notifyTomorrowShift })
                          }
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                            settings.notifyTomorrowShift
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {settings.notifyTomorrowShift ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>

                      {/* Toggle 3: Co-Worker / 2-Person Shift Change */}
                      <div className="p-3.5 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span>اعلان تغییر هم‌شیفتی در شیفت‌های دو نفره</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            اطلاع‌رسانی وقتی نفر دوم (کمکی) به شیفت شما اضافه یا از آن حذف می‌شود.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateSettings({ notifyCoWorkerChange: !settings.notifyCoWorkerChange })
                          }
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                            settings.notifyCoWorkerChange
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {settings.notifyCoWorkerChange ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>

                      {/* Toggle 4: Bioprocess Tasks on Shift Reminder */}
                      <div className="p-3.5 flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-teal-600 shrink-0" />
                            <span>نمایش پروسه‌های بیوراکتور در نوتیفیکیشن روز شیفت</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            همراه با یادآوری شیفت فردا، خلاصه عملیات بیوراکتورها (کشت سلول، تلقیح، CIP/SIP) همان روز را هم نمایش می‌دهد.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateSettings({
                              notifyBioprocessOnShift: !settings.notifyBioprocessOnShift,
                            })
                          }
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                            settings.notifyBioprocessOnShift
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {settings.notifyBioprocessOnShift ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>

                      {/* Toggle 5: Keep App Active in Background for Instant Shift Notifications */}
                      <div className="p-3.5 flex items-center justify-between gap-3 bg-emerald-50/40">
                        <div className="space-y-0.5">
                          <div className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>فعال ماندن برنامه در پس‌زمینه (Background Active Sync)</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            حفظ ارتباط زنده در پس‌زمینه تا حتی وقتی صفحه گوشی خاموش یا برنامه بسته است، تغییرات شیفت بلافاصله در نوتیفیکیشن اصلی گوشی ظاهر شود.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !settings.backgroundActiveEnabled;
                            updateSettings({ backgroundActiveEnabled: next });
                            showToast(
                              next
                                ? 'پایش زنده در پس‌زمینه فعال شد.'
                                : 'پایش در پس‌زمینه غیرفعال شد.'
                            );
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shrink-0 ${
                            settings.backgroundActiveEnabled
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {settings.backgroundActiveEnabled ? 'فعال' : 'غیرفعال'}
                        </button>
                      </div>

                      {/* Reminder Time Selection */}
                      <div className="p-3.5 flex items-center justify-between gap-3 bg-slate-50/70">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                          <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>ساعت پیش‌فرض یادآوری شیفت فردا:</span>
                        </div>
                        <input
                          type="time"
                          value={settings.reminderHour}
                          onChange={(e) => updateSettings({ reminderHour: e.target.value })}
                          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-800"
                        />
                      </div>
                    </div>

                    {/* Action Buttons: Test Tomorrow Notification & Test Swap Notification */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleSendTomorrowReminderNow}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-3 rounded-xl transition cursor-pointer shadow-2xs"
                      >
                        <BellRing className="w-4 h-4 shrink-0" />
                        <span>اعلان فوری وضعیت شیفت فردای من</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSimulateSwapAlert}
                        className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-3 rounded-xl transition cursor-pointer shadow-2xs"
                      >
                        <ArrowRightLeft className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>تست اعلان جابجایی/تغییر شیفت</span>
                      </button>
                    </div>

                    {/* Notification History Log for Selected Person */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">
                          صندوق اعلان‌های شیفت {settings.selectedPerson ? `(${settings.selectedPerson})` : ''}
                        </span>
                        {userNotifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearNotifications}
                            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>پاک کردن لیست</span>
                          </button>
                        )}
                      </div>
                      <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto bg-white">
                        {userNotifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">
                            هنوز اعلانی برای شما ثبت نشده است. به محض جابجایی یا تغییر هر یک از شیفت‌های شما، جزئیات آن اینجا نمایش داده می‌شود.
                          </div>
                        ) : (
                          userNotifications.map((item) => (
                            <div
                              key={item.id}
                              className={`p-3 text-xs space-y-1 ${
                                item.type === 'swap_removed'
                                  ? 'bg-rose-50/50'
                                  : item.type === 'swap_added'
                                  ? 'bg-emerald-50/50'
                                  : 'bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black text-slate-800">{item.title}</span>
                                <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                  {item.persianTime}
                                </span>
                              </div>
                              <p className="text-slate-600 leading-relaxed">{item.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: PRACTICAL ANDROID HARDWARE & UTILITY SETTINGS */}
                {activeTab === 'android' && (
                  <div className="space-y-3.5">
                    {/* 1. Export Shifts to Android Calendar (.ics) with Alarms */}
                    <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-emerald-950">
                            ۱. افزودن خودکار شیفت‌های من به تقویم و آلارم گوشی اندروید (.ics)
                          </h4>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                            تمام شیفت‌های روز و شبِ {settings.selectedPerson || 'شما'} را همراه با آلارم یادآوری ۱۲ ساعت و ۹۰ دقیقه قبل از شروع شیفت، وارد تقویم اندروید (Google / Samsung Calendar) می‌کند.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportAndroidCalendar}
                        className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition cursor-pointer shadow-2xs whitespace-nowrap"
                      >
                        دانلود تقویم شیفت من
                      </button>
                    </div>

                    {/* 2. Quick Share My Monthly Roster */}
                    <div className="border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-teal-100 text-teal-700 shrink-0">
                          <Share2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800">
                            ۲. اشتراک‌گذاری سریع لیست شیفت‌های ماه جاری من
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            ارسال خلاصه مرتب شیفت‌های روز و شبِ شما در ماه {currentMonthName} به واتساپ، تلگرام یا پیامک.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSharePersonalSchedule}
                        className="w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition cursor-pointer whitespace-nowrap"
                      >
                        ارسال / کپی شیفت‌های من
                      </button>
                    </div>

                    {/* 3. Screen Wake Lock */}
                    <div className="border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                          <Sun className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800">
                            ۳. قفل روشن ماندن صفحه در سالن تولید (Screen Wake Lock)
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            جلوگیری از خاموش و قفل شدن صفحه گوشی هنگام بررسی جدول شیفت یا چک‌لیست بیوراکتورها.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleWakeLock}
                        className={`w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                          wakeLockActive || settings.wakeLockEnabled
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {wakeLockActive || settings.wakeLockEnabled
                          ? 'فعال (صفحه روشن می‌ماند)'
                          : 'فعال‌سازی Wake Lock'}
                      </button>
                    </div>

                    {/* 4. Haptic Touch Engine */}
                    <div className="border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                          <Vibrate className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800">
                            ۴. بازخورد لرزشی لمسی اندروید (Haptic Touch)
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            لرزش ویبره گوشی هنگام دریافت اعلان تغییر شیفت و کار با دکمه‌های برنامه.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !settings.hapticEnabled;
                          updateSettings({ hapticEnabled: next });
                          if (next) triggerAndroidHaptic([35, 45, 35], true);
                          showToast(
                            next ? 'بازخورد لرزشی اندروید فعال شد.' : 'بازخورد لرزشی غیرفعال شد.'
                          );
                        }}
                        className={`w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                          settings.hapticEnabled
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {settings.hapticEnabled ? 'روشن' : 'خاموش'}
                      </button>
                    </div>

                    {/* 5. Audio Alert Chime */}
                    <div className="border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                          <Volume2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800">
                            ۵. هشدار صوتی هنگام تغییر یا جابجایی شیفت
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            پخش زنگ هشدار ملایم در صورت جابجایی شیفت شما یا فرا رسیدن یادآور شیفت فردا.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !settings.soundEnabled;
                          updateSettings({ soundEnabled: next });
                          if (next) playNotificationChime(true);
                          showToast(next ? 'هشدار صوتی فعال شد.' : 'هشدار صوتی غیرفعال شد.');
                        }}
                        className={`w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                          settings.soundEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {settings.soundEnabled ? 'روشن (تست صدا)' : 'خاموش'}
                      </button>
                    </div>

                    {/* 6. High Readability Factory Floor Mode */}
                    <div className="border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                          <Eye className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-800">
                            ۶. حالت درشت‌نمایی و خوانایی بالا در سالن تولید
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                            افزایش اندازه فونت‌ها و جدول‌ها برای مشاهده راحت‌تر روی موبایل در محیط کارخانه.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !settings.highContrastMode;
                          updateSettings({ highContrastMode: next });
                          showToast(
                            next
                              ? 'حالت درشت‌نمایی سالن تولید فعال شد.'
                              : 'اندازه نمایش به حالت استاندارد بازگشت.'
                          );
                        }}
                        className={`w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                          settings.highContrastMode
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {settings.highContrastMode ? 'فعال (درشت‌نمایی)' : 'استاندارد'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {settings.selectedPerson
                      ? `نام انتخاب‌شده: ${settings.selectedPerson} (${
                          notifPermission === 'granted' ? 'اعلان سیستم فعال' : 'اعلان درون‌برنامه‌ای فعال'
                        })`
                      : 'هنوز نامی انتخاب نشده است'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-extrabold transition cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
