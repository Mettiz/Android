/**
 * Data Management Component - v3.0
 * Fully organized Official Import/Export (Excel & PDF), Name Normalization & Canonical Unification,
 * Staged Live Preview Mode, and Database Maintenance.
 */
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  Trash2, 
  FileSpreadsheet, 
  FileType, 
  Loader2, 
  Printer, 
  Sparkles,
  Calendar,
  FileCheck,
  Eye,
  Save,
  Clock,
  Users,
  ShieldCheck,
  Layers,
  ArrowRightLeft,
  Info,
  Check,
  X,
  FlaskConical
} from 'lucide-react';
import { AppData, Personnel, ShiftEntry } from '../types';
import { 
  exportScheduleToExcelFormat, 
  parseExcelSchedule, 
  unifyPersonnelAndShifts,
  getCanonicalPersonKey,
  PERSIAN_MONTHS_LIST,
  PERSIAN_DAYS_LIST,
  PERSIAN_YEARS_LIST
} from '../utils/customFormatHandler';
import { parsePdfSchedule } from '../utils/pdfParser';
import { OfficialSchedulePdfModal } from './OfficialSchedulePdfModal';
import { toPersianDigits } from '../utils/persianDate';
import { downloadProcessExcelTemplate } from '../utils/processExcelHandler';

// Reusable Date Select Box matching Dashboard design
const DateFieldSelect = ({
  value,
  onChange,
  options,
  width = "w-[64px]"
}: {
  value: string;
  onChange: (val: string) => void;
  options: any[];
  width?: string;
}) => (
  <div className={`relative h-9 ${width}`}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-full appearance-none bg-white border border-slate-300 hover:border-emerald-500 rounded-lg px-1.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition cursor-pointer text-center dir-ltr shadow-2xs"
      style={{ textAlign: 'center', textAlignLast: 'center' }}
    >
      {options.map((o) => {
        const val = typeof o === 'object' ? o.value : o;
        const label = typeof o === 'object' ? o.label : o;
        return (
          <option key={val} value={val}>
            {toPersianDigits(label)}
          </option>
        );
      })}
    </select>
  </div>
);

interface StagedDataInfo {
  data: AppData;
  sourceName: string;
  shiftCount: number;
  startDate: string;
  endDate: string;
  multiPersonShiftCount: number;
  discoveredPersonnel: Personnel[];
}

interface DataManagementProps {
  currentData: AppData;
  onImport: (data: AppData) => void;
  onStagePreview?: (data: AppData, info: { source: string; rangeText?: string }) => void;
  onReset?: () => void;
  onOpenProcessesTab?: () => void;
  availableProcessTemplates?: string[];
  onUpdateProcessTemplates?: (templates: string[]) => void;
  availableVessels?: string[];
  onUpdateVessels?: (vessels: string[]) => void;
  availableStrains?: string[];
  onUpdateStrains?: (strains: string[]) => void;
}

