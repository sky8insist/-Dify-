
import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import TableAgent from './pages/TableAgent';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import { Bell, LogOut, LayoutDashboard, TableProperties, Settings as SettingsIcon, User } from 'lucide-react';

const App = () => {
  // 从localStorage读取认证状态，确保页面刷新后保持登录状态
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const savedAuth = localStorage.getItem('govflow_authenticated');
    return savedAuth === 'true';
  });
  const [currentPath, setCurrentPath] = useState(window.location.hash.slice(1) || '/');
  const [currentDate, setCurrentDate] = useState(new Date());
  // 通知状态管理
  const [hasNotification, setHasNotification] = useState(false);
  const [notificationAnimation, setNotificationAnimation] = useState(false);
  
  // User Menu State
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const path = window.location.hash.slice(1) || '/';
      setCurrentPath(path);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Timer for updating date (checks every minute)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
    setIsUserMenuOpen(false); // Close menu on navigation
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    // 将认证状态保存到localStorage
    localStorage.setItem('govflow_authenticated', 'true');
    navigate('/');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsUserMenuOpen(false);
    // 从localStorage移除认证状态
    localStorage.removeItem('govflow_authenticated');
    navigate('/login');
  };

  // 触发通知的函数
  const triggerNotification = () => {
    console.log('触发通知动画');
    setHasNotification(true);
    setNotificationAnimation(true);
    
    // 动画结束后重置
    setTimeout(() => {
      console.log('通知动画结束');
      setNotificationAnimation(false);
    }, 1000);
  };

  // Auth Routing Logic
  if (!isAuthenticated) {
    if (currentPath === '/register') {
      return <Register onRegister={handleLogin} onNavigateLogin={() => navigate('/login')} />;
    }
    return <Login onLogin={handleLogin} onNavigateRegister={() => navigate('/register')} />;
  }

  // Main App Routing Logic
  const renderContent = () => {
    switch (currentPath) {
      case '/':
        return <Dashboard onNavigate={navigate} />;
      case '/table-agent':
        return <TableAgent onFileProcessed={triggerNotification} />;
      case '/settings':
        return <Settings />;
      default:
        // Default to dashboard if route not found
        if (!currentPath.startsWith('/login') && !currentPath.startsWith('/register')) {
             return <Dashboard onNavigate={navigate} />;
        }
        return <Dashboard onNavigate={navigate} />;
    }
  };

  const getPageTitle = () => {
     switch (currentPath) {
      case '/': return '工作台';
      case '/table-agent': return '政数表格智能体';
      case '/settings': return '系统设置';
      default: return 'GovFlow';
    }
  };

  const formattedDate = currentDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar currentPath={currentPath} onNavigate={navigate} onLogout={handleLogout} />
      
      <div className="flex-1 ml-64 flex flex-col">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-40 flex items-center justify-between px-8 shadow-sm">
          <div className="flex items-center gap-4">
             <h2 className="text-lg font-semibold text-slate-800">{getPageTitle()}</h2>
             <span className="h-4 w-px bg-slate-300 mx-2"></span>
             <div className="text-sm text-slate-500">{formattedDate}</div>
          </div>
          
          <div className="flex items-center gap-6">
            <button className="relative text-slate-500 hover:text-blue-600 transition-colors">
              <Bell 
                size={20} 
                className={`transition-all duration-500 ease-in-out ${notificationAnimation ? 'animate-pulse scale-125 text-red-500' : ''}`} 
              />
              <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white transition-all duration-300 ease-in-out ${notificationAnimation ? 'scale-150 opacity-0' : 'scale-1 opacity-100'}`}></span>
            </button>
            
            {/* User Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-md cursor-pointer hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                T
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-2 animate-in fade-in slide-in-from-top-2 z-50">
                  <div className="px-4 py-3 border-b border-slate-100 mb-1">
                    <p className="text-sm font-semibold text-slate-800">Trinity</p>
                    <p className="text-xs text-slate-500">admin@gov.cn</p>
                  </div>
                  
                  <div className="py-1">
                    <button onClick={() => navigate('/')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <LayoutDashboard size={16} className="text-slate-400" /> 工作台
                    </button>
                    <button onClick={() => navigate('/table-agent')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <TableProperties size={16} className="text-slate-400" /> 表格智能体
                    </button>
                    <button onClick={() => navigate('/settings')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                      <SettingsIcon size={16} className="text-slate-400" /> 系统设置
                    </button>
                  </div>
                  
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                      <LogOut size={16} /> 退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;