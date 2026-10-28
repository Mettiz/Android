/**
 * Gemini Multi-turn Chatbot & Intelligent Shift Scheduler Component for ShiftFlow
 * Provides natural-language & visual constraint-based shift scheduling with fairness optimization,
 * plus bioprocess engineering assistance.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Send,
  X,
  Trash2,
  Bot,
  User,
  Minimize2,
  Maximize2,
  Cpu,
  Scale,
  CalendarCheck,
  CheckCircle2,
  SlidersHorizontal,
  MessageSquare,
  Plus,
  ChevronDown,
  ChevronUp,
  Eye,
  RotateCcw
} from 'lucide-react';
import { ShiftEntry, Personnel } from '../types';
import {
  ShiftConstraintRule,
  ConstraintType,
  ConstrainedScheduleResult,
  WEEK_DAYS,
  PERSIAN_MONTH_MAP,
  parsePersianShiftRequest,
  generateConstrainedMonth,
  buildConstraintDescription,
  applyInteractiveChatModification
} from '../utils/scheduler';
import { toPersianDigits } from '../utils/persianDate';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  generatedPlan?: ConstrainedScheduleResult;
  isApplied?: boolean;
}

const DEFAULT_TEAM_CONSTRAINTS: ShiftConstraintRule[] = [
  {
    id: 'default-fallah-sat',
    personName: 'مهندس سلیمان فلاح',
    type: 'present_on_days',
    weekdays: ['شنبه'],
    description: 'حضور روزانه مهندس سلیمان فلاح در روزهای شنبه (عدم شیفت در جمعه شب و شنبه شب)'
  },
  {
    id: 'default-akbari-nonight',
    personName: 'مهندس اکبری',
    type: 'no_night_on_days',
    weekdays: ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه'],
    description: 'عدم شیفت شب برای مهندس اکبری در روزهای یک‌شنبه، دوشنبه، سه‌شنبه'
  },
  {
    id: 'default-rahimi-nonight',
    personName: 'آقای رحیمی',
    type: 'no_night_on_days',
    weekdays: ['یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'],
    description: 'عدم شیفت شب برای آقای رحیمی در روزهای یک‌شنبه، دوشنبه، سه‌شنبه، چهارشنبه'
  },
  {
    id: 'default-heidari-nonight',
    personName: 'مهندس حیدری',
    type: 'no_night_on_days',
    weekdays: ['یک‌شنبه', 'دوشنبه', 'چهارشنبه'],
    description: 'عدم شیفت شب برای مهندس حیدری در روزهای یک‌شنبه، دوشنبه، چهارشنبه'
  },
  {
    id: 'default-heidari-tue-aux',
    personName: 'مهندس حیدری',
    type: 'auxiliary_night_on_days',
    weekdays: ['سه‌شنبه'],
    description: 'کمکی شیفت شب (نفر دوم شب) برای مهندس حیدری در روزهای سه‌شنبه'
  },
  {
    id: 'default-heidari-mon-present',
    personName: 'مهندس حیدری',
    type: 'present_on_days',
    weekdays: ['دوشنبه'],
    description: 'حضور روزانه مهندس حیدری در روزهای دوشنبه (عدم شیفت در یک‌شنبه شب و دوشنبه شب)'
  }
];

const PRESET_PROMPTS = [
  {
    label: '📅 چیدمان آبان با ملاحظات کامل تیم (فلاح، اکبری، رحیمی، حیدری)',
    text: `حیدری رو قرار شد سه شنبه شب ها فقط کمکی بذاره ، میخوام دوشنبه ها روزها حضور داشته باشه، تو شیفتای شب پنجشنبه و جمعه و شنبه هم میتونیم ازش استفاده کنیم\nحضور روزانه مهندس سلیمان فلاح در روزهای شنبه (عدم شیفت در جمعه شب و شنبه شب)\nعدم شیفت شب برای مهندس اکبری در روزهای یک‌شنبه، دوشنبه، سه‌شنبه\nعدم شیفت شب برای آقای رحیمی در روزهای یک‌شنبه، دوشنبه، سه‌شنبه و چهارشنبه\nعدم شیفت شب برای مهندس حیدری در روزهای یک‌شنبه، دوشنبه و چهارشنبه`
  },
  {
    label: '⚖️ چیدمان عادلانه همین ماه',
    text: 'لطفاً شیفت‌های این ماه را با حداکثر عدالت و توازن ساعات وزنی بین کارشناسان بچین.'
  },
  {
    label: '📊 تحلیل عدالت شیفت‌ها',
    text: 'لطفاً وضعیت عدالت توزیع شیفت‌ها و ساعات وزنی پرسنل را بررسی کرده و راهکار بهبود ارائه دهید.'
  },
  {
    label: '🧪 پروتکل CIP و SIP بیوراکتور',
    text: 'پروتکل استاندارد آماده‌سازی مخازن و بیوراکتورها شامل CIP، تست فشار PHT و استریل با بخار SIP را توضیح دهید.'
  }
];

interface GeminiChatbotProps {
  onClose?: () => void;
  schedule?: ShiftEntry[];
  personnelList?: Personnel[];
  currentYear?: number;
  currentMonthCode?: string;
  currentMonthName?: string;
  isStagingPreview?: boolean;
  onSavePreviewFinal?: () => void;
  onCancelPreview?: () => void;
  openChatSignal?: number;
  onApplyGeneratedMonth?: (
    year: number,
    monthCode: string,
    monthSchedule: ShiftEntry[],
    mode: 'apply' | 'preview'
  ) => void;
}

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  onClose,
  schedule = [],
  personnelList = [],
  currentYear = 1405,
  currentMonthCode = '08',
  currentMonthName = 'آبان',
  isStagingPreview = false,
  onSavePreviewFinal,
  onCancelPreview,
  openChatSignal = 0,
  onApplyGeneratedMonth
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'planner'>('chat');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedComplexity, setSelectedComplexity] = useState<'general' | 'fast'>('general');
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (openChatSignal > 0) {
      setIsOpen(true);
      setIsMinimized(false);
      setActiveView('chat');
      setTimeout(() => chatInputRef.current?.focus(), 100);
    }
  }, [openChatSignal]);

  // Visual Planner State
  const shiftWorkers = useMemo(
    () => personnelList.filter(p => p.isActive && p.roles.includes('Shift')).map(p => p.name),
    [personnelList]
  );
  const supervisors = useMemo(
    () => personnelList.filter(p => p.isActive && p.roles.includes('Supervisor')).map(p => p.name),
    [personnelList]
  );

  const [builderMonthCode, setBuilderMonthCode] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('shiftflow_ai_builder_month');
      if (saved && saved !== '05') return saved;
    } catch {
      // ignore storage errors
    }
    return currentMonthCode && currentMonthCode !== '05' ? currentMonthCode : '08';
  });
  const [builderYear, setBuilderYear] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('shiftflow_ai_builder_year');
      if (saved) return parseInt(saved, 10) || 1405;
    } catch {
      // ignore storage errors
    }
    return currentYear || 1405;
  });
  const [builderPerson, setBuilderPerson] = useState<string>('');
  const [builderRuleType, setBuilderRuleType] = useState<ConstraintType>('present_on_days');
  const [builderWeekdays, setBuilderWeekdays] = useState<string[]>(['شنبه']);
  const [customConstraints, setCustomConstraints] = useState<ShiftConstraintRule[]>(() => {
    try {
      const saved = localStorage.getItem('shiftflow_ai_custom_constraints_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_TEAM_CONSTRAINTS;
  });

  useEffect(() => {
    if (shiftWorkers.length > 0 && !builderPerson) {
      setBuilderPerson(shiftWorkers[0]);
    }
  }, [shiftWorkers, builderPerson]);

  useEffect(() => {
    if (currentMonthCode && currentMonthCode !== '05') {
      setBuilderMonthCode(currentMonthCode);
    }
  }, [currentMonthCode]);

  const handleChangeBuilderMonth = (code: string) => {
    setBuilderMonthCode(code);
    try {
      localStorage.setItem('shiftflow_ai_builder_month', code);
    } catch {
      // ignore
    }
  };

  const handleChangeBuilderYear = (yr: number) => {
    setBuilderYear(yr);
    try {
      localStorage.setItem('shiftflow_ai_builder_year', String(yr));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('shiftflow_ai_custom_constraints_v2', JSON.stringify(customConstraints));
    } catch {
      // ignore
    }
  }, [customConstraints]);

  // Close window on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      role: 'assistant',
      content:
        'سلام! من دستیار هوشمند چیدمان شیفت و مشاور فرآیندهای بیولوژیک (ShiftFlow AI) هستم.\n\nمی‌توانید به زبان ساده بگویید شیفت کدام ماه و با چه ملاحظاتی چیده شود؛ مثلاً:\n«شیفت آبان رو بچین به صورتی که سلیمان فلاح شنبه‌ها سرکار حضور داشته باشه و دهقان دوشنبه‌ها باشه»\nتا برنامه را با رعایت کامل عدالت و قوانین شیفت بچینم و در تقویم اعمال کنم.',
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'gemini-3.8-flash'
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !isMinimized && activeView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized, isLoading, activeView]);

  const toggleBuilderWeekday = (day: string) => {
    setBuilderWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAddBuilderConstraint = () => {
    if (!builderPerson || builderWeekdays.length === 0) return;
    const ruleBase = {
      personName: builderPerson,
      type: builderRuleType,
      weekdays: [...builderWeekdays]
    };
    const newRule: ShiftConstraintRule = {
      ...ruleBase,
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: buildConstraintDescription(ruleBase)
    };
    setCustomConstraints(prev => [...prev, newRule]);
  };

  const handleRemoveBuilderConstraint = (id: string) => {
    setCustomConstraints(prev => prev.filter(r => r.id !== id));
  };

  const handleRunVisualPlanner = (mode: 'apply' | 'preview' = 'preview') => {
    if (personnelList.length === 0) return;
    const result = generateConstrainedMonth(
      schedule,
      builderYear,
      builderMonthCode,
      personnelList,
      customConstraints
    );

    if (onApplyGeneratedMonth) {
      onApplyGeneratedMonth(result.year, result.monthCode, result.schedule, mode);
    }

    const constraintsSummary =
      result.constraints.length > 0
        ? result.constraints.map(c => `• ${c.description}`).join('\n')
        : '• بدون محدودیت خاص (توزیع کاملاً متوازن بین تمام کارشناسان)';

    const modeNote =
      mode === 'preview'
        ? `\n\n👁️ **حالت پیش‌نمایش فعال است:** اکنون می‌توانید هر تغییری را مستقیماً در همین چت بنویسید تا روی پیش‌نمایش اعمال شود (مثلاً: *«روز ۵ ${result.monthName} شیفت شب دهقان باشه»* یا *«جای شیفت شب ۸ و ۱۰ رو عوض کن»*).`
        : '';

    const assistantMsg: ChatMessage = {
      id: `plan-${Date.now()}`,
      role: 'assistant',
      content: `✅ برنامه شیفت **${result.monthName} ${toPersianDigits(result.year)}** با رعایت تمام ملاحظات تعیین‌شده و امتیاز عدالت **${toPersianDigits(result.fairnessScore)}٪** چیده شد و در ${mode === 'preview' ? 'حالت پیش‌نمایش تقویم' : 'تقویم اصلی'} قرار گرفت.\n\n**ملاحظات اعمال‌شده:**\n${constraintsSummary}${modeNote}`,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'موتور هوشمند چیدمان + Gemini',
      generatedPlan: result,
      isApplied: mode === 'apply'
    };

    setMessages(prev => [...prev, assistantMsg]);
    setActiveView('chat');
    setTimeout(() => chatInputRef.current?.focus(), 120);
  };

  const handleActivatePreviewFromCard = (plan: ConstrainedScheduleResult) => {
    if (onApplyGeneratedMonth) {
      onApplyGeneratedMonth(plan.year, plan.monthCode, plan.schedule, 'preview');
    }
    setActiveView('chat');
    const previewHintMsg: ChatMessage = {
      id: `preview-hint-${Date.now()}`,
      role: 'assistant',
      content: `👁️ **پیش‌نمایش ماه ${plan.monthName} ${toPersianDigits(plan.year)} روی تقویم فعال شد.**\n\nحالا می‌توانید هر تغییری که می‌خواهید در کادر پایین بنویسید تا بلافاصله روی همین پیش‌نمایش اعمال شود؛ برای مثال:\n• *«روز ۵ ${plan.monthName} شیفت شب دهقان باشه»*\n• *«جای شیفت شب ۸ و ۱۰ ${plan.monthName} رو عوض کن»*\n• *«در روز ۱۲ حیدری رو کمکی شب بذار»*\n• *«دهقان هم دوشنبه‌ها سرکار حضور داشته باشه»*\n• *«شرط سلیمان فلاح رو حذف کن»*\n\nپس از اتمام ویرایش‌ها می‌توانید دکمه **«ذخیره نهایی»** را بزنید یا بنویسید *«ذخیره کن»*.`,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      modelUsed: 'ویرایشگر زنده پیش‌نمایش'
    };
    setMessages(prev => [...prev, previewHintMsg]);
    setTimeout(() => chatInputRef.current?.focus(), 100);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    // 1. Check for interactive schedule modification (direct day edits, swaps, constraint changes, or full scheduling)
    let generatedPlan: ConstrainedScheduleResult | undefined;
    let generatedSummaryText = '';

    if (personnelList.length > 0) {
      const mod = applyInteractiveChatModification(
        text,
        schedule,
        personnelList,
        builderYear || 1405,
        builderMonthCode || '08',
        customConstraints
      );

      if (mod.actionType === 'save_preview' && onSavePreviewFinal) {
        onSavePreviewFinal();
        const saveMsg: ChatMessage = {
          id: `save-${Date.now()}`,
          role: 'assistant',
          content: '✅ تغییرات پیش‌نمایش با موفقیت تایید و در تقویم اصلی ذخیره نهایی شد.',
          timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'ShiftFlow Smart Scheduler'
        };
        setMessages(prev => [...prev, saveMsg]);
        setIsLoading(false);
        return;
      }

      if (mod.handled && mod.result) {
        generatedPlan = mod.result;
        setCustomConstraints(mod.updatedConstraints);

        if (mod.hasExplicitMonth) {
          handleChangeBuilderYear(generatedPlan.year);
          handleChangeBuilderMonth(generatedPlan.monthCode);
        }

        // If user is in Preview mode (or doing interactive edits), keep/update in 'preview' mode;
        // otherwise apply to calendar so changes are immediately visible
        const targetMode: 'preview' | 'apply' = isStagingPreview ? 'preview' : 'apply';
        if (onApplyGeneratedMonth) {
          onApplyGeneratedMonth(
            generatedPlan.year,
            generatedPlan.monthCode,
            generatedPlan.schedule,
            targetMode
          );
        }

        const editsLines =
          generatedPlan.appliedEdits && generatedPlan.appliedEdits.length > 0
            ? `تغییرات اعمال‌شده:\n` + generatedPlan.appliedEdits.map(e => `✏️ ${e}`).join('\n') + '\n\n'
            : '';

        const rulesLines =
          generatedPlan.constraintReports.length > 0
            ? generatedPlan.constraintReports
                .map(r => `✓ ${r.rule.description} (${r.details})`)
                .join('\n')
            : '✓ توزیع متوازن شیفت‌های شب و روز بدون محدودیت فردی';

        const staffLines = generatedPlan.personSummaries
          .map(p => {
            const extraDayTxt = p.extraDayShifts ? ` (+${toPersianDigits(p.extraDayShifts)} کمکی روز)` : '';
            const extraNightTxt = p.extraNightShifts ? ` (+${toPersianDigits(p.extraNightShifts)} کمکی شب)` : '';
            return `- ${p.name}: ${toPersianDigits(p.dayShifts)} شیفت روز${extraDayTxt}، ${toPersianDigits(p.nightShifts)} شیفت شب${extraNightTxt} (${toPersianDigits(p.weightedHours)} ساعت وزنی)`;
          })
          .join('\n');

        generatedSummaryText = `${editsLines}ماه هدف: ${generatedPlan.monthName} ${toPersianDigits(generatedPlan.year)}\nامتیاز عدالت چیدمان: ${toPersianDigits(generatedPlan.fairnessScore)}٪\nملاحظات فعال:\n${rulesLines}\n\nسهم کارشناسان در این ماه:\n${staffLines}`;
      }
    }

    try {
      const payloadMessages = newMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payloadMessages,
          complexity: selectedComplexity,
          scheduleContext: {
            shiftWorkers,
            supervisors,
            currentMonthName,
            currentYear,
            targetMonthLabel: generatedPlan
              ? `${generatedPlan.monthName} ${toPersianDigits(generatedPlan.year)}`
              : undefined,
            generatedSummary: generatedSummaryText || undefined
          }
        })
      });

      const data = await res.json().catch(() => null);

      const replyContent =
        data?.reply ||
        (generatedPlan
          ? `✅ برنامه شیفت **${generatedPlan.monthName} ${toPersianDigits(generatedPlan.year)}** بر اساس ملاحظات شما و با رعایت عدالت (امتیاز **${toPersianDigits(generatedPlan.fairnessScore)}٪**) چیده شد و در تقویم اعمال گردید.\n\n${generatedSummaryText}`
          : 'پاسخی دریافت نشد.');

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data?.modelUsed || 'gemini-3.8-flash',
        generatedPlan,
        isApplied: !!generatedPlan
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.warn('Chat fallback notice:', err?.message || err);
      const fallbackText = generatedPlan
        ? `✅ برنامه شیفت **${generatedPlan.monthName} ${toPersianDigits(generatedPlan.year)}** با رعایت کامل ملاحظات شما و توازن عدالت (**${toPersianDigits(generatedPlan.fairnessScore)}٪**) چیده شد و در تقویم اصلی قرار گرفت.\n\n${generatedSummaryText}`
        : 'می‌توانید برای چیدن خودکار شیفت‌ها، ماه مورد نظر و شروط حضور کارشناسان را بنویسید (مثلاً: «شیفت آبان رو بچین طوری که سلیمان فلاح شنبه‌ها حضور داشته باشه») یا از تب «فرم چیدمان شیفت» در بالای همین پنجره استفاده نمایید.';

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: fallbackText,
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'ShiftFlow Smart Scheduler',
        generatedPlan,
        isApplied: !!generatedPlan
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'msg-welcome-new',
        role: 'assistant',
        content:
          'تاریخچه گفتگو پاک شد. برای چیدن هوشمند شیفت ماهانه، ملاحظات خود را بنویسید یا از تب «فرم چیدمان شیفت» استفاده کنید.',
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
        modelUsed: 'gemini-3.8-flash'
      }
    ]);
  };

  return (
    <>
      {/* Floating Toggle Button (Bottom-Left) */}
      {!isOpen && (
        <div className="fixed bottom-4 sm:bottom-5 left-4 sm:left-5 z-50 flex items-center gap-1.5 bg-linear-to-r from-indigo-600 via-indigo-700 to-slate-900 text-white rounded-2xl shadow-xl shadow-indigo-600/30 p-1.5 no-print ring-2 ring-indigo-400/40 animate-in fade-in slide-in-from-bottom-2">
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-white hover:text-amber-200 transition cursor-pointer font-black text-xs sm:text-sm active:scale-95"
            title="باز کردن دستیار هوشمند چیدمان شیفت"
          >
            <div className="relative">
              <Sparkles size={18} className="animate-spin text-amber-300" style={{ animationDuration: '6s' }} />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-white" />
            </div>
            <span>دستیار هوشمند و چیدمان شیفت</span>
          </button>

          {/* Dedicated Close Button on the Floating Widget */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onClose) {
                onClose();
              } else {
                setIsOpen(false);
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold transition cursor-pointer text-xs shrink-0 shadow-2xs"
            title="بستن و مخفی‌سازی دستیار هوش مصنوعی"
          >
            <X size={14} className="stroke-[3]" />
            <span>بستن</span>
          </button>
        </div>
      )}

      {/* Subtle backdrop on mobile when chat is open */}
      {isOpen && !isMinimized && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-40 sm:hidden no-print animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Main Assistant Window */}
      {isOpen && (
        <div
          className={`fixed left-2 sm:left-5 bottom-2 sm:bottom-5 z-50 w-[96vw] sm:w-[460px] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden transition-all duration-300 no-print ${
            isMinimized ? 'h-14' : 'h-[630px] max-h-[88vh]'
          }`}
          dir="rtl"
        >
          {/* Header */}
          <div className="px-3.5 sm:px-4 py-2.5 bg-linear-to-r from-indigo-600 via-indigo-700 to-slate-900 text-white flex items-center justify-between select-none shrink-0 shadow-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs ring-1 ring-white/20 shrink-0">
                <Bot size={18} className="text-amber-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-black tracking-tight truncate">
                    دستیار هوشمند چیدمان شیفت
                  </h3>
                </div>
                <p className="text-[10px] text-indigo-200 font-medium leading-tight truncate">
                  برنامه‌ریزی خودکار با شروط حضور کارشناسان و رعایت عدالت
                </p>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearChat}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                title="پاک کردن تاریخچه گفتگو"
              >
                <Trash2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                title={isMinimized ? 'باز کردن پنجره' : 'کوچک کردن پنجره'}
              >
                {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>

              {/* High-Contrast Close Window Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-black px-2.5 sm:px-3 py-1.5 rounded-xl text-xs transition shadow-md cursor-pointer active:scale-95 ring-1 ring-white/40"
                title="بستن پنجره دستیار هوشمند (Esc)"
              >
                <X size={15} className="stroke-[3]" />
                <span>بستن</span>
              </button>
            </div>
          </div>

          {/* Body (hidden when minimized) */}
          {!isMinimized && (
            <>
              {/* Mode Switcher Tabs: Chat vs Visual Shift Planner */}
              <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/90 flex-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setActiveView('chat')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeView === 'chat'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <MessageSquare size={13} />
                    <span>گفتگو و دستور متنی</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('planner')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer ${
                      activeView === 'planner'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <SlidersHorizontal size={13} />
                    <span>فرم شروط چیدمان</span>
                    {customConstraints.length > 0 && (
                      <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                        {toPersianDigits(customConstraints.length)}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {activeView === 'planner' ? (
                /* VISUAL CONSTRAINT BUILDER VIEW */
                <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-50/70 text-slate-800">
                  <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-3 text-xs leading-relaxed text-indigo-950">
                    <div className="font-black flex items-center gap-1.5 text-indigo-900 mb-1">
                      <CalendarCheck size={15} className="text-indigo-600 shrink-0" />
                      <span>چیدمان هوشمند با ملاحظات حضور کارشناسان</span>
                    </div>
                    <p className="text-[11px] text-indigo-800">
                      ملاحظات هر کارشناس (مثلاً حضور در شنبه‌ها یا دوشنبه‌ها) را مشخص کنید تا هوش مصنوعی برنامه ماه را با رعایت کامل عدالت و قوانین شیفت بچیند.
                    </p>
                  </div>

                  {/* Step 1: Target Month & Year */}
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                    <label className="block text-xs font-black text-slate-700">
                      ۱. انتخاب ماه هدف برای چیدمان:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={builderMonthCode}
                        onChange={e => handleChangeBuilderMonth(e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                      >
                        {PERSIAN_MONTH_MAP.map(m => (
                          <option key={m.code} value={m.code}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={builderYear}
                        onChange={e => handleChangeBuilderYear(parseInt(e.target.value, 10))}
                        className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                      >
                        <option value={1405}>سال ۱۴۰۵</option>
                        <option value={1406}>سال ۱۴۰۶</option>
                      </select>
                    </div>
                  </div>

                  {/* Step 2: Add Constraint for a Specialist */}
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <label className="block text-xs font-black text-slate-700">
                      ۲. افزودن شرط حضور، کمکی یا معافیت کارشناس:
                    </label>

                    <div className="space-y-2">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">نام کارشناس:</span>
                        <select
                          value={builderPerson}
                          onChange={e => setBuilderPerson(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          {shiftWorkers.map(w => (
                            <option key={w} value={w}>
                              {w}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-slate-500 block mb-1">نوع ملاحظه:</span>
                        <select
                          value={builderRuleType}
                          onChange={e => {
                            const nextType = e.target.value as ConstraintType;
                            setBuilderRuleType(nextType);
                            if (nextType === 'auxiliary_role' || nextType === 'auxiliary_day_role') {
                              setBuilderWeekdays([...WEEK_DAYS]);
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        >
                          <option value="present_on_days">
                            حضور روزانه سر کار (عدم شیفت در شب قبل و شب همان روز)
                          </option>
                          <option value="auxiliary_role">
                            نیروی کمکی شیفت شب (حذف از شیفت اصلی + کمکی در روزهای انتخابی/کل ماه)
                          </option>
                          <option value="auxiliary_day_role">
                            نیروی کمکی شیفت روز (حذف از شیفت اصلی + کمکی روز در روزهای انتخابی/کل ماه)
                          </option>
                          <option value="auxiliary_night_on_days">
                            کمکی شیفت شب در روزهای انتخابی (نفر دوم شب - با حفظ شیفت اصلی)
                          </option>
                          <option value="auxiliary_day_on_days">
                            کمکی شیفت روز در روزهای انتخابی (نفر دوم روز - با حفظ شیفت اصلی)
                          </option>
                          <option value="no_night_on_days">
                            عدم شیفت شب در روزهای انتخابی
                          </option>
                          <option value="no_shift_on_days">
                            عدم هرگونه شیفت (روز و شب) در روزهای انتخابی
                          </option>
                          <option value="force_day_on_days">
                            اولویت شیفت روز در روزهای انتخابی
                          </option>
                          <option value="force_night_on_days">
                            اولویت شیفت شب در روزهای انتخابی
                          </option>
                        </select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] font-bold text-slate-500">
                            انتخاب روز(های) هفته:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setBuilderWeekdays([...WEEK_DAYS])}
                              className="text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition cursor-pointer"
                            >
                              همه روزها (کل ماه)
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => setBuilderWeekdays([])}
                              className="text-[10px] font-bold text-slate-500 hover:bg-slate-100 px-1.5 py-0.5 rounded transition cursor-pointer"
                            >
                              پاک کردن
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {WEEK_DAYS.map(day => {
                            const selected = builderWeekdays.includes(day);
                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleBuilderWeekday(day)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                  selected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddBuilderConstraint}
                        disabled={!builderPerson || builderWeekdays.length === 0}
                        className="w-full mt-1 flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        <Plus size={15} />
                        <span>افزودن این شرط به لیست ملاحظات</span>
                      </button>
                    </div>
                  </div>

                  {/* Step 3: Active Constraints List */}
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700">
                        ۳. لیست ملاحظات فعال ({toPersianDigits(customConstraints.length)} مورد):
                      </span>
                      {customConstraints.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCustomConstraints([])}
                          className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          حذف همه
                        </button>
                      )}
                    </div>

                    {customConstraints.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-2 text-center">
                        هنوز شرطی اضافه نشده است. در صورت عدم ثبت شرط، برنامه صرفاً بر اساس حداکثر عدالت چیده می‌شود.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {customConstraints.map(rule => (
                          <div
                            key={rule.id}
                            className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs"
                          >
                            <span className="font-bold text-slate-700 leading-snug">
                              {rule.description}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveBuilderConstraint(rule.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition shrink-0 cursor-pointer"
                              title="حذف شرط"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Generate & Preview / Apply Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleRunVisualPlanner('preview')}
                      className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black py-3 px-3 rounded-2xl text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer active:scale-98"
                    >
                      <Eye size={15} />
                      <span>
                        پیش‌نمایش و ویرایش با چت ({PERSIAN_MONTH_MAP.find(m => m.code === builderMonthCode)?.name})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunVisualPlanner('apply')}
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black py-3 px-3 rounded-2xl text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer active:scale-98"
                    >
                      <Sparkles size={15} />
                      <span>
                        چیدمان و ذخیره مستقیم ({PERSIAN_MONTH_MAP.find(m => m.code === builderMonthCode)?.name})
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                /* NATURAL LANGUAGE CHAT & INTERACTIVE SCHEDULE CARDS VIEW */
                <>
                  {/* Scrollable Message Thread */}
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-linear-to-b from-slate-50/50 to-white">
                    {messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2 ${
                          msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                            msg.role === 'user'
                              ? 'bg-slate-800 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>

                        {/* Bubble */}
                        <div
                          className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                            msg.role === 'user'
                              ? 'bg-slate-900 text-white rounded-tl-xs'
                              : 'bg-white text-slate-800 border border-slate-200/90 rounded-tr-xs'
                          }`}
                        >
                          <div className="whitespace-pre-wrap font-medium">{msg.content}</div>

                          {/* Rich Interactive Schedule Card when a schedule was generated */}
                          {msg.generatedPlan && (
                            <div className="mt-3 pt-2.5 border-t border-slate-200 space-y-2.5">
                              {/* Header badge */}
                              <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-2">
                                <div className="flex items-center gap-1.5 text-emerald-900 font-black text-xs">
                                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                                  <span>
                                    چیدمان {msg.generatedPlan.monthName}{' '}
                                    {toPersianDigits(msg.generatedPlan.year)}
                                  </span>
                                </div>
                                <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                  عدالت: {toPersianDigits(msg.generatedPlan.fairnessScore)}٪
                                </span>
                              </div>

                              {/* Applied Direct Edits Badge */}
                              {msg.generatedPlan.appliedEdits && msg.generatedPlan.appliedEdits.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 space-y-1">
                                  <div className="text-[10px] font-black text-amber-800">
                                    ✏️ تغییرات اعمال‌شده روی برنامه:
                                  </div>
                                  {msg.generatedPlan.appliedEdits.map((ed, idx) => (
                                    <div key={idx} className="text-[11px] font-bold text-amber-900">
                                      • {toPersianDigits(ed)}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Constraint Compliance Badges */}
                              {msg.generatedPlan.constraintReports.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 space-y-1">
                                  <div className="text-[10px] font-black text-slate-500">
                                    وضعیت رعایت ملاحظات درخواستی:
                                  </div>
                                  {msg.generatedPlan.constraintReports.map((rep, i) => (
                                    <div
                                      key={i}
                                      className="flex items-start gap-1.5 text-[11px] font-bold text-emerald-800"
                                    >
                                      <CheckCircle2
                                        size={13}
                                        className="text-emerald-600 shrink-0 mt-0.5"
                                      />
                                      <span>
                                        {rep.rule.description} —{' '}
                                        <span className="text-emerald-600 font-black">
                                          {toPersianDigits(rep.details)}
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Fairness Summary Table per Specialist */}
                              <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="bg-slate-100 px-2.5 py-1.5 text-[10px] font-black text-slate-600 flex items-center justify-between">
                                  <span>توزیع عادلانه شیفت‌های ماه</span>
                                  <span>روز / شب / ساعت وزنی</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {msg.generatedPlan.personSummaries.map(p => (
                                    <div
                                      key={p.name}
                                      className="px-2.5 py-1.5 flex items-center justify-between text-[11px] bg-white"
                                    >
                                      <div className="flex items-center gap-1.5 font-bold text-slate-800 truncate">
                                        <span
                                          className="w-2 h-2 rounded-full shrink-0"
                                          style={{ backgroundColor: p.color || '#4f46e5' }}
                                        />
                                        <span className="truncate">{p.name}</span>
                                        {p.isAuxiliaryOnly && (
                                          <span className="bg-purple-100 text-purple-700 text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                            کمکی
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold">
                                        <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                                          {toPersianDigits(p.dayShifts)} روز
                                          {p.extraDayShifts ? ` (${toPersianDigits(p.extraDayShifts)} کمکی)` : ''}
                                        </span>
                                        <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded">
                                          {toPersianDigits(p.nightShifts)} شب
                                          {p.extraNightShifts ? ` (${toPersianDigits(p.extraNightShifts)} کمکی)` : ''}
                                        </span>
                                        <span className="text-slate-600 font-black min-w-[44px] text-left">
                                          {toPersianDigits(p.weightedHours)}h
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Collapsible 30-day schedule preview */}
                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedPlanId(
                                      expandedPlanId === msg.id ? null : msg.id
                                    )
                                  }
                                  className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-[11px] font-bold transition cursor-pointer"
                                >
                                  <span>
                                    مشاهده ریز برنامه ۳۰ روزه {msg.generatedPlan.monthName}
                                  </span>
                                  {expandedPlanId === msg.id ? (
                                    <ChevronUp size={14} />
                                  ) : (
                                    <ChevronDown size={14} />
                                  )}
                                </button>

                                {expandedPlanId === msg.id && (
                                  <div className="mt-1.5 max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-[10px]">
                                    {msg.generatedPlan.schedule.map(entry => (
                                      <div
                                        key={entry.date}
                                        className={`px-2 py-1 flex items-center justify-between gap-1 ${
                                          entry.isHoliday ? 'bg-rose-50/50' : 'bg-white'
                                        }`}
                                      >
                                        <span className="font-bold text-slate-700 w-22 shrink-0">
                                          {toPersianDigits(entry.date.slice(5))} ({entry.dayName})
                                        </span>
                                        <span className="text-amber-800 font-bold truncate">
                                          ☀️ {entry.dayShiftPerson.replace('مهندس ', '')}
                                          {entry.extraDayPersons && entry.extraDayPersons.length > 0
                                            ? ` (+${entry.extraDayPersons.map(x => x.replace('مهندس ', '')).join('، ')})`
                                            : ''}
                                        </span>
                                        <span className="text-indigo-800 font-bold truncate">
                                          🌙 {entry.nightShiftPerson.replace('مهندس ', '')}
                                          {entry.extraNightPersons && entry.extraNightPersons.length > 0
                                            ? ` (+${entry.extraNightPersons.map(x => x.replace('مهندس ', '')).join('، ')})`
                                            : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onApplyGeneratedMonth && msg.generatedPlan) {
                                      onApplyGeneratedMonth(
                                        msg.generatedPlan.year,
                                        msg.generatedPlan.monthCode,
                                        msg.generatedPlan.schedule,
                                        'apply'
                                      );
                                    }
                                    if (isStagingPreview && onSavePreviewFinal) {
                                      onSavePreviewFinal();
                                    }
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-2.5 rounded-xl text-[11px] transition shadow-2xs cursor-pointer"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>اعمال و ذخیره نهایی در تقویم</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (msg.generatedPlan) {
                                      handleActivatePreviewFromCard(msg.generatedPlan);
                                    }
                                  }}
                                  className="flex items-center justify-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-2 px-2.5 rounded-xl text-[11px] transition cursor-pointer"
                                  title="مشاهده در حالت پیش‌نمایش و ویرایش با چت"
                                >
                                  <Eye size={13} />
                                  <span>پیش‌نمایش و ویرایش با چت</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Footer info */}
                          <div
                            className={`mt-1 flex items-center gap-1.5 text-[9px] ${
                              msg.role === 'user'
                                ? 'text-slate-400 justify-end'
                                : 'text-slate-400 justify-start'
                            }`}
                          >
                            <span>{msg.timestamp}</span>
                            {msg.modelUsed && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{msg.modelUsed}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Loading indicator */}
                    {isLoading && (
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <Bot size={14} />
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl rounded-tr-xs px-4 py-3 shadow-2xs flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"
                            style={{ animationDelay: '0ms' }}
                          />
                          <div
                            className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"
                            style={{ animationDelay: '150ms' }}
                          />
                          <div
                            className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce"
                            style={{ animationDelay: '300ms' }}
                          />
                          <span className="text-[11px] text-slate-500 font-bold mr-1">
                            در حال اعمال تغییرات و بررسی عدالت شیفت‌ها...
                          </span>
                        </div>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Active Preview Mode Editing Bar */}
                  {isStagingPreview && (
                    <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 flex flex-col gap-1.5 shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                          <Eye size={13} className="text-amber-600 shrink-0" />
                          <span>حالت پیش‌نمایش فعال است — تغییرات را در چت بنویسید:</span>
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {onSavePreviewFinal && (
                            <button
                              type="button"
                              onClick={onSavePreviewFinal}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-2 py-0.5 rounded-lg transition cursor-pointer"
                            >
                              ذخیره نهایی
                            </button>
                          )}
                          {onCancelPreview && (
                            <button
                              type="button"
                              onClick={onCancelPreview}
                              className="bg-amber-800 hover:bg-amber-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg transition cursor-pointer"
                            >
                              لغو
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {[
                          'روز ۵ شیفت شب دهقان باشه',
                          'جای شیفت شب ۸ و ۱۰ رو عوض کن',
                          'روز ۱۲ حیدری کمکی شب باشه',
                          'دهقان هم دوشنبه‌ها حضور داشته باشه'
                        ].map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setInputText(chip);
                              chatInputRef.current?.focus();
                            }}
                            className="whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 transition shrink-0 cursor-pointer"
                          >
                            ✏️ {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick Preset Prompts */}
                  {!isStagingPreview && (
                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-200/70 overflow-x-auto flex items-center gap-1.5 no-scrollbar shrink-0">
                      {PRESET_PROMPTS.map((p, idx) => (
                        <button
                          key={idx}
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleSendMessage(p.text)}
                          className="whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold bg-white hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200/90 shadow-2xs transition shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Input Area */}
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="p-2.5 bg-white border-t border-slate-200/80 flex items-center gap-1.5 shrink-0"
                  >
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder={
                        isStagingPreview
                          ? 'تغییرات پیش‌نمایش را بنویسید (مثلاً: روز ۵ شیفت شب دهقان باشه)...'
                          : 'مثلاً: شیفت آبان رو بچین طوری که سلیمان فلاح شنبه‌ها حضور داشته باشه...'
                      }
                      disabled={isLoading}
                      className="flex-1 bg-slate-100 hover:bg-slate-50 focus:bg-white text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isLoading}
                      className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 flex items-center justify-center transition shadow-2xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
                      title="ارسال دستور"
                    >
                      <Send size={15} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="px-2.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-black text-xs transition cursor-pointer whitespace-nowrap"
                      title="بستن پنجره چت"
                    >
                      بستن
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};