export const DataManagement: React.FC<DataManagementProps> = ({ 
  currentData, 
  onImport, 
  onStagePreview, 
  onReset,
  onOpenProcessesTab,
  availableProcessTemplates,
  onUpdateProcessTemplates,
  availableVessels,
  onUpdateVessels,
  availableStrains,
  onUpdateStrains
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // States for adding custom dropdown items
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newVesselName, setNewVesselName] = useState('');
  const [newStrainName, setNewStrainName] = useState('');

  const handleAddTemplate = () => {
    const trimmed = newTemplateName.trim();
    if (!trimmed || !availableProcessTemplates || !onUpdateProcessTemplates) return;
    if (availableProcessTemplates.includes(trimmed)) {
      alert('این پروسه قبلاً تعریف شده است.');
      return;
    }
    onUpdateProcessTemplates([...availableProcessTemplates, trimmed]);
    setNewTemplateName('');
  };

  const handleRemoveTemplate = (template: string) => {
    if (!availableProcessTemplates || !onUpdateProcessTemplates) return;
    onUpdateProcessTemplates(availableProcessTemplates.filter(t => t !== template));
  };

  const handleAddVessel = () => {
    const trimmed = newVesselName.trim();
    if (!trimmed || !availableVessels || !onUpdateVessels) return;
    if (availableVessels.includes(trimmed)) {
      alert('این وسل قبلاً تعریف شده است.');
      return;
    }
    onUpdateVessels([...availableVessels, trimmed]);
    setNewVesselName('');
  };

  const handleRemoveVessel = (vessel: string) => {
    if (!availableVessels || !onUpdateVessels) return;
    onUpdateVessels(availableVessels.filter(v => v !== vessel));
  };

  const handleAddStrain = () => {
    const trimmed = newStrainName.trim();
    if (!trimmed || !availableStrains || !onUpdateStrains) return;
    if (availableStrains.includes(trimmed)) {
      alert('این سویه قبلاً تعریف شده است.');
      return;
    }
    onUpdateStrains([...availableStrains, trimmed]);
    setNewStrainName('');
  };

  const handleRemoveStrain = (strain: string) => {
    if (!availableStrains || !onUpdateStrains) return;
    onUpdateStrains(availableStrains.filter(s => s !== strain));
  };

  // Staged data waiting for user to click "بارگذاری" or "ذخیره"
  const [stagedInfo, setStagedInfo] = useState<StagedDataInfo | null>(null);

  // All distinct sorted dates in current schedule
  const allDates = useMemo(() => {
    return Array.from(new Set(currentData.schedule.map(s => s.date))).sort();
  }, [currentData.schedule]);
  const minDate = allDates.length > 0 ? allDates[0] : '';
  const maxDate = allDates.length > 0 ? allDates[allDates.length - 1] : '';

  // Available months in current schedule
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    currentData.schedule.forEach(s => {
      const parts = s.date.split('/');
      if (parts.length >= 2) {
        months.add(`${parts[0]}/${parts[1]}`);
      }
    });
    return Array.from(months).sort();
  }, [currentData.schedule]);

  const monthNamesMap: Record<string, string> = {
    '01': 'فروردین',
    '02': 'اردیبهشت',
    '03': 'خرداد',
    '04': 'تیر',
    '05': 'مرداد',
    '06': 'شهریور',
    '07': 'مهر',
    '08': 'آبان',
    '09': 'آذر',
    '10': 'دی',
    '11': 'بهمن',
    '12': 'اسفند',
  };

  const getMonthLabel = (mKey: string) => {
    const parts = mKey.split('/');
    if (parts.length === 2) {
      return `${monthNamesMap[parts[1]] || parts[1]} ${parts[0]}`;
    }
    return mKey;
  };

  // Export Filter Controls with Granular Day/Month/Year
  const [exportFilterMode, setExportFilterMode] = useState<'custom' | 'month' | 'all'>('custom');
  const [exportMonth, setExportMonth] = useState<string>(() => {
    return availableMonths.length > 0 ? availableMonths[0] : '';
  });

  const [fromParts, setFromParts] = useState<{ year: string; month: string; day: string }>(() => {
    const p = (minDate || '1405/05/26').split('/');
    return {
      year: p[0] || '1405',
      month: p[1] || '05',
      day: p[2] || '26'
    };
  });

  const [toParts, setToParts] = useState<{ year: string; month: string; day: string }>(() => {
    const p = (maxDate || '1405/06/25').split('/');
    return {
      year: p[0] || '1405',
      month: p[1] || '06',
      day: p[2] || '25'
    };
  });

  const exportStartDate = useMemo(() => {
    return `${fromParts.year}/${fromParts.month.padStart(2, '0')}/${fromParts.day.padStart(2, '0')}`;
  }, [fromParts]);

  const exportEndDate = useMemo(() => {
    return `${toParts.year}/${toParts.month.padStart(2, '0')}/${toParts.day.padStart(2, '0')}`;
  }, [toParts]);

  // Sync dates when schedule changes
  useEffect(() => {
    if (minDate) {
      const p = minDate.split('/');
      if (p.length === 3) {
        setFromParts({ year: p[0], month: p[1], day: p[2] });
      }
    }
    if (maxDate) {
      const p = maxDate.split('/');
      if (p.length === 3) {
        setToParts({ year: p[0], month: p[1], day: p[2] });
      }
    }
  }, [minDate, maxDate]);

  // Filtered schedule for export
  const exportTargetSchedule = useMemo(() => {
    if (exportFilterMode === 'all') {
      return currentData.schedule;
    }
    if (exportFilterMode === 'month') {
      return exportMonth 
        ? currentData.schedule.filter(s => s.date.startsWith(exportMonth))
        : currentData.schedule;
    }
    if (exportFilterMode === 'custom') {
      return currentData.schedule.filter(s => {
        if (exportStartDate && s.date < exportStartDate) return false;
        if (exportEndDate && s.date > exportEndDate) return false;
        return true;
      });
    }
    return currentData.schedule;
  }, [currentData.schedule, exportFilterMode, exportMonth, exportStartDate, exportEndDate]);

  // Title label for export
  const exportTitleLabel = useMemo(() => {
    if (exportFilterMode === 'all') {
      return 'کل دوره';
    }
    if (exportFilterMode === 'month') {
      return exportMonth ? (monthNamesMap[exportMonth.split('/')[1]] || 'شیفت') : 'کل دوره';
    }
    if (exportFilterMode === 'custom') {
      const s = exportStartDate || minDate;
      const e = exportEndDate || maxDate;
      return s && e ? `از ${s} الی ${e}` : 'بازه انتخابی';
    }
    return 'برنامه شیفت';
  }, [exportFilterMode, exportMonth, exportStartDate, exportEndDate, minDate, maxDate]);

  // --- Export Excel (Official Format) ---
  const handleExportExcelFormat = () => {
    try {
      if (exportTargetSchedule.length === 0) {
        alert('هیچ شیفتی در این بازه برای خروجی اکسل یافت نشد.');
        return;
      }

      const filename = exportScheduleToExcelFormat(exportTargetSchedule, exportTitleLabel);
      setStatusMessage({
        type: 'success',
        text: `فایل اکسل رسمی بازه انتخابی با موفقیت دانلود شد: ${filename}`
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'خطا در صدور فایل اکسل'
      });
    }
  };

  // Helper to prepare staged data package with canonical name unification
  const stageData = (
    shifts: ShiftEntry[], 
    personnel: Personnel[], 
    sourceName: string
  ) => {
    // 1. Unify all personnel and shift names using canonical keys
    const { unifiedShifts, unifiedPersonnel } = unifyPersonnelAndShifts(
      shifts,
      personnel,
      currentData.personnel
    );

    // Filter out any 1404 entries
    const non1404Unified = unifiedShifts.filter(s => !s.date.startsWith('1404'));
    const non1404Current = currentData.schedule.filter(s => !s.date.startsWith('1404'));

    // 2. Merge with current schedule (preserving existing non-overlapping 1405 dates)
    const scheduleMap = new Map<string, ShiftEntry>();
    non1404Current.forEach(s => scheduleMap.set(s.date, s));
    non1404Unified.forEach(s => scheduleMap.set(s.date, s));

    const mergedSchedule = Array.from(scheduleMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const sortedShifts = [...non1404Unified].sort((a, b) => a.date.localeCompare(b.date));

    const startDate = sortedShifts.length > 0 ? sortedShifts[0].date : '';
    const endDate = sortedShifts.length > 0 ? sortedShifts[sortedShifts.length - 1].date : '';

    const startParts = startDate ? startDate.split('/') : [];
    const endParts = endDate ? endDate.split('/') : [];
    const targetPublishedRange = (startParts.length === 3 && endParts.length === 3)
      ? {
          isActive: true,
          from: { year: startParts[0], month: startParts[1], day: startParts[2] },
          to: { year: endParts[0], month: endParts[1], day: endParts[2] }
        }
      : currentData.publishedRange;

    const multiPersonShiftCount = sortedShifts.filter(s => 
      (s.extraDayPersons && s.extraDayPersons.length > 0) || 
      (s.extraNightPersons && s.extraNightPersons.length > 0)
    ).length;

    // Personnel in settings preserve existing configurations and include newly discovered helpers
    const stagedPackage: StagedDataInfo = {
      data: {
        ...currentData,
        schedule: mergedSchedule,
        personnel: unifiedPersonnel,
        publishedRange: targetPublishedRange
      },
      sourceName,
      shiftCount: sortedShifts.length,
      startDate,
      endDate,
      multiPersonShiftCount,
      discoveredPersonnel: unifiedPersonnel
    };

    setStagedInfo(stagedPackage);
    setStatusMessage({
      type: 'info',
      text: `اطلاعات ورودی با موفقیت آماده شد (${sortedShifts.length} شیفت از ${startDate} تا ${endDate}). جهت اعمال در داشبورد، دکمه «بارگذاری در داشبورد» را بزنید.`
    });
  };

  // --- Load into Dashboard (Staging Preview) ---
  const handleApplyStagedToDashboard = () => {
    if (!stagedInfo) return;
    const rangeText = `${stagedInfo.startDate} تا ${stagedInfo.endDate}`;
    if (onStagePreview) {
      onStagePreview(stagedInfo.data, {
        source: stagedInfo.sourceName,
        rangeText
      });
    } else {
      onImport(stagedInfo.data);
    }

    setStatusMessage({
      type: 'success',
      text: `ورودی «${stagedInfo.sourceName}» در داشبورد بارگذاری شد. تا زمان ذخیره نهایی، این تغییرات فقط در پیش‌نمایش شما فعال است.`
    });
    setStagedInfo(null);
  };

  // --- Direct Save & Commit Staged Data ---
  const handleDirectSaveStaged = () => {
    if (!stagedInfo) return;
    onImport(stagedInfo.data);
    setStatusMessage({
      type: 'success',
      text: `اطلاعات «${stagedInfo.sourceName}» با موفقیت ذخیره و در دیتابیس ابری ثبت گردید.`
    });
    setStagedInfo(null);
  };

  // --- Export JSON ---
  const handleExportJson = () => {
    const dataStr = JSON.stringify(currentData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `shiftflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Import JSON ---
  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.schedule && json.personnel) {
          stageData(json.schedule, json.personnel, file.name);
        } else {
          alert('فرمت فایل نامعتبر است.');
        }
      } catch (err) {
        alert('خطا در خواندن فایل.');
        console.error(err);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // --- Import Excel (Official Format Parser) ---
  const handleExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const { shifts: parsedShifts, discoveredPersonnel } = await parseExcelSchedule(file, currentData.personnel);

      if (parsedShifts.length === 0) {
        throw new Error('هیچ شیفت معتبری در فایل اکسل شناسایی نشد.');
      }

      stageData(parsedShifts, discoveredPersonnel, file.name);

    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'خطا در پردازش فایل اکسل. لطفاً اطمینان حاصل کنید فایل مطابق فرمت رسمی باشد.'
      });
    } finally {
      setIsProcessing(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  // --- Import PDF ---
  const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const { shifts, discoveredPersonnel } = await parsePdfSchedule(file, currentData.personnel);

      if (shifts.length === 0) {
        throw new Error('هیچ تاریخی در فایل PDF یافت نشد.');
      }

      stageData(shifts, discoveredPersonnel, file.name);

    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'خطا در پردازش فایل PDF. لطفاً از فایل اکسل (.xlsx) با فرمت رسمی استفاده کنید.'
      });
    } finally {
      setIsProcessing(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  // Schedule Summary stats
  const activePersonnelCount = currentData.personnel.filter(p => p.isActive).length;
  const currentTotalShifts = currentData.schedule.length;

  return (
    <div className="space-y-6" id="data-management-root">
      
      {/* 1. Header Overview Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-850 flex items-center gap-2">
                <span>مرکز ورودی و خروجی رسمی</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Excel & PDF
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تبادل اطلاعات با اکسل و PDF رسمی، یکسان‌سازی خودکار اسامی و بارگذاری مرحله‌ای
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Calendar size={15} className="text-emerald-600" />
              <span>{currentTotalShifts} روز ثبت‌شده</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Users size={15} className="text-blue-600" />
              <span>{activePersonnelCount} پرسنل فعال</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Staged Data Action Banner (Shown when a file or preset is loaded and waiting) */}
      {stagedInfo && (
        <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-400 rounded-2xl p-5 sm:p-6 shadow-md animate-fadeIn" id="staged-preview-banner">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <h3 className="font-black text-slate-850 text-base">
                  ورودی در صف بارگذاری: {stagedInfo.sourceName}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-700 font-bold pt-1">
                <span className="bg-white/95 px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs flex items-center gap-1.5">
                  <Calendar size={14} className="text-amber-700" />
                  <span>بازه: <b className="text-amber-900 dir-ltr">{stagedInfo.startDate} تا {stagedInfo.endDate}</b></span>
                </span>
                <span className="bg-white/95 px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs flex items-center gap-1.5">
                  <Clock size={14} className="text-amber-700" />
                  <span>تعداد: <b className="text-amber-900">{stagedInfo.shiftCount} روز</b></span>
                </span>
                {stagedInfo.multiPersonShiftCount > 0 && (
                  <span className="bg-white/95 px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs flex items-center gap-1.5">
                    <Users size={14} className="text-amber-700" />
                    <span>شیفت دونفره: <b className="text-amber-900">{stagedInfo.multiPersonShiftCount} مورد</b></span>
                  </span>
                )}
                <span className="bg-white/95 px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-700" />
                  <span>پرسنل یکپارچه‌شده: <b className="text-amber-900">{stagedInfo.discoveredPersonnel.length} نفر</b></span>
                </span>
              </div>

              <p className="text-[11px] text-amber-900 font-medium pt-1 flex items-center gap-1.5">
                <Info size={14} className="text-amber-700 shrink-0" />
                <span>با کلیک روی <b>«بارگذاری در داشبورد»</b>، تقویم و داشبورد روی تاریخ‌های این ورودی قرار می‌گیرد و تا وقتی دکمه ذخیره را نزنید، دیگران تغییرات را نمی‌بینند.</span>
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2.5 shrink-0 w-full md:w-auto">
              <button
                type="button"
                id="btn-apply-staged-dashboard"
                onClick={handleApplyStagedToDashboard}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                <Eye size={16} />
                <span>بارگذاری در داشبورد (پیش‌نمایش)</span>
              </button>

              <button
                type="button"
                id="btn-save-staged-direct"
                onClick={handleDirectSaveStaged}
                className="flex items-center justify-center gap-1.5 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
                title="ذخیره مستقیم در دیتابیس برای همه کاربران"
              >
                <Save size={15} />
                <span>ذخیره نهایی</span>
              </button>

              <button
                type="button"
                onClick={() => setStagedInfo(null)}
                className="p-3 text-slate-500 hover:text-red-700 hover:bg-amber-200/50 rounded-xl transition cursor-pointer"
                title="انصراف از ورودی"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Processing Spinner */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-center gap-3 text-xs font-bold animate-pulse">
          <Loader2 size={20} className="animate-spin text-blue-600 shrink-0" />
          <span>در حال پردازش هوشمند فایل، یکسان‌سازی اسامی و استخراج شیفت‌ها... لطفاً چند لحظه تأمل فرمایید.</span>
        </div>
      )}

      {/* 4. Status Message */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between gap-3 ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : statusMessage.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' && <CheckCircle size={18} className="text-emerald-600 shrink-0" />}
            {statusMessage.type === 'error' && <AlertTriangle size={18} className="text-red-600 shrink-0" />}
            {statusMessage.type === 'info' && <FileCheck size={18} className="text-blue-600 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 5. Two-Column Master Grid: Export Suite (Right/First) & Import Suite (Left/Second) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* SECTION A: OFFICIAL EXPORT & PRINT */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Download size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">خروجی و چاپ رسمی (اکسل و PDF)</h3>
                  <p className="text-[11px] text-slate-500">دانلود اکسل ۴ ستونه استاندارد یا چاپ سند PDF با بازه زمانی انتخابی</p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-lg border border-emerald-100">
                بازه سفارشی
              </span>
            </div>

            {/* Date Range Selection Controls */}
            <div className="bg-slate-50/90 rounded-xl p-3 border border-slate-200 mb-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-emerald-600" />
                  <span>تعیین بازه زمانی خروجی:</span>
                </span>

                {/* Filter Mode Selector */}
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setExportFilterMode('custom')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      exportFilterMode === 'custom'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    بازه دلخواه
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFilterMode('month')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      exportFilterMode === 'month'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    بر اساس ماه
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFilterMode('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                      exportFilterMode === 'all'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    کل دوره
                  </button>
                </div>
              </div>

              {/* Custom Date Range Inputs with Separated Day / Month / Year */}
              {exportFilterMode === 'custom' && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {/* From Date Group */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-2xs">
                    <span className="font-bold text-slate-500 text-xs whitespace-nowrap">از تاریخ:</span>
                    <div className="flex items-center gap-1">
                      <DateFieldSelect
                        value={fromParts.day}
                        onChange={(v) => setFromParts(prev => ({ ...prev, day: v }))}
                        options={PERSIAN_DAYS_LIST}
                        width="w-[52px]"
                      />
                      <span className="text-slate-400 font-bold text-xs">/</span>
                      <DateFieldSelect
                        value={fromParts.month}
                        onChange={(v) => setFromParts(prev => ({ ...prev, month: v }))}
                        options={PERSIAN_MONTHS_LIST}
                        width="w-[84px]"
                      />
                      <span className="text-slate-400 font-bold text-xs">/</span>
                      <DateFieldSelect
                        value={fromParts.year}
                        onChange={(v) => setFromParts(prev => ({ ...prev, year: v }))}
                        options={PERSIAN_YEARS_LIST}
                        width="w-[66px]"
                      />
                    </div>
                  </div>

                  {/* To Date Group */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-2xs">
                    <span className="font-bold text-slate-500 text-xs whitespace-nowrap">تا تاریخ:</span>
                    <div className="flex items-center gap-1">
                      <DateFieldSelect
                        value={toParts.day}
                        onChange={(v) => setToParts(prev => ({ ...prev, day: v }))}
                        options={PERSIAN_DAYS_LIST}
                        width="w-[52px]"
                      />
                      <span className="text-slate-400 font-bold text-xs">/</span>
                      <DateFieldSelect
                        value={toParts.month}
                        onChange={(v) => setToParts(prev => ({ ...prev, month: v }))}
                        options={PERSIAN_MONTHS_LIST}
                        width="w-[84px]"
                      />
                      <span className="text-slate-400 font-bold text-xs">/</span>
                      <DateFieldSelect
                        value={toParts.year}
                        onChange={(v) => setToParts(prev => ({ ...prev, year: v }))}
                        options={PERSIAN_YEARS_LIST}
                        width="w-[66px]"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (minDate && maxDate) {
                        const pStart = minDate.split('/');
                        const pEnd = maxDate.split('/');
                        if (pStart.length === 3) setFromParts({ year: pStart[0], month: pStart[1], day: pStart[2] });
                        if (pEnd.length === 3) setToParts({ year: pEnd[0], month: pEnd[1], day: pEnd[2] });
                      }
                    }}
                    className="px-3 py-2 text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 hover:text-emerald-700 border border-slate-300 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    کل برنامه
                  </button>
                </div>
              )}

              {/* Month Selector Input */}
              {exportFilterMode === 'month' && (
                <div className="pt-1">
                  <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs">
                    <Calendar size={14} className="text-slate-500 shrink-0" />
                    <span className="font-bold text-slate-500 whitespace-nowrap">انتخاب ماه:</span>
                    <select
                      value={exportMonth}
                      onChange={(e) => setExportMonth(e.target.value)}
                      className="w-full font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
                    >
                      <option value="">همه ماه‌ها ({toPersianDigits(currentData.schedule.length)} روز)</option>
                      {availableMonths.map(m => (
                        <option key={m} value={m}>
                          {getMonthLabel(m)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Selection Summary Pill */}
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/80">
                <span>تعداد شیفت‌های انتخابی:</span>
                <span className="text-emerald-700 font-black">
                  {toPersianDigits(exportTargetSchedule.length)} روز ({toPersianDigits(exportTitleLabel)})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Card 1: Official Excel Export */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 flex flex-col justify-between hover:border-emerald-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-emerald-700 font-black text-xs flex items-center gap-1.5">
                      <FileSpreadsheet size={16} />
                      <span>اکسل رسمی (.xlsx)</span>
                    </span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-600">
                      فرمت استاندارد
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                    دانلود فایل اکسل شامل بازه انتخابی با سربرگ عنوان، تاریخ، روز، شیفت روز و شیفت شب
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-export-excel-official"
                  onClick={handleExportExcelFormat}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-lg text-xs font-black shadow-xs transition cursor-pointer"
                >
                  <Download size={14} />
                  <span>دانلود اکسل بازه ({toPersianDigits(exportTargetSchedule.length)} روز)</span>
                </button>
              </div>

              {/* Card 2: Official PDF Print */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 flex flex-col justify-between hover:border-amber-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-amber-700 font-black text-xs flex items-center gap-1.5">
                      <Printer size={16} />
                      <span>چاپ و صدور PDF</span>
                    </span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-600">
                      رنگی استاندارد
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                    مشاهده سند رنگی بازه انتخابی مطابق جدول رسمی ارسالی با قابلیت چاپ یا ذخیره PDF
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-open-pdf-modal"
                  onClick={() => setIsPdfModalOpen(true)}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-lg text-xs font-black shadow-xs transition cursor-pointer"
                >
                  <Printer size={14} />
                  <span>مشاهده و چاپ PDF بازه</span>
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* SECTION B: OFFICIAL SMART IMPORT */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">ورود و بارگذاری فایل</h3>
                  <p className="text-[11px] text-slate-500">خواندن خودکار هر بازه تاریخی، شیفت‌های دونفره و یکسان‌سازی اسامی</p>
                </div>
              </div>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-lg border border-blue-100">
                هوشمند
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Card 1: Import Excel */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 flex flex-col justify-between hover:border-blue-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-blue-700 font-black text-xs flex items-center gap-1.5">
                      <FileSpreadsheet size={16} />
                      <span>ورود از اکسل (.xlsx)</span>
                    </span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-600">
                      پشتیبانی هر بازه
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                    استخراج تاریخ‌ها، شیفت‌های روز/شب، اسامی چندگانه و یکسان‌سازی خودکار فاصله‌ها
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-import-excel"
                  onClick={() => excelInputRef.current?.click()}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-lg text-xs font-black shadow-xs transition cursor-pointer"
                >
                  <Upload size={14} />
                  <span>انتخاب فایل اکسل</span>
                </button>
              </div>

              {/* Card 2: Import PDF */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/90 flex flex-col justify-between hover:border-purple-300 transition">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-purple-700 font-black text-xs flex items-center gap-1.5">
                      <FileType size={16} />
                      <span>ورود از PDF (.pdf)</span>
                    </span>
                    <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-600">
                      جدول PDF
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                    خواندن مستقیم جدول برنامه از فایل PDF و آماده‌سازی برای بارگذاری در داشبورد
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-import-pdf"
                  onClick={() => pdfInputRef.current?.click()}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white rounded-lg text-xs font-black shadow-xs transition cursor-pointer"
                >
                  <FileType size={14} />
                  <span>انتخاب فایل PDF</span>
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* 5.5 Production Processes Quick Actions */}
      <div className="bg-emerald-50/70 rounded-2xl p-5 sm:p-6 border border-emerald-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Layers size={20} />
            </div>
            <div>
              <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                <span>پروسه‌ها و مراحل خط تولید (Excel)</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">ویژه ۱۴۰۵</span>
              </h4>
              <p className="text-xs text-slate-600 mt-0.5">
                ورود و مدیریت زمانبندی بچ‌های تولیدی، فواصل زمانی مراحل و هماهنگی با شیفت‌ها
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={downloadProcessExcelTemplate}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
            >
              <Download size={14} className="text-slate-500" />
              <span>دانلود الگوی اکسل پروسه‌ها</span>
            </button>
            {onOpenProcessesTab && (
              <button
                type="button"
                onClick={onOpenProcessesTab}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition cursor-pointer"
              >
                <Layers size={14} />
                <span>مشاهده و ورود اکسل در صفحه پروسه‌ها</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5.6 Management of Process Templates, Vessels & Strains (Used by Calendar Dropdowns) */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-6">
        <div className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={20} className="text-purple-600" />
            <h3 className="text-sm font-black text-slate-800">
              مدیریت گزینه‌های منوی کشویی پروسه‌ها، وسل‌ها و سویه‌ها
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            آیتم‌های زیر به عنوان گزینه‌های فایل کشویی موقع ادیت یا کلیک روی تاریخ‌ها در داشبورد نمایش داده می‌شوند.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Column 1: Process Categories */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <span className="font-black text-xs text-slate-800 block mb-1">
                ۱. دسته‌بندی پروسه‌ها ({toPersianDigits(availableProcessTemplates?.length || 0)})
              </span>
              <p className="text-[11px] text-slate-500 mb-3">
                شامل مراحل کشت سلول، محیط‌سازی، تلقیح، این‌اکتیویشن و...
              </p>

              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200 mb-3">
                {availableProcessTemplates?.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 text-[11px] font-bold px-2 py-1 rounded-md border border-slate-200">
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTemplate(t)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                      title="حذف"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200">
              <input
                type="text"
                placeholder="افزودن پروسه جدید..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTemplate()}
                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={handleAddTemplate}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shrink-0"
              >
                افزودن
              </button>
            </div>
          </div>

          {/* Column 2: Vessels & Bioreactors */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <span className="font-black text-xs text-slate-800 block mb-1">
                ۲. وسل‌ها و بیوراکتورها ({toPersianDigits(availableVessels?.length || 0)})
              </span>
              <p className="text-[11px] text-slate-500 mb-3">
                بیوراکتورهای ۱۰۰، ۷۰۰، ۱۵۰۰، ۲۷۰۰L، وسل ۴۳ و ۴۴، موبایل وسل
              </p>

              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200 mb-3">
                {availableVessels?.map(v => (
                  <span key={v} className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 text-[11px] font-bold px-2 py-1 rounded-md border border-blue-200">
                    <span>{v}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveVessel(v)}
                      className="text-blue-400 hover:text-red-600 cursor-pointer"
                      title="حذف"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200">
              <input
                type="text"
                placeholder="افزودن وسل یا بیوراکتور..."
                value={newVesselName}
                onChange={(e) => setNewVesselName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddVessel()}
                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleAddVessel}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shrink-0"
              >
                افزودن
              </button>
            </div>
          </div>

          {/* Column 3: Vaccine Strains */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/90 flex flex-col justify-between">
            <div>
              <span className="font-black text-xs text-slate-800 block mb-1">
                ۳. سویه‌های واکسن ({toPersianDigits(availableStrains?.length || 0)})
              </span>
              <p className="text-[11px] text-slate-500 mb-3">
                سویه‌های O2016/1, Asia, AGVII, A05, SAT1, SAT2
              </p>

              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200 mb-3">
                {availableStrains?.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 bg-rose-50 text-rose-900 text-[11px] font-black px-2 py-1 rounded-md border border-rose-200">
                    <span>{s}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStrain(s)}
                      className="text-rose-400 hover:text-red-600 cursor-pointer"
                      title="حذف"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200">
              <input
                type="text"
                placeholder="افزودن سویه جدید..."
                value={newStrainName}
                onChange={(e) => setNewStrainName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStrain()}
                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500"
              />
              <button
                type="button"
                onClick={handleAddStrain}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition cursor-pointer shrink-0"
              >
                افزودن
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. System Backup, Restore & Maintenance (JSON) */}
      <div className="bg-slate-50 rounded-2xl p-5 sm:p-6 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2">
              <Download size={16} className="text-slate-500" />
              <span>پشتیبان‌گیری کامل و نگهداری دیتابیس (JSON)</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              تهیه فایل بک‌آپ کامل از تمامی شیفت‌ها، تنظیمات پرسنل و تاریخ‌های قفل‌شده
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/shiftflow-app.zip"
              download="shiftflow-app.zip"
              id="btn-download-project-zip"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
              title="دانلود فایل فشرده سورس‌کد کامل برنامه جهت اجرا یا دیپلوی"
            >
              <Download size={14} className="text-white" />
              <span>دانلود سورس‌کد کامل برنامه (ZIP)</span>
            </a>

            <button
              type="button"
              id="btn-export-json"
              onClick={handleExportJson}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
            >
              <Download size={14} className="text-emerald-600" />
              <span>دانلود داده‌ها (JSON)</span>
            </button>

            <button
              type="button"
              id="btn-import-json"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
            >
              <Upload size={14} className="text-blue-600" />
              <span>بازگردانی داده‌ها (JSON)</span>
            </button>

            {onReset && (
              <button
                type="button"
                id="btn-factory-reset"
                onClick={() => {
                  if (confirm('هشدار: با این کار تمام داده‌ها به حالت اولیه کارخانه بازمی‌گردد. آیا مطمئن هستید؟')) {
                    onReset();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <Trash2 size={14} />
                <span>بازنشانی به تنظیمات کارخانه</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input type="file" ref={fileInputRef} onChange={handleJsonFileChange} accept=".json" className="hidden" />
      <input type="file" ref={excelInputRef} onChange={handleExcelChange} accept=".xlsx, .xls" className="hidden" />
      <input type="file" ref={pdfInputRef} onChange={handlePdfChange} accept=".pdf" className="hidden" />

      {/* Official PDF Preview / Print Modal */}
      <OfficialSchedulePdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        schedule={currentData.schedule}
        initialFilterMode={exportFilterMode}
        initialStartDate={exportStartDate}
        initialEndDate={exportEndDate}
        initialMonth={exportMonth}
      />
    </div>
  );
};
