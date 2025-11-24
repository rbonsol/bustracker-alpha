import React from 'react';

interface TelemetryCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: string;
  color?: 'default' | 'danger' | 'warning' | 'success';
}

export const TelemetryCard: React.FC<TelemetryCardProps> = ({ label, value, unit, icon, color = 'default' }) => {
  const colorClasses = {
    default: 'text-slate-300 bg-slate-800/50 border-slate-800',
    danger: 'text-red-400 bg-red-900/20 border-red-900/50',
    warning: 'text-amber-400 bg-amber-900/20 border-amber-900/50',
    success: 'text-emerald-400 bg-emerald-900/20 border-emerald-900/50',
  };

  return (
    <div className={`p-3 rounded-xl border ${colorClasses[color]} flex flex-col justify-between h-24 shadow-sm`}>
      <div className="flex justify-between items-start">
        <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider truncate">{label}</span>
        <i className={`fas ${icon} text-xs opacity-60`}></i>
      </div>
      <div className="mt-auto">
        <div className="flex items-baseline gap-1 truncate">
            <span className="text-xl font-mono font-bold tracking-tight">{value}</span>
            {unit && <span className="text-[10px] text-slate-500 font-medium">{unit}</span>}
        </div>
      </div>
    </div>
  );
};