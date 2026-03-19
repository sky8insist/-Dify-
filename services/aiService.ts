import { GoogleGenAI } from "@google/genai";
import { DIFY_CONFIG } from '../constants';

const geminiApiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// Helper to simulate a "workflow" delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Stats Service ---
const BACKEND_BASE = 'http://localhost:3002';
const LOCAL_STATS_KEY = 'govflow_local_stats';

// Initialize local stats if empty
if (!localStorage.getItem(LOCAL_STATS_KEY)) {
    localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify({ totalRows: 0, totalDurationMs: 0 }));
}

// --- File Upload Service ---

// 文件上传响应类型
interface UploadResponse {
  fileId: string;
  conversationId: string;
  fileName: string;
  fileSize: number;
  message: string;
}

// 文件处理响应类型
interface ProcessFileResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  totalRows: number;
}

// 上传文件到后端
export const uploadFile = async (file: File): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', `user_${Date.now()}`);
  
  try {
    const response = await fetch(`${BACKEND_BASE}/upload`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`文件上传失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('文件上传错误:', error);
    throw error;
  }
};

// 处理上传的文件
export const processUploadedFile = async (fileId: string, conversationId: string): Promise<ProcessFileResponse> => {
  try {
    const response = await fetch(`${BACKEND_BASE}/process-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileId,
        conversationId
      })
    });
    
    if (!response.ok) {
      throw new Error(`文件处理请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('文件处理请求错误:', error);
    throw error;
  }
};

// 获取文件处理进度
export const getFileProcessingProgress = async (taskId: string): Promise<any> => {
  try {
    const response = await fetch(`${BACKEND_BASE}/file-progress/${taskId}`);
    
    if (!response.ok) {
      throw new Error(`获取进度失败: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('获取进度错误:', error);
    throw error;
  }
};

// 获取处理结果
export const getProcessedResults = async (taskId: string): Promise<any[]> => {
  try {
    const response = await fetch(`${BACKEND_BASE}/get-results/${taskId}`);
    
    if (!response.ok) {
      throw new Error(`获取结果失败: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('获取结果错误:', error);
    throw error;
  }
};

export const getSystemStats = async () => {
    try {
        // Try fetching from backend first
        const response = await fetch(`${BACKEND_BASE}/api/stats`);
        if (response.ok) {
             return await response.json();
        }
        throw new Error("Backend offline");
    } catch (error) {
        // Fallback to local storage if backend is down
        console.warn("Backend not available, using local stats");
        const local = localStorage.getItem(LOCAL_STATS_KEY);
        return local ? JSON.parse(local) : { totalRows: 0, totalDurationMs: 0 };
    }
};

export const reportTaskStats = async (rows: number, durationMs: number) => {
    try {
        // Update Local Storage immediately (source of truth for frontend-only mode)
        const localStr = localStorage.getItem(LOCAL_STATS_KEY);
        const local = localStr ? JSON.parse(localStr) : { totalRows: 0, totalDurationMs: 0 };
        const newStats = {
            totalRows: local.totalRows + rows,
            totalDurationMs: local.totalDurationMs + durationMs
        };
        localStorage.setItem(LOCAL_STATS_KEY, JSON.stringify(newStats));

        // Try reporting to backend
        await fetch(`${BACKEND_BASE}/api/stats/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows, durationMs })
        });
    } catch (error) {
        console.error("Failed to report stats to backend (saved locally):", error);
    }
};

// --- Dify Service ---

// Call Dify via local backend proxy
const callDifyWorkflow = async (content: string, instruction: string) => {
    // Default fallback keys -从集中配置获取
    const difyKey = localStorage.getItem('govflow_dify_key') || DIFY_CONFIG.API_KEY;
    const difyEndpoint = localStorage.getItem('govflow_dify_endpoint') || DIFY_CONFIG.BASE_URL;
    
    // Backend URL (Assuming server.js runs on port 3001)
    const backendUrl = `${BACKEND_BASE}/api/dify/run`;

    try {
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: difyKey,
                baseUrl: difyEndpoint,
                inputs: {
                    content_col_a: content,
                    instruction_col_b: instruction
                },
                userId: "govflow-web-user"
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            // Handle specific backend errors gracefully
            if (data.error) {
                // 检查是否有更详细的错误信息
                if (data.message) {
                    return `错误: ${data.message}`;
                }
                return `错误: ${data.error}`;
            }
            return `HTTP错误: ${response.status}`;
        }

        // Assuming Dify returns: { data: { outputs: { result: "..." } }, ... }
        return data.data?.outputs?.text || data.data?.outputs?.result || JSON.stringify(data.data?.outputs) || "Workflow completed";

    } catch (error) {
        console.error("Dify Call Error:", error);
        return `连接失败 (请检查后端或配置)`;
    }
};

// Test Dify Connection
export const testDifyConnection = async (apiKey: string, endpoint: string) => {
    const backendUrl = `${BACKEND_BASE}/api/dify/test-connection`;
    const startTime = Date.now();
    
    try {
        // Use AbortController to limit timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: apiKey,
                baseUrl: endpoint
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        let data;
        
        try {
            data = await response.json();
        } catch (e) {
            data = { error: "Invalid JSON response" };
        }

        if (response.ok) {
            if (data.success) {
                return { 
                    success: true, 
                    message: `连接成功 (耗时 ${duration}ms)`,
                    details: data
                };
            } else if (data.status === 401) {
                return { success: false, message: "认证失败：API Key 无效" };
            } else {
                return { 
                    success: false, 
                    message: `连接失败：${data.message || '参数错误'}` 
                };
            }
        } else {
            // Handle specific Dify error codes
            let errMsg = `HTTP ${response.status}`;
            if (response.status === 401) errMsg = "认证失败：API Key 无效";
            if (response.status === 404) errMsg = "地址错误：API Endpoint 无效";
            if (data.error) errMsg += ` - ${data.error}`;
            
            return { success: false, message: errMsg };
        }
    } catch (error: any) {
        // Detect if backend is offline
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
             return { success: false, message: "无法连接后端服务 (server.js 未启动?)" };
        }
        if (error.name === 'AbortError') {
            return { success: false, message: "连接超时 (10秒)" };
        }
        return { success: false, message: error instanceof Error ? error.message : "未知网络错误" };
    }
};

// Batch processing for Table Agent
export const processTableRow = async (contentColA: string, instructionColB: string): Promise<string> => {
    const mode = localStorage.getItem('govflow_mode') || 'dify';

    try {
        // 1. Dify Mode (Default & Recommended)
        if (mode === 'dify') {
            return await callDifyWorkflow(contentColA, instructionColB);
        }

        // 2. Mock Mode
        if (mode === 'mock') {
            await delay(600);
            const issues = ["材料缺失", "信息不符", "格式错误", "证件过期", "公章模糊", "缺少签名"];
            return issues[Math.floor(Math.random() * issues.length)] + " (Mock)";
        }

        // 3. Gemini Cloud Mode (Fallback)
        if (mode === 'gemini') {
            if (!geminiApiKey) {
                await delay(800);
                return "Error: 未配置 Gemini API Key";
            }
            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: `Row Content: "${contentColA}". Instruction: ${instructionColB}. Output concise result.`,
                });
                return response.text || "处理失败";
            } catch (error) {
                console.error("Gemini Error", error);
                return "Gemini 服务错误";
            }
        }
    } catch (e) {
        return "System Error";
    }

    return "未知模式";
}