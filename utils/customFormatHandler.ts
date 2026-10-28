/**
 * Custom Excel & PDF Format Handler
 * Implements the official production shift schedule format (برنامه شیفت تولید)
 */
import * as XLSX from 'xlsx';
import { ShiftEntry, Personnel } from '../types';
import { OFFICIAL_HOLIDAYS } from '../constants';
import { toPersianDigits, toEnglishDigits, getDayNameForJalali } from './persianDate';

export const SAMPLE_TEMPLATE_PERSONNEL: Personnel[] = [
  { name: 'مهندس لسانی', roles: ['Shift'], isActive: true, color: '#2563eb' },
  { name: 'مهندس دهقان', roles: ['Shift'], isActive: true, color: '#f97316' },
  { name: 'مهندس سلیمان فلاح', roles: ['Shift'], isActive: true, color: '#e11d48' },
  { name: 'مهندس سپهر آرا', roles: ['Shift'], isActive: true, color: '#059669' },
  { name: 'مهندس سالاروند', roles: ['Shift'], isActive: true, color: '#7c3aed' },
  { name: 'مهندس حیدری', roles: ['Shift'], isActive: true, color: '#0284c7' },
  { name: 'آقای رحیمی', roles: ['Shift'], isActive: true, color: '#ca8a04' },
];

export const SHAHRIVAR_TEMPLATE_PERSONNEL: Personnel[] = SAMPLE_TEMPLATE_PERSONNEL;


/**
 * Exact 31-day Production Schedule (26 Mordad to 25 Shahrivar 1405) from Official PDF
 */
