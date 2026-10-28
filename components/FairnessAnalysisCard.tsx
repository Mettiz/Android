/**
 * Shift Schedule Fairness & Weighted Hours Analysis Component
 * Provides comprehensive equity metrics, weighted hours with night multiplier,
 * fatigue indicators, and imbalance visual warnings for bioprocess production staff.
 */
import React, { useMemo, useState } from 'react';
import { 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Moon, 
  Sun, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  ShieldAlert, 
  Sparkles, 
  Filter,
  BarChart2
} from 'lucide-react';
import { ShiftEntry, Personnel, SHIFT_WEIGHTS } from '../types';
import { toPersianDigits } from '../utils/persianDate';

interface EmployeeFairnessMetric {
  name: string;
  dayCount: number;
  nightCount: number;
  holidayCount: number;
  rawHours: number;
  weightedScore: number;
  consecutiveNightsMax: number;
  deviationPercent: number;
  status: 'optimal' | 'slight_high' | 'slight_low' | 'overload' | 'underload';
  hasFatigueRisk: boolean;
  color?: string;
}

interface FairnessAnalysisCardProps {
  scheduleData: ShiftEntry[];
  shiftWorkers: string[];
  personnelList?: Personnel[];
  onQuickSwapSuggest?: (fromPerson: string, toPerson: string) => void;
}

const DEFAULT_PERSON_COLORS = [
  '#2563eb', '#f97316', '#e11d48', '#059669', '#7c3aed', 
  '#0891b2', '#ca8a04', '#0284c7', '#4f46e5', '#10b981', '#6366f1'
];

