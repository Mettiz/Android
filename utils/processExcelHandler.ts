/**
 * Bioprocess Excel Template Generator & Parser
 * Supports official FMD Vaccine Production campaign schedules:
 * - Cell Culture (Bioreactors 100L, 700L, 1500L, 2700L with EMEM + Serum)
 * - 2-Day Passage Cycles & Chilled Storage
 * - Virus Inoculation (Earl's Medium, 6 Strains: O2016/1, Asia, AGVII, A05, SAT1, SAT2)
 * - Inactivation Vessels (43, 44, Large Virus 3000L, Mobile Vessels 250L -> Cold Room)
 * - Vessel Prep (CIP, SIP Mechanical Seal, PHT, SIP)
 * - Downstream (FSIP Gel, FSIP Adjuvant Oil, Formulation, Supernatant Harvest, Filling, Capping, Labeling, Packing)
 */
import * as XLSX from 'xlsx';
import { DailyProcessMap, DailyProcessTask, ProcessDefinition } from '../types';
import { 
  DEFAULT_PROCESS_DEFINITIONS, 
  VESSEL_OPTIONS, 
  FMD_STRAINS, 
  generateFullBioprocessCampaign 
} from './bioprocessData';

/**
 * Downloads a comprehensive, pre-populated Excel template for FMD Production Campaign
 */
