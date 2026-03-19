
import React from 'react';
import { LayoutDashboard, BarChart3, Settings, LogOut, Building2, TableProperties } from 'lucide-react';
import { NAV_ITEMS } from '../constants';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate, onLogout }) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard': return <LayoutDashboard size={20} />;
      case 'TableProperties': return <TableProperties size={20} />;
      case 'BarChart3': return <BarChart3 size={20} />;
      case 'Settings': return <Settings size={20} />;
      default: return <LayoutDashboard size={20} />;
    }
  };

  return (
    <div className="w-64 bg-slate-900 text-slate-300 flex flex-col h-screen fixed left-0 top-0 shadow-xl z-50">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
          <Building2 size={18} />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg tracking-tight">Trinity</h1>
          <p className="text-xs text-slate-500">智慧政务中台</p>
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                isActive 
                  ? 'bg-blue-700 text-white shadow-md' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-blue-200' : 'text-slate-400 group-hover:text-white transition-colors'}>
                {getIcon(item.icon)}
              </span>
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">
            T
          </div>
          <div className="flex-1 overflow-hidden text-left">
            <p className="text-sm font-medium text-white truncate">Trinity</p>
            <p className="text-xs text-slate-500 truncate">退出登录</p>
          </div>
          <LogOut size={16} className="text-slate-500 hover:text-white" />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
