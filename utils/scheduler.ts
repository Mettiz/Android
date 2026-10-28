/**
 * Shift Scheduler & Generation Engine - v1.1.0
 * Includes Constraint-Aware Fair Scheduling & Persian Natural Language Rule Parser
 */
import { ShiftEntry, SHIFT_WEIGHTS, Personnel } from '../types';
import { OFFICIAL_HOLIDAYS, INITIAL_PERSONNEL } from '../constants';
import { getDayNameForJalali } from './persianDate';
import { reconnectPersianSpacedWords } from './customFormatHandler';

export const INITIAL_STAFF: Personnel[] = INITIAL_PERSONNEL;

export const WEEK_DAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

export const PERSIAN_MONTH_MAP: { name: string; code: string }[] = [
  { name: 'فروردین', code: '01' },
  { name: 'اردیبهشت', code: '02' },
  { name: 'خرداد', code: '03' },
  { name: 'تیر', code: '04' },
  { name: 'مرداد', code: '05' },
  { name: 'شهریور', code: '06' },
  { name: 'مهر', code: '07' },
  { name: 'آبان', code: '08' },
  { name: 'آذر', code: '09' },
  { name: 'دی', code: '10' },
  { name: 'بهمن', code: '11' },
  { name: 'اسفند', code: '12' }
];

// Helper to determine days in Persian month
export const getDaysInPersianMonth = (monthCode: string, isLeapYear: boolean = false): number => {
  const monthIndex = parseInt(monthCode, 10);
  if (monthIndex >= 1 && monthIndex <= 6) return 31;
  if (monthIndex >= 7 && monthIndex <= 11) return 30;
  if (monthIndex === 12) return isLeapYear ? 30 : 29;
  return 30;
};

interface StaffStats {
  name: string;
  dayCount: number;
  nightCount: number;
  weightedScore: number;
}

export const generateNextMonth = (
  fullScheduleHistory: ShiftEntry[], 
  nextYear: number,
  nextMonthCode: string, 
  startDayIndex: number, 
  allPersonnel: Personnel[],
  daysInMonth: number
): ShiftEntry[] => {
  const newSchedule: ShiftEntry[] = [];
  let currentDateIdx = 1;
  
  // Filter eligible staff
  const shiftWorkers = allPersonnel.filter(p => p.isActive && p.roles.includes('Shift')).map(p => p.name);
  const supervisors = allPersonnel.filter(p => p.isActive && p.roles.includes('Supervisor')).map(p => p.name);
  
  // --- STEP 0: Calculate Historical Stats ---
  const stats: StaffStats[] = shiftWorkers.map(s => ({ 
    name: s, 
    dayCount: 0, 
    nightCount: 0, 
    weightedScore: 0 
  }));

  fullScheduleHistory.forEach(entry => {
    const dayPersons = [entry.dayShiftPerson, ...(entry.extraDayPersons || [])];
    dayPersons.forEach(dp => {
      const p = stats.find(s => s.name === dp);
      if (p) {
        p.dayCount++;
        p.weightedScore += SHIFT_WEIGHTS.dayHours;
      }
    });

    const nightPersons = [entry.nightShiftPerson, ...(entry.extraNightPersons || [])];
    nightPersons.forEach(np => {
      const p = stats.find(s => s.name === np);
      if (p) {
        p.nightCount++;
        p.weightedScore += (SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier);
      }
    });
  });

  const lastEntry = fullScheduleHistory.length > 0 ? fullScheduleHistory[fullScheduleHistory.length - 1] : null;
  
  let currentOnCallIndex = 0;
  if (lastEntry && supervisors.length > 0) {
    const lastSupIdx = supervisors.indexOf(lastEntry.onCallPerson);
    currentOnCallIndex = (lastSupIdx + 1) % supervisors.length;
  }
  
  let prevNightPerson = lastEntry ? lastEntry.nightShiftPerson : '';

  for (let i = 0; i < daysInMonth; i++) {
    const dayName = getDayNameForJalali(nextYear, parseInt(nextMonthCode, 10), currentDateIdx);
    const isFriday = dayName === 'جمعه';
    const dateStr = `${nextYear}/${nextMonthCode}/${String(currentDateIdx).padStart(2, '0')}`;
    const isHoliday = isFriday || OFFICIAL_HOLIDAYS.includes(dateStr);
    
    if (dayName === 'شنبه' && i > 0 && supervisors.length > 0) {
        currentOnCallIndex = (currentOnCallIndex + 1) % supervisors.length;
    }

    const currentSupervisor = supervisors.length > 0 ? supervisors[currentOnCallIndex] : 'نامشخص';

    // --- STEP 1: Assign Night Shift ---
    const nightCandidates = stats.filter(s => s.name !== prevNightPerson);

    nightCandidates.sort((a, b) => {
      if (a.nightCount !== b.nightCount) return a.nightCount - b.nightCount;
      return a.weightedScore - b.weightedScore;
    });

    const selectedNight = nightCandidates.length > 0 ? nightCandidates[0] : stats[0];
    
    selectedNight.nightCount++;
    selectedNight.weightedScore += (SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier);

    // --- STEP 2: Assign Day Shift ---
    const dayCandidates = stats.filter(s => 
      s.name !== prevNightPerson && 
      s.name !== selectedNight.name
    );

    let nightPersonTwoDaysAgo = '';
    if (i >= 2) {
      nightPersonTwoDaysAgo = newSchedule[i - 2].nightShiftPerson;
    } else if (i === 1 && fullScheduleHistory.length >= 1) {
      nightPersonTwoDaysAgo = fullScheduleHistory[fullScheduleHistory.length - 1].nightShiftPerson;
    } else if (i === 0 && fullScheduleHistory.length >= 2) {
      nightPersonTwoDaysAgo = fullScheduleHistory[fullScheduleHistory.length - 2].nightShiftPerson;
    }

    const twoDaysAgoCandidate = nightPersonTwoDaysAgo ? dayCandidates.find(s => s.name === nightPersonTwoDaysAgo) : null;

    dayCandidates.sort((a, b) => {
      if (a.dayCount !== b.dayCount) return a.dayCount - b.dayCount;
      return a.weightedScore - b.weightedScore;
    });

    const selectedDay = twoDaysAgoCandidate || (dayCandidates.length > 0 ? dayCandidates[0] : stats.find(s => s.name !== selectedNight.name) || stats[0]);

    selectedDay.dayCount++;
    selectedDay.weightedScore += SHIFT_WEIGHTS.dayHours;

    newSchedule.push({
      id: Math.random(),
      dayName,
      date: dateStr,
      dayShiftPerson: selectedDay.name,
      nightShiftPerson: selectedNight.name,
      onCallPerson: currentSupervisor,
      isHoliday: isHoliday 
    });

    prevNightPerson = selectedNight.name;
    currentDateIdx++;
  }

  return newSchedule;
};

export const validateSwap = (
  schedule: ShiftEntry[],
  date: string,
  targetPerson: string,
  shiftType: 'Day' | 'Night'
): { valid: boolean; reason?: string } => {
  const entryIndex = schedule.findIndex(s => s.date === date);
  if (entryIndex === -1) return { valid: false, reason: 'تاریخ یافت نشد.' };

  const currentEntry = schedule[entryIndex];
  const prevEntry = entryIndex > 0 ? schedule[entryIndex - 1] : null;
  const nextEntry = entryIndex < schedule.length - 1 ? schedule[entryIndex + 1] : null;

  const currentNightPersons = [currentEntry.nightShiftPerson, ...(currentEntry.extraNightPersons || [])];
  const currentDayPersons = [currentEntry.dayShiftPerson, ...(currentEntry.extraDayPersons || [])];
  const prevNightPersons = prevEntry ? [prevEntry.nightShiftPerson, ...(prevEntry.extraNightPersons || [])] : [];
  const nextDayPersons = nextEntry ? [nextEntry.dayShiftPerson, ...(nextEntry.extraDayPersons || [])] : [];

  if (shiftType === 'Day') {
    if (currentNightPersons.includes(targetPerson)) {
      return { valid: false, reason: 'این شخص در همین روز شیفت شب دارد.' };
    }
    if (prevNightPersons.includes(targetPerson)) {
      return { valid: false, reason: 'این شخص روز قبل شیفت شب بوده و نیاز به استراحت دارد.' };
    }
  } else {
    if (currentDayPersons.includes(targetPerson)) {
      return { valid: false, reason: 'این شخص در همین روز شیفت روز دارد.' };
    }
    if (prevNightPersons.includes(targetPerson)) {
      return { valid: false, reason: 'این شخص شب قبل شیفت بوده است (توالی شب‌کاری).' };
    }
    if (nextDayPersons.includes(targetPerson)) {
       return { valid: false, reason: 'این شخص فردا شیفت روز دارد و نمی‌تواند امشب شیفت بایستد.' };
    }
  }

  return { valid: true };
};

// ============================================================================
// INTELLIGENT CONSTRAINT-BASED FAIR SCHEDULING ENGINE
// ============================================================================

export type ConstraintType =
  | 'present_on_days'        // حضور روزانه در سر کار (عدم شیفت شب در شب قبل و شب همان روز)
  | 'auxiliary_role'         // نیروی کمکی شیفت شب (حذف از شیفت مستقل اصلی و قرارگیری به عنوان کمکی شیفت شب)
  | 'auxiliary_day_role'     // نیروی کمکی شیفت روز (حذف از شیفت مستقل اصلی و قرارگیری به عنوان کمکی شیفت روز)
  | 'auxiliary_night_on_days'// کمکی شیفت شب در روزهای مشخص هفته (نفر دوم شب)
  | 'auxiliary_day_on_days'  // کمکی شیفت روز در روزهای مشخص هفته (نفر دوم روز)
  | 'no_night_on_days'       // عدم شیفت شب در روزهای مشخص هفته
  | 'no_shift_on_days'       // عدم هیچ‌گونه شیفت (روز یا شب) در روزهای مشخص هفته
  | 'force_day_on_days'      // اولویت/الزام شیفت روز در روزهای مشخص هفته
  | 'force_night_on_days'    // اولویت/الزام شیفت شب در روزهای مشخص هفته
  | 'unavailable_dates';     // مرخصی / عدم حضور در تاریخ‌های مشخص ماه

export interface ShiftConstraintRule {
  id: string;
  personName: string;
  type: ConstraintType;
  weekdays?: string[];
  daysOfMonth?: number[];
  description: string;
}

export interface PersonScheduleSummary {
  name: string;
  dayShifts: number;
  nightShifts: number;
  extraDayShifts?: number;
  extraNightShifts?: number;
  holidayShifts: number;
  weightedHours: number;
  rawShiftHours: number;
  isAuxiliaryOnly?: boolean;
  color?: string;
}

export interface ConstrainedScheduleResult {
  year: number;
  monthCode: string;
  monthName: string;
  schedule: ShiftEntry[];
  constraints: ShiftConstraintRule[];
  constraintReports: {
    rule: ShiftConstraintRule;
    satisfied: boolean;
    details: string;
  }[];
  fairnessScore: number;
  personSummaries: PersonScheduleSummary[];
  appliedEdits?: string[];
}

// Normalize Persian/Arabic characters and spacing for fuzzy matching
export const normalizePersianText = (str: string): string => {
  const reconnected = reconnectPersianSpacedWords(str || '');
  return reconnected
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim();
};

// Resolve partial or colloquial name (e.g. "سلیمان فلاح", "فلاح", "دهقان") to exact Personnel.name
export const resolvePersonnelName = (inputName: string, allPersonnel: Personnel[]): string | null => {
  const normInput = normalizePersianText(inputName)
    .replace(/^(مهندس|آقای|خانم|دکتر|کارشناس)\s+/g, '')
    .trim();
  if (!normInput) return null;

  // 1. Exact or stripped match
  for (const p of allPersonnel) {
    const normFull = normalizePersianText(p.name);
    const normStripped = normFull.replace(/^(مهندس|آقای|خانم|دکتر|کارشناس)\s+/g, '').trim();
    if (normFull === normInput || normStripped === normInput) {
      return p.name;
    }
  }

  // 2. Substring match (e.g., "فلاح" -> "مهندس سلیمان فلاح", "سپهر" -> "مهندس سپهر آرا")
  for (const p of allPersonnel) {
    const normFull = normalizePersianText(p.name);
    const normStripped = normFull.replace(/^(مهندس|آقای|خانم|دکتر|کارشناس)\s+/g, '').trim();
    if (normStripped.includes(normInput) || normInput.includes(normStripped)) {
      return p.name;
    }
  }

  return null;
};

