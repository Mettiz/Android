/**
 * PDF Parser for Production Shift Schedule
 * Extracts shifts, dates, multi-person assignments, and personnel with high fidelity.
 * Fully supports Persian and English numerals, column-aware layout extraction, and vertical supervisors.
 */

// Universal polyfills for pdfjs-dist compatibility in diverse browser and webview environments
if (typeof Promise !== 'undefined' && !(Promise as any).try) {
  (Promise as any).try = function (fn: (...args: any[]) => any, ...args: any[]) {
    return new Promise((resolve) => {
      resolve(fn(...args));
    });
  };
}

if (typeof Uint8Array !== 'undefined' && !(Uint8Array.prototype as any).toHex) {
  (Uint8Array.prototype as any).toHex = function () {
    return Array.from(this)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');
  };
}

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ShiftEntry, Personnel, DateParts } from '../types';
import { OFFICIAL_HOLIDAYS } from '../constants';
import { 
  normalizePersianText, 
  reconnectPersianSpacedWords,
  parsePersonField, 
  getCanonicalPersonKey, 
  matchCanonicalPersonName, 
  unifyPersonnelAndShifts,
  isValidPersonCandidate
} from './customFormatHandler';
import { getDayNameForJalali } from './persianDate';

export { isValidPersonCandidate };

// Configure pdfjs worker safely for standalone Android APK and browser client
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
}

/**
 * Normalizes all Persian (۰-۹) and Arabic (٠-٩) numerals to standard ASCII digits (0-9)
 */
export function toAsciiDigits(str: string): string {
  if (!str) return '';
  return str
    .replace(/[۰٠]/g, '0')
    .replace(/[۱١]/g, '1')
    .replace(/[۲٢]/g, '2')
    .replace(/[۳٣]/g, '3')
    .replace(/[۴٤]/g, '4')
    .replace(/[۵٥]/g, '5')
    .replace(/[۶٦]/g, '6')
    .replace(/[۷٧]/g, '7')
    .replace(/[۸٨]/g, '8')
    .replace(/[۹٩]/g, '9');
}

/**
 * Fallback binary text extractor in case worker is restricted
 */
function extractTextFromBinaryPdf(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer.slice(0));
    let binaryStr = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binaryStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }

    const textPieces: string[] = [];
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(binaryStr)) !== null) {
      if (match[1]) textPieces.push(match[1]);
    }

    const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(binaryStr)) !== null) {
      const inner = match[1];
      const innerMatches = inner.match(/\(([^)]+)\)/g);
      if (innerMatches) {
        textPieces.push(innerMatches.map(m => m.slice(1, -1)).join(' '));
      }
    }

    const decodedPieces = textPieces.map(t => {
      try {
        const charBytes = new Uint8Array(t.length);
        for (let j = 0; j < t.length; j++) {
          charBytes[j] = t.charCodeAt(j) & 0xff;
        }
        return new TextDecoder('utf-8', { fatal: false }).decode(charBytes);
      } catch {
        return t;
      }
    });

    return decodedPieces.join('\n');
  } catch (err) {
    console.warn('Binary PDF extraction fallback error:', err);
    return '';
  }
}

