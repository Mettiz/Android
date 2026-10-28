/**
 * ShiftFlow System Constants - v1.0.3 (Synced with Live Firestore & 1405 Dataset)
 */
import { ShiftEntry, Personnel, ProductionBatch, DailyProcessItem, DailyScheduleProcesses } from "./types";
import { FALLBACK_ROSTER_STATE } from "./utils/fallbackRoster.ts";

export const OFFICIAL_HOLIDAYS = [
  "1405/01/01",
  "1405/01/02",
  "1405/01/03",
  "1405/01/04",
  "1405/01/12",
  "1405/01/13",
  "1405/02/08",
  "1405/03/14",
  "1405/03/15",
  "1405/03/29",
  "1405/04/07",
  "1405/04/16",
  "1405/04/24",
  "1405/05/23",
  "1405/05/30",
  "1405/06/06",
  "1405/06/13",
  "1405/06/20",
  "1405/06/27",
  "1405/09/03",
  "1405/10/13",
  "1405/10/27",
  "1405/11/15",
  "1405/11/22",
  "1405/12/20",
  "1405/12/29"
];

export const INITIAL_PERSONNEL: Personnel[] = FALLBACK_ROSTER_STATE.personnelList as Personnel[];

export const SCHEDULE_DATA: ShiftEntry[] = FALLBACK_ROSTER_STATE.schedule as ShiftEntry[];