// Extract canonical Persian weekdays from a text snippet without false 'شنبه' substring matches
export const extractWeekdaysFromText = (snippet: string): string[] => {
  let working = normalizePersianText(snippet);
  const found: string[] = [];

  const multiDayPatterns: { canonical: string; regex: RegExp }[] = [
    { canonical: 'یک‌شنبه', regex: /(یک\s*شنبه|یکشنبه|1\s*شنبه)/g },
    { canonical: 'دوشنبه', regex: /(دو\s*شنبه|دوشنبه|2\s*شنبه)/g },
    { canonical: 'سه‌شنبه', regex: /(سه\s*شنبه|سهشنبه|3\s*شنبه)/g },
    { canonical: 'چهارشنبه', regex: /(چهار\s*شنبه|چهارشنبه|4\s*شنبه)/g },
    { canonical: 'پنج‌شنبه', regex: /(پنج\s*شنبه|پنجشنبه|5\s*شنبه)/g },
    { canonical: 'جمعه', regex: /(جمعه|جمع\s+شب)/g },
  ];

  for (const item of multiDayPatterns) {
    if (item.regex.test(working)) {
      found.push(item.canonical);
      working = working.replace(item.regex, ' ___ ');
    }
  }

  // Now check standalone 'شنبه'
  if (/شنبه/.test(working)) {
    found.unshift('شنبه');
  }

  return Array.from(new Set(found));
};

export const buildConstraintDescription = (rule: Omit<ShiftConstraintRule, 'id' | 'description'>): string => {
  const isAllDays = !rule.weekdays || rule.weekdays.length === 0 || rule.weekdays.length === 7;
  const daysText = isAllDays ? 'طول ماه (توزیع متوازن)' : (rule.weekdays || []).join('، ');
  switch (rule.type) {
    case 'present_on_days': {
      const prevDays = (rule.weekdays || []).map(w => {
        const idx = WEEK_DAYS.indexOf(w);
        return idx !== -1 ? WEEK_DAYS[(idx + 6) % 7] : '';
      }).filter(Boolean);
      const blockedNightsText = Array.from(new Set([...prevDays.map(d => `${d} شب`), ...(rule.weekdays || []).map(d => `${d} شب`)])).join(' و ');
      return `حضور روزانه ${rule.personName} در روزهای ${daysText} (عدم شیفت در ${blockedNightsText})`;
    }
    case 'auxiliary_role':
      return `نیروی کمکی شیفت شب (بدون شیفت مستقل اصلی): ${rule.personName} در ${daysText}`;
    case 'auxiliary_day_role':
      return `نیروی کمکی شیفت روز (بدون شیفت مستقل اصلی): ${rule.personName} در ${daysText}`;
    case 'auxiliary_night_on_days':
      return `کمکی شیفت شب (نفر دوم شب) برای ${rule.personName} در روزهای ${daysText}`;
    case 'auxiliary_day_on_days':
      return `کمکی شیفت روز (نفر دوم روز) برای ${rule.personName} در روزهای ${daysText}`;
    case 'no_night_on_days':
      return `عدم شیفت شب برای ${rule.personName} در روزهای ${daysText}`;
    case 'no_shift_on_days':
      return `عدم هرگونه شیفت (روز و شب) برای ${rule.personName} در روزهای ${daysText}`;
    case 'force_day_on_days':
      return `اولویت شیفت روز برای ${rule.personName} در روزهای ${daysText}`;
    case 'force_night_on_days':
      return `اولویت شیفت شب برای ${rule.personName} در روزهای ${daysText}`;
    case 'unavailable_dates':
      return `مرخصی / عدم شیفت برای ${rule.personName} در روزهای ${(rule.daysOfMonth || []).join('، ')} ماه`;
  }
};

// Parse natural language Persian request into target month/year and structured constraints
export const parsePersianShiftRequest = (
  text: string,
  allPersonnel: Personnel[],
  defaultYear: number,
  defaultMonthCode: string
): {
  isSchedulingIntent: boolean;
  hasExplicitMonth: boolean;
  targetYear: number;
  targetMonthCode: string;
  targetMonthName: string;
  constraints: ShiftConstraintRule[];
} => {
  const normText = normalizePersianText(text);

  // Detect scheduling keywords
  const hasScheduleVerb = /(بچین|چیدمان|چیدن|برنامه ریزی|برنامه شیفت|شیفت.*بچین|تنظیم کن|ببند|تولید کن|بساز|اماده کن|آرایش|شیفت های ماه|حضور داشته|حضور روزانه|شیفت نباشه|شیفت نباشد|عدم شیفت|سرکار باشه|سر کار باشه|کمکی باشه|کمکی باشد|کمکی بذار|کمکی بذاره|نفر کمکی|استفاده کنیم)/.test(normText);

  // Detect target month
  let targetMonthCode = defaultMonthCode || '08';
  let targetYear = defaultYear || 1405;
  let hasExplicitMonth = false;

  const yearMatch = normText.match(/\b(140[4-9]|141\d)\b/);
  if (yearMatch) {
    targetYear = parseInt(yearMatch[1], 10);
  }

  for (const m of PERSIAN_MONTH_MAP) {
    const mNorm = normalizePersianText(m.name);
    const regex = m.code === '10'
      ? new RegExp(`(^|\\s|ماه|شیفت)\\s*${mNorm}(\\s|ماه|رو|را|،|\\.|$)`)
      : new RegExp(`(^|\\s|ماه|شیفت|در|برای)\\s*${mNorm}(\\s|ماه|رو|را|،|\\.|$)`);
    if (regex.test(normText)) {
      targetMonthCode = m.code;
      hasExplicitMonth = true;
      break;
    }
  }

  if (normText.includes('ماه بعد') || normText.includes('ماه اینده') || normText.includes('ماه آینده')) {
    let mNum = parseInt(defaultMonthCode, 10) + 1;
    if (mNum > 12) {
      mNum = 1;
      targetYear = defaultYear + 1;
    }
    targetMonthCode = String(mNum).padStart(2, '0');
    hasExplicitMonth = true;
  }

  const targetMonthName = PERSIAN_MONTH_MAP.find(m => m.code === targetMonthCode)?.name || 'آبان';

  const activeShiftPersonnel = allPersonnel.filter(
    p => p.isActive && (p.roles.includes('Shift') || p.roles.includes('Supervisor'))
  );

  // Helper to find personnel mentions in any normalized snippet, ordered by position
  const findPersonnelInSnippet = (snippet: string): { personName: string; index: number; matchedToken: string }[] => {
    const found: { personName: string; index: number; matchedToken: string }[] = [];
    for (const p of activeShiftPersonnel) {
      const fullNorm = normalizePersianText(p.name);
      const strippedNorm = fullNorm.replace(/^(مهندس|آقای|خانم|دکتر|کارشناس)\s+/g, '').trim();
      const parts = strippedNorm.split(' ').filter(t => t.length >= 3);
      const candidateTokens = Array.from(new Set([fullNorm, strippedNorm, ...parts])).sort((a, b) => b.length - a.length);

      let earliestIdx = -1;
      let bestToken = '';
      for (const token of candidateTokens) {
        const idx = snippet.indexOf(token);
        if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
          earliestIdx = idx;
          bestToken = token;
        }
      }
      if (earliestIdx !== -1) {
        found.push({ personName: p.name, index: earliestIdx, matchedToken: bestToken });
      }
    }
    return found.sort((a, b) => a.index - b.index);
  };

  // 1. Split raw text by line breaks, periods, semicolons, and bullet markers
  const rawLines = (text || '')
    .split(/[\r\n.;؛•]+/)
    .map(l => normalizePersianText(l))
    .filter(Boolean);

  // 2. Further split each line into logical sub-clauses while keeping weekday lists (e.g. "یک‌شنبه، دوشنبه، سه‌شنبه") intact
  const subClauses: { text: string; lineIndex: number }[] = [];
  const weekdayStartRegex = /^(?:و\s*)?(?:روزهای\s+|روز\s+)?(?:شنبه|یک\s*شنبه|یکشنبه|1\s*شنبه|دو\s*شنبه|دوشنبه|2\s*شنبه|سه\s*شنبه|سهشنبه|3\s*شنبه|چهار\s*شنبه|چهارشنبه|4\s*شنبه|پنج\s*شنبه|پنجشنبه|5\s*شنبه|جمعه)/;

  rawLines.forEach((line, lineIndex) => {
    // Strip parenthetical explanations like "(عدم شیفت در جمعه شب و شنبه شب)" or "(یعنی ...)" if the main part already has weekdays
    const withoutParen = line.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    const baseLine = extractWeekdaysFromText(withoutParen).length > 0 ? withoutParen : line;

    // First split after clause-ending verbs followed by comma or "و"
    const verbSplit = baseLine.split(
      /(?<=\b(?:باشه|باشد|باشن|باشند|بذاره|بذار|بگذاره|بگذار|نداره|نباشه|نباشد|کنیم|کنید|کن|بیاد|بره|بشه|شود))\s*(?:،|,|\s+و\s+)\s*/g
    );

    for (const chunk of verbSplit) {
      if (!chunk.trim()) continue;
      // Check commas inside chunk: split on comma ONLY if the next part does NOT start with a weekday
      const commaParts = chunk.split(/\s*[،,]\s*/);
      let currentAcc = commaParts[0] || '';
      for (let cIdx = 1; cIdx < commaParts.length; cIdx++) {
        const nextPart = commaParts[cIdx].trim();
        if (!nextPart) continue;
        const currHasConditionOrVerb = /(کمکی|حضور|شیفت|نباشه|نباشد|عدم|بذاره|بذار|باشه|باشد|استفاده|مرخصی|معاف)/.test(currentAcc);
        if (currHasConditionOrVerb && !weekdayStartRegex.test(nextPart)) {
          subClauses.push({ text: currentAcc.trim(), lineIndex });
          currentAcc = nextPart;
        } else {
          currentAcc = `${currentAcc}، ${nextPart}`;
        }
      }
      if (currentAcc.trim()) {
        subClauses.push({ text: currentAcc.trim(), lineIndex });
      }
    }
  });

  const rawConstraints: ShiftConstraintRule[] = [];
  let lastSubjectNames: string[] = [];
  let lastLineIdx = -1;
  let lastClauseWeekdays: string[] = [];
  let lastClauseHasNight = false;
  let lastClauseHasDay = false;

  for (let sIdx = 0; sIdx < subClauses.length; sIdx++) {
    const { text: clause, lineIndex } = subClauses[sIdx];
    const mentions = findPersonnelInSnippet(clause);

    // If a single clause has multiple people WITH weekdays between them (e.g. "فلاح شنبه‌ها و دهقان دوشنبه‌ها حضور داشته باشه"),
    // split into sub-segments per person while sharing the trailing predicate
    if (mentions.length >= 2) {
      const betweenFirstAndSecond = clause.slice(mentions[0].index, mentions[1].index);
      if (extractWeekdaysFromText(betweenFirstAndSecond).length > 0) {
        for (let mIdx = 0; mIdx < mentions.length; mIdx++) {
          const start = mIdx === 0 ? 0 : mentions[mIdx].index;
          const end = mIdx < mentions.length - 1 ? mentions[mIdx + 1].index : clause.length;
          const seg = clause.slice(start, end) + ' ' + clause.slice(mentions[mentions.length - 1].index);
          subClauses.splice(sIdx + 1 + mIdx, 0, { text: seg, lineIndex });
        }
        continue;
      }
    }

    const mainStatement = clause.split(/(\(|یعنی)/)[0] || clause;
    const directWeekdays = extractWeekdaysFromText(mainStatement);
    const directHasNight = /(شیفتای شب|شیفت های شب|شیفت شب|شب ها|شبها|شب های|\bشب\b)/.test(mainStatement);
    const directHasDay = /(شیفتای روز|شیفت های روز|شیفت روز|روزکار|کمکی روز)/.test(mainStatement);

    if (directWeekdays.length > 0) {
      lastClauseWeekdays = directWeekdays;
      lastClauseHasNight = directHasNight;
      lastClauseHasDay = directHasDay;
      lastLineIdx = lineIndex;
    }

    let targetPeople: string[] = [];
    if (mentions.length > 0) {
      targetPeople = mentions.map(m => m.personName);
      lastSubjectNames = targetPeople;
      lastLineIdx = lineIndex;
    } else if (lastSubjectNames.length > 0 && (lineIndex === lastLineIdx || /(ازش|او|ایشان|همون|ایشون)/.test(clause))) {
      targetPeople = [...lastSubjectNames];
    }

    if (targetPeople.length === 0) continue;

    const effectiveWeekdays =
      directWeekdays.length > 0
        ? directWeekdays
        : lineIndex === lastLineIdx && lastClauseWeekdays.length > 0
          ? lastClauseWeekdays
          : [];

    // Check if the person is preceded by an exclusion phrase like "غیر از سلیمان فلاح" / "به جز ..."
    const hasExclusionPhrase = /(غیر\s*از|به\s*غیر\s*از|بغیر\s*از|به\s*جز|بجز|سوای|منهای)/.test(mainStatement);

    const hasAuxiliaryKeyword = /(کمکی|نفر دوم|همیار)/.test(mainStatement);
    const hasPresenceKeyword = /(حضور روزانه|حضور داشته|روزها حضور|روز حضور|حضور در|سرکار|سر کار|در شرکت|در کارخانه|حضور پیدا)/.test(mainStatement);
    const hasNegation =
      hasExclusionPhrase ||
      /(عدم|ممنوع|نباشه|نباشد|نباشن|نباشند|نداره|ندارد|نداشته|نذار|نگذار|معاف|مرخصی)/.test(mainStatement);
    const hasNightKeyword = directHasNight || (directWeekdays.length === 0 && lineIndex === lastLineIdx && lastClauseHasNight);
    const hasDayShiftKeyword = directHasDay || (directWeekdays.length === 0 && lineIndex === lastLineIdx && lastClauseHasDay);
    const hasPositiveUsageInNight =
      hasNightKeyword &&
      !hasNegation &&
      !hasAuxiliaryKeyword &&
      /(میتونیم ازش استفاده|می توانیم ازش استفاده|استفاده کنیم|استفاده شود|استفاده بشه|میتونه باشه|می تونه باشه|فقط.*شب)/.test(mainStatement);

    // Check for day-of-month numbers like "از 5 تا 8"
    const rangeMatch = mainStatement.match(/از\s*(\d{1,2})\s*تا\s*(\d{1,2})/);
    if (rangeMatch && hasNegation) {
      const startDay = parseInt(rangeMatch[1], 10);
      const endDay = parseInt(rangeMatch[2], 10);
      if (startDay >= 1 && endDay <= 31 && startDay <= endDay) {
        const days: number[] = [];
        for (let d = startDay; d <= endDay; d++) days.push(d);
        for (const personName of targetPeople) {
          const ruleBase = {
            personName,
            type: 'unavailable_dates' as ConstraintType,
            daysOfMonth: days
          };
          rawConstraints.push({
            ...ruleBase,
            id: `rule-${Date.now()}-${sIdx}-${personName}`,
            description: buildConstraintDescription(ruleBase)
          });
        }
        continue;
      }
    }

    // 1. Auxiliary / Helper role
    if (hasAuxiliaryKeyword) {
      const isSpecificDays = effectiveWeekdays.length > 0 && effectiveWeekdays.length < 6 && !/(کل ماه|همه روزها|تمام روزها)/.test(mainStatement);
      let auxType: ConstraintType = 'auxiliary_role';
      if (hasDayShiftKeyword) {
        auxType = isSpecificDays ? 'auxiliary_day_on_days' : 'auxiliary_day_role';
      } else {
        auxType = isSpecificDays ? 'auxiliary_night_on_days' : 'auxiliary_role';
      }
      for (const personName of targetPeople) {
        const ruleBase = {
          personName,
          type: auxType,
          weekdays: effectiveWeekdays.length > 0 ? effectiveWeekdays : [...WEEK_DAYS]
        };
        rawConstraints.push({
          ...ruleBase,
          id: `rule-${Date.now()}-${sIdx}-${personName}`,
          description: buildConstraintDescription(ruleBase)
        });
      }
      continue;
    }

    if (effectiveWeekdays.length === 0) continue;

    // 2. Positive night shift eligibility on specific days (e.g. "تو شیفتای شب پنجشنبه و جمعه و شنبه هم میتونیم ازش استفاده کنیم")
    // This means primary night shifts are ONLY allowed on `effectiveWeekdays`, so the remaining weekdays (excluding any helper night days) are `no_night_on_days`
    if (hasPositiveUsageInNight && effectiveWeekdays.length < 7) {
      for (const personName of targetPeople) {
        const existingHelperDays = rawConstraints
          .filter(c => c.personName === personName && (c.type === 'auxiliary_night_on_days' || c.type === 'auxiliary_role'))
          .flatMap(c => c.weekdays || []);
        const blockedNights = WEEK_DAYS.filter(
          d => !effectiveWeekdays.includes(d) && !existingHelperDays.includes(d)
        );
        if (blockedNights.length > 0) {
          const ruleBase = {
            personName,
            type: 'no_night_on_days' as ConstraintType,
            weekdays: blockedNights
          };
          rawConstraints.push({
            ...ruleBase,
            id: `rule-${Date.now()}-${sIdx}-${personName}`,
            description: buildConstraintDescription(ruleBase)
          });
        }
      }
      continue;
    }

    // 3. Standard constraint classification
    let ruleType: ConstraintType = 'present_on_days';
    if (hasPresenceKeyword && !hasNegation) {
      ruleType = 'present_on_days';
    } else if (hasNegation && hasNightKeyword) {
      ruleType = 'no_night_on_days';
    } else if (hasNegation) {
      ruleType = 'no_shift_on_days';
    } else if (hasNightKeyword) {
      ruleType = 'force_night_on_days';
    } else if (hasDayShiftKeyword) {
      ruleType = 'force_day_on_days';
    } else {
      ruleType = 'present_on_days';
    }

    for (const personName of targetPeople) {
      const ruleBase = {
        personName,
        type: ruleType,
        weekdays: effectiveWeekdays
      };
      rawConstraints.push({
        ...ruleBase,
        id: `rule-${Date.now()}-${sIdx}-${personName}`,
        description: buildConstraintDescription(ruleBase)
      });
    }
  }

  // Deduplicate and merge rules of the same (personName, type) within the same message
  const constraints: ShiftConstraintRule[] = [];
  for (const r of rawConstraints) {
    const existingIdx = constraints.findIndex(c => c.personName === r.personName && c.type === r.type);
    if (existingIdx !== -1 && r.weekdays && constraints[existingIdx].weekdays) {
      const mergedDays = WEEK_DAYS.filter(
        d => constraints[existingIdx].weekdays!.includes(d) || r.weekdays!.includes(d)
      );
      const updatedBase = {
        personName: r.personName,
        type: r.type,
        weekdays: mergedDays
      };
      constraints[existingIdx] = {
        ...constraints[existingIdx],
        weekdays: mergedDays,
        description: buildConstraintDescription(updatedBase)
      };
    } else {
      constraints.push(r);
    }
  }

  // If a person has `auxiliary_night_on_days` on day X (e.g. سه‌شنبه) AND `no_night_on_days` that also lists day X,
  // keep day X in `auxiliary_night_on_days` (which already blocks primary night shift on day X) so descriptions stay clean
  for (const c of constraints) {
    if (c.type === 'no_night_on_days' && c.weekdays) {
      const helperDays = constraints
        .filter(other => other.personName === c.personName && other.type === 'auxiliary_night_on_days')
        .flatMap(other => other.weekdays || []);
      if (helperDays.length > 0) {
        const cleaned = c.weekdays.filter(d => !helperDays.includes(d));
        if (cleaned.length > 0 && cleaned.length !== c.weekdays.length) {
          c.weekdays = cleaned;
          c.description = buildConstraintDescription({
            personName: c.personName,
            type: c.type,
            weekdays: cleaned
          });
        }
      }
    }
  }

  return {
    isSchedulingIntent: hasScheduleVerb || constraints.length > 0,
    hasExplicitMonth,
    targetYear,
    targetMonthCode,
    targetMonthName,
    constraints
  };
};

