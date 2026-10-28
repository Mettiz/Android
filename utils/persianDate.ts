/**
 * Persian (Jalali) Date Utilities - v1.0.1
 * Strict Asia/Tehran timezone support
 */

export const IRAN_TIMEZONE = 'Asia/Tehran';

export const WEEK_DAYS_PERSIAN = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

/**
 * Converts Jalali year, month, day to Gregorian year, month, day
 */
export function jalaliToGregorian(j_y: number, j_m: number, j_d: number): { gy: number; gm: number; gd: number } {
  let gy = (j_y > 979) ? 1600 : 621;
  j_y = (j_y > 979) ? (j_y - 979) : j_y;
  let days = (365 * j_y) + (Math.floor(j_y / 33) * 8) + Math.floor(((j_y % 33) + 3) / 4) + 78 + j_d + ((j_m < 7) ? (j_m - 1) * 31 : ((j_m - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return { gy, gm, gd };
}

/**
 * Get mathematically accurate Persian day name for any Jalali date
 * e.g. (1405, 6, 17) => 'سه‌شنبه'
 * e.g. (1405, 6, 16) => 'دوشنبه'
 */
export function getDayNameForJalali(jy: number, jm: number, jd: number): string {
  const g = jalaliToGregorian(jy, jm, jd);
  const dt = new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 12, 0, 0));
  // getUTCDay(): 0=Sunday (یک‌شنبه), 1=Monday (دوشنبه), 2=Tuesday (سه‌شنبه), 3=Wednesday (چهارشنبه), 4=Thursday (پنج‌شنبه), 5=Friday (جمعه), 6=Saturday (شنبه)
  const weekDays = ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
  return weekDays[dt.getUTCDay()];
}

/**
 * Returns Persian date string for right now in Asia/Tehran timezone: YYYY/MM/DD
 * (e.g. "1405/06/17")
 */
export function getTodayPersianDateStr(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    timeZone: IRAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(date);
}

/**
 * Returns current Persian date parts in Asia/Tehran timezone
 */
export function getTodayPersianParts(date: Date = new Date()): { year: number; month: string; day: string; monthIndex: number } {
  const str = getTodayPersianDateStr(date);
  const parts = str.split('/');
  const year = parseInt(parts[0], 10) || 1405;
  const month = parts[1] || '06';
  const day = parts[2] || '17';
  const monthIndex = parseInt(month, 10) - 1;
  return { year, month, day, monthIndex };
}

/**
 * Returns current time in Asia/Tehran timezone formatted as Persian digits: HH:MM
 */
export function getTodayPersianTimeStr(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('fa-IR', {
    timeZone: IRAN_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return formatter.format(date);
}

/**
 * Returns current day of week in Persian (e.g. "سه‌شنبه") in Asia/Tehran timezone
 */
export function getTodayPersianWeekday(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('fa-IR', {
    timeZone: IRAN_TIMEZONE,
    weekday: 'long'
  });
  return formatter.format(date);
}

/**
 * Returns current Gregorian date string in Asia/Tehran timezone formatted as DD.MM.YYYY
 * (e.g. "09.09.2026")
 */
export function getTodayGregorianDateStr(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: IRAN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  return formatter.format(date).replace(/\//g, '.');
}

/**
 * Converts English digits to Persian digits
 */
export const toPersianDigits = (s: string | number): string => 
  String(s).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/**
 * Converts Persian and Arabic digits to standard ASCII English digits (0-9)
 */
export const toEnglishDigits = (s: string | number | null | undefined): string => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
};

/**
 * Returns a new Jalali date string (YYYY/MM/DD) offset by `daysToAdd` days
 */
export function getNextJalaliDate(jalaliDate: string, daysToAdd: number = 1): string {
  const parts = jalaliDate.split('/').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return jalaliDate;
  }
  const g = jalaliToGregorian(parts[0], parts[1], parts[2]);
  const dt = new Date(Date.UTC(g.gy, g.gm - 1, g.gd + daysToAdd, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(dt);
}
