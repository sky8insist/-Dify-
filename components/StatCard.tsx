import React from 'react';
import { StatMetric } from '../types';

interface StatCardProps {
  metric: StatMetric;
  icon: React.ReactNode;
  colorClass: string;
}

const StatCard: React.FC<StatCardProps> = ({ metric, icon, colorClass }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10`}>
           <div className={`text-${colorClass.split('-')[1]}-600`}>
             {icon}
           </div>
        </div>
        {/* Trend indicator removed as requested */}
      </div>
      <h3 className="text-slate-500 text-sm font-medium mb-1">{metric.label}</h3>
      <p className="text-2xl font-bold text-slate-900">{metric.value}</p>
    </div>
  );
};

export default StatCard;