// Generate a complete month schedule honoring all constraints and optimizing fairness
export const generateConstrainedMonth = (
  fullScheduleHistory: ShiftEntry[],
  targetYear: number,
  targetMonthCode: string,
  allPersonnel: Personnel[],
  constraints: ShiftConstraintRule[]
): ConstrainedScheduleResult => {
  const isLeap = targetYear === 1403 || targetYear === 1408;
  const daysInMonth = getDaysInPersianMonth(targetMonthCode, isLeap);
  const monthPrefix = `${targetYear}/${targetMonthCode}`;
  const monthName = PERSIAN_MONTH_MAP.find(m => m.code === targetMonthCode)?.name || targetMonthCode;

  // All active shift staff
  const allShiftWorkers = allPersonnel.filter(p => p.isActive && p.roles.includes('Shift')).map(p => p.name);
  const supervisors = allPersonnel.filter(p => p.isActive && p.roles.includes('Supervisor')).map(p => p.name);

  // Workers marked as `auxiliary_role`, `auxiliary_day_role`, or full-month `no_shift_on_days` are excluded from solo primary shifts
  const auxiliaryOnlySet = new Set(
    constraints
      .filter(
        c =>
          c.type === 'auxiliary_role' ||
          c.type === 'auxiliary_day_role' ||
          (c.type === 'no_shift_on_days' && (c.weekdays?.length || 0) >= 7)
      )
      .map(c => c.personName)
  );
  const nonAuxWorkers = allShiftWorkers.filter(w => !auxiliaryOnlySet.has(w));
  const shiftWorkers = nonAuxWorkers.length >= 2 ? nonAuxWorkers : allShiftWorkers;

  // Prior history before this month for boundary continuity & tie-breaking
  const priorHistory = fullScheduleHistory
    .filter(s => s.date < `${monthPrefix}/01`)
    .sort((a, b) => a.date.localeCompare(b.date));

  const histWeighted: Record<string, number> = {};
  allShiftWorkers.forEach(w => { histWeighted[w] = 0; });
  priorHistory.forEach(entry => {
    if (histWeighted[entry.dayShiftPerson] !== undefined) {
      histWeighted[entry.dayShiftPerson] += SHIFT_WEIGHTS.dayHours;
    }
    if (histWeighted[entry.nightShiftPerson] !== undefined) {
      histWeighted[entry.nightShiftPerson] += SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier;
    }
  });

  // Precompute metadata for each day of the target month
  const monthDaysMeta = Array.from({ length: daysInMonth }, (_, idx) => {
    const dayNum = idx + 1;
    const dateStr = `${targetYear}/${targetMonthCode}/${String(dayNum).padStart(2, '0')}`;
    const dayName = getDayNameForJalali(targetYear, parseInt(targetMonthCode, 10), dayNum);
    const dayOfWeekIdx = WEEK_DAYS.indexOf(dayName);
    const prevDayName = idx > 0
      ? getDayNameForJalali(targetYear, parseInt(targetMonthCode, 10), dayNum - 1)
      : WEEK_DAYS[(dayOfWeekIdx + 6) % 7];
    const nextDayName = idx < daysInMonth - 1
      ? getDayNameForJalali(targetYear, parseInt(targetMonthCode, 10), dayNum + 1)
      : WEEK_DAYS[(dayOfWeekIdx + 1) % 7];
    const twoDaysLaterName = idx < daysInMonth - 2
      ? getDayNameForJalali(targetYear, parseInt(targetMonthCode, 10), dayNum + 2)
      : WEEK_DAYS[(dayOfWeekIdx + 2) % 7];
    const threeDaysLaterName = idx < daysInMonth - 3
      ? getDayNameForJalali(targetYear, parseInt(targetMonthCode, 10), dayNum + 3)
      : WEEK_DAYS[(dayOfWeekIdx + 3) % 7];
    const isHoliday = dayName === 'جمعه' || OFFICIAL_HOLIDAYS.includes(dateStr);
    return { idx, dayNum, dateStr, dayName, prevDayName, nextDayName, twoDaysLaterName, threeDaysLaterName, isHoliday };
  });

  const isAllowedNightByConstraints = (person: string, dayIdx: number): boolean => {
    if (auxiliaryOnlySet.has(person)) return false;
    const meta = monthDaysMeta[dayIdx];
    const personRules = constraints.filter(c => c.personName === person);

    for (const rule of personRules) {
      if (rule.type === 'present_on_days' && rule.weekdays) {
        if (rule.weekdays.includes(meta.dayName) || rule.weekdays.includes(meta.nextDayName)) {
          return false;
        }
      }
      if (rule.type === 'no_night_on_days' && rule.weekdays) {
        if (rule.weekdays.includes(meta.dayName)) {
          return false;
        }
      }
      if (rule.type === 'no_shift_on_days' && rule.weekdays) {
        if (rule.weekdays.includes(meta.dayName)) {
          return false;
        }
      }
      if (rule.type === 'auxiliary_night_on_days' && rule.weekdays) {
        // Reserved for helper night shift on `rule.weekdays`:
        // Cannot take primary night shift on that day, the night before, the night after, or 2 days before (which would assign primary day shift on the helper day)
        if (
          rule.weekdays.includes(meta.dayName) ||
          rule.weekdays.includes(meta.nextDayName) ||
          rule.weekdays.includes(meta.prevDayName) ||
          rule.weekdays.includes(meta.twoDaysLaterName)
        ) {
          return false;
        }
      }
      if (rule.type === 'force_day_on_days' && rule.weekdays) {
        if (rule.weekdays.includes(meta.dayName) || rule.weekdays.includes(meta.nextDayName)) {
          return false;
        }
      }
      if (rule.type === 'unavailable_dates' && rule.daysOfMonth) {
        if (rule.daysOfMonth.includes(meta.dayNum) || rule.daysOfMonth.includes(meta.dayNum + 1)) {
          return false;
        }
      }
    }
    return true;
  };

  const isAllowedDayByConstraints = (person: string, dayIdx: number): boolean => {
    if (auxiliaryOnlySet.has(person)) return false;
    const meta = monthDaysMeta[dayIdx];
    const personRules = constraints.filter(c => c.personName === person);

    for (const rule of personRules) {
      if (rule.type === 'no_shift_on_days' && rule.weekdays) {
        if (rule.weekdays.includes(meta.dayName)) {
          return false;
        }
      }
      if (rule.type === 'auxiliary_night_on_days' && rule.weekdays) {
        // Cannot take primary day shift on the day of helper night shift or the rest day immediately after it
        if (rule.weekdays.includes(meta.dayName) || rule.weekdays.includes(meta.prevDayName)) {
          return false;
        }
      }
      if (rule.type === 'unavailable_dates' && rule.daysOfMonth) {
        if (rule.daysOfMonth.includes(meta.dayNum)) {
          return false;
        }
      }
    }
    return true;
  };

  const blockedNightsPerWorker: Record<string, number> = {};
  shiftWorkers.forEach(w => {
    let blocked = 0;
    for (let d = 0; d < daysInMonth; d++) {
      if (!isAllowedNightByConstraints(w, d)) blocked++;
    }
    blockedNightsPerWorker[w] = blocked;
  });

  interface MonthWorkerStat {
    name: string;
    dayCount: number;
    nightCount: number;
    holidayCount: number;
    weightedScore: number;
    weekdayNightCounts: Record<string, number>;
  }

  const createEmptyWeekdayCounts = (): Record<string, number> => {
    const map: Record<string, number> = {};
    WEEK_DAYS.forEach(d => { map[d] = 0; });
    return map;
  };

  const stats: MonthWorkerStat[] = shiftWorkers.map(w => ({
    name: w,
    dayCount: 0,
    nightCount: 0,
    holidayCount: 0,
    weightedScore: 0,
    weekdayNightCounts: createEmptyWeekdayCounts()
  }));

  const lastEntry = priorHistory.length > 0 ? priorHistory[priorHistory.length - 1] : null;
  let currentOnCallIndex = 0;
  if (lastEntry && supervisors.length > 0) {
    const lastSupIdx = supervisors.indexOf(lastEntry.onCallPerson);
    if (lastSupIdx !== -1) {
      currentOnCallIndex = lastSupIdx;
    }
  }

  let prevNightPerson = lastEntry ? lastEntry.nightShiftPerson : '';
  const newSchedule: ShiftEntry[] = [];

  for (let i = 0; i < daysInMonth; i++) {
    const meta = monthDaysMeta[i];

    if (meta.dayName === 'شنبه' && i > 0 && supervisors.length > 0) {
      currentOnCallIndex = (currentOnCallIndex + 1) % supervisors.length;
    }
    const currentSupervisor = supervisors.length > 0 ? supervisors[currentOnCallIndex] : 'نامشخص';

    // Determine who worked Night shift 2 days ago (since they automatically get today's Day shift!)
    let nightPersonTwoDaysAgo = '';
    if (i >= 2) {
      nightPersonTwoDaysAgo = newSchedule[i - 2].nightShiftPerson;
    } else if (i === 1 && priorHistory.length >= 1) {
      nightPersonTwoDaysAgo = priorHistory[priorHistory.length - 1].nightShiftPerson;
    } else if (i === 0 && priorHistory.length >= 2) {
      nightPersonTwoDaysAgo = priorHistory[priorHistory.length - 2].nightShiftPerson;
    }

    // --- STEP 1: Choose Primary Night Shift Person ---
    // Exclude `prevNightPerson` (yesterday's night shift) and `nightPersonTwoDaysAgo` (who is working today's Day shift!)
    let nightCandidates = stats.filter(
      s =>
        s.name !== prevNightPerson &&
        s.name !== nightPersonTwoDaysAgo &&
        isAllowedNightByConstraints(s.name, i)
    );

    if (nightCandidates.length === 0) {
      nightCandidates = stats.filter(
        s => s.name !== prevNightPerson && isAllowedNightByConstraints(s.name, i)
      );
    }
    if (nightCandidates.length === 0) {
      nightCandidates = stats.filter(s => s.name !== prevNightPerson);
    }

    const minMonthlyNights = Math.floor(daysInMonth / Math.max(1, shiftWorkers.length));
    const targetMonthlyNights = Math.ceil(daysInMonth / Math.max(1, shiftWorkers.length));

    const forcedNightCandidate = nightCandidates.find(s =>
      constraints.some(
        c =>
          c.personName === s.name &&
          c.type === 'force_night_on_days' &&
          c.weekdays?.includes(meta.dayName)
      )
    );

    // Check if any candidate has an explicit `force_day_on_days` 2 days later (`meta.twoDaysLaterName`)
    const wantsDayInTwoDays = (personName: string): boolean => {
      return constraints.some(
        c =>
          c.personName === personName &&
          c.type === 'force_day_on_days' &&
          c.weekdays?.includes(meta.twoDaysLaterName)
      );
    };

    const shouldSaveForUpcomingNight = (personName: string): boolean => {
      for (const offset of [1, 2]) {
        if (i + offset >= daysInMonth) continue;
        if (!isAllowedNightByConstraints(personName, i + offset)) continue;
        const futureTwoDaysLater = monthDaysMeta[i + offset].twoDaysLaterName;
        const matchesTarget = constraints.some(
          c =>
            c.personName === personName &&
            c.type === 'force_day_on_days' &&
            c.weekdays?.includes(futureTwoDaysLater)
        );
        if (matchesTarget) return true;
      }
      return false;
    };

    nightCandidates.sort((a, b) => {
      // 1. Save candidate for upcoming night if that night gives them their explicit `force_day_on_days`
      const aSaveUpcoming = shouldSaveForUpcomingNight(a.name) ? 1 : 0;
      const bSaveUpcoming = shouldSaveForUpcomingNight(b.name) ? 1 : 0;
      if (aSaveUpcoming !== bSaveUpcoming) return aSaveUpcoming - bSaveUpcoming;

      // 2. Prioritize candidate whose 2-days-later Day shift matches explicit `force_day_on_days`
      const aWantsTwoDays = wantsDayInTwoDays(a.name) && a.nightCount < targetMonthlyNights ? 1 : 0;
      const bWantsTwoDays = wantsDayInTwoDays(b.name) && b.nightCount < targetMonthlyNights ? 1 : 0;
      if (aWantsTwoDays !== bWantsTwoDays) return bWantsTwoDays - aWantsTwoDays;

      // 3. Heavily restricted workers (blocked >= 12 nights/month, like Rahimi, Akbari, Heidari) take priority until they reach `minMonthlyNights`,
      // and ONLY if they haven't already worked this specific weekday (`weekdayNightCounts[meta.dayName] === 0`) when others haven't
      const aHeavilyRestricted =
        (blockedNightsPerWorker[a.name] || 0) >= 12 &&
        a.nightCount < minMonthlyNights &&
        (a.weekdayNightCounts[meta.dayName] || 0) === 0
          ? 1
          : 0;
      const bHeavilyRestricted =
        (blockedNightsPerWorker[b.name] || 0) >= 12 &&
        b.nightCount < minMonthlyNights &&
        (b.weekdayNightCounts[meta.dayName] || 0) === 0
          ? 1
          : 0;
      if (aHeavilyRestricted !== bHeavilyRestricted) return bHeavilyRestricted - aHeavilyRestricted;

      // 4. Weekday diversity: prefer candidate who has worked fewer nights on THIS specific weekday (`meta.dayName`)
      const aWeekdayCount = a.weekdayNightCounts[meta.dayName] || 0;
      const bWeekdayCount = b.weekdayNightCounts[meta.dayName] || 0;
      if (aWeekdayCount !== bWeekdayCount) return aWeekdayCount - bWeekdayCount;

      // 5. Heavily restricted workers still below `minMonthlyNights`
      const aRestrBelowMin = (blockedNightsPerWorker[a.name] || 0) >= 12 && a.nightCount < minMonthlyNights ? 1 : 0;
      const bRestrBelowMin = (blockedNightsPerWorker[b.name] || 0) >= 12 && b.nightCount < minMonthlyNights ? 1 : 0;
      if (aRestrBelowMin !== bRestrBelowMin) return bRestrBelowMin - aRestrBelowMin;

      // 6. Balance total night count
      if (a.nightCount !== b.nightCount) return a.nightCount - b.nightCount;

      // 7. Holiday balance
      if (meta.isHoliday && a.holidayCount !== b.holidayCount) {
        return a.holidayCount - b.holidayCount;
      }

      // 8. Prefer candidate who is allowed on Day shift 2 days later
      if (i + 2 < daysInMonth) {
        const aCanDay2 = isAllowedDayByConstraints(a.name, i + 2) ? 1 : 0;
        const bCanDay2 = isAllowedDayByConstraints(b.name, i + 2) ? 1 : 0;
        if (aCanDay2 !== bCanDay2) return bCanDay2 - aCanDay2;
      }

      // 9. Prefer worker with more blocked nights
      const aBlocked = blockedNightsPerWorker[a.name] || 0;
      const bBlocked = blockedNightsPerWorker[b.name] || 0;
      if (aBlocked !== bBlocked) return bBlocked - aBlocked;

      if (a.weightedScore !== b.weightedScore) return a.weightedScore - b.weightedScore;
      return (histWeighted[a.name] || 0) - (histWeighted[b.name] || 0);
    });

    const selectedNight = forcedNightCandidate || nightCandidates[0] || stats[0];

    selectedNight.nightCount++;
    selectedNight.weekdayNightCounts[meta.dayName] = (selectedNight.weekdayNightCounts[meta.dayName] || 0) + 1;
    if (meta.isHoliday) selectedNight.holidayCount++;
    selectedNight.weightedScore += SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier;

    // --- STEP 2: Choose Primary Day Shift Person ---
    // By factory rule, whoever worked Night shift 2 days ago (`nightPersonTwoDaysAgo`) takes today's Day shift
    let dayCandidates = stats.filter(
      s =>
        s.name !== prevNightPerson &&
        s.name !== selectedNight.name &&
        isAllowedDayByConstraints(s.name, i)
    );

    if (dayCandidates.length === 0) {
      dayCandidates = stats.filter(s => s.name !== prevNightPerson && s.name !== selectedNight.name);
    }

    const forcedDayCandidate = dayCandidates.find(s =>
      constraints.some(
        c =>
          c.personName === s.name &&
          c.type === 'force_day_on_days' &&
          c.weekdays?.includes(meta.dayName)
      )
    );

    const twoDaysAgoCandidate = nightPersonTwoDaysAgo
      ? dayCandidates.find(s => s.name === nightPersonTwoDaysAgo)
      : undefined;

    dayCandidates.sort((a, b) => {
      if (a.dayCount !== b.dayCount) return a.dayCount - b.dayCount;
      if (meta.isHoliday && a.holidayCount !== b.holidayCount) return a.holidayCount - b.holidayCount;
      if (a.weightedScore !== b.weightedScore) return a.weightedScore - b.weightedScore;
      return (histWeighted[a.name] || 0) - (histWeighted[b.name] || 0);
    });

    const selectedDay = twoDaysAgoCandidate || forcedDayCandidate || dayCandidates[0] || stats[0];

    selectedDay.dayCount++;
    if (meta.isHoliday) selectedDay.holidayCount++;
    selectedDay.weightedScore += SHIFT_WEIGHTS.dayHours;

    newSchedule.push({
      id: Math.floor(Math.random() * 90000000) + 10000000,
      dayName: meta.dayName,
      date: meta.dateStr,
      dayShiftPerson: selectedDay.name,
      nightShiftPerson: selectedNight.name,
      onCallPerson: currentSupervisor,
      isHoliday: meta.isHoliday
    });

    prevNightPerson = selectedNight.name;
  }

  // Helper to recompute `stats` from `newSchedule`
  const syncStatsFromSchedule = () => {
    stats.forEach(s => {
      s.dayCount = 0;
      s.nightCount = 0;
      s.holidayCount = 0;
      s.weightedScore = 0;
      s.weekdayNightCounts = createEmptyWeekdayCounts();
    });
    for (let d = 0; d < daysInMonth; d++) {
      const entry = newSchedule[d];
      const metaD = monthDaysMeta[d];
      const nStat = stats.find(s => s.name === entry.nightShiftPerson);
      if (nStat) {
        nStat.nightCount++;
        nStat.weekdayNightCounts[metaD.dayName] = (nStat.weekdayNightCounts[metaD.dayName] || 0) + 1;
        if (metaD.isHoliday) nStat.holidayCount++;
        nStat.weightedScore += SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier;
      }
      const dStat = stats.find(s => s.name === entry.dayShiftPerson);
      if (dStat) {
        dStat.dayCount++;
        if (metaD.isHoliday) dStat.holidayCount++;
        dStat.weightedScore += SHIFT_WEIGHTS.dayHours;
      }
    }
  };

  // Helper to validate and apply a proposed set of night shift changes while maintaining strict 2-days-later Day shift continuity
  const tryApplyNightAssignments = (changes: { dayIdx: number; newNightPerson: string }[]): boolean => {
    const tempNights = newSchedule.map(s => s.nightShiftPerson);
    for (const ch of changes) {
      tempNights[ch.dayIdx] = ch.newNightPerson;
    }

    const tempDays = newSchedule.map((s, idx) => (idx >= 2 ? tempNights[idx - 2] : s.dayShiftPerson));

    for (let d = 0; d < daysInMonth; d++) {
      const nP = tempNights[d];
      const dP = tempDays[d];
      if (!nP || !dP || nP === dP) return false;

      const prevN = d > 0 ? tempNights[d - 1] : (lastEntry ? lastEntry.nightShiftPerson : '');
      if (nP === prevN || dP === prevN) return false;

      if (!isAllowedNightByConstraints(nP, d)) return false;
      if (!isAllowedDayByConstraints(dP, d)) return false;
    }

    for (let d = 0; d < daysInMonth; d++) {
      newSchedule[d].nightShiftPerson = tempNights[d];
      newSchedule[d].dayShiftPerson = tempDays[d];
    }
    syncStatsFromSchedule();
    return true;
  };

  const minAllowedNights = Math.floor(daysInMonth / Math.max(1, shiftWorkers.length));
  const maxAllowedNights = Math.ceil(daysInMonth / Math.max(1, shiftWorkers.length));

  // --- STEP 3: Post-Generation Fairness Equalizer Pass (for primary monthly totals) ---
  for (let pass = 0; pass < 25; pass++) {
    const sortedByNight = [...stats].sort((a, b) => b.nightCount - a.nightCount);
    let swapped = false;

    for (let hIdx = 0; hIdx < sortedByNight.length && !swapped; hIdx++) {
      for (let lIdx = sortedByNight.length - 1; lIdx > hIdx && !swapped; lIdx--) {
        const highest = sortedByNight[hIdx];
        const lowest = sortedByNight[lIdx];
        if (!highest || !lowest || highest.nightCount - lowest.nightCount <= 1) continue;

        // 3A. Direct 1-day transfer (`highest` -> `lowest`)
        for (let d = 0; d < daysInMonth; d++) {
          if (newSchedule[d].nightShiftPerson !== highest.name) continue;
          if (tryApplyNightAssignments([{ dayIdx: d, newNightPerson: lowest.name }])) {
            swapped = true;
            break;
          }
        }

        // 3B. 2-step chain transfer (`highest` -> `mid` on d1, `mid` -> `lowest` on d2)
        if (!swapped) {
          for (let d1 = 0; d1 < daysInMonth && !swapped; d1++) {
            if (newSchedule[d1].nightShiftPerson !== highest.name) continue;
            for (const midStat of stats) {
              const mid = midStat.name;
              if (mid === highest.name || mid === lowest.name) continue;
              if (!isAllowedNightByConstraints(mid, d1)) continue;
              for (let d2 = 0; d2 < daysInMonth; d2++) {
                if (d2 === d1 || newSchedule[d2].nightShiftPerson !== mid) continue;
                if (!isAllowedNightByConstraints(lowest.name, d2)) continue;
                if (
                  tryApplyNightAssignments([
                    { dayIdx: d1, newNightPerson: mid },
                    { dayIdx: d2, newNightPerson: lowest.name }
                  ])
                ) {
                  swapped = true;
                  break;
                }
              }
              if (swapped) break;
            }
          }
        }
      }
    }
    if (!swapped) break;
  }

  // --- STEP 3.2: Weekday Night Diversity & Fairness Pass (توزیع عادلانه شیفت‌های شب هر روز هفته به‌ویژه شنبه‌ها) ---
  const priorityWeekdays = ['شنبه', 'جمعه', 'پنج‌شنبه', 'چهارشنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'شنبه'];
  for (const targetDay of priorityWeekdays) {
    const targetDayIndices = monthDaysMeta.filter(m => m.dayName === targetDay).map(m => m.idx);
    if (targetDayIndices.length <= 1) continue;

    // Helper: can `workerStat` accept one more night on `dayName` without violating weekday diversity?
    const canAcceptMoreOnWeekday = (workerStat: MonthWorkerStat | undefined, dayName: string): boolean => {
      if (!workerStat) return false;
      const cur = workerStat.weekdayNightCounts[dayName] || 0;
      // Never allow another weekday's swap to create >= 2 Saturday nights for the same person
      if (dayName === 'شنبه') return cur < 1;
      // Restricted workers (only 3-4 allowed weekdays) may have up to 2 shifts on Thu/Fri/Wed
      const isRestricted = (blockedNightsPerWorker[workerStat.name] || 0) >= 12;
      return cur < (isRestricted ? 2 : 2);
    };

    for (let iter = 0; iter < 20; iter++) {
      let improved = false;

      const eligibleForTarget = stats.filter(s =>
        targetDayIndices.some(dIdx => isAllowedNightByConstraints(s.name, dIdx))
      );

      const overusedList = eligibleForTarget
        .filter(s => (s.weekdayNightCounts[targetDay] || 0) >= 2)
        .sort((a, b) => (b.weekdayNightCounts[targetDay] || 0) - (a.weekdayNightCounts[targetDay] || 0) || b.nightCount - a.nightCount);

      const underusedList = eligibleForTarget
        .filter(s => (s.weekdayNightCounts[targetDay] || 0) === 0)
        .sort((a, b) => a.nightCount - b.nightCount || (blockedNightsPerWorker[b.name] || 0) - (blockedNightsPerWorker[a.name] || 0));

      if (overusedList.length === 0 || underusedList.length === 0) break;

      for (const over of overusedList) {
        if (improved) break;
        const overTargetDays = targetDayIndices.filter(dIdx => newSchedule[dIdx].nightShiftPerson === over.name);

        for (const under of underusedList) {
          if (improved) break;

          // 0. Try Direct 1-day transfer (`over` -> `under` on `dTarget`) if monthly counts remain within [minAllowedNights, maxAllowedNights]
          if (over.nightCount > minAllowedNights && under.nightCount < maxAllowedNights) {
            for (const dTarget of overTargetDays) {
              if (!isAllowedNightByConstraints(under.name, dTarget)) continue;
              if (tryApplyNightAssignments([{ dayIdx: dTarget, newNightPerson: under.name }])) {
                improved = true;
                break;
              }
            }
            if (improved) break;
          }

          const underOtherDays = monthDaysMeta
            .filter(m => m.dayName !== targetDay && newSchedule[m.idx].nightShiftPerson === under.name)
            .map(m => m.idx);

          // 1. Try 2-way swap: `over` gives `dTarget` to `under`, `under` gives `dOther` to `over`
          for (const dTarget of overTargetDays) {
            if (improved) break;
            if (!isAllowedNightByConstraints(under.name, dTarget)) continue;
            for (const dOther of underOtherDays) {
              const otherDayName = monthDaysMeta[dOther].dayName;
              if (!canAcceptMoreOnWeekday(over, otherDayName)) continue;
              if (
                tryApplyNightAssignments([
                  { dayIdx: dTarget, newNightPerson: under.name },
                  { dayIdx: dOther, newNightPerson: over.name }
                ])
              ) {
                improved = true;
                break;
              }
            }
          }

          // 2. Try 2-step transfer with a 5-night donor (`giver` with > minAllowedNights gives `dGive` to `over`, while `over` gives `dTarget` to `under` with < maxAllowedNights)
          if (!improved && under.nightCount < maxAllowedNights) {
            const donors = stats.filter(s => s.name !== over.name && s.name !== under.name && s.nightCount > minAllowedNights);
            for (const dTarget of overTargetDays) {
              if (improved) break;
              if (!isAllowedNightByConstraints(under.name, dTarget)) continue;
              for (const donor of donors) {
                if (improved) break;
                for (let dGive = 0; dGive < daysInMonth; dGive++) {
                  if (monthDaysMeta[dGive].dayName === targetDay) continue;
                  if (newSchedule[dGive].nightShiftPerson !== donor.name) continue;
                  if (!canAcceptMoreOnWeekday(over, monthDaysMeta[dGive].dayName)) continue;
                  if (
                    tryApplyNightAssignments([
                      { dayIdx: dTarget, newNightPerson: under.name },
                      { dayIdx: dGive, newNightPerson: over.name }
                    ])
                  ) {
                    improved = true;
                    break;
                  }
                }
              }
            }
          }

          // 3. Try 2-step transfer with a 4-night receiver (`over` with > minAllowedNights gives `dTarget` to `under`, and `under` gives `dOther` to `receiver` with < maxAllowedNights)
          if (!improved && over.nightCount > minAllowedNights) {
            const receivers = stats.filter(s => s.name !== over.name && s.name !== under.name && s.nightCount < maxAllowedNights);
            for (const dTarget of overTargetDays) {
              if (improved) break;
              if (!isAllowedNightByConstraints(under.name, dTarget)) continue;
              for (const dOther of underOtherDays) {
                if (improved) break;
                for (const rec of receivers) {
                  if (!canAcceptMoreOnWeekday(rec, monthDaysMeta[dOther].dayName)) continue;
                  if (
                    tryApplyNightAssignments([
                      { dayIdx: dTarget, newNightPerson: under.name },
                      { dayIdx: dOther, newNightPerson: rec.name }
                    ])
                  ) {
                    improved = true;
                    break;
                  }
                }
              }
            }
          }

          // 4. Try 3-way rotation: `under` takes `dTarget` (from `over`), `over` takes `dMid` (from `mid`), `mid` takes `dOther` (from `under`)
          if (!improved) {
            for (const dTarget of overTargetDays) {
              if (improved) break;
              if (!isAllowedNightByConstraints(under.name, dTarget)) continue;

              for (let dMid = 0; dMid < daysInMonth && !improved; dMid++) {
                if (monthDaysMeta[dMid].dayName === targetDay) continue;
                const midName = newSchedule[dMid].nightShiftPerson;
                if (midName === over.name || midName === under.name) continue;
                const midStat = stats.find(s => s.name === midName);
                const midDayName = monthDaysMeta[dMid].dayName;
                if (!canAcceptMoreOnWeekday(over, midDayName)) continue;
                if (!isAllowedNightByConstraints(over.name, dMid)) continue;

                for (const dOther of underOtherDays) {
                  const otherDayName = monthDaysMeta[dOther].dayName;
                  if (!canAcceptMoreOnWeekday(midStat, otherDayName)) continue;
                  if (!isAllowedNightByConstraints(midName, dOther)) continue;
                  if (
                    tryApplyNightAssignments([
                      { dayIdx: dTarget, newNightPerson: under.name },
                      { dayIdx: dMid, newNightPerson: over.name },
                      { dayIdx: dOther, newNightPerson: midName }
                    ])
                  ) {
                    improved = true;
                    break;
                  }
                }
              }
            }
          }
        }
      }

      if (!improved) break;
    }
  }

  // --- STEP 3.5: Assign Auxiliary / Helper Shifts (`extraNightPersons` & `extraDayPersons`) ---
  const auxRules = constraints.filter(
    c =>
      c.type === 'auxiliary_role' ||
      c.type === 'auxiliary_day_role' ||
      c.type === 'auxiliary_night_on_days' ||
      c.type === 'auxiliary_day_on_days'
  );

  for (const rule of auxRules) {
    const pName = rule.personName;
    const targetWeekdays = rule.weekdays && rule.weekdays.length > 0 ? rule.weekdays : WEEK_DAYS;
    const isAllWeekdays = targetWeekdays.length >= 6;
    let lastAuxIdx = -10;

    for (let i = 0; i < daysInMonth; i++) {
      const entry = newSchedule[i];
      if (!targetWeekdays.includes(entry.dayName)) continue;

      // Skip if already primary on this day
      if (entry.dayShiftPerson === pName || entry.nightShiftPerson === pName) continue;

      // Check previous day night shift (primary or extra)
      const prevEntry = i > 0 ? newSchedule[i - 1] : lastEntry;
      const workedPrevNight =
        prevEntry &&
        (prevEntry.nightShiftPerson === pName ||
          (prevEntry.extraNightPersons && prevEntry.extraNightPersons.includes(pName)));
      if (workedPrevNight) continue;

      if (rule.type === 'auxiliary_day_on_days' || rule.type === 'auxiliary_day_role') {
        if (rule.type === 'auxiliary_day_role' && isAllWeekdays && i - lastAuxIdx < 4) continue;
        const currentExtras = entry.extraDayPersons || [];
        if (!currentExtras.includes(pName)) {
          entry.extraDayPersons = [...currentExtras, pName];
          lastAuxIdx = i;
        }
      } else {
        // auxiliary_role or auxiliary_night_on_days -> assign to extraNightPersons
        // If all 7 weekdays were selected (general auxiliary role), space out by at least 4 days (~6 shifts/month)
        if (isAllWeekdays && i - lastAuxIdx < 4) continue;
        // Also ensure at least 1 day gap between night shifts even if consecutive weekdays were selected
        if (i - lastAuxIdx < 2) continue;

        // Check next day primary shift conflict
        const nextEntry = i < daysInMonth - 1 ? newSchedule[i + 1] : null;
        if (
          nextEntry &&
          (nextEntry.dayShiftPerson === pName || nextEntry.nightShiftPerson === pName)
        ) {
          continue;
        }

        const currentExtras = entry.extraNightPersons || [];
        if (!currentExtras.includes(pName)) {
          entry.extraNightPersons = [...currentExtras, pName];
          lastAuxIdx = i;
        }
      }
    }
  }

  // --- STEP 4: Verify Constraints & Compute Fairness Metrics ---
  const constraintReports = constraints.map(rule => {
    let violations = 0;
    const matchedDays: string[] = [];

    for (let i = 0; i < daysInMonth; i++) {
      const entry = newSchedule[i];
      const prevEntry = i > 0 ? newSchedule[i - 1] : lastEntry;
      const prevNight = prevEntry ? prevEntry.nightShiftPerson : '';

      if (rule.type === 'present_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.nightShiftPerson === rule.personName || prevNight === rule.personName) {
          violations++;
        } else {
          matchedDays.push(entry.date.slice(8));
        }
      } else if (rule.type === 'auxiliary_role' || rule.type === 'auxiliary_night_on_days') {
        if ((entry.extraNightPersons || []).includes(rule.personName)) {
          matchedDays.push(entry.date.slice(8));
        }
        if (rule.type === 'auxiliary_role' && (entry.dayShiftPerson === rule.personName || entry.nightShiftPerson === rule.personName)) {
          violations++;
        }
      } else if (rule.type === 'auxiliary_day_role' || rule.type === 'auxiliary_day_on_days') {
        if ((entry.extraDayPersons || []).includes(rule.personName)) {
          matchedDays.push(entry.date.slice(8));
        }
        if (rule.type === 'auxiliary_day_role' && (entry.dayShiftPerson === rule.personName || entry.nightShiftPerson === rule.personName)) {
          violations++;
        }
      } else if (rule.type === 'no_night_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.nightShiftPerson === rule.personName) violations++;
        else matchedDays.push(entry.date.slice(8));
      } else if (rule.type === 'no_shift_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.nightShiftPerson === rule.personName || entry.dayShiftPerson === rule.personName) violations++;
        else matchedDays.push(entry.date.slice(8));
      } else if (rule.type === 'force_day_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.dayShiftPerson === rule.personName) matchedDays.push(entry.date.slice(8));
        else violations++;
      } else if (rule.type === 'force_night_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.nightShiftPerson === rule.personName) matchedDays.push(entry.date.slice(8));
        else violations++;
      } else if (rule.type === 'unavailable_dates' && rule.daysOfMonth?.includes(i + 1)) {
        if (entry.nightShiftPerson === rule.personName || entry.dayShiftPerson === rule.personName) violations++;
        else matchedDays.push(entry.date.slice(8));
      }
    }

    return {
      rule,
      satisfied: violations === 0,
      details:
        rule.type === 'auxiliary_role' ||
        rule.type === 'auxiliary_day_role' ||
        rule.type === 'auxiliary_night_on_days' ||
        rule.type === 'auxiliary_day_on_days'
          ? `ثبت به عنوان نفر کمکی در ${matchedDays.length} نوبت ماه`
          : violations === 0
            ? `کاملاً رعایت شد (در تمام ${matchedDays.length} نوبت ماه)`
            : `در ${matchedDays.length} نوبت رعایت شد`
    };
  });

  // Compute Fairness Score (across main shift workers) and summaries for all active shift staff
  const personSummaries: PersonScheduleSummary[] = allShiftWorkers.map(w => {
    const pObj = allPersonnel.find(p => p.name === w);
    let dayShifts = 0;
    let nightShifts = 0;
    let extraDayShifts = 0;
    let extraNightShifts = 0;
    let holidayShifts = 0;

    newSchedule.forEach(entry => {
      const isMainDay = entry.dayShiftPerson === w;
      const isExtraDay = (entry.extraDayPersons || []).includes(w);
      const isMainNight = entry.nightShiftPerson === w;
      const isExtraNight = (entry.extraNightPersons || []).includes(w);

      if (isMainDay) {
        dayShifts++;
        if (entry.isHoliday) holidayShifts++;
      }
      if (isExtraDay) {
        extraDayShifts++;
        if (entry.isHoliday) holidayShifts++;
      }
      if (isMainNight) {
        nightShifts++;
        if (entry.isHoliday) holidayShifts++;
      }
      if (isExtraNight) {
        extraNightShifts++;
        if (entry.isHoliday) holidayShifts++;
      }
    });

    const totalDay = dayShifts + extraDayShifts;
    const totalNight = nightShifts + extraNightShifts;
    const rawShiftHours = totalDay * SHIFT_WEIGHTS.dayHours + totalNight * SHIFT_WEIGHTS.nightHours;
    const weightedHours =
      dayShifts * SHIFT_WEIGHTS.dayHours +
      nightShifts * SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier;
    return {
      name: w,
      dayShifts,
      nightShifts,
      extraDayShifts,
      extraNightShifts,
      holidayShifts,
      weightedHours,
      rawShiftHours,
      isAuxiliaryOnly: auxiliaryOnlySet.has(w),
      color: pObj?.color
    };
  });

  const mainSummaries = personSummaries.filter(p => !p.isAuxiliaryOnly);
  const evalList = mainSummaries.length > 0 ? mainSummaries : personSummaries;
  const totalWeighted = evalList.reduce((acc, p) => acc + p.weightedHours, 0);
  const meanWeighted = evalList.length > 0 ? totalWeighted / evalList.length : 0;
  const variance = evalList.reduce((acc, p) => acc + Math.pow(p.weightedHours - meanWeighted, 2), 0) / (evalList.length || 1);
  const stdDev = Math.sqrt(variance);
  const cv = meanWeighted > 0 ? (stdDev / meanWeighted) * 100 : 0;
  const fairnessScore = Math.max(20, Math.min(100, Math.round(100 - cv * 1.4)));

  return {
    year: targetYear,
    monthCode: targetMonthCode,
    monthName,
    schedule: newSchedule,
    constraints,
    constraintReports,
    fairnessScore,
    personSummaries
  };
};