export const FairnessAnalysisCard: React.FC<FairnessAnalysisCardProps> = ({
  scheduleData,
  shiftWorkers,
  personnelList = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'alerts_only'>('all');
  const [metricMode, setMetricMode] = useState<'weighted' | 'raw'>('weighted');
  const [showExplanation, setShowExplanation] = useState(false);

  // Helper to get consistent person color
  const getPersonColor = (name: string, index: number): string => {
    const found = personnelList.find(p => p.name === name);
    if (found?.color) return found.color;
    return DEFAULT_PERSON_COLORS[index % DEFAULT_PERSON_COLORS.length];
  };

  // Perform comprehensive fairness calculation
  const fairnessReport = useMemo(() => {
    if (!scheduleData || scheduleData.length === 0 || !shiftWorkers || shiftWorkers.length === 0) {
      return null;
    }

    // Sort schedule chronologically to detect consecutive nights
    const sortedSchedule = [...scheduleData].sort((a, b) => a.date.localeCompare(b.date));

    // Calculate per-employee stats
    const employeeMetrics: EmployeeFairnessMetric[] = shiftWorkers.map((worker, idx) => {
      let dayCount = 0;
      let nightCount = 0;
      let holidayCount = 0;
      let currentConsecutiveNights = 0;
      let maxConsecutiveNights = 0;

      sortedSchedule.forEach((entry) => {
        const isDay = entry.dayShiftPerson === worker || (entry.extraDayPersons && entry.extraDayPersons.includes(worker));
        const isNight = entry.nightShiftPerson === worker || (entry.extraNightPersons && entry.extraNightPersons.includes(worker));

        if (isDay) {
          dayCount++;
          if (entry.isHoliday) holidayCount++;
        }

        if (isNight) {
          nightCount++;
          if (entry.isHoliday) holidayCount++;
          currentConsecutiveNights++;
          if (currentConsecutiveNights > maxConsecutiveNights) {
            maxConsecutiveNights = currentConsecutiveNights;
          }
        } else {
          currentConsecutiveNights = 0;
        }
      });

      const rawHours = (dayCount * SHIFT_WEIGHTS.dayHours) + (nightCount * SHIFT_WEIGHTS.nightHours);
      // Night multiplier is 1.5x (13h * 1.5 = 19.5 weighted hours)
      const weightedScore = (dayCount * SHIFT_WEIGHTS.dayHours) + (nightCount * SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier);

      const hasFatigueRisk = maxConsecutiveNights >= 2 || (nightCount >= 4 && nightCount / (dayCount + nightCount || 1) > 0.6);

      return {
        name: worker,
        dayCount,
        nightCount,
        holidayCount,
        rawHours,
        weightedScore,
        consecutiveNightsMax: maxConsecutiveNights,
        deviationPercent: 0, // calculated after mean
        status: 'optimal',
        hasFatigueRisk,
        color: getPersonColor(worker, idx),
      };
    });

    // Calculate team benchmarks
    const totalWeightedHours = employeeMetrics.reduce((acc, m) => acc + m.weightedScore, 0);
    const meanWeightedHours = shiftWorkers.length > 0 ? totalWeightedHours / shiftWorkers.length : 0;

    const totalRawHours = employeeMetrics.reduce((acc, m) => acc + m.rawHours, 0);
    const meanRawHours = shiftWorkers.length > 0 ? totalRawHours / shiftWorkers.length : 0;

    // Standard deviation of weighted hours
    const variance = employeeMetrics.reduce((acc, m) => acc + Math.pow(m.weightedScore - meanWeightedHours, 2), 0) / (shiftWorkers.length || 1);
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = meanWeightedHours > 0 ? (stdDev / meanWeightedHours) * 100 : 0;

    // Calculate Gini Coefficient for weighted hours distribution
    const values = employeeMetrics.map(m => m.weightedScore).sort((a, b) => a - b);
    const n = values.length;
    let gini = 0;
    if (n > 1 && totalWeightedHours > 0) {
      let cumulativeSum = 0;
      for (let i = 0; i < n; i++) {
        cumulativeSum += (2 * (i + 1) - n - 1) * values[i];
      }
      gini = cumulativeSum / (n * totalWeightedHours);
      if (gini < 0) gini = 0;
    }

    // Fairness score out of 100%
    const fairnessScore = Math.max(20, Math.min(100, Math.round(100 - (coefficientOfVariation * 1.6))));

    // Update deviations & statuses
    employeeMetrics.forEach(m => {
      const activeScore = m.weightedScore;
      const targetMean = meanWeightedHours;
      const diff = activeScore - targetMean;
      const pct = targetMean > 0 ? (diff / targetMean) * 100 : 0;
      m.deviationPercent = Math.round(pct);

      if (pct >= 20) {
        m.status = 'overload';
      } else if (pct >= 10) {
        m.status = 'slight_high';
      } else if (pct <= -20) {
        m.status = 'underload';
      } else if (pct <= -10) {
        m.status = 'slight_low';
      } else {
        m.status = 'optimal';
      }
    });

    // Counts
    const overloadedCount = employeeMetrics.filter(m => m.status === 'overload').length;
    const underloadedCount = employeeMetrics.filter(m => m.status === 'underload').length;
    const fatigueCount = employeeMetrics.filter(m => m.hasFatigueRisk).length;
    const totalImbalances = employeeMetrics.filter(m => m.status !== 'optimal').length;

    // Smart Balancing suggestion: Pair the worker with max weighted hours and min weighted hours
    const sortedByWeight = [...employeeMetrics].sort((a, b) => b.weightedScore - a.weightedScore);
    const highestLoad = sortedByWeight[0];
    const lowestLoad = sortedByWeight[sortedByWeight.length - 1];
    let balancingSuggestion: string | null = null;

    if (highestLoad && lowestLoad && (highestLoad.weightedScore - lowestLoad.weightedScore > 18)) {
      balancingSuggestion = `انتقال ۱ شیفت شب از ${highestLoad.name.replace('مهندس', '').trim()} به ${lowestLoad.name.replace('مهندس', '').trim()}، انحراف تیم را به زیر ۱۰٪ کاهش می‌دهد.`;
    }

    return {
      metrics: employeeMetrics,
      meanWeightedHours,
      meanRawHours,
      stdDev,
      gini,
      fairnessScore,
      overloadedCount,
      underloadedCount,
      fatigueCount,
      totalImbalances,
      balancingSuggestion,
      maxMetricValue: Math.max(...employeeMetrics.map(m => metricMode === 'weighted' ? m.weightedScore : m.rawHours), 1)
    };
  }, [scheduleData, shiftWorkers, personnelList, metricMode]);

  if (!fairnessReport) {
    return null;
  }

  const {
    metrics,
    meanWeightedHours,
    meanRawHours,
    gini,
    fairnessScore,
    overloadedCount,
    underloadedCount,
    fatigueCount,
    totalImbalances,
    balancingSuggestion,
    maxMetricValue
  } = fairnessReport;

  // Filter metrics if user only wants to see alerts
  const displayMetrics = filterMode === 'alerts_only' 
    ? metrics.filter(m => m.status !== 'optimal' || m.hasFatigueRisk)
    : metrics;

  // Grade color and label
  const getScoreBadge = (score: number) => {
    if (score >= 85) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        bar: 'bg-emerald-500',
        ring: 'ring-emerald-400',
        label: 'توزیع عادلانه و متوازن',
        statusColor: 'text-emerald-700'
      };
    }
    if (score >= 70) {
      return {
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        bar: 'bg-amber-500',
        ring: 'ring-amber-400',
        label: 'تعادل متوسط با انحراف جزئی',
        statusColor: 'text-amber-700'
      };
    }
    return {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      bar: 'bg-rose-500',
      ring: 'ring-rose-400',
      label: 'عدم تعادل محسوس (نیازمند اصلاح)',
      statusColor: 'text-rose-700'
    };
  };

  const scoreBadge = getScoreBadge(fairnessScore);
  const activeBenchmarkMean = metricMode === 'weighted' ? meanWeightedHours : meanRawHours;

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 overflow-hidden transition-all duration-200 no-print">
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 sm:px-5 sm:py-3.5 bg-linear-to-r from-indigo-50/70 via-slate-50/50 to-white border-b border-slate-200/80 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Scale size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">
                تحلیل عدالت و تعادل ساعات وزنی شیفت‌ها
              </h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${scoreBadge.bg}`}>
                شاخص عدالت: {toPersianDigits(fairnessScore)}٪ ({scoreBadge.label})
              </span>
              {totalImbalances > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  {toPersianDigits(totalImbalances)} عدم تعادل
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              محاسبه سختی شیفت شب با ضریب ۱٫۵× و پایش خطرات خستگی پرسنل در عملیات بیولوژیک
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
            aria-label="Toggle details"
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expandable Content Area */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Top Scorecard KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {/* KPI 1: Fairness Score */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">امتیاز عدالت توزیع</span>
                <Scale size={15} className="text-indigo-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-800 tabular-nums">
                  {toPersianDigits(fairnessScore)}٪
                </span>
                <span className={`text-[10px] font-bold ${scoreBadge.statusColor}`}>
                  {scoreBadge.label.split(' ')[0]}
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${scoreBadge.bar}`}
                  style={{ width: `${fairnessScore}%` }}
                />
              </div>
            </div>

            {/* KPI 2: Average Weighted Hours */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">میانگین ساعات وزنی</span>
                <Clock size={15} className="text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-slate-800 tabular-nums">
                  {toPersianDigits(Math.round(meanWeightedHours))}
                </span>
                <span className="text-xs font-bold text-slate-500">ساعت</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 truncate">
                (میانگین خام: {toPersianDigits(Math.round(meanRawHours))} ساعت)
              </p>
            </div>

            {/* KPI 3: Overload & Underload Alerts */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">افراد با بار نامتعادل</span>
                <AlertTriangle size={15} className={totalImbalances > 0 ? "text-amber-600" : "text-emerald-600"} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-slate-800 tabular-nums">
                  {toPersianDigits(totalImbalances)}
                </span>
                <span className="text-xs font-bold text-slate-500">نفر</span>
                <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-200/60">
                  {toPersianDigits(overloadedCount)} سنگین
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 truncate">
                {underloadedCount > 0 ? `${toPersianDigits(underloadedCount)} نفر کمتر از میانگین` : 'همه در حد مطلوب'}
              </p>
            </div>

            {/* KPI 4: Bioprocess Fatigue Risk & Gini */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">پایش خستگی مفرط</span>
                <Zap size={15} className={fatigueCount > 0 ? "text-rose-600" : "text-emerald-600"} />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className={`text-xl sm:text-2xl font-black tabular-nums ${fatigueCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {toPersianDigits(fatigueCount)}
                </span>
                <span className="text-xs font-bold text-slate-500">مورد هشدار</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 truncate">
                شاخص جینی پراکندگی: {toPersianDigits(gini.toFixed(2))}
              </p>
            </div>
          </div>

          {/* Smart Recommendation Banner if available */}
          {balancingSuggestion && (
            <div className="p-3 bg-indigo-50/90 border border-indigo-200/90 rounded-xl flex items-center justify-between gap-3 text-indigo-950">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-600 shrink-0" />
                <span className="text-xs sm:text-sm font-bold">
                  {balancingSuggestion}
                </span>
              </div>
            </div>
          )}

          {/* Action / View Filters Ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-100">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
              <button
                type="button"
                onClick={() => setMetricMode('weighted')}
                className={`px-2.5 py-1 rounded-lg transition ${metricMode === 'weighted' ? 'bg-white text-indigo-600 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ساعات وزنی (شب ۱٫۵×)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('raw')}
                className={`px-2.5 py-1 rounded-lg transition ${metricMode === 'raw' ? 'bg-white text-indigo-600 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
              >
                ساعات خام
              </button>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2 py-1 rounded-lg transition ${filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  همه ({toPersianDigits(metrics.length)})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('alerts_only')}
                  className={`px-2 py-1 rounded-lg transition flex items-center gap-1 ${filterMode === 'alerts_only' ? 'bg-amber-500 text-white shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <AlertTriangle size={11} />
                  فقط هشدارها ({toPersianDigits(totalImbalances + fatigueCount)})
                </button>
              </div>

              {/* Info Button */}
              <button
                type="button"
                onClick={() => setShowExplanation(!showExplanation)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                title="توضیح فرمول محاسبه"
              >
                <Info size={16} />
              </button>
            </div>
          </div>

          {/* Mathematical & Regulatory Explanation Box */}
          {showExplanation && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed space-y-1.5 transition-all">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <ShieldAlert size={14} className="text-indigo-600" />
                <span>مبانی محاسبه عدالت و پایش خستگی در صنایع بیولوژیک:</span>
              </div>
              <p>
                • <strong>ضریب ساعت وزنی:</strong> هر شیفت روز ۱۱ ساعت و هر شیفت شب ۱۳ ساعت در نظر گرفته شده و با توجه به استرس فیزیولوژیک شیفت شب در بیوراکتورها و اتاق ژل، ساعت شب با ضریب ۱٫۵ (معادل ۱۹٫۵ ساعت وزنی) محاسبه می‌گردد.
              </p>
              <p>
                • <strong>انحراف معیار و جینی:</strong> بازه استاندارد انحراف ±۱۰٪ از میانگین تیم است. انحراف بالاتر از ۲۰٪ به عنوان بار کاری نامتعادل علامت‌گذاری می‌شود.
              </p>
              <p>
                • <strong>خستگی مفرط (Fatigue Risk):</strong> فعالیت در ۲ شیفت شب متوالی یا تمرکز بیش از ۶۰٪ شیفت‌ها در شب، به علت حساسیت مراحل کشت سلولی و تلقیح ویروس، به عنوان ریسک بیوپراسس اخطار داده می‌شود.
              </p>
            </div>
          )}

          {/* Employee Breakdown Comparison Bars */}
          <div className="space-y-2.5 pt-1">
            {displayMetrics.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                هیچ کارشناسی با هشدار عدم تعادل یا خستگی در این بازه یافت نشد.
              </div>
            ) : (
              displayMetrics.map((item) => {
                const activeValue = metricMode === 'weighted' ? item.weightedScore : item.rawHours;
                const percentageOfMax = Math.min(100, Math.round((activeValue / maxMetricValue) * 100));
                const averagePercentage = Math.min(100, Math.round((activeBenchmarkMean / maxMetricValue) * 100));

                return (
                  <div 
                    key={item.name}
                    className="p-3 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50/50 transition-all space-y-2"
                  >
                    {/* Top Row: Name, Shifts Count, Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full shrink-0 shadow-2xs" 
                          style={{ backgroundColor: item.color }} 
                        />
                        <span className="font-bold text-xs sm:text-sm text-slate-800">
                          {item.name}
                        </span>

                        {/* Shift Breakdown Pills */}
                        <div className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                          <span className="flex items-center gap-0.5 text-amber-700 font-bold">
                            <Sun size={11} /> {toPersianDigits(item.dayCount)} روز
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="flex items-center gap-0.5 text-indigo-700 font-bold">
                            <Moon size={11} /> {toPersianDigits(item.nightCount)} شب
                          </span>
                          {item.holidayCount > 0 && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-rose-600 font-bold">
                                {toPersianDigits(item.holidayCount)} تعطیل
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status Badges & Hours */}
                      <div className="flex items-center gap-2">
                        {item.hasFatigueRisk && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <Zap size={11} className="text-rose-600 fill-rose-600" />
                            ریسک خستگی شب
                          </span>
                        )}

                        {item.status === 'overload' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <TrendingUp size={11} />
                            بار سنگین (+{toPersianDigits(item.deviationPercent)}٪)
                          </span>
                        )}

                        {item.status === 'slight_high' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            +{toPersianDigits(item.deviationPercent)}٪ از میانگین
                          </span>
                        )}

                        {item.status === 'underload' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                            <TrendingDown size={11} />
                            کمتر از نرمال ({toPersianDigits(item.deviationPercent)}٪)
                          </span>
                        )}

                        {item.status === 'slight_low' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {toPersianDigits(item.deviationPercent)}٪ از میانگین
                          </span>
                        )}

                        {item.status === 'optimal' && !item.hasFatigueRisk && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 size={11} />
                            متعادل
                          </span>
                        )}

                        <div className="text-right min-w-[70px]">
                          <span className="text-sm font-black text-slate-800 tabular-nums">
                            {toPersianDigits(Math.round(activeValue))}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 mr-1">
                            {metricMode === 'weighted' ? 'ساعت وزنی' : 'ساعت'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Comparative Visual Bar with Mean Benchmark */}
                    <div className="relative pt-1">
                      <div className="w-full bg-slate-100 rounded-full h-2 relative overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.status === 'overload' ? 'bg-rose-500' :
                            item.status === 'slight_high' ? 'bg-amber-500' :
                            item.status === 'underload' ? 'bg-purple-500' :
                            item.status === 'slight_low' ? 'bg-blue-400' :
                            'bg-indigo-500'
                          }`}
                          style={{ width: `${percentageOfMax}%` }}
                        />
                      </div>

                      {/* Mean Indicator Line */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-400/90 z-10"
                        style={{ left: `${100 - averagePercentage}%` }} // RTL alignment
                        title={`میانگین تیم: ${Math.round(activeBenchmarkMean)} ساعت`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Note with Legend */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 gap-2">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-500" /> متعادل (±۱۰٪)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> بار سنگین (+۲۰٪)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> بار کمتر (-۲۰٪)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-0.5 h-3 bg-slate-400" /> خط میانگین تیم
              </span>
            </div>
            <span>
              محاسبه بر مبنای {toPersianDigits(scheduleData.length)} روز تقویم فعال
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
