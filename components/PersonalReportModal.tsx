
/**
 * Personal Shift Report Modal - v1.0.1
 */
import React, { useMemo, useState, useEffect } from 'react';
import { ShiftEntry, PersonName } from '../types';
import { X, Printer, FileDown, Filter, ChevronDown, Calculator } from 'lucide-react';

interface PersonalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ShiftEntry[]; // Displayed month (default view)
  fullSchedule: ShiftEntry[]; // Full history for lookback and filtering
  staffList: PersonName[];
  monthName: string;
}

type FilterType = 'VIEW' | 'CUSTOM';

const PERSIAN_MONTHS = [
  { value: '01', label: 'فروردین' },
  { value: '02', label: 'اردیبهشت' },
  { value: '03', label: 'خرداد' },
  { value: '04', label: 'تیر' },
  { value: '05', label: 'مرداد' },
  { value: '06', label: 'شهریور' },
  { value: '07', label: 'مهر' },
  { value: '08', label: 'آبان' },
  { value: '09', label: 'آذر' },
  { value: '10', label: 'دی' },
  { value: '11', label: 'بهمن' },
  { value: '12', label: 'اسفند' },
];

const PERSIAN_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

// Helper to convert digits to Persian
const toPersianDigits = (s: string | number) => String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

// High contrast compact date select
const CompactDateSelect = ({ value, onChange, options, label, width = 'w-20' }: { value: string, onChange: (val: string) => void, options: any[], label: string, width?: string }) => (
    <div className="flex flex-col">
        {label && <label className="text-[10px] text-black font-black mb-1 text-center">{label}</label>}
        <div className={`relative h-8 ${width}`}>
            <select 
                className="w-full h-full appearance-none bg-white border border-slate-300 rounded-md py-0 px-2 text-xs font-bold text-slate-700 focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer text-center"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{ textAlign: 'center', textAlignLast: 'center' }}
            >
                {options.map(o => <option key={o.value || o} value={o.value || o} className="text-black bg-white">{o.label || o}</option>)}
            </select>
            <div className="absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown size={10} strokeWidth={2} />
            </div>
        </div>
    </div>
);


