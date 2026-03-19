
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';

// ================= 配置区 =================
// 注意：server.js 是JavaScript文件，不能直接导入TypeScript模块
// 这里保持硬编码配置，需与 constants.ts 中的配置保持同步
const DIFY_API_KEY = "app-7NJS3gejhNgkXCVXCnE6BTM2"; // 统一Dify API密钥 (与constants.ts保持一致)
const DIFY_BASE_URL = "http://localhost/v1";   // 统一Dify服务地址（根据用户要求设置）
// =========================================

// 初始化Express应用
const app = express();
const PORT = 3002;
const upload = multer(); // 配置内存存储，不直接存磁盘，转发更快

// 启用跨域支持，允许前端调用
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 内存统计数据 (模拟数据库) ---
// 初始值设为非零，以便展示效果
let globalStats = {
    totalRows: 12840,       // 总处理行数
    totalDurationMs: 26964000 // 总耗时 (毫秒) -> 约等于 2.1秒/行 * 12840
};

// 获取统计数据接口
app.get('/api/stats', (req, res) => {
    res.json(globalStats);
});

// 上报统计数据接口
app.post('/api/stats/update', (req, res) => {
    const { rows, durationMs } = req.body;
    
    if (typeof rows === 'number' && typeof durationMs === 'number') {
        globalStats.totalRows += rows;
        globalStats.totalDurationMs += durationMs;
        console.log(`[Stats Updated] Added ${rows} rows, ${durationMs}ms. New Total: ${globalStats.totalRows} rows.`);
        res.json({ success: true, currentStats: globalStats });
    } else {
        res.status(400).json({ error: 'Invalid data format. "rows" and "durationMs" must be numbers.' });
    }
});

// 统计数据清零接口
app.post('/api/stats/reset', (req, res) => {
    // 保存当前统计数据用于日志记录
    const oldStats = { ...globalStats };
    
    // 重置统计数据 - 直接修改对象属性而不是重新赋值整个对象
    globalStats.totalRows = 0;
    globalStats.totalDurationMs = 0;
    
    console.log(`[Stats Reset] Old: ${oldStats.totalRows} rows, ${oldStats.totalDurationMs}ms. New: 0 rows, 0ms.`);
    res.json({ success: true, currentStats: globalStats, oldStats });
});

