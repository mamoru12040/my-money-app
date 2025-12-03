import React, { useState, useEffect, useMemo } from 'react';
import { 
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  Wallet, TrendingUp, Landmark, History, Plus, Trash2, Save, Briefcase, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Tag, BadgePercent, LogOut, UserCircle, BrainCircuit
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
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

  // 監聽登入狀態
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Google 登入功能
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showNotification('success', '登入成功！');
    } catch (error) {
      console.error("Login failed:", error);
      showNotification('error', '登入失敗，請稍後再試');
    }
  };

  // 登出功能
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setRecords([]); 
      showNotification('success', '已登出');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // 讀取資料
  useEffect(() => {
    if (!user) return;
    setLoading(true);
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

  // AI 分析 - 暫時移除 UI，但保留函數以防未來需要
  const handleAiAnalysis = async () => {
    // 功能保留，介面已移除
  };

  // ★★★ 這裡就是設定載入背景圖片的地方 ★★★
  if (loading) {
    return (
      <div 
        className="fixed inset-0 z-50 bg-cover bg-center bg-no-repeat bg-white"
        style={{ 
          // 請確認 public 資料夾有名為 loading.jpg (或 loading.png) 的圖片
          backgroundImage: "url('/loading.jpg')" 
        }}
      >
        {/* 如果你希望圖片載入前背景不是白色，可以修改上面的 bg-white */}
      </div>
    );
  }

  // ★★★ 如果沒有登入，顯示登入畫面 ★★★
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-100 max-w-sm w-full text-center space-y-6">
          <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">資產成長追蹤</h1>
            <p className="text-slate-500 mt-2">請登入以開始記錄您的財富</p>
          </div>
          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-3 shadow-sm"
          >
            {/* Google Logo */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            使用 Google 帳號登入
          </button>
          <p className="text-xs text-slate-400">
            登入後資料將自動同步至雲端，換手機也不怕遺失。
          </p>
        </div>
      </div>
    );
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
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            {/* 顯示使用者資訊與登出按鈕 */}
            <div className={`flex items-center gap-3 px-4 py-2 rounded-xl shadow-sm border mr-auto sm:mr-0 w-full sm:w-auto justify-between sm:justify-start ${
              user.isAnonymous ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                {user.isAnonymous ? (
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                    <UserCircle className="w-5 h-5" />
                  </div>
                ) : user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                
                <div className="flex flex-col">
                   <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate">
                     {user.isAnonymous ? '目前是訪客' : (user.displayName || user.email)}
                   </span>
                   {user.isAnonymous && <span className="text-[10px] text-orange-600 font-bold">資料僅存本機 (未同步)</span>}
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                  user.isAnonymous 
                  ? 'bg-orange-500 text-white hover:bg-orange-600' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-red-600'
                }`}
              >
                {user.isAnonymous ? '切換帳號' : '登出'}
                <LogOut className="w-3 h-3" />
              </button>
            </div>
            
            <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-slate-200 flex items-center gap-3 w-full sm:w-auto">
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