export const PersonalReportModal: React.FC<PersonalReportModalProps> = ({
  isOpen, onClose, schedule, fullSchedule, staffList, monthName
}) => {
  const [selectedUser, setSelectedUser] = useState<PersonName>(staffList[0]);
  
  // Filter States
  const [filterType, setFilterType] = useState<FilterType>('VIEW');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Lock body scroll when modal is open to prevent dashboard scrolling
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

  // Extract unique sorted years for the dropdowns
  const availableYears = useMemo(() => {
    const years = new Set(fullSchedule.map(s => s.date.split('/')[0]));
    const sorted = Array.from(years).sort();
    if (sorted.length === 0) return ['1404'];
    return sorted;
  }, [fullSchedule]);

  // Helper functions for date parts
  const getDateParts = (dateStr: string) => {
    if (!dateStr) return { y: '', m: '', d: '' };
    const parts = dateStr.split('/');
    return { y: parts[0] || '', m: parts[1] || '', d: parts[2] || '' };
  };

  const updateDatePart = (isStart: boolean, field: 'y'|'m'|'d', val: string) => {
      const current = isStart ? customStart : customEnd;
      const parts = getDateParts(current);
      
      const defaultYear = availableYears[0];
      
      const newParts = {
          y: parts.y || defaultYear,
          m: parts.m || '01',
          d: parts.d || '01',
          [field]: val
      };
      
      const newDateStr = `${newParts.y}/${newParts.m}/${newParts.d}`;
      if (isStart) setCustomStart(newDateStr);
      else setCustomEnd(newDateStr);
  };

  const targetSchedule = useMemo(() => {
    switch (filterType) {
        case 'CUSTOM':
            if (!customStart && !customEnd) return schedule;
            return fullSchedule.filter(s => {
                if (customStart && s.date < customStart) return false;
                if (customEnd && s.date > customEnd) return false;
                return true;
            }).sort((a, b) => a.date.localeCompare(b.date));

        case 'VIEW':
        default:
            return schedule;
    }
  }, [filterType, customStart, customEnd, schedule, fullSchedule]);

  // Compute date range for header
  const headerDateRange = useMemo(() => {
      if (targetSchedule.length === 0) return '-';
      const s = targetSchedule[0].date;
      const e = targetSchedule[targetSchedule.length - 1].date;
      return `${toPersianDigits(s)} - ${toPersianDigits(e)}`;
  }, [targetSchedule]);

  // --- WORK HOUR CALCULATION ENGINE ---
  const detailedStats = useMemo(() => {
    // 1. Calculate Target Deduction based on Holidays
    const MOWAZAFI_BASE_TARGET = 198;
    
    const holidayDeductionHours = targetSchedule.reduce((total, entry) => {
        const isFriday = entry.dayName === 'جمعه';
        const isThursday = entry.dayName === 'پنج‌شنبه';
        if (!isFriday && !isThursday && entry.isHoliday) {
            return total + 9;
        }
        return total;
    }, 0);

    const ADJUSTED_TARGET = Math.max(0, MOWAZAFI_BASE_TARGET - holidayDeductionHours);

    let rawMowazafi = 0;       
    let rawNightFloat = 0;     
    let rawNormalOT = 0;       
    let rawHolidayOT = 0;      

    const history = targetSchedule.map(entry => {
      const isFriday = entry.dayName === 'جمعه';
      const isThursday = entry.dayName === 'پنج‌شنبه';
      const isOfficialHoliday = entry.isHoliday;
      
      const isHolidayOTDay = isFriday || isOfficialHoliday;
      const isNormalWorkDay = !isHolidayOTDay && !isThursday;

      const isDayShift = entry.dayShiftPerson === selectedUser || (entry.extraDayPersons && entry.extraDayPersons.includes(selectedUser)); 
      const isNightShift = entry.nightShiftPerson === selectedUser || (entry.extraNightPersons && entry.extraNightPersons.includes(selectedUser)); 
      
      const fullIndex = fullSchedule.findIndex(s => s.id === entry.id);
      let prevEntry: ShiftEntry | undefined;
      if (fullIndex !== -1 && fullIndex > 0) {
          prevEntry = fullSchedule[fullIndex - 1];
      } else {
          const dateIdx = fullSchedule.findIndex(s => s.date === entry.date);
          if (dateIdx !== -1 && dateIdx > 0) prevEntry = fullSchedule[dateIdx - 1];
      }
      const wasNightYesterday = prevEntry ? (prevEntry.nightShiftPerson === selectedUser || (prevEntry.extraNightPersons && prevEntry.extraNightPersons.includes(selectedUser))) : false; 

      let dayMowazafi = 0;
      let dayNightFloat = 0;
      let dayNormalOT = 0;
      let dayHolidayOT = 0;
      let descriptions: string[] = [];

      // BLOCK A: 00:00 - 08:00
      if (wasNightYesterday) {
          if (isHolidayOTDay) {
              dayHolidayOT += 8;
              descriptions.push('شب‌کاری (بامداد تعطیل)');
          } else if (isThursday) {
              dayNormalOT += 8;
              descriptions.push('شب‌کاری (بامداد ۵شنبه)');
          } else {
              dayNightFloat += 8;
              descriptions.push('شب‌کاری (بامداد)');
          }
      }

      // BLOCK B: 08:00 - 17:00
      if (isDayShift) {
          if (isHolidayOTDay) {
              dayHolidayOT += 9;
              descriptions.push('شیفت روز (تعطیل)');
          } else if (isThursday) {
              dayNormalOT += 9;
              descriptions.push('شیفت روز (۵شنبه)');
          } else {
              dayMowazafi += 9;
              descriptions.push('شیفت روز (عادی)');
          }
      } else if (!isDayShift && !isNightShift && !wasNightYesterday) {
          if (isNormalWorkDay) {
              dayMowazafi += 9;
              descriptions.push('کار روزانه (غیرشیفت)');
          }
      }

      // BLOCK C: 17:00 - 19:00
      if (isDayShift) {
          if (isHolidayOTDay) {
              dayHolidayOT += 2;
          } else if (isThursday) {
              dayNormalOT += 2;
          } else {
              dayNormalOT += 2; 
              if (!descriptions.includes('اضافه کار عصر')) descriptions.push('اضافه کار عصر');
          }
      }

      // BLOCK D: 19:00 - 24:00
      if (isNightShift) {
          if (isHolidayOTDay) {
              dayHolidayOT += 5;
              descriptions.push('شیفت شب (شروع تعطیل)');
          } else if (isThursday) {
              dayNormalOT += 5;
              descriptions.push('شیفت شب (شروع ۵شنبه)');
          } else {
              dayNightFloat += 5;
              descriptions.push('شیفت شب (شروع)');
          }
      }

      rawMowazafi += dayMowazafi;
      rawNightFloat += dayNightFloat;
      rawNormalOT += dayNormalOT;
      rawHolidayOT += dayHolidayOT;

      return {
          ...entry,
          mowazafi: dayMowazafi,
          nightFloat: dayNightFloat,
          normalOT: dayNormalOT,
          holidayOT: dayHolidayOT,
          desc: descriptions.length > 0 ? descriptions.join(' + ') : (isHolidayOTDay || isThursday ? 'تعطیل' : '---')
      };
    });

    const totalRawMowazafi = rawMowazafi;
    const deficit = ADJUSTED_TARGET - totalRawMowazafi;

    let finalMowazafi = totalRawMowazafi;
    let convertedNight = 0;
    let remainingNightOT = rawNightFloat;
    let excessMowazafiOT = 0;

    if (deficit > 0) {
        const amountToFill = Math.min(deficit, rawNightFloat);
        convertedNight = amountToFill;
        finalMowazafi += amountToFill;
        remainingNightOT = rawNightFloat - amountToFill;
    } else {
        excessMowazafiOT = Math.abs(deficit);
        finalMowazafi = ADJUSTED_TARGET; 
    }

    const finalNormalOT = rawNormalOT + remainingNightOT + excessMowazafiOT;
    
    return {
        history,
        totals: {
            baseTarget: MOWAZAFI_BASE_TARGET,
            deduction: holidayDeductionHours,
            adjustedTarget: ADJUSTED_TARGET,
            rawMowazafi,
            deficit: deficit > 0 ? deficit : 0,
            nightFloat: rawNightFloat,
            convertedNight,
            excessMowazafi: excessMowazafiOT,
            finalNormalOT,
            finalHolidayOT: rawHolidayOT,
        }
    };

  }, [targetSchedule, fullSchedule, selectedUser]);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Report-${selectedUser}`;
    document.body.classList.add('print-mode-modal');
    
    // Aggressively hide main dashboard elements to prevent leaks
    const mainContent = document.querySelector('.main-content') as HTMLElement;
    const navbar = document.querySelector('.main-navbar') as HTMLElement;
    
    if (mainContent) mainContent.style.display = 'none';
    if (navbar) navbar.style.display = 'none';

    window.print();

    setTimeout(() => {
        document.body.classList.remove('print-mode-modal');
        document.title = originalTitle;
        if (mainContent) mainContent.style.display = '';
        if (navbar) navbar.style.display = '';
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:p-0 print:bg-white print:static print:block print:inset-0 print:z-[9999]">
      <div className="absolute inset-0 print:hidden" onClick={onClose}></div>
      
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden print:overflow-visible print:shadow-none print:border-none print:w-full print:max-w-none print:h-auto print:bg-white print:static">
        
        {/* ======================= SCREEN VIEW ======================= */}
        <div id="screen-view" className="flex flex-col flex-1 min-h-0 overflow-hidden print:hidden">
            
            {/* Header (Fixed) */}
            <div className="shrink-0 p-3 md:p-4 border-b border-slate-200 flex flex-col gap-3 bg-slate-50">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <FileDown size={20} className="text-emerald-600"/>
                        گزارش کارکرد پرسنل
                    </h3>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select 
                            value={selectedUser}
                            onChange={(e) => setSelectedUser(e.target.value)}
                            className="flex-1 sm:flex-none bg-white text-black border border-slate-300 rounded-lg text-xs p-2 outline-none focus:ring-1 focus:ring-emerald-500 font-bold"
                        >
                            {staffList.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button onClick={handlePrint} className="flex items-center gap-2 bg-black text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition font-bold shadow text-xs">
                            <Printer size={16} />
                            <span className="hidden sm:inline">چاپ</span>
                        </button>
                        <button onClick={onClose} className="bg-white border border-slate-200 text-slate-400 hover:text-red-500 p-2 rounded-lg transition">
                            <X size={18} />
                        </button>
                    </div>
                </div>
                {/* Filters */}
                <div className="flex flex-col lg:flex-row items-center gap-2 bg-white p-2 rounded-lg border border-slate-200 text-xs">
                    <div className="flex items-center gap-1 font-bold whitespace-nowrap text-slate-800">
                        <Filter size={14} />
                        فیلتر:
                    </div>
                    <div className="flex gap-1 w-full sm:w-auto justify-center">
                        <button onClick={() => setFilterType('VIEW')} className={`px-2 py-1 rounded transition font-bold border ${filterType === 'VIEW' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>ماه جاری</button>
                        <button onClick={() => setFilterType('CUSTOM')} className={`px-2 py-1 rounded transition font-bold border ${filterType === 'CUSTOM' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>دستی</button>
                    </div>
                    {filterType === 'CUSTOM' && (
                        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 lg:pt-0 lg:border-r lg:pr-2 lg:mr-2 border-slate-100 border-t lg:border-t-0 w-full lg:w-auto">
                            <CompactDateSelect width="w-12" label="" value={getDateParts(customStart).d || ''} onChange={(v) => updateDatePart(true, 'd', v)} options={PERSIAN_DAYS} />
                            <CompactDateSelect width="w-16" label="" value={getDateParts(customStart).m || ''} onChange={(v) => updateDatePart(true, 'm', v)} options={PERSIAN_MONTHS} />
                            <CompactDateSelect width="w-14" label="" value={getDateParts(customStart).y || ''} onChange={(v) => updateDatePart(true, 'y', v)} options={availableYears} />
                            <span className="text-slate-300">-</span>
                            <CompactDateSelect width="w-12" label="" value={getDateParts(customEnd).d || ''} onChange={(v) => updateDatePart(false, 'd', v)} options={PERSIAN_DAYS} />
                            <CompactDateSelect width="w-16" label="" value={getDateParts(customEnd).m || ''} onChange={(v) => updateDatePart(false, 'm', v)} options={PERSIAN_MONTHS} />
                            <CompactDateSelect width="w-14" label="" value={getDateParts(customEnd).y || ''} onChange={(v) => updateDatePart(false, 'y', v)} options={availableYears} />
                        </div>
                    )}
                </div>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-white flex flex-col">
                <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-center shrink-0">
                    <div className="bg-slate-50 border border-slate-300 rounded-lg p-3">
                        <div className="text-[10px] text-slate-900 font-bold mb-1">کارکرد موظفی (خام)</div>
                        <div className="text-xl font-black text-slate-900">{detailedStats.totals.rawMowazafi}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="text-[10px] text-blue-900 font-bold mb-1">اضافه کار عادی (نهایی)</div>
                        <div className="text-xl font-black text-blue-900">{detailedStats.totals.finalNormalOT}</div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                        <div className="text-[10px] text-indigo-900 font-bold mb-1">ذخیره شب‌کاری (عادی)</div>
                        <div className="text-xl font-black text-indigo-900">{detailedStats.totals.nightFloat}</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-[10px] text-red-900 font-bold mb-1">اضافه کار تعطیل (نهایی)</div>
                        <div className="text-xl font-black text-red-900">{detailedStats.totals.finalHolidayOT}</div>
                    </div>
                </div>
                
                <div className="mb-4 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start gap-2 text-xs text-amber-900 font-medium shrink-0">
                    <Calculator size={16} className="mt-0.5 shrink-0" />
                    <div className="leading-5">
                        <strong>فرمول محاسبه:</strong> موظفی پایه {detailedStats.totals.baseTarget} ساعت است. 
                        {detailedStats.totals.deduction > 0 && (
                            <span className="block">
                                به دلیل {detailedStats.totals.deduction / 9} روز تعطیل رسمی (غیر جمعه/پنجشنبه)، {detailedStats.totals.deduction} ساعت کسر و موظفی نهایی <strong>{detailedStats.totals.adjustedTarget} ساعت</strong> منظور شد.
                            </span>
                        )}
                    </div>
                </div>

                {/* --- Screen View Table --- */}
                <div className="border border-slate-400 rounded-lg relative">
                    <table className="w-full table-fixed text-center text-[10px] sm:text-xs md:text-sm border-collapse">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="p-1 sm:p-3 font-bold border-l border-slate-600 w-[16%] sm:w-auto">تاریخ</th>
                                <th className="p-1 sm:p-3 font-bold border-l border-slate-600 w-[14%] sm:w-auto">روز</th>
                                <th className="p-1 sm:p-3 font-bold border-l border-slate-600 w-[30%] sm:w-auto">
                                    <span className="sm:hidden">شرح</span>
                                    <span className="hidden sm:inline">وضعیت / شرح</span>
                                </th>
                                <th className="p-1 sm:p-3 font-bold border-l border-slate-600 w-[10%] sm:w-auto">موظفی</th>
                                <th className="p-1 sm:p-3 font-bold border-l border-slate-600 w-[10%] sm:w-auto">
                                    <span className="sm:hidden">روز</span>
                                    <span className="hidden sm:inline">روز/۵شنبه</span>
                                </th>
                                <th className="p-1 sm:p-3 font-bold border-l border-slate-600 w-[10%] sm:w-auto">
                                    <span className="sm:hidden">شب</span>
                                    <span className="hidden sm:inline">شب/شناور</span>
                                </th>
                                <th className="p-1 sm:p-3 font-bold w-[10%] sm:w-auto">تعطیل</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-400 bg-white">
                            {detailedStats.history.map((row, idx) => (
                                <tr key={row.id} className={`${idx % 2 === 0 ? 'bg-slate-100' : 'bg-white'} hover:bg-emerald-50 transition-colors text-slate-900`}>
                                    <td className="p-1 sm:p-2 border-l border-slate-400 font-bold tracking-tighter sm:tracking-normal" dir="ltr">{toPersianDigits(row.date)}</td>
                                    <td className={`p-1 sm:p-2 border-l border-slate-400 font-bold ${row.isHoliday || row.dayName === 'جمعه' ? 'text-red-600' : ''}`}>{row.dayName}</td>
                                    <td className="p-0.5 sm:p-2 border-l border-slate-400 text-right font-medium leading-tight whitespace-normal">{row.desc}</td>
                                    <td className="p-1 sm:p-2 border-l border-slate-400 font-bold">{toPersianDigits(row.mowazafi || '-')}</td>
                                    <td className="p-1 sm:p-2 border-l border-slate-400 font-bold">{toPersianDigits(row.normalOT || '-')}</td>
                                    <td className="p-1 sm:p-2 border-l border-slate-400 font-bold">{toPersianDigits(row.nightFloat || '-')}</td>
                                    <td className="p-1 sm:p-2 font-bold">{toPersianDigits(row.holidayOT || '-')}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-400 shadow-inner text-[10px] sm:text-sm">
                             <tr>
                                 <td colSpan={3} className="p-2 sm:p-3 text-center border-l border-slate-400">مجموع کل</td>
                                 <td className="p-1 sm:p-3 border-l border-slate-400">{toPersianDigits(detailedStats.totals.rawMowazafi)}</td>
                                 <td className="p-1 sm:p-3 border-l border-slate-400">{toPersianDigits(detailedStats.totals.finalNormalOT)}</td>
                                 <td className="p-1 sm:p-3 border-l border-slate-400">{toPersianDigits(detailedStats.totals.nightFloat)}</td>
                                 <td className="p-1 sm:p-3">{toPersianDigits(detailedStats.totals.finalHolidayOT)}</td>
                             </tr>
                        </tfoot>
                    </table>
                </div>

            </div>
        </div>

        {/* ======================= PRINT VIEW (Isolated Single Table) ======================= */}
        <div id="print-view" className="hidden print:block w-full">
            <table className="w-full text-right border-collapse" style={{ pageBreakInside: 'auto' }}>
                <thead>
                    {/* Header Row injected into table */}
                    <tr className="print:break-inside-avoid">
                        <th colSpan={7} className="p-0 border-none pb-4">
                             <div className="w-full border-2 border-black rounded-xl p-4 flex justify-between items-center bg-white relative">
                                 {/* Right: Name */}
                                 <div className="flex flex-col items-start w-1/3 gap-1">
                                     <span className="text-sm font-bold text-black">نام پرسنل:</span>
                                     <div className="bg-white border border-black rounded-lg px-4 py-2 text-xl font-bold text-black">
                                         {selectedUser}
                                     </div>
                                 </div>
                                 {/* Center: Title */}
                                 <div className="flex flex-col items-center w-1/3 text-center">
                                     <h1 className="text-2xl font-black text-black whitespace-nowrap">گزارش کارکرد تفصیلی</h1>
                                     <div className="text-xl font-bold text-black mt-2">
                                         {toPersianDigits(monthName)}
                                     </div>
                                 </div>
                                 {/* Left: Info */}
                                 <div className="flex flex-col items-end w-1/3">
                                     <div className="text-lg font-bold text-black dir-ltr">
                                         <span className="ml-1">بازه:</span>
                                         {headerDateRange}
                                     </div>
                                     <div className="text-sm font-bold text-black mt-2">
                                         تاریخ گزارش: {toPersianDigits(new Date().toLocaleDateString('fa-IR', { timeZone: 'Asia/Tehran' }))}
                                     </div>
                                 </div>
                             </div>
                        </th>
                    </tr>

                    {/* Column Headers */}
                    <tr className="bg-gray-200 text-black border-y-2 border-black">
                        <th className="py-2 px-1 text-lg font-bold text-center border-x border-black w-24">تاریخ</th>
                        <th className="py-2 px-1 text-lg font-bold text-center border-x border-black w-20">روز</th>
                        <th className="py-2 px-1 text-lg font-bold text-center border-x border-black">وضعیت / شرح</th>
                        <th className="py-2 px-1 text-lg font-bold text-center border-x border-black w-20">موظفی</th>
                        <th className="py-2 px-1 text-lg font-bold text-center border-x border-black w-20">عادی/۵شنبه</th>
                        <th className="py-2 px-1 text-lg font-bold text-center border-x border-black w-20">شب/شناور</th>
                        <th className="py-2 px-1 text-lg font-bold text-center border-x border-black w-20">تعطیل</th>
                    </tr>
                </thead>
                <tbody className="text-black">
                    {detailedStats.history.map((row) => (
                        <tr key={row.id} className={`${(row.isHoliday || row.dayName === 'جمعه') ? 'bg-gray-200' : 'bg-white'} border-b border-black break-inside-avoid`}>
                             <td className="p-1 text-center text-[9pt] font-bold border-x border-black" dir="ltr">{toPersianDigits(row.date)}</td>
                             <td className="p-1 text-center text-[9pt] font-bold border-x border-black">{row.dayName}</td>
                             <td className="p-1 text-right text-[9pt] font-medium border-x border-black">{row.desc}</td>
                             <td className="p-1 text-center text-[9pt] font-bold border-x border-black">{toPersianDigits(row.mowazafi || '-')}</td>
                             <td className="p-1 text-center text-[9pt] font-bold border-x border-black">{toPersianDigits(row.normalOT || '-')}</td>
                             <td className="p-1 text-center text-[9pt] font-bold border-x border-black">{toPersianDigits(row.nightFloat || '-')}</td>
                             <td className="p-1 text-center text-[9pt] font-bold border-x border-black">{toPersianDigits(row.holidayOT || '-')}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                     <tr className="bg-gray-300 text-black font-black border-y-2 border-black">
                         <td colSpan={3} className="py-2 px-1 text-center text-lg border-x border-black">مجموع کل</td>
                         <td className="py-2 px-1 text-center text-lg border-x border-black">{toPersianDigits(detailedStats.totals.rawMowazafi)}</td>
                         <td className="py-2 px-1 text-center text-lg border-x border-black">{toPersianDigits(detailedStats.totals.finalNormalOT)}</td>
                         <td className="py-2 px-1 text-center text-lg border-x border-black">{toPersianDigits(detailedStats.totals.nightFloat)}</td>
                         <td className="py-2 px-1 text-center text-lg border-x border-black">{toPersianDigits(detailedStats.totals.finalHolidayOT)}</td>
                     </tr>
                </tfoot>
            </table>
        </div>

      </div>
    </div>
  );
};