export const INITIAL_PRODUCTION_BATCHES: ProductionBatch[] = [
  {
    id: "batch-fmd-1405-02",
    batchNumber: "FMD-1405-02",
    productName: "واکسن تب برفکی ۳ ظرفیتی (سویه‌های O, A, Asia-1)",
    startDate: "1405/05/20",
    endDate: "1405/06/25",
    targetVolume: "۱۲۰۰ لیتر (۳۰۰,۰۰۰ دوز)",
    status: "in_progress",
    description: "بچ تولیدی اصلی شهریور ۱۴۰۵ با سویه غالب O-PanAsia و فرمولاسیون روغنی",
    steps: [
      {
        id: "step-101",
        title: "آماده‌سازی محیط و کشت سلول BHK-21 در بیوراکتور ۳۰۰L",
        startDate: "1405/05/20",
        endDate: "1405/05/26",
        durationDays: 7,
        assignedTo: "مهندس دهقان",
        shiftType: "Day",
        status: "completed",
        notes: "تراکم سلولی اولیه 2.1x10^6 cells/ml با ویابیلیتی ۹۶٪ حاصل شد.",
        color: "#3b82f6"
      },
      {
        id: "step-102",
        title: "تلقیح بذر ویروس و تکثیر در بیوراکتور ۱۲۰۰L",
        startDate: "1405/05/27",
        endDate: "1405/05/30",
        durationDays: 4,
        assignedTo: "مهندس سپهر آرا",
        shiftType: "Day",
        status: "completed",
        notes: "پایش پارامترهای DO و pH روی ۷.۲ - درصد CPE به ۹۵٪ رسید.",
        color: "#8b5cf6"
      },
      {
        id: "step-103",
        title: "برداشت، شفاف‌سازی (Clarification) و سانتریفیوژ آنتی‌ژن",
        startDate: "1405/05/31",
        endDate: "1405/06/03",
        durationDays: 4,
        assignedTo: "مهندس سلیمان فلاح",
        shiftType: "Day",
        status: "completed",
        notes: "حجم برداشت ۱۱۸۰ لیتر، فیلتراسیون با کارتریج عمقی انجام شد.",
        color: "#f59e0b"
      },
      {
        id: "step-104",
        title: "غیرفعال‌سازی شیمیایی با BEI اول و دوم و خنثی‌سازی",
        startDate: "1405/06/04",
        endDate: "1405/06/07",
        durationDays: 4,
        assignedTo: "مهندس سالاروند",
        shiftType: "Night",
        status: "in_progress",
        notes: "ساعت صفر و ساعت ۲۴ نمونه‌برداری شد. خنثی‌سازی با تیوسولفات سدیم در حال اجراست.",
        color: "#ef4444"
      },
      {
        id: "step-105",
        title: "تغلیظ و اولترافیلتراسیون ممبرانی (UF / 100kDa)",
        startDate: "1405/06/08",
        endDate: "1405/06/12",
        durationDays: 5,
        assignedTo: "مهندس لسانی",
        shiftType: "Day",
        status: "planned",
        notes: "تغلیظ نهایی به فاکتور 20X جهت تهیه آنتی‌ژن خالص 146S.",
        color: "#06b6d4"
      },
      {
        id: "step-106",
        title: "فرمولاسیون و اختلاط با ادجوانت روغنی Montanide ISA 206",
        startDate: "1405/06/13",
        endDate: "1405/06/17",
        durationDays: 5,
        assignedTo: "مهندس حیدری",
        shiftType: "Day",
        status: "planned",
        notes: "امولسیون آب در روغن در آب (W/O/W) با ویسکوزیته استاندارد.",
        color: "#10b981"
      },
      {
        id: "step-107",
        title: "پرکنی استریل در ویال‌های ۵۰ دوزی و برچسب‌زنی",
        startDate: "1405/06/18",
        endDate: "1405/06/21",
        durationDays: 4,
        assignedTo: "آقای رحیمی",
        shiftType: "Day",
        status: "planned",
        notes: "سرعت پرکنی ۴۵۰۰ ویال در ساعت تحت هود جریان لامینار کلاس A.",
        color: "#6366f1"
      },
      {
        id: "step-108",
        title: "تست‌های کنترل کیفی QC (سترونی، ایمنی، پایداری و پوتانسی)",
        startDate: "1405/06/22",
        endDate: "1405/06/25",
        durationDays: 4,
        assignedTo: "مهندس سلیمان فلاح",
        shiftType: "Day",
        status: "planned",
        notes: "انکوباسیون ۱۴ روزه تست استریلیتی و ارزیابی خلوص آنتی‌ژن در سرم گوساله.",
        color: "#ec4899"
      }
    ]
  },
  {
    id: "batch-fmd-1405-03",
    batchNumber: "FMD-1405-03",
    productName: "واکسن مونووالان اضطراری (سویه تقویتی A-05)",
    startDate: "1405/06/26",
    endDate: "1405/07/20",
    targetVolume: "۸۰۰ لیتر (۲۰۰,۰۰۰ دوز)",
    status: "planned",
    description: "بچ تولیدی پاییزه جهت تامین ذخیره استراتژیک دامپزشکی",
    steps: [
      {
        id: "step-201",
        title: "شستشو و استریلیزاسیون خط تولید (CIP / SIP) و تست کالیبراسیون",
        startDate: "1405/06/26",
        endDate: "1405/06/28",
        durationDays: 3,
        assignedTo: "مهندس سالاروند",
        shiftType: "Day",
        status: "planned",
        notes: "تست فشار بیوراکتورها و اتوکلاو استریلیزاسیون فیلترها.",
        color: "#64748b"
      },
      {
        id: "step-202",
        title: "آماده‌سازی بذر و کشت سلولی مرحله اول BHK-21",
        startDate: "1405/06/29",
        endDate: "1405/07/04",
        durationDays: 6,
        assignedTo: "مهندس دهقان",
        shiftType: "Day",
        status: "planned",
        notes: "محیط کشت GMEM بدون سرم به همراه پپتون.",
        color: "#3b82f6"
      },
      {
        id: "step-203",
        title: "تلقیح و تکثیر سویه A در بیوراکتور",
        startDate: "1405/07/05",
        endDate: "1405/07/08",
        durationDays: 4,
        assignedTo: "مهندس سپهر آرا",
        shiftType: "Day",
        status: "planned",
        notes: "تکثیر در دمای ۳۶.۵ درجه و سنجش تیتر ویروس.",
        color: "#8b5cf6"
      },
      {
        id: "step-204",
        title: "برداشت، غیرفعال‌سازی و تغلیظ ممبرانی",
        startDate: "1405/07/09",
        endDate: "1405/07/13",
        durationDays: 5,
        assignedTo: "مهندس لسانی",
        shiftType: "Night",
        status: "planned",
        notes: "غیرفعال‌سازی با برومواتیلن ایمین و بررسی سینتیک غیرفعال‌سازی.",
        color: "#ef4444"
      },
      {
        id: "step-205",
        title: "فرمولاسیون نهایی، پرکنی و ترخیص نهایی محصول",
        startDate: "1405/07/14",
        endDate: "1405/07/20",
        durationDays: 7,
        assignedTo: "مهندس حیدری",
        shiftType: "Day",
        status: "planned",
        notes: "ترکیب با ساپونین و ادجوانت و بسته‌بندی در سردخانه ۴ درجه.",
        color: "#10b981"
      }
    ]
  }
];

// --- FMD Plant Specific Process Categories (Defined by Plant Supervisor) ---
export const DEFAULT_PROCESS_TEMPLATES: string[] = [
  "کشت سلول",
  "محیط سازی",
  "پایش سلول و بیوراکتور",
  "پاساژ سلول به وسل بزرگتر",
  "تلقیح ویروس",
  "این اکتیویشن با BEI",
  "تخلیه در موبایل وسل ۲۵۰L و انتقال به کلدروم",
  "نگهداری سلول مازاد در چیلد",
  "ساخت ژل",
  "FSIP ژل",
  "FSIP روغن ادجوانت",
  "فرمولاسیون نهایی",
  "فیلینگ، کپینگ، لیبلینگ و بسته بندی",
  "شستشو و استریلیزاسیون CIP / SIP",
  "پایش کنترل کیفی QC و ترخیص"
];