export const PERSIAN_DAY_NAMES = ['سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'یکشنبه', 'دوشنبه', 'جمعه', 'شنبه'];
export const PERSIAN_DAY_REGEX = /(سه‌\s*شنبه|سه\s*شنبه|سه‌شنبه|چهارشنبه|پنج‌\s*شنبه|پنج\s*شنبه|پنج‌شنبه|یک\s*شنبه|يكشنبه|یکشنبه|دو\s*شنبه|دوشنبه|جمعه|شنبه)/gi;

export const normalizePersianDayName = (str: string): string => {
  if (!str) return 'نامشخص';
  const clean = str.replace(/[\s\u200B-\u200D\uFEFF]/g, '').replace(/ي/g, 'ی');
  if (clean.includes('سه')) return 'سه‌شنبه';
  if (clean.includes('چهار')) return 'چهارشنبه';
  if (clean.includes('پنج')) return 'پنج‌شنبه';
  if (clean.includes('یک')) return 'یکشنبه';
  if (clean.includes('دو')) return 'دوشنبه';
  if (clean.includes('جمعه')) return 'جمعه';
  if (clean.includes('شنبه')) return 'شنبه';
  return str.trim();
};

/**
 * Joins PDF text items along a horizontal row (sorted right-to-left by X coordinate).
 * When individual Persian letters/syllables are close together (dx < 11.5), concatenates them
 * directly without inserting artificial spaces; inserts a space across word or delimiter gaps.
 */
export function joinRowItemsByX(items: { x: number; text: string }[]): string {
  if (!items || items.length === 0) return '';
  const sorted = [...items].sort((a, b) => b.x - a.x);
  let result = sorted[0].text;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const dx = prev.x - curr.x;

    const isDelimiter = /^[\-\–\—\+\/\(\)]+$/.test(prev.text) || /^[\-\–\—\+\/\(\)]+$/.test(curr.text);
    const isAsciiOrDigit = /[0-9A-Za-z]/.test(prev.text) || /[0-9A-Za-z]/.test(curr.text);

    // Individual Persian glyphs within the same word typically have X step of 2.5 to 10.5 units
    if (!isDelimiter && !isAsciiOrDigit && dx > 0 && dx < 11.5 && prev.text.length <= 3 && curr.text.length <= 3) {
      result += curr.text;
    } else {
      result += ' ' + curr.text;
    }
  }

  return result;
}

/**
 * Clean & normalize text specifically for shift schedule lines.
 * Automatically normalizes Persian/Arabic digits, collapses spaced dates, and removes shift hour labels.
 */
export function cleanScheduleLineText(str: string): string {
  if (!str) return '';
  const reconnected = reconnectPersianSpacedWords(str);
  let res = toAsciiDigits(reconnected)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    // Fix known PDF font ligature / OCR issues in Persian names
    .replace(/فالح/g, 'فلاح')
    .replace(/ساالروند/g, 'سالاروند')
    // Normalize dashes and connectors
    .replace(/[\–\—]/g, '-')
    .replace(/[\u200B\u200D\uFEFF]/g, '');

  // Normalize spaces around dates: "1405 / 06 / 26" or "1405 - 06 - 26" -> "1405/06/26"
  res = res.replace(/([0-9]{4})\s*[\/\-]\s*([0-9]{1,2})\s*[\/\-]\s*([0-9]{1,2})/g, '$1/$2/$3');
  // Reverse dates: "26 / 06 / 1405" -> "1405/06/26"
  res = res.replace(/([0-9]{1,2})\s*[\/\-]\s*([0-9]{1,2})\s*[\/\-]\s*(14[0-9]{2})/g, '$3/$2/$1');

  // Strip shift hours like "(از ساعت 8 الی 19)" so they don't interfere
  res = res.replace(/\(?\s*از\s*ساعت\s*[0-9]+\s*الی\s*[0-9]+\s*\)?/gi, ' ');

  res = res
    .replace(/\s+/g, ' ')
    .replace(/یک\s*شنبه|يكشنبه/g, 'یکشنبه')
    .replace(/دو\s*شنبه/g, 'دوشنبه')
    .replace(/سه\s*شنبه|سه\u200Cشنبه|سهشنبه/g, 'سه‌شنبه')
    .replace(/چهار\s*شنبه/g, 'چهارشنبه')
    .replace(/پنج\s*شنبه|پنج\u200Cشنبه|پنجشنبه/g, 'پنج‌شنبه')
    .trim();

  return res;
}

/**
 * Tokenize shift line into distinct column segments.
 * Correctly distinguishes Day Shift, Night Shift, and ON Call supervisor.
 */
