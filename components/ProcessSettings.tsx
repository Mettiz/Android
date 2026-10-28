/**
 * Process Settings Component
 * Allows managers to define, customize, and manage standard industrial bioprocesses:
 * - Define new processes for Cell Culture, Vessel Prep, Virus Inoculation, Inactivation, Formulation, etc.
 * - Manage custom parameters: Vessel, Media, Duration, Category, Color, Description.
 * - Custom processes dynamically appear in the dropdown/collapsible selector across the roster!
 */
import React, { useState } from 'react';
import { 
  Plus, Edit2, Trash2, FlaskConical, Sparkles, 
  RotateCcw, Search, Check, X, Filter, Info, ShieldAlert
} from 'lucide-react';
import { ProcessDefinition, ProcessCategory } from '../types';
import { 
  DEFAULT_PROCESS_DEFINITIONS, 
  CATEGORY_LABELS, 
  VESSEL_OPTIONS 
} from '../utils/bioprocessData';
import { toPersianDigits } from '../utils/persianDate';

interface ProcessSettingsProps {
  processDefinitions: ProcessDefinition[];
  onSaveDefinitions: (definitions: ProcessDefinition[]) => void;
  isUnlocked: boolean;
  onOpenUnlockModal: () => void;
}

export const ProcessSettings: React.FC<ProcessSettingsProps> = ({
  processDefinitions,
  onSaveDefinitions,
  isUnlocked,
  onOpenUnlockModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<ProcessDefinition>>({
    name: '',
    category: 'CellCulture',
    defaultVessel: 'Bioreactor 100L',
    defaultMedium: 'EMEM + Serum',
    durationDays: 2,
    color: '#10b981',
    description: '',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleStartAdd = () => {
    if (!isUnlocked) {
      onOpenUnlockModal();
      return;
    }
    setFormData({
      name: '',
      category: 'CellCulture',
      defaultVessel: 'Bioreactor 100L',
      defaultMedium: 'EMEM + Serum',
      durationDays: 2,
      color: '#10b981',
      description: '',
      isCustom: true,
    });
    setEditingId(null);
    setIsAddingNew(true);
  };

  const handleStartEdit = (proc: ProcessDefinition) => {
    if (!isUnlocked) {
      onOpenUnlockModal();
      return;
    }
    setFormData({ ...proc });
    setEditingId(proc.id);
    setIsAddingNew(true);
  };

  const handleDelete = (id: string) => {
    if (!isUnlocked) {
      onOpenUnlockModal();
      return;
    }
    if (confirm('آیا از حذف این پروسه از کتابخانه مطمئن هستید؟')) {
      const updated = processDefinitions.filter(p => p.id !== id);
      onSaveDefinitions(updated);
      showToast('پروسه از کتابخانه حذف شد.');
    }
  };

  const handleResetToDefault = () => {
    if (!isUnlocked) {
      onOpenUnlockModal();
      return;
    }
    if (confirm('آیا می‌خواهید کتابخانه پروسه‌ها به تنظیمات استاندارد اولیه کارخانه تب برفکی (FMD) بازنشانی شود؟')) {
      onSaveDefinitions(DEFAULT_PROCESS_DEFINITIONS);
      showToast('کتابخانه پروسه‌ها به حالت استاندارد بازنشانی شد.');
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert('لطفاً نام پروسه را وارد کنید.');
      return;
    }

    let updated: ProcessDefinition[] = [];

    if (editingId) {
      updated = processDefinitions.map(p => {
        if (p.id === editingId) {
          return {
            ...p,
            ...formData,
            name: formData.name!.trim(),
          } as ProcessDefinition;
        }
        return p;
      });
      showToast('پروسه با موفقیت به‌روزرسانی شد.');
    } else {
      const newProc: ProcessDefinition = {
        id: `custom-proc-${Date.now()}`,
        name: formData.name!.trim(),
        category: formData.category || 'CellCulture',
        defaultVessel: formData.defaultVessel,
        defaultMedium: formData.defaultMedium,
        durationDays: Number(formData.durationDays) || 2,
        color: formData.color || '#10b981',
        description: formData.description,
        isCustom: true,
      };
      updated = [...processDefinitions, newProc];
      showToast('پروسه جدید به کتابخانه اضافه شد و در لیست کشویی فعال است.');
    }

    onSaveDefinitions(updated);
    setIsAddingNew(false);
    setEditingId(null);
  };

  // Filter definitions
  const filteredList = processDefinitions.filter(p => {
    if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      const matchVessel = p.defaultVessel?.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchVessel) return false;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-7 space-y-6" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <FlaskConical size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-base sm:text-lg text-slate-850">
                تعریف و مدیریت پروسه‌های تولید و بیوراکتورها
              </h3>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                {toPersianDigits(processDefinitions.length)} پروسه تعریف‌شده
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              تعریف پروسه‌های استاندارد کارخانه؛ این موارد به عنوان لیست کشویی هنگام ثبت کارهای روزانه ظاهر می‌شوند.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
            title="بازنشانی تمام پروسه‌ها به مقادیر اولیه کارخانه"
          >
            <RotateCcw size={13} />
            <span>بازنشانی پیش‌فرض</span>
          </button>

          <button
            type="button"
            onClick={handleStartAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer active:scale-95"
          >
            <Plus size={16} />
            <span>تعریف پروسه جدید</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-200 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Form: Add / Edit Definition */}
      {isAddingNew && (
        <form onSubmit={handleSubmitForm} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h4 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600" />
              <span>{editingId ? 'ویرایش مشخصات پروسه' : 'تعریف پروسه جدید برای لیست کشویی'}</span>
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
            {/* Name */}
            <div className="sm:col-span-2 space-y-1">
              <label className="font-bold text-slate-700">نام کامل پروسه:</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="مثلاً: Cell Culture - Bioreactor 100L یا پایش زیست‌پذیری..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">دسته‌بندی:</label>
              <select
                value={formData.category || 'CellCulture'}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value as ProcessCategory }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Vessel */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">مخزن / وسل پیش‌فرض:</label>
              <select
                value={formData.defaultVessel || ''}
                onChange={e => setFormData(prev => ({ ...prev, defaultVessel: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="">بدون وسل مشخص</option>
                {VESSEL_OPTIONS.map(v => (
                  <option key={v.id} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Default Medium */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">محیط کشت پیش‌فرض:</label>
              <select
                value={formData.defaultMedium || 'EMEM + Serum'}
                onChange={e => setFormData(prev => ({ ...prev, defaultMedium: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="EMEM + Serum">EMEM + Serum</option>
                <option value="Earl">Earl's Medium</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Duration / Passage Days */}
            <div className="space-y-1">
              <label className="font-bold text-slate-700">دوره پاساژ یا مدت زمان (روز):</label>
              <input
                type="number"
                min={1}
                max={30}
                value={formData.durationDays || 2}
                onChange={e => setFormData(prev => ({ ...prev, durationDays: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2 md:col-span-3 space-y-1">
              <label className="font-bold text-slate-700">توضیحات و دستورالعمل اجرایی:</label>
              <textarea
                rows={2}
                value={formData.description || ''}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="توضیح مختصر در مورد نحوه اجرا، نکات ایمنی و استانداردهای این پروسه..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition active:scale-95 cursor-pointer"
            >
              {editingId ? 'ذخیره تغییرات' : 'ثبت پروسه در کتابخانه'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="جستجو در نام، مخزن یا توضیحات پروسه..."
            className="w-full pr-9 pl-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
              selectedCategory === 'ALL'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            همه دسته‌ها ({toPersianDigits(processDefinitions.length)})
          </button>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSelectedCategory(k)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategory === k
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* List of Definitions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredList.map(proc => {
          const catInfo = CATEGORY_LABELS[proc.category] || { label: 'سایر', badgeBg: 'bg-slate-100 border-slate-300' };

          return (
            <div
              key={proc.id}
              className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-4 transition shadow-2xs space-y-2 flex flex-col justify-between"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${catInfo.badgeBg}`}>
                    {catInfo.label}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(proc)}
                      className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                      title="ویرایش"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(proc.id)}
                      className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                      title="حذف"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h4 className="font-black text-sm text-slate-850">
                  {proc.name}
                </h4>

                {proc.description && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                    {proc.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
                {proc.defaultVessel && (
                  <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                    مخزن: {proc.defaultVessel}
                  </span>
                )}
                {proc.defaultMedium && (
                  <span className="bg-teal-50 border border-teal-200 text-teal-800 px-2 py-0.5 rounded-md">
                    محیط: {proc.defaultMedium}
                  </span>
                )}
                {proc.durationDays && (
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md">
                    دوره: {toPersianDigits(proc.durationDays)} روز
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
