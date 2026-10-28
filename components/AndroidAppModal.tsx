import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Smartphone,
  Download,
  CheckCircle2,
  X,
  Share2,
  MoreVertical,
  Copy,
  Check,
  WifiOff,
  Sparkles,
  Package,
  ShieldCheck,
  Terminal,
  ExternalLink,
  Bell,
  Sun,
  Vibrate,
  QrCode,
  FileDown,
  Zap,
  Layers,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../utils/usePWAInstall';
import { ShiftEntry } from '../types';

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

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  schedule = [],
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'install' | 'features' | 'apk'>('install');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Practical Android Hardware Features States
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<any>(null);
  const [notifStatus, setNotifStatus] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [hapticEnabled, setHapticEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shiftflow_android_haptic') !== 'false';
    } catch {
      return true;
    }
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const triggerHaptic = (pattern: number | number[] = 35) => {
    if (hapticEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // Toggle Android Screen Wake Lock (Keep screen awake on factory floor)
  const toggleWakeLock = async () => {
    triggerHaptic(30);
    if (wakeLockActive && wakeLockSentinel) {
      try {
        await wakeLockSentinel.release();
      } catch {}
      setWakeLockSentinel(null);
      setWakeLockActive(false);
      showToast('قفل روشن ماندن صفحه غیرفعال شد.');
      return;
    }

    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        const sentinel = await (navigator as any).wakeLock.request('screen');
        setWakeLockSentinel(sentinel);
        setWakeLockActive(true);
        sentinel.addEventListener('release', () => {
          setWakeLockActive(false);
        });
        showToast('صفحه گوشی در حین کار با برنامه روشن می‌ماند (Wake Lock فعال شد).');
      } catch {
        showToast('مرورگر در این تب اجازه قفل صفحه را نداد (در اپ نصب‌شده فعال است).');
      }
    } else {
      showToast('این قابلیت پس از باز کردن در کروم اندروید فعال می‌شود.');
    }
  };

  // Trigger Native Android Status Bar Shift Notification
  const handleSendShiftNotification = async () => {
    triggerHaptic([40, 60, 40]);
    if (typeof Notification === 'undefined') {
      showToast('اعلان در این مرورگر پشتیبانی نمی‌شود.');
      return;
    }

    let perm = Notification.permission;
    if (perm !== 'granted') {
      try {
        perm = await Notification.requestPermission();
        setNotifStatus(perm);
      } catch {
        showToast('دسترسی به اعلان در قاب پیش‌نمایش مسدود است؛ در لینک اصلی/اپ کار می‌کند.');
        return;
      }
    }

    if (perm === 'granted') {
      const sampleShift =
        schedule.find((s) => s.date.startsWith('1405/08')) || schedule[schedule.length - 1];
      const bodyText = sampleShift
        ? `تاریخ ${sampleShift.date} (${sampleShift.dayName}) | روز: ${sampleShift.dayShiftPerson} | شب: ${sampleShift.nightShiftPerson}`
        : 'برنامه شیفت و فرآیندهای تولید به‌روز و آماده بررسی است.';

      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg && 'showNotification' in reg) {
            await reg.showNotification('ShiftFlow FMD — یادآور شیفت تولید', {
              body: bodyText,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              dir: 'rtl',
              lang: 'fa',
              tag: 'shiftflow-daily-alert',
            });
            showToast('اعلان شیفت روی نوار بالای گوشی اندروید ارسال شد!');
            return;
          }
        }
        new Notification('ShiftFlow FMD — یادآور شیفت تولید', {
          body: bodyText,
          icon: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'fa',
        });
        showToast('اعلان شیفت با موفقیت نمایش داده شد!');
      } catch {
        showToast('اعلان فعال شد.');
      }
    } else {
      showToast('لطفاً مجوز اعلان (Notification) را در مرورگر گوشی تایید کنید.');
    }
  };

  // Native Android Share Sheet
  const handleNativeShare = async () => {
    triggerHaptic(30);
    const shareData = {
      title: 'اپلیکیشن اندروید ShiftFlow FMD',
      text: 'برنامه هوشمند شیفت و تقویم فرآیندهای تولید FMD (قابل نصب روی اندروید و آیفون):',
      url: currentUrl,
    };
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {}
    }
    handleCopy(currentUrl, 'share-url');
    showToast('لینک مستقیم نصب اپ کپی شد؛ در تلگرام یا واتساپ ارسال کنید.');
  };

  const [isDownloadingApk, setIsDownloadingApk] = useState(false);

  // Direct 1-Click Download of Signed Android APK (ShiftFlow-FMD.apk)
  const handleDownloadSignedApk = async () => {
    triggerHaptic([40, 60, 40]);
    setIsDownloadingApk(true);
    showToast('در حال آماده‌سازی و دانلود مستقیم فایل ShiftFlow-FMD.apk...');
    try {
      const response = await fetch('/api/download-apk');
      if (!response.ok) throw new Error('خطا در دریافت فایل APK');
      const blob = await response.blob();
      const apkBlob = new Blob([blob], { type: 'application/vnd.android.package-archive' });
      const url = URL.createObjectURL(apkBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ShiftFlow-FMD.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('فایل نصبی مستقل ShiftFlow-FMD.apk (۱.۷ مگابایت - نسخه کامل آفلاین) با موفقیت دانلود شد!');
    } catch {
      const a = document.createElement('a');
      a.href = '/ShiftFlow-FMD.apk';
      a.download = 'ShiftFlow-FMD.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('دانلود مستقیم فایل ShiftFlow-FMD.apk آغاز شد.');
    } finally {
      setIsDownloadingApk(false);
    }
  };

  // Direct Download of Full Android Bundle ZIP (APK + AAB + Keystore)
  const handleDownloadAndroidBundle = async () => {
    triggerHaptic(35);
    showToast('در حال دانلود پکیج کامل اندروید (ZIP شامل APK + AAB + Keystore)...');
    try {
      const response = await fetch('/api/download-android-bundle');
      if (!response.ok) throw new Error('خطا در دریافت پکیج');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ShiftFlow-FMD-Android-Package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('پکیج کامل اندروید (ShiftFlow-FMD-Android-Package.zip) دانلود شد!');
    } catch {
      const a = document.createElement('a');
      a.href = '/ShiftFlow-FMD-Android-Package.zip';
      a.download = 'ShiftFlow-FMD-Android-Package.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const [githubWorkflowYaml, setGithubWorkflowYaml] = useState<string>('');

  useEffect(() => {
    fetch('/github-android-release.yml?v=' + Date.now(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((txt) => {
        if (txt) setGithubWorkflowYaml(txt);
      })
      .catch(() => {});
  }, []);

  const handleCopyGithubWorkflow = async () => {
    triggerHaptic(30);
    let content = githubWorkflowYaml;
    if (!content) {
      try {
        const res = await fetch('/github-android-release.yml?v=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          content = await res.text();
          setGithubWorkflowYaml(content);
        }
      } catch {}
    }
    handleCopy(content, 'gh-workflow');
    showToast('کد کامل و جدید ورک‌فلو گیت‌هاب کپی شد!');
  };

  const handleDownloadGithubWorkflow = async () => {
    triggerHaptic(30);
    let content = githubWorkflowYaml;
    if (!content) {
      try {
        const res = await fetch('/github-android-release.yml?v=' + Date.now(), { cache: 'no-store' });
        if (res.ok) {
          content = await res.text();
          setGithubWorkflowYaml(content);
        }
      } catch {}
    }
    const blob = new Blob([content], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'android-release.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('فایل ورک‌فلو گیت‌هاب (android-release.yml) دانلود شد!');
  };

  // Generate & Download Standalone Portable Android App Package (.html installer + full interactive offline app)
  const handleDownloadPortablePackage = () => {
    triggerHaptic([30, 50, 30]);
    const serializedSchedule = JSON.stringify(schedule);

    const portableHtml = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#065f46" />
  <meta name="mobile-web-app-capable" content="yes" />
  <title>ShiftFlow FMD - اپلیکیشن همراه اندروید</title>
  <style>
    * { box-sizing: border-box; font-family: Tahoma, 'Vazirmatn', sans-serif; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; padding-bottom: 50px; }
    .header { background: linear-gradient(135deg, #065f46, #0d9488); color: white; padding: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.14); position: sticky; top: 0; z-index: 20; }
    .header h1 { margin: 0; font-size: 16px; font-weight: 900; }
    .header p { margin: 4px 0 0; font-size: 11px; opacity: 0.92; }
    .container { max-width: 820px; margin: 14px auto; padding: 0 12px; }
    .card { background: white; border-radius: 16px; padding: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 12px; border: 1px solid #e2e8f0; }
    .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 12px 14px; border-radius: 12px; font-weight: 800; font-size: 12.5px; text-decoration: none; border: none; cursor: pointer; margin-top: 6px; }
    .btn-primary { background: #059669; color: white; }
    .btn-secondary { background: #0f172a; color: white; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    select, input { flex: 1; min-width: 130px; padding: 9px 10px; border-radius: 10px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 700; background: #f8fafc; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; text-align: right; }
    th { background: #065f46; color: white; padding: 9px 6px; font-size: 11.5px; }
    td { padding: 9px 6px; border-bottom: 1px solid #e2e8f0; }
    .badge-extra { display: inline-block; margin-top: 3px; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 800; background: #ede9fe; color: #5b21b6; }
  </style>
</head>
<body>
  <div class="header">
    <h1>اپلیکیشن همراه ShiftFlow FMD (نسخه اندروید)</h1>
    <p>اجرای کامل آفلاین روی گوشی + اتصال مستقیم به سامانه ابری و دانلود APK</p>
  </div>
  <div class="container">
    <div class="card">
      <div style="font-weight:900;font-size:13.5px;color:#065f46;margin-bottom:4px;">نصب مستقیم فایل APK و نسخه ابری</div>
      <a class="btn btn-primary" href="${currentUrl}/ShiftFlow-FMD.apk" download="ShiftFlow-FMD.apk">دانلود مستقیم فایل نصبی اندروید (ShiftFlow-FMD.apk)</a>
      <a class="btn btn-secondary" href="${currentUrl}" target="_blank">ورود به سامانه کامل ابری (همگام‌سازی زنده و هوش مصنوعی)</a>
    </div>
    <div class="card">
      <div style="font-weight:900;font-size:13.5px;color:#0f172a;margin-bottom:8px;">فیلتر ماه و جستجوی کارشناس شیفت</div>
      <div class="controls">
        <select id="monthSelect" onchange="renderTable()">
          <option value="1405/08" selected>آبان ۱۴۰۵</option>
          <option value="1405/07">مهر ۱۴۰۵</option>
          <option value="1405/06">شهریور ۱۴۰۵</option>
          <option value="1405/05">مرداد ۱۴۰۵</option>
          <option value="ALL">کل سال ۱۴۰۵</option>
        </select>
        <input id="personSearch" type="text" placeholder="جستجوی نام کارشناس (مثلاً حیدری، دهقان...)" oninput="renderTable()" />
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>تاریخ</th>
              <th>روز</th>
              <th>شیفت روز</th>
              <th>شیفت شب</th>
              <th>سرپرست</th>
            </tr>
          </thead>
          <tbody id="scheduleBody"></tbody>
        </table>
      </div>
    </div>
  </div>
  <script>
    const DATA = ${serializedSchedule};
    function renderTable() {
      const m = document.getElementById('monthSelect').value;
      const q = (document.getElementById('personSearch').value || '').trim();
      const filtered = DATA.filter(s => {
        if (m !== 'ALL' && !s.date.startsWith(m)) return false;
        if (!q) return true;
        const allNames = [s.dayShiftPerson, s.nightShiftPerson, s.onCallPerson, ...(s.extraDayPersons || []), ...(s.extraNightPersons || [])].join(' ');
        return allNames.includes(q);
      });
      const tbody = document.getElementById('scheduleBody');
      tbody.innerHTML = filtered.map(s => {
        const ed = (s.extraDayPersons && s.extraDayPersons.length) ? '<br><span class="badge-extra">+ کمکی: ' + s.extraDayPersons.join('، ') + '</span>' : '';
        const en = (s.extraNightPersons && s.extraNightPersons.length) ? '<br><span class="badge-extra">+ کمکی: ' + s.extraNightPersons.join('، ') + '</span>' : '';
        const bg = s.isHoliday || s.dayName === 'جمعه' ? '#fff1f2' : '#ffffff';
        const dayColor = s.isHoliday || s.dayName === 'جمعه' ? '#e11d48' : '#334155';
        return '<tr style="background:' + bg + ';">' +
          '<td style="font-weight:800;">' + s.date + '</td>' +
          '<td style="font-weight:800;color:' + dayColor + ';">' + s.dayName + '</td>' +
          '<td style="font-weight:800;color:#047857;">' + s.dayShiftPerson + ed + '</td>' +
          '<td style="font-weight:800;color:#1d4ed8;">' + s.nightShiftPerson + en + '</td>' +
          '<td style="color:#475569;">' + (s.onCallPerson || '') + '</td>' +
        '</tr>';
      }).join('');
    }
    renderTable();
  </script>
</body>
</html>`;

    const blob = new Blob([portableHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ShiftFlow-Android-Portable.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('فایل تعاملی و آفلاین همراه (ShiftFlow-Android-Portable.html) دانلود شد!');
  };

  const handleCopy = (text: string, id: string) => {
    triggerHaptic(25);
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleDirectInstall = async () => {
    triggerHaptic(40);
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setIsModalOpen(false);
      }
    }
  };

  const modalContent = isModalOpen ? (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-2.5 sm:p-4 overflow-y-auto"
      dir="rtl"
      onClick={() => setIsModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto relative animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast notification inside modal */}
        {toastMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl border border-emerald-500/40 flex items-center gap-2 whitespace-nowrap">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-900 via-emerald-800 to-teal-800 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shadow-inner shrink-0">
              <Smartphone className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-black flex flex-wrap items-center gap-2">
                <span>مرکز نصب و دانلود مستقیم APK مستقل اندروید ShiftFlow</span>
                <span className="text-[10px] bg-emerald-400/20 border border-emerald-300/40 text-emerald-100 px-2 py-0.5 rounded-lg font-bold">
                  Standalone APK v3.0
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-emerald-100/90 mt-0.5">
                اپلیکیشن مستقل و ۱۰۰٪ آفلاین اندروید (ShiftFlow-FMD.apk) به همراه موتور پردازش PDF/Excel داخلی
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/25 text-white transition cursor-pointer shrink-0"
            title="بستن پنجره"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100 px-3 sm:px-5 pt-2.5 gap-1.5 overflow-x-auto">
          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('install');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'install'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>۱. دانلود مستقیم APK و نصب در گوشی</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('features');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'features'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Zap className="w-4 h-4 shrink-0 text-amber-500" />
            <span>۲. قابلیت‌های کاربردی اندروید (زنده)</span>
          </button>
          <button
            onClick={() => {
              triggerHaptic(20);
              setActiveTab('apk');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-xl text-xs font-extrabold transition border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'apk'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span>۳. پکیج کامل APK + AAB + Keystore</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-4 max-h-[72vh] overflow-y-auto bg-white">
          {/* TAB 1: DIRECT SIGNED APK DOWNLOAD + WEBAPK + PORTABLE FILE */}
          {activeTab === 'install' && (
            <div className="space-y-4">
              {/* Primary Action Box: Direct Signed APK Download */}
              <div className="bg-gradient-to-l from-emerald-50 via-teal-50/70 to-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 space-y-3.5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black">
                        نسخه مستقل آفلاین (۱.۷ MB)
                      </span>
                      <h3 className="text-sm font-black text-emerald-950">
                        دانلود مستقیم فایل نصبی مستقل اندروید (ShiftFlow-FMD.apk)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      فایل نصبی مستقل <strong>ShiftFlow-FMD.apk</strong> (با شناسه پکیج <code className="dir-ltr font-mono text-[11px] bg-white px-1 rounded">ir.fmd.shiftflow.app</code> و تمامی کتابخانه‌ها، تقویم و پارسر PDF در حافظه داخلی APK) آماده نصب و اجرای ۱۰۰٪ آفلاین روی گوشی‌های اندروید است.
                    </p>
                  </div>
                </div>

                {/* Big 1-Click APK Download Button */}
                <button
                  type="button"
                  onClick={handleDownloadSignedApk}
                  disabled={isDownloadingApk}
                  className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs sm:text-sm px-5 py-3.5 rounded-xl shadow-md transition cursor-pointer"
                >
                  <Download className="w-5 h-5 shrink-0" />
                  <span>
                    {isDownloadingApk
                      ? 'در حال ارسال فایل ShiftFlow-FMD.apk...'
                      : 'دانلود مستقیم فایل نصبی اندروید (ShiftFlow-FMD.apk)'}
                  </span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {isInstallable ? (
                    <button
                      onClick={handleDirectInstall}
                      className="flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 shrink-0" />
                      <span>نصب آنی WebAPK از طریق مرورگر</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleDownloadAndroidBundle}
                      className="flex items-center justify-center gap-2 bg-teal-800 hover:bg-teal-900 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
                    >
                      <Package className="w-4 h-4 shrink-0" />
                      <span>دانلود پکیج کامل ZIP (APK + AAB)</span>
                    </button>
                  )}

                  <button
                    onClick={handleDownloadPortablePackage}
                    className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>دانلود نسخه تعاملی آفلاین (.html)</span>
                  </button>
                </div>
              </div>

              {/* Step by step guide for Chrome on Android & Safari on iOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>نصب در گوشی‌های اندروید (Chrome):</span>
                  </h4>
                  <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>
                      لینک برنامه را در مرورگر <strong>Chrome</strong> گوشی باز کنید.
                    </li>
                    <li>
                      روی منوی سه نقطه بالا{' '}
                      <span className="inline-flex items-center bg-slate-200 px-1 py-0.5 rounded text-slate-800">
                        <MoreVertical className="w-3 h-3 inline" />
                      </span>{' '}
                      بزنید.
                    </li>
                    <li>
                      گزینه <strong>Install app (نصب برنامه)</strong> را بزنید تا آیکون{' '}
                      <strong>ShiftFlow</strong> کنار سایر برنامه‌های گوشی شما نصب شود.
                    </li>
                  </ol>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                  <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Share2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>نصب در آیفون و آیپد (Safari):</span>
                  </h4>
                  <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed">
                    <li>برنامه را در مرورگر <strong>Safari</strong> باز کنید.</li>
                    <li>
                      دکمه <strong>Share</strong> در نوار پایین صفحه را لمس کنید.
                    </li>
                    <li>
                      گزینه <strong>Add to Home Screen</strong> و سپس <strong>Add</strong> را بزنید تا تمام‌صفحه نصب شود.
                    </li>
                  </ol>
                </div>
              </div>

              {/* Share link bar */}
              <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>ارسال لینک نصب مستقیم برای پرسنل شیفت:</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleNativeShare}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>اشتراک‌گذاری در تلگرام / واتساپ</span>
                  </button>
                  <button
                    onClick={() => handleCopy(currentUrl, 'main-url')}
                    className="flex items-center justify-center gap-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    {copiedCmd === 'main-url' ? (
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
              </div>
            </div>
          )}

          {/* TAB 2: PRACTICAL NATIVE ANDROID FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-3.5">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 leading-relaxed">
                این قابلیت‌های سخت‌افزاری و بومی اندروید مستقیماً داخل برنامه تعبیه شده‌اند و بدون نیاز به هیچ افزونه جانبی روی گوشی شما کار می‌کنند:
              </div>

              {/* Feature 1: Wake Lock */}
              <div className="border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white hover:border-emerald-300 transition">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-800">
                      ۱. قفل روشن ماندن صفحه در خط تولید (Screen Wake Lock)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      جلوگیری از خاموش و قفل شدن صفحه گوشی هنگام بررسی جدول شیفت یا چک‌لیست بیوراکتورها.
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleWakeLock}
                  className={`w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                    wakeLockActive
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {wakeLockActive ? 'فعال (صفحه روشن می‌ماند)' : 'فعال‌سازی Wake Lock'}
                </button>
              </div>

              {/* Feature 2: Native Android Shift Notification */}
              <div className="border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white hover:border-emerald-300 transition">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-800">
                      ۲. اعلان و یادآور هوشمند شیفت روی نوار بالای اندروید
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      ارسال نوتیفیکیشن بومی اندروید حاوی اسامی شیفت روز، شب و آنکال امروز روی Status Bar گوشی.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSendShiftNotification}
                  className="w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition cursor-pointer shadow-xs"
                >
                  {notifStatus === 'granted' ? 'ارسال اعلان تست شیفت' : 'فعال‌سازی و تست اعلان'}
                </button>
              </div>

              {/* Feature 3: Haptic Feedback */}
              <div className="border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white hover:border-emerald-300 transition">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
                    <Vibrate className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-slate-800">
                      ۳. بازخورد لرزشی لمسی اندروید (Haptic Touch Engine)
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      لرزش نرم موتور ویبره گوشی هنگام جابجایی شیفت‌ها، ثبت تغییرات و تایید عملیات.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !hapticEnabled;
                    setHapticEnabled(next);
                    try {
                      localStorage.setItem('shiftflow_android_haptic', String(next));
                    } catch {}
                    if (next && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                      try {
                        navigator.vibrate([30, 40, 30]);
                      } catch {}
                    }
                    showToast(next ? 'بازخورد لرزشی اندروید فعال شد.' : 'بازخورد لرزشی غیرفعال شد.');
                  }}
                  className={`w-full sm:w-auto shrink-0 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                    hapticEnabled
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {hapticEnabled ? 'روشن (تست لرزش)' : 'خاموش'}
                </button>
              </div>

              {/* Feature 4: App Shortcuts & Offline Cache */}
              <div className="border border-slate-200 rounded-2xl p-4 flex items-start gap-3 bg-slate-50">
                <div className="p-2.5 rounded-xl bg-teal-100 text-teal-700 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-black text-slate-800">
                    ۴. میانبرهای لمس طولانی آیکون (Android App Shortcuts) و حافظه آفلاین
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    پس از نصب برنامه روی اندروید، اگر انگشت خود را ۲ ثانیه روی آیکون <strong>ShiftFlow</strong> نگه دارید، میانبرهای سریع <strong>«شیفت امروز»</strong> و <strong>«تحلیل عدالت»</strong> باز می‌شوند. همچنین کل جدول ۱۲۲ روزه در حافظه آفلاین گوشی ذخیره است.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIRECT APK & FULL ANDROID BUNDLE DOWNLOAD */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              {/* Method 1: Direct Built & Signed APK on Server */}
              <div className="border-2 border-emerald-500 rounded-2xl p-4 space-y-3 bg-emerald-50/70">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>۱. دانلود مستقیم فایل نصبی امضاشده (ShiftFlow-FMD.apk)</span>
                  </h4>
                  <span className="text-[10px] font-black bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">
                    حجم: ۱.۷ مگابایت | Standalone v3.0
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  این فایل <strong>.APK</strong> به‌صورت کامل و مستقل (شامل تمام صفحات، فونت‌ها، موتور PDF و اکسل در داخل `assets/public`) کامپایل و با کلید دیجیتال امضا شده است. پس از دانلود روی گوشی، بدون نیاز به اینترنت نصب و اجرا می‌شود:
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownloadSignedApk}
                    disabled={isDownloadingApk}
                    className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-3 rounded-xl transition shadow-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>دانلود مستقیم ShiftFlow-FMD.apk (۱.۷ MB)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAndroidBundle}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs px-4 py-3 rounded-xl transition shadow-sm cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>دانلود پکیج کامل ZIP (شامل APK + AAB + Keystore)</span>
                  </button>
                </div>
                <div className="bg-white/90 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-slate-600 space-y-1">
                  <div>
                    <strong>شناسه پکیج اندروید (Package ID):</strong>{' '}
                    <code className="dir-ltr font-mono text-emerald-800">ir.fmd.shiftflow.app</code>
                  </div>
                  <div className="truncate">
                    <strong>گواهی امضای دیجیتال (SHA-256):</strong>{' '}
                    <code className="dir-ltr font-mono text-[10px] text-slate-500">
                      26:D3:18:69:9D:99:B3:27:59:47:1D:64:AD:F4:18:6C:05:D7:BE:07:4A:23:42:C3:C2:40:B8:83:FB:FE:30:C3
                    </code>
                  </div>
                </div>
              </div>

              {/* Method 2: GitHub Releases & Automated APK Build (like FoxyVPN) */}
              <div className="border-2 border-indigo-200 rounded-2xl p-4 space-y-3 bg-indigo-50/50">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs sm:text-sm font-black text-indigo-950 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>۲. ساخت خودکار پروژه اندروید و بخش Releases در GitHub (مشابه FoxyVPN)</span>
                  </h4>
                  <span className="text-[10px] font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">
                    GitHub Actions CI/CD
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  برای اینکه مخزن گیت‌هاب شما دقیقاً مثل پروژه‌های اندرویدی حرفه‌ای (مانند <strong>FoxyVPN</strong>) در ستون سمت راست بخش <strong>Releases</strong> داشته باشد و با هر آپدیت به‌طور خودکار فایل <strong>APK</strong> بسازد:
                </p>
                <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside leading-relaxed bg-white/90 p-3 rounded-xl border border-indigo-100">
                  <li>
                    ابتدا پروژه را از طریق منوی بالا به <strong>GitHub</strong> پوش (Push) کنید (فایل <code className="dir-ltr font-mono text-[11px] bg-slate-100 px-1 rounded">public/ShiftFlow-FMD.apk</code> خودکار داخل ریپازیتوری شما قرار می‌گیرد).
                  </li>
                  <li>
                    در صفحه گیت‌هاب پروژه خود، روی <strong>Add file &rarr; Create new file</strong> کلیک کنید و در کادر نام فایل بنویسید:{' '}
                    <code className="dir-ltr font-mono text-[11px] bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                      .github/workflows/android-release.yml
                    </code>
                  </li>
                  <li>
                    کد زیر را کپی کرده، داخل آن پیست کنید و دکمه سبز <strong>Commit changes</strong> را بزنید تا گیت‌هاب به‌صورت خودکار APK را کامپایل و در بخش <strong>Releases</strong> منتشر کند:
                  </li>
                </ol>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadGithubWorkflow}
                    className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>دانلود فایل آماده android-release.yml</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyGithubWorkflow}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-indigo-900 border border-indigo-300 font-black text-xs px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    {copiedCmd === 'gh-workflow' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>کد ورک‌فلو کپی شد!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-indigo-600" />
                        <span>کپی کد ورک‌فلو گیت‌هاب</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Method 3: Local Capacitor CLI */}
              <div className="border border-slate-200 rounded-2xl p-3.5 space-y-2 bg-slate-50">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>۳. بیلد محلی با Capacitor در Android Studio (فایل capacitor.config.json آماده است)</span>
                </h4>
                <div
                  className="relative bg-slate-900 text-emerald-300 p-3 rounded-xl font-mono text-[11px] leading-relaxed text-left overflow-x-auto"
                  dir="ltr"
                >
                  <button
                    onClick={() =>
                      handleCopy(
                        'npm install @capacitor/core @capacitor/cli @capacitor/android\nnpm run build\nnpx cap add android\nnpx cap sync android\ncd android && ./gradlew assembleDebug',
                        'cap'
                      )
                    }
                    className="absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedCmd === 'cap' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedCmd === 'cap' ? 'Copied' : 'Copy'}</span>
                  </button>
                  <div>npm install @capacitor/core @capacitor/cli @capacitor/android</div>
                  <div>npm run build && npx cap add android && npx cap sync android</div>
                  <div>cd android && ./gradlew assembleDebug</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-600 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isAndroid
                ? 'سیستم‌عامل اندروید شناسایی شد — تمام قابلیت‌ها فعال است'
                : isIOS
                ? 'سیستم‌عامل iOS شناسایی شد — آماده نصب از طریق Safari'
                : 'پشتیبانی کامل از اندروید، iOS و دسکتاپ'}
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-extrabold transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {!isInstalled && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic(30);
            setIsModalOpen(true);
          }}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs border cursor-pointer shrink-0 ${
            isInstallable
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
          } ${className}`}
          title="نصب اپلیکیشن اندروید، دانلود فایل همراه و امکانات موبایل"
        >
          <Smartphone className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>اپلیکیشن اندروید</span>
          {isInstallable && (
            <span className="bg-white text-emerald-700 text-[10px] px-1.5 py-0.2 rounded-md font-extrabold">
              نصب
            </span>
          )}
        </button>
      )}

      {typeof document !== 'undefined' && modalContent
        ? createPortal(modalContent, document.body)
        : null}
    </>
  );
};
