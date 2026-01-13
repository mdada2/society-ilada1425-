
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberDetails from './pages/MemberDetails';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import LoanCalculatorPage from './pages/LoanCalculatorPage';
import Meetings from './pages/Meetings';
import Expenses from './pages/Expenses';
import PaddyPurchase from './pages/PaddyPurchase';
import Dispatch from './pages/Dispatch';
import InventoryEntry from './pages/InventoryEntry';
import BankAudit from './pages/BankAudit';
import AIChatWidget from './components/AIChatWidget';
import { ShieldCheck, Menu, KeyRound, RotateCcw } from 'lucide-react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapacitorApp } from '@capacitor/app';

// Initialize Status Bar for Android
if (typeof window !== 'undefined' && (window as any).Capacitor) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => { });
  StatusBar.setBackgroundColor({ color: '#1e293b' }).catch(() => { });
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => { });
}

const LoginScreen = () => {
  const { login, updateSettings } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [masterCode, setMasterCode] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(pin)) {
      setError(false);
    } else {
      setError(true);
      setPin('');
    }
  };

  const handleResetPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (masterCode === 'ADMIN') {
      updateSettings({ securityPin: '1234' });
      alert('Success! Your PIN has been reset to default: 1234');
      setShowReset(false);
      setMasterCode('');
      setPin('');
    } else {
      alert('Invalid Master Code!');
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-4 rounded-full">
            <ShieldCheck size={48} className="text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Society Ilada Manager</h1>
        <p className="text-slate-400 text-center mb-8">Secure Login Required</p>

        {!showReset ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">Enter Security PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={4}
                className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-slate-600"
                placeholder="••••"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-center text-sm">Incorrect PIN.</p>}
            <button className="w-full bg-blue-600 py-3 rounded-lg font-bold hover:bg-blue-700 transition text-white">Unlock App</button>
            <button type="button" onClick={() => setShowReset(true)} className="w-full text-sm text-slate-400 hover:text-white mt-4 underline">Forgot PIN?</button>
          </form>
        ) : (
          <form onSubmit={handleResetPin} className="space-y-4 animate-fade-in">
            <div className="text-center mb-4">
              <div className="inline-block p-2 bg-amber-900/30 text-amber-500 rounded-full mb-2"><KeyRound size={24} /></div>
              <h3 className="text-lg font-bold text-amber-500">Reset Security PIN</h3>
              <p className="text-xs text-slate-400">Enter Master Code to reset PIN to '1234'</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">Master Code</label>
              <input type="text" value={masterCode} onChange={(e) => setMasterCode(e.target.value)} className="w-full p-3 bg-slate-900 border border-slate-600 rounded-lg text-center text-lg focus:ring-2 focus:ring-amber-500 outline-none text-white" placeholder="Enter Code" />
            </div>
            <button className="w-full bg-amber-600 py-3 rounded-lg font-bold hover:bg-amber-700 transition text-white flex justify-center items-center gap-2"><RotateCcw size={18} /> Reset PIN</button>
            <button type="button" onClick={() => setShowReset(false)} className="w-full text-sm text-slate-400 hover:text-white mt-2">Cancel</button>
          </form>
        )}
      </div>
    </div>
  );
};

const MainLayout = () => {
  const { isAuthenticated } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle Android hardware back button for step-by-step navigation
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      let listener: any;

      CapacitorApp.addListener('backButton', () => {
        const currentHash = window.location.hash;

        // Check if we're on the dashboard/home page
        if (currentHash === '#/' || currentHash === '' || currentHash === '#') {
          // Exit app if on dashboard
          CapacitorApp.exitApp();
        } else {
          // Step-by-step navigation using React Router
          navigate(-1);
        }
      }).then(handle => {
        listener = handle;
      });

      return () => {
        if (listener) listener.remove();
      };
    }
  }, [navigate]);

  if (!isAuthenticated) return <LoginScreen />;

  return (
    <div className="flex bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-200">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 md:ml-64 flex flex-col w-full transition-all duration-300 print:ml-0 print:w-full overflow-x-hidden md:pt-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6rem)' }}>
        <div className="md:hidden flex items-center justify-between bg-slate-900 text-white fixed top-0 left-0 right-0 z-50 shadow-md no-print h-24 px-4 w-full" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: '1rem' }}>
          <div className="font-bold text-lg text-blue-400">Society Ilada</div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition"><Menu size={24} /></button>
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/:id" element={<MemberDetails />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/bank-audit" element={<BankAudit />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/paddy-purchase" element={<PaddyPurchase />} />
          <Route path="/dispatch" element={<Dispatch />} />
          <Route path="/inventory-entry" element={<InventoryEntry />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:categoryId" element={<Reports />} />
          <Route path="/reports/:categoryId/:subTab" element={<Reports />} />
          <Route path="/loan-calculator" element={<LoanCalculatorPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <AIChatWidget />
    </div>
  );
};

const App = () => {
  return (
    <AppProvider>
      <HashRouter>
        <MainLayout />
      </HashRouter>
    </AppProvider>
  );
};

export default App;