// Re-evaluate metrics, constraint reports, and fairness score for an existing/edited month schedule
export const evaluateMonthScheduleResult = (
  monthEntries: ShiftEntry[],
  fullScheduleHistory: ShiftEntry[],
  targetYear: number,
  targetMonthCode: string,
  allPersonnel: Personnel[],
  constraints: ShiftConstraintRule[],
  appliedEdits?: string[]
): ConstrainedScheduleResult => {
  const monthPrefix = `${targetYear}/${targetMonthCode}`;
  const monthName = PERSIAN_MONTH_MAP.find(m => m.code === targetMonthCode)?.name || targetMonthCode;
  const allShiftWorkers = allPersonnel.filter(p => p.isActive && p.roles.includes('Shift')).map(p => p.name);

  const auxiliaryOnlySet = new Set(
    constraints
      .filter(
        c =>
          c.type === 'auxiliary_role' ||
          c.type === 'auxiliary_day_role' ||
          (c.type === 'no_shift_on_days' && (c.weekdays?.length || 0) >= 7)
      )
      .map(c => c.personName)
  );

  const priorHistory = fullScheduleHistory
    .filter(s => s.date < `${monthPrefix}/01`)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastEntry = priorHistory.length > 0 ? priorHistory[priorHistory.length - 1] : null;
  const daysInMonth = monthEntries.length;

  const constraintReports = constraints.map(rule => {
    let violations = 0;
    const matchedDays: string[] = [];

    for (let i = 0; i < daysInMonth; i++) {
      const entry = monthEntries[i];
      const prevEntry = i > 0 ? monthEntries[i - 1] : lastEntry;
      const prevNight = prevEntry ? prevEntry.nightShiftPerson : '';

      if (rule.type === 'present_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.nightShiftPerson === rule.personName || prevNight === rule.personName) {
          violations++;
        } else {
          matchedDays.push(entry.date.slice(8));
        }
      } else if (rule.type === 'auxiliary_role' || rule.type === 'auxiliary_night_on_days') {
        if ((entry.extraNightPersons || []).includes(rule.personName)) {
          matchedDays.push(entry.date.slice(8));
        }
        if (rule.type === 'auxiliary_role' && (entry.dayShiftPerson === rule.personName || entry.nightShiftPerson === rule.personName)) {
          violations++;
        }
      } else if (rule.type === 'auxiliary_day_role' || rule.type === 'auxiliary_day_on_days') {
        if ((entry.extraDayPersons || []).includes(rule.personName)) {
          matchedDays.push(entry.date.slice(8));
        }
        if (rule.type === 'auxiliary_day_role' && (entry.dayShiftPerson === rule.personName || entry.nightShiftPerson === rule.personName)) {
          violations++;
        }
      } else if (rule.type === 'no_night_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.nightShiftPerson === rule.personName) violations++;
        else matchedDays.push(entry.date.slice(8));
      } else if (rule.type === 'no_shift_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.nightShiftPerson === rule.personName || entry.dayShiftPerson === rule.personName) violations++;
        else matchedDays.push(entry.date.slice(8));
      } else if (rule.type === 'force_day_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.dayShiftPerson === rule.personName) matchedDays.push(entry.date.slice(8));
        else violations++;
      } else if (rule.type === 'force_night_on_days' && rule.weekdays?.includes(entry.dayName)) {
        if (entry.nightShiftPerson === rule.personName) matchedDays.push(entry.date.slice(8));
        else violations++;
      } else if (rule.type === 'unavailable_dates' && rule.daysOfMonth?.includes(i + 1)) {
        if (entry.nightShiftPerson === rule.personName || entry.dayShiftPerson === rule.personName) violations++;
        else matchedDays.push(entry.date.slice(8));
      }
    }

    return {
      rule,
      satisfied: violations === 0,
      details:
        rule.type === 'auxiliary_role' ||
        rule.type === 'auxiliary_day_role' ||
        rule.type === 'auxiliary_night_on_days' ||
        rule.type === 'auxiliary_day_on_days'
          ? `ثبت به عنوان نفر کمکی در ${matchedDays.length} نوبت ماه`
          : violations === 0
            ? `کاملاً رعایت شد (در تمام ${matchedDays.length} نوبت ماه)`
            : `در ${matchedDays.length} نوبت رعایت شد`
    };
  });

  const personSummaries: PersonScheduleSummary[] = allShiftWorkers.map(w => {
    const pObj = allPersonnel.find(p => p.name === w);
    let dayShifts = 0;
    let nightShifts = 0;
    let extraDayShifts = 0;
    let extraNightShifts = 0;
    let holidayShifts = 0;

    monthEntries.forEach(entry => {
      const isMainDay = entry.dayShiftPerson === w;
      const isExtraDay = (entry.extraDayPersons || []).includes(w);
      const isMainNight = entry.nightShiftPerson === w;
      const isExtraNight = (entry.extraNightPersons || []).includes(w);

      if (isMainDay) {
        dayShifts++;
        if (entry.isHoliday) holidayShifts++;
      }
      if (isExtraDay) {
        extraDayShifts++;
        if (entry.isHoliday) holidayShifts++;
      }
      if (isMainNight) {
        nightShifts++;
        if (entry.isHoliday) holidayShifts++;
      }
      if (isExtraNight) {
        extraNightShifts++;
        if (entry.isHoliday) holidayShifts++;
      }
    });

    const totalDay = dayShifts + extraDayShifts;
    const totalNight = nightShifts + extraNightShifts;
    const rawShiftHours = totalDay * SHIFT_WEIGHTS.dayHours + totalNight * SHIFT_WEIGHTS.nightHours;
    const weightedHours =
      dayShifts * SHIFT_WEIGHTS.dayHours +
      nightShifts * SHIFT_WEIGHTS.nightHours * SHIFT_WEIGHTS.nightMultiplier;
    return {
      name: w,
      dayShifts,
      nightShifts,
      extraDayShifts,
      extraNightShifts,
      holidayShifts,
      weightedHours,
      rawShiftHours,
      isAuxiliaryOnly: auxiliaryOnlySet.has(w),
      color: pObj?.color
    };
  });

  const mainSummaries = personSummaries.filter(p => !p.isAuxiliaryOnly);
  const evalList = mainSummaries.length > 0 ? mainSummaries : personSummaries;
  const totalWeighted = evalList.reduce((acc, p) => acc + p.weightedHours, 0);
  const meanWeighted = evalList.length > 0 ? totalWeighted / evalList.length : 0;
  const variance = evalList.reduce((acc, p) => acc + Math.pow(p.weightedHours - meanWeighted, 2), 0) / (evalList.length || 1);
  const stdDev = Math.sqrt(variance);
  const cv = meanWeighted > 0 ? (stdDev / meanWeighted) * 100 : 0;
  const fairnessScore = Math.max(20, Math.min(100, Math.round(100 - cv * 1.4)));

  return {
    year: targetYear,
    monthCode: targetMonthCode,
    monthName,
    schedule: monthEntries,
    constraints,
    constraintReports,
    fairnessScore,
    personSummaries,
    appliedEdits
  };
};

// Replace Persian ordinal words (اول، دوم، ... سی‌ام) with numbers for day-of-month parsing
const replacePersianOrdinalsWithNumbers = (input: string): string => {
  const ordinals: [RegExp, string][] = [
    [/\bسی و یکم\b/g, '31'],
    [/\bسی ام\b|\bسیم\b/g, '30'],
    [/\bبیست و نهم\b/g, '29'],
    [/\bبیست و هشتم\b/g, '28'],
    [/\bبیست و هفتم\b/g, '27'],
    [/\bبیست و ششم\b/g, '26'],
    [/\bبیست و پنجم\b/g, '25'],
    [/\bبیست و چهارم\b/g, '24'],
    [/\bبیست و سوم\b/g, '23'],
    [/\bبیست و دوم\b/g, '22'],
    [/\bبیست و یکم\b/g, '21'],
    [/\bبیستم\b/g, '20'],
    [/\bنوزدهم\b/g, '19'],
    [/\bهجدهم\b|\bهیجدهم\b/g, '18'],
    [/\bهفدهم\b|\bهیفدهم\b/g, '17'],
    [/\bشانزدهم\b|\bشونزدهم\b/g, '16'],
    [/\bپانزدهم\b|\bپونزدهم\b/g, '15'],
    [/\bچهاردهم\b/g, '14'],
    [/\bسیزدهم\b/g, '13'],
    [/\bدوازدهم\b/g, '12'],
    [/\bیازدهم\b/g, '11'],
    [/\bدهم\b/g, '10'],
    [/\bنهم\b/g, '9'],
    [/\bهشتم\b/g, '8'],
    [/\bهفتم\b/g, '7'],
    [/\bششم\b|\bشیشم\b/g, '6'],
    [/\bپنجم\b/g, '5'],
    [/\bچهارم\b/g, '4'],
    [/\bسوم\b/g, '3'],
    [/\bدوم\b/g, '2'],
    [/\bاول\b|\bیکم\b/g, '1']
  ];
  let out = input;
  for (const [rx, num] of ordinals) {
    out = out.replace(rx, num);
  }
  return out;
};

