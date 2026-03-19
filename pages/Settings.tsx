import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Database, Shield, Plug, Server, Save, CheckCircle2, Wifi, AlertCircle, Loader2 } from 'lucide-react';
import { testDifyConnection } from '../services/aiService';
import { DIFY_CONFIG } from '../constants';

const Settings: React.FC = () => {
  // State for form fields
  const [mode, setMode] = useState('dify');
    const [difyEndpoint, setDifyEndpoint] = useState(DIFY_CONFIG.BASE_URL);
    const [difyApiKey, setDifyApiKey] = useState(DIFY_CONFIG.API_KEY);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Test Connection State
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMsg, setTestMsg] = useState('');

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('govflow_mode');
    const savedEndpoint = localStorage.getItem('govflow_dify_endpoint');
    const savedKey = localStorage.getItem('govflow_dify_key');

    if (savedMode) setMode(savedMode);
    if (savedEndpoint) setDifyEndpoint(savedEndpoint);
    if (savedKey) setDifyApiKey(savedKey);
  }, []);

  const handleSave = () => {
    setSaveStatus('saving');
    
    localStorage.setItem('govflow_mode', mode);
    localStorage.setItem('govflow_dify_endpoint', difyEndpoint);
    localStorage.setItem('govflow_dify_key', difyApiKey);

    // Simulate network delay for UX
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 800);
  };

  const handleTestConnection = async () => {
    // 如果是Mock模式，直接返回成功
    if (mode === 'mock') {
        setTestStatus('success');
        setTestMsg('Mock模式连接成功');
        // 5秒后自动清除成功消息
        setTimeout(() => {
            setTestStatus('idle');
            setTestMsg('');
        }, 5000);
        return;
    }

    if (!difyApiKey) {
        setTestStatus('error');
        setTestMsg('请输入 API Key');
        return;
    }
    
    setTestStatus('testing');
    setTestMsg('正在连接...');
    
    // Pass current state values to test function
    const result = await testDifyConnection(difyApiKey, difyEndpoint);
    
    if (result.success) {
        setTestStatus('success');
        setTestMsg(result.message);
        // Auto clear success message after 5s
        setTimeout(() => {
            setTestStatus('idle');
            setTestMsg('');
        }, 5000);
    } else {
        setTestStatus('error');
        setTestMsg(result.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">系统设置</h2>
        <p className="text-slate-500">管理平台配置、第三方接入及安全策略。</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Plug size={20} className="text-blue-600" />
            AI 模型与 Dify 集成
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            配置“政数表格智能体”的后端推理引擎。请确保后端服务 (server.js) 已启动。
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">接入模式</label>
              <select 
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="dify">Dify Workflow API (推荐)</option>
                <option value="gemini">Google Gemini Flash (Cloud)</option>
                <option value="mock">Mock Mode (演示模式)</option>
              </select>
            </div>
            
            {mode === 'dify' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Dify API Base URL</label>
                  <input 
                    type="text" 
                    value={difyEndpoint}
                    onChange={(e) => setDifyEndpoint(e.target.value)}
                    placeholder="http://localhost/v1"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Dify Workflow API Key</label>
                  <div className="flex gap-2">
                     <input 
                      type="password" 
                      value={difyApiKey}
                      onChange={(e) => setDifyApiKey(e.target.value)}
                      placeholder="app-************************"
                      className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    请在 Dify 应用 -&gt; API 访问 -&gt; API 密钥 中获取。
                  </p>
                </div>

                {/* Connection Test Section */}
                <div className="md:col-span-2">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                            {testStatus === 'success' && <span className="text-sm text-emerald-600 flex items-center gap-1 font-medium"><CheckCircle2 size={16}/> {testMsg}</span>}
                            {testStatus === 'error' && <span className="text-sm text-red-600 flex items-center gap-1 font-medium"><AlertCircle size={16}/> {testMsg}</span>}
                            {testStatus === 'testing' && <span className="text-sm text-blue-600 flex items-center gap-2"><Loader2 size={14} className="animate-spin"/> 正在连接后端进行测试...</span>}
                            {testStatus === 'idle' && <span className="text-sm text-slate-500">点击右侧按钮测试 API 连接状态</span>}
                        </div>
                        <button
                            onClick={handleTestConnection}
                            disabled={testStatus === 'testing' || !difyApiKey}
                            className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-700 hover:text-blue-600 hover:border-blue-400 font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            <Wifi size={14} /> 
                            {testStatus === 'testing' ? '连接中...' : '测试连接'}
                        </button>
                    </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-lg p-4">
            <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Server size={14} />
                模型服务状态
            </h4>
            <div className="space-y-2">
              <div className={`flex items-center justify-between bg-white p-3 rounded border ${mode === 'dify' ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${mode === 'dify' ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                  <span className="text-sm font-medium text-slate-700">Dify Workflow Engine</span>
                </div>
                {mode === 'dify' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Active</span>}
              </div>
              <div className={`flex items-center justify-between bg-white p-3 rounded border ${mode === 'gemini' ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-slate-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${mode === 'gemini' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                  <span className="text-sm font-medium text-slate-700">Google Gemini Flash</span>
                </div>
                {mode === 'gemini' && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Active</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
           <button 
             onClick={handleSave}
             disabled={saveStatus === 'saving'}
             className={`px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors flex items-center gap-2 ${
               saveStatus === 'saved' 
                 ? 'bg-emerald-600 text-white hover:bg-emerald-700' 
                 : 'bg-blue-600 text-white hover:bg-blue-700'
             }`}
           >
             {saveStatus === 'saving' && '保存中...'}
             {saveStatus === 'saved' && <><CheckCircle2 size={16} /> 已保存</>}
             {saveStatus === 'idle' && <><Save size={16} /> 保存配置</>}
           </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;