// --- Plant Vessels & Bioreactors ---
export const DEFAULT_VESSELS: string[] = [
  "بیوراکتور 100L",
  "بیوراکتور 700L",
  "بیوراکتور 1500L",
  "بیوراکتور 2700L",
  "وسل این‌اکتیو ۴۳ (3000L)",
  "وسل این‌اکتیو ۴۴ (3000L)",
  "وسل لارج ویروس (3000L)",
  "موبایل وسل ۲۵۰L",
  "چیلد / کلدروم"
];

// --- 6 Standard FMD Vaccine Strains / Serotypes ---
export const DEFAULT_STRAINS: string[] = [
  "O2016/1",
  "Asia",
  "AGVII",
  "A05",
  "SAT1",
  "SAT2"
];

// --- Initial Plant Schedule with Pre-populated Daily Tasks for 1405 ---
export const INITIAL_DAILY_PROCESSES: DailyScheduleProcesses = {
  "1405/05/26": [
    {
      id: "dp-1",
      title: "Cell culture Bioreactor 100L",
      processName: "کشت سلول",
      vessel: "بیوراکتور 100L",
      notes: "شروع کشت بذر BHK-21 در بیوراکتور ۱۰۰ لیتری با تراکم سلولی اولیه 2x10^6",
      color: "#0284c7"
    }
  ],
  "1405/05/27": [
    {
      id: "dp-2",
      title: "پایش سلول و پارامترهای DO و pH بیوراکتور 100L",
      processName: "پایش سلول و بیوراکتور",
      vessel: "بیوراکتور 100L",
      notes: "سنجش کانت و ویابیلیتی (هدف بالای ۹۵٪)",
      color: "#059669"
    }
  ],
  "1405/05/28": [
    {
      id: "dp-3",
      title: "پاساژ سلول به بیوراکتور 700L (۲ روزه)",
      processName: "پاساژ سلول به وسل بزرگتر",
      vessel: "بیوراکتور 700L",
      notes: "پاساژ بعد از ۲ روز به وسل ۷۰۰ لیتری به همراه افزودن محیط تازه",
      color: "#7c3aed"
    }
  ],
  "1405/05/29": [
    {
      id: "dp-4",
      title: "پایش بیوراکتور 700L و آماده‌سازی وسل ۱۵۰۰L",
      processName: "پایش سلول و بیوراکتور",
      vessel: "بیوراکتور 700L",
      notes: "کنترل سرعت همزن و اکسیژن محلول",
      color: "#059669"
    }
  ],
  "1405/05/30": [
    {
      id: "dp-5",
      title: "پاساژ سلول به بیوراکتور 1500L (۲ روزه)",
      processName: "پاساژ سلول به وسل بزرگتر",
      vessel: "بیوراکتور 1500L",
      notes: "انتقال آسپتیک سلول به وسل ۱۵۰۰ لیتر",
      color: "#7c3aed"
    }
  ],
  "1405/05/31": [
    {
      id: "dp-6",
      title: "پایش بیوراکتور 1500L و محیط‌سازی نهایی",
      processName: "پایش سلول و بیوراکتور",
      vessel: "بیوراکتور 1500L",
      notes: "آماده‌سازی بیوراکتور ۲۷۰۰ لیتر برای پاساژ نهایی",
      color: "#059669"
    }
  ],
  "1405/06/01": [
    {
      id: "dp-7",
      title: "پاساژ نهایی به بیوراکتور 2700L",
      processName: "پاساژ سلول به وسل بزرگتر",
      vessel: "بیوراکتور 2700L",
      notes: "رسیدن به حداکثر حجم کشت سلول کارخانه",
      color: "#2563eb"
    }
  ],
  "1405/06/02": [
    {
      id: "dp-8",
      title: "پایش کانت نهایی + نگهداری مازاد سلول در چیلد",
      processName: "نگهداری سلول مازاد در چیلد",
      vessel: "بیوراکتور 2700L",
      notes: "کانت سلولی بالا - بخشی از سلول به چیلد متصل شد جهت نگهداری",
      color: "#0284c7"
    }
  ],
  "1405/06/03": [
    {
      id: "dp-9",
      title: "تلقیح سری اول در وسل‌های این‌اکتیو ۴۳ و ۴۴",
      processName: "تلقیح ویروس",
      vessel: "وسل این‌اکتیو ۴۳ (3000L)",
      strain: "O2016/1",
      notes: "انتقال سلول از وسل ۲۷۰۰ و تلقیح همزمان سویه O2016/1 در وسل ۴۳ و سویه Asia در وسل ۴۴",
      color: "#e11d48"
    }
  ],
  "1405/06/04": [
    {
      id: "dp-10",
      title: "این‌اکتیویشن با BEI (وسل این‌اکتیو ۴۳ و ۴۴)",
      processName: "این اکتیویشن با BEI",
      vessel: "وسل این‌اکتیو ۴۳ (3000L)",
      strain: "O2016/1",
      notes: "تزریق BEI اول و دوم و خنثی‌سازی با تیوسولفات سدیم",
      color: "#ef4444"
    }
  ],
  "1405/06/05": [
    {
      id: "dp-11",
      title: "تخلیه وسل ۴۳ در موبایل وسل ۲۵۰L و انتقال به کلدروم",
      processName: "تخلیه در موبایل وسل ۲۵۰L و انتقال به کلدروم",
      vessel: "موبایل وسل ۲۵۰L",
      strain: "O2016/1",
      notes: "تخلیه کامل و انتقال آنتی‌ژن غیرفعال‌شده به سردخانه برای آماده‌سازی وسل ۴۳",
      color: "#d97706"
    }
  ],
  "1405/06/06": [
    {
      id: "dp-12",
      title: "تلقیح سری دوم (وسل این‌اکتیو ۴۳ + وسل لارج ویروس ۳۰۰۰L)",
      processName: "تلقیح ویروس",
      vessel: "وسل لارج ویروس (3000L)",
      strain: "AGVII",
      notes: "تلقیح سویه AGVII در وسل این‌اکتیو ۴۳ و سویه A05 در وسل لارج ویروس",
      color: "#e11d48"
    }
  ],
  "1405/06/07": [
    {
      id: "dp-13",
      title: "این‌اکتیویشن سری دوم سویه‌ها (AGVII و A05)",
      processName: "این اکتیویشن با BEI",
      vessel: "وسل این‌اکتیو ۴۳ (3000L)",
      strain: "AGVII",
      notes: "پایش ۲۴ ساعته غیرفعال‌سازی در هر دو وسل",
      color: "#ef4444"
    }
  ],
  "1405/06/08": [
    {
      id: "dp-14",
      title: "تلقیح سری سوم در بیوراکتور 2700L و 1500L (سویه‌های SAT1 و SAT2)",
      processName: "تلقیح ویروس",
      vessel: "بیوراکتور 2700L",
      strain: "SAT1",
      notes: "تلقیح مستقیم در بیوراکتور ۲۷۰۰ (SAT1) و ۱۵۰۰ (SAT2) جهت تکمیل هر ۶ سویه واکسن",
      color: "#e11d48"
    }
  ],
  "1405/06/09": [
    {
      id: "dp-15",
      title: "ساخت ژل و استریلیزاسیون FSIP ژل",
      processName: "ساخت ژل",
      vessel: "چیلد / کلدروم",
      notes: "آماده‌سازی امولسیون ژلی پایه تحت بخار درجا",
      color: "#0d9488"
    }
  ],
  "1405/06/10": [
    {
      id: "dp-16",
      title: "FSIP روغن ادجوانت (Montanide ISA 206)",
      processName: "FSIP روغن ادجوانت",
      vessel: "چیلد / کلدروم",
      notes: "فیلتراسیون استریل و آماده‌سازی فاز روغنی واکسن",
      color: "#0891b2"
    }
  ],
  "1405/06/11": [
    {
      id: "dp-17",
      title: "فرمولاسیون نهایی واکسن ۶ ظرفیتی",
      processName: "فرمولاسیون نهایی",
      vessel: "چیلد / کلدروم",
      notes: "ترکیب ۶ سویه O2016/1, Asia, AGVII, A05, SAT1, SAT2 با ادجوانت روغنی",
      color: "#16a34a"
    }
  ],
  "1405/06/12": [
    {
      id: "dp-18",
      title: "فیلینگ، کپینگ، لیبلینگ و بسته‌بندی استریل",
      processName: "فیلینگ، کپینگ، لیبلینگ و بسته بندی",
      vessel: "موبایل وسل ۲۵۰L",
      notes: "پرکنی در ویال‌های ۵۰ دوزی در اتاق تمیز کلاس A",
      color: "#4f46e5"
    }
  ],
  "1405/06/13": [
    {
      id: "dp-19",
      title: "پایش و انکوباسیون کنترل کیفی QC و ترخیص",
      processName: "پایش کنترل کیفی QC و ترخیص",
      notes: "شروع آزمون‌های استریلیتی و بی‌خطری در انکوباتور",
      color: "#db2777"
    }
  ]
};