export function extractShiftColumnsFromLine(
  remainingText: string,
  knownSupervisors: Set<string>
): { dayShift: string; nightShift: string; onCall: string } {
  let text = cleanScheduleLineText(remainingText);
  if (!text) return { dayShift: '', nightShift: '', onCall: '' };

  let onCall = '';

  // Protect hyphenated pairs and slash connectors so they stay within shift entities
  text = text.replace(/\s*[\-–—]\s*/g, '__LINK__');
  text = text.replace(/\s*[\/]\s*/g, '__LINK__');

  const words = text.split(/\s+/).filter(w => w.length > 0);
  const rawEntities: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isNewTitle = (word === 'مهندس' || word === 'آقای' || word === 'خانم' || word === 'دکتر');

    if (isNewTitle && current && !current.endsWith('__LINK__')) {
      rawEntities.push(current.replace(/__LINK__/g, ' - ').trim());
      current = word;
    } else if (current) {
      current += ' ' + word;
    } else {
      current = word;
    }
  }

  if (current) {
    rawEntities.push(current.replace(/__LINK__/g, ' - ').trim());
  }

  // Filter entities: only keep valid candidates with person characteristics (strip out 'سه', 'شنبه', numbers, etc.)
  const cleanEntities = rawEntities
    .map(e => e.replace(/__LINK__/g, ' - ').trim())
    .filter(e => isValidPersonCandidate(e));

  let dayShift = '';
  let nightShift = '';

  if (cleanEntities.length === 1) {
    dayShift = cleanEntities[0];
  } else if (cleanEntities.length === 2) {
    dayShift = cleanEntities[0];
    nightShift = cleanEntities[1];
  } else if (cleanEntities.length >= 3) {
    dayShift = cleanEntities[0];
    nightShift = cleanEntities[1];

    // Check entity 3 and beyond
    for (let k = 2; k < cleanEntities.length; k++) {
      const extra = cleanEntities[k];
      const isKnownSup = Array.from(knownSupervisors).some(
        s => getCanonicalPersonKey(s) === getCanonicalPersonKey(extra)
      );

      if (isKnownSup && !onCall) {
        onCall = extra;
      } else {
        // It is an extra shift worker (multi-person), append to night shift with hyphen separator
        nightShift = nightShift ? `${nightShift} - ${extra}` : extra;
      }
    }
  }

  return { dayShift, nightShift, onCall };
}

export interface ParsePdfResult {
  shifts: ShiftEntry[];
  discoveredPersonnel: Personnel[];
  monthHint?: string;
  dateRange?: {
    from: DateParts;
    to: DateParts;
  };
}

interface PdfRowGroup {
  y: number;
  items: { x: number; text: string }[];
}

/**
 * Universal PDF Buffer Parser
 * Runs seamlessly on both Node.js server and browser clients.
 */
export async function parsePdfBuffer(
  bufferInput: ArrayBuffer | Uint8Array | any,
  knownPersonnel: Personnel[] = []
): Promise<ParsePdfResult> {
  const rowGroups: PdfRowGroup[] = [];
  const allItems: { x: number; y: number; text: string }[] = [];
  let sheetWideSupervisor = '';

  // Ensure ArrayBuffer slice
  let rawBytes: Uint8Array;
  if (bufferInput instanceof Uint8Array) {
    rawBytes = new Uint8Array(bufferInput.buffer.slice(bufferInput.byteOffset, bufferInput.byteOffset + bufferInput.byteLength));
  } else if (bufferInput instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(bufferInput.slice(0));
  } else if (bufferInput && bufferInput.buffer instanceof ArrayBuffer) {
    rawBytes = new Uint8Array(bufferInput.buffer.slice(bufferInput.byteOffset, bufferInput.byteOffset + bufferInput.length));
  } else {
    rawBytes = new Uint8Array(bufferInput);
  }

  // Collect known supervisor names
  const knownSupervisorNames = new Set<string>();
  knownSupervisorNames.add('مهندس لسانی'); // Standard team supervisor
  knownPersonnel.forEach(p => {
    if (p.roles.includes('Supervisor')) {
      knownSupervisorNames.add(p.name);
    }
  });

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: rawBytes,
      useSystemFonts: true,
      stopAtErrors: false,
    });

    const pdf = await loadingTask.promise;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Detect sheet-wide supervisor in OnCall column (x < 130 in standard layouts)
      for (const item of textContent.items as any[]) {
        if (!item || !item.str) continue;
        const str = cleanScheduleLineText(item.str);
        const tx = item.transform ? item.transform[4] : 0;
        const ty = item.transform ? item.transform[5] : 0;

        allItems.push({ x: tx, y: ty, text: str });

        if (tx < 130 && (str.includes('لسانی') || str.startsWith('مهندس') || str.startsWith('دکتر'))) {
          if (!str.toLowerCase().includes('call') && !str.includes('شیفت')) {
            sheetWideSupervisor = str;
            knownSupervisorNames.add(sheetWideSupervisor);
          }
        }
      }

      // Group text items by Y coordinate with 5-unit vertical tolerance
      for (const item of textContent.items as any[]) {
        if (!item || typeof item.str !== 'string') continue;
        const text = item.str.trim();
        if (!text) continue;

        const tx = item.transform ? item.transform[4] : 0;
        const ty = item.transform ? item.transform[5] : 0;

        let matchedGroup = rowGroups.find(g => Math.abs(g.y - ty) < 5.0);
        if (!matchedGroup) {
          matchedGroup = { y: ty, items: [] };
          rowGroups.push(matchedGroup);
        }
        matchedGroup.items.push({ x: tx, text });
      }
    }
  } catch (workerErr) {
    console.warn('pdfjs extraction failed, attempting binary text extraction:', workerErr);
    const fallbackText = extractTextFromBinaryPdf(rawBytes.buffer as ArrayBuffer);
    const lines = fallbackText.split(/[\r\n]+/);
    lines.forEach((l, idx) => {
      const cleaned = cleanScheduleLineText(l);
      if (cleaned) {
        rowGroups.push({
          y: 1000 - idx * 20,
          items: [{ x: 500, text: cleaned }]
        });
      }
    });
  }

  // Sort rows top-to-bottom
  rowGroups.sort((a, b) => b.y - a.y);

  // Pre-scan OnCall column (x < 105) across all rows to detect vertically centered merged supervisor
  for (const group of rowGroups) {
    const onCallItems = group.items.filter(it => it.x < 105);
    if (onCallItems.length > 0) {
      const candidateSup = cleanScheduleLineText(joinRowItemsByX(onCallItems));
      if (
        candidateSup &&
        !candidateSup.toLowerCase().includes('call') &&
        !candidateSup.includes('شیفت') &&
        isValidPersonCandidate(candidateSup)
      ) {
        sheetWideSupervisor = candidateSup;
        knownSupervisorNames.add(candidateSup);
        break;
      }
    }
  }

  // Match dates in either ASCII (14xx/xx/xx) or Persian/Arabic digits
  const dateRegex = /(14[0-9]{2}[\/\-][0-9]{1,2}[\/\-][0-9]{1,2})/;

  const parsedShifts: ShiftEntry[] = [];
  const discoveredShiftPeople = new Set<string>();
  const discoveredSupervisors = new Set<string>();
  if (sheetWideSupervisor) {
    discoveredSupervisors.add(sheetWideSupervisor);
  }

  let activeSupervisor = sheetWideSupervisor || 'مهندس لسانی';

  for (const group of rowGroups) {
    // Sort items right-to-left
    group.items.sort((a, b) => b.x - a.x);
    const fullRowText = joinRowItemsByX(group.items);
    let cleanedRowText = cleanScheduleLineText(fullRowText);

    if (!cleanedRowText) continue;

    // Ignore headers, footers, and date-range title banners like "( از 1405/06/26 الی 1405/07/25 )"
    if (
      (cleanedRowText.includes('الی') && cleanedRowText.includes('از')) ||
      cleanedRowText.includes('برنامه شیفت') ||
      cleanedRowText.includes('OFF میباشند') ||
      cleanedRowText.includes('تمامی کارشناسان')
    ) {
      continue;
    }

    const dateMatch = cleanedRowText.match(dateRegex);
    if (!dateMatch) continue;

    const rawDate = dateMatch[1].replace(/\-/g, '/');
    const dateParts = rawDate.split('/');
    if (dateParts.length < 3) continue;

    const formattedDate = `${dateParts[0]}/${dateParts[1].padStart(2, '0')}/${dateParts[2].padStart(2, '0')}`;

    // Extract Day Name
    const dayMatch = cleanedRowText.match(PERSIAN_DAY_REGEX);
    const calculatedDayName = getDayNameForJalali(
      parseInt(dateParts[0], 10),
      parseInt(dateParts[1], 10),
      parseInt(dateParts[2], 10)
    );
    const dayName = dayMatch ? normalizePersianDayName(dayMatch[0]) : (calculatedDayName || 'نامشخص');

    // Attempt column-based layout extraction using X coordinates:
    // Day Name: x >= 510
    // Date: 445 <= x < 510
    // Day Shift: 280 <= x < 445 (supports wide two-person cells like "مهندس سلیمان فلاح - آقای رحیمی")
    // Night Shift: 105 <= x < 280 (supports wide two-person cells like "مهندس سلیمان فلاح - مهندس حیدری")
    // OnCall Supervisor: x < 105
    const dayShiftItems = group.items.filter(it => it.x >= 280 && it.x < 445);
    const nightShiftItems = group.items.filter(it => it.x >= 105 && it.x < 280);
    const onCallItems = group.items.filter(it => it.x < 105);

    let dayShiftStr = joinRowItemsByX(dayShiftItems);
    let nightShiftStr = joinRowItemsByX(nightShiftItems);
    let onCallStr = joinRowItemsByX(onCallItems);

    // Fallback: If X-coordinate boundaries were shifted, use smart entity tokenization
    if (!dayShiftStr && !nightShiftStr) {
      let remaining = cleanedRowText.replace(dateMatch[1], ' ');
      if (dayMatch) {
        remaining = remaining.replace(dayMatch[0], ' ');
      }
      remaining = remaining
        .replace(/روز/g, '')
        .replace(/تاریخ/g, '')
        .replace(/ON Call/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      const extracted = extractShiftColumnsFromLine(remaining, knownSupervisorNames);
      dayShiftStr = extracted.dayShift;
      nightShiftStr = extracted.nightShift;
      if (extracted.onCall) onCallStr = extracted.onCall;
    }

    dayShiftStr = cleanScheduleLineText(dayShiftStr);
    nightShiftStr = cleanScheduleLineText(nightShiftStr);
    onCallStr = cleanScheduleLineText(onCallStr);

    if (onCallStr && isValidPersonCandidate(onCallStr)) {
      activeSupervisor = onCallStr;
      discoveredSupervisors.add(onCallStr);
    }

    // Parse multi-person assignments
    const dayParsed = parsePersonField(dayShiftStr);
    const nightParsed = parsePersonField(nightShiftStr);

    if (dayParsed.primary && dayParsed.primary !== 'نامشخص' && isValidPersonCandidate(dayParsed.primary)) {
      discoveredShiftPeople.add(dayParsed.primary);
    }
    dayParsed.extras.forEach(extra => {
      if (isValidPersonCandidate(extra)) discoveredShiftPeople.add(extra);
    });

    if (nightParsed.primary && nightParsed.primary !== 'نامشخص' && isValidPersonCandidate(nightParsed.primary)) {
      discoveredShiftPeople.add(nightParsed.primary);
    }
    nightParsed.extras.forEach(extra => {
      if (isValidPersonCandidate(extra)) discoveredShiftPeople.add(extra);
    });

    parsedShifts.push({
      id: Math.floor(Math.random() * 90000000) + 10000000,
      date: formattedDate,
      dayName,
      dayShiftPerson: dayParsed.primary || 'نامشخص',
      extraDayPersons: dayParsed.extras.length > 0 ? dayParsed.extras : undefined,
      nightShiftPerson: nightParsed.primary || 'نامشخص',
      extraNightPersons: nightParsed.extras.length > 0 ? nightParsed.extras : undefined,
      onCallPerson: activeSupervisor || sheetWideSupervisor || 'مهندس لسانی',
      isHoliday: dayName === 'جمعه' || OFFICIAL_HOLIDAYS.includes(formattedDate),
    });
  }

  // Emergency Fallback: If rowGroups yielded 0 shifts, scan allItems directly
  if (parsedShifts.length === 0 && allItems.length > 0) {
    for (const item of allItems) {
      const cleaned = cleanScheduleLineText(item.text);
      const m = cleaned.match(dateRegex);
      if (m && !cleaned.includes('الی')) {
        const rawDate = m[1].replace(/\-/g, '/');
        const parts = rawDate.split('/');
        if (parts.length === 3) {
          const formattedDate = `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`;
          const dayName = getDayNameForJalali(parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)) || 'نامشخص';
          
          // Find text items on the same or adjacent Y coordinate
          const sameYItems = allItems.filter(it => Math.abs(it.y - item.y) < 6 && it !== item);
          sameYItems.sort((a, b) => b.x - a.x);
          const rowText = sameYItems.map(it => cleanScheduleLineText(it.text)).join(' ');
          const extracted = extractShiftColumnsFromLine(rowText, knownSupervisorNames);
          const dayParsed = parsePersonField(extracted.dayShift);
          const nightParsed = parsePersonField(extracted.nightShift);

          parsedShifts.push({
            id: Math.floor(Math.random() * 90000000) + 10000000,
            date: formattedDate,
            dayName,
            dayShiftPerson: dayParsed.primary || 'نامشخص',
            extraDayPersons: dayParsed.extras.length > 0 ? dayParsed.extras : undefined,
            nightShiftPerson: nightParsed.primary || 'نامشخص',
            extraNightPersons: nightParsed.extras.length > 0 ? nightParsed.extras : undefined,
            onCallPerson: extracted.onCall || activeSupervisor || 'مهندس لسانی',
            isHoliday: dayName === 'جمعه' || OFFICIAL_HOLIDAYS.includes(formattedDate),
          });
        }
      }
    }
  }

  // Deduplicate by date
  const shiftMap = new Map<string, ShiftEntry>();
  for (const s of parsedShifts) {
    shiftMap.set(s.date, s);
  }
  const finalShifts = Array.from(shiftMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  if (finalShifts.length === 0) {
    throw new Error('هیچ سطری حاوی تاریخ معتبر (مثلاً ۱۴۰۵/۰۵/۲۶) در فایل PDF شناسایی نشد.');
  }

  // Determine date range
  const firstDate = finalShifts[0].date;
  const lastDate = finalShifts[finalShifts.length - 1].date;
  const firstParts = firstDate.split('/');
  const lastParts = lastDate.split('/');

  const dateRange = {
    from: { year: firstParts[0], month: firstParts[1], day: firstParts[2] },
    to: { year: lastParts[0], month: lastParts[1], day: lastParts[2] },
  };

  const monthHint = `${firstParts[0]}/${firstParts[1]}`;

  // Build discovered personnel list
  const defaultColors = [
    '#2563eb', '#f97316', '#e11d48', '#059669', '#7c3aed', 
    '#0891b2', '#d97706', '#0284c7', '#4f46e5', '#ca8a04'
  ];
  let cIdx = 0;
  const discoveredPersonnel: Personnel[] = [];

  discoveredShiftPeople.forEach(name => {
    discoveredPersonnel.push({
      name,
      roles: ['Shift'],
      isActive: true,
      color: defaultColors[cIdx % defaultColors.length],
    });
    cIdx++;
  });

  discoveredSupervisors.forEach(name => {
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
        color: defaultColors[cIdx % defaultColors.length],
      });
      cIdx++;
    }
  });

  // Unify duplicate names (e.g. سپهرآرا vs سپهر آرا) and map them accurately
  const { unifiedShifts, unifiedPersonnel } = unifyPersonnelAndShifts(
    finalShifts,
    discoveredPersonnel,
    knownPersonnel
  );

  return {
    shifts: unifiedShifts,
    discoveredPersonnel: unifiedPersonnel,
    monthHint,
    dateRange,
  };
}

/**
 * Main Entry Point for User PDF Schedule Upload
 * First uses high-performance server API, with graceful local fallback.
 */
export async function parsePdfSchedule(
  file: File,
  knownPersonnel: Personnel[] = []
): Promise<ParsePdfResult> {
  const arrayBuffer = await file.arrayBuffer();

  // 1. Try server-side parsing (ultra-fast Node parser with 100% font/layout fidelity)
  try {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    const pdfBase64 = btoa(binary);

    const resp = await fetch('/api/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfBase64, knownPersonnel }),
    });

    if (resp.ok) {
      const result = await resp.json();
      if (result.success && result.data && result.data.shifts?.length > 0) {
        return result.data;
      }
    }
  } catch (apiErr) {
    console.warn('Server parse fallback notice:', apiErr);
  }

  // 2. Client-side fallback (offline / PWA standalone)
  return parsePdfBuffer(arrayBuffer, knownPersonnel);
}
