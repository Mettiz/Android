/**
 * Stats Card Component - v1.0.1
 */
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  colorClass: string;
  type?: 'horizontal' | 'square';
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, subtitle, icon: Icon, colorClass, type = 'horizontal' }) => {
  if (type === 'square') {
    const stringValue = typeof value === 'string' ? value : String(value ?? '');
    const textLength = stringValue.length;
    const isTextLong = textLength > 10;

    // Dynamically scale font size according to text length so full name always fits cleanly in the mosaic
    let valueFontSize = 'text-xl sm:text-2xl leading-none';
    if (textLength > 24) {
      valueFontSize = 'text-[9px] sm:text-[10px] leading-tight font-bold';
    } else if (textLength > 18) {
      valueFontSize = 'text-[10px] sm:text-[11px] leading-tight font-bold';
    } else if (textLength > 14) {
      valueFontSize = 'text-[11px] sm:text-xs leading-tight font-bold';
    } else if (textLength > 10) {
      valueFontSize = 'text-xs sm:text-sm leading-snug font-bold';
    } else if (textLength > 6) {
      valueFontSize = 'text-sm sm:text-base leading-snug font-extrabold';
    }

    return (
      <div className="bg-white p-2.5 sm:p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-between text-center transition hover:shadow-md h-full w-full overflow-hidden">
        {/* Icon */}
        <div className={`p-1.5 ${isTextLong ? 'sm:p-1.5' : 'sm:p-2'} rounded-full ${colorClass} bg-opacity-10 text-opacity-100 shrink-0 mt-0.5`}>
          <Icon size={isTextLong ? 18 : 22} className={`${colorClass.replace('bg-', 'text-')}`} />
        </div>

        {/* Content */}
        <div className="w-full flex-1 flex flex-col items-center justify-center min-h-0 px-0.5 my-0.5">
          <p className="text-[11px] sm:text-xs text-slate-500 font-bold mb-0.5 shrink-0 max-w-full truncate">
            {title}
          </p>
          <p 
            className={`text-slate-800 w-full break-words text-center px-0.5 ${valueFontSize}`}
            title={stringValue}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-medium shrink-0 max-w-full truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 space-x-reverse transition hover:shadow-md">
      <div className={`p-3 rounded-full ${colorClass} bg-opacity-10 text-opacity-100`}>
        <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
};