export const downloadProcessExcelTemplate = () => {
  const sampleCampaign = generateFullBioprocessCampaign('1405/05/26');
  
  // Sheet 1: Daily Process Campaign Schedule
  const campaignRows: any[] = [];
  
  const sortedDates = Object.keys(sampleCampaign).sort();
  for (const date of sortedDates) {
    const tasks = sampleCampaign[date] || [];
    for (const t of tasks) {
      campaignRows.push({
        'تاریخ (Date)': date,
        'عنوان پروسه (Title)': t.title,
        'دسته‌بندی (Category)': t.category,
        'مخزن / وسل (Vessel)': t.vessel || '',
        'محیط کشت (Medium)': t.medium || (t.category === 'CellCulture' ? 'EMEM + Serum' : t.category === 'VirusInoculation' ? 'Earl' : ''),
        'سویه ویروس (Strain)': t.strain || '',
        'فاز / مرحله (Phase)': t.phase || '',
        'پرسنل مسئول (Assigned Staff)': (t.assignedStaff || []).join(' - '),
        'وضعیت (Status)': t.status || 'planned',
        'توضیحات و دستورالعمل (Details)': t.details || '',
      });
    }
  }

  // Sheet 2: Process Definitions & Standards
  const defRows = DEFAULT_PROCESS_DEFINITIONS.map(p => ({
    'شناسه پروسه (ID)': p.id,
    'نام فرآیند (Process Name)': p.name,
    'دسته‌بندی (Category)': p.category,
    'مخزن پیش‌فرض (Default Vessel)': p.defaultVessel || '',
    'محیط پیش‌فرض (Default Medium)': p.defaultMedium || '',
    'دوره (روز) (Duration Days)': p.durationDays || 2,
    'رنگ هگز (Color)': p.color,
    'شرح فرآیند و SOP': p.description || '',
  }));

  // Sheet 3: Reference Vessels & Strains
  const vesselRows = VESSEL_OPTIONS.map(v => ({
    'شناسه': v.id,
    'نام مخزن / تجهیز (Vessel Name)': v.name,
    'ظرفیت (Capacity)': v.capacity,
    'نوع تجهیز (Type)': v.type,
  }));

  const strainRows = FMD_STRAINS.map((s, idx) => ({
    'ردیف': idx + 1,
    'نام سویه تب برفکی (FMD Strain)': s,
    'محیط تلقیح (Medium)': 'Earl',
    'زمان برداشت / بی‌خطرسازی': '12 - 18 ساعت پس از تلقیح (Viability = 0%)',
  }));

  const wb = XLSX.utils.book_new();

  // 1. Campaign Schedule
  const wsCampaign = XLSX.utils.json_to_sheet(campaignRows);
  wsCampaign['!cols'] = [
    { wch: 14 }, // Date
    { wch: 42 }, // Title
    { wch: 18 }, // Category
    { wch: 28 }, // Vessel
    { wch: 18 }, // Medium
    { wch: 16 }, // Strain
    { wch: 24 }, // Phase
    { wch: 25 }, // Assigned Staff
    { wch: 14 }, // Status
    { wch: 45 }, // Details
  ];
  XLSX.utils.book_append_sheet(wb, wsCampaign, 'برنامه پروسه‌ها (Campaign)');

  // 2. Definitions
  const wsDef = XLSX.utils.json_to_sheet(defRows);
  wsDef['!cols'] = [
    { wch: 20 },
    { wch: 38 },
    { wch: 18 },
    { wch: 26 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 50 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDef, 'تعاریف پروسه‌ها (Definitions)');

  // 3. Vessels
  const wsVessels = XLSX.utils.json_to_sheet(vesselRows);
  wsVessels['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsVessels, 'مخازن و وسل‌ها (Vessels)');

  // 4. Strains
  const wsStrains = XLSX.utils.json_to_sheet(strainRows);
  wsStrains['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 18 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, wsStrains, 'سویه‌ها (Strains)');

  XLSX.writeFile(wb, 'FMD_Bioprocess_Campaign_Template_1405.xlsx');
};

/**
 * Export current daily process map to Excel file
 */
export const exportProcessesToExcel = (dailyProcesses: DailyProcessMap, filename: string = 'FMD_Daily_Processes_1405.xlsx') => {
  const rows: any[] = [];
  const sortedDates = Object.keys(dailyProcesses).sort();

  for (const date of sortedDates) {
    const tasks = dailyProcesses[date] || [];
    for (const t of tasks) {
      rows.push({
        'تاریخ (Date)': date,
        'عنوان پروسه (Title)': t.title,
        'دسته‌بندی (Category)': t.category,
        'مخزن / وسل (Vessel)': t.vessel || '',
        'محیط کشت (Medium)': t.medium || '',
        'سویه ویروس (Strain)': t.strain || '',
        'فاز / مرحله (Phase)': t.phase || '',
        'پرسنل مسئول (Assigned Staff)': (t.assignedStaff || []).join(' - '),
        'وضعیت (Status)': t.status || 'planned',
        'توضیحات و دستورالعمل (Details)': t.details || '',
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 },
    { wch: 40 },
    { wch: 18 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 24 },
    { wch: 25 },
    { wch: 14 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Processes');
  XLSX.writeFile(wb, filename);
};

/**
 * Parses an imported Excel file into a DailyProcessMap
 */
export const parseProcessesExcel = async (file: File): Promise<DailyProcessMap> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(ws);

        const result: DailyProcessMap = {};

        for (const row of jsonRows) {
          // Identify date column
          const rawDate = row['تاریخ (Date)'] || row['تاریخ'] || row['Date'] || row['date'];
          if (!rawDate) continue;

          const dateStr = String(rawDate).trim();
          const title = row['عنوان پروسه (Title)'] || row['عنوان پروسه'] || row['Title'] || row['title'] || 'فرآیند تولید';
          const category = row['دسته‌بندی (Category)'] || row['دسته‌بندی'] || row['Category'] || 'CellCulture';
          const vessel = row['مخزن / وسل (Vessel)'] || row['مخزن'] || row['Vessel'] || '';
          const medium = row['محیط کشت (Medium)'] || row['محیط کشت'] || row['Medium'] || '';
          const strain = row['سویه ویروس (Strain)'] || row['سویه'] || row['Strain'] || '';
          const phase = row['فاز / مرحله (Phase)'] || row['مرحله'] || row['Phase'] || '';
          const staffRaw = row['پرسنل مسئول (Assigned Staff)'] || row['پرسنل'] || row['Assigned Staff'] || '';
          const status = row['وضعیت (Status)'] || row['وضعیت'] || 'planned';
          const details = row['توضیحات و دستورالعمل (Details)'] || row['توضیحات'] || '';

          const assignedStaff = typeof staffRaw === 'string' 
            ? staffRaw.split(/[-،,]/).map(s => s.trim()).filter(Boolean)
            : [];

          const task: DailyProcessTask = {
            id: `excel-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title,
            category: category as any,
            vessel: vessel || undefined,
            medium: medium || undefined,
            strain: strain || undefined,
            phase: phase || undefined,
            assignedStaff,
            status: status as any,
            details: details || undefined,
          };

          if (!result[dateStr]) {
            result[dateStr] = [];
          }
          result[dateStr].push(task);
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