// 2. 上传文件接口
app.post('/api/upload', upload.single('file'), async (req, res) => {
    // 设置响应超时
    const timeoutId = setTimeout(() => {
        res.status(504).json({ error: "文件上传超时" });
        // 确保连接被关闭
        if (!res.headersSent) {
            res.end();
        }
    }, 30000); // 30秒超时

    try {
        if (!req.file) {
            return res.status(400).json({ error: "没有文件" });
        }

        const userId = req.body.userId || `user_${Date.now()}`;
        
        // 构造 FormData 发送给 Dify
        const formData = new FormData();
        formData.append('file', req.file.buffer, req.file.originalname);
        formData.append('user', userId);

        // 保持与Dify API端点一致的URL格式
        const difyUploadBaseUrl = DIFY_BASE_URL;
        const difyUrl = `${difyUploadBaseUrl}/files/upload`;
        console.log(`[Backend] Uploading file to Dify: ${difyUrl}`);
        
        // 添加超时控制
        const uploadPromise = fetch(difyUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DIFY_API_KEY}`,
                ...formData.getHeaders() // 这一步非常重要，自动生成 multipart boundary
            },
            body: formData
        });

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Dify文件上传超时')), 25000) // 比响应超时短5秒
        );

        const response = await Promise.race([uploadPromise, timeoutPromise]);

        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            console.error("JSON解析错误:", jsonError.message);
            try {
                console.error("响应内容:", await response.text());
            } catch (textError) {
                console.error("获取响应内容失败:", textError.message);
            }
            return res.status(500).json({ error: `Dify API返回无效的JSON数据: ${jsonError.message}` });
        }
        
        // 200 或 201 都算成功
        if (response.ok) {
            return res.json({
                status: "success",
                file_id: data.id,
                file_name: data.name,
                message: "文件上传成功"
            });
        } else {
            return res.status(response.status).json({ error: `上传失败: ${JSON.stringify(data)}` });
        }
    } catch (error) {
        console.error("Upload Error:", error.message);
        return res.status(500).json({ error: error.message });
    } finally {
        // 清除超时
        clearTimeout(timeoutId);
    }
});

// 3. 发送对话接口
app.post('/api/chat', async (req, res) => {
    const { query, file_id, conversation_id, user_id } = req.body;
    
    // === 构造 inputs ===
    const inputs = {};
    
    // 只要有 file_id，就放入 inputs
    if (file_id) {
        inputs["excel"] = {
            "type": "document",
            "transfer_method": "local_file",
            "upload_file_id": file_id
        };
    }

    const payload = {
        inputs: inputs,
        query: query,
        response_mode: "blocking",
        conversation_id: conversation_id,
        user: user_id || `user_${Date.now()}`,
        files: []
    };

    try {
        const difyUrl = `${DIFY_BASE_URL}/chat-messages`;
        console.log(`[Backend] Calling Dify chat: ${difyUrl}`);
        
        const response = await fetch(difyUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DIFY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (response.ok) {
            return res.json({
                reply: data.answer,
                conversation_id: data.conversation_id
            });
        } else {
            console.error("Chat Error:", JSON.stringify(data));
            return res.status(response.status).json({ error: JSON.stringify(data) });
        }

    } catch (error) {
        // Axios 错误处理
        const errorMsg = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error("Chat Error:", errorMsg);
        return res.status(500).json({ error: errorMsg });
    }
});


// 4. 文件代理接口 (使用原生正则，绕过字符串解析报错)
// 文件代理，用于处理 /files/* 的请求
app.get(/\/files\/(.*)/, async (req, res) => {
    // 获取路径部分
    const path = req.params[0];
    
    // Dify的文件下载端点不包含 /v1 前缀
    const difyBaseUrl = DIFY_BASE_URL.replace('/v1', '');
    
    // 构建基础URL
    const baseUrl = `${difyBaseUrl}/files/${path}`;
    
    // 构建完整的URL，包括查询参数
    const url = new URL(baseUrl);
    
    // 添加查询参数
    Object.keys(req.query).forEach(key => {
        url.searchParams.append(key, req.query[key]);
    });
    
    const difyFileUrl = url.toString();
    
    console.log(`DEBUG: Node Proxy 正在请求: ${difyFileUrl}`);

    try {
        // 使用原始查询字符串，避免重复编码
        const response = await fetch(difyFileUrl, {
            headers: {
                'Authorization': `Bearer ${DIFY_API_KEY}`
            },
            redirect: 'follow'
        });

        console.log(`DEBUG: Dify API 响应状态: ${response.status}`);
        console.log(`DEBUG: Dify API 响应头:`, Object.fromEntries(response.headers.entries()));

        // 转发 Headers
        const excludedHeaders = ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'host'];
        Object.keys(response.headers).forEach(key => {
            if (!excludedHeaders.includes(key.toLowerCase())) {
                res.setHeader(key, response.headers[key]);
            }
        });

        // 确保设置正确的Content-Type
        if (!res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        }

        res.status(response.status);
        
        // 转发响应体 - 使用流方式，避免内存问题
        const responseBuffer = await response.buffer();
        console.log(`DEBUG: 响应体大小: ${responseBuffer.length} bytes`);
        
        // 确保发送完整的响应体
        res.setHeader('Content-Length', responseBuffer.length);
        res.send(responseBuffer);

    } catch (error) {
        console.error("Proxy Error:", error);
        if (error.response) {
            return res.status(error.response.status).json({ 
                error: "File download failed from Dify",
                detail: error.message
            });
        }
        return res.status(500).json({ error: "Internal Proxy Error", detail: error.message });
    }
});

// Dify 测试连接接口 - 测试Dify API的基本连接性
app.post('/api/dify/test-connection', async (req, res) => {
    const { apiKey, baseUrl } = req.body;
    
    if (!apiKey) {
        return res.status(400).json({ error: 'Missing API Key' });
    }

    // 处理baseUrl，确保格式正确并包含/v1前缀
    let processedBaseUrl = baseUrl || 'http://localhost/v1';
    // 如果没有/v1前缀，添加它
    if (!processedBaseUrl.endsWith('/v1')) {
        processedBaseUrl += '/v1';
    }
    
    // 使用健康检查接口进行测试，如果存在的话
    // 否则使用一个简单的GET请求测试连接性
    const difyUrl = `${processedBaseUrl}/health`;

    try {
        console.log(`[Backend] Testing Dify connection: ${difyUrl}`);
        
        // 使用简单的GET请求测试连接性
        const response = await fetch(difyUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        // 解析响应
        let responseData;
        try {
            responseData = await response.json();
        } catch (e) {
            responseData = {};
        }

        // 处理特定的错误
        if (response.status === 404) {
            // 如果健康检查接口不存在，尝试使用文件上传接口
            console.log(`[Backend] Health check endpoint not found, trying files upload endpoint`);
            const uploadUrl = `${processedBaseUrl}/files/upload`;
            
            // 创建一个空的multipart请求来测试连接性（不实际上传文件）
            const formData = new FormData();
            formData.append('file', Buffer.from('test'), 'test.txt');
            formData.append('user', 'test-user');

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    ...formData.getHeaders()
                },
                body: formData
            });

            // 解析上传响应
            let uploadResponseData;
            try {
                uploadResponseData = await uploadResponse.json();
            } catch (e) {
                uploadResponseData = {};
            }

            // 处理上传响应
            if (uploadResponse.status === 400 && uploadResponseData.code === 'not_workflow_app') {
                // 连接成功但应用模式不匹配
                return res.json({ 
                    success: true, 
                    status: uploadResponse.status,
                    message: 'Connection successful but app mode mismatch',
                    details: 'Dify应用不是Workflow模式，但连接本身是成功的'
                });
            } else if (uploadResponse.status === 401) {
                // 认证失败
                return res.json({ 
                    success: false, 
                    status: uploadResponse.status,
                    message: 'Authentication failed'
                });
            } else if (uploadResponse.status === 200 || uploadResponse.status === 201) {
                // 上传成功
                return res.json({ 
                    success: true, 
                    status: uploadResponse.status,
                    message: 'Connection successful'
                });
            } else {
                // 其他错误
                return res.status(uploadResponse.status).json({ 
                    error: `Connection failed: ${uploadResponse.status}`,
                    details: uploadResponseData.message || 'Unknown error'
                });
            }
        }

        // 处理健康检查响应
        if (response.status === 200) {
            // 健康检查成功
            return res.json({ 
                success: true, 
                status: response.status,
                message: 'Connection successful'
            });
        } else if (response.status === 401) {
            // 认证失败
            return res.json({ 
                success: false, 
                status: response.status,
                message: 'Authentication failed'
            });
        } else {
            // 其他错误
            return res.status(response.status).json({ 
                error: `Connection failed: ${response.status}`,
                details: responseData.message || 'Unknown error'
            });
        }

    } catch (error) {
        console.error('[Backend] Connection Test Error:', error);
        return res.status(500).json({ 
            error: 'Connection failed', 
            details: error.message,
            message: '无法连接到Dify服务，请检查网络和配置'
        });
    }
});

// Dify 工作流代理接口（保持原有功能）
app.post('/api/dify/run', async (req, res) => {
    // 调试信息：记录请求来源
    console.log('[DEBUG] Request from:', req.headers.origin || 'unknown origin');
    console.log('[DEBUG] Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('[DEBUG] Request body:', JSON.stringify(req.body, null, 2));
    
    const { apiKey, baseUrl, inputs, userId } = req.body;
    
    // 阻止包含测试数据的反复请求
    if (inputs && inputs.content_col_a === 'Connection Test' && inputs.instruction_col_b === 'Ping') {
        console.log('[Backend] Blocking test request');
        return res.status(200).json({ message: 'Test request blocked to prevent abuse' });
    }
    
    if (!apiKey) {
        return res.status(400).json({ error: 'Missing API Key' });
    }

    let processedBaseUrl = baseUrl ? baseUrl.replace(/\/v1$/, '') : 'https://api.dify.ai';
    
    if (processedBaseUrl === 'localhost' || processedBaseUrl === 'http://localhost') {
        processedBaseUrl = 'http://localhost/v1';
    }
    
    // 注意：这里硬编码了workflow端点，但根据Dify应用的模式，可能需要使用不同的端点
    // 错误信息"not_workflow_app"表明Dify应用不是workflow模式
    // 如果需要支持不同的Dify应用模式，我们需要：
    // 1. 从前端传递应用模式信息
    // 2. 根据模式选择正确的API端点
    const difyUrl = `${processedBaseUrl}/workflows/run`;

    try {
        console.log('[Backend] Calling Dify workflow:', difyUrl);
        console.log('[Backend] Request inputs:', inputs);
        
        const response = await fetch(difyUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: inputs || {},
                response_mode: "blocking",
                user: userId || "govflow-user"
            })
        });

        const data = await response.json();
        console.log('[Backend] Dify Response Status:', response.status);
        console.log('[Backend] Dify Response Data:', data);

        if (!response.ok) {
            console.error('[Backend] Dify API Error:', data);
            // 专门处理workflow模式不匹配的错误
            if (response.status === 400 && data.code === 'not_workflow_app') {
                return res.status(400).json({
                    error: 'Dify应用模式不匹配',
                    message: '请检查Dify应用是否为Workflow模式，或修改前端调用的API端点',
                    original_error: data
                });
            }
            return res.status(response.status).json(data);
        }

        return res.json(data);

    } catch (error) {
        console.error('[Backend] Server Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 健康检查接口
app.get('/health', (req, res) => {
    res.send({ status: 'ok', service: 'GovFlow Backend' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🚀 GovFlow Backend running at http://0.0.0.0:${PORT}`);
    console.log(`📊 Stats API: http://0.0.0.0:${PORT}/api/stats`);
    console.log(`📡 Dify Proxy Endpoint: http://0.0.0.0:${PORT}/api/dify/run`);
    console.log(`📁 File Upload Endpoint: http://0.0.0.0:${PORT}/api/upload`);
    console.log(`💬 Chat Endpoint: http://0.0.0.0:${PORT}/api/chat`);
    console.log(`📥 File Proxy: http://0.0.0.0:${PORT}/files/*`);
    console.log(`==================================================\n`);
});


