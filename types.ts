
/**
 * ShiftFlow Core Types - v1.0.1
 */
export type PersonName = string;
export type OnCallName = string;
export type Role = 'Shift' | 'Supervisor';

export interface Personnel {
  name: string;
  roles: Role[];
  isActive: boolean;
  color?: string; // Hex color code for chart and badge styling
}

export interface ShiftEntry {
  id: number;
  dayName: string;
  date: string; // Persian date string YYYY/MM/DD
  dayShiftPerson: PersonName;
  nightShiftPerson: PersonName;
  onCallPerson: OnCallName;
  isHoliday: boolean;
  // New fields to track history of swaps
  originalDayShiftPerson?: PersonName;
  originalNightShiftPerson?: PersonName;
  // Multi-person support: additional persons for Day or Night shift (2nd, 3rd, etc.)
  extraDayPersons?: PersonName[];
  extraNightPersons?: PersonName[];
}

export interface StatEntry {
  name: PersonName;
  dayShifts: number;
  nightShifts: number;
  totalHours: number;
  weightedScore: number;
  offHours: number;
  workedHours: number;
}

export const SHIFT_WEIGHTS = {
  dayHours: 11,
  nightHours: 13,
  nightMultiplier: 1.5
};

export interface DateParts {
  year: string;
  month: string;
  day: string;
}

export interface PublishedRange {
  isActive: boolean;
  from: DateParts;
  to: DateParts;
}

export type ProcessCategory = 
  | 'CellCulture'        // کشت سلول (بیوراکتورها، بذر سلولی)
  | 'VesselPrep'         // آماده‌سازی مخازن (CIP, PHT, SIP, Mechanical Seal)
  | 'VirusInoculation'   // تلقیح ویروس و سویه‌ها
  | 'Inactivation'       // این‌اکتیویشن و کلدروم
  | 'Downstream'         // فرمولاسیون، ژل و روغن، فیلینگ، بسته‌بندی
  | 'Monitoring'         // پایش، کنترل کیفی، نمونه‌برداری
  | 'MediaPrep'          // آماده‌سازی محیط (EMEM / Earl)
  | 'Other';             // سایر

export interface DailyProcessTask {
  id: string;
  title: string; // عنوان کار / پروسه، مثلاً "کشت سلول بیوراکتور 100L"
  processKey?: string; // شناسه تعریف پروسه
  category: ProcessCategory;
  vessel?: string; // مخزن / وسل مربوطه
  strain?: string; // سویه ویروس: O2016/1, Asia, AGVII, A05, SAT1, SAT2
  medium?: 'EMEM + Serum' | 'Earl' | 'EMEM' | 'Other' | string;
  phase?: string; // پاساژ، چیلد (۴ درجه)، تکمیل حجم، تلقیح، این‌اکتیویشن، هاروست، CIP، SIP
  details?: string; // توضیحات، نکات مدیر و دستورالعمل
  assignedStaff?: string[]; // کارشناسان مسئول انجام
  status?: 'planned' | 'in_progress' | 'completed';
  color?: string; // رنگ اختصاصی نشانگر
}

export interface ProcessDefinition {
  id: string;
  name: string;
  category: ProcessCategory;
  defaultVessel?: string;
  defaultMedium?: string;
  durationDays?: number; // دوره پاساژ یا مدت زمان روز
  color: string;
  description?: string;
  sopSteps?: string[];
  isCustom?: boolean;
}

export type DailyProcessMap = Record<string, DailyProcessTask[]>;

export interface ProductionBatchStep {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  assignedTo?: string;
  shiftType?: 'Day' | 'Night' | string;
  status: 'planned' | 'in_progress' | 'completed';
  notes?: string;
  color?: string;
}

export interface ProductionBatch {
  id: string;
  batchNumber: string;
  productName: string;
  startDate: string;
  endDate: string;
  targetVolume: string;
  status: 'planned' | 'in_progress' | 'completed';
  description?: string;
  steps: ProductionBatchStep[];
}

export interface DailyProcessItem {
  id: string;
  title: string;
  processName?: string;
  vessel?: string;
  strain?: string;
  medium?: string;
  phase?: string;
  notes?: string;
  color?: string;
  assignedTo?: string;
  status?: string;
}

export type DailyScheduleProcesses = Record<string, DailyProcessItem[]>;

export interface DashboardProps {
  scheduleData: ShiftEntry[];
  fullSchedule: ShiftEntry[]; // Added for Live Status
  shiftWorkers: string[];
  supervisors: string[];
  personnelList?: Personnel[]; // List of personnel with configured colors
  monthName: string;
  year: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  // Removed isEditable and onToggleEdit
  onUpdateShift: (id: number, type: 'dayShiftPerson' | 'nightShiftPerson' | 'onCallPerson', newPerson: string) => void;
  onToggleHoliday: (id: number) => void;
  onOpenReport: () => void;
  // Multi-person shift management
  onAddExtraPerson?: (id: number, shiftType: 'Day' | 'Night', personName: string) => void;
  onRemoveExtraPerson?: (id: number, shiftType: 'Day' | 'Night', personName: string) => void;
  onReplaceExtraPerson?: (id: number, shiftType: 'Day' | 'Night', oldPerson: string, newPerson: string) => void;
  // Locking props
  isLocked: boolean;
  onToggleLock: () => void;
  onRegenerate: () => void; // Added for Auto Arrange
  onNavigateToToday?: () => void;
  // Owner and Range Restriction props
  isOwner: boolean;
  onOpenOwnerLogin: () => void;
  onLogoutOwner?: () => void;
  publishedRange: PublishedRange | null;
  onSavePublishedRange: (range: PublishedRange | null) => void;
  // Daily Bioprocess & Task Management
  dailyProcesses?: DailyProcessMap;
  onSaveDailyProcesses?: (updated: DailyProcessMap) => void;
  processDefinitions?: ProcessDefinition[];
  showProcessSchedule?: boolean;
}

export interface AppData {
  schedule: ShiftEntry[];
  personnel: Personnel[];
  lockedMonths: string[]; 
  publishedRange?: PublishedRange | null;
  dailyProcesses?: DailyProcessMap;
  processDefinitions?: ProcessDefinition[];
  showProcessSchedule?: boolean;
}
