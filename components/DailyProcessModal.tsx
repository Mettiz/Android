/**
 * Daily Bioprocess & Task Management Modal
 * Allows viewing and editing industrial bioprocess tasks for any selected date:
 * - Cell Culture (Bioreactors 100L, 700L, 1500L, 2700L, Flasks, Spinners)
 * - 2-Day Passage management & Chilled storage
 * - Virus Inoculation (Strains: O2016/1, Asia, AGVII, A05, SAT1, SAT2)
 * - Inactivation Vessels (43, 44, Large Virus 3000L, Mobile Vessels 250L)
 * - Vessel Prep (CIP, Mechanical Seal SIP, PHT, SIP)
 * - Downstream (FSIP, Formulation, Supernatant, Packaging)
 */
import React, { useState, useMemo } from 'react';
import { 
  X, Plus, Edit2, Trash2, CheckCircle2, Clock, 
  FlaskConical, Shield, Sparkles, ChevronDown, 
  ChevronUp, ArrowRight, Dna, Lock, AlertCircle,
  Layers, ThermometerSnowflake, Check, Users,
  ShieldAlert, Droplets, Gauge, Wrench, Flame, Calendar
} from 'lucide-react';
import { DailyProcessTask, ProcessDefinition, Personnel, ProcessCategory } from '../types';
import { 
  VESSEL_OPTIONS, 
  FMD_STRAINS, 
  CATEGORY_LABELS, 
  getNextPassageSuggestion,
  getRemainingCampaignSuggestion,
  getSmartProcessSuggestions,
  SmartProcessSuggestion,
  VesselPrerequisiteItem,
  RemainingCampaignSuggestion,
  InoculationRoundVessels,
  DEFAULT_INOCULATION_VESSELS,
  INOCULATION_ROUND_VESSEL_CHOICES,
  SmartSuggestionOptions,
  InoculationRoundConfig,
  DEFAULT_INOCULATION_CONFIG,
  INOCULATION_STRAIN_CHOICES,
  SINGLE_VESSEL_CHOICES,
  SINGLE_STRAIN_CHOICES,
  formatRoundVessels,
  formatRoundStrains,
  FormulationProductType,
  GEL_ROOM_VESSELS
} from '../utils/bioprocessData';
import { toPersianDigits } from '../utils/persianDate';

interface DailyProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  dayName: string;
  tasks: DailyProcessTask[];
  onSaveTasks: (updatedTasks: DailyProcessTask[]) => void;
  onApplyCampaignFromDate?: (startDate: string, options?: SmartSuggestionOptions) => void;
  onScheduleNextPassage?: (targetDate: string, newTask: DailyProcessTask) => void;
  onScheduleRemainingTimeline?: (timeline: Record<string, DailyProcessTask[]>) => void;
  isOwner: boolean;
  onOpenOwnerLogin: () => void;
  processDefinitions: ProcessDefinition[];
  personnelList?: Personnel[];
}

