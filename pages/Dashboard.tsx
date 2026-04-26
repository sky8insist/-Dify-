
import React, { useEffect, useState } from 'react';
import { TableProperties, Zap, BarChart3, ArrowRight, RefreshCcw, Loader2, Trash2 } from 'lucide-react';
import StatCard from '../components/StatCard';
import { StatMetric } from '../types';
import { getSystemStats } from '../services/aiService';

interface DashboardProps {
  onNavigate: (path: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [statsData, setStatsData] = useState({
    volume: '0',
    avgTime: '0.00'
  });
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    
    const data = await getSystemStats();
    if (data) {
      const avgTimeSec = data.totalRows > 0 
          ? (data.totalDurationMs / data.totalRows / 1000).toFixed(2) 
          : '0.00';
      
      setStatsData({
        volume: data.totalRows.toLocaleString(),
        avgTime: avgTimeSec
      });
    }
    setLoading(false);
  };

  const resetStats = async () => {
    setShowConfirmModal(true);
  };

  const handleConfirmReset = async () => {
    setShowConfirmModal(false);
    setResetting(true);
    try {
      const response = await fetch('/api/stats/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStatsData({
          volume: data.currentStats.totalRows.toLocaleString(),
          avgTime: '0.00'
        });
      }
    } catch (error) {
      console.error('清零统计数据失败:', error);
      alert('清零统计数据失败，请稍后重试。');
    } finally {
      setResetting(false);
    }
  };

  const handleCancelReset = () => {
    setShowConfirmModal(false);
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
        getSystemStats().then(data => {
            if (data) {
                const avgTimeSec = data.totalRows > 0 
                    ? (data.totalDurationMs / data.totalRows / 1000).toFixed(2) 
                    : '0.00';
                setStatsData({
                    volume: data.totalRows.toLocaleString(),
                    avgTime: avgTimeSec
                });
            }
        });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats: { metric: StatMetric; icon: any; color: string }[] = [
    {
      metric: { label: '智能体处理量', value: statsData.volume, trend: 0, trendDirection: 'up' },
      icon: <TableProperties size={24} className="text-purple-600" />,
      color: 'bg-purple-100'
    },
    {
      metric: { label: '平均耗时', value: `${statsData.avgTime}秒/行`, trend: 0, trendDirection: 'down' },
      icon: <Zap size={24} className="text-amber-600" />,
      color: 'bg-amber-100'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">确认清零</h3>
            <p className="text-slate-600 mb-6">确定要清零所有统计数据吗？此操作不可恢复。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelReset}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                确定清零
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">工作台概览</h2>
          <p className="text-slate-500">查看近期数据分析，快速访问核心功能。</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchStats}
            disabled={loading}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-blue-600 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            {loading ? '更新中...' : '刷新数据'}
          </button>
          <button 
            onClick={resetStats}
            disabled={resetting || loading}
            className="px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 hover:text-red-800 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70"
          >
            {resetting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {resetting ? '清零中...' : '清零数据'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {stats.map((item, idx) => (
          <StatCard key={idx} metric={item.metric} icon={item.icon} colorClass={item.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
            onClick={() => onNavigate('/table-agent')}
            className="group relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-8 opacity-10 transform group-hover:scale-110 transition-transform duration-500">
                <TableProperties size={120} className="text-white" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between min-h-[160px]">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white">
                            <TableProperties size={20} />
                        </div>
                        <h3 className="text-xl font-bold text-white">政数表格智能体</h3>
                    </div>
                    <p className="text-blue-100 text-sm max-w-sm">
                        利用 AI 对 Excel 数据进行批量清洗、分类与摘要提取，自动化处理政务数据。
                    </p>
                </div>
                <div className="mt-6 flex items-center text-white text-sm font-medium group-hover:translate-x-1 transition-transform">
                    立即开始任务 <ArrowRight size={16} className="ml-2" />
                </div>
            </div>
        </div>

        <div 
            className="group relative bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm opacity-90 cursor-not-allowed overflow-hidden"
        >
             <div className="absolute top-0 right-0 p-8 opacity-5">
                <BarChart3 size={120} className="text-slate-400" />
            </div>
            <div className="relative z-10 flex flex-col h-full justify-between min-h-[160px]">
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500">
                            <BarChart3 size={20} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-600">敬请期待</h3>
                    </div>
                    <p className="text-slate-400 text-sm max-w-sm">
                        数据报表中心功能升级开发中... 未来将提供更详细的业务处理日志、多维准确率分析及自定义报表导出功能。
                    </p>
                </div>
                <div className="mt-6 flex items-center text-slate-400 text-sm font-medium">
                    即将上线
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
