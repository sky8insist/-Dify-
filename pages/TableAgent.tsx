
import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, CheckCircle, Loader2, Upload, ChevronRight, ChevronLeft, Download, Play, AlertCircle } from 'lucide-react';
import { processTableRow, reportTaskStats, getSystemStats } from '../services/aiService';
import * as XLSX from 'xlsx';

// 定义持久化状态的类型
interface PersistentState {
  isPanelOpen: boolean;
  fileId: string | null;
  conversationId: string;
  fileRowCount: number | null;
  rawFileData: Array<any> | null;
  data: any[];
  processStatus: 'idle' | 'processing' | 'completed';
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  showDownloadLinks: boolean;
  downloadLink: string | null;
  difyDownloadLink: string;
  hasError: boolean;
}

interface TableAgentProps {
  onFileProcessed?: () => void;
}

const TableAgent: React.FC<TableAgentProps> = ({ onFileProcessed }) => {
  // 从localStorage加载持久化状态
  const loadStateFromStorage = (): PersistentState => {
    try {
      const stored = localStorage.getItem('tableAgentState');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
    }
    // 默认状态
    return {
      isPanelOpen: true,
      fileId: null,
      conversationId: '',
      fileRowCount: null,
      rawFileData: null,
      data: [],
      processStatus: 'idle',
      uploadStatus: 'idle',
      showDownloadLinks: false,
      downloadLink: null,
      difyDownloadLink: '',
      hasError: false
    };
  };

  // 初始化状态，优先使用localStorage中的状态
  const initialState = loadStateFromStorage();
  
  const [isPanelOpen, setIsPanelOpen] = useState(initialState.isPanelOpen);
  const [file, setFile] = useState<File | null>(null); // 文件对象不适合持久化，始终初始化为null
  const [data, setData] = useState<any[]>(initialState.data);
  const [isProcessing, setIsProcessing] = useState(false); // 处理状态不需要持久化
  const [progress, setProgress] = useState(0); // 进度不需要持久化
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'completed'>(initialState.processStatus);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>(initialState.uploadStatus);
  const [fileId, setFileId] = useState<string | null>(initialState.fileId);
  const [conversationId, setConversationId] = useState<string>(initialState.conversationId);
  const [fileRowCount, setFileRowCount] = useState<number | null>(initialState.fileRowCount);
  const [rawFileData, setRawFileData] = useState<Array<any> | null>(initialState.rawFileData);
  const [showDownloadLinks, setShowDownloadLinks] = useState(initialState.showDownloadLinks);
  const [downloadLink, setDownloadLink] = useState<string | null>(initialState.downloadLink);
  const [difyDownloadLink, setDifyDownloadLink] = useState<string>(initialState.difyDownloadLink);
  const [hasError, setHasError] = useState(initialState.hasError);
  
  // 生成或从localStorage获取userId，确保一致性
  const getUserId = (): string => {
    const storedUserId = localStorage.getItem('tableAgentUserId');
    if (storedUserId) {
      return storedUserId;
    }
    const newUserId = "user-" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('tableAgentUserId', newUserId);
    return newUserId;
  };
  
  const userId = getUserId();
  
  // 当关键状态变化时，保存到localStorage
  useEffect(() => {
    const stateToPersist: PersistentState = {
      isPanelOpen,
      fileId,
      conversationId,
      fileRowCount,
      rawFileData,
      data,
      processStatus,
      uploadStatus,
      showDownloadLinks,
      downloadLink,
      difyDownloadLink,
      hasError
    };
    
    try {
      localStorage.setItem('tableAgentState', JSON.stringify(stateToPersist));
    } catch (error) {
      console.error('Failed to save state to localStorage:', error);
    }
  }, [isPanelOpen, fileId, conversationId, fileRowCount, rawFileData, data, processStatus, uploadStatus, showDownloadLinks, downloadLink, difyDownloadLink, hasError]);
  
  // 重置所有状态和localStorage
  const resetAllState = () => {
    try {
      // 清除localStorage
      localStorage.removeItem('tableAgentState');
      localStorage.removeItem('tableAgentUserId');
      
      // 重置所有状态
      setIsPanelOpen(true);
      setFile(null);
      setData([]);
      setIsProcessing(false);
      setProgress(0);
      setProcessStatus('idle');
      setUploadStatus('idle');
      setFileId(null);
      setConversationId('');
      setFileRowCount(null);
      setRawFileData(null);
      setShowDownloadLinks(false);
      setDownloadLink(null);
      setDifyDownloadLink('');
      setHasError(false);
      
      // 清理文件输入
      const inputElement = document.getElementById('file-upload') as HTMLInputElement;
      if (inputElement) {
        inputElement.value = '';
      }
      
      console.log('All state has been reset');
    } catch (error) {
      console.error('Failed to reset state:', error);
    }
  };
  
  // Handling stats
  const startTimeRef = useRef<number>(0);

  // Handle drag and drop events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-500');
    e.currentTarget.classList.add('bg-blue-50');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500');
    e.currentTarget.classList.remove('bg-blue-50');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500');
    e.currentTarget.classList.remove('bg-blue-50');
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const inputElement = document.getElementById('file-upload') as HTMLInputElement;
      if (inputElement) {
        // Create a FileList with the dropped file
        const fileList = new DataTransfer();
        fileList.items.add(droppedFile);
        inputElement.files = fileList.files;
        // Trigger the change event
        inputElement.dispatchEvent(new Event('change'));
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setIsProcessing(true); // Temporarily block while uploading
    setProcessStatus('idle');
    setProgress(0);
    setUploadStatus('uploading');
    setFileRowCount(null); // 重置行数
    setData([]); // 清空之前的处理结果

    try {
      // 读取文件内容并计算行数
      const reader = new FileReader();
      await new Promise<void>((resolve, reject) => {
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // 使用sheet_to_json计算行数时，要注意：
            // - header: 1 返回二维数组，包含所有行
            // - range: undefined 处理整个工作表
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              header: 1, 
              range: undefined 
            });
            
            // 过滤掉空行
            const nonEmptyRows = jsonData.filter(row => 
              row.some(cell => cell !== null && cell !== undefined && cell !== '')
            );
            
            // 计算实际行数：显示包含表头的真实总行数
            const rowCount = nonEmptyRows.length;
              
            console.log(`文件行数统计: 总行数=${jsonData.length}, 非空行=${nonEmptyRows.length}, 实际行数=${rowCount}`);
            setFileRowCount(rowCount);
            
            // 保存原始文件内容预览
            setRawFileData(jsonData);
            resolve();
          } catch (error) {
            console.error("Error reading file:", error);
            // 读取失败时应该拒绝Promise，让外层try/catch处理错误
            reject(error); 
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(uploadedFile);
      });

      // Upload file to backend with timeout
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('userId', userId);

      const uploadPromise = fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      // 添加30秒超时
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('文件上传超时')), 30000)
      );

      const res = await Promise.race([uploadPromise, timeoutPromise]) as Response;

      const data = await res.json();
      if (data.status === 'success') {
        setFileId(data.file_id);
        setConversationId(data.conversation_id);
        setUploadStatus('success');
        console.log(`文件上传成功! File ID: ${data.file_id}, Conversation ID: ${data.conversation_id}`);
      } else {
        throw new Error(data.error || '文件上传失败');
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadStatus('error');
    } finally {
      // 确保在任何情况下都重置isProcessing状态
      setIsProcessing(false);
      // 清理文件输入，允许重新选择相同文件
      const inputElement = document.getElementById('file-upload') as HTMLInputElement;
      if (inputElement) {
        inputElement.value = '';
      }
    }
  };

  // Removed auto-start processing - now requires manual button click

  const runBatchProcessing = async () => {
    if (isProcessing || !fileId) return; // Prevent double trigger

    setIsProcessing(true);
    setProcessStatus('processing');
    setProgress(0);
    setHasError(false);
    
    // Record Start Time
    startTimeRef.current = Date.now();
    
    // 处理开始时清空原始文件预览，显示处理进度
    setRawFileData(null);

    try {
        // 使用Dify聊天接口处理文件
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: "请处理此文件，为每一行提供详细的分析结果。请确保返回格式为JSON数组，每个对象必须包含以下字段：id（行号）、original（原始内容）和processed（处理结果）。",
                user_id: userId,
                conversation_id: conversationId,
                file_id: fileId
            })
        });

        const data = await res.json();
        console.log("Dify聊天接口处理结果:", data);
        
        // 更新conversationId，如果API返回了新的
        if (data.conversation_id) {
          console.log(`更新conversationId: ${conversationId} -> ${data.conversation_id}`);
          setConversationId(data.conversation_id);
        }
        
        // 模拟处理进度
        for (let i = 0; i <= 100; i += 10) {
            await new Promise(resolve => setTimeout(resolve, 200));
            setProgress(i);
        }
        
        // 解析Dify返回的结果
        let processedData = [];
        
        if (data && data.reply) {
            // 记录Dify的原始回复内容
            console.log("Dify原始回复:", data.reply);
            
            // 检查是否包含下载链接
            const replyText = data.reply;
            
            // 尝试提取下载链接
            // 支持多种链接格式
            const linkRegex = /(?:href="|如果无法下载可以通过链接手动下载：\s+|\[output\.xlsx\]\()(https?:\/\/[^\s"\)]+\.xlsx[^"\)]*|\/[^\s"\)]+\.xlsx[^"\)]*)(?:"|\)|\s)/i;
            const match = replyText.match(linkRegex);
            
            let extractedDownloadLink = "";
            if (match && match[1]) {
                extractedDownloadLink = match[1];
                console.log("提取到的下载链接:", extractedDownloadLink);
                setDifyDownloadLink(extractedDownloadLink);
            } else {
                // 尝试更宽松的匹配
                const looseRegex = /(https?:\/\/[^\s]+\.xlsx\?[^\s]+|\/[^\s]+\.xlsx\?[^\s]+)/i;
                const looseMatch = replyText.match(looseRegex);
                if (looseMatch) {
                    extractedDownloadLink = looseMatch[0];
                    console.log("使用宽松匹配提取到的下载链接:", extractedDownloadLink);
                    setDifyDownloadLink(extractedDownloadLink);
                }
            }
            
            try {
                // 尝试解析Dify返回的JSON数组（如果它是JSON格式）
                const jsonResult = JSON.parse(replyText);
                if (Array.isArray(jsonResult)) {
                    // 如果是数组，创建表格数据
                    processedData = jsonResult.map((item, index) => ({
                        id: index + 1,
                        content: item.original || `行 ${index + 1}`,
                        instruction: "使用Dify分析内容",
                        result: item.processed || "无处理结果",
                        status: "completed" as const
                    }));
                    
                    // 如果找到了下载链接，将其添加到表格数据的最后一行
                    if (extractedDownloadLink) {
                        processedData.push({
                            id: processedData.length + 1,
                            content: "",
                            instruction: "下载链接",
                            result: extractedDownloadLink,
                            status: "completed" as const
                        });
                    }
                } else {
                    // 如果不是数组，创建单行数据
                    processedData = [{
                        id: 1,
                        content: file?.name || "已上传文件",
                        instruction: "使用Dify处理文件",
                        result: extractedDownloadLink || replyText,
                        status: "completed" as const
                    }];
                }
            } catch (jsonError) {
                // 如果不是JSON格式，创建单行数据
            processedData = [{
                id: 1,
                content: file?.name || "已上传文件",
                instruction: "使用Dify处理文件",
                result: extractedDownloadLink || replyText,
                status: "completed" as const
            }];
            }
        } else {
            // 默认情况
            processedData = [{
                id: 1,
                content: file?.name || "已上传文件",
                instruction: "使用Dify工作流处理文件",
                result: JSON.stringify(data),
                status: "completed" as const
            }];
        }
        
        // 设置处理后的数据
        setData(processedData);
        
       // 使用上传时计算的行数，保持数据一致性
        // 不再根据是否添加表头调整行数，避免显示不一致
        
        // Record End Time
        const endTime = Date.now();
        const durationMs = endTime - startTimeRef.current;
        
        setProcessStatus('completed');
        
        // 触发文件处理完成通知
        console.log('文件处理完成，尝试触发通知...');
        console.log('onFileProcessed是否存在:', typeof onFileProcessed);
        if (onFileProcessed) {
          console.log('调用onFileProcessed函数');
          onFileProcessed();
        } else {
          console.log('onFileProcessed函数不存在');
        }
        
        // Report Stats
        // 这里可以根据需要报告真实文件行数或处理的行数
        await reportTaskStats(fileRowCount || processedData.length, durationMs);
        
        // 获取系统统计数据
        const stats = await getSystemStats();
        console.log("系统统计数据:", stats);
    } catch (error) {
        console.error("文件处理错误:", error);
        setProcessStatus('completed');
        setHasError(true);
    } finally {
        setIsProcessing(false);
    }
  };

  // 测试下载链接是否有效的函数
  const testDownloadLink = async (url: string): Promise<boolean> => {
    try {
      // 使用HEAD请求测试链接，只获取 headers，不下载内容
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-cache',
        timeout: 5000 // 5秒超时
      });
      return response.ok;
    } catch (error) {
      console.error("下载链接测试失败:", error);
      return false;
    }
  };

  // 重新获取下载链接的函数
  const refreshDownloadLink = async () => {
    // 检查会话信息是否完整
    const isFileIdValid = fileId && fileId.trim() !== '';
    const isConversationIdValid = conversationId && conversationId.trim() !== '';
    
    if (!isFileIdValid || !isConversationIdValid) {
      console.log(`无法重新获取链接: fileId有效=${isFileIdValid}, conversationId有效=${isConversationIdValid}`);
      console.log(`当前值: fileId=${fileId}, conversationId=${conversationId}`);
      alert("无法重新获取链接，会话信息不完整\n请确保已成功上传并处理文件");
      return;
    }
    
    try {
      setIsProcessing(true);
      console.log("开始重新获取下载链接...");
      console.log("参数:", {
        query: "下载链接",
        user_id: userId,
        conversation_id: conversationId,
        file_id: fileId
      });
      
      // 重新调用Dify聊天接口获取最新的下载链接
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: "下载链接",
          user_id: userId,
          conversation_id: conversationId,
          file_id: fileId
        })
      });

      console.log("API响应状态:", res.status);
      console.log("API响应头:", Object.fromEntries(res.headers.entries()));
      
      const dataResult = await res.json();
      console.log("重新获取Dify聊天接口处理结果:", dataResult);
      
      if (dataResult && dataResult.reply) {
        // 记录Dify的原始回复内容
        console.log("Dify原始回复:", dataResult.reply);
        
        // 尝试提取下载链接 - 使用更健壮的正则表达式
        const replyText = dataResult.reply;
        
        // 先尝试精确匹配
        let linkRegex = /(?:href="|如果无法下载可以通过链接手动下载：\s+|\[output\.xlsx\]\()(https?:\/\/[^\s"\)]+\.xlsx[^"\)]*|\/[^\s"\)]+\.xlsx[^"\)]*)(?:"|\)|\s)/i;
        let match = replyText.match(linkRegex);
        
        // 如果精确匹配失败，尝试更宽松的匹配
        if (!match || !match[1]) {
          console.log("精确匹配失败，尝试宽松匹配");
          linkRegex = /(https?:\/\/[^\s"]*\.xlsx[^\s"]*|\/[^\s"]*\.xlsx[^\s"]*)/gi;
          match = replyText.match(linkRegex);
          if (match) {
            console.log("宽松匹配结果:", match);
          }
        }
        
        let extractedDownloadLink = "";
        if (match) {
          // 如果是数组匹配结果，取第一个
          extractedDownloadLink = Array.isArray(match) ? (match[1] || match[0]) : match;
          console.log("提取到的下载链接:", extractedDownloadLink);
          
          // 确保链接格式正确，移除可能的引号或括号
          extractedDownloadLink = extractedDownloadLink.replace(/^["\'\(]+|[\"\')]+$/g, '');
          
          // 检查是否是完整URL
          let finalUrl;
          if (extractedDownloadLink.startsWith('http://') || extractedDownloadLink.startsWith('https://')) {
            // 如果是完整URL，提取路径部分
            try {
              const url = new URL(extractedDownloadLink);
              // 使用后端代理地址 + 路径，确保通过代理下载
              finalUrl = `${url.pathname}${url.search}`;
              console.log("构建的最终链接:", finalUrl);
            } catch (urlError) {
              console.error("URL解析错误:", urlError);
              finalUrl = extractedDownloadLink;
            }
          } else {
            // 如果是相对路径，直接使用
            finalUrl = extractedDownloadLink;
            console.log("使用相对路径:", finalUrl);
          }
          
          // 更新下载链接状态
          setDifyDownloadLink(finalUrl);
          setDownloadLink(finalUrl);
          alert("下载链接已更新，请重新尝试下载");
        } else {
          console.log("未能从Dify响应中提取有效的下载链接");
          alert("未能从Dify响应中提取有效的下载链接\n请查看控制台日志了解详细信息");
          // 显示原始响应，帮助调试
          alert("Dify原始响应内容:\n" + replyText);
        }
      } else if (dataResult && dataResult.error) {
        console.error("API返回错误:", dataResult.error);
        alert(`获取链接失败: ${dataResult.error}`);
      } else {
        console.error("无效的API响应格式:", dataResult);
        alert("获取链接失败，无效的响应格式");
      }
    } catch (error) {
      console.error("重新获取下载链接失败:", error);
      alert(`重新获取下载链接失败: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (data.length === 0) return;

    // 优先使用difyDownloadLink状态变量中的下载链接
    let excelUrl = difyDownloadLink;
    
    // 如果difyDownloadLink为空，再尝试从最后一行结果中提取
    if (!excelUrl) {
      // 检查是否有Dify输出的Excel下载链接
      const lastRow = data[data.length - 1];
      const result = lastRow.result;
      
      console.log("最后一行结果:", result);
      
      // 更强大的正则表达式，匹配各种格式的Excel下载链接
      const excelLinkRegex = /(?:href="|如果无法下载可以通过链接手动下载：\s+|\[output\.xlsx\]\()(https?:\/\/[^\s"\)]+\.xlsx[^"\)]*|\/[^\s"\)]+\.xlsx[^"\)]*)(?:"|\)|\s)/gi;
      let matches;
      
      // 查找所有匹配的链接
      while ((matches = excelLinkRegex.exec(result)) !== null) {
        if (matches[1]) {
          excelUrl = matches[1];
          console.log("找到的链接:", excelUrl);
          break;
        }
      }
      
      // 额外检查：如果直接匹配失败，尝试更宽松的匹配
      if (!excelUrl) {
        const looseRegex = /(https?:\/\/[^\s]+\.xlsx\?[^\s]+|\/[^\s]+\.xlsx\?[^\s]+)/gi;
        const looseMatch = looseRegex.exec(result);
        if (looseMatch) {
          excelUrl = looseMatch[0];
          console.log("使用宽松匹配找到的链接:", excelUrl);
        }
      }
    }
    
    console.log("最终确定的Dify下载链接:", excelUrl);
    
    if (excelUrl) {
      try {
        // 确保链接格式正确，移除可能的引号或括号
        excelUrl = excelUrl.replace(/^["\'\(]+|[\"\')]+$/g, '');
        
        console.log("处理后的Excel链接:", excelUrl);
        
        // 检查是否是完整URL
        let finalUrl;
        if (excelUrl.startsWith('http://') || excelUrl.startsWith('https://')) {
          // 如果是完整URL，提取路径部分
          const url = new URL(excelUrl);
          // 使用后端代理地址 + 路径，确保通过代理下载
          finalUrl = `${url.pathname}${url.search}`;
        } else {
          // 如果是相对路径，使用后端代理地址 + 相对路径
          finalUrl = excelUrl;
        }
        
        console.log("最终下载链接:", finalUrl);
        
        // 保存下载链接到状态
        setDownloadLink(finalUrl);
        setDifyDownloadLink(finalUrl);
        
        // 添加超时处理的fetch请求
        const fetchWithTimeout = (url: string, options: RequestInit = {}, timeout = 30000) => {
          return Promise.race([
            fetch(url, options),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('下载超时')), timeout)
            )
          ]);
        };
        
        // 直接通过fetch下载文件内容，而不是通过链接打开
        const response = await fetchWithTimeout(finalUrl, {
          method: 'GET',
          cache: 'no-cache'
        });
        
        if (response.ok) {
          console.log("文件下载成功，开始生成Excel文件...");
          // 获取文件内容并创建Blob对象
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          
          // 创建a标签并模拟点击来直接下载文件
          const a = document.createElement('a');
          a.href = url;
          a.download = `Dify_Export_${new Date().getTime()}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          // 释放URL对象
          window.URL.revokeObjectURL(url);
          
          console.log("已直接下载Dify输出的Excel文件");
          return;
        } else {
          console.log("文件下载失败，状态码:", response.status);
          // 如果链接失效，询问用户是否要重新获取链接
          if (confirm(`下载链接已失效，是否重新获取链接？\n错误: HTTP状态 ${response.status}`)) {
            await refreshDownloadLink();
          } else {
            throw new Error(`文件下载失败，HTTP状态: ${response.status}`);
          }
        }
      } catch (error) {
        console.error("下载Dify输出的Excel文件时出错:", error);
        // 如果是超时或网络错误，提供重新获取链接的选项
        if (error instanceof Error && (error.message.includes('超时') || error.message.includes('NetworkError'))) {
          if (confirm(`下载链接可能已超时或失效，是否重新获取链接？\n错误: ${error.message}`)) {
            await refreshDownloadLink();
            return;
          }
        }
        alert(`下载Dify输出的Excel文件失败: ${error.message}\n将使用本地生成的Excel文件`);
        // 如果下载失败，回退到本地生成Excel
      }
    } else {
      console.log("未找到Excel链接，将使用本地生成的Excel文件");
    }
    
    // 如果没有找到Excel链接或运行失败，回退到本地生成Excel
    const exportData = [
      ['ID', '原始内容', '处理指令', 'AI处理结果', '状态'],
      ...data.map(row => [row.id, row.content, row.instruction, row.result, row.status])
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, "AI处理结果");
    XLSX.writeFile(wb, `GovFlow_Export_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="max-w-full mx-auto animate-in fade-in duration-500 h-[calc(100vh-140px)] flex gap-4 overflow-hidden">
      
      {/* Main Table Preview Area (Restored) */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-w-0">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <FileSpreadsheet className="text-blue-600" size={20}/>
              数据预览与处理
            </h3>
            <div className="text-sm text-slate-500">
              共 {(fileRowCount !== null ? fileRowCount : data.length)} 条数据
            </div>
          </div>
          
          <div className="flex-1 overflow-auto">
             {data.length === 0 ? (
                rawFileData ? (
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 shadow-sm">
                      <tr>
                        {rawFileData[0].map((cell: any, index: number) => (
                          <th key={index} className="px-4 py-3 border-b border-slate-200">
                            {cell || `列 ${index + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rawFileData.slice(1, Math.min(101, rawFileData.length)).map((row: any, rowIndex: number) => (
                        <tr key={rowIndex} className="hover:bg-slate-50 transition-colors">
                          {row.map((cell: any, cellIndex: number) => (
                            <td key={cellIndex} className="px-4 py-3 text-slate-700">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {rawFileData.length > 101 && (
                        <tr className="bg-slate-50">
                          <td colSpan={rawFileData[0].length} className="px-4 py-3 text-center text-slate-500 text-sm">
                            仅显示前100行...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <FileSpreadsheet size={48} className="mb-4 opacity-50" />
                    <p>暂无数据，请在右侧上传文件</p>
                  </div>
                )
             ) : (
                <table className="w-full text-sm text-left border-collapse">
                   <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-10 shadow-sm">
                      <tr>
                         <th className="px-4 py-3 border-b border-slate-200 w-16 text-center">ID</th>
                         <th className="px-4 py-3 border-b border-slate-200">文件名称</th>
                         <th className="px-4 py-3 border-b border-slate-200 w-24 text-center">状态</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {data.map((row) => (
                         <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-500 text-center">{row.id}</td>
                            <td className="px-4 py-3 text-slate-700 font-mono text-xs max-w-xs truncate" title={row.content}>{row.content}</td>
                            <td className="px-4 py-3 text-center">
                               {row.status === 'processing' && <Loader2 size={16} className="animate-spin text-blue-500 mx-auto" />}
                               {row.status === 'completed' && <CheckCircle size={16} className="text-emerald-500 mx-auto" />}
                               {row.status === 'error' && <span className="text-red-500 text-xs font-bold">失败</span>}
                               {row.status === 'pending' && <span className="w-2 h-2 bg-slate-300 rounded-full inline-block"></span>}
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             )}
          </div>
      </div>

      {/* Collapsible Batch Processing Panel */}
      <div className={`transition-all duration-300 flex flex-col ${isPanelOpen ? 'w-80' : 'w-12'} bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0`}>
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              {isPanelOpen && (
                  <div className="flex items-center gap-2 overflow-hidden">
                      <Upload size={16} className="text-emerald-600 flex-shrink-0" />
                      <span className="text-sm font-bold text-slate-700 whitespace-nowrap">批量操作</span>
                  </div>
              )}
              <button 
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
              >
                  {isPanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
          </div>

          {isPanelOpen && (
            <div className="flex-1 p-4 flex flex-col gap-6 overflow-y-auto">
                {/* Upload Section */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700 block">1. 上传文档</label>
                    <div 
                        className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center transition-colors bg-slate-50 relative group"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <input 
                            type="file" 
                            accept=".xlsx,.xls,.csv" 
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                            id="file-upload" 
                            disabled={isProcessing}
                        />
                        <div className="flex flex-col items-center gap-2 pointer-events-none group-hover:scale-105 transition-transform">
                            <Upload size={24} className={
                                uploadStatus === 'uploading' ? 'text-blue-500 animate-pulse' : 
                                uploadStatus === 'success' ? 'text-green-500' : 
                                uploadStatus === 'error' ? 'text-red-500' : 
                                'text-slate-400 group-hover:text-blue-500'
                            } />
                            <span className="text-xs text-slate-500 group-hover:text-slate-700">
                             {uploadStatus === 'uploading' ? "文件上传中..." : 
                              uploadStatus === 'success' ? `文件上传成功!${fileRowCount !== null ? ` (${fileRowCount} 行)` : ''}` : 
                              uploadStatus === 'error' ? "文件上传失败，请重试" : 
                              (file || fileId) ? `文件已选择${fileRowCount !== null ? ` (${fileRowCount} 行)` : ''}` : "点击或拖拽上传 Excel/CSV"}
                         </span>
                        </div>
                    </div>
                </div>

                {/* Start Processing Button */}
                {fileId && uploadStatus === 'success' && (
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700 block">2. 开始处理</label>
                        <button 
                            onClick={runBatchProcessing}
                            disabled={isProcessing || processStatus === 'processing'}
                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
                        >
                            {isProcessing || processStatus === 'processing' ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 size={16} className="animate-spin" />
                                    处理中...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center gap-2">
                                    <Play size={16} />
                                    开始运行
                                </span>
                            )}
                        </button>
                    </div>
                )}

                {/* Reset Button */}
                {(fileId || data.length > 0) && (
                    <div className="space-y-3">
                        <button 
                            onClick={resetAllState}
                            className="w-full py-2.5 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium text-sm"
                        >
                            重置状态
                        </button>
                    </div>
                )}
                
                {/* Status Section */}
                {(file || fileId) && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                         <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-slate-700">3.任务进度</label>
                            <span className="text-xs text-slate-500">
                              {processStatus === 'completed' ? 
                                (fileRowCount !== null ? fileRowCount : data.length) : 
                                (fileRowCount !== null ? `${fileRowCount} 行` : '处理中...')}
                            </span>
                         </div>
                         
                         {processStatus === 'processing' && (
                             <div className="space-y-2">
                                <div className="flex justify-between text-xs text-slate-500">
                                    <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> 处理中...</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div 
                                        className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                             </div>
                         )}

                         {processStatus === 'completed' && (
                             <div className={`p-3 rounded-lg text-center space-y-3 ${hasError ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                                 <div className={`flex items-center justify-center gap-2 font-medium text-sm ${hasError ? 'text-red-700' : 'text-emerald-700'}`}>
                                     {hasError ? (
                                         <>
                                             <AlertCircle size={16} /> 文档异常
                                         </>
                                     ) : (
                                         <>
                                             <CheckCircle size={16} /> 文件已处理完毕
                                         </>
                                     )}
                                 </div>
                                 <button 
                                    onClick={handleDownload}
                                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                                 >
                                    <Download size={14} /> 导出结果 Excel
                                 </button>
                                 <button 
                                    onClick={async () => {
                                      // 如果还没有下载链接，先尝试提取
                                      if (!downloadLink && data.length > 0) {
                                        const lastRow = data[data.length - 1];
                                        const result = lastRow.result;
                                        
                                        // 更强大的正则表达式，匹配各种格式的Excel下载链接
                                        const excelLinkRegex = /(?:href="|如果无法下载可以通过链接手动下载：\s+|\[output\.xlsx\]\()(https?:\/\/[^\s"\)]+\.xlsx[^"\)]*|\/[^\s"\)]+\.xlsx[^"\)]*)(?:"|\)|\s)/gi;
                                        let matches;
                                        let excelUrl = null;
                                        
                                        // 查找所有匹配的链接
                                        while ((matches = excelLinkRegex.exec(result)) !== null) {
                                          if (matches[1]) {
                                            excelUrl = matches[1];
                                            console.log("找到的链接:", excelUrl);
                                            break;
                                          }
                                        }
                                        
                                        // 额外检查：如果直接匹配失败，尝试更宽松的匹配
                                        if (!excelUrl) {
                                          const looseRegex = /(https?:\/\/[^\s]+\.xlsx\?[^\s]+|\/[^\s]+\.xlsx\?[^\s]+)/gi;
                                          const looseMatch = looseRegex.exec(result);
                                          if (looseMatch) {
                                            excelUrl = looseMatch[0];
                                            console.log("使用宽松匹配找到的链接:", excelUrl);
                                          }
                                        }
                                        
                                        if (excelUrl) {
                                          // 确保链接格式正确，移除可能的引号或括号
                                          excelUrl = excelUrl.replace(/^["\'\(]+|["\'\)]+$/g, '');
                                          
                                          // 检查是否是完整URL
                                          let finalUrl;
                                          if (excelUrl.startsWith('http://') || excelUrl.startsWith('https://')) {
                                            // 如果是完整URL，提取路径部分
                                            const url = new URL(excelUrl);
                                            // 使用后端代理地址 + 路径，确保通过代理下载
                                            finalUrl = `${url.pathname}${url.search}`;
                                          } else {
                                            // 如果是相对路径，使用后端代理地址 + 相对路径
                                            finalUrl = excelUrl;
                                          }
                                          
                                          setDownloadLink(finalUrl);
                                          // 如果是第一次提取链接，直接显示
                                          if (!showDownloadLinks) {
                                            setShowDownloadLinks(true);
                                          }
                                        } else {
                                          // 如果没有找到链接，也显示状态，让用户知道
                                          alert('未找到有效的Excel下载链接');
                                        }
                                      } else {
                                        // 如果已经有链接了，直接切换显示状态
                                        setShowDownloadLinks(!showDownloadLinks);
                                      }
                                    }}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                                 >
                                    <Play size={14} /> {showDownloadLinks ? '隐藏链接' : '查看下载链接'}
                                 </button>
                                 {showDownloadLinks && difyDownloadLink && fileId && fileId.trim() !== '' && conversationId && conversationId.trim() !== '' && (
                                     <div className="p-2 bg-white rounded-lg border border-slate-200 text-left">
                                         <div className="flex justify-between items-center mb-1">
                                             <p className="text-xs text-slate-500">下载链接：</p>
                                             <button
                                                 onClick={refreshDownloadLink}
                                                 disabled={isProcessing}
                                                 className="text-xs text-slate-500 hover:text-blue-600 transition-colors disabled:text-slate-300"
                                                 title="重新获取下载链接"
                                             >
                                                 🔄
                                             </button>
                                         </div>
                                         <a 
                                             href={downloadLink} 
                                             target="_blank" 
                                             rel="noopener noreferrer"
                                             className="text-xs text-blue-600 hover:underline break-all"
                                             // 添加onerror事件处理，但注意a标签的onerror事件不是标准事件
                                             // 这里使用onclick事件来处理可能的导航失败
                                             onClick={(e) => {
                                                 // 可以在这里添加点击跟踪，如果导航失败可以处理
                                                 console.log("点击下载链接:", downloadLink);
                                             }}
                                         >
                                             {difyDownloadLink}
                                         </a>
                                         <div className="text-xs text-slate-400 mt-1">
                                             链接可能会超时，如果无法下载请点击🔄按钮重新获取
                                         </div>
                                     </div>
                                 )}
                             </div>
                         )}
                    </div>
                )}
                
                <div className="mt-auto text-xs text-slate-400 text-center pt-4 border-t border-slate-100">
                   仅支持 .xlsx, .xls, .csv 格式
                </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default TableAgent;
