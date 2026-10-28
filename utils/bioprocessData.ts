/**
 * FMD Vaccine Production Bioprocess Knowledge & Data Structures
 * Industrial Operational Standards:
 * - English Process Definitions & Terminology
 * - Medium in Cell Culture: Always "EMEM + Serum"
 * - Medium in Inoculation: "Earl"
 * - Cell Seed Scale-up: T-Flask 175 -> Spinner Bottles (1L, 2L, 5L, 10L, 3x10L) -> Bioreactor 100L
 * - Bioreactors: 100L, 700L, 1500L, 2700L (2-day passage cycle, chilled holding at 4°C)
 * - Virus Inoculation across 6 Strains: O2016/1, Asia, AGVII, A05, SAT1, SAT2
 * - Inactivation Vessels (43 & 44, Large Virus 3000L, 250L Mobile Vessels -> Cold Room)
 * - Vessel Prep: CIP, SIP Mechanical Seal, PHT, SIP
 * - Downstream: FSIP Gel, FSIP Adjuvant Oil, Formulation, Supernatant Harvest, Filling, Capping, Labeling & Packing
 */
import { ProcessDefinition, DailyProcessTask, ProcessCategory } from '../types';
import { getNextJalaliDate, getDayNameForJalali } from './persianDate';

export const FMD_STRAINS = [
  'O2016/1',
  'Asia',
  'AGVII',
  'A05',
  'SAT1',
  'SAT2'
] as const;

export const VESSEL_OPTIONS = [
  { id: 'bio-100', name: 'Bioreactor 100L', capacity: '100 Liters', type: 'Bioreactor' },
  { id: 'bio-700', name: 'Bioreactor 700L', capacity: '700 Liters', type: 'Bioreactor' },
  { id: 'bio-1500', name: 'Bioreactor 1500L', capacity: '1500 Liters', type: 'Bioreactor' },
  { id: 'bio-2700', name: 'Bioreactor 2700L', capacity: '2700 Liters', type: 'Bioreactor' },
  { id: 'vessel-large-virus', name: 'Large Virus Vessel 3000L', capacity: '3000 Liters', type: 'VirusVessel' },
  { id: 'vessel-inact-43', name: 'Inactivation Vessel 43', capacity: '3000 Liters', type: 'InactivationVessel' },
  { id: 'vessel-inact-44', name: 'Inactivation Vessel 44', capacity: '3000 Liters', type: 'InactivationVessel' },
  { id: 'vessel-mobile-250', name: 'Mobile Vessel 250L (Cold Room)', capacity: '250 Liters', type: 'MobileVessel' },
  { id: 'vessel-gel-400', name: 'Gel Vessel 400L (Gel Room)', capacity: '400 Liters', type: 'GelVessel' },
  { id: 'vessel-gel-1500', name: 'Gel Vessel 1500L (Gel Room)', capacity: '1500 Liters', type: 'GelVessel' },
  { id: 'vessel-formulation', name: 'Formulation Vessel', capacity: 'Formulation Tank', type: 'Formulation' },
  { id: 'flask-175', name: 'T-Flask 175cm²', capacity: '80 - 200 mL', type: 'SeedFlask' },
  { id: 'spinner-1', name: 'Spinner Bottle 1L', capacity: '1 Liter', type: 'SpinnerBottle' },
  { id: 'spinner-2', name: 'Spinner Bottle 2L', capacity: '2 Liters', type: 'SpinnerBottle' },
  { id: 'spinner-5', name: 'Spinner Bottle 5L', capacity: '5 Liters', type: 'SpinnerBottle' },
  { id: 'spinner-10', name: 'Spinner Bottle 10L', capacity: '10 Liters', type: 'SpinnerBottle' },
  { id: 'spinner-3x10', name: '3x Spinner Bottles 10L', capacity: '15 - 20 Liters', type: 'SpinnerBottle' },
];

export const GEL_ROOM_VESSELS = [
  'Gel Vessel 1500L (Gel Room)',
  'Gel Vessel 400L (Gel Room)',
] as const;

export const STRAIN_OPTIONS = [
  'O2016/1 & Asia',
  'AGVII & A05',
  'SAT1 & SAT2',
  'O2016/1',
  'Asia',
  'AGVII',
  'A05',
  'SAT1',
  'SAT2',
  'O2016/1 & A05',
  'O2016/1 & AGVII',
  'Asia & SAT1',
  'A05 & SAT2',
] as const;