export const RAW_SHAHRIVAR_TEMPLATE_DATA = [
  { day: 'دوشنبه', date: '1405/05/26', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا' },
  { day: 'سه‌شنبه', date: '1405/05/27', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند' },
  { day: 'چهارشنبه', date: '1405/05/28', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس لسانی - مهندس حیدری' },
  { day: 'پنج‌شنبه', date: '1405/05/29', dayShift: 'مهندس سالاروند', nightShift: 'مهندس دهقان' },
  { day: 'جمعه', date: '1405/05/30', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح - مهندس حیدری' },
  { day: 'شنبه', date: '1405/05/31', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا' },
  { day: 'یکشنبه', date: '1405/06/01', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند' },
  { day: 'دوشنبه', date: '1405/06/02', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس لسانی - مهندس حیدری' },
  { day: 'سه‌شنبه', date: '1405/06/03', dayShift: 'مهندس سالاروند', nightShift: 'مهندس دهقان' },
  { day: 'چهارشنبه', date: '1405/06/04', dayShift: 'مهندس لسانی', nightShift: 'مهندس سپهر آرا' },
  { day: 'پنج‌شنبه', date: '1405/06/05', dayShift: 'مهندس سالاروند', nightShift: 'مهندس سلیمان فلاح - مهندس حیدری' },
  { day: 'جمعه', date: '1405/06/06', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس سالاروند' },
  { day: 'شنبه', date: '1405/06/07', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس لسانی' },
  { day: 'یکشنبه', date: '1405/06/08', dayShift: 'مهندس سالاروند', nightShift: 'مهندس سپهر آرا' },
  { day: 'دوشنبه', date: '1405/06/09', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح' },
  { day: 'سه‌شنبه', date: '1405/06/10', dayShift: 'مهندس سالاروند', nightShift: 'مهندس حیدری' },
  { day: 'چهارشنبه', date: '1405/06/11', dayShift: 'مهندس سپهر آرا', nightShift: 'آقای رحیمی' },
  { day: 'پنج‌شنبه', date: '1405/06/12', dayShift: 'مهندس حیدری', nightShift: 'مهندس سالاروند' },
  { day: 'جمعه', date: '1405/06/13', dayShift: 'آقای رحیمی', nightShift: 'مهندس دهقان' },
  { day: 'شنبه', date: '1405/06/14', dayShift: 'مهندس سالاروند', nightShift: 'مهندس سپهر آرا' },
  { day: 'یکشنبه', date: '1405/06/15', dayShift: 'مهندس دهقان', nightShift: 'مهندس سلیمان فلاح' },
  { day: 'دوشنبه', date: '1405/06/16', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس سالاروند' },
  { day: 'سه‌شنبه', date: '1405/06/17', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس دهقان' },
  { day: 'چهارشنبه', date: '1405/06/18', dayShift: 'مهندس سالاروند', nightShift: 'مهندس سلیمان فلاح' },
  { day: 'پنج‌شنبه', date: '1405/06/19', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا' },
  { day: 'جمعه', date: '1405/06/20', dayShift: 'مهندس سالاروند', nightShift: 'آقای رحیمی' },
  { day: 'شنبه', date: '1405/06/21', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس حیدری' },
  { day: 'یکشنبه', date: '1405/06/22', dayShift: 'آقای رحیمی', nightShift: 'مهندس سالاروند' },
  { day: 'دوشنبه', date: '1405/06/23', dayShift: 'مهندس حیدری', nightShift: 'مهندس سلیمان فلاح' },
  { day: 'سه‌شنبه', date: '1405/06/24', dayShift: 'مهندس سالاروند', nightShift: 'آقای رحیمی' },
  { day: 'چهارشنبه', date: '1405/06/25', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس دهقان' },
];

export const RAW_TEMPLATE_DATA = [
  { day: 'چهارشنبه', date: '1405/01/26', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح', onCall: 'نامشخص' },
  { day: 'پنج‌شنبه', date: '1405/01/27', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا', onCall: 'نامشخص' },
  { day: 'جمعه', date: '1405/01/28', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند', onCall: 'نامشخص' },
  { day: 'شنبه', date: '1405/01/29', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس لسانی', onCall: 'نامشخص' },
  { day: 'یکشنبه', date: '1405/01/30', dayShift: 'مهندس سالاروند', nightShift: 'مهندس دهقان', onCall: 'نامشخص' },
  { day: 'دوشنبه', date: '1405/01/31', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح', onCall: 'نامشخص' },
  { day: 'سه‌شنبه', date: '1405/02/01', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا', onCall: 'نامشخص' },
  { day: 'چهارشنبه', date: '1405/02/02', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند', onCall: 'نامشخص' },
  { day: 'پنج‌شنبه', date: '1405/02/03', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس لسانی', onCall: 'نامشخص' },
  { day: 'جمعه', date: '1405/02/04', dayShift: 'مهندس سالاروند', nightShift: 'مهندس دهقان', onCall: 'نامشخص' },
  { day: 'شنبه', date: '1405/02/05', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح', onCall: 'نامشخص' },
  { day: 'یکشنبه', date: '1405/02/06', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا', onCall: 'نامشخص' },
  { day: 'دوشنبه', date: '1405/02/07', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند', onCall: 'نامشخص' },
  { day: 'سه‌شنبه', date: '1405/02/08', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس لسانی', onCall: 'نامشخص' },
  { day: 'چهارشنبه', date: '1405/02/09', dayShift: 'مهندس سالاروند', nightShift: 'مهندس دهقان', onCall: 'نامشخص' },
  { day: 'پنج‌شنبه', date: '1405/02/10', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح', onCall: 'نامشخص' },
  { day: 'جمعه', date: '1405/02/11', dayShift: 'مهندس سالاروند', nightShift: 'مهندس سپهر آرا', onCall: 'نامشخص' },
  { day: 'شنبه', date: '1405/02/12', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند', onCall: 'نامشخص' },
  { day: 'یکشنبه', date: '1405/02/13', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس لسانی', onCall: 'نامشخص' },
  { day: 'دوشنبه', date: '1405/02/14', dayShift: 'مهندس سالاروند', nightShift: 'مهندس دهقان', onCall: 'نامشخص' },
  { day: 'سه‌شنبه', date: '1405/02/15', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح', onCall: 'نامشخص' },
  { day: 'چهارشنبه', date: '1405/02/16', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا', onCall: 'نامشخص' },
  { day: 'پنج‌شنبه', date: '1405/02/17', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند', onCall: 'نامشخص' },
  { day: 'جمعه', date: '1405/02/18', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس لسانی', onCall: 'نامشخص' },
  { day: 'شنبه', date: '1405/02/19', dayShift: 'مهندس سالاروند', nightShift: 'مهندس دهقان', onCall: 'نامشخص' },
  { day: 'یکشنبه', date: '1405/02/20', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح', onCall: 'نامشخص' },
  { day: 'دوشنبه', date: '1405/02/21', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا', onCall: 'نامشخص' },
  { day: 'سه‌شنبه', date: '1405/02/22', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند', onCall: 'نامشخص' },
  { day: 'چهارشنبه', date: '1405/02/23', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس لسانی', onCall: 'نامشخص' },
  { day: 'پنج‌شنبه', date: '1405/02/24', dayShift: 'مهندس سالاروند', nightShift: 'مهندس دهقان', onCall: 'نامشخص' },
  { day: 'جمعه', date: '1405/02/25', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح', onCall: 'نامشخص' },
  { day: 'شنبه', date: '1405/02/26', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا', onCall: 'نامشخص' },
  { day: 'یکشنبه', date: '1405/02/27', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند', onCall: 'نامشخص' },
  { day: 'دوشنبه', date: '1405/02/28', dayShift: 'مهندس سپهر آرا', nightShift: 'مهندس لسانی', onCall: 'نامشخص' },
  { day: 'سه‌شنبه', date: '1405/02/29', dayShift: 'مهندس سالاروند', nightShift: 'مهندس دهقان', onCall: 'نامشخص' },
  { day: 'چهارشنبه', date: '1405/02/30', dayShift: 'مهندس لسانی', nightShift: 'مهندس سلیمان فلاح', onCall: 'نامشخص' },
  { day: 'پنج‌شنبه', date: '1405/02/31', dayShift: 'مهندس دهقان', nightShift: 'مهندس سپهر آرا', onCall: 'نامشخص' },
  { day: 'جمعه', date: '1405/03/01', dayShift: 'مهندس سلیمان فلاح', nightShift: 'مهندس سالاروند', onCall: 'نامشخص' },
];

/**
 * Reconnects Persian words that were extracted with spaces between individual letters
 * (e.g. from PDF presentation forms: "ﻣ ﻬ ﻨ ﺪ س ﺳ پ ﻬ ﺮ آرا" -> "مهندس سپهر آرا").
 * Automatically handles Unicode Arabic Presentation Forms-A & Forms-B (\uFB50-\uFEFF),
 * dictionary lookup for personnel & shift terms, and collapse of spaced single Persian characters.
 */
export const reconnectPersianSpacedWords = (str: string): string => {
  if (!str) return '';
  // 1. Unicode NFKC normalization decomposes compatibility glyphs (U+FB50-U+FEFF) into standard base letters
  let text = str.normalize('NFKC');

  // 2. Known domain dictionary replacement for shift personnel & common titles
  const knownReplacements: [RegExp, string][] = [
    [/م\s*ه\s*ن\s*د\s*س/g, 'مهندس'],
    [/[آا]\s*ق\s*ا\s*ی/g, 'آقای'],
    [/خ\s*ا\s*ن\s*م/g, 'خانم'],
    [/د\s*ک\s*ت\s*ر/g, 'دکتر'],
    [/س\s*پ\s*ه\s*ر\s*[آا]\s*ر\s*ا/g, 'سپهر آرا'],
    [/س\s*پ\s*ه\s*ر/g, 'سپهر'],
    [/[آا]\s*ر\s*ا/g, 'آرا'],
    [/س\s*ل\s*ی\s*م\s*[آا]\s*ن/g, 'سلیمان'],
    [/ف\s*ا\s*ل\s*ح|ف\s*ل\s*ا\s*ح/g, 'فلاح'],
    [/ساالروند|س\s*[آا]+\s*ل\s*[آا]*\s*ر\s*و\s*ن\s*د/g, 'سالاروند'],
    [/ح\s*ی\s*د\s*ر\s*ی/g, 'حیدری'],
    [/د\s*ه\s*ق\s*[آا]\s*ن/g, 'دهقان'],
    [/ل\s*س\s*[آا]\s*ن\s*ی/g, 'لسانی'],
    [/ر\s*ح\s*ی\s*م\s*ی/g, 'رحیمی'],
    [/[آا]\s*ک\s*ب\s*ر\s*ی/g, 'اکبری'],
    [/ش\s*ی\s*ف\s*ت/g, 'شیفت'],
    [/ک\s*م\s*ک\s*ی/g, 'کمکی'],
    [/ن\s*ف\s*ر/g, 'نفر'],
    [/د\s*و\s*م/g, 'دوم'],
    [/س\s*و\s*م/g, 'سوم'],
    [/ا\s*و\s*ل/g, 'اول'],
    [/ش\s*ب\s*[آا]\s*ن\s*ه/g, 'شبانه'],
    [/ر\s*و\s*ز\s*[آا]\s*ن\s*ه/g, 'روزانه'],
    [/ت\s*و\s*ل\s*ی\s*د/g, 'تولید'],
    [/و\s*[آا]\s*ک\s*س\s*ن/g, 'واکسن'],
    [/ب\s*ر\s*ن\s*[آا]\s*م\s*ه/g, 'برنامه'],
    [/ت\s*م\s*[آا]\s*م\s*ی/g, 'تمامی'],
    [/ک\s*[آا]\s*ر\s*ش\s*ن\s*[آا]\s*س\s*[آا]\s*ن/g, 'کارشناسان'],
    [/م\s*ی\s*ب\s*[آا]\s*ش\s*ن\s*د/g, 'میباشند'],
    [/ف\s*ر\s*د\s*[آا]\s*ی/g, 'فردای'],
    [/س\s*[آا]\s*ع\s*ت/g, 'ساعت'],
    [/ت\s*[آا]\s*ر\s*ی\s*خ/g, 'تاریخ'],
    [/ا\s*ل\s*ی/g, 'الی'],
    [/س\s*ه\s*[\u200C\s]*ش\s*ن\s*ب\s*ه/g, 'سه‌شنبه'],
    [/چ\s*ه\s*[آا]\s*ر\s*[\u200C\s]*ش\s*ن\s*ب\s*ه/g, 'چهارشنبه'],
    [/پ\s*ن\s*ج\s*[\u200C\s]*ش\s*ن\s*ب\s*ه/g, 'پنج‌شنبه'],
    [/ی\s*ک\s*[\u200C\s]*ش\s*ن\s*ب\s*ه/g, 'یکشنبه'],
    [/د\s*و\s*[\u200C\s]*ش\s*ن\s*ب\s*ه/g, 'دوشنبه'],
    [/ج\s*م\s*ع\s*ه/g, 'جمعه'],
    [/ش\s*ن\s*ب\s*ه/g, 'شنبه']
  ];

  for (const [pattern, repl] of knownReplacements) {
    text = text.replace(pattern, repl);
  }

  // 3. Generic pass: join adjacent single Persian letters (e.g. 'س ل ی م ا ن' -> 'سلیمان')
  const persianChar = '[\\u0600-\\u06FF]';
  const singleCharRegex = new RegExp('(^|\\s)(' + persianChar + ')\\s+(' + persianChar + ')(?=\\s|$)', 'g');
  let prev = '';
  while (prev !== text) {
    prev = text;
    text = text.replace(singleCharRegex, '$1$2$3');
  }

  // 4. Ensure standard space after titles and between compound family names
  text = text
    .replace(/(مهندس|آقای|خانم|دکتر)(?=[\u0600-\u06FF])/g, '$1 ')
    .replace(/سلیمان\s*فلاح/g, 'سلیمان فلاح')
    .replace(/سپهر\s*[آا]را/g, 'سپهر آرا');

  return text.replace(/\s+/g, ' ').trim();
};

/**
 * Normalizes Persian/Arabic strings:
 * Converts Arabic Yeh (ي) to Persian (ی), Kaf (ك) to Persian (ک), cleans whitespace & OCR misspellings,
 * and fixes presentation forms and letter disconnections.
 */
export const normalizePersianText = (str: string): string => {
  if (!str) return '';
  const reconnected = reconnectPersianSpacedWords(str);
  return reconnected
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    // OCR / ligature fixes
    .replace(/فالح/g, 'فلاح')
    .replace(/ساالروند/g, 'سالاروند')
    .replace(/[\u200B\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/یک\s*شنبه|يكشنبه/g, 'یکشنبه')
    .replace(/دو\s*شنبه/g, 'دوشنبه')
    .replace(/سه\s*شنبه|سه\u200Cشنبه|سهشنبه/g, 'سه‌شنبه')
    .replace(/چهار\s*شنبه/g, 'چهارشنبه')
    .replace(/پنج\s*شنبه|پنج\u200Cشنبه|پنجشنبه/g, 'پنج‌شنبه')
    .trim();
};

/**
 * Generates a canonical lookup key for any Persian person name.
 * Strips title prefixes (مهندس, آقای, خانم, دکتر, etc.),
 * normalizes characters (آ/ا, ي/ی, ك/ک), removes all whitespace,
 * ZWNJ, and punctuation.
 * e.g.:
 * - 'مهندس سپهرآرا' -> 'سپهرارا'
 * - 'مهندس سپهر آرا' -> 'سپهرارا'
 * - 'سپهر آرا' -> 'سپهرارا'
 * - 'سپهرآرا' -> 'سپهرارا'
 * - 'مهندس سالاروند' -> 'سالاروند'
 * - 'سالار وند' -> 'سالاروند'
 * - 'مهندس سلیمان فلاح' -> 'سلیمانفلاح'
 * - 'سلیمان فلاح' -> 'سلیمانفلاح'
 */
export const getCanonicalPersonKey = (name: string): string => {
  if (!name) return '';
  let text = normalizePersianText(name);
  
  // Persian & Arabic char normalization
  text = text
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[آأإ]/g, 'ا')
    .replace(/ئ/g, 'ی')
    .replace(/ؤ/g, 'و');

  // Fix known OCR errors
  text = text
    .replace(/فالح/g, 'فلاح')
    .replace(/ساالروند/g, 'سالاروند');

  // Remove common title prefixes
  text = text
    .replace(/^(مهندس|اقای|آقای|خانم|دکتر|جناب\s*آقای|جناب)\s+/g, '')
    .replace(/\s+(مهندس|اقای|آقای|خانم|دکتر)\s+/g, ' ');

  // Remove all spaces, ZWNJ, invisible chars, dashes, punctuation
  text = text.replace(/[\s\u200B-\u200D\uFEFF\u00A0\-\_\.]+/g, '').trim();

  return text;
};

/**
 * Matches a raw input name against a list of known personnel or strings.
 * If a match with the same canonical key exists, returns the established name.
 * e.g. if 'مهندس سپهر آرا' is in known list, raw 'سپهرآرا' returns 'مهندس سپهر آرا'.
 */
export const matchCanonicalPersonName = (
  rawName: string,
  knownList: (Personnel | string)[] = []
): string => {
  if (!rawName || rawName === 'نامشخص') return 'نامشخص';
  const cleanRaw = normalizePersianText(rawName).trim();
  const rawKey = getCanonicalPersonKey(cleanRaw);
  if (!rawKey) return cleanRaw;

  for (const item of knownList) {
    const knownName = typeof item === 'string' ? item : item.name;
    if (!knownName) continue;
    if (getCanonicalPersonKey(knownName) === rawKey) {
      return knownName;
    }
  }

  return cleanRaw;
};

export const PERSIAN_MONTHS_LIST = [
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

export const PERSIAN_DAYS_LIST = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));

export const PERSIAN_YEARS_LIST = ['1403', '1404', '1405', '1406', '1407'];

/**
 * Unifies imported personnel and shifts with existing personnel.
 * Ensures duplicate spellings (e.g. سپهرآرا and سپهر آرا) are merged into one single person.
 * CRITICAL: Existing personnel roles, active status, and custom settings are strictly preserved!
 */
export const unifyPersonnelAndShifts = (
  shifts: ShiftEntry[],
  importedPersonnel: Personnel[] = [],
  existingPersonnel: Personnel[] = []
): {
  unifiedShifts: ShiftEntry[];
  unifiedPersonnel: Personnel[];
  nameMap: Map<string, string>;
} => {
  const nameMap = new Map<string, string>();
  const canonicalMap = new Map<string, Personnel>();

  // 1. Seed with existing personnel (their roles and settings are immutable from imports)
  existingPersonnel.forEach(p => {
    const key = getCanonicalPersonKey(p.name);
    if (!key) return;
    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, { ...p, roles: [...p.roles] });
    }
    nameMap.set(p.name, canonicalMap.get(key)!.name);
  });

  const defaultColors = ['#2563eb', '#f97316', '#e11d48', '#059669', '#7c3aed', '#0891b2', '#ca8a04', '#0284c7', '#4f46e5', '#10b981', '#6366f1'];
  let colorIdx = existingPersonnel.length;

  // 2. Map imported names to existing personnel without altering existing configurations
  importedPersonnel.forEach(ip => {
    const key = getCanonicalPersonKey(ip.name);
    if (!key) return;

    if (canonicalMap.has(key)) {
      const existing = canonicalMap.get(key)!;
      // Map the imported variant spelling to the existing canonical name
      nameMap.set(ip.name, existing.name);
    } else {
      // Register newly discovered personnel from import so helpers are never lost
      const newPerson: Personnel = {
        name: ip.name,
        roles: ip.roles && ip.roles.length > 0 ? [...ip.roles] : ['Shift'],
        isActive: true,
        color: ip.color || defaultColors[colorIdx % defaultColors.length]
      };
      canonicalMap.set(key, newPerson);
      nameMap.set(ip.name, newPerson.name);
      colorIdx++;
    }
  });

  // 3. Scan all shifts (including extra helpers) to discover any candidate missing from importedPersonnel
  shifts.forEach(shift => {
    const candidates = [
      shift.dayShiftPerson,
      shift.nightShiftPerson,
      shift.onCallPerson,
      ...(shift.extraDayPersons || []),
      ...(shift.extraNightPersons || [])
    ];
    candidates.forEach(cand => {
      if (!cand || cand === 'نامشخص' || !isValidPersonCandidate(cand)) return;
      const key = getCanonicalPersonKey(cand);
      if (!key) return;
      if (!canonicalMap.has(key)) {
        const isSupervisor = cand.includes('لسانی') || cand.includes('دکتر');
        const newPerson: Personnel = {
          name: cand,
          roles: isSupervisor ? ['Shift', 'Supervisor'] : ['Shift'],
          isActive: true,
          color: defaultColors[colorIdx % defaultColors.length]
        };
        canonicalMap.set(key, newPerson);
        nameMap.set(cand, newPerson.name);
        colorIdx++;
      }
    });
  });

  // Helper resolver
  const resolve = (name: string): string => {
    if (!name || name === 'نامشخص') return 'نامشخص';
    if (nameMap.has(name)) return nameMap.get(name)!;
    const key = getCanonicalPersonKey(name);
    if (canonicalMap.has(key)) {
      const resolved = canonicalMap.get(key)!.name;
      nameMap.set(name, resolved);
      return resolved;
    }
    return name;
  };

  // 4. Remap all shift entries with unified names
  const unifiedShifts = shifts.map(shift => {
    const dayP = resolve(shift.dayShiftPerson);
    const nightP = resolve(shift.nightShiftPerson);
    const onCallP = resolve(shift.onCallPerson);

    const extraDay = shift.extraDayPersons
      ? shift.extraDayPersons.map(resolve).filter(p => p !== dayP && p !== 'نامشخص')
      : undefined;

    const extraNight = shift.extraNightPersons
      ? shift.extraNightPersons.map(resolve).filter(p => p !== nightP && p !== 'نامشخص')
      : undefined;

    return {
      ...shift,
      dayShiftPerson: dayP,
      nightShiftPerson: nightP,
      onCallPerson: onCallP,
      extraDayPersons: extraDay && extraDay.length > 0 ? Array.from(new Set(extraDay)) : undefined,
      extraNightPersons: extraNight && extraNight.length > 0 ? Array.from(new Set(extraNight)) : undefined,
    };
  });

  // Preserve existing personnel settings, while appending newly discovered helpers
  const unifiedPersonnel = [...existingPersonnel];
  for (const [key, person] of canonicalMap.entries()) {
    const exists = unifiedPersonnel.some(p => getCanonicalPersonKey(p.name) === key);
    if (!exists) {
      unifiedPersonnel.push(person);
    }
  }

  return { unifiedShifts, unifiedPersonnel, nameMap };
};

/**
 * Validates whether a token is a legitimate person candidate (filters out numbers, day name fragments like 'سه', etc.)
 */
export const isValidPersonCandidate = (name: string): boolean => {
  if (!name) return false;
  const normalized = normalizePersianText(name);
  if (/[0-9۰-۹٠-٩\(\)]/.test(normalized)) return false;
  const clean = normalized.replace(/[\s\u200B-\u200D\uFEFF\-\_]/g, '');
  if (clean.length < 3) return false;
  const bannedTokens = [
    'سه', 'شنبه', 'یک', 'دو', 'چهار', 'پنج', 'جمعه',
    'سه‌شنبه', 'دوشنبه', 'یکشنبه', 'پنج‌شنبه', 'چهارشنبه',
    'تاریخ', 'روز', 'شیفت', 'نامشخص', 'الی', 'از', 'برنامه', 'ساعت', 'تمامی', 'کارشناسان', 'میباشند', 'OFF'
  ];
  if (bannedTokens.includes(clean)) return false;
  if (normalized.includes('الی') || normalized.includes('برنامه') || normalized.includes('ساعت') || normalized.toUpperCase().includes('OFF')) {
    return false;
  }
  return true;
};

/**
 * Parse person field supporting single names, delimiters, and multiple helpers
 * e.g. "مهندس سلیمان فلاح - مهندس اکبری - مهندس حیدری" -> primary: "مهندس سلیمان فلاح", extras: ["مهندس اکبری", "مهندس حیدری"]
 * e.g. "مهندس سپهر آرا (کمکی: مهندس حیدری)" -> primary: "مهندس سپهر آرا", extras: ["مهندس حیدری"]
 */
export const parsePersonField = (val: string): { primary: string; extras: string[] } => {
  if (!val) return { primary: 'نامشخص', extras: [] };
  let cleaned = reconnectPersianSpacedWords(val);
  cleaned = normalizePersianText(cleaned)
    .replace(/[\–\—\_]/g, '-')
    .replace(/[،,؛;]/g, ' - ')
    .replace(/\s+&\s+/g, ' - ')
    .replace(/\s+و\s+/g, ' - ')
    .replace(/[\/\\]/g, ' - ')
    .replace(/\n+/g, ' - ')
    .replace(/\(([^)]+)\)/g, ' - $1 - ')
    .replace(/\s*(?:کمکی|نفر\s*دوم|نفر\s*سوم|همکار\s*کمکی|یاور)\s*[:\-–]?\s*/g, ' - ');

  // Split multiple titles if not already separated: e.g. "مهندس دهقان مهندس اکبری"
  cleaned = cleaned.replace(/(?<=\S)\s+(?=(?:مهندس|آقای|اقای|خانم|دکتر)(?:\s|$))/g, ' - ');

  // Split by '+' or '-'
  const tokens = cleaned
    .split(/[\+\-]/)
    .map(s => reconnectPersianSpacedWords(s.trim()))
    .filter(s => isValidPersonCandidate(s));

  if (tokens.length === 0) {
    return { primary: 'نامشخص', extras: [] };
  }

  const primary = tokens[0];
  const extras = tokens
    .slice(1)
    .filter(e => getCanonicalPersonKey(e) !== getCanonicalPersonKey(primary));

  return {
    primary,
    extras,
  };
};

export const getSampleTemplateShifts = (): ShiftEntry[] => {
  return RAW_TEMPLATE_DATA.map((row, idx) => ({
    id: 14050000 + idx + 1,
    dayName: row.day,
    date: row.date,
    dayShiftPerson: row.dayShift,
    nightShiftPerson: row.nightShift,
    onCallPerson: row.onCall,
    isHoliday: row.day === 'جمعه' || OFFICIAL_HOLIDAYS.includes(row.date),
  }));
};

export const getShahrivarTemplateShifts = (): ShiftEntry[] => {
  return RAW_SHAHRIVAR_TEMPLATE_DATA.map((row, idx) => {
    const dayP = parsePersonField(row.dayShift);
    const nightP = parsePersonField(row.nightShift);
    return {
      id: 14050526 + idx,
      dayName: row.day,
      date: row.date,
      dayShiftPerson: dayP.primary,
      extraDayPersons: dayP.extras.length > 0 ? dayP.extras : undefined,
      nightShiftPerson: nightP.primary,
      extraNightPersons: nightP.extras.length > 0 ? nightP.extras : undefined,
      onCallPerson: 'نامشخص',
      isHoliday: row.day === 'جمعه' || OFFICIAL_HOLIDAYS.includes(row.date),
    };
  });
};

/**
 * Exports shift schedule to an Excel file with the EXACT formatting of the provided template:
 * - Green/Light title box: "برنامه شیفت تولید ( ... ماه )"
 * - Columns: روز, تاریخ, شیفت روز ( از ساعت 8 الی 19 ), شیفت شب ( از ساعت 19 الی 8 ), [ON Call optional]
 * - Merged cells for ON Call over consecutive supervisor days
 * - Bottom banner: "تمامی کارشناسان فردای شیفت شب OFF میباشند"
 * - RTL Sheet configuration
 */
export const exportScheduleToExcelFormat = (
  schedule: ShiftEntry[],
  monthLabel: string = 'شهریور',
  includeOnCall: boolean = true
) => {
  if (!schedule || schedule.length === 0) {
    throw new Error('هیچ داده‌ای برای صدور یافت نشد.');
  }

  const wsData: any[][] = [];

  // Check if we actually have distinct onCall persons
  const hasOnCall = includeOnCall && schedule.some(s => s.onCallPerson && s.onCallPerson !== 'نامشخص');
  const numCols = hasOnCall ? 5 : 4;

  const isRangeTitle = monthLabel.includes('/') || monthLabel.includes('الی') || monthLabel.includes('تا') || monthLabel.includes('بازه') || monthLabel.includes('دوره');
  const rawSubtitle = isRangeTitle 
    ? (monthLabel.includes('(') ? monthLabel : `( ${monthLabel} )`)
    : (monthLabel.endsWith('ماه') ? `( ${monthLabel} )` : `( ${monthLabel} ماه )`);
  const headerSubtitle = toPersianDigits(rawSubtitle);

  // Row 1: Title (Columns merged) and optional ON Call Header
  if (hasOnCall) {
    wsData.push([
      `برنامه شیفت تولید\n${headerSubtitle}`,
      '',
      '',
      '',
      'ON Call',
    ]);
  } else {
    wsData.push([
      `برنامه شیفت تولید\n${headerSubtitle}`,
      '',
      '',
      '',
    ]);
  }

  // Row 2: Spacer
  wsData.push(new Array(numCols).fill(''));

  // Row 3: Main Table Headers
  if (hasOnCall) {
    wsData.push([
      'روز',
      'تاریخ',
      'شیفت روز (از ساعت ۸ الی ۱۹)',
      'شیفت شب (از ساعت ۱۹ الی ۸)',
      'ON Call',
    ]);
  } else {
    wsData.push([
      'روز',
      'تاریخ',
      'شیفت روز (از ساعت ۸ الی ۱۹)',
      'شیفت شب (از ساعت ۱۹ الی ۸)',
    ]);
  }

  const startDataRow = 3;
  const onCallMerges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  let currentSupervisor = '';
  let supervisorStartRow = startDataRow;

  schedule.forEach((entry, idx) => {
    const rowIdx = startDataRow + idx;

    // Day Shift label (using '-' connector if multi-person)
    let dayLabel = entry.dayShiftPerson;
    if (entry.extraDayPersons && entry.extraDayPersons.length > 0) {
      dayLabel += ` - ${entry.extraDayPersons.join(' - ')}`;
    }

    // Night Shift label (using '-' connector if multi-person)
    let nightLabel = entry.nightShiftPerson;
    if (entry.extraNightPersons && entry.extraNightPersons.length > 0) {
      nightLabel += ` - ${entry.extraNightPersons.join(' - ')}`;
    }

    const sup = entry.onCallPerson || '';

    if (hasOnCall) {
      // Check consecutive supervisor for merging
      if (idx === 0) {
        currentSupervisor = sup;
        supervisorStartRow = rowIdx;
      } else if (sup !== currentSupervisor) {
        if (rowIdx - 1 > supervisorStartRow) {
          onCallMerges.push({
            s: { r: supervisorStartRow, c: 4 },
            e: { r: rowIdx - 1, c: 4 },
          });
        }
        currentSupervisor = sup;
        supervisorStartRow = rowIdx;
      }

      wsData.push([
        entry.dayName,
        toPersianDigits(entry.date),
        dayLabel,
        nightLabel,
        sup,
      ]);
    } else {
      wsData.push([
        entry.dayName,
        toPersianDigits(entry.date),
        dayLabel,
        nightLabel,
      ]);
    }
  });

  if (hasOnCall) {
    const lastDataRow = startDataRow + schedule.length - 1;
    if (lastDataRow > supervisorStartRow) {
      onCallMerges.push({
        s: { r: supervisorStartRow, c: 4 },
        e: { r: lastDataRow, c: 4 },
      });
    }
  }

  // Footer Row: Notice about OFF day
  const footerRowIdx = wsData.length;
  const footerRow = new Array(numCols).fill('');
  footerRow[0] = 'تمامی کارشناسان فردای شیفت شب OFF میباشند';
  wsData.push(footerRow);

  // Create Sheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merges setup
  const merges = [
    // Title A1:D1
    { s: { r: 0, c: 0 }, e: { r: 0, c: hasOnCall ? 3 : 3 } },
    // Footer A[last]:End[last]
    { s: { r: footerRowIdx, c: 0 }, e: { r: footerRowIdx, c: numCols - 1 } },
    // Vertical onCall merges
    ...onCallMerges,
  ];
  ws['!merges'] = merges;

  // Column Widths
  ws['!cols'] = [
    { wch: 14 }, // روز
    { wch: 15 }, // تاریخ
    { wch: 32 }, // شیفت روز
    { wch: 32 }, // شیفت شب
    ...(hasOnCall ? [{ wch: 22 }] : []), // ON Call
  ];

  // RTL View
  ws['!views'] = [{ RTL: true }];

  // Create Workbook and Download
  const wb = XLSX.utils.book_new();
  const safeSheetName = `شیفت_${monthLabel}`.replace(/[\\\/\?\*\:\[\]]/g, '-').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  const cleanMonth = monthLabel.replace(/[\\\/\?\*\:\[\]\s]/g, '_');
  const filename = `برنامه_شیفت_تولید_${cleanMonth}.xlsx`;
  XLSX.writeFile(wb, filename);

  return filename;
};

/**
 * Enhanced Excel Parser that recognizes all standard and custom shift schedule formats:
 * - Iterates through all sheets to find shift records
 * - Normalizes Persian, Arabic, and English digits (۱۴۰۵ -> 1405)
 * - Recognizes dates formatted with slashes (/), dashes (-), dots (.), and spaces
 * - Supports rich column synonyms in Persian and English
 * - Falls back to per-row dynamic scanning if column headers are shifted or missing
 * - Performs forward-fill on ON Call for merged cells
 * - Extracts and returns discovered personnel, month hints, and date ranges
 */
export const parseExcelSchedule = async (
  file: File,
  knownPersonnel: Personnel[] = []
): Promise<{
  shifts: ShiftEntry[];
  discoveredPersonnel: Personnel[];
  monthHint?: string;
  dateRange?: { from: { year: string; month: string; day: string }; to: { year: string; month: string; day: string } };
}> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { cellDates: false });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('فایل اکسل خالی است و شیت فعالی ندارد.');
  }

  let bestShifts: ShiftEntry[] = [];
  let bestDiscoveredPersonnel: Personnel[] = [];
  let bestMonthHint = '';
  let bestDateRange: { from: { year: string; month: string; day: string }; to: { year: string; month: string; day: string } } | undefined;

  // Regex for Jalali dates (with English digits after conversion)
  // Matches: 1405/05/26, 1405-05-26, 1405.05.26, 1405_05_26, 1405 05 26, 1404/..., 1403/..., 1406/...
  const fullDateRegex = /(1[34]\d{2})[\/\-\.\_\s](\d{1,2})[\/\-\.\_\s](\d{1,2})/;
  const partialDateRegex = /^(\d{1,2})[\/\-\.](\d{1,2})$/;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
    if (!rawRows || rawRows.length < 2) continue;

    // Extract month and year hints from sheet name and top rows
    let sheetMonthHint = '';
    let sheetYearHint = '1405';

    // Check sheet name for year/month
    const normalizedSheetName = normalizePersianText(toEnglishDigits(sheetName));
    const sheetYearMatch = normalizedSheetName.match(/1[34]\d{2}/);
    if (sheetYearMatch) {
      sheetYearHint = sheetYearMatch[0];
    }

    for (let r = 0; r < Math.min(rawRows.length, 6); r++) {
      const rowText = rawRows[r].map(c => normalizePersianText(toEnglishDigits(String(c)))).join(' ');
      const yrMatch = rowText.match(/1[34]\d{2}/);
      if (yrMatch && !sheetYearHint) {
        sheetYearHint = yrMatch[0];
      }
      if (rowText.includes('برنامه شیفت') || rowText.includes('شیفت تولید') || rowText.includes('برنامه') || rowText.includes('ماه')) {
        const parenMatch = rowText.match(/\((.*?)\)/);
        if (parenMatch) {
          sheetMonthHint = parenMatch[1].replace('ماه', '').trim();
        }
      }
    }

    // Identify header row index and column mappings
    let headerRowIdx = -1;
    let dayCol = -1;
    let dateCol = -1;
    let dayShiftCol = -1;
    let nightShiftCol = -1;
    let onCallCol = -1;

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      const normalizedRow = row.map(c => normalizePersianText(toEnglishDigits(String(c))).toLowerCase());
      const rowStr = normalizedRow.join(' ');

      const hasDateKeyword = normalizedRow.some(v => v.includes('تاریخ') || v.includes('date') || v.includes('زمان'));
      const hasShiftKeyword = normalizedRow.some(v => v.includes('شیفت') || v.includes('روز') || v.includes('شب') || v.includes('shift'));

      if (hasDateKeyword && hasShiftKeyword) {
        headerRowIdx = r;
        normalizedRow.forEach((val, cIdx) => {
          if (val === 'روز' || val === 'نام روز' || val === 'روز هفته' || val === 'day' || val === 'weekday') {
            dayCol = cIdx;
          } else if (val.includes('تاریخ') || val.includes('date') || val.includes('tarikh') || val.includes('زمان')) {
            dateCol = cIdx;
          } else if (
            val.includes('شیفت روز') || 
            val.includes('شیفت روزانه') || 
            val.includes('روز ( از ساعت') || 
            val.includes('روز ) از ساعت') || 
            val.includes('day shift') || 
            val.includes('dayshift') || 
            val.includes('شیفت صبح') || 
            val.includes('صبح') || 
            val === 'شیفت ۱' || 
            val === 'شیفت 1' ||
            val === 'نوبت صبح'
          ) {
            dayShiftCol = cIdx;
          } else if (
            val.includes('شیفت شب') || 
            val.includes('شیفت شبانه') || 
            val.includes('شب ( از ساعت') || 
            val.includes('شب ) از ساعت') || 
            val.includes('night shift') || 
            val.includes('nightshift') || 
            val.includes('شیفت عصر') || 
            val.includes('عصر') || 
            val === 'شیفت ۲' || 
            val === 'شیفت 2' ||
            val === 'نوبت شب'
          ) {
            nightShiftCol = cIdx;
          } else if (
            val.includes('on call') || 
            val.includes('oncall') || 
            val.includes('on-call') || 
            val.includes('آن کال') || 
            val.includes('آنکال') || 
            val.includes('ان کال') || 
            val.includes('انکال') || 
            val.includes('سرپرست') || 
            val.includes('کشیک') || 
            val.includes('سوپروایزر') || 
            val.includes('مسئول') || 
            val.includes('supervisor')
          ) {
            onCallCol = cIdx;
          }
        });
        break;
      }
    }

    const currentSheetShifts: ShiftEntry[] = [];
    const shiftPeople = new Set<string>();
    const supervisors = new Set<string>();
    let activeSupervisor = '';

    const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

    for (let r = startRow; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      // Stop or skip known footer rows / disclaimers
      const firstCell = normalizePersianText(toEnglishDigits(String(row[0] || '')));
      if (
        firstCell.includes('تمامی کارشناسان') || 
        firstCell.includes('off میباشند') || 
        firstCell.includes('امضا') || 
        firstCell.includes('تایید')
      ) {
        continue;
      }

      // Check if this row is an accidental duplicate header row
      const isHeaderRepeat = row.some((c: any) => {
        const text = normalizePersianText(String(c));
        return text === 'تاریخ' || text === 'شیفت روز' || text === 'شیفت شب';
      });
      if (isHeaderRepeat) continue;

      // 1. Locate Date in the row
      let foundDateStr = '';
      let matchedDateCol = dateCol;

      if (dateCol !== -1 && row[dateCol] !== undefined) {
        const cellVal = toEnglishDigits(String(row[dateCol])).trim();
        const m = cellVal.match(fullDateRegex);
        if (m) {
          foundDateStr = `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
        } else {
          const pm = cellVal.match(partialDateRegex);
          if (pm) {
            foundDateStr = `${sheetYearHint}/${pm[1].padStart(2, '0')}/${pm[2].padStart(2, '0')}`;
          }
        }
      }

      // If designated date column did not match, scan all cells in this row
      if (!foundDateStr) {
        for (let c = 0; c < row.length; c++) {
          const cellVal = toEnglishDigits(String(row[c] || '')).trim();
          const m = cellVal.match(fullDateRegex);
          if (m) {
            foundDateStr = `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`;
            matchedDateCol = c;
            break;
          }
        }
      }

      if (!foundDateStr) {
        // Skip rows without a recognizable date
        continue;
      }

      // 2. Extract Year, Month, Day numbers
      const dateParts = foundDateStr.split('/');
      const y = parseInt(dateParts[0], 10);
      const m = parseInt(dateParts[1], 10);
      const d = parseInt(dateParts[2], 10);
      const calculatedDayName = (y && m && d) ? getDayNameForJalali(y, m, d) : 'نامشخص';

      // 3. Locate Day Name in row
      let foundDayName = '';
      if (dayCol !== -1 && row[dayCol] !== undefined) {
        const dText = normalizePersianText(String(row[dayCol])).trim();
        if (dText && dText !== 'نامشخص' && !dText.includes('/')) {
          foundDayName = dText;
        }
      }
      if (!foundDayName) {
        // Search other cells for Persian weekday
        for (let c = 0; c < row.length; c++) {
          if (c === matchedDateCol) continue;
          const text = normalizePersianText(String(row[c] || '')).trim();
          if (['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'].includes(text)) {
            foundDayName = text;
            break;
          }
        }
      }
      const finalDayName = foundDayName || calculatedDayName;

      // 4. Extract Day Shift, Night Shift, and On Call
      let dayShiftRaw = '';
      let nightShiftRaw = '';
      let onCallRaw = '';

      if (dayShiftCol !== -1 && row[dayShiftCol] !== undefined) {
        dayShiftRaw = normalizePersianText(String(row[dayShiftCol])).trim();
      }
      if (nightShiftCol !== -1 && row[nightShiftCol] !== undefined) {
        nightShiftRaw = normalizePersianText(String(row[nightShiftCol])).trim();
      }
      if (onCallCol !== -1 && row[onCallCol] !== undefined) {
        onCallRaw = normalizePersianText(String(row[onCallCol])).trim();
      }

      // If column positions were not matched from header, dynamically map from remaining candidate text cells
      if (!dayShiftRaw && !nightShiftRaw) {
        const textCandidates: { col: number; val: string }[] = [];
        row.forEach((cell: any, cIdx: number) => {
          if (cIdx === matchedDateCol || cIdx === dayCol) return;
          const str = normalizePersianText(String(cell || '')).trim();
          if (str && !str.match(fullDateRegex) && !['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'].includes(str)) {
            textCandidates.push({ col: cIdx, val: str });
          }
        });

        if (textCandidates.length >= 1) dayShiftRaw = textCandidates[0].val;
        if (textCandidates.length >= 2) nightShiftRaw = textCandidates[1].val;
        if (textCandidates.length >= 3) onCallRaw = textCandidates[2].val;
      }

      // Forward-fill active supervisor if cell is merged/blank
      if (onCallRaw && onCallRaw !== 'نامشخص') {
        activeSupervisor = onCallRaw;
      }

      const dayP = parsePersonField(dayShiftRaw);
      const nightP = parsePersonField(nightShiftRaw);

      if (dayP.primary && dayP.primary !== 'نامشخص') shiftPeople.add(dayP.primary);
      dayP.extras.forEach(extra => shiftPeople.add(extra));

      if (nightP.primary && nightP.primary !== 'نامشخص') shiftPeople.add(nightP.primary);
      nightP.extras.forEach(extra => shiftPeople.add(extra));

      if (activeSupervisor && activeSupervisor !== 'نامشخص' && isValidPersonCandidate(activeSupervisor)) {
        supervisors.add(activeSupervisor);
      }

      currentSheetShifts.push({
        id: Math.floor(Math.random() * 90000000) + 10000000,
        date: foundDateStr,
        dayName: finalDayName,
        dayShiftPerson: dayP.primary || 'نامشخص',
        extraDayPersons: dayP.extras.length > 0 ? dayP.extras : undefined,
        nightShiftPerson: nightP.primary || 'نامشخص',
        extraNightPersons: nightP.extras.length > 0 ? nightP.extras : undefined,
        onCallPerson: activeSupervisor || 'نامشخص',
        isHoliday: finalDayName === 'جمعه' || calculatedDayName === 'جمعه' || OFFICIAL_HOLIDAYS.includes(foundDateStr),
      });
    }

    if (currentSheetShifts.length > bestShifts.length) {
      bestShifts = currentSheetShifts;
      bestMonthHint = sheetMonthHint;

      // Build discovered personnel list with vibrant colors
      const defaultColors = ['#2563eb', '#f97316', '#e11d48', '#059669', '#7c3aed', '#0891b2', '#ca8a04', '#0284c7', '#4f46e5'];
      let cIdx = 0;
      const discoveredPersonnel: Personnel[] = [];

      shiftPeople.forEach(name => {
        discoveredPersonnel.push({
          name,
          roles: ['Shift'],
          isActive: true,
          color: defaultColors[cIdx % defaultColors.length],
        });
        cIdx++;
      });

      supervisors.forEach(name => {
        const existing = discoveredPersonnel.find(p => getCanonicalPersonKey(p.name) === getCanonicalPersonKey(name));
        if (existing) {
          if (!existing.roles.includes('Supervisor')) {
            existing.roles.push('Supervisor');
          }
        } else {
          discoveredPersonnel.push({
            name,
            roles: ['Supervisor'],
            isActive: true,
            color: '#0d9488',
          });
        }
      });

      bestDiscoveredPersonnel = discoveredPersonnel;
    }
  }

  if (bestShifts.length === 0) {
    throw new Error('هیچ شیفت معتبری در فایل اکسل شناسایی نشد. لطفاً بررسی کنید که فایل دارای ستون تاریخ شمسی (مانند ۱۴۰۵/۰۶/۰۱) و نام کارشناسان باشد.');
  }

  // Sort shifts chronologically
  bestShifts.sort((a, b) => a.date.localeCompare(b.date));

  if (bestShifts.length > 0) {
    const firstDateParts = bestShifts[0].date.split('/');
    const lastDateParts = bestShifts[bestShifts.length - 1].date.split('/');
    bestDateRange = {
      from: { year: firstDateParts[0], month: firstDateParts[1], day: firstDateParts[2] },
      to: { year: lastDateParts[0], month: lastDateParts[1], day: lastDateParts[2] },
    };
  }

  // Unify duplicate names (e.g. سپهرآرا vs سپهر آرا) and map them accurately
  const { unifiedShifts, unifiedPersonnel } = unifyPersonnelAndShifts(
    bestShifts,
    bestDiscoveredPersonnel,
    knownPersonnel
  );

  return { 
    shifts: unifiedShifts, 
    discoveredPersonnel: unifiedPersonnel, 
    monthHint: bestMonthHint, 
    dateRange: bestDateRange 
  };
};

