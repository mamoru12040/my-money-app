import React, { useState, useEffect, useMemo } from 'react';
import { 
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  Wallet, TrendingUp, Landmark, History, Plus, Trash2, Save, Briefcase, BrainCircuit, X, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Tag, BadgePercent
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
// ★★★ 修改處：User 前面加上 type ★★★
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously, 
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  Timestamp,
  query
} from 'firebase/firestore';

// ==========================================
// 你的 Firebase 設定
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyDhrj9kPDmEjnPDlTY8LG4fQScPk--OrAg",
  authDomain: "my-asset-tracker-f380e.firebaseapp.com",
  projectId: "my-asset-tracker-f380e",
  storageBucket: "my-asset-tracker-f380e.firebasestorage.app",
  messagingSenderId: "483429607334",
  appId: "1:483429607334:web:235cda2f40c32176f59167"
};
// ==========================================

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-asset-tracker"; 
const apiKey = ""; // 如果有 Gemini API Key 再填，沒有就留空

// 圖表顏色設定
const COLORS_CATEGORY = ['#3b82f6', '#10b981']; 
const COLORS_BANK = ['#0ea5e9', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#f97316', '#eab308', '#84cc16'];

// 資料型別定義
interface AssetRecord {
  id: string;
  date: any;
  createdAt?: any;
  bankName: string; 
  bank: number;
  stock: number;
  note: string;
}

interface Notification {
  type: 'success' | 'error';
  message: string;
}

// 格式化工具
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatNumber = (amount: number) => {
  return new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDateWithDay = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const day = days[date.getDay()];
  return `${yyyy}/${mm}/${dd}(${day})`;
};

const getYearMonthDay = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatAxisDate = (dateStr: string) => {
  if (!dateStr) return '';
  return dateStr.slice(0, 7);
};

// 主程式
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [records, setRecords] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [allocationView, setAllocationView] = useState<'category' | 'bank'>('category');
  const [aiAnalysis, setAiAnalysis] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputDate, setInputDate] = useState(new Date().toISOString().slice(0, 10));
  const [inputBankName, setInputBankName] = useState(''); 
  const [inputBank, setInputBank] = useState('');
  const [inputStock, setInputStock] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 自動登入
  useEffect(() => {
    const attemptSignIn = async (retries = 3, delay = 1000) => {
      try {
        await signInAnonymously(auth);
      } catch (error: any) {
        if (retries > 0) {
          console.warn(`Auth failed, retrying in ${delay}ms...`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptSignIn(retries - 1, delay * 2);
        } else {
          console.error("All auth attempts failed:", error);
          setLoading(false);
        }
      }
    };
    attemptSignIn();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 讀取資料
  useEffect(() => {
    if (!user) return;
    const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'asset_records');
    const q = query(recordsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AssetRecord[];
      setRecords(fetchedRecords);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching records:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 資料處理與排序
  const sortedRecordsForChart = useMemo(() => {
    return [...records].sort((a, b) => {
      const dateA = a.date?.seconds || 0;
      const dateB = b.date?.seconds || 0;
      if (dateA !== dateB) return dateA - dateB;
      const createdA = a.createdAt?.seconds || 0;
      const createdB = b.createdAt?.seconds || 0;
      return createdA - createdB;
    });
  }, [records]);

  const sortedRecordsForTable = useMemo(() => {
    return [...records].sort((a, b) => {
      const dateA = a.date?.seconds || 0;
      const dateB = b.date?.seconds || 0;
      if (dateA !== dateB) return dateB - dateA;
      const createdA = a.createdAt?.seconds || 0;
      const createdB = b.createdAt?.seconds || 0;
      if (createdA !== createdB) return createdB - createdA;
      return b.id.localeCompare(a.id);
    });
  }, [records]);

  const suggestedBankNames = useMemo(() => {
    const names = new Set(
      records.map(r => r.bankName).filter(n => n && n.trim() !== '')
    );
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [records]);

  const aggregatedChartData = useMemo(() => {
    if (sortedRecordsForChart.length === 0) return [];
    const groupedMap = new Map<string, { bank: number; stock: number; dateTimestamp: any }>();

    sortedRecordsForChart.forEach(record => {
      const dateKey = getYearMonthDay(record.date);
      if (!groupedMap.has(dateKey)) {
        groupedMap.set(dateKey, { bank: 0, stock: 0, dateTimestamp: record.date });
      }
      const current = groupedMap.get(dateKey)!;
      current.bank += record.bank;
      current.stock += record.stock;
    });

    return Array.from(groupedMap.entries())
      .map(([dateKey, data]) => ({
        name: dateKey,
        銀行: data.bank,
        股票: data.stock,
        總資產: data.bank + data.stock,
        fullDate: data.dateTimestamp.toDate()
      }))
      .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
  }, [sortedRecordsForChart]);

  const latestStats = useMemo(() => {
    if (aggregatedChartData.length === 0) return { bank: 0, stock: 0, total: 0, records: [] };
    const lastPoint = aggregatedChartData[aggregatedChartData.length - 1];
    const sameDayRecords = sortedRecordsForChart.filter(r => 
      getYearMonthDay(r.date) === lastPoint.name
    );
    return {
      bank: lastPoint.銀行,
      stock: lastPoint.股票,
      total: lastPoint.總資產,
      records: sameDayRecords
    };
  }, [aggregatedChartData, sortedRecordsForChart]);

  const pieDataCategory = useMemo(() => {
    if (latestStats.total === 0) return [];
    return [
      { name: '銀行存款', value: latestStats.bank, color: COLORS_CATEGORY[0] },
      { name: '股票投資', value: latestStats.stock, color: COLORS_CATEGORY[1] },
    ].filter(item => item.value > 0);
  }, [latestStats]);

  const pieDataBank = useMemo(() => {
    if (latestStats.total === 0) return [];
    const bankMap = new Map<string, number>();
    latestStats.records.forEach(r => {
      const name = r.bankName && r.bankName.trim() !== '' ? r.bankName : '未分類銀行';
      const totalValue = r.bank + r.stock;
      if (totalValue > 0) {
        bankMap.set(name, (bankMap.get(name) || 0) + totalValue);
      }
    });
    const data = Array.from(bankMap.entries()).map(([name, value], index) => ({
      name,
      value,
      color: COLORS_BANK[index % COLORS_BANK.length]
    }));
    return data.sort((a, b) => b.value - a.value);
  }, [latestStats]);

  // 分頁設定
  const totalPages = Math.ceil(sortedRecordsForTable.length / itemsPerPage);
  const currentTableData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedRecordsForTable.slice(start, start + itemsPerPage);
  }, [sortedRecordsForTable, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [records.length, totalPages]);

  // 通知工具
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // 新增紀錄
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (inputBank === '' || inputStock === '') {
      showNotification('error', '請輸入金額');
      return;
    }
    setIsSubmitting(true);
    try {
      const newRecord = {
        date: Timestamp.fromDate(new Date(inputDate)),
        createdAt: Timestamp.now(),
        bankName: inputBankName,
        bank: Number(inputBank),
        stock: Number(inputStock),
        note: inputNote
      };
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'asset_records'), newRecord);
      setInputBankName('');
      setInputBank('');
      setInputStock('');
      setInputNote('');
      setCurrentPage(1);
      showNotification('success', '紀錄已新增');
    } catch (error) {
      console.error("Error adding document: ", error);
      showNotification('error', '儲存失敗，請檢查網路');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除紀錄
  const handleConfirmDelete = async () => {
    if (!user || !deletingId) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'asset_records', deletingId));
      showNotification('success', '紀錄已刪除');
    } catch (error) {
      console.error("Error deleting document: ", error);
      showNotification('error', '刪除失敗');
    } finally {
      setDeletingId(null);
    }
  };

  // AI 分析
  const handleAiAnalysis = async () => {
    if (aggregatedChartData.length < 2) {
      showNotification('error', '請至少輸入兩筆紀錄');
      return;
    }
    if (!apiKey) {
      showNotification('error', '未設定 Gemini API Key');
      setAiAnalysis("請在程式碼中填入您的 Google Gemini API Key 才能使用此功能。");
      return;
    }
    setIsAnalyzing(true);
    setAiAnalysis(""); 
    try {
      const dataSummary = aggregatedChartData.slice(-6).map(r => ({
        date: r.name,
        bank: r.銀行,
        stock: r.股票,
        total: r.總資產,
      }));
      const systemPrompt = `你是一位專業的個人理財顧問... (下略)`;
      const userPrompt = `這是我的最近資產紀錄：${JSON.stringify(dataSummary)}`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
          }),
        }
      );
      if (!response.ok) throw new Error('AI API Error');
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "無法產生分析結果。";
      setAiAnalysis(text);
    } catch (error) {
      console.error("AI Analysis failed:", error);
      showNotification('error', 'AI 分析失敗');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-500">
      載入資產數據中... (若卡住請檢查 Firebase 設定)
    </div>;
  }

  const activePieData = allocationView === 'category' ? pieDataCategory : pieDataBank;
  const activeTotal = latestStats.total; 

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-800 relative">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-down ${
          notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-xl font-bold text-slate-900 mb-2">確定要刪除嗎？</h3>
            <p className="text-slate-500 mb-6">這筆紀錄將會永久移除，無法復原。</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors">取消</button>
              <button onClick={handleConfirmDelete} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors">確認刪除</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-emerald-600" />
              資產成長追蹤
            </h1>
            <p className="text-slate-500 mt-1">長期記錄您的財富累積 (銀行 + 股票)</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
             <button
              onClick={handleAiAnalysis}
              disabled={isAnalyzing || aggregatedChartData.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl shadow-sm border border-transparent flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
              {isAnalyzing ? '分析中...' : 'AI 資產分析'}
            </button>
            <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-full">
                <Wallet className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">目前總資產</p>
                <p className="text-2xl font-bold text-slate-900">{formatCurrency(latestStats.total)}</p>
              </div>
            </div>
          </div>
        </header>

        {aiAnalysis && (
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100 animate-fade-in relative">
            <button onClick={() => setAiAnalysis("")} className="absolute top-4 right-4 text-indigo-300 hover:text-indigo-600 transition-colors"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold text-indigo-900 mb-3 flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-indigo-600" /> AI 理財顧問分析</h3>
            <div className="text-indigo-800 leading-relaxed whitespace-pre-line text-sm md:text-base">{aiAnalysis}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-2 text-slate-500"><Landmark className="w-4 h-4" /><span className="text-sm font-medium">銀行存款</span></div>
                <p className="text-xl font-bold text-blue-600">{formatCurrency(latestStats.bank)}</p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-2 text-slate-500"><Briefcase className="w-4 h-4" /><span className="text-sm font-medium">股票市值</span></div>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(latestStats.stock)}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><BadgePercent className="w-5 h-5 text-slate-400" />資產配置</h3>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setAllocationView('category')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${allocationView === 'category' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>資產類別</button>
                  <button onClick={() => setAllocationView('bank')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${allocationView === 'bank' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>銀行分佈</button>
                </div>
              </div>
              {activeTotal > 0 && activePieData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="h-40 w-full sm:w-1/2 flex justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={activePieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={5} dataKey="value">
                          {activePieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`${formatCurrency(value)} (${((value / activeTotal) * 100).toFixed(1)}%)`,]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full sm:w-1/2 space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {activePieData.map((entry, index) => {
                      const percentage = ((entry.value / activeTotal) * 100).toFixed(1);
                      return (
                        <div key={`legend-${index}`} className="flex flex-col border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} /><span className="truncate">{entry.name}</span></div>
                            <span>{percentage}%</span>
                          </div>
                          <div className="pl-4.5 text-sm text-slate-500 font-medium">{formatCurrency(entry.value)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 text-sm h-48">
                  <p>尚無足夠數據</p>
                  {allocationView === 'bank' && <span className="text-xs opacity-75">請確認是否有輸入銀行存款或股票</span>}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-600" />新增紀錄</h3>
              <form onSubmit={handleAddRecord} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">日期</label>
                  <input type="date" required value={inputDate} onChange={(e) => setInputDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                </div>
                {suggestedBankNames.length > 0 && (
                  <div className="animate-fade-in">
                    <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" />快速選擇銀行名稱：</p>
                    <div className="flex flex-wrap gap-2">
                      {suggestedBankNames.map(name => (
                        <button key={name} type="button" onClick={() => setInputBankName(name)} className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 hover:text-slate-900 text-slate-600 rounded-md transition-colors border border-slate-200">{name}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">銀行名稱</label>
                  <input type="text" placeholder="例如：中國信託、國泰世華..." value={inputBankName} onChange={(e) => setInputBankName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">銀行存款</label>
                    <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" required min="0" placeholder="0" value={inputBank} onChange={(e) => setInputBank(e.target.value)} className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" /></div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">股票市值</label>
                    <div className="relative"><span className="absolute left-3 top-2.5 text-slate-400">$</span><input type="number" required min="0" placeholder="0" value={inputStock} onChange={(e) => setInputStock(e.target.value)} className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" /></div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">備註 (選填)</label>
                  <input type="text" placeholder="例：領年終獎金、股票配息..." value={inputNote} onChange={(e) => setInputNote(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {isSubmitting ? '儲存中...' : <><Save className="w-4 h-4" />儲存紀錄</>}
                </button>
              </form>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-600" />資產成長趨勢</h3>
              <div className="h-72 w-full">
                {aggregatedChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={aggregatedChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs><linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#eab308" stopOpacity={0.1}/><stop offset="95%" stopColor="#eab308" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" tick={{fontSize: 12}} tickFormatter={formatAxisDate} />
                      <YAxis stroke="#64748b" tick={{fontSize: 12}} tickFormatter={(val) => `${val/10000}萬`} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => formatAxisDate(label)} />
                      <Area type="monotone" dataKey="總資產" stroke="#eab308" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                      <Line type="monotone" dataKey="銀行" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="股票" stroke="#10b981" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200"><TrendingUp className="w-10 h-10 mb-2 opacity-50" /><p>尚未有足夠數據顯示圖表</p></div>
                )}
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm text-slate-600">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500"></span>總資產</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span>銀行存款</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span>股票市值</div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><History className="w-5 h-5 text-slate-400" />歷史紀錄</h3>
                <span className="text-sm text-slate-400">共 {sortedRecordsForTable.length} 筆資料</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                    <tr><th className="px-6 py-4">日期</th><th className="px-6 py-4">銀行名稱</th><th className="px-6 py-4 text-right">存款</th><th className="px-6 py-4 text-right">股票</th><th className="px-6 py-4 text-right text-emerald-700">資產</th><th className="px-6 py-4">備註</th><th className="px-6 py-4 text-right">刪除</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentTableData.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{formatDateWithDay(record.date)}</td>
                        <td className="px-6 py-4 text-slate-600">{record.bankName || '-'}</td>
                        <td className="px-6 py-4 text-right text-slate-600">{formatNumber(record.bank)}</td>
                        <td className="px-6 py-4 text-right text-slate-600">{formatNumber(record.stock)}</td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatNumber(record.bank + record.stock)}</td>
                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{record.note || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setDeletingId(record.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="刪除"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                    {sortedRecordsForTable.length === 0 && (<tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">目前還沒有紀錄，請從左側新增第一筆資產數據。</td></tr>)}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 flex items-center justify-center gap-2">
                  <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === page ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{page}</button>
                  ))}
                  <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}