export const CATEGORY_LABELS: Record<ProcessCategory, { label: string; enLabel: string; color: string; badgeBg: string }> = {
  CellCulture: { label: 'کشت سلول', enLabel: 'Cell Culture', color: '#10b981', badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  VesselPrep: { label: 'آماده‌سازی مخازن', enLabel: 'Vessel Preparation', color: '#3b82f6', badgeBg: 'bg-blue-50 text-blue-800 border-blue-300' },
  VirusInoculation: { label: 'تلقیح ویروس', enLabel: 'Virus Inoculation', color: '#f59e0b', badgeBg: 'bg-amber-50 text-amber-800 border-amber-300' },
  Inactivation: { label: 'این‌اکتیویشن', enLabel: 'Inactivation', color: '#ef4444', badgeBg: 'bg-rose-50 text-rose-800 border-rose-300' },
  Downstream: { label: 'فرمولاسیون و بسته‌بندی', enLabel: 'Downstream & Packaging', color: '#8b5cf6', badgeBg: 'bg-purple-50 text-purple-800 border-purple-300' },
  Monitoring: { label: 'پایش و کنترل کیفی', enLabel: 'Monitoring & QC', color: '#06b6d4', badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-300' },
  MediaPrep: { label: 'آماده‌سازی محیط', enLabel: 'Media Preparation', color: '#14b8a6', badgeBg: 'bg-teal-50 text-teal-800 border-teal-300' },
  Other: { label: 'سایر فرآیندها', enLabel: 'Other', color: '#64748b', badgeBg: 'bg-slate-50 text-slate-800 border-slate-300' },
};

/**
 * Standard Process Definitions in English with EMEM + Serum for Cell Culture
 */
export const DEFAULT_PROCESS_DEFINITIONS: ProcessDefinition[] = [
  // 1. Media Preparation
  {
    id: 'proc-media-emem',
    name: 'Media Preparation - EMEM + Serum',
    category: 'MediaPrep',
    defaultMedium: 'EMEM + Serum',
    durationDays: 1,
    color: '#0d9488',
    description: 'Preparation of EMEM medium supplemented with Serum for Cell Seed, Spinner bottles, and Bioreactors 100L, 700L, 1500L, 2700L.',
  },
  {
    id: 'proc-media-earl',
    name: "Media Preparation - Earl's Medium",
    category: 'MediaPrep',
    defaultMedium: 'Earl',
    durationDays: 1,
    color: '#0284c7',
    description: "Preparation of Earle's medium for virus seed dilution and virus inoculation across vessels.",
  },

  // 2. Cell Seed Preparation
  {
    id: 'proc-seed-thaw',
    name: 'Cell Seed: Thaw & T-Flask 175 (80 mL)',
    category: 'CellCulture',
    defaultVessel: 'T-Flask 175cm²',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#059669',
    description: 'Freeze-thaw 1 mL cryovial cell seed, transfer into 1x T-Flask 175 with EMEM + Serum up to 80 mL.',
  },
  {
    id: 'proc-seed-flask-2',
    name: 'Cell Seed: Passage to 2x T-Flask 175',
    category: 'CellCulture',
    defaultVessel: 'T-Flask 175cm²',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#059669',
    description: 'Passage after 2 days into 2x T-Flask 175 with EMEM + Serum.',
  },
  {
    id: 'proc-seed-flask-4',
    name: 'Cell Seed: Passage to 4x T-Flask 175',
    category: 'CellCulture',
    defaultVessel: 'T-Flask 175cm²',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#059669',
    description: 'Passage after 2 days into 4x T-Flask 175 with EMEM + Serum to expand cell density.',
  },
  {
    id: 'proc-seed-spin-1',
    name: 'Cell Seed: Transfer to Spinner Bottle 1L',
    category: 'CellCulture',
    defaultVessel: 'Spinner Bottle 1L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#10b981',
    description: 'Transfer cells into 1L Spinner Bottle with EMEM + Serum; volume adjusted based on cell count.',
  },
  {
    id: 'proc-seed-spin-2',
    name: 'Cell Seed: Passage to Spinner Bottle 2L',
    category: 'CellCulture',
    defaultVessel: 'Spinner Bottle 2L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#10b981',
    description: 'Passage after 2 days into 2L Spinner Bottle with EMEM + Serum.',
  },
  {
    id: 'proc-seed-spin-5',
    name: 'Cell Seed: Passage to Spinner Bottle 5L',
    category: 'CellCulture',
    defaultVessel: 'Spinner Bottle 5L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#10b981',
    description: 'Passage after 2 days into 5L Spinner Bottle with EMEM + Serum.',
  },
  {
    id: 'proc-seed-spin-10',
    name: 'Cell Seed: Passage to Spinner Bottle 10L',
    category: 'CellCulture',
    defaultVessel: 'Spinner Bottle 10L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#10b981',
    description: 'Passage after 2 days into 1x 10L Spinner Bottle with EMEM + Serum.',
  },
  {
    id: 'proc-seed-spin-3x10',
    name: 'Cell Seed: Scale-up to 3x Spinner Bottle 10L (15-20L)',
    category: 'CellCulture',
    defaultVessel: '3x Spinner Bottles 10L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#047857',
    description: 'Passage after 2 days into 3x 10L Spinner Bottles to reach 15-20 Liters total volume for Bioreactor 100L inoculation.',
  },

  // 3. Bioreactor Scale-up & Culture
  {
    id: 'proc-bio-100-init',
    name: 'Cell Culture: Bioreactor 100L (Initial Charge 1/3 - 1/2)',
    category: 'CellCulture',
    defaultVessel: 'Bioreactor 100L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#15803d',
    description: 'Inoculate Bioreactor 100L with 15-20L seed; fill 1/3 to 1/2 volume with EMEM + Serum.',
  },
  {
    id: 'proc-bio-100-full',
    name: 'Cell Culture: Bioreactor 100L (Full Volume 100%)',
    category: 'CellCulture',
    defaultVessel: 'Bioreactor 100L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#15803d',
    description: 'Top up Bioreactor 100L to full working volume with EMEM + Serum after 2 days.',
  },
  {
    id: 'proc-bio-100-to-700',
    name: 'Cell Culture: Transfer to Bioreactor 700L + Chilled in 100L',
    category: 'CellCulture',
    defaultVessel: 'Bioreactor 700L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#0d9488',
    description: 'Transfer cells to Bioreactor 700L with EMEM + Serum; hold remaining cells in 100L on Chilled storage (4°C) due to high cell count.',
  },
  {
    id: 'proc-bio-700',
    name: 'Cell Culture: Bioreactor 700L (Incubation)',
    category: 'CellCulture',
    defaultVessel: 'Bioreactor 700L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#0d9488',
    description: 'Incubate cells for 2 days in Bioreactor 700L with EMEM + Serum to achieve target cell count.',
  },
  {
    id: 'proc-bio-700-to-2700',
    name: 'Cell Culture: Direct Transfer to Bioreactor 2700L + Chilled in 700L',
    category: 'CellCulture',
    defaultVessel: 'Bioreactor 2700L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#047857',
    description: 'Direct transfer from 700L to Bioreactor 2700L due to high cell count; hold portion in 700L on Chilled storage (4°C).',
  },
  {
    id: 'proc-bio-2700',
    name: 'Cell Culture: Bioreactor 2700L (Main Culture)',
    category: 'CellCulture',
    defaultVessel: 'Bioreactor 2700L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#065f46',
    description: 'Incubate cells for 2 days in Bioreactor 2700L with EMEM + Serum prior to split into inoculation vessels.',
  },
  {
    id: 'proc-bio-2700-refeed',
    name: 'Cell Culture: Re-feed Bioreactor 2700L with EMEM + Serum',
    category: 'CellCulture',
    defaultVessel: 'Bioreactor 2700L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#047857',
    description: 'Add fresh EMEM + Serum to chilled cells in Bioreactor 2700L; incubate 2 days for the next inoculation round.',
  },
  {
    id: 'proc-bio-combine-1500-2700',
    name: 'Cell Culture: Combine Chilled Cells & Split (2700L & 1500L)',
    category: 'CellCulture',
    defaultVessel: 'Bioreactor 1500L & 2700L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#065f46',
    description: 'Round 3: Combine chilled cells from 100L & 700L into 2700L; split between Bioreactor 2700L & 1500L with EMEM + Serum.',
  },

  // 4. Vessel Preparation
  {
    id: 'proc-prep-cip',
    name: 'Vessel Preparation: CIP (Clean-In-Place)',
    category: 'VesselPrep',
    durationDays: 1,
    color: '#2563eb',
    description: 'Automated chemical cleaning of vessels and transfer lines in place.',
  },
  {
    id: 'proc-prep-sip-seal-2700',
    name: 'Vessel Preparation: SIP Mechanical Seal (Bioreactor 2700L)',
    category: 'VesselPrep',
    defaultVessel: 'Bioreactor 2700L',
    durationDays: 1,
    color: '#4f46e5',
    description: 'Steam-sterilization of mechanical agitation seals on Bioreactor 2700L prior to PHT (at least 2 days before fill).',
  },
  {
    id: 'proc-prep-sip-seal-1500',
    name: 'Vessel Preparation: SIP Mechanical Seal (Bioreactor 1500L)',
    category: 'VesselPrep',
    defaultVessel: 'Bioreactor 1500L',
    durationDays: 1,
    color: '#4338ca',
    description: 'Steam-sterilization of mechanical agitation seals on Bioreactor 1500L prior to PHT (at least 2 days before fill).',
  },
  {
    id: 'proc-prep-pht',
    name: 'Vessel Preparation: PHT (Pressure Hold Test)',
    category: 'VesselPrep',
    durationDays: 1,
    color: '#3b82f6',
    description: 'Vessel pressure integrity and hold test to ensure no leaks.',
  },
  {
    id: 'proc-prep-sip',
    name: 'Vessel Preparation: SIP (Sterilize-In-Place)',
    category: 'VesselPrep',
    durationDays: 1,
    color: '#1d4ed8',
    description: 'Pure steam sterilization of vessel in place at target temperature and hold time.',
  },

  // 5. Working Virus Seed Preparation & Inoculation
  {
    id: 'proc-virus-seed-prep',
    name: 'Working Virus Seed Preparation (2 Days Pre-Inoculation)',
    category: 'VirusInoculation',
    defaultMedium: 'Earl',
    durationDays: 2,
    color: '#d97706',
    description: "Prepare working virus seed in Earle's medium 2 days before inoculation for specific vessel and strain.",
  },
  {
    id: 'proc-inoc-round-1',
    name: 'Virus Inoculation: Round 1 (Inactivation Vessels 43 & 44)',
    category: 'VirusInoculation',
    defaultVessel: 'Inactivation Vessel 43',
    defaultMedium: 'Earl',
    durationDays: 1,
    color: '#ea580c',
    description: "Inoculate Inactivation Vessels 43 & 44 simultaneously with Earle's medium for Strains O2016/1 & Asia.",
  },
  {
    id: 'proc-inoc-round-2',
    name: 'Virus Inoculation: Round 2 (Inactivation Vessel + Large Virus 3000L)',
    category: 'VirusInoculation',
    defaultVessel: 'Large Virus Vessel 3000L',
    defaultMedium: 'Earl',
    durationDays: 1,
    color: '#c2410c',
    description: "Inoculate cleaned Inactivation Vessel and Large Virus Vessel 3000L with Earle's medium for Strains AGVII & A05.",
  },
  {
    id: 'proc-inoc-round-3',
    name: 'Virus Inoculation: Round 3 (Bioreactor 2700L & 1500L)',
    category: 'VirusInoculation',
    defaultVessel: 'Bioreactor 2700L',
    defaultMedium: 'Earl',
    durationDays: 1,
    color: '#9a3412',
    description: "Inoculate directly inside Bioreactors 2700L & 1500L with Earle's medium for Strains SAT1 & SAT2.",
  },

  // 6. Inactivation & Cold Room Transfer
  {
    id: 'proc-inact-step',
    name: 'Inactivation (12-18 Hours Post-Inoculation)',
    category: 'Inactivation',
    durationDays: 1,
    color: '#dc2626',
    description: 'Chemical inactivation of virus after viability reaches 0 (typically 12 to 18 hours after inoculation).',
  },
  {
    id: 'proc-inact-mobile-coldroom',
    name: 'Transfer to Mobile Vessel 250L & Cold Room',
    category: 'Inactivation',
    defaultVessel: 'Mobile Vessel 250L (Cold Room)',
    durationDays: 1,
    color: '#b91c1c',
    description: 'Discharge inactivated antigen into 250L Mobile Vessels, transfer to Cold Room, and clean/CIP inactivation vessel for next round.',
  },

  // 7. Downstream, Gel Room & Formulation
  {
    id: 'proc-down-gel-water',
    name: 'Gel Preparation: Water Intake WFI/RO (Gel Room)',
    category: 'Downstream',
    durationDays: 1,
    color: '#0284c7',
    description: 'تأمین و آب‌گیری آب خالص WFI/RO در مخزن اتاق ژل در روز قبل از ساخت ژل جهت آماده‌سازی محصول آبی.',
  },
  {
    id: 'proc-down-gel-synth',
    name: 'Gel Preparation: Gel Synthesis & Formulation',
    category: 'Downstream',
    durationDays: 1,
    color: '#0d9488',
    description: 'ساخت و فرمولاسیون ژل ادجوانت (هیدروکسید آلومینیوم / ساپونین) در اتاق ژل در روز بعد از آب‌گیری.',
  },
  {
    id: 'proc-down-gel-wash',
    name: 'Gel Preparation: Gel Washing (Washing Process)',
    category: 'Downstream',
    durationDays: 1,
    color: '#14b8a6',
    description: 'عملیات شستشوی ژل ادجوانت روز بعد از ساخت ژل طبق پروتکل استاندارد.',
  },
  {
    id: 'proc-down-gel-cip',
    name: 'Gel Room: Vessel CIP (Clean-In-Place 400L / 1500L)',
    category: 'VesselPrep',
    defaultVessel: 'Gel Vessel 1500L (Gel Room)',
    durationDays: 1,
    color: '#2563eb',
    description: 'شستشوی درجا (CIP) وسل ژل (۴۰۰ یا ۱۵۰۰ لیتری) در اتاق ژل روز بعد از شستشوی ژل. (بدون مصرف محیط/بافر)',
  },
  {
    id: 'proc-down-gel-pht-sip-fsip',
    name: 'Gel Room: PHT, SIP, Gel Transfer & FSIP',
    category: 'Downstream',
    defaultVessel: 'Gel Vessel 1500L (Gel Room)',
    durationDays: 1,
    color: '#7c3aed',
    description: 'تست افت فشار PHT و استریل SIP وسل ژل، سپس انتقال ژل به وسل و استریل نهایی حرارتی با مخزن (FSIP ژل).',
  },
  {
    id: 'proc-down-gel-formulation',
    name: 'Formulation: Aqueous Product with Sterile Gel',
    category: 'Downstream',
    defaultVessel: 'Formulation Vessel',
    durationDays: 1,
    color: '#6d28d9',
    description: 'فرمولاسیون واکسن محصول آبی: ترکیب آنتی‌ژن‌های این‌اکتیو ۶ سویه با ژل ادجوانت استریل در مخزن فرمولاسیون.',
  },
  {
    id: 'proc-down-oil-cip',
    name: 'Oil Adjuvant: Vessel CIP (Clean-In-Place)',
    category: 'VesselPrep',
    defaultVessel: 'Gel Vessel 1500L (Gel Room)',
    durationDays: 1,
    color: '#2563eb',
    description: 'شستشوی درجا (CIP) مخزن اتاق ژل قبل از آماده‌سازی روغن ادجوانت. (بدون مصرف محیط/بافر)',
  },
  {
    id: 'proc-down-oil-pht-sip-transfer-fsip',
    name: 'Oil Adjuvant: PHT, SIP, Transfer Oil & FSIP',
    category: 'Downstream',
    defaultVessel: 'Gel Vessel 1500L (Gel Room)',
    durationDays: 1,
    color: '#4f46e5',
    description: 'تست PHT و استریل SIP مخزن، انتقال روغن ادجوانت به وسل و اجرای چرخه استریل نهایی FSIP روغن.',
  },
  {
    id: 'proc-down-oil-formulation',
    name: 'Formulation: Oil Product with Cooled Adjuvant Oil',
    category: 'Downstream',
    defaultVessel: 'Formulation Vessel',
    durationDays: 1,
    color: '#4338ca',
    description: 'خنک‌سازی روغن ادجوانت پس از FSIP و فرمولاسیون امولسیون محصول روغنی با آنتی‌ژن‌های این‌اکتیو.',
  },
  {
    id: 'proc-down-supernatant',
    name: 'Supernatant Harvest',
    category: 'Downstream',
    defaultVessel: 'Formulation Vessel',
    durationDays: 1,
    color: '#5b21b6',
    description: 'هاروست رویی و بررسی رسوب‌گذاری آنتی‌ژن پس از اتمام فرمولاسیون.',
  },
  {
    id: 'proc-down-packaging',
    name: 'Filling, Capping, Labeling & Packing',
    category: 'Downstream',
    durationDays: 1,
    color: '#4c1d95',
    description: 'فیلینگ استریل در ویال‌ها، کپینگ، لیبل‌زنی، بازرسی و بسته‌بندی نهایی بچ واکسن.',
  },

  // 8. Monitoring & Quality Control
  {
    id: 'proc-mon-cellcount',
    name: 'Monitoring: Cell Count & Viability',
    category: 'Monitoring',
    durationDays: 1,
    color: '#0891b2',
    description: 'Cell density and viability percentage testing prior to passage or inoculation.',
  },
  {
    id: 'proc-mon-sterility',
    name: 'Monitoring: Bioreactor Parameters & Sterility',
    category: 'Monitoring',
    durationDays: 1,
    color: '#0e7490',
    description: 'Online monitoring of pH, DO, Temperature, and sterility sampling of vessels and media.',
  },
];

export interface StandardCampaignMilestone {
  stepIndex: number;
  dayOffset: number;
  stepName: string;
  tasks: Array<{
    title: string;
    category: ProcessCategory;
    vessel?: string;
    strain?: string;
    medium?: 'EMEM + Serum' | 'Earl' | 'EMEM' | 'Other' | string;
    phase?: string;
    details?: string;
    color?: string;
  }>;
  matchPatterns: string[];
}

export const CAMPAIGN_MILESTONES: StandardCampaignMilestone[] = [
  {
    stepIndex: 0,
    dayOffset: 0,
    stepName: 'Cell Seed: Thaw & T-Flask 175 (80 mL)',
    matchPatterns: ['thaw', 't-flask 175 (80', 'ذوب', 'بذر اولیه', 'cryovial'],
    tasks: [{
      title: 'Cell Seed: Thaw & T-Flask 175 (80 mL)',
      category: 'CellCulture',
      vessel: 'T-Flask 175cm²',
      medium: 'EMEM + Serum',
      phase: 'Thaw 1 mL seed -> 80 mL with EMEM + Serum',
      details: 'Initiation of FMD vaccine manufacturing campaign.',
      color: '#059669'
    }]
  },
  {
    stepIndex: 1,
    dayOffset: 2,
    stepName: 'Cell Seed: Passage to 2x T-Flask 175',
    matchPatterns: ['2x t-flask', '۲ فلاسک'],
    tasks: [{
      title: 'Cell Seed: Passage to 2x T-Flask 175',
      category: 'CellCulture',
      vessel: 'T-Flask 175cm²',
      medium: 'EMEM + Serum',
      phase: '2-Day Cell Passage',
      details: 'Passage into 2x T-Flask 175 with EMEM + Serum.',
      color: '#059669'
    }]
  },
  {
    stepIndex: 2,
    dayOffset: 4,
    stepName: 'Cell Seed: Passage to 4x T-Flask 175',
    matchPatterns: ['4x t-flask', '۴ فلاسک'],
    tasks: [{
      title: 'Cell Seed: Passage to 4x T-Flask 175',
      category: 'CellCulture',
      vessel: 'T-Flask 175cm²',
      medium: 'EMEM + Serum',
      phase: '2-Day Cell Passage',
      details: 'Passage into 4x T-Flask 175 with EMEM + Serum.',
      color: '#059669'
    }]
  },
  {
    stepIndex: 3,
    dayOffset: 6,
    stepName: 'Cell Seed: Transfer to Spinner Bottle 1L',
    matchPatterns: ['spinner bottle 1l', 'اسپینر ۱', '۱ لیتری'],
    tasks: [{
      title: 'Cell Seed: Transfer to Spinner Bottle 1L',
      category: 'CellCulture',
      vessel: 'Spinner Bottle 1L',
      medium: 'EMEM + Serum',
      phase: 'Transfer to spinner bottle based on cell count',
      color: '#10b981'
    }]
  },
  {
    stepIndex: 4,
    dayOffset: 8,
    stepName: 'Cell Seed: Passage to Spinner Bottle 2L',
    matchPatterns: ['spinner bottle 2l', 'اسپینر ۲', '۲ لیتری'],
    tasks: [{
      title: 'Cell Seed: Passage to Spinner Bottle 2L',
      category: 'CellCulture',
      vessel: 'Spinner Bottle 2L',
      medium: 'EMEM + Serum',
      phase: '2-Day Passage',
      color: '#10b981'
    }]
  },
  {
    stepIndex: 5,
    dayOffset: 10,
    stepName: 'Cell Seed: Passage to Spinner Bottle 5L',
    matchPatterns: ['spinner bottle 5l', 'اسپینر ۵', '۵ لیتری'],
    tasks: [{
      title: 'Cell Seed: Passage to Spinner Bottle 5L',
      category: 'CellCulture',
      vessel: 'Spinner Bottle 5L',
      medium: 'EMEM + Serum',
      phase: '2-Day Passage',
      color: '#10b981'
    }]
  },
  {
    stepIndex: 6,
    dayOffset: 12,
    stepName: 'Cell Seed: Passage to Spinner Bottle 10L',
    matchPatterns: ['spinner bottle 10l', 'اسپینر ۱۰'],
    tasks: [{
      title: 'Cell Seed: Passage to Spinner Bottle 10L',
      category: 'CellCulture',
      vessel: 'Spinner Bottle 10L',
      medium: 'EMEM + Serum',
      phase: '2-Day Passage',
      color: '#10b981'
    }]
  },
  {
    stepIndex: 7,
    dayOffset: 14,
    stepName: 'Cell Seed: Scale-up to 3x Spinner Bottle 10L & CIP 100L',
    matchPatterns: ['3x spinner', '۳ تا بطری ۱۰', 'scale-up to 3x spinner'],
    tasks: [
      {
        title: 'Cell Seed: Scale-up to 3x Spinner Bottle 10L (15-20L)',
        category: 'CellCulture',
        vessel: '3x Spinner Bottles 10L',
        medium: 'EMEM + Serum',
        phase: 'Reach 15 - 20 Liters Seed Volume',
        details: 'Prepare final seed volume for Bioreactor 100L inoculation.',
        color: '#047857'
      },
      {
        title: 'Vessel Prep: CIP & SIP Bioreactor 100L',
        category: 'VesselPrep',
        vessel: 'Bioreactor 100L',
        phase: '100L Vessel Preparation',
        color: '#2563eb'
      }
    ]
  },
  {
    stepIndex: 8,
    dayOffset: 16,
    stepName: 'Cell Culture: Bioreactor 100L (Initial Charge)',
    matchPatterns: ['bioreactor 100l (initial', '۱۰۰l (شارژ'],
    tasks: [{
      title: 'Cell Culture: Bioreactor 100L (Initial Charge 1/3 - 1/2)',
      category: 'CellCulture',
      vessel: 'Bioreactor 100L',
      medium: 'EMEM + Serum',
      phase: 'Inoculate 15-20L seed; fill 1/3 to 1/2 with EMEM + Serum',
      color: '#15803d'
    }]
  },
  {
    stepIndex: 9,
    dayOffset: 18,
    stepName: 'Cell Culture: Bioreactor 100L (Full Volume) & CIP 700L',
    matchPatterns: ['bioreactor 100l (full', '۱۰۰l (تکمیل'],
    tasks: [
      {
        title: 'Cell Culture: Bioreactor 100L (Full Volume 100%)',
        category: 'CellCulture',
        vessel: 'Bioreactor 100L',
        medium: 'EMEM + Serum',
        phase: 'Top up to 100% volume with EMEM + Serum',
        color: '#15803d'
      },
      {
        title: 'Vessel Prep: CIP & SIP Bioreactor 700L',
        category: 'VesselPrep',
        vessel: 'Bioreactor 700L',
        color: '#2563eb'
      }
    ]
  },
  {
    stepIndex: 10,
    dayOffset: 20,
    stepName: 'Transfer to Bioreactor 700L + Chilled 100L & CIP 2700L',
    matchPatterns: ['transfer to bioreactor 700l', 'انتقال به ۷۰۰l', 'chilled in 100l'],
    tasks: [
      {
        title: 'Cell Culture: Transfer to Bioreactor 700L + Chilled in 100L',
        category: 'CellCulture',
        vessel: 'Bioreactor 700L',
        medium: 'EMEM + Serum',
        phase: 'Transfer to 700L + hold portion in 100L on Chilled (4°C)',
        color: '#0d9488'
      },
      {
        title: 'Vessel Prep: SIP Mechanical Seal & CIP/SIP Bioreactor 2700L',
        category: 'VesselPrep',
        vessel: 'Bioreactor 2700L',
        phase: 'SIP Mechanical Seal prior to PHT',
        color: '#4f46e5'
      }
    ]
  },
  {
    stepIndex: 11,
    dayOffset: 22,
    stepName: 'Direct Transfer to Bioreactor 2700L + Seed Prep Round 1',
    matchPatterns: ['direct transfer to bioreactor 2700l', 'انتقال مستقیم به ۲۷۰۰l', 'chilled in 700l'],
    tasks: [
      {
        title: 'Cell Culture: Direct Transfer to Bioreactor 2700L + Chilled in 700L',
        category: 'CellCulture',
        vessel: 'Bioreactor 2700L',
        medium: 'EMEM + Serum',
        phase: 'Direct transfer to 2700L + hold portion in 700L on Chilled (4°C)',
        color: '#047857'
      },
      {
        title: 'Working Virus Seed Prep: Round 1',
        category: 'VirusInoculation',
        strain: 'O2016/1 & Asia',
        medium: 'Earl',
        phase: 'Prepare seed 2 days pre-inoculation',
        color: '#d97706'
      },
      {
        title: 'Vessel Prep: CIP & SIP Inactivation Vessels 43 & 44',
        category: 'VesselPrep',
        vessel: 'Inactivation Vessel 43 & 44',
        color: '#2563eb'
      }
    ]
  },
  {
    stepIndex: 12,
    dayOffset: 24,
    stepName: 'Virus Inoculation: Round 1',
    matchPatterns: ['inoculation: round 1', 'تلقیح نوبت ۱', 'inactivation vessels 43 & 44', 'inoculation: round 1'],
    tasks: [{
      title: 'Virus Inoculation: Round 1',
      category: 'VirusInoculation',
      vessel: 'Inactivation Vessel 43 & 44',
      strain: 'O2016/1 & Asia',
      medium: 'Earl',
      phase: 'Inoculate vessels simultaneously',
      details: 'Cells transferred from 2700L; portion retained in 2700L on Chilled.',
      color: '#ea580c'
    }]
  },
  {
    stepIndex: 13,
    dayOffset: 25,
    stepName: 'Inactivation: Round 1',
    matchPatterns: ['inactivation: vessels 43 & 44', 'این‌اکتیویشن ۴۳ و ۴۴', 'inactivation: round 1'],
    tasks: [{
      title: 'Inactivation: Round 1',
      category: 'Inactivation',
      vessel: 'Inactivation Vessel 43 & 44',
      strain: 'O2016/1 & Asia',
      phase: 'Inactivation 12-18 hrs post-inoculation',
      color: '#dc2626'
    }]
  },
  {
    stepIndex: 14,
    dayOffset: 26,
    stepName: 'Transfer to Mobile Vessel 250L + Re-feed 2700L + Seed Prep Round 2',
    matchPatterns: ['transfer to mobile vessel 250l', 're-feed bioreactor 2700l', 'تخلیه به ۲۵۰l'],
    tasks: [
      {
        title: 'Transfer to Mobile Vessel 250L & Cold Room + CIP/SIP',
        category: 'Inactivation',
        vessel: 'Mobile Vessel 250L (Cold Room)',
        phase: 'Transfer to Cold Room and prepare Inactivation Vessel',
        color: '#b91c1c'
      },
      {
        title: 'Cell Culture: Re-feed Bioreactor 2700L with EMEM + Serum',
        category: 'CellCulture',
        vessel: 'Bioreactor 2700L',
        medium: 'EMEM + Serum',
        phase: 'Re-feed chilled cells in 2700L with EMEM + Serum',
        color: '#047857'
      },
      {
        title: 'Working Virus Seed Prep: Round 2',
        category: 'VirusInoculation',
        strain: 'AGVII & A05',
        medium: 'Earl',
        phase: 'Prepare seed 2 days pre-inoculation',
        color: '#d97706'
      },
      {
        title: 'Vessel Prep: CIP & SIP (Preparation for Round 2)',
        category: 'VesselPrep',
        vessel: 'Large Virus Vessel 3000L',
        color: '#2563eb'
      }
    ]
  },
  {
    stepIndex: 15,
    dayOffset: 28,
    stepName: 'Virus Inoculation: Round 2',
    matchPatterns: ['inoculation: round 2', 'تلقیح نوبت ۲', 'large virus 3000l'],
    tasks: [{
      title: 'Virus Inoculation: Round 2',
      category: 'VirusInoculation',
      vessel: 'Large Virus Vessel 3000L & Inact Vessel',
      strain: 'AGVII & A05',
      medium: 'Earl',
      phase: 'Inoculate Round 2 Strains',
      color: '#c2410c'
    }]
  },
  {
    stepIndex: 16,
    dayOffset: 29,
    stepName: 'Inactivation: Round 2',
    matchPatterns: ['inactivation: inactivation vessel & large virus 3000l', 'این‌اکتیویشن نوبت ۲', 'inactivation: round 2'],
    tasks: [{
      title: 'Inactivation: Round 2',
      category: 'Inactivation',
      vessel: 'Large Virus Vessel 3000L & Inact Vessel',
      strain: 'AGVII & A05',
      phase: 'Inactivation 12-18 hrs post-inoculation',
      color: '#dc2626'
    }]
  },
  {
    stepIndex: 17,
    dayOffset: 30,
    stepName: 'Combine Chilled Cells & Split + Seed Prep Round 3 + Gel Room Water Intake',
    matchPatterns: ['combine chilled cells', 'split', 'ترکیب سلول‌های چیلد'],
    tasks: [
      {
        title: 'Cell Culture: Combine Chilled Cells & Split',
        category: 'CellCulture',
        vessel: 'Bioreactor 1500L & 2700L',
        medium: 'EMEM + Serum',
        phase: 'Combine chilled cells for Round 3 inoculation',
        color: '#065f46'
      },
      {
        title: 'Working Virus Seed Prep: Round 3',
        category: 'VirusInoculation',
        strain: 'SAT1 & SAT2',
        medium: 'Earl',
        phase: 'Prepare seed 2 days pre-inoculation',
        color: '#d97706'
      },
      {
        title: 'Vessel Prep: SIP Mechanical Seal & PHT/SIP (Preparation for Round 3)',
        category: 'VesselPrep',
        vessel: 'Bioreactor 1500L',
        color: '#4f46e5'
      },
      {
        title: 'Gel Preparation: Water Intake WFI/RO (Gel Room)',
        category: 'Downstream',
        vessel: 'Gel Vessel 1500L (Gel Room)',
        phase: 'آب‌گیری ۱ روز قبل از ساخت ژل',
        details: 'تأمین و آب‌گیری آب خالص WFI/RO در مخزن اتاق ژل ۱ روز قبل از ساخت ژل جهت آماده‌سازی محصول آبی.',
        color: '#0284c7'
      }
    ]
  },
  {
    stepIndex: 18,
    dayOffset: 31,
    stepName: 'Gel Room: Gel Synthesis & Formulation',
    matchPatterns: ['gel synthesis', 'ساخت ژل'],
    tasks: [{
      title: 'Gel Preparation: Gel Synthesis & Formulation',
      category: 'Downstream',
      vessel: 'Gel Vessel 1500L (Gel Room)',
      phase: 'ساخت ژل در اتاق ژل (روز بعد از آب‌گیری)',
      details: 'ساخت و فرمولاسیون ژل ادجوانت در اتاق ژل طبق پروتکل استاندارد.',
      color: '#0d9488'
    }]
  },
  {
    stepIndex: 19,
    dayOffset: 32,
    stepName: 'Virus Inoculation: Round 3 & Gel Washing',
    matchPatterns: ['inoculation: round 3', 'تلقیح نوبت ۳', 'gel washing', 'شستشوی ژل'],
    tasks: [
      {
        title: 'Virus Inoculation: Round 3',
        category: 'VirusInoculation',
        vessel: 'Bioreactor 2700L & 1500L',
        strain: 'SAT1 & SAT2',
        medium: 'Earl',
        phase: 'Inoculate Round 3 Strains',
        color: '#9a3412'
      },
      {
        title: 'Gel Preparation: Gel Washing (Washing Process)',
        category: 'Downstream',
        vessel: 'Gel Vessel 1500L (Gel Room)',
        phase: 'شستشوی ژل (روز بعد از ساخت ژل)',
        details: 'عملیات شستشوی ژل ادجوانت در روز بعد از ساخت ژل.',
        color: '#14b8a6'
      }
    ]
  },
  {
    stepIndex: 20,
    dayOffset: 33,
    stepName: 'Inactivation: Round 3 & Gel Room Vessel CIP',
    matchPatterns: ['inactivation: round 3', 'این‌اکتیویشن نوبت ۳', 'cip وسل ژل'],
    tasks: [
      {
        title: 'Inactivation: Round 3',
        category: 'Inactivation',
        vessel: 'Bioreactor 2700L & 1500L',
        strain: 'SAT1 & SAT2',
        phase: 'Final Strain Inactivation',
        color: '#dc2626'
      },
      {
        title: 'Gel Room: Vessel CIP (Clean-In-Place 400L / 1500L)',
        category: 'VesselPrep',
        vessel: 'Gel Vessel 1500L (Gel Room)',
        phase: 'CIP وسل ژل (روز بعد از شستشوی ژل)',
        details: 'شستشوی درجا (CIP) وسل ژل در اتاق ژل قبل از ورود ژل یا روغن. (بدون مصرف محیط/بافر)',
        color: '#2563eb'
      }
    ]
  },
  {
    stepIndex: 21,
    dayOffset: 34,
    stepName: 'Gel & Oil Adjuvant: PHT, SIP, Transfer & FSIP',
    matchPatterns: ['fsip gel', 'fsip oil', 'fsip', 'انتقال ژل', 'انتقال روغن'],
    tasks: [
      {
        title: 'Gel Room: PHT, SIP, Gel Transfer & FSIP (Aqueous Product)',
        category: 'Downstream',
        vessel: 'Gel Vessel 1500L (Gel Room)',
        phase: 'PHT, SIP, انتقال ژل و FSIP ژل',
        details: 'تست PHT، استریل SIP وسل ژل، انتقال ژل به وسل و استریل نهایی FSIP ژل (آماده مصرف در فرمولاسیون روز بعد).',
        color: '#7c3aed'
      },
      {
        title: 'Oil Adjuvant: PHT, SIP, Transfer Oil & FSIP (Oil Product)',
        category: 'Downstream',
        vessel: 'Gel Vessel 1500L (Gel Room)',
        phase: 'PHT, SIP, انتقال روغن و FSIP روغن',
        details: 'تست PHT، استریل SIP وسل، انتقال روغن ادجوانت و استریل نهایی FSIP روغن، خنک‌سازی جهت فرمولاسیون روز بعد.',
        color: '#4f46e5'
      }
    ]
  },
  {
    stepIndex: 22,
    dayOffset: 35,
    stepName: 'Downstream: Formulation (Aqueous & Oil Products)',
    matchPatterns: ['formulation', 'فرمولاسیون'],
    tasks: [
      {
        title: 'Formulation: Aqueous Product with Sterile Gel',
        category: 'Downstream',
        vessel: 'Formulation Vessel',
        phase: 'ترکیب آنتی‌ژن‌های این‌اکتیو با ژل ادجوانت استریل',
        details: 'فرمولاسیون واکسن محصول آبی: اختلاط ۶ سویه آنتی‌ژن با ژل ادجوانت استریل در مخزن فرمولاسیون.',
        color: '#6d28d9'
      },
      {
        title: 'Formulation: Oil Product with Cooled Adjuvant Oil',
        category: 'Downstream',
        vessel: 'Formulation Vessel',
        phase: 'فرمولاسیون امولسیون محصول روغنی با روغن ادجوانت خنک‌شده',
        details: 'فرمولاسیون واکسن محصول روغنی: امولسیفیکاسیون آنتی‌ژن‌های این‌اکتیو با روغن ادجوانت استریل خنک‌شده پس از FSIP.',
        color: '#4338ca'
      }
    ]
  },
  {
    stepIndex: 23,
    dayOffset: 36,
    stepName: 'Downstream: Supernatant Harvest',
    matchPatterns: ['supernatant harvest', 'هاروست رویی'],
    tasks: [{
      title: 'Downstream: Supernatant Harvest',
      category: 'Downstream',
      vessel: 'Formulation Vessel',
      phase: 'Harvest Supernatant',
      color: '#5b21b6'
    }]
  },
  {
    stepIndex: 24,
    dayOffset: 37,
    stepName: 'Downstream: Filling, Capping, Labeling & Packing',
    matchPatterns: ['filling, capping', 'فیلینگ و بسته‌بندی', 'packaging', 'بسته‌بندی'],
    tasks: [{
      title: 'Downstream: Filling, Capping, Labeling & Packing',
      category: 'Downstream',
      phase: 'Final Fill & Finish of FMD Vaccine Batch',
      color: '#4c1d95'
    }]
  }
];

export interface InoculationRoundConfig {
  round1Vessels?: string[];
  round1Strains?: string[];
  round2Vessels?: string[];
  round2Strains?: string[];
  round3Vessels?: string[];
  round3Strains?: string[];
  // Backwards compatibility legacy string fields
  round1Vessel?: string;
  round1Strain?: string;
  round2Vessel?: string;
  round2Strain?: string;
  round3Vessel?: string;
  round3Strain?: string;
}

export const DEFAULT_INOCULATION_CONFIG: InoculationRoundConfig = {
  round1Vessels: ['Inactivation Vessel 43', 'Inactivation Vessel 44'],
  round1Strains: ['O2016/1', 'Asia'],
  round2Vessels: ['Large Virus Vessel 3000L', 'Inactivation Vessel 43'],
  round2Strains: ['AGVII', 'A05'],
  round3Vessels: ['Bioreactor 2700L', 'Bioreactor 1500L'],
  round3Strains: ['SAT1', 'SAT2'],
  // Legacy string equivalents
  round1Vessel: 'Inactivation Vessel 43 & 44',
  round1Strain: 'O2016/1 & Asia',
  round2Vessel: 'Large Virus Vessel 3000L & Inact Vessel',
  round2Strain: 'AGVII & A05',
  round3Vessel: 'Bioreactor 2700L & 1500L',
  round3Strain: 'SAT1 & SAT2',
};

export interface InoculationRoundVessels {
  round1Vessel: string;
  round2Vessel: string;
  round3Vessel: string;
}

export const DEFAULT_INOCULATION_VESSELS: InoculationRoundVessels = {
  round1Vessel: 'Inactivation Vessel 43 & 44',
  round2Vessel: 'Large Virus Vessel 3000L & Inact Vessel',
  round3Vessel: 'Bioreactor 2700L & 1500L',
};

/** Single available individual vessels for selection in rounds (can pick 1, 2, or 3) */
export const SINGLE_VESSEL_CHOICES = [
  'Inactivation Vessel 43',
  'Inactivation Vessel 44',
  'Large Virus Vessel 3000L',
  'Bioreactor 2700L',
  'Bioreactor 1500L',
  'Bioreactor 700L',
  'Bioreactor 100L',
  'Mobile Vessel 250L (Cold Room)',
  'Gel Vessel 400L (Gel Room)',
  'Gel Vessel 1500L (Gel Room)',
  'Formulation Vessel',
] as const;

/** Single available individual virus strains (can pick 1, 2, or 3) */
export const SINGLE_STRAIN_CHOICES = [
  'O2016/1',
  'Asia',
  'AGVII',
  'A05',
  'SAT1',
  'SAT2',
] as const;

/** Combined predefined choices for dropdown fallbacks */
export const INOCULATION_ROUND_VESSEL_CHOICES = [
  'Inactivation Vessel 43 & 44',
  'Inactivation Vessel 43',
  'Inactivation Vessel 44',
  'Large Virus Vessel 3000L & Inact Vessel',
  'Large Virus Vessel 3000L',
  'Bioreactor 2700L & 1500L',
  'Bioreactor 2700L',
  'Bioreactor 1500L',
  'Bioreactor 700L',
  'Bioreactor 100L',
  'Mobile Vessel 250L (Cold Room)',
];

export const INOCULATION_STRAIN_CHOICES = [
  'O2016/1',
  'Asia',
  'AGVII',
  'A05',
  'SAT1',
  'SAT2',
  'O2016/1 & Asia',
  'AGVII & A05',
  'SAT1 & SAT2',
  'O2016/1 & A05',
  'O2016/1 & AGVII',
  'Asia & SAT1',
  'A05 & SAT2',
] as const;

/**
 * Helper to normalize selected vessels for a round into a clean display string
 */
export function formatRoundVessels(vessels?: string[] | string): string {
  if (Array.isArray(vessels)) {
    const valid = vessels.filter(Boolean);
    return valid.length > 0 ? valid.join(' & ') : 'تعیین‌نشده';
  }
  return vessels || 'تعیین‌نشده';
}

/**
 * Helper to normalize selected strains for a round into a clean display string
 */
export function formatRoundStrains(strains?: string[] | string): string {
  if (Array.isArray(strains)) {
    const valid = strains.filter(Boolean);
    return valid.length > 0 ? valid.join(' & ') : 'تعیین‌نشده';
  }
  return strains || 'تعیین‌نشده';
}

export type FormulationProductType = 'aqueous_gel' | 'oil_adjuvant' | 'both';

export interface SmartSuggestionOptions {
  inoculationConfig?: InoculationRoundConfig;
  inoculationVessels?: InoculationRoundVessels; // Backwards compatibility
  productType?: FormulationProductType;
  gelRoomVessel?: string; // 'Gel Vessel 1500L (Gel Room)' or 'Gel Vessel 400L (Gel Room)'
}

/**
 * Generates the full automated 38-day FMD Production Campaign Timeline
 * Supports custom vessels and strains for Inoculation Rounds 1, 2, 3
 * Supports Aqueous (Gel) and/or Oil (Adjuvant Oil) downstream formulation paths
 */
export function generateFullBioprocessCampaign(
  startDate: string,
  options?: SmartSuggestionOptions
): Record<string, DailyProcessTask[]> {
  const timeline: Record<string, DailyProcessTask[]> = {};

  const round1VesselStr = formatRoundVessels(options?.inoculationConfig?.round1Vessels || options?.inoculationConfig?.round1Vessel || options?.inoculationVessels?.round1Vessel || DEFAULT_INOCULATION_CONFIG.round1Vessels);
  const round1StrainStr = formatRoundStrains(options?.inoculationConfig?.round1Strains || options?.inoculationConfig?.round1Strain || DEFAULT_INOCULATION_CONFIG.round1Strains);

  const round2VesselStr = formatRoundVessels(options?.inoculationConfig?.round2Vessels || options?.inoculationConfig?.round2Vessel || options?.inoculationVessels?.round2Vessel || DEFAULT_INOCULATION_CONFIG.round2Vessels);
  const round2StrainStr = formatRoundStrains(options?.inoculationConfig?.round2Strains || options?.inoculationConfig?.round2Strain || DEFAULT_INOCULATION_CONFIG.round2Strains);

  const round3VesselStr = formatRoundVessels(options?.inoculationConfig?.round3Vessels || options?.inoculationConfig?.round3Vessel || options?.inoculationVessels?.round3Vessel || DEFAULT_INOCULATION_CONFIG.round3Vessels);
  const round3StrainStr = formatRoundStrains(options?.inoculationConfig?.round3Strains || options?.inoculationConfig?.round3Strain || DEFAULT_INOCULATION_CONFIG.round3Strains);

  const productType = options?.productType || 'both';
  const gelRoomVessel = options?.gelRoomVessel || 'Gel Vessel 1500L (Gel Room)';

  CAMPAIGN_MILESTONES.forEach(m => {
    const date = getNextJalaliDate(startDate, m.dayOffset);
    if (!timeline[date]) timeline[date] = [];

    m.tasks.forEach(t => {
      // Filter out product types if requested
      const tLower = t.title.toLowerCase();
      if (productType === 'aqueous_gel') {
        if (tLower.includes('oil product') || tLower.includes('adjuvant oil') || tLower.includes('روغن')) {
          return;
        }
      } else if (productType === 'oil_adjuvant') {
        if (tLower.includes('gel preparation') || tLower.includes('aqueous product') || tLower.includes('ژل')) {
          return;
        }
      }

      let finalTitle = t.title;
      let finalVessel = t.vessel;
      let finalStrain = t.strain;

      // Update Gel Room Vessel
      if (finalVessel && finalVessel.includes('Gel Vessel')) {
        finalVessel = gelRoomVessel;
      }

      // Customize Round 1
      if (m.stepIndex === 11 && t.category === 'VirusInoculation') {
        finalTitle = `Working Virus Seed Prep: Strain ${round1StrainStr}`;
        finalStrain = round1StrainStr;
      } else if (m.stepIndex === 12 && t.category === 'VirusInoculation') {
        finalVessel = round1VesselStr;
        finalStrain = round1StrainStr;
        finalTitle = `Virus Inoculation: Round 1 (${round1StrainStr} - ${round1VesselStr})`;
      } else if (m.stepIndex === 13 && t.category === 'Inactivation') {
        finalVessel = round1VesselStr;
        finalStrain = round1StrainStr;
        finalTitle = `Inactivation: Round 1 (${round1StrainStr} - ${round1VesselStr})`;
      }

      // Customize Round 2
      else if (m.stepIndex === 14 && t.category === 'VirusInoculation') {
        finalTitle = `Working Virus Seed Prep: Strain ${round2StrainStr}`;
        finalStrain = round2StrainStr;
      } else if (m.stepIndex === 15 && t.category === 'VirusInoculation') {
        finalVessel = round2VesselStr;
        finalStrain = round2StrainStr;
        finalTitle = `Virus Inoculation: Round 2 (${round2StrainStr} - ${round2VesselStr})`;
      } else if (m.stepIndex === 16 && t.category === 'Inactivation') {
        finalVessel = round2VesselStr;
        finalStrain = round2StrainStr;
        finalTitle = `Inactivation: Round 2 (${round2StrainStr} - ${round2VesselStr})`;
      }

      // Customize Round 3
      else if (m.stepIndex === 17 && t.category === 'VirusInoculation') {
        finalTitle = `Working Virus Seed Prep: Strain ${round3StrainStr}`;
        finalStrain = round3StrainStr;
      } else if (m.stepIndex === 19 && t.category === 'VirusInoculation') {
        finalVessel = round3VesselStr;
        finalStrain = round3StrainStr;
        finalTitle = `Virus Inoculation: Round 3 (${round3StrainStr} - ${round3VesselStr})`;
      } else if (m.stepIndex === 20 && t.category === 'Inactivation') {
        finalVessel = round3VesselStr;
        finalStrain = round3StrainStr;
        finalTitle = `Inactivation: Round 3 (${round3StrainStr} - ${round3VesselStr})`;
      }

      timeline[date].push({
        ...t,
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: finalTitle,
        vessel: finalVessel,
        strain: finalStrain,
        status: 'planned'
      });
    });
  });

  return timeline;
}

export interface RemainingCampaignSuggestion {
  matchedStepIndex: number;
  matchedStepName: string;
  totalRemainingTasks: number;
  totalFutureDays: number;
  remainingTimeline: Record<string, DailyProcessTask[]>;
  previewSteps: Array<{
    date: string;
    dayOffsetFromNow: number;
    title: string;
    vessel?: string;
    category: ProcessCategory;
    phase?: string;
  }>;
}

/**
 * Given a current process task and the selected date, detects its position
 * in the standard industrial SOP campaign and generates all remaining subsequent steps.
 * Allows custom vessels and strains for each Inoculation Round and product type selection.
 */
export function getRemainingCampaignSuggestion(
  currentTask: Partial<DailyProcessTask>,
  currentDate: string,
  options?: SmartSuggestionOptions
): RemainingCampaignSuggestion | null {
  const t = (currentTask.title || '').toLowerCase();
  const v = (currentTask.vessel || '').toLowerCase();
  const p = (currentTask.phase || '').toLowerCase();
  const combined = `${t} ${v} ${p}`;

  let matchedIdx = -1;
  for (let i = 0; i < CAMPAIGN_MILESTONES.length; i++) {
    const milestone = CAMPAIGN_MILESTONES[i];
    const matches = milestone.matchPatterns.some(pattern => combined.includes(pattern.toLowerCase()));
    if (matches) {
      matchedIdx = i;
      break;
    }
  }

  // If no specific match, default to Step 0 (start of campaign)
  if (matchedIdx === -1) {
    matchedIdx = 0;
  }

  // If already at the very last step, nothing remains
  if (matchedIdx >= CAMPAIGN_MILESTONES.length - 1) {
    return null;
  }

  const currentMilestone = CAMPAIGN_MILESTONES[matchedIdx];
  const remainingMilestones = CAMPAIGN_MILESTONES.slice(matchedIdx + 1);

  const remainingTimeline: Record<string, DailyProcessTask[]> = {};
  const previewSteps: RemainingCampaignSuggestion['previewSteps'] = [];
  let totalRemainingTasks = 0;

  const round1VesselStr = formatRoundVessels(options?.inoculationConfig?.round1Vessels || options?.inoculationConfig?.round1Vessel || options?.inoculationVessels?.round1Vessel || DEFAULT_INOCULATION_CONFIG.round1Vessels);
  const round1StrainStr = formatRoundStrains(options?.inoculationConfig?.round1Strains || options?.inoculationConfig?.round1Strain || DEFAULT_INOCULATION_CONFIG.round1Strains);

  const round2VesselStr = formatRoundVessels(options?.inoculationConfig?.round2Vessels || options?.inoculationConfig?.round2Vessel || options?.inoculationVessels?.round2Vessel || DEFAULT_INOCULATION_CONFIG.round2Vessels);
  const round2StrainStr = formatRoundStrains(options?.inoculationConfig?.round2Strains || options?.inoculationConfig?.round2Strain || DEFAULT_INOCULATION_CONFIG.round2Strains);

  const round3VesselStr = formatRoundVessels(options?.inoculationConfig?.round3Vessels || options?.inoculationConfig?.round3Vessel || options?.inoculationVessels?.round3Vessel || DEFAULT_INOCULATION_CONFIG.round3Vessels);
  const round3StrainStr = formatRoundStrains(options?.inoculationConfig?.round3Strains || options?.inoculationConfig?.round3Strain || DEFAULT_INOCULATION_CONFIG.round3Strains);

  const productType = options?.productType || 'both';
  const gelRoomVessel = options?.gelRoomVessel || 'Gel Vessel 1500L (Gel Room)';

  remainingMilestones.forEach(m => {
    const deltaDays = m.dayOffset - currentMilestone.dayOffset;
    const targetDate = getNextJalaliDate(currentDate, deltaDays);

    if (!remainingTimeline[targetDate]) {
      remainingTimeline[targetDate] = [];
    }

    m.tasks.forEach(taskDef => {
      const tLower = taskDef.title.toLowerCase();
      if (productType === 'aqueous_gel') {
        if (tLower.includes('oil product') || tLower.includes('adjuvant oil') || tLower.includes('روغن')) {
          return;
        }
      } else if (productType === 'oil_adjuvant') {
        if (tLower.includes('gel preparation') || tLower.includes('aqueous product') || tLower.includes('ژل')) {
          return;
        }
      }

      totalRemainingTasks++;
      
      let finalTitle = taskDef.title;
      let finalVessel = taskDef.vessel;
      let finalStrain = taskDef.strain;

      if (finalVessel && finalVessel.includes('Gel Vessel')) {
        finalVessel = gelRoomVessel;
      }

      if (m.stepIndex === 11 && taskDef.category === 'VirusInoculation') {
        finalTitle = `Working Virus Seed Prep: Strain ${round1StrainStr}`;
        finalStrain = round1StrainStr;
      } else if (m.stepIndex === 12 && taskDef.category === 'VirusInoculation') {
        finalVessel = round1VesselStr;
        finalStrain = round1StrainStr;
        finalTitle = `Virus Inoculation: Round 1 (${round1StrainStr} - ${round1VesselStr})`;
      } else if (m.stepIndex === 13 && taskDef.category === 'Inactivation') {
        finalVessel = round1VesselStr;
        finalStrain = round1StrainStr;
        finalTitle = `Inactivation: Round 1 (${round1StrainStr} - ${round1VesselStr})`;
      } else if (m.stepIndex === 14 && taskDef.category === 'VirusInoculation') {
        finalTitle = `Working Virus Seed Prep: Strain ${round2StrainStr}`;
        finalStrain = round2StrainStr;
      } else if (m.stepIndex === 15 && taskDef.category === 'VirusInoculation') {
        finalVessel = round2VesselStr;
        finalStrain = round2StrainStr;
        finalTitle = `Virus Inoculation: Round 2 (${round2StrainStr} - ${round2VesselStr})`;
      } else if (m.stepIndex === 16 && taskDef.category === 'Inactivation') {
        finalVessel = round2VesselStr;
        finalStrain = round2StrainStr;
        finalTitle = `Inactivation: Round 2 (${round2StrainStr} - ${round2VesselStr})`;
      } else if (m.stepIndex === 17 && taskDef.category === 'VirusInoculation') {
        finalTitle = `Working Virus Seed Prep: Strain ${round3StrainStr}`;
        finalStrain = round3StrainStr;
      } else if (m.stepIndex === 19 && taskDef.category === 'VirusInoculation') {
        finalVessel = round3VesselStr;
        finalStrain = round3StrainStr;
        finalTitle = `Virus Inoculation: Round 3 (${round3StrainStr} - ${round3VesselStr})`;
      } else if (m.stepIndex === 20 && taskDef.category === 'Inactivation') {
        finalVessel = round3VesselStr;
        finalStrain = round3StrainStr;
        finalTitle = `Inactivation: Round 3 (${round3StrainStr} - ${round3VesselStr})`;
      }

      const newTask: DailyProcessTask = {
        ...taskDef,
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: finalTitle,
        vessel: finalVessel,
        strain: finalStrain,
        status: 'planned'
      };
      remainingTimeline[targetDate].push(newTask);
      previewSteps.push({
        date: targetDate,
        dayOffsetFromNow: deltaDays,
        title: finalTitle,
        vessel: finalVessel,
        category: taskDef.category,
        phase: taskDef.phase
      });
    });
  });

  const lastMilestone = remainingMilestones[remainingMilestones.length - 1];
  const totalFutureDays = lastMilestone ? lastMilestone.dayOffset - currentMilestone.dayOffset : 0;

  return {
    matchedStepIndex: matchedIdx,
    matchedStepName: currentMilestone.stepName,
    totalRemainingTasks,
    totalFutureDays,
    remainingTimeline,
    previewSteps
  };
}

/**
 * Helper to get Persian weekday name for a Jalali date string (YYYY/MM/DD)
 */
export function getPersianWeekdayName(dateStr: string): string {
  const parts = dateStr.split('/').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return getDayNameForJalali(parts[0], parts[1], parts[2]);
  }
  return '';
}

export interface VesselPrerequisiteItem {
  dayOffset: number; // -5, -4, -3, -2, -1, 0
  date: string;
  dayName: string;
  ruleLabel: string;
  task: DailyProcessTask;
}

export interface SmartProcessSuggestion {
  vesselName?: string;
  isFillingEvent: boolean;
  isMediaPrepEvent: boolean;
  isFormulationEvent: boolean;
  isMechSealRequired: boolean;
  targetTaskTitle: string;
  currentDate: string;
  
  // Custom Round Configurations
  inoculationConfig?: InoculationRoundConfig;
  inoculationVessels?: InoculationRoundVessels;
  productType?: FormulationProductType;
  gelRoomVessel?: string;

  // Prerequisites (past dates: T-5, T-4, T-3, T-2, T-1, T-0)
  prerequisites: VesselPrerequisiteItem[];
  prerequisitesTimeline: Record<string, DailyProcessTask[]>;
  totalPrerequisiteTasks: number;
  
  // Subsequent campaign milestones (future dates)
  hasSubsequentSteps: boolean;
  matchedStepName?: string;
  subsequentSteps: RemainingCampaignSuggestion['previewSteps'];
  subsequentTimeline: Record<string, DailyProcessTask[]>;
  totalSubsequentTasks: number;
  
  // Combined Full Chain (Prerequisites + Subsequent steps)
  fullChainTimeline: Record<string, DailyProcessTask[]>;
  totalFullChainTasks: number;
}

/**
 * Detects whether a task or vessel setup requires prerequisite preparation:
 * - Bioreactors: CIP (T-3), PHT (T-2), Mechanical Seal SIP for 2700/1500 (T-2), Probe calib & SIP (T-1), Water intake (T-1), Media prep on same day (T-0)
 * - Gel Preparation for Aqueous Product: Water intake (T-5), Gel Synthesis (T-4), Gel Washing (T-3), Gel Vessel CIP 400L/1500L (T-2), PHT/SIP/Transfer/FSIP (T-1) -> Formulation (T-0)
 * - Oil Adjuvant for Oil Product: Gel Vessel CIP (T-2), PHT/SIP/Transfer Oil/FSIP (T-1), Cooled & Formulation (T-0)
 * Along with automated subsequent SOP milestones and custom vessel & strain selection.
 */
export function getSmartProcessSuggestions(
  currentTask: Partial<DailyProcessTask>,
  currentDate: string,
  options?: SmartSuggestionOptions
): SmartProcessSuggestion {
  const t = (currentTask.title || '').trim();
  const tLower = t.toLowerCase();
  const v = (currentTask.vessel || '').trim();
  const vLower = v.toLowerCase();
  const phase = (currentTask.phase || '').trim();
  const details = (currentTask.details || '').trim();
  const cat = currentTask.category;

  const combined = `${tLower} ${vLower} ${phase.toLowerCase()} ${details.toLowerCase()}`;

  // 1. Identify Vessel
  let vesselName = v;
  if (!vesselName) {
    if (combined.includes('2700') || combined.includes('۲۷۰۰')) {
      vesselName = 'Bioreactor 2700L';
    } else if (combined.includes('1500') || combined.includes('۱۵۰۰')) {
      if (combined.includes('gel') || combined.includes('ژل') || combined.includes('روغن')) {
        vesselName = 'Gel Vessel 1500L (Gel Room)';
      } else {
        vesselName = 'Bioreactor 1500L';
      }
    } else if (combined.includes('400') || combined.includes('۴۰۰')) {
      vesselName = 'Gel Vessel 400L (Gel Room)';
    } else if (combined.includes('700') || combined.includes('۷۰۰')) {
      vesselName = 'Bioreactor 700L';
    } else if (combined.includes('100') || combined.includes('۱۰۰')) {
      vesselName = 'Bioreactor 100L';
    } else if (combined.includes('43') || combined.includes('44') || combined.includes('۴۳') || combined.includes('۴۴')) {
      vesselName = 'Inactivation Vessel 43 & 44';
    } else if (combined.includes('3000') || combined.includes('۳۰۰۰')) {
      vesselName = 'Large Virus Vessel 3000L';
    } else if (combined.includes('250') || combined.includes('۲۵۰')) {
      vesselName = 'Mobile Vessel 250L (Cold Room)';
    } else if (combined.includes('formulation') || combined.includes('فرمولاسیون')) {
      vesselName = 'Formulation Vessel';
    }
  }

  // Check if vessel is Bioreactor 1500L or 2700L specifically (distinct)
  const is2700 = Boolean(vesselName && (vesselName.includes('2700') || vesselName.includes('۲۷۰۰')) && !vesselName.includes('Gel'));
  const is1500 = Boolean(vesselName && (vesselName.includes('1500') || vesselName.includes('۱۵۰۰')) && !vesselName.includes('Gel'));
  const is1500or2700 = is1500 || is2700;

  // Selected Gel Room Vessel (400L or 1500L)
  const gelRoomVessel = options?.gelRoomVessel || 
    (combined.includes('400') ? 'Gel Vessel 400L (Gel Room)' : 'Gel Vessel 1500L (Gel Room)');

  // Check if task is already an isolated cleaning/prep action
  const isAlreadyPrepOnly = 
    cat === 'VesselPrep' ||
    tLower.startsWith('cip') || 
    tLower.startsWith('pht') || 
    tLower.startsWith('sip') ||
    tLower.includes('کالیبراسیون پراب') ||
    tLower.includes('آب‌گیری') ||
    tLower.includes('مکانیکال سیل');

  // Detect Formulation Event
  const isAqueousFormulation = 
    combined.includes('محصول آبی') || 
    combined.includes('aqueous') || 
    (combined.includes('ژل') && !combined.includes('روغن')) ||
    (combined.includes('gel') && !combined.includes('oil'));

  const isOilFormulation = 
    combined.includes('محصول روغنی') || 
    combined.includes('oil product') || 
    combined.includes('روغن ادجوانت') ||
    combined.includes('adjuvant oil');

  const isFormulationEvent = Boolean(
    !isAlreadyPrepOnly &&
    (
      vesselName === 'Formulation Vessel' || 
      combined.includes('فرمولاسیون') || 
      combined.includes('formulation') ||
      isAqueousFormulation ||
      isOilFormulation
    )
  );

  // Sub-steps in Gel/Oil sequence
  const isGelSynthTask = (combined.includes('ساخت ژل') || combined.includes('gel synth')) && !isAlreadyPrepOnly;
  const isGelWashTask = (combined.includes('شستشوی ژل') || combined.includes('gel wash')) && !isAlreadyPrepOnly;
  const isGelCIPTask = (combined.includes('cip') && (combined.includes('ژل') || combined.includes('gel'))) && !isAlreadyPrepOnly;
  const isGelPHTSIPTask = ((combined.includes('pht') || combined.includes('sip') || combined.includes('fsip')) && (combined.includes('ژل') || combined.includes('gel'))) && !isAlreadyPrepOnly;
  const isOilFSIPTask = ((combined.includes('fsip') || combined.includes('روغن')) && combined.includes('روغن')) && !isAlreadyPrepOnly;

  // 2. Detect Bioreactor / Virus Vessel Filling Event
  const fillingKeywords = [
    'fill', 'filling', 'پر شدن', 'پر میشه', 'شارژ', 'charge', 'inoculat', 'تلقیح',
    'تکمیل', 'transfer to', 'انتقال به', 'انتقال', 'seed', 'کشت', 'culture',
    're-feed', 'split', 'هاروست', 'ورود'
  ];
  const hasFillingKeyword = fillingKeywords.some(k => combined.includes(k));
  
  const isFillingEvent = Boolean(
    !isAlreadyPrepOnly &&
    !isFormulationEvent &&
    vesselName &&
    vesselName !== 'Formulation Vessel' &&
    (
      hasFillingKeyword ||
      cat === 'CellCulture' ||
      cat === 'VirusInoculation' ||
      cat === 'Inactivation'
    )
  );

  // 3. Detect Media Prep Event
  const isMediaPrepEvent = Boolean(
    cat === 'MediaPrep' ||
    combined.includes('ساخت محیط') ||
    combined.includes('آماده‌سازی محیط') ||
    combined.includes('media prep')
  );

  // Generate Prerequisites
  const prerequisites: VesselPrerequisiteItem[] = [];
  const prerequisitesTimeline: Record<string, DailyProcessTask[]> = {};

  const addPrereqTask = (
    dayOffset: number,
    ruleLabel: string,
    taskData: Omit<DailyProcessTask, 'id' | 'status'>
  ) => {
    const targetDate = getNextJalaliDate(currentDate, dayOffset);
    const dayName = getPersianWeekdayName(targetDate);
    const fullTask: DailyProcessTask = {
      ...taskData,
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      status: 'planned'
    };

    prerequisites.push({
      dayOffset,
      date: targetDate,
      dayName,
      ruleLabel,
      task: fullTask
    });

    if (!prerequisitesTimeline[targetDate]) {
      prerequisitesTimeline[targetDate] = [];
    }
    prerequisitesTimeline[targetDate].push(fullTask);
  };

  const mediumUsed = currentTask.medium || (cat === 'VirusInoculation' ? 'Earl' : 'EMEM + Serum');

  // PATH 1: FORMULATION WORKFLOW (Aqueous with Gel & Oil with Adjuvant Oil)
  if (isFormulationEvent) {
    const productType = options?.productType || 
      (isOilFormulation ? 'oil_adjuvant' : isAqueousFormulation ? 'aqueous_gel' : 'both');

    // Aqueous Product (Gel) SOP:
    // T-5: Water intake in Gel Room
    // T-4: Gel Synthesis
    // T-3: Gel Washing
    // T-2: Gel Room Vessel CIP (400L or 1500L)
    // T-1: PHT, SIP, Transfer Gel & FSIP Gel
    // T-0: Ready for Aqueous Formulation
    if (productType === 'aqueous_gel' || productType === 'both') {
      addPrereqTask(-5, '۵ روز قبل از فرمولاسیون (روز قبل از ساخت ژل)', {
        title: `آب‌گیری مخزن اتاق ژل جهت ساخت ژل (WFI/RO)`,
        category: 'Downstream',
        vessel: gelRoomVessel,
        phase: 'آب‌گیری WFI/RO',
        details: `تأمین و آب‌گیری آب خالص WFI / RO در مخزن اتاق ژل ۱ روز قبل از ساخت ژل جهت آماده‌سازی محصول آبی.`,
        color: '#0284c7'
      });

      addPrereqTask(-4, '۴ روز قبل از فرمولاسیون (روز بعد از آب‌گیری)', {
        title: `ساخت ژل ادجوانت در اتاق ژل (Gel Synthesis)`,
        category: 'Downstream',
        vessel: gelRoomVessel,
        phase: 'ساخت و فرمولاسیون ژل',
        details: `ساخت و فرمولاسیون ژل ادجوانت در اتاق ژل روز بعد از آب‌گیری طبق پروتکل استاندارد کارخانه.`,
        color: '#0d9488'
      });

      addPrereqTask(-3, '۳ روز قبل از فرمولاسیون (روز بعد از ساخت ژل)', {
        title: `شستشوی ژل ادجوانت در اتاق ژل (Gel Washing)`,
        category: 'Downstream',
        vessel: gelRoomVessel,
        phase: 'شستشوی ژل ادجوانت',
        details: `عملیات شستشوی ژل ادجوانت در اتاق ژل در روز بعد از ساخت ژل.`,
        color: '#14b8a6'
      });

      addPrereqTask(-2, '۲ روز قبل از فرمولاسیون (روز بعد از شستشوی ژل)', {
        title: `CIP وسل ژل (${gelRoomVessel}) در اتاق ژل`,
        category: 'VesselPrep',
        vessel: gelRoomVessel,
        phase: 'شستشوی درجا (CIP) وسل ژل',
        details: `شستشوی درجا (CIP) وسل ژل (${gelRoomVessel}) در اتاق ژل در روز بعد از شستشوی ژل. (بدون مصرف محیط/بافر)`,
        color: '#2563eb'
      });

      addPrereqTask(-1, '۱ روز قبل از فرمولاسیون (PHT, SIP, انتقال ژل و FSIP)', {
        title: `تست PHT، استریل SIP، انتقال ژل به وسل و FSIP ژل (${gelRoomVessel})`,
        category: 'Downstream',
        vessel: gelRoomVessel,
        phase: 'PHT, SIP, انتقال ژل و FSIP',
        details: `تست افت فشار PHT و استریل SIP وسل ژل (${gelRoomVessel})، انتقال ژل به وسل و استریل حرارتی نهایی (FSIP ژل) جهت مصرف در فرمولاسیون روز بعد.`,
        color: '#7c3aed'
      });
    }

    // Oil Product (Adjuvant Oil) SOP:
    // T-2: Gel Room Vessel CIP (400L or 1500L)
    // T-1: PHT, SIP, Transfer Oil & FSIP Oil
    // T-0: Cooling down & Ready for Oil Formulation
    if (productType === 'oil_adjuvant' || productType === 'both') {
      if (productType === 'oil_adjuvant') {
        addPrereqTask(-2, '۲ روز قبل از فرمولاسیون محصول روغنی', {
          title: `CIP وسل اتاق ژل (${gelRoomVessel}) جهت آماده‌سازی روغن`,
          category: 'VesselPrep',
          vessel: gelRoomVessel,
          phase: 'شستشوی درجا (CIP) وسل ژل',
          details: `شستشوی درجا (CIP) مخزن اتاق ژل (${gelRoomVessel}) قبل از ورود روغن ادجوانت. (بدون مصرف محیط/بافر)`,
          color: '#2563eb'
        });
      }

      addPrereqTask(-1, '۱ روز قبل از فرمولاسیون محصول روغنی', {
        title: `تست PHT، استریل SIP، انتقال روغن ادجوانت و FSIP روغن (${gelRoomVessel})`,
        category: 'Downstream',
        vessel: gelRoomVessel,
        phase: 'PHT, SIP, انتقال روغن و FSIP',
        details: `تست PHT و استریل SIP وسل، انتقال روغن ادجوانت و استریل نهایی FSIP روغن، خنک‌سازی جهت فرمولاسیون روز بعد.`,
        color: '#4f46e5'
      });
    }
  } 
  // Intermediate sub-steps for Gel & Oil
  else if (isGelSynthTask) {
    addPrereqTask(-1, 'روز قبل از ساخت ژل (تأمین آب WFI/RO)', {
      title: `آب‌گیری مخزن اتاق ژل جهت ساخت ژل (WFI/RO)`,
      category: 'Downstream',
      vessel: gelRoomVessel,
      phase: 'آب‌گیری WFI/RO',
      details: `تأمین و آب‌گیری آب خالص WFI / RO در مخزن اتاق ژل ۱ روز قبل از ساخت ژل.`,
      color: '#0284c7'
    });
  } else if (isGelWashTask) {
    addPrereqTask(-1, 'روز قبل از شستشوی ژل (ساخت ژل)', {
      title: `ساخت ژل ادجوانت در اتاق ژل (Gel Synthesis)`,
      category: 'Downstream',
      vessel: gelRoomVessel,
      phase: 'ساخت و فرمولاسیون ژل',
      details: `ساخت و فرمولاسیون ژل ادجوانت در اتاق ژل ۱ روز قبل از شستشو.`,
      color: '#0d9488'
    });
  } else if (isGelCIPTask) {
    addPrereqTask(-1, 'روز قبل از CIP وسل ژل (شستشوی ژل)', {
      title: `شستشوی ژل ادجوانت در اتاق ژل (Gel Washing)`,
      category: 'Downstream',
      vessel: gelRoomVessel,
      phase: 'شستشوی ژل ادجوانت',
      details: `عملیات شستشوی ژل ادجوانت در اتاق ژل ۱ روز قبل از CIP وسل ژل.`,
      color: '#14b8a6'
    });
  } else if (isGelPHTSIPTask || isOilFSIPTask) {
    addPrereqTask(-1, 'روز قبل از PHT/SIP/FSIP وسل ژل', {
      title: `CIP وسل ژل (${gelRoomVessel}) در اتاق ژل`,
      category: 'VesselPrep',
      vessel: gelRoomVessel,
      phase: 'شستشوی درجا (CIP) وسل ژل',
      details: `شستشوی درجا (CIP) وسل ژل (${gelRoomVessel}) در اتاق ژل ۱ روز قبل از PHT و SIP. (بدون مصرف محیط/بافر)`,
      color: '#2563eb'
    });
  }
  // PATH 2: BIOREACTOR & VIRUS INOCULATION FILLING WORKFLOW
  else if (isFillingEvent && vesselName) {
    // Rule 1: At least 3 days before -> CIP
    addPrereqTask(-3, 'حداقل ۳ روز قبل از پر شدن وسل', {
      title: `CIP وسل ${vesselName}`,
      category: 'VesselPrep',
      vessel: vesselName,
      phase: 'شستشوی درجا (CIP)',
      details: `شستشوی اتوماتیک/دستی خطوط و بدنه ${vesselName} حداقل ۳ روز قبل از شارژ و پر شدن. (بدون مصرف محیط/بافر)`,
      color: '#2563eb'
    });

    // Rule 2: At least 2 days before -> PHT
    addPrereqTask(-2, 'حداقل ۲ روز قبل از پر شدن وسل', {
      title: `تست فشار و نشتی (PHT) وسل ${vesselName}`,
      category: 'VesselPrep',
      vessel: vesselName,
      phase: 'تست افت فشار و هوابندی (PHT)',
      details: `تست هوای فشرده و فشار ایستا جهت اطمینان از سلامت گسکت‌ها و عدم افت فشار در مخزن ${vesselName}. (بدون مصرف محیط/بافر)`,
      color: '#3b82f6'
    });

    // Rule 3: Mechanical Seal SIP at least 2 days prior (separated per vessel)
    if (is2700) {
      addPrereqTask(-2, 'حداقل ۲ روز قبل از پر شدن (مخصوص بیوراکتور ۲۷۰۰)', {
        title: `SIP مکانیکال سیل بیوراکتور 2700L`,
        category: 'VesselPrep',
        vessel: 'Bioreactor 2700L',
        phase: 'استریلیزاسیون سیل مکانیکی شفت همزن (Mechanical Seal SIP)',
        details: `استریلیزاسیون مجزا با بخار تمیز برای محفظه سیل مکانیکی شفت همزن Bioreactor 2700L حداقل ۲ روز قبل از شارژ و پر شدن. (بدون مصرف محیط/بافر)`,
        color: '#4f46e5'
      });
    }
    if (is1500) {
      addPrereqTask(-2, 'حداقل ۲ روز قبل از پر شدن (مخصوص بیوراکتور ۱۵۰۰)', {
        title: `SIP مکانیکال سیل بیوراکتور 1500L`,
        category: 'VesselPrep',
        vessel: 'Bioreactor 1500L',
        phase: 'استریلیزاسیون سیل مکانیکی شفت همزن (Mechanical Seal SIP)',
        details: `استریلیزاسیون مجزا با بخار تمیز برای محفظه سیل مکانیکی شفت همزن Bioreactor 1500L حداقل ۲ روز قبل از شارژ و پر شدن. (بدون مصرف محیط/بافر)`,
        color: '#4338ca'
      });
    }

    // Rule 4: At least 1 day before -> Probes calibration & Vessel SIP
    addPrereqTask(-1, 'حداقل ۱ روز قبل از پر شدن (روز قبل)', {
      title: `کالیبراسیون پراب‌ها و SIP وسل ${vesselName}`,
      category: 'VesselPrep',
      vessel: vesselName,
      phase: 'کالیبره پراب‌های pH/DO و استریلیزاسیون حرارتی درجا (SIP)',
      details: `کالیبراسیون الکترودهای pH و DO، نصب روی مخزن ${vesselName} و اجرای چرخه استریلیزاسیون با بخار (SIP). (بدون مصرف محیط/بافر)`,
      color: '#7c3aed'
    });

    // Rule 5: Water intake 1 day before media prep -> Day -1
    addPrereqTask(-1, 'روز قبل از ساخت محیط کشت (تأمین آب WFI/RO)', {
      title: `آب‌گیری مخزن جهت ساخت محیط کشت (${mediumUsed})`,
      category: 'MediaPrep',
      phase: 'آب‌گیری ۱ روز قبل از ساخت محیط کشت',
      details: `تأمین و آب‌گیری آب خالص WFI / RO در مخزن آماده‌سازی ۱ روز قبل از فرمولاسیون محیط جهت پر شدن ${vesselName}.`,
      color: '#0284c7'
    });

    // Rule 6: Media preparation on the SAME DAY (T-0) as filling
    addPrereqTask(0, 'ساخت محیط در همان روز پر شدن وسل (همزمان)', {
      title: `ساخت محیط کشت (${mediumUsed}) جهت پر شدن ${vesselName}`,
      category: 'MediaPrep',
      phase: 'فرمولاسیون و فیلتراسیون استریل محیط (همان روز پر شدن)',
      details: `فرمولاسیون محیط کشت ${mediumUsed} و فیلتراسیون استریل ۰.۲۲ میکرون در همان روز پر شدن جهت شارژ مستقیم به ${vesselName}.`,
      color: '#0d9488'
    });
  } 
  // Standalone Media Prep task
  else if (isMediaPrepEvent && !isAlreadyPrepOnly) {
    addPrereqTask(-1, 'روز قبل از ساخت محیط کشت (تأمین آب WFI/RO)', {
      title: `آب‌گیری مخزن جهت ساخت محیط کشت`,
      category: 'MediaPrep',
      phase: 'آب‌گیری ۱ روز قبل از ساخت محیط کشت',
      details: `تأمین و آب‌گیری آب خالص WFI / RO روز قبل از فرمولاسیون محیط کشت طبق پروتکل استاندارد.`,
      color: '#0284c7'
    });
  }

  // Sort prerequisites chronologically (earliest first: -5, -4, -3, -2, -1, 0)
  prerequisites.sort((a, b) => a.dayOffset - b.dayOffset);

  // Subsequent Campaign steps with optional custom Inoculation Vessels & Strains
  const remainingSuggestion = getRemainingCampaignSuggestion(currentTask, currentDate, options);
  const hasSubsequentSteps = Boolean(remainingSuggestion && remainingSuggestion.totalRemainingTasks > 0);
  const subsequentSteps = remainingSuggestion?.previewSteps || [];
  const subsequentTimeline = remainingSuggestion?.remainingTimeline || {};
  const totalSubsequentTasks = remainingSuggestion?.totalRemainingTasks || 0;

  // Build Full Chain Timeline (Prerequisites + Subsequent)
  const fullChainTimeline: Record<string, DailyProcessTask[]> = {};

  Object.entries(prerequisitesTimeline).forEach(([d, tasks]) => {
    fullChainTimeline[d] = [...(fullChainTimeline[d] || []), ...tasks];
  });

  Object.entries(subsequentTimeline).forEach(([d, tasks]) => {
    fullChainTimeline[d] = [...(fullChainTimeline[d] || []), ...tasks];
  });

  return {
    vesselName,
    isFillingEvent,
    isMediaPrepEvent,
    isFormulationEvent,
    isMechSealRequired: is1500or2700,
    targetTaskTitle: t || 'پروسه جاری',
    currentDate,
    inoculationConfig: options?.inoculationConfig,
    inoculationVessels: options?.inoculationVessels,
    productType: options?.productType,
    gelRoomVessel,
    prerequisites,
    prerequisitesTimeline,
    totalPrerequisiteTasks: prerequisites.length,
    hasSubsequentSteps,
    matchedStepName: remainingSuggestion?.matchedStepName,
    subsequentSteps,
    subsequentTimeline,
    totalSubsequentTasks,
    fullChainTimeline,
    totalFullChainTasks: prerequisites.length + totalSubsequentTasks
  };
}


/**
 * Suggests the logical next passage step (2 days later) based on current task
 */
export function getNextPassageSuggestion(currentTask: DailyProcessTask, currentDate: string): { nextDate: string; nextTask: Partial<DailyProcessTask> } | null {
  const nextDate = getNextJalaliDate(currentDate, 2);
  const t = (currentTask.title || '').toLowerCase();

  if (t.includes('thaw') || t.includes('t-flask 175 (80') || t.includes('ذوب')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Seed: Passage to 2x T-Flask 175',
        category: 'CellCulture',
        vessel: 'T-Flask 175cm²',
        medium: 'EMEM + Serum',
        phase: '2-Day Cell Passage',
        color: '#059669'
      }
    };
  }
  if (t.includes('2x t-flask') || t.includes('۲ فلاسک')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Seed: Passage to 4x T-Flask 175',
        category: 'CellCulture',
        vessel: 'T-Flask 175cm²',
        medium: 'EMEM + Serum',
        phase: '2-Day Cell Passage',
        color: '#059669'
      }
    };
  }
  if (t.includes('4x t-flask') || t.includes('۴ فلاسک')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Seed: Transfer to Spinner Bottle 1L',
        category: 'CellCulture',
        vessel: 'Spinner Bottle 1L',
        medium: 'EMEM + Serum',
        phase: 'Transfer to spinner bottle',
        color: '#10b981'
      }
    };
  }
  if (t.includes('spinner bottle 1l') || t.includes('۱ لیتری')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Seed: Passage to Spinner Bottle 2L',
        category: 'CellCulture',
        vessel: 'Spinner Bottle 2L',
        medium: 'EMEM + Serum',
        phase: '2-Day Passage',
        color: '#10b981'
      }
    };
  }
  if (t.includes('spinner bottle 2l') || t.includes('۲ لیتری')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Seed: Passage to Spinner Bottle 5L',
        category: 'CellCulture',
        vessel: 'Spinner Bottle 5L',
        medium: 'EMEM + Serum',
        phase: '2-Day Passage',
        color: '#10b981'
      }
    };
  }
  if (t.includes('spinner bottle 5l') || t.includes('۵ لیتری')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Seed: Passage to Spinner Bottle 10L',
        category: 'CellCulture',
        vessel: 'Spinner Bottle 10L',
        medium: 'EMEM + Serum',
        phase: '2-Day Passage',
        color: '#10b981'
      }
    };
  }
  if (t.includes('spinner bottle 10l') && !t.includes('3x') && !t.includes('۳')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Seed: Scale-up to 3x Spinner Bottle 10L (15-20L)',
        category: 'CellCulture',
        vessel: '3x Spinner Bottles 10L',
        medium: 'EMEM + Serum',
        phase: 'Reach 15 - 20 Liters Seed Volume',
        color: '#047857'
      }
    };
  }
  if (t.includes('3x spinner') || t.includes('۳ تا بطری ۱۰')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Culture: Bioreactor 100L (Initial Charge 1/3 - 1/2)',
        category: 'CellCulture',
        vessel: 'Bioreactor 100L',
        medium: 'EMEM + Serum',
        phase: 'Inoculate 15-20L seed into Bioreactor 100L',
        color: '#15803d'
      }
    };
  }
  if (t.includes('bioreactor 100l (initial') || t.includes('۱۰۰l (شارژ')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Culture: Bioreactor 100L (Full Volume 100%)',
        category: 'CellCulture',
        vessel: 'Bioreactor 100L',
        medium: 'EMEM + Serum',
        phase: 'Top up to 100% volume with EMEM + Serum',
        color: '#15803d'
      }
    };
  }
  if (t.includes('bioreactor 100l (full') || t.includes('۱۰۰l (تکمیل')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Culture: Transfer to Bioreactor 700L + Chilled in 100L',
        category: 'CellCulture',
        vessel: 'Bioreactor 700L',
        medium: 'EMEM + Serum',
        phase: 'Transfer to 700L + Chilled storage in 100L',
        color: '#0d9488'
      }
    };
  }
  if (t.includes('bioreactor 700l') && !t.includes('direct transfer')) {
    return {
      nextDate,
      nextTask: {
        title: 'Cell Culture: Direct Transfer to Bioreactor 2700L + Chilled in 700L',
        category: 'CellCulture',
        vessel: 'Bioreactor 2700L',
        medium: 'EMEM + Serum',
        phase: 'Direct transfer to 2700L + Chilled storage in 700L',
        color: '#047857'
      }
    };
  }
  if (t.includes('bioreactor 2700l') && !t.includes('re-feed') && !t.includes('combine')) {
    return {
      nextDate,
      nextTask: {
        title: 'Virus Inoculation: Round 1 (Inactivation Vessels 43 & 44)',
        category: 'VirusInoculation',
        vessel: 'Inactivation Vessel 43 & 44',
        strain: 'O2016/1 & Asia',
        medium: 'Earl',
        phase: 'Virus Inoculation',
        color: '#ea580c'
      }
    };
  }

  // Default 2-day passage in same vessel
  return {
    nextDate,
    nextTask: {
      title: `${currentTask.title} (Next Passage)`,
      category: currentTask.category,
      vessel: currentTask.vessel,
      medium: currentTask.medium || 'EMEM + Serum',
      phase: '2-Day Passage',
      color: currentTask.color
    }
  };
}
