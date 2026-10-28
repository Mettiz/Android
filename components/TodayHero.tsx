
/**
 * Today Hero Component - v1.0.1
 */
import React, { useEffect, useState } from 'react';
import { ShiftEntry, DailyProcessTask } from '../types';
import { ShiftUserCard } from './ShiftUserCard';
import { Calendar, Clock, ArrowLeft, FlaskConical, ChevronLeft, Sparkles } from 'lucide-react';
import { 
  getTodayPersianDateStr, 
  getTodayGregorianDateStr,
  getTodayPersianTimeStr, 
  getTodayPersianWeekday, 
  toPersianDigits 
} from '../utils/persianDate';

interface TodayHeroProps {
  schedule: ShiftEntry[];
  onNavigateToToday?: () => void;
  todayProcesses?: DailyProcessTask[];
  onOpenProcessModal?: (date: string) => void;
}

export const TodayHero: React.FC<TodayHeroProps> = ({ 
  schedule, 
  onNavigateToToday,
  todayProcesses = [],
  onOpenProcessModal 
}) => {
  const [currentDateStr, setCurrentDateStr] = useState<string>('');
  const [currentGregorianDateStr, setCurrentGregorianDateStr] = useState<string>('');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentWeekdayStr, setCurrentWeekdayStr] = useState<string>('');
  const [todayEntry, setTodayEntry] = useState<ShiftEntry | undefined>(undefined);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Get Persian Date & Time strictly in Asia/Tehran timezone
      const persianDate = getTodayPersianDateStr(now);
      setCurrentDateStr(persianDate);
      setCurrentGregorianDateStr(getTodayGregorianDateStr(now));
      setCurrentTimeStr(getTodayPersianTimeStr(now));
      setCurrentWeekdayStr(getTodayPersianWeekday(now));

      const entry = schedule.find(s => s.date === persianDate);
      setTodayEntry(entry);
    };

    updateTime();
    const timer = setInterval(updateTime, 10000); 

    return () => clearInterval(timer);
  }, [schedule]);

  return (
    <div id="today-hero-section" className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden relative no-print scroll-mt-20">
      {/* Background Pattern */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500"></div>
      
      <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* Date & Time Section */}
        <div className="flex flex-col items-center md:items-start gap-2 min-w-[200px]">
           <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
             <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
             وضعیت زنده
           </div>
           <h2 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight mt-2 text-center md:text-right">
             {currentWeekdayStr || 'سه‌شنبه'}
           </h2>
           
           {/* LTR Container: Icon Date (Persian & Gregorian) | Divider | Icon Time */}
           <div className="flex items-center gap-3 sm:gap-4 text-slate-500 font-medium mt-1.5" dir="ltr">
             <div className="flex items-center gap-2">
               <Calendar size={18} className="text-emerald-500 shrink-0 self-center" />
               <div className="flex flex-col items-center justify-center leading-tight">
                 <span className="text-base sm:text-lg font-black text-slate-800 tracking-tight text-center">{toPersianDigits(currentDateStr)}</span>
                 <span className="text-[10.5px] sm:text-xs font-semibold text-slate-500 tracking-wider tabular-nums text-center mt-0.5">
                   {currentGregorianDateStr}
                 </span>
               </div>
             </div>
             <div className="w-px h-8.5 bg-slate-200 mx-1"></div>
             <div className="flex items-center gap-2">
               <Clock size={18} className="text-blue-500 shrink-0" />
               <span className="text-base sm:text-lg font-bold text-slate-700">{toPersianDigits(currentTimeStr)}</span>
             </div>
           </div>
        </div>

        {/* Vertical Divider (Desktop) */}
        <div className="hidden md:block w-px h-24 bg-slate-100"></div>

        {/* Shifts Section */}
        <div className="flex-1 w-full">
           {todayEntry ? (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {/* Supervisor */}
               <div className="flex flex-col gap-1 items-stretch">
                 <span className="text-xs font-bold text-slate-400 pr-1 text-right">سرپرست</span>
                 <ShiftUserCard name={todayEntry.onCallPerson} type="Supervisor" showIcon={true} />
               </div>
               
               {/* Day Shift */}
               <div className="flex flex-col gap-1 items-stretch">
                 <div className="flex items-center justify-between pr-1">
                   <span className="text-xs font-bold text-slate-400 text-right">شیفت روز (۰۸ - ۱۹)</span>
                   {todayEntry.extraDayPersons && todayEntry.extraDayPersons.length > 0 && (
                     <span className="text-[10px] font-black text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                       {todayEntry.extraDayPersons.length + 1} نفره
                     </span>
                   )}
                 </div>
                 <div className="flex flex-col gap-1.5">
                   <ShiftUserCard 
                     name={todayEntry.dayShiftPerson} 
                     type="Day" 
                     showIcon={true} 
                     badgeLabel={todayEntry.extraDayPersons && todayEntry.extraDayPersons.length > 0 ? 'نفر اصلی' : undefined}
                   />
                   {todayEntry.extraDayPersons && todayEntry.extraDayPersons.map((extraPerson, extraIdx) => (
                     <ShiftUserCard 
                       key={`today-extra-day-${extraIdx}`}
                       name={extraPerson} 
                       type="Day" 
                       size="sm"
                       showIcon={true}
                       badgeLabel={extraIdx === 0 ? 'نفر دوم' : 'نفر سوم'}
                       className="border border-dashed border-orange-300 bg-orange-50/70"
                     />
                   ))}
                 </div>
               </div>

               {/* Night Shift */}
               <div className="flex flex-col gap-1 items-stretch">
                 <div className="flex items-center justify-between pr-1">
                   <span className="text-xs font-bold text-slate-400 text-right">شیفت شب (۱۹ - ۰۸)</span>
                   {todayEntry.extraNightPersons && todayEntry.extraNightPersons.length > 0 && (
                     <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                       {todayEntry.extraNightPersons.length + 1} نفره
                     </span>
                   )}
                 </div>
                 <div className="flex flex-col gap-1.5">
                   <ShiftUserCard 
                     name={todayEntry.nightShiftPerson} 
                     type="Night" 
                     showIcon={true} 
                     badgeLabel={todayEntry.extraNightPersons && todayEntry.extraNightPersons.length > 0 ? 'نفر اصلی' : undefined}
                   />
                   {todayEntry.extraNightPersons && todayEntry.extraNightPersons.map((extraPerson, extraIdx) => (
                     <ShiftUserCard 
                       key={`today-extra-night-${extraIdx}`}
                       name={extraPerson} 
                       type="Night" 
                       size="sm"
                       showIcon={true}
                       badgeLabel={extraIdx === 0 ? 'نفر دوم' : 'نفر سوم'}
                       className="border border-dashed border-slate-300 bg-slate-100/80"
                     />
                   ))}
                 </div>
               </div>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 h-full">
               <Calendar size={40} className="text-slate-300 mb-2" />
               <p className="text-slate-500 font-medium">برای تاریخ امروز ({toPersianDigits(currentDateStr)}) شیفتی در دیتابیس ثبت نشده است.</p>
               {onNavigateToToday && (
                 <button 
                   onClick={onNavigateToToday}
                   className="mt-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                 >
                   <span>مشاهده تقویم و شیفت‌های شهریور</span>
                   <ArrowLeft size={14} />
                 </button>
               )}
             </div>
           )}

           {/* Today Bioprocesses Banner */}
           {todayProcesses.length > 0 && (
             <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5 bg-gradient-to-l from-emerald-50/70 to-teal-50/70 p-3 rounded-xl border border-emerald-200/60">
               <div className="flex items-center gap-2.5">
                 <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                   <FlaskConical size={15} />
                 </div>
                 <div>
                   <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                     پروسه بیوراکتور و تولید فعال امروز:
                   </span>
                   <div className="text-xs sm:text-sm font-black text-slate-850 mt-0.5 flex items-center gap-2 flex-wrap">
                     <span>{todayProcesses[0].title}</span>
                     {todayProcesses[0].vessel && (
                       <span className="text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                         {todayProcesses[0].vessel}
                       </span>
                     )}
                     {todayProcesses.length > 1 && (
                       <span className="text-[10px] bg-emerald-200 text-emerald-900 font-black px-1.5 py-0.5 rounded-full">
                         +{toPersianDigits(todayProcesses.length - 1)} پروسه دیگر
                       </span>
                     )}
                   </div>
                 </div>
               </div>

               {onOpenProcessModal && (
                 <button
                   type="button"
                   onClick={() => onOpenProcessModal(currentDateStr)}
                   className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer"
                 >
                   <span>مشاهده و ویرایش فرآیند</span>
                   <ChevronLeft size={14} />
                 </button>
               )}
             </div>
           )}
        </div>

      </div>
    </div>
  );
};