/**
 * Interactive Chat Modification Engine:
 * Supports:
 * 1) Direct day-of-month edits on the previewed/active month (e.g., "روز ۵ آبان شیفت شب دهقان باشه", "جای شیفت شب ۵ و ۸ رو عوض کن", "روز ۱۰ حیدری کمکی شب باشه", "روز ۵ دهقان نباشه")
 * 2) Swapping two specialists across weekdays or specific dates (e.g., "شنبه‌ها جای دهقان و فلاح رو عوض کن")
 * 3) Removing or updating specific constraints (e.g., "شرط سلیمان فلاح رو حذف کن", "دهقان هم دوشنبه‌ها حضور داشته باشه")
 * 4) Full-month constraint-based scheduling with cumulative constraint merging
 */
export const applyInteractiveChatModification = (
  text: string,
  fullSchedule: ShiftEntry[],
  allPersonnel: Personnel[],
  defaultYear: number,
  defaultMonthCode: string,
  existingConstraints: ShiftConstraintRule[]
): {
  handled: boolean;
  actionType: 'direct_edit' | 'constraint_schedule' | 'save_preview' | 'cancel_preview' | 'none';
  hasExplicitMonth: boolean;
  result?: ConstrainedScheduleResult;
  updatedConstraints: ShiftConstraintRule[];
  appliedEdits: string[];
} => {
  const normRaw = normalizePersianText(text);
  const normText = replacePersianOrdinalsWithNumbers(normRaw);

  // Check if user is asking to finalize/save or cancel the preview via chat
  if (/^(ذخیره کن|تایید و ذخیره|نهایی کن|ثبت نهایی کن|همینو ذخیره کن|تاییده ذخیره کن|بله ذخیره کن)$/.test(normRaw)) {
    return {
      handled: true,
      actionType: 'save_preview',
      hasExplicitMonth: false,
      updatedConstraints: existingConstraints,
      appliedEdits: ['ذخیره و انتشار نهایی پیش‌نمایش در تقویم']
    };
  }

  // Parse basic month & constraint info
  const parsed = parsePersianShiftRequest(text, allPersonnel, defaultYear, defaultMonthCode);
  const targetYear = parsed.targetYear;
  const targetMonthCode = parsed.targetMonthCode;
  const targetMonthName = parsed.targetMonthName;
  const monthPrefix = `${targetYear}/${targetMonthCode}`;

  // Find all personnel mentioned in the text
  const activeStaff = allPersonnel.filter(p => p.isActive && (p.roles.includes('Shift') || p.roles.includes('Supervisor')));
  const mentions: { personName: string; index: number; matchedToken: string }[] = [];
  for (const p of activeStaff) {
    const fullNorm = normalizePersianText(p.name);
    const strippedNorm = fullNorm.replace(/^(مهندس|آقای|خانم|دکتر|کارشناس)\s+/g, '').trim();
    const parts = strippedNorm.split(' ').filter(t => t.length >= 3);
    const candidateTokens = Array.from(new Set([fullNorm, strippedNorm, ...parts])).sort((a, b) => b.length - a.length);
    for (const token of candidateTokens) {
      const idx = normText.indexOf(token);
      if (idx !== -1) {
        mentions.push({ personName: p.name, index: idx, matchedToken: token });
        break;
      }
    }
  }
  mentions.sort((a, b) => a.index - b.index);

  // Mask out years (1404..1410) and numeric weekdays (1 شنبه..5 شنبه) before extracting day numbers (1..31)
  const maskedForDays = normText
    .replace(/\b(140\d|141\d)\b/g, ' ___ ')
    .replace(/[1-5]\s*شنبه/g, ' ___ ');

  const isMultiDayUnavailabilityRange = /از\s*\d{1,2}\s*تا\s*\d{1,2}/.test(maskedForDays) && /(نباشه|نباشد|مرخصی|معاف)/.test(normText);

  // Extract explicit day-of-month numbers (1..31)
  const dayNumbers: number[] = [];
  if (!isMultiDayUnavailabilityRange) {
    const dayRegex = /\b([1-9]|[12]\d|3[01])\b/g;
    let m: RegExpExecArray | null;
    while ((m = dayRegex.exec(maskedForDays)) !== null) {
      const dNum = parseInt(m[1], 10);
      if (dNum >= 1 && dNum <= 31 && !dayNumbers.includes(dNum)) {
        dayNumbers.push(dNum);
      }
    }
  }

  const hasSwapKeyword = /(جابجا|جا به جا|عوض کن|عوض شود|بده به هم|با هم عوض)/.test(normText);
  const hasRemoveConstraintKeyword = /(شرط|ملاحظه|محدودیت).*(حذف|بردار|پاک|لغو)|همه شروط.*(پاک|حذف)|از کمکی خارج|(دیگه|دیگر)\s*کمکی\s*(نباشه|نباشد)/.test(normText);

  // Ensure we have base month entries to edit if doing a direct edit
  const existingMonthEntries = fullSchedule
    .filter(s => s.date.startsWith(`${monthPrefix}/`))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      ...s,
      extraDayPersons: s.extraDayPersons ? [...s.extraDayPersons] : undefined,
      extraNightPersons: s.extraNightPersons ? [...s.extraNightPersons] : undefined
    }));

  // =========================================================================
  // 1. DIRECT DAY-OF-MONTH EDITS OR SWAPS ON THE PREVIEWED SCHEDULE
  // =========================================================================
  if (dayNumbers.length > 0 || (hasSwapKeyword && mentions.length >= 2)) {
    const baseEntries =
      existingMonthEntries.length > 0
        ? existingMonthEntries
        : generateConstrainedMonth(fullSchedule, targetYear, targetMonthCode, allPersonnel, existingConstraints).schedule;

    const appliedEdits: string[] = [];
    const hasHelperKeyword = /(کمکی|نفر دوم|همیار)/.test(normText);
    const hasNegation = /(نباشه|نباشد|بردار|حذف|نداره|نداشته)/.test(normText);
    const mentionsDayShift = /(شیفت روز|روزکار|کمکی روز|شیفت صبح|در روز و شب)/.test(normText) || (/\bروز\b/.test(normText.replace(/روز\s*\d+/g, '').replace(/روزهای/g, '')) && !/شیفت شب/.test(normText));
    const mentionsNightShift = /(شیفت شب|شبکار|کمکی شب|\bشب\b)/.test(normText);
    const mentionsOnCall = /(آنکال|انکال|سرپرست)/.test(normText);

    // CASE 1A: Swap between two specific dates (e.g. "جای شیفت شب ۵ و ۸ آبان رو عوض کن")
    if (hasSwapKeyword && dayNumbers.length >= 2) {
      const d1 = dayNumbers[0];
      const d2 = dayNumbers[1];
      const e1 = baseEntries[d1 - 1];
      const e2 = baseEntries[d2 - 1];
      if (e1 && e2) {
        if (mentionsDayShift && !mentionsNightShift) {
          const tmp = e1.dayShiftPerson;
          e1.dayShiftPerson = e2.dayShiftPerson;
          e2.dayShiftPerson = tmp;
          appliedEdits.push(`جابجایی شیفت روز تاریخ ${d1} و ${d2} ${targetMonthName} (${e2.dayShiftPerson} ↔ ${e1.dayShiftPerson})`);
        } else if (mentionsNightShift && !mentionsDayShift) {
          const tmp = e1.nightShiftPerson;
          e1.nightShiftPerson = e2.nightShiftPerson;
          e2.nightShiftPerson = tmp;
          appliedEdits.push(`جابجایی شیفت شب تاریخ ${d1} و ${d2} ${targetMonthName} (${e2.nightShiftPerson} ↔ ${e1.nightShiftPerson})`);
        } else {
          const tmpN = e1.nightShiftPerson;
          e1.nightShiftPerson = e2.nightShiftPerson;
          e2.nightShiftPerson = tmpN;
          const tmpD = e1.dayShiftPerson;
          e1.dayShiftPerson = e2.dayShiftPerson;
          e2.dayShiftPerson = tmpD;
          appliedEdits.push(`جابجایی کامل شیفت‌های تاریخ ${d1} و ${d2} ${targetMonthName}`);
        }
      }
    }
    // CASE 1B: Swap on a single date (e.g. "در روز ۶ جای شیفت روز و شب رو عوض کن" or "روز ۶ جای دهقان و سالاروند رو عوض کن")
    else if (hasSwapKeyword && dayNumbers.length === 1) {
      const d1 = dayNumbers[0];
      const entry = baseEntries[d1 - 1];
      if (entry) {
        if (mentions.length >= 2) {
          const p1 = mentions[0].personName;
          const p2 = mentions[1].personName;
          if (entry.dayShiftPerson === p1 && entry.nightShiftPerson === p2) {
            entry.dayShiftPerson = p2;
            entry.nightShiftPerson = p1;
          } else if (entry.dayShiftPerson === p2 && entry.nightShiftPerson === p1) {
            entry.dayShiftPerson = p1;
            entry.nightShiftPerson = p2;
          } else if (entry.nightShiftPerson === p1) {
            entry.nightShiftPerson = p2;
          } else if (entry.dayShiftPerson === p1) {
            entry.dayShiftPerson = p2;
          } else if (entry.nightShiftPerson === p2) {
            entry.nightShiftPerson = p1;
          } else if (entry.dayShiftPerson === p2) {
            entry.dayShiftPerson = p1;
          }
          appliedEdits.push(`جابجایی ${p1} و ${p2} در تاریخ ${d1} ${targetMonthName}`);
        } else {
          const tmp = entry.dayShiftPerson;
          entry.dayShiftPerson = entry.nightShiftPerson;
          entry.nightShiftPerson = tmp;
          appliedEdits.push(`جابجایی شیفت روز و شب در تاریخ ${d1} ${targetMonthName} (${entry.dayShiftPerson} ↔ ${entry.nightShiftPerson})`);
        }
      }
    }
    // CASE 1C: Swap two people across weekdays or whole month (no specific day number)
    else if (hasSwapKeyword && dayNumbers.length === 0 && mentions.length >= 2) {
      const p1 = mentions[0].personName;
      const p2 = mentions[1].personName;
      const targetWeekdays = extractWeekdaysFromText(normText);
      let swapCount = 0;

      baseEntries.forEach(entry => {
        if (targetWeekdays.length > 0 && !targetWeekdays.includes(entry.dayName)) return;
        let changed = false;
        if (!mentionsNightShift || mentionsDayShift) {
          if (entry.dayShiftPerson === p1) { entry.dayShiftPerson = p2; changed = true; }
          else if (entry.dayShiftPerson === p2) { entry.dayShiftPerson = p1; changed = true; }
        }
        if (!mentionsDayShift || mentionsNightShift) {
          if (entry.nightShiftPerson === p1) { entry.nightShiftPerson = p2; changed = true; }
          else if (entry.nightShiftPerson === p2) { entry.nightShiftPerson = p1; changed = true; }
        }
        if (changed) swapCount++;
      });

      if (swapCount > 0) {
        const scopeText = targetWeekdays.length > 0 ? `در روزهای ${targetWeekdays.join('، ')}` : `در کل ماه ${targetMonthName}`;
        appliedEdits.push(`جابجایی شیفت‌های ${p1} و ${p2} ${scopeText} (${swapCount} روز)`);
      }
    }
    // CASE 1D: Direct edit on specific dayNumber(s)
    else if (dayNumbers.length > 0) {
      // Check if "به جای <OldPerson>، <NewPerson>" pattern is used
      const replaceMatch = mentions.length >= 2 && /(به\s*جای|بجای|جای)\s*/.test(normText);

      for (const dNum of dayNumbers) {
        const entry = baseEntries[dNum - 1];
        if (!entry) continue;

        if (replaceMatch) {
          const oldPerson = mentions[0].personName;
          const newPerson = mentions[1].personName;
          if (entry.nightShiftPerson === oldPerson && (!mentionsDayShift || mentionsNightShift)) {
            entry.nightShiftPerson = newPerson;
            appliedEdits.push(`روز ${dNum} ${targetMonthName}: جایگزینی ${newPerson} به جای ${oldPerson} در شیفت شب`);
          } else if (entry.dayShiftPerson === oldPerson && (!mentionsNightShift || mentionsDayShift)) {
            entry.dayShiftPerson = newPerson;
            appliedEdits.push(`روز ${dNum} ${targetMonthName}: جایگزینی ${newPerson} به جای ${oldPerson} در شیفت روز`);
          } else if (mentionsDayShift) {
            entry.dayShiftPerson = newPerson;
            appliedEdits.push(`روز ${dNum} ${targetMonthName}: ثبت ${newPerson} در شیفت روز`);
          } else {
            entry.nightShiftPerson = newPerson;
            appliedEdits.push(`روز ${dNum} ${targetMonthName}: ثبت ${newPerson} در شیفت شب`);
          }
          continue;
        }

        // Helper (کمکی) add or remove on specific day(s)
        if (hasHelperKeyword) {
          if (hasNegation) {
            if (mentions.length > 0) {
              for (const m of mentions) {
                entry.extraNightPersons = (entry.extraNightPersons || []).filter(p => p !== m.personName);
                entry.extraDayPersons = (entry.extraDayPersons || []).filter(p => p !== m.personName);
                appliedEdits.push(`روز ${dNum} ${targetMonthName}: حذف ${m.personName} از شیفت کمکی`);
              }
            } else {
              entry.extraNightPersons = [];
              entry.extraDayPersons = [];
              appliedEdits.push(`روز ${dNum} ${targetMonthName}: حذف نفرات کمکی`);
            }
          } else if (mentions.length > 0) {
            for (const m of mentions) {
              if (mentionsDayShift && !mentionsNightShift) {
                const cur = entry.extraDayPersons || [];
                if (!cur.includes(m.personName)) entry.extraDayPersons = [...cur, m.personName];
                appliedEdits.push(`روز ${dNum} ${targetMonthName}: افزودن ${m.personName} به عنوان کمکی شیفت روز`);
              } else {
                const cur = entry.extraNightPersons || [];
                if (!cur.includes(m.personName)) entry.extraNightPersons = [...cur, m.personName];
                appliedEdits.push(`روز ${dNum} ${targetMonthName}: افزودن ${m.personName} به عنوان کمکی شیفت شب`);
              }
            }
          }
          continue;
        }

        // Negation on a specific day (e.g. "روز ۵ آبان دهقان شیفت نباشه") -> auto-substitute with fairest valid worker
        if (hasNegation && mentions.length > 0) {
          const allMainStaff = allPersonnel
            .filter(p => p.isActive && p.roles.includes('Shift'))
            .map(p => p.name);
          const prevEntry = dNum >= 2 ? baseEntries[dNum - 2] : null;
          const nextEntry = dNum < baseEntries.length ? baseEntries[dNum] : null;

          for (const m of mentions) {
            const pName = m.personName;
            if (entry.nightShiftPerson === pName && (!mentionsDayShift || mentionsNightShift)) {
              const replacement = allMainStaff.find(
                cand =>
                  cand !== pName &&
                  cand !== entry.dayShiftPerson &&
                  cand !== prevEntry?.nightShiftPerson &&
                  cand !== nextEntry?.nightShiftPerson &&
                  cand !== nextEntry?.dayShiftPerson
              );
              if (replacement) {
                entry.nightShiftPerson = replacement;
                appliedEdits.push(`روز ${dNum} ${targetMonthName}: معافیت ${pName} از شیفت شب و جایگزینی با ${replacement}`);
              }
            }
            if (entry.dayShiftPerson === pName && (!mentionsNightShift || mentionsDayShift)) {
              const replacement = allMainStaff.find(
                cand =>
                  cand !== pName &&
                  cand !== entry.nightShiftPerson &&
                  cand !== prevEntry?.nightShiftPerson
              );
              if (replacement) {
                entry.dayShiftPerson = replacement;
                appliedEdits.push(`روز ${dNum} ${targetMonthName}: معافیت ${pName} از شیفت روز و جایگزینی با ${replacement}`);
              }
            }
            if ((entry.extraNightPersons || []).includes(pName)) {
              entry.extraNightPersons = (entry.extraNightPersons || []).filter(x => x !== pName);
              appliedEdits.push(`روز ${dNum} ${targetMonthName}: حذف ${pName} از کمکی شب`);
            }
            if ((entry.extraDayPersons || []).includes(pName)) {
              entry.extraDayPersons = (entry.extraDayPersons || []).filter(x => x !== pName);
              appliedEdits.push(`روز ${dNum} ${targetMonthName}: حذف ${pName} از کمکی روز`);
            }
          }
          continue;
        }

        // Direct assignment on specific day(s) (e.g. "روز ۵ آبان شیفت شب دهقان باشه" or "روز ۳ فلاح شب و دهقان روز باشه")
        if (mentions.length > 0) {
          for (let i = 0; i < mentions.length; i++) {
            const curM = mentions[i];
            const nextM = i < mentions.length - 1 ? mentions[i + 1] : null;
            const snippetStart = i === 0 ? 0 : curM.index;
            const snippetEnd = nextM ? nextM.index : normText.length;
            const snippet = normText.slice(snippetStart, snippetEnd);

            const localDay = /(شیفت روز|روزکار|شیفت صبح|\bروز\b)/.test(snippet.replace(/روز\s*\d+/g, ''));
            const localNight = /(شیفت شب|شبکار|\bشب\b)/.test(snippet);
            const localOnCall = /(آنکال|انکال|سرپرست)/.test(snippet);

            if (localOnCall || mentionsOnCall) {
              entry.onCallPerson = curM.personName;
              appliedEdits.push(`روز ${dNum} ${targetMonthName}: تغییر سرپرست آنکال به ${curM.personName}`);
            } else if ((localDay && !localNight) || (mentionsDayShift && !mentionsNightShift && mentions.length === 1)) {
              const old = entry.dayShiftPerson;
              entry.dayShiftPerson = curM.personName;
              appliedEdits.push(`روز ${dNum} ${targetMonthName} (${entry.dayName}): تغییر شیفت روز از ${old} به ${curM.personName}`);
            } else {
              const old = entry.nightShiftPerson;
              entry.nightShiftPerson = curM.personName;
              appliedEdits.push(`روز ${dNum} ${targetMonthName} (${entry.dayName}): تغییر شیفت شب از ${old} به ${curM.personName}`);
            }
          }
          continue;
        }

        // Holiday toggle on specific day(s)
        if (/تعطیل/.test(normText)) {
          entry.isHoliday = !hasNegation;
          appliedEdits.push(`روز ${dNum} ${targetMonthName}: وضعیت تعطیلی به «${entry.isHoliday ? 'تعطیل' : 'عادی'}» تغییر یافت`);
        }
      }
    }

    if (appliedEdits.length > 0) {
      const evalResult = evaluateMonthScheduleResult(
        baseEntries,
        fullSchedule,
        targetYear,
        targetMonthCode,
        allPersonnel,
        existingConstraints,
        appliedEdits
      );
      return {
        handled: true,
        actionType: 'direct_edit',
        hasExplicitMonth: parsed.hasExplicitMonth,
        result: evalResult,
        updatedConstraints: existingConstraints,
        appliedEdits
      };
    }
  }

  // =========================================================================
  // 2. CONSTRAINT REMOVAL VIA CHAT (e.g. "شرط سلیمان فلاح رو حذف کن" / "همه شروط رو پاک کن")
  // =========================================================================
  if (hasRemoveConstraintKeyword) {
    let updatedConstraints: ShiftConstraintRule[] = [];
    const appliedEdits: string[] = [];

    if (/همه شروط|تمام شروط|همه ملاحظات/.test(normText) || mentions.length === 0) {
      updatedConstraints = [];
      appliedEdits.push('حذف تمام شروط قبلی و چیدمان مجدد بر اساس حداکثر عدالت');
    } else {
      const removedNames = new Set(mentions.map(m => m.personName));
      updatedConstraints = existingConstraints.filter(c => !removedNames.has(c.personName));
      appliedEdits.push(`حذف ملاحظات مربوط به ${Array.from(removedNames).join('، ')} و بازچینی جدول`);
    }

    const regenResult = generateConstrainedMonth(
      fullSchedule,
      targetYear,
      targetMonthCode,
      allPersonnel,
      updatedConstraints
    );
    regenResult.appliedEdits = appliedEdits;

    return {
      handled: true,
      actionType: 'constraint_schedule',
      hasExplicitMonth: parsed.hasExplicitMonth,
      result: regenResult,
      updatedConstraints,
      appliedEdits
    };
  }

  // =========================================================================
  // 3. CONSTRAINT-BASED SCHEDULING WITH CUMULATIVE MERGING
  // =========================================================================
  if (parsed.isSchedulingIntent) {
    const isFreshReset = /(از اول بدون شرط|فقط با همین شرط|شروط قبلی رو نادیده بگیر)/.test(normText);
    const isAdditiveKeyword = /(\bهم\b|اضافه کن|علاوه بر)/.test(normText);

    let mergedConstraints: ShiftConstraintRule[] = [];
    const appliedEdits: string[] = [];

    if (parsed.constraints.length === 0) {
      mergedConstraints = isFreshReset ? [] : [...existingConstraints];
      appliedEdits.push(`چیدمان هوشمند ماه ${targetMonthName} ${targetYear}`);
    } else if (isFreshReset || (parsed.hasExplicitMonth && parsed.targetMonthCode !== defaultMonthCode && existingConstraints.length > 0 && !isAdditiveKeyword)) {
      mergedConstraints = [...parsed.constraints];
      parsed.constraints.forEach(c => appliedEdits.push(`اعمال شرط: ${c.description}`));
    } else {
      // Cumulative merge with existing constraints (grouped by person so multiple rules for the same person in one message are all kept!)
      mergedConstraints = [...existingConstraints];
      const peopleInNewPrompt = Array.from(new Set(parsed.constraints.map(c => c.personName)));

      for (const personName of peopleInNewPrompt) {
        const newPersonRules = parsed.constraints.filter(c => c.personName === personName);
        const newTypes = new Set(newPersonRules.map(r => r.type));
        const existingPersonPresenceDays = existingConstraints
          .filter(c => c.personName === personName && c.type === 'present_on_days')
          .flatMap(c => c.weekdays || []);

        // Remove any old rules for this person that are superseded or conflict with the newly stated rules
        mergedConstraints = mergedConstraints.filter(oldRule => {
          if (oldRule.personName !== personName) return true;
          if (newTypes.has(oldRule.type)) return false;
          if (oldRule.type === 'auxiliary_role' || oldRule.type === 'auxiliary_day_role') return false;
          if (oldRule.type === 'force_night_on_days' && (newTypes.has('no_night_on_days') || newTypes.has('present_on_days'))) {
            return false;
          }
          return true;
        });

        for (const newRule of newPersonRules) {
          // If the new rule is `no_night_on_days` on a day that is already covered by `present_on_days` for this person,
          // skip adding a redundant `no_night_on_days` for that same day
          if (newRule.type === 'no_night_on_days' && newRule.weekdays && existingPersonPresenceDays.length > 0 && !newTypes.has('present_on_days')) {
            const uncoveredDays = newRule.weekdays.filter(d => !existingPersonPresenceDays.includes(d));
            if (uncoveredDays.length === 0) {
              appliedEdits.push(`حفظ شرط حضور روزانه ${personName} و توزیع عادلانه بین سایر نفرات`);
              continue;
            }
            newRule.weekdays = uncoveredDays;
            newRule.description = buildConstraintDescription({
              personName,
              type: 'no_night_on_days',
              weekdays: uncoveredDays
            });
          }

          const prevSameType = existingConstraints.find(
            c => c.personName === personName && c.type === newRule.type
          );
          if (prevSameType && isAdditiveKeyword && newRule.weekdays && prevSameType.weekdays && !/(فقط)/.test(normText)) {
            const combinedDays = WEEK_DAYS.filter(
              d => prevSameType.weekdays!.includes(d) || newRule.weekdays!.includes(d)
            );
            const updatedRuleBase = {
              personName,
              type: newRule.type,
              weekdays: combinedDays
            };
            const mergedRule: ShiftConstraintRule = {
              ...prevSameType,
              weekdays: combinedDays,
              description: buildConstraintDescription(updatedRuleBase)
            };
            mergedConstraints.push(mergedRule);
            appliedEdits.push(`به‌روزرسانی شرط: ${mergedRule.description}`);
          } else {
            mergedConstraints.push(newRule);
            appliedEdits.push(`اعمال شرط: ${newRule.description}`);
          }
        }
      }
    }

    const regenResult = generateConstrainedMonth(
      fullSchedule,
      targetYear,
      targetMonthCode,
      allPersonnel,
      mergedConstraints
    );
    regenResult.appliedEdits = appliedEdits;

    return {
      handled: true,
      actionType: 'constraint_schedule',
      hasExplicitMonth: parsed.hasExplicitMonth,
      result: regenResult,
      updatedConstraints: mergedConstraints,
      appliedEdits
    };
  }

  return {
    handled: false,
    actionType: 'none',
    hasExplicitMonth: false,
    updatedConstraints: existingConstraints,
    appliedEdits: []
  };
};