export const DailyProcessModal: React.FC<DailyProcessModalProps> = ({
  isOpen,
  onClose,
  date,
  dayName,
  tasks,
  onSaveTasks,
  onApplyCampaignFromDate,
  onScheduleNextPassage,
  onScheduleRemainingTimeline,
  isOwner,
  onOpenOwnerLogin,
  processDefinitions,
  personnelList = [],
}) => {
  const [isAddingOrEditing, setIsAddingOrEditing] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCampaignGenerator, setShowCampaignGenerator] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  
  // Smart Process Suggestion State (Prerequisites: CIP, PHT, Seal SIP, Water intake + Remaining campaign milestones)
  const [activeSmartSuggestion, setActiveSmartSuggestion] = useState<SmartProcessSuggestion | null>(null);
  const [activeSuggestionTab, setActiveSuggestionTab] = useState<'prereqs' | 'subsequent' | 'all'>('prereqs');
  const [isPreviewListOpen, setIsPreviewListOpen] = useState(true);

  // Configurable Inoculation Rounds Vessels & Strains (Decoupled & Flexible Multi-Select: 1, 2, or 3 vessels/strains)
  const [customInoculationConfig, setCustomInoculationConfig] = useState<InoculationRoundConfig>({
    round1Vessels: [...(DEFAULT_INOCULATION_CONFIG.round1Vessels || ['Inactivation Vessel 43', 'Inactivation Vessel 44'])],
    round1Strains: [...(DEFAULT_INOCULATION_CONFIG.round1Strains || ['O2016/1', 'Asia'])],
    round2Vessels: [...(DEFAULT_INOCULATION_CONFIG.round2Vessels || ['Large Virus Vessel 3000L', 'Inactivation Vessel 43'])],
    round2Strains: [...(DEFAULT_INOCULATION_CONFIG.round2Strains || ['AGVII', 'A05'])],
    round3Vessels: [...(DEFAULT_INOCULATION_CONFIG.round3Vessels || ['Bioreactor 2700L', 'Bioreactor 1500L'])],
    round3Strains: [...(DEFAULT_INOCULATION_CONFIG.round3Strains || ['SAT1', 'SAT2'])],
  });

  const [selectedProductType, setSelectedProductType] = useState<FormulationProductType>('both');
  const [selectedGelRoomVessel, setSelectedGelRoomVessel] = useState<string>('Gel Vessel 1500L (Gel Room)');

  const handleToggleRoundVessel = (roundKey: 'round1' | 'round2' | 'round3', vessel: string) => {
    const listKey = `${roundKey}Vessels` as keyof InoculationRoundConfig;
    const currentList = (customInoculationConfig[listKey] as string[]) || [];
    let updatedList: string[];
    if (currentList.includes(vessel)) {
      if (currentList.length === 1) {
        // Keep at least one selected
        return;
      }
      updatedList = currentList.filter(v => v !== vessel);
    } else {
      updatedList = [...currentList, vessel];
    }

    const updatedConfig: InoculationRoundConfig = {
      ...customInoculationConfig,
      [listKey]: updatedList,
      [`${roundKey}Vessel`]: formatRoundVessels(updatedList),
    };
    setCustomInoculationConfig(updatedConfig);

    if (activeSmartSuggestion) {
      const refreshed = getSmartProcessSuggestions(
        { 
          title: activeSmartSuggestion.targetTaskTitle, 
          vessel: activeSmartSuggestion.vesselName 
        },
        date,
        { 
          inoculationConfig: updatedConfig,
          productType: selectedProductType,
          gelRoomVessel: selectedGelRoomVessel
        }
      );
      setActiveSmartSuggestion(refreshed);
    }
  };

  const handleToggleRoundStrain = (roundKey: 'round1' | 'round2' | 'round3', strain: string) => {
    const listKey = `${roundKey}Strains` as keyof InoculationRoundConfig;
    const currentList = (customInoculationConfig[listKey] as string[]) || [];
    let updatedList: string[];
    if (currentList.includes(strain)) {
      if (currentList.length === 1) {
        // Keep at least one selected
        return;
      }
      updatedList = currentList.filter(s => s !== strain);
    } else {
      updatedList = [...currentList, strain];
    }

    const updatedConfig: InoculationRoundConfig = {
      ...customInoculationConfig,
      [listKey]: updatedList,
      [`${roundKey}Strain`]: formatRoundStrains(updatedList),
    };
    setCustomInoculationConfig(updatedConfig);

    if (activeSmartSuggestion) {
      const refreshed = getSmartProcessSuggestions(
        { 
          title: activeSmartSuggestion.targetTaskTitle, 
          vessel: activeSmartSuggestion.vesselName 
        },
        date,
        { 
          inoculationConfig: updatedConfig,
          productType: selectedProductType,
          gelRoomVessel: selectedGelRoomVessel
        }
      );
      setActiveSmartSuggestion(refreshed);
    }
  };

  const handleUpdateProductType = (pType: FormulationProductType) => {
    setSelectedProductType(pType);
    if (activeSmartSuggestion) {
      const refreshed = getSmartProcessSuggestions(
        { 
          title: activeSmartSuggestion.targetTaskTitle, 
          vessel: activeSmartSuggestion.vesselName 
        },
        date,
        { 
          inoculationConfig: customInoculationConfig,
          productType: pType,
          gelRoomVessel: selectedGelRoomVessel
        }
      );
      setActiveSmartSuggestion(refreshed);
    }
  };

  const handleUpdateGelRoomVessel = (vessel: string) => {
    setSelectedGelRoomVessel(vessel);
    if (activeSmartSuggestion) {
      const refreshed = getSmartProcessSuggestions(
        { 
          title: activeSmartSuggestion.targetTaskTitle, 
          vessel: activeSmartSuggestion.vesselName 
        },
        date,
        { 
          inoculationConfig: customInoculationConfig,
          productType: selectedProductType,
          gelRoomVessel: vessel
        }
      );
      setActiveSmartSuggestion(refreshed);
    }
  };

  // Form State
  const [formState, setFormState] = useState<Partial<DailyProcessTask>>({
    title: '',
    category: 'CellCulture',
    vessel: 'Bioreactor 100L',
    strain: '',
    medium: 'EMEM + Serum',
    phase: '',
    details: '',
    assignedStaff: [],
    status: 'planned',
    color: '#10b981',
  });

  // Live detection of vessel & prerequisite rules in form
  const liveFormCheck = useMemo(() => {
    if (!isAddingOrEditing) return null;
    return getSmartProcessSuggestions(formState, date, { 
      inoculationConfig: customInoculationConfig,
      productType: selectedProductType,
      gelRoomVessel: selectedGelRoomVessel
    });
  }, [formState, date, isAddingOrEditing, customInoculationConfig, selectedProductType, selectedGelRoomVessel]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const resetForm = () => {
    setFormState({
      title: '',
      category: 'CellCulture',
      vessel: 'Bioreactor 100L',
      strain: '',
      medium: 'EMEM + Serum',
      phase: '',
      details: '',
      assignedStaff: [],
      status: 'planned',
      color: '#10b981',
    });
    setEditingTaskId(null);
    setIsAddingOrEditing(false);
    setIsDropdownOpen(false);
  };

  const handleStartAdd = () => {
    if (!isOwner) {
      onOpenOwnerLogin();
      return;
    }
    resetForm();
    setIsAddingOrEditing(true);
  };

  const handleStartEdit = (task: DailyProcessTask) => {
    if (!isOwner) {
      onOpenOwnerLogin();
      return;
    }
    setFormState({ ...task });
    setEditingTaskId(task.id);
    setIsAddingOrEditing(true);
  };

  const handleDeleteTask = (taskId: string) => {
    if (!isOwner) {
      onOpenOwnerLogin();
      return;
    }
    const updated = tasks.filter(t => t.id !== taskId);
    onSaveTasks(updated);
    showToast('پروسه با موفقیت حذف شد.');
  };

  const handleSelectFromTemplate = (proc: ProcessDefinition) => {
    const isPrep = proc.category === 'VesselPrep';
    setFormState(prev => ({
      ...prev,
      title: proc.name,
      category: proc.category,
      vessel: proc.defaultVessel || prev.vessel || 'Bioreactor 100L',
      medium: isPrep ? undefined : ((proc.defaultMedium as any) || (proc.category === 'VirusInoculation' ? 'Earl' : 'EMEM + Serum')),
      color: proc.color,
      details: proc.description || prev.details || '',
    }));
    setIsDropdownOpen(false);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title?.trim()) {
      alert('لطفاً عنوان پروسه را وارد کنید.');
      return;
    }

    let updatedList: DailyProcessTask[] = [];
    let savedTask: DailyProcessTask;

    if (editingTaskId) {
      savedTask = {
        ...formState,
        id: editingTaskId,
        medium: formState.category === 'VesselPrep' ? undefined : formState.medium,
      } as DailyProcessTask;
      updatedList = tasks.map(t => {
        if (t.id === editingTaskId) {
          return savedTask;
        }
        return t;
      });
      showToast('پروسه با موفقیت ویرایش شد.');
    } else {
      const newTask: DailyProcessTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: formState.title.trim(),
        category: formState.category || 'CellCulture',
        vessel: formState.vessel,
        strain: formState.strain,
        medium: formState.category === 'VesselPrep' ? undefined : formState.medium,
        phase: formState.phase,
        details: formState.details,
        assignedStaff: formState.assignedStaff || [],
        status: formState.status || 'planned',
        color: formState.color || '#10b981',
      };
      savedTask = newTask;
      updatedList = [...tasks, newTask];
      showToast('پروسه جدید با موفقیت اضافه شد.');
    }

    onSaveTasks(updatedList);
    resetForm();

    // Smart suggestions: Prerequisites (CIP, PHT, Mech Seal SIP, Water Intake, Probes/SIP, Gel/Oil) + Remaining Campaign steps
    const smartSuggestion = getSmartProcessSuggestions(savedTask, date, { 
      inoculationConfig: customInoculationConfig,
      productType: selectedProductType,
      gelRoomVessel: selectedGelRoomVessel
    });
    if (smartSuggestion.prerequisites.length > 0 || smartSuggestion.hasSubsequentSteps) {
      setActiveSmartSuggestion(smartSuggestion);
      setActiveSuggestionTab(smartSuggestion.prerequisites.length > 0 ? 'prereqs' : 'subsequent');
      setIsPreviewListOpen(true);
    }
  };

  // 1-Click Passage in 2 Days
  const handlePassageIn2Days = (task: DailyProcessTask) => {
    if (!isOwner) {
      onOpenOwnerLogin();
      return;
    }
    const suggestion = getNextPassageSuggestion(task, date);
    if (!suggestion) return;

    if (onScheduleNextPassage) {
      const newTask: DailyProcessTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        title: suggestion.nextTask.title || `${task.title} (پاساژ ۲ روز بعد)`,
        category: suggestion.nextTask.category || task.category,
        vessel: suggestion.nextTask.vessel || task.vessel,
        strain: suggestion.nextTask.strain || task.strain,
        medium: suggestion.nextTask.medium || task.medium,
        phase: suggestion.nextTask.phase || 'پاساژ ۲ روزه',
        details: suggestion.nextTask.details || `پاساژ خودکار از تاریخ ${date}`,
        assignedStaff: task.assignedStaff || [],
        status: 'planned',
        color: suggestion.nextTask.color || task.color,
      };
      onScheduleNextPassage(suggestion.nextDate, newTask);
      showToast(`پاساژ بعدی برای ۲ روز بعد (${toPersianDigits(suggestion.nextDate)}) در تقویم ثبت شد!`);
    }
  };

  // Group process definitions by category for the collapsible dropdown
  const groupedDefinitions = React.useMemo(() => {
    const groups: Record<ProcessCategory, ProcessDefinition[]> = {
      CellCulture: [],
      VesselPrep: [],
      VirusInoculation: [],
      Inactivation: [],
      Downstream: [],
      Monitoring: [],
      MediaPrep: [],
      Other: [],
    };
    processDefinitions.forEach(p => {
      if (groups[p.category]) {
        groups[p.category].push(p);
      } else {
        groups.Other.push(p);
      }
    });
    return groups;
  }, [processDefinitions]);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Top Header */}
        <div className="bg-gradient-to-l from-slate-900 via-slate-850 to-slate-800 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <FlaskConical size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  مدیریت فرآیندها و بیوراکتورها
                </h2>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-2.5 py-0.5 rounded-full">
                  {toPersianDigits(tasks.length)} پروسه
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 font-medium flex items-center gap-1.5">
                <span>تاریخ:</span>
                <span className="font-bold text-emerald-400">{toPersianDigits(date)}</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300">{dayName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isOwner && (
              <button
                type="button"
                onClick={onOpenOwnerLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                title="ورود با رمز مدیر جهت ویرایش"
              >
                <Lock size={13} />
                <span>ورود مدیر</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {successToast && (
          <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-sm transition">
            <div className="flex items-center gap-2">
              <Check size={16} />
              <span>{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-200 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Header Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h3 className="font-black text-sm text-slate-800">
                فرآیندهای تعیین‌شده برای این روز
              </h3>
              <p className="text-[11px] text-slate-500">
                مشاهده یا تخصیص وظایف، بیوراکتورها، کشت سلول، تلقیح و آماده‌سازی مخازن
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isOwner && !isAddingOrEditing && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCampaignGenerator(!showCampaignGenerator)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition cursor-pointer"
                    title="ایجاد زنجیره فرآیند کامل SOP"
                  >
                    <Sparkles size={14} />
                    <span>تولید زنجیره SOP کامل</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartAdd}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm active:scale-95"
                  >
                    <Plus size={15} />
                    <span>افزودن پروسه جدید</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Smart Vessel Prerequisites & Remaining Campaign Suggestion Banner */}
          {activeSmartSuggestion && isOwner && (
            <div className="bg-gradient-to-br from-indigo-50/90 via-sky-50/90 to-emerald-50/90 border-2 border-indigo-400/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg animate-in fade-in zoom-in-95">
              {/* Banner Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <Sparkles size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-sm sm:text-base text-slate-900">
                        پیشنهاد هوشمند زمان‌بندی: پیش‌نیازهای وسل و مراحل بعدی
                      </h4>
                      {activeSmartSuggestion.vesselName && (
                        <span className="text-xs bg-indigo-700 text-white font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                          مخزن: {activeSmartSuggestion.vesselName}
                        </span>
                      )}
                      {activeSmartSuggestion.totalPrerequisiteTasks > 0 && (
                        <span className="text-xs bg-blue-600 text-white font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                          {toPersianDigits(activeSmartSuggestion.totalPrerequisiteTasks)} مرحله پیش‌نیاز
                        </span>
                      )}
                      {activeSmartSuggestion.hasSubsequentSteps && (
                        <span className="text-xs bg-emerald-600 text-white font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                          {toPersianDigits(activeSmartSuggestion.totalSubsequentTasks)} مرحله آتی
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      {activeSmartSuggestion.isFillingEvent && activeSmartSuggestion.vesselName ? (
                        <>
                          با توجه به برنامه‌ریزی پروسه برای <strong className="text-indigo-950 font-black">{activeSmartSuggestion.vesselName}</strong> در تاریخ {toPersianDigits(date)}، طبق پروتکل کارخانه باید مراحل پیش‌نیاز (CIP در ۳ روز قبل، PHT و آب‌گیری در ۲ روز قبل، کالیبراسیون پراب‌ها و SIP در ۱ روز قبل{activeSmartSuggestion.isMechSealRequired ? ' و SIP مکانیکال سیل در ۲ روز قبل' : ''}) انجام شود.
                        </>
                      ) : activeSmartSuggestion.isMediaPrepEvent ? (
                        <>
                          طبق استانداردهای تولید، برای ساخت محیط کشت نیاز است <strong className="text-blue-950 font-black">۱ روز قبل آب‌گیری مخزن</strong> انجام پذیرد.
                        </>
                      ) : (
                        <>
                          بر مبنای گام انتخاب‌شده «<strong className="text-indigo-950 font-black">{activeSmartSuggestion.matchedStepName || activeSmartSuggestion.targetTaskTitle}</strong>»، زمان‌بندی استاندارد کارخانه آماده چیدمان خودکار در تقویم است.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSmartSuggestion(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white/70 transition cursor-pointer"
                  title="بستن پیشنهاد"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation Tabs between Prerequisites and Subsequent Steps */}
              <div className="flex items-center gap-1.5 border-b border-indigo-200/80 pb-2 flex-wrap">
                {activeSmartSuggestion.totalPrerequisiteTasks > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSuggestionTab('prereqs')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeSuggestionTab === 'prereqs'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white/80 text-blue-900 hover:bg-white'
                    }`}
                  >
                    <ShieldAlert size={14} />
                    <span>مراحل پیش‌نیاز قبل از پر شدن ({toPersianDigits(activeSmartSuggestion.totalPrerequisiteTasks)})</span>
                  </button>
                )}

                {activeSmartSuggestion.hasSubsequentSteps && (
                  <button
                    type="button"
                    onClick={() => setActiveSuggestionTab('subsequent')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeSuggestionTab === 'subsequent'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white/80 text-emerald-900 hover:bg-white'
                    }`}
                  >
                    <Sparkles size={14} />
                    <span>مراحل بعدی زمان‌بندی ({toPersianDigits(activeSmartSuggestion.totalSubsequentTasks)})</span>
                  </button>
                )}

                {activeSmartSuggestion.totalPrerequisiteTasks > 0 && activeSmartSuggestion.hasSubsequentSteps && (
                  <button
                    type="button"
                    onClick={() => setActiveSuggestionTab('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      activeSuggestionTab === 'all'
                        ? 'bg-indigo-700 text-white shadow-xs'
                        : 'bg-white/80 text-indigo-900 hover:bg-white'
                    }`}
                  >
                    <Layers size={14} />
                    <span>کل زنجیره ({toPersianDigits(activeSmartSuggestion.totalFullChainTasks)})</span>
                  </button>
                )}
              </div>

              {/* Tab Contents: Prerequisites */}
              {activeSuggestionTab === 'prereqs' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-650 flex items-center justify-between">
                    <span>فهرست مراحل پیش‌نیاز استریلیزاسیون و آماده‌سازی به ترتیب زمانی:</span>
                    <span className="text-slate-500 text-[10px]">مرتب‌شده بر اساس روزهای قبل از شارژ</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-blue-100 bg-white/95 rounded-xl border border-blue-200 p-2 shadow-2xs space-y-1">
                    {activeSmartSuggestion.prerequisites.map((p, idx) => (
                      <div key={idx} className="p-2 hover:bg-blue-50/50 rounded-lg flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`px-2 py-0.5 rounded-md font-black text-[11px] shrink-0 ${
                            p.dayOffset === -3 
                              ? 'bg-blue-100 text-blue-900 border border-blue-300' 
                              : p.dayOffset === -2 
                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' 
                              : p.dayOffset === -1 
                              ? 'bg-purple-100 text-purple-900 border border-purple-300'
                              : 'bg-teal-100 text-teal-900 border border-teal-300'
                          }`}>
                            {p.dayOffset === -3 ? '۳ روز قبل' : p.dayOffset === -2 ? '۲ روز قبل' : p.dayOffset === -1 ? '۱ روز قبل (روز قبل)' : 'همان روز (T-0)'}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.task.color || '#2563eb' }} />
                              <p className="font-bold text-slate-900 truncate">{p.task.title}</p>
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {p.ruleLabel} {p.task.phase ? `• ${p.task.phase}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="font-black text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200 text-[11px] block">
                            {toPersianDigits(p.date)}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 text-center">
                            ({p.dayName})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Contents: Subsequent Steps */}
              {activeSuggestionTab === 'subsequent' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-650 flex items-center justify-between">
                    <span>مراحل آتی خط تولید طبق SOP استاندارد:</span>
                    <span className="text-slate-500 text-[10px]">از تاریخ پروسه به بعد</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-emerald-100 bg-white/95 rounded-xl border border-emerald-200 p-2 shadow-2xs space-y-1">
                    {activeSmartSuggestion.subsequentSteps.map((s, idx) => (
                      <div key={idx} className="p-2 hover:bg-emerald-50/50 rounded-lg flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] flex items-center justify-center shrink-0">
                            {toPersianDigits(idx + 1)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{s.title}</p>
                            {s.vessel && (
                              <p className="text-[10px] text-slate-500">{s.vessel}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[11px] block">
                            {toPersianDigits(s.date)}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            ({toPersianDigits(s.dayOffsetFromNow)} روز بعد)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab Contents: All / Full Chain */}
              {activeSuggestionTab === 'all' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-650 flex items-center justify-between">
                    <span>زنجیره کامل آماده‌سازی و مراحل آتی فرآیند:</span>
                    <span className="text-indigo-600 font-bold text-[10px]">
                      {toPersianDigits(activeSmartSuggestion.totalFullChainTasks)} مرحله در تقویم
                    </span>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 bg-white/95 rounded-xl border border-indigo-200 p-2 shadow-2xs space-y-1">
                    {/* Prerequisites Section */}
                    <div className="px-2 py-1 text-[10px] font-black text-blue-800 bg-blue-50/80 rounded-md">
                      🛡️ مراحل پیش‌نیاز وسل (قبل از پر شدن):
                    </div>
                    {activeSmartSuggestion.prerequisites.map((p, idx) => (
                      <div key={`all-p-${idx}`} className="p-1.5 hover:bg-slate-50 rounded-lg flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-bold">
                            {p.dayOffset === -3 ? 'T-3' : p.dayOffset === -2 ? 'T-2' : p.dayOffset === -1 ? 'T-1' : 'T-0'}
                          </span>
                          <p className="font-bold text-slate-800 truncate">{p.task.title}</p>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 shrink-0">
                          {toPersianDigits(p.date)}
                        </span>
                      </div>
                    ))}

                    {/* Subsequent Section */}
                    <div className="px-2 py-1 text-[10px] font-black text-emerald-800 bg-emerald-50/80 rounded-md mt-1">
                      🚀 مراحل بعدی فرآیند:
                    </div>
                    {activeSmartSuggestion.subsequentSteps.map((s, idx) => (
                      <div key={`all-s-${idx}`} className="p-1.5 hover:bg-slate-50 rounded-lg flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-bold">
                            +{toPersianDigits(s.dayOffsetFromNow)}d
                          </span>
                          <p className="font-bold text-slate-800 truncate">{s.title}</p>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 shrink-0">
                          {toPersianDigits(s.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inoculation Rounds & Downstream Formulation Configuration */}
              {activeSmartSuggestion.hasSubsequentSteps && (
                <div className="bg-white/95 rounded-2xl border border-indigo-200 p-3.5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-1 border-b border-indigo-100 pb-2">
                    <div className="flex items-center gap-1.5 font-black text-xs text-indigo-950">
                      <Dna size={15} className="text-indigo-600" />
                      <span>تنظیم وسل و سویه راندهای تلقیح (سویه‌ها با وسل‌ها همراهی ثابت ندارند):</span>
                    </div>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md font-bold">
                      💡 هر وسل می‌تواند در هر راند با سویه دلخواه (O, A05, ...) تلقیح شود
                    </span>
                  </div>

                  {/* 3 Inoculation Rounds with Multi-Select Vessels & Strains */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {/* Round 1 */}
                    <div className="space-y-2 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                      <div className="flex items-center justify-between pb-1 border-b border-amber-200/60">
                        <span className="font-black text-amber-950 text-xs">راند ۱ تلقیح</span>
                        <span className="text-[10px] font-bold text-amber-700 font-mono">Round 1</span>
                      </div>
                      
                      {/* Vessel selection (pick 1, 2, or 3) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-700">
                            وسل‌های تلقیح (انتخاب ۱، ۲ یا چند وسل):
                          </label>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                            {toPersianDigits(customInoculationConfig.round1Vessels?.length || 0)} انتخاب
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-white rounded-lg border border-amber-200">
                          {SINGLE_VESSEL_CHOICES.map(v => {
                            const isSelected = customInoculationConfig.round1Vessels?.includes(v);
                            return (
                              <button
                                key={`r1-v-${v}`}
                                type="button"
                                onClick={() => handleToggleRoundVessel('round1', v)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isSelected 
                                    ? 'bg-amber-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 text-slate-700 hover:bg-amber-100'
                                }`}
                              >
                                {isSelected && <Check size={10} className="stroke-[3]" />}
                                <span>{v}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Strain selection (pick 1, 2, or 3) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-700">
                            سویه‌های ویروس (انتخاب ۱، ۲ یا چند سویه):
                          </label>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                            {toPersianDigits(customInoculationConfig.round1Strains?.length || 0)} انتخاب
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 p-1 bg-white rounded-lg border border-amber-200">
                          {SINGLE_STRAIN_CHOICES.map(s => {
                            const isSelected = customInoculationConfig.round1Strains?.includes(s);
                            return (
                              <button
                                key={`r1-s-${s}`}
                                type="button"
                                onClick={() => handleToggleRoundStrain('round1', s)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isSelected 
                                    ? 'bg-amber-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 text-slate-700 hover:bg-amber-100'
                                }`}
                              >
                                {isSelected && <Check size={10} className="stroke-[3]" />}
                                <span>سویه {s}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Round 2 */}
                    <div className="space-y-2 bg-orange-50/70 p-3 rounded-xl border border-orange-200">
                      <div className="flex items-center justify-between pb-1 border-b border-orange-200/60">
                        <span className="font-black text-orange-950 text-xs">راند ۲ تلقیح</span>
                        <span className="text-[10px] font-bold text-orange-700 font-mono">Round 2</span>
                      </div>
                      
                      {/* Vessel selection */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-700">
                            وسل‌های تلقیح (انتخاب ۱، ۲ یا چند وسل):
                          </label>
                          <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-1.5 py-0.2 rounded">
                            {toPersianDigits(customInoculationConfig.round2Vessels?.length || 0)} انتخاب
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-white rounded-lg border border-orange-200">
                          {SINGLE_VESSEL_CHOICES.map(v => {
                            const isSelected = customInoculationConfig.round2Vessels?.includes(v);
                            return (
                              <button
                                key={`r2-v-${v}`}
                                type="button"
                                onClick={() => handleToggleRoundVessel('round2', v)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isSelected 
                                    ? 'bg-orange-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 text-slate-700 hover:bg-orange-100'
                                }`}
                              >
                                {isSelected && <Check size={10} className="stroke-[3]" />}
                                <span>{v}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Strain selection */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-700">
                            سویه‌های ویروس (انتخاب ۱، ۲ یا چند سویه):
                          </label>
                          <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-1.5 py-0.2 rounded">
                            {toPersianDigits(customInoculationConfig.round2Strains?.length || 0)} انتخاب
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 p-1 bg-white rounded-lg border border-orange-200">
                          {SINGLE_STRAIN_CHOICES.map(s => {
                            const isSelected = customInoculationConfig.round2Strains?.includes(s);
                            return (
                              <button
                                key={`r2-s-${s}`}
                                type="button"
                                onClick={() => handleToggleRoundStrain('round2', s)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isSelected 
                                    ? 'bg-orange-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 text-slate-700 hover:bg-orange-100'
                                }`}
                              >
                                {isSelected && <Check size={10} className="stroke-[3]" />}
                                <span>سویه {s}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Round 3 */}
                    <div className="space-y-2 bg-rose-50/70 p-3 rounded-xl border border-rose-200">
                      <div className="flex items-center justify-between pb-1 border-b border-rose-200/60">
                        <span className="font-black text-rose-950 text-xs">راند ۳ تلقیح</span>
                        <span className="text-[10px] font-bold text-rose-700 font-mono">Round 3</span>
                      </div>
                      
                      {/* Vessel selection */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-700">
                            وسل‌های تلقیح (انتخاب ۱، ۲ یا چند وسل):
                          </label>
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded">
                            {toPersianDigits(customInoculationConfig.round3Vessels?.length || 0)} انتخاب
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-white rounded-lg border border-rose-200">
                          {SINGLE_VESSEL_CHOICES.map(v => {
                            const isSelected = customInoculationConfig.round3Vessels?.includes(v);
                            return (
                              <button
                                key={`r3-v-${v}`}
                                type="button"
                                onClick={() => handleToggleRoundVessel('round3', v)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isSelected 
                                    ? 'bg-rose-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 text-slate-700 hover:bg-rose-100'
                                }`}
                              >
                                {isSelected && <Check size={10} className="stroke-[3]" />}
                                <span>{v}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Strain selection */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold text-slate-700">
                            سویه‌های ویروس (انتخاب ۱، ۲ یا چند سویه):
                          </label>
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded">
                            {toPersianDigits(customInoculationConfig.round3Strains?.length || 0)} انتخاب
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 p-1 bg-white rounded-lg border border-rose-200">
                          {SINGLE_STRAIN_CHOICES.map(s => {
                            const isSelected = customInoculationConfig.round3Strains?.includes(s);
                            return (
                              <button
                                key={`r3-s-${s}`}
                                type="button"
                                onClick={() => handleToggleRoundStrain('round3', s)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isSelected 
                                    ? 'bg-rose-600 text-white shadow-2xs' 
                                    : 'bg-slate-100 text-slate-700 hover:bg-rose-100'
                                }`}
                              >
                                {isSelected && <Check size={10} className="stroke-[3]" />}
                                <span>سویه {s}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Downstream & Gel Room Formulation Options */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="font-black text-slate-800 text-[11px] flex items-center gap-1.5">
                        <FlaskConical size={14} className="text-purple-600" />
                        <span>فرمولاسیون و اتاق ژل (محصول آبی با ژل و محصول روغنی با روغن ادجوانت):</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">نوع محصول فرمولاسیون:</label>
                        <select
                          value={selectedProductType}
                          onChange={e => handleUpdateProductType(e.target.value as FormulationProductType)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-[11px] outline-none cursor-pointer"
                        >
                          <option value="both">هر دو محصول (محصول آبی با ژل + محصول روغنی با روغن ادجوانت)</option>
                          <option value="aqueous_gel">فقط محصول آبی (فرمولاسیون ژل ادجوانت)</option>
                          <option value="oil_adjuvant">فقط محصول روغنی (فرمولاسیون روغن ادجوانت)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">مخزن اتاق ژل (۴۰۰ یا ۱۵۰۰ لیتری):</label>
                        <select
                          value={selectedGelRoomVessel}
                          onChange={e => handleUpdateGelRoomVessel(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-[11px] outline-none cursor-pointer"
                        >
                          {GEL_ROOM_VESSELS.map(gv => (
                            <option key={gv} value={gv}>
                              {gv}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Protocol note */}
                    <div className="text-[10px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200 space-y-0.5 leading-relaxed">
                      <p className="text-indigo-900 font-bold">• 💧 محصول آبی (ژل): ۵ روز قبل آب‌گیری ⬅️ ۴ روز قبل ساخت ژل ⬅️ ۳ روز قبل شستشوی ژل ⬅️ ۲ روز قبل CIP وسل ژل ⬅️ ۱ روز قبل PHT/SIP/انتقال/FSIP ⬅️ آماده فرمولاسیون</p>
                      <p className="text-purple-900 font-bold">• 🛢️ محصول روغنی: ۲ روز قبل CIP وسل ژل ⬅️ ۱ روز قبل PHT/SIP/انتقال روغن ادجوانت و FSIP ⬅️ خنک‌سازی و آماده فرمولاسیون</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-indigo-200/60">
                <button
                  type="button"
                  onClick={() => setActiveSmartSuggestion(null)}
                  className="px-3.5 py-2 text-xs text-slate-600 hover:text-slate-900 font-bold rounded-xl hover:bg-white/70 transition cursor-pointer"
                >
                  انصراف
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Schedule Prerequisites Only */}
                  {activeSmartSuggestion.totalPrerequisiteTasks > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onScheduleRemainingTimeline) {
                          onScheduleRemainingTimeline(activeSmartSuggestion.prerequisitesTimeline);
                          showToast(`مراحل پیش‌نیاز آماده‌سازی وسل (${toPersianDigits(activeSmartSuggestion.totalPrerequisiteTasks)} مرحله) در تقویم ثبت شد!`);
                          setActiveSmartSuggestion(null);
                        }
                      }}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      title="ثبت CIP (۳ روز قبل)، PHT و آب‌گیری (۲ روز قبل)، کالیبره پراب‌ها و SIP (۱ روز قبل)"
                    >
                      <ShieldAlert size={15} />
                      <span>چیدمان مراحل پیش‌نیاز ({toPersianDigits(activeSmartSuggestion.totalPrerequisiteTasks)} مرحله)</span>
                    </button>
                  )}

                  {/* Schedule Subsequent Only */}
                  {activeSmartSuggestion.hasSubsequentSteps && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onScheduleRemainingTimeline) {
                          onScheduleRemainingTimeline(activeSmartSuggestion.subsequentTimeline);
                          showToast(`مابقی مراحل بعدی فرآیند (${toPersianDigits(activeSmartSuggestion.totalSubsequentTasks)} مرحله) در تقویم چیده شد!`);
                          setActiveSmartSuggestion(null);
                        }
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      title="ثبت مراحل بعدی کمپین تولید"
                    >
                      <Sparkles size={15} />
                      <span>چیدمان مراحل بعدی ({toPersianDigits(activeSmartSuggestion.totalSubsequentTasks)} مرحله)</span>
                    </button>
                  )}

                  {/* Schedule Full Chain (Prerequisites + Subsequent) */}
                  {activeSmartSuggestion.totalPrerequisiteTasks > 0 && activeSmartSuggestion.hasSubsequentSteps && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onScheduleRemainingTimeline) {
                          onScheduleRemainingTimeline(activeSmartSuggestion.fullChainTimeline);
                          showToast(`کل زنجیره تولید (${toPersianDigits(activeSmartSuggestion.totalFullChainTasks)} مرحله شامل پیش‌نیازها و گام‌های بعدی) در تقویم چیده شد!`);
                          setActiveSmartSuggestion(null);
                        }
                      }}
                      className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-black shadow-md transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      title="ثبت همزمان کل پیش‌نیازها و کل مراحل بعدی فرآیند"
                    >
                      <CheckCircle2 size={16} />
                      <span>چیدمان کل زنجیره ({toPersianDigits(activeSmartSuggestion.totalFullChainTasks)} مرحله)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SOP Automated Campaign Generator Card */}
          {showCampaignGenerator && isOwner && (
            <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/80 border border-indigo-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h4 className="font-black text-xs sm:text-sm text-indigo-950">
                      ایجاد خودکار زنجیره فرآیند استاندارد کارخانه (SOP)
                    </h4>
                    <p className="text-[11px] text-indigo-700 mt-0.5">
                      ثبت خودکار کل دوره ۳۸ روزه تولید واکسن تب برفکی (از ذوب بذر سلولی ۱mL تا بیوراکتورهای ۱۰۰، ۷۰۰، ۲۷۰۰، تلقیح ۶ سویه و بسته‌بندی)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCampaignGenerator(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="bg-white/80 p-3 rounded-xl border border-indigo-100 text-[11px] text-slate-700 space-y-1">
                <p>• پاساژهای ۲ روزه بذر سلولی از فلاسک ۱۷۵ تا ۳ بطری ۱۰ لیتری (حجم ۱۵-۲۰L)</p>
                <p>• شارژ بیوراکتور ۱۰۰L و تکمیل حجم، انتقال به ۷۰۰L و ۲۷۰۰L با حالت سلول چیلد</p>
                <p>• تلقیح دو به دوی ۶ سویه در وسل‌های این‌اکتیو ۴۳ و ۴۴، لارج ویروس و بیوراکتورها</p>
                <p>• این‌اکتیویشن، تخلیه به موبایل وسل ۲۵۰L، فرمولاسیون و فیلینگ نهایی</p>
              </div>

              {/* Configurable Vessels and Strains for Campaign Inoculation Rounds */}
              <div className="bg-white/95 p-3.5 rounded-xl border border-indigo-200 text-xs space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-1 border-b border-indigo-100 pb-2">
                  <div className="flex items-center gap-1.5 font-black text-indigo-950 text-xs">
                    <Dna size={14} className="text-indigo-600" />
                    <span>تخصیص وسل و سویه راندهای تلقیح (سویه‌ها با وسل‌ها همراهی ثابت ندارند):</span>
                  </div>
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
                    💡 امکان تخصیص هر سویه (O, A05, ...) به هر وسل در هر راند
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Round 1 */}
                  <div className="space-y-2 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                    <div className="flex items-center justify-between pb-1 border-b border-amber-200/60">
                      <span className="font-bold text-amber-950 text-xs">راند ۱</span>
                      <span className="text-[10px] font-bold text-amber-700 font-mono">Round 1</span>
                    </div>

                    {/* Vessel multi-select */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-700 block">
                          وسل‌های تلقیح (انتخاب ۱، ۲ یا چند وسل):
                        </label>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                          {toPersianDigits(customInoculationConfig.round1Vessels?.length || 0)} انتخاب
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-white rounded-lg border border-amber-200">
                        {SINGLE_VESSEL_CHOICES.map(v => {
                          const isSelected = customInoculationConfig.round1Vessels?.includes(v);
                          return (
                            <button
                              key={`cg-r1-v-${v}`}
                              type="button"
                              onClick={() => handleToggleRoundVessel('round1', v)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                isSelected 
                                  ? 'bg-amber-600 text-white shadow-2xs' 
                                  : 'bg-slate-100 text-slate-700 hover:bg-amber-100'
                              }`}
                            >
                              {isSelected && <Check size={10} className="stroke-[3]" />}
                              <span>{v}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Strain multi-select */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-700 block">
                          سویه‌های ویروس (انتخاب ۱، ۲ یا چند سویه):
                        </label>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                          {toPersianDigits(customInoculationConfig.round1Strains?.length || 0)} انتخاب
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 p-1 bg-white rounded-lg border border-amber-200">
                        {SINGLE_STRAIN_CHOICES.map(s => {
                          const isSelected = customInoculationConfig.round1Strains?.includes(s);
                          return (
                            <button
                              key={`cg-r1-s-${s}`}
                              type="button"
                              onClick={() => handleToggleRoundStrain('round1', s)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                isSelected 
                                  ? 'bg-amber-600 text-white shadow-2xs' 
                                  : 'bg-slate-100 text-slate-700 hover:bg-amber-100'
                              }`}
                            >
                              {isSelected && <Check size={10} className="stroke-[3]" />}
                              <span>سویه {s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Round 2 */}
                  <div className="space-y-2 bg-orange-50/70 p-3 rounded-xl border border-orange-200">
                    <div className="flex items-center justify-between pb-1 border-b border-orange-200/60">
                      <span className="font-bold text-orange-950 text-xs">راند ۲</span>
                      <span className="text-[10px] font-bold text-orange-700 font-mono">Round 2</span>
                    </div>

                    {/* Vessel multi-select */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-700 block">
                          وسل‌های تلقیح (انتخاب ۱، ۲ یا چند وسل):
                        </label>
                        <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-1.5 py-0.2 rounded">
                          {toPersianDigits(customInoculationConfig.round2Vessels?.length || 0)} انتخاب
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-white rounded-lg border border-orange-200">
                        {SINGLE_VESSEL_CHOICES.map(v => {
                          const isSelected = customInoculationConfig.round2Vessels?.includes(v);
                          return (
                            <button
                              key={`cg-r2-v-${v}`}
                              type="button"
                              onClick={() => handleToggleRoundVessel('round2', v)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                isSelected 
                                  ? 'bg-orange-600 text-white shadow-2xs' 
                                  : 'bg-slate-100 text-slate-700 hover:bg-orange-100'
                              }`}
                            >
                              {isSelected && <Check size={10} className="stroke-[3]" />}
                              <span>{v}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Strain multi-select */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-700 block">
                          سویه‌های ویروس (انتخاب ۱، ۲ یا چند سویه):
                        </label>
                        <span className="text-[10px] font-bold text-orange-800 bg-orange-100 px-1.5 py-0.2 rounded">
                          {toPersianDigits(customInoculationConfig.round2Strains?.length || 0)} انتخاب
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 p-1 bg-white rounded-lg border border-orange-200">
                        {SINGLE_STRAIN_CHOICES.map(s => {
                          const isSelected = customInoculationConfig.round2Strains?.includes(s);
                          return (
                            <button
                              key={`cg-r2-s-${s}`}
                              type="button"
                              onClick={() => handleToggleRoundStrain('round2', s)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                isSelected 
                                  ? 'bg-orange-600 text-white shadow-2xs' 
                                  : 'bg-slate-100 text-slate-700 hover:bg-orange-100'
                              }`}
                            >
                              {isSelected && <Check size={10} className="stroke-[3]" />}
                              <span>سویه {s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Round 3 */}
                  <div className="space-y-2 bg-rose-50/70 p-3 rounded-xl border border-rose-200">
                    <div className="flex items-center justify-between pb-1 border-b border-rose-200/60">
                      <span className="font-bold text-rose-950 text-xs">راند ۳</span>
                      <span className="text-[10px] font-bold text-rose-700 font-mono">Round 3</span>
                    </div>

                    {/* Vessel multi-select */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-700 block">
                          وسل‌های تلقیح (انتخاب ۱، ۲ یا چند وسل):
                        </label>
                        <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded">
                          {toPersianDigits(customInoculationConfig.round3Vessels?.length || 0)} انتخاب
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-white rounded-lg border border-rose-200">
                        {SINGLE_VESSEL_CHOICES.map(v => {
                          const isSelected = customInoculationConfig.round3Vessels?.includes(v);
                          return (
                            <button
                              key={`cg-r3-v-${v}`}
                              type="button"
                              onClick={() => handleToggleRoundVessel('round3', v)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                isSelected 
                                  ? 'bg-rose-600 text-white shadow-2xs' 
                                  : 'bg-slate-100 text-slate-700 hover:bg-rose-100'
                              }`}
                            >
                              {isSelected && <Check size={10} className="stroke-[3]" />}
                              <span>{v}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Strain multi-select */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-700 block">
                          سویه‌های ویروس (انتخاب ۱، ۲ یا چند سویه):
                        </label>
                        <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded">
                          {toPersianDigits(customInoculationConfig.round3Strains?.length || 0)} انتخاب
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 p-1 bg-white rounded-lg border border-rose-200">
                        {SINGLE_STRAIN_CHOICES.map(s => {
                          const isSelected = customInoculationConfig.round3Strains?.includes(s);
                          return (
                            <button
                              key={`cg-r3-s-${s}`}
                              type="button"
                              onClick={() => handleToggleRoundStrain('round3', s)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                isSelected 
                                  ? 'bg-rose-600 text-white shadow-2xs' 
                                  : 'bg-slate-100 text-slate-700 hover:bg-rose-100'
                              }`}
                            >
                              {isSelected && <Check size={10} className="stroke-[3]" />}
                              <span>سویه {s}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Formulation Options in Campaign */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">نوع محصول فرمولاسیون کمپین:</label>
                      <select
                        value={selectedProductType}
                        onChange={e => handleUpdateProductType(e.target.value as FormulationProductType)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-[11px] outline-none cursor-pointer"
                      >
                        <option value="both">هر دو محصول (محصول آبی با ژل + محصول روغنی با روغن ادجوانت)</option>
                        <option value="aqueous_gel">فقط محصول آبی (فرمولاسیون ژل ادجوانت)</option>
                        <option value="oil_adjuvant">فقط محصول روغنی (فرمولاسیون روغن ادجوانت)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">مخزن اتاق ژل (۴۰۰ یا ۱۵۰۰ لیتری):</label>
                      <select
                        value={selectedGelRoomVessel}
                        onChange={e => handleUpdateGelRoomVessel(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 text-[11px] outline-none cursor-pointer"
                      >
                        {GEL_ROOM_VESSELS.map(gv => (
                          <option key={gv} value={gv}>
                            {gv}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 font-medium">
                    💧 ژل: آب‌گیری ⬅️ ساخت ژل ⬅️ شستشو ⬅️ CIP وسل ژل ⬅️ PHT/SIP/انتقال/FSIP | 🛢️ روغن: CIP ⬅️ PHT/SIP ⬅️ انتقال روغن و FSIP ⬅️ خنک‌سازی
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCampaignGenerator(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onApplyCampaignFromDate) {
                      onApplyCampaignFromDate(date, { 
                        inoculationConfig: customInoculationConfig,
                        productType: selectedProductType,
                        gelRoomVessel: selectedGelRoomVessel
                      });
                      setShowCampaignGenerator(false);
                      showToast('کل زنجیره فرآیند SOP با وسل‌ها، سویه‌ها و مسیر فرمولاسیون انتخابی در تقویم ثبت شد!');
                    }
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
                >
                  شروع و اعمال زنجیره از تاریخ {toPersianDigits(date)}
                </button>
              </div>
            </div>
          )}

          {/* Form: Add or Edit Task */}
          {isAddingOrEditing && (
            <form onSubmit={handleSubmitForm} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    {editingTaskId ? <Edit2 size={14} /> : <Plus size={14} />}
                  </div>
                  <h4 className="font-black text-sm text-slate-800">
                    {editingTaskId ? 'ویرایش پروسه' : 'افزودن پروسه جدید برای این روز'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Collapsible Dropdown for Quick Select from Defined Processes */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white border border-emerald-300 hover:border-emerald-500 rounded-xl text-xs font-bold text-emerald-900 transition cursor-pointer shadow-2xs"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="text-emerald-600" />
                    <span>انتخاب سریع از کتابخانه پروسه‌های استاندارد کارخانه (کشویی)</span>
                  </span>
                  {isDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-72 overflow-y-auto p-2 space-y-2">
                    <div className="text-[11px] text-slate-400 font-bold px-2 py-1 border-b border-slate-100">
                      روی هر پروسه کلیک کنید تا مشخصات آن به صورت خودکار پر شود:
                    </div>

                    {(Object.entries(groupedDefinitions) as [ProcessCategory, ProcessDefinition[]][]).map(([catKey, items]) => {
                      if (!items || items.length === 0) return null;
                      const catInfo = CATEGORY_LABELS[catKey] || { label: catKey, enLabel: catKey, badgeBg: 'bg-slate-100' };

                      return (
                        <div key={catKey} className="space-y-1">
                          <div className="text-[10px] font-black text-slate-500 px-2 pt-1 flex items-center gap-1.5">
                            <span>{catInfo.label}</span>
                            <span className="text-slate-400 font-medium text-[9px]">({catInfo.enLabel})</span>
                          </div>
                          <div className="space-y-0.5">
                            {items.map(proc => (
                              <button
                                key={proc.id}
                                type="button"
                                onClick={() => handleSelectFromTemplate(proc)}
                                className="w-full text-right px-2.5 py-1.5 hover:bg-emerald-50 rounded-lg text-xs font-bold text-slate-800 flex items-center justify-between transition cursor-pointer"
                              >
                                <span className="font-medium text-slate-850">{proc.name}</span>
                                {proc.defaultVessel && (
                                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-normal shrink-0">
                                    {proc.defaultVessel}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Main Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Title */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">عنوان فرآیند / تسک:</label>
                  <input
                    type="text"
                    value={formState.title || ''}
                    onChange={e => setFormState(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="مثلاً: کشت سلول Bioreactor 100L یا پایش سلولی..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">دسته‌بندی:</label>
                  <select
                    value={formState.category || 'CellCulture'}
                    onChange={e => {
                      const newCat = e.target.value as ProcessCategory;
                      setFormState(prev => ({
                        ...prev,
                        category: newCat,
                        medium: newCat === 'VesselPrep' ? undefined : (prev.medium || (newCat === 'VirusInoculation' ? 'Earl' : 'EMEM + Serum'))
                      }));
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vessel */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">مخزن / وسل مربوطه:</label>
                  <select
                    value={formState.vessel || ''}
                    onChange={e => setFormState(prev => ({ ...prev, vessel: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">بدون وسل / عمومی</option>
                    {VESSEL_OPTIONS.map(v => (
                      <option key={v.id} value={v.name}>
                        {v.name} ({v.capacity})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Strain (سویه) */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">سویه ویروس (در صورت وجود):</label>
                  <select
                    value={formState.strain || ''}
                    onChange={e => setFormState(prev => ({ ...prev, strain: e.target.value }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">بدون سویه</option>
                    {FMD_STRAINS.map(s => (
                      <option key={s} value={s}>
                        سویه {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Medium (محیط کشت) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">محیط کشت (Medium):</label>
                    {formState.category === 'VesselPrep' && (
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md">
                        عدم نیاز در آماده‌سازی
                      </span>
                    )}
                  </div>
                  {formState.category === 'VesselPrep' ? (
                    <div className="w-full px-3 py-2 bg-slate-100 border border-dashed border-slate-300 rounded-xl font-bold text-slate-500 text-[11px] flex items-center justify-between">
                      <span>در پروسه‌های آماده‌سازی وسل و خطوط، محیط کشت یا بافر مصرف نمی‌شود.</span>
                      <span className="text-[10px] text-slate-400 font-mono">بدون محیط</span>
                    </div>
                  ) : (
                    <select
                      value={formState.medium || ''}
                      onChange={e => setFormState(prev => ({ ...prev, medium: e.target.value as any }))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">بدون نیاز به محیط یا بافر</option>
                      <option value="EMEM + Serum">EMEM + Serum (Cell Culture - بیوراکتورها، فلاسک و اسپینر)</option>
                      <option value="Earl">Earl's Medium (Virus Inoculation - تلقیح ویروس)</option>
                      <option value="Other">سایر فرمولاسیون‌ها / بافر</option>
                    </select>
                  )}
                </div>

                {/* Phase / Status */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">مرحله یا فاز عملیاتی:</label>
                  <input
                    type="text"
                    value={formState.phase || ''}
                    onChange={e => setFormState(prev => ({ ...prev, phase: e.target.value }))}
                    placeholder="مثلاً: پاساژ ۲ روزه، نگهداری چیلد، Viability Check، CIP/SIP..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">وضعیت پیشرفت:</label>
                  <select
                    value={formState.status || 'planned'}
                    onChange={e => setFormState(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="planned">برنامه‌ریزی شده</option>
                    <option value="in_progress">در حال اجرا</option>
                    <option value="completed">تکمیل شده</option>
                  </select>
                </div>

                {/* Details */}
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-bold text-slate-700">توضیحات و دستورالعمل اجرایی مدیر:</label>
                  <textarea
                    rows={2}
                    value={formState.details || ''}
                    onChange={e => setFormState(prev => ({ ...prev, details: e.target.value }))}
                    placeholder="نکات فنی، درصد viability، حجم تزریق، پارامترهای کنترل دما و دور همزن..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-xs"
                  />
                </div>

                {/* Live SOP Vessel & Formulation Prerequisite Alert */}
                {liveFormCheck && (liveFormCheck.isFillingEvent || liveFormCheck.isMediaPrepEvent || liveFormCheck.isFormulationEvent) && (
                  <div className="sm:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 text-xs space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5 font-black text-blue-950 flex-wrap">
                      <ShieldAlert size={15} className="text-blue-600" />
                      <span>قوانین استاندارد استریلیزاسیون، فرمولاسیون و پیش‌نیازها:</span>
                      {liveFormCheck.vesselName && (
                        <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-[10px] font-bold">
                          {liveFormCheck.vesselName}
                        </span>
                      )}
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-800 pr-1">
                      {liveFormCheck.isFormulationEvent ? (
                        <>
                          <li className="font-bold text-indigo-900">
                            <strong>💧 مسیر محصول آبی (ژل ادجوانت):</strong> ۵ روز قبل آب‌گیری WFI/RO ⬅️ ۴ روز قبل ساخت ژل ⬅️ ۳ روز قبل شستشوی ژل ⬅️ ۲ روز قبل CIP وسل ژل ({liveFormCheck.gelRoomVessel || '۴۰۰/۱۵۰۰L'}) ⬅️ ۱ روز قبل PHT/SIP/انتقال/FSIP ژل ⬅️ آماده فرمولاسیون
                          </li>
                          <li className="font-bold text-purple-900">
                            <strong>🛢️ مسیر محصول روغنی (روغن ادجوانت):</strong> ۲ روز قبل CIP وسل ژل ({liveFormCheck.gelRoomVessel || '۴۰۰/۱۵۰۰L'}) ⬅️ ۱ روز قبل PHT/SIP/انتقال روغن ادجوانت/FSIP روغن ⬅️ خنک‌سازی و آماده فرمولاسیون
                          </li>
                        </>
                      ) : liveFormCheck.isFillingEvent ? (
                        <>
                          <li><strong>حداقل ۳ روز قبل:</strong> شستشوی درجا (CIP) وسل (بدون مصرف محیط/بافر)</li>
                          <li><strong>حداقل ۲ روز قبل:</strong> تست فشار و نشتی (PHT) وسل (بدون مصرف محیط/بافر)</li>
                          {liveFormCheck.isMechSealRequired && (
                            <li className="font-bold text-indigo-700">
                              <strong>حداقل ۲ روز قبل:</strong> SIP مکانیکال سیل (مخصوص بیوراکتورهای ۱۵۰۰ و ۲۷۰۰ - بدون مصرف محیط/بافر)
                            </li>
                          )}
                          <li><strong>حداقل ۱ روز قبل (روز قبل):</strong> کالیبراسیون پراب‌های pH/DO و SIP مخزن + آب‌گیری مخزن محیط</li>
                          <li><strong>همان روز پر شدن (T-0):</strong> ساخت و فیلتراسیون استریل محیط کشت (بدون نیاز به بافرسازی در روز قبل)</li>
                        </>
                      ) : (
                        <li><strong>روز قبل از ساخت محیط:</strong> آب‌گیری مخزن با آب خالص WFI / RO</li>
                      )}
                    </ul>
                    <p className="text-[10px] text-blue-600 font-medium pt-0.5">
                      💡 پس از ذخیره، سیستم به صورت خودکار پنل چیدمان هوشمند این پیش‌نیازها و مابقی مراحل زنجیره را فعال خواهد کرد.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
                >
                  {editingTaskId ? 'ذخیره تغییرات' : 'ثبت پروسه'}
                </button>
              </div>
            </form>
          )}

          {/* Existing Tasks List */}
          {tasks.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-2">
              <FlaskConical size={32} className="mx-auto text-slate-400" />
              <h4 className="font-bold text-sm text-slate-700">
                هیچ پروسه‌ای برای این روز ثبت نشده است.
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                مدیر می‌تواند پروسه‌های بیوراکتور، کشت سلول، تلقیح و پایش را با زدن دکمه «افزودن پروسه جدید» یا با «تولید زنجیره SOP» اضافه کند.
              </p>
              {isOwner ? (
                <button
                  type="button"
                  onClick={handleStartAdd}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                >
                  <Plus size={15} />
                  <span>افزودن اولین پروسه</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenOwnerLogin}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-sm"
                >
                  <Lock size={15} />
                  <span>ورود مدیر جهت ثبت پروسه</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, idx) => {
                const catInfo = CATEGORY_LABELS[task.category] || { label: 'فرآیند', badgeBg: 'bg-slate-100 text-slate-800 border-slate-300' };
                const isCompleted = task.status === 'completed';
                const isInProgress = task.status === 'in_progress';

                return (
                  <div
                    key={task.id || idx}
                    className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-3.5 sm:p-4 transition shadow-2xs space-y-2.5 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catInfo.badgeBg}`}>
                            {catInfo.label}
                          </span>

                          {task.vessel && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                              <FlaskConical size={11} className="text-slate-500" />
                              <span>{task.vessel}</span>
                            </span>
                          )}

                          {task.strain && (
                            <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-md border border-amber-200">
                              سویه: {task.strain}
                            </span>
                          )}

                          {task.medium && (
                            <span className="text-[10px] bg-teal-50 text-teal-800 font-bold px-2 py-0.5 rounded-md border border-teal-200">
                              محیط: {task.medium}
                            </span>
                          )}

                          {task.status && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isCompleted 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : isInProgress 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-slate-100 text-slate-600'
                            }`}>
                              {isCompleted ? 'تکمیل شده' : isInProgress ? 'در حال انجام' : 'برنامه‌ریزی'}
                            </span>
                          )}
                        </div>

                        <h4 className="font-black text-sm text-slate-850 pt-0.5">
                          {task.title}
                        </h4>
                      </div>

                      {/* Admin Actions */}
                      {isOwner && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(task)}
                            className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                            title="ویرایش این پروسه"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                            title="حذف این پروسه"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Phase / Details */}
                    {(task.phase || task.details) && (
                      <div className="text-xs text-slate-600 space-y-1 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                        {task.phase && (
                          <p className="font-bold text-slate-700">
                            فاز: <span className="text-slate-900 font-medium">{task.phase}</span>
                          </p>
                        )}
                        {task.details && (
                          <p className="text-[11px] text-slate-600 leading-relaxed font-normal">
                            {task.details}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Passage & Chilled Quick Actions */}
                    {isOwner && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[11px]">
                        <div className="text-slate-400 font-medium">
                          عملیات بیوراکتور:
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Smart Arrange Chain (Prerequisites + Subsequent) */}
                          <button
                            type="button"
                            onClick={() => {
                              const sug = getSmartProcessSuggestions(task, date, { 
                                inoculationConfig: customInoculationConfig,
                                productType: selectedProductType,
                                gelRoomVessel: selectedGelRoomVessel
                              });
                              if (sug.prerequisites.length > 0 || sug.hasSubsequentSteps) {
                                setActiveSmartSuggestion(sug);
                                setActiveSuggestionTab(sug.prerequisites.length > 0 ? 'prereqs' : 'subsequent');
                                setIsPreviewListOpen(true);
                              } else {
                                showToast('برای این پروسه مرحله پیش‌نیاز یا گام بعدی تعریف‌نشده است.');
                              }
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg font-bold transition cursor-pointer"
                            title="پیشنهاد و چیدمان خودکار پیش‌نیازهای وسل (CIP, PHT, SIP, آب‌گیری) و مابقی مراحل بر مبنای استانداردهای کارخانه"
                          >
                            <Sparkles size={12} className="text-indigo-600" />
                            <span>چیدمان هوشمند زنجیره و پیش‌نیازها</span>
                          </button>

                          {/* 2-Day Passage Action */}
                          <button
                            type="button"
                            onClick={() => handlePassageIn2Days(task)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg font-bold transition cursor-pointer"
                            title="ثبت خودکار پاساژ بعدی در ۲ روز بعد بر مبنای قوانین SOP"
                          >
                            <ArrowRight size={12} />
                            <span>پاساژ بعدی (۲ روز بعد)</span>
                          </button>

                          {/* Toggle Status */}
                          <button
                            type="button"
                            onClick={() => {
                              const nextStatus = task.status === 'completed' ? 'planned' : 'completed';
                              const updated = tasks.map(t => t.id === task.id ? { ...t, status: nextStatus } : t);
                              onSaveTasks(updated);
                            }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer border ${
                              isCompleted 
                                ? 'bg-slate-100 text-slate-700 border-slate-200' 
                                : 'bg-emerald-600 text-white border-emerald-600'
                            }`}
                          >
                            <CheckCircle2 size={12} />
                            <span>{isCompleted ? 'بازگردانی به برنامه‌ریزی' : 'ثبت به عنوان انجام‌شده'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium">
            تمام پروسه‌ها به صورت خودکار در دیتابیس ابری ذخیره و با سایر دستگاه‌ها همگام می‌شوند.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            بستن پنجره
          </button>
        </div>

      </div>
    </div>
  );
};
