
/**
 * Shift User Badge Card - v1.0.1
 */
import React from 'react';
import { Sun, Moon, CheckCircle2 } from 'lucide-react';

interface ShiftUserCardProps {
  name: string;
  type: 'Day' | 'Night' | 'Supervisor';
  className?: string;
  originalName?: string; // New prop to show previous owner
  showIcon?: boolean; // New prop to show icon instead of initial
  badgeLabel?: string; // Optional tag e.g. "همیار" or "نفر دوم"
  size?: 'sm' | 'md';
}

export const ShiftUserCard: React.FC<ShiftUserCardProps> = ({ 
  name, 
  type, 
  className = '', 
  originalName, 
  showIcon = false,
  badgeLabel,
  size = 'md'
}) => {
  const isDay = type === 'Day';
  const isNight = type === 'Night';
  const isSupervisor = type === 'Supervisor';
  
  // Display full name with prefix (matching Settings page)
  const displayName = name ? name.trim() : '---';
  const displayOriginal = originalName ? originalName.trim() : null;
  
  // Extract family name without prefix so the circle avatar preserves the first letter of the family name
  const familyName = name ? name.replace(/^(مهندس|خانم|آقای|دکتر)\s*/, '').trim() : '';
  const firstLetter = familyName ? familyName.charAt(0) : (name ? name.charAt(0) : '');

  // Styling Config
  let styles = {
    wrapper: '',
    avatar: '',
    subText: '',
    indicator: ''
  };

  if (isDay) {
    styles = {
      wrapper: 'bg-orange-50/80 hover:bg-orange-100 text-orange-900', // Warm transparent background
      avatar: 'bg-white text-orange-600 shadow-sm ring-1 ring-orange-200',
      subText: 'text-orange-600/70',
      indicator: 'bg-orange-500' // Small color strip
    };
  } else if (isNight) {
    styles = {
      wrapper: 'bg-slate-100 hover:bg-slate-200 text-slate-800', // Cool slate background
      avatar: 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-300',
      subText: 'text-slate-500',
      indicator: 'bg-slate-600'
    };
  } else {
    // Supervisor
    styles = {
      wrapper: 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900',
      avatar: 'bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-200',
      subText: 'text-emerald-600/70',
      indicator: 'bg-emerald-500'
    };
  }
  
  // Icon Selection
  const Icon = isDay ? Sun : (isNight ? Moon : CheckCircle2);
  const isCompact = size === 'sm';

  return (
    <div className={`
      relative flex items-center ${isCompact ? 'gap-2 px-3 py-1.5' : 'gap-3 px-4 py-3'} w-full transition-all duration-200
      ${styles.wrapper} rounded-lg cursor-default ${className}
    `}>
      
      {/* Colored Indicator Strip (Right side) */}
      <div className={`absolute right-0 top-1.5 bottom-1.5 w-1 rounded-l-full ${styles.indicator} opacity-50`}></div>

      {/* Avatar or Icon */}
      <div className={`
        ${isCompact ? 'w-7 h-7 min-w-[28px] text-xs' : 'w-9 h-9 min-w-[36px] text-sm'} rounded-full flex items-center justify-center 
        font-bold ml-1 ${styles.avatar}
      `}>
        {showIcon ? <Icon size={isCompact ? 14 : 18} /> : firstLetter}
      </div>

      {/* Details */}
      <div className="flex flex-col items-start z-10 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap w-full">
          <span className={`${isCompact ? 'text-xs' : 'text-sm'} font-bold tracking-tight truncate text-right`}>
            {displayName}
          </span>
          {badgeLabel && (
            <span className="text-[9px] font-black bg-white/90 text-slate-700 px-1.5 py-0.2 rounded-full border border-slate-200 shadow-2xs whitespace-nowrap">
              {badgeLabel}
            </span>
          )}
        </div>
        
        {/* If swapped, show original name crossed out */}
        {displayOriginal && displayOriginal !== displayName && (
           <span className="text-[9px] text-red-400/80 line-through decoration-red-300 truncate w-full text-right" title={`تغییر یافته از: ${originalName}`}>
             {displayOriginal}
           </span>
        )}
      </div>
    </div>
  );
};
