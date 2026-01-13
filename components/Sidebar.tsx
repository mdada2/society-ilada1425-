
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, IndianRupee, FileText, Settings, LogOut, X, Calculator, Handshake, Receipt, ShoppingBag, Cloud, CloudOff, AlertTriangle, RefreshCw, Loader2, Landmark, Truck, Package } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { logout, isCloudSynced, isSyncing, cloudPermissionError, syncToCloud } = useApp();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/members', label: 'Members', icon: <Users size={20} /> },
    { path: '/transactions', label: 'Daily Transactions', icon: <IndianRupee size={20} /> },
    { path: '/expenses', label: 'Expense Manager', icon: <Receipt size={20} /> },
    { path: '/bank-audit', label: 'Bank & Audit', icon: <Landmark size={20} /> },
    { path: '/meetings', label: 'Meetings & Resolutions', icon: <Handshake size={20} /> },
    { path: '/paddy-purchase', label: 'Paddy Purchase', icon: <ShoppingBag size={20} /> },
    { path: '/dispatch', label: 'Dispatch', icon: <Truck size={20} /> },
    { path: '/inventory-entry', label: 'Inventory Entry', icon: <Package size={20} /> },
    { path: '/reports', label: 'Reports', icon: <FileText size={20} /> },
    { path: '/loan-calculator', label: 'Loan Calculator', icon: <Calculator size={20} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <div className={`w-64 bg-slate-900 dark:bg-slate-950 text-white h-screen flex flex-col fixed left-0 top-0 z-[70] border-r border-slate-700 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">Society Ilada</h1>
            <p className="text-xs text-slate-400 mt-1">Management System</p>
          </div>
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white"><X size={24} /></button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${location.pathname === item.path ? 'bg-blue-700 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Cloud Sync Status */}
        <div className="px-6 py-4 border-t border-slate-700">
          {cloudPermissionError ? (
            <Link
              to="/settings"
              onClick={onClose}
              className="flex flex-col gap-1 p-2 rounded bg-red-900/40 border border-red-500/50 group hover:bg-red-800/50 transition"
            >
              <span className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-red-400">
                <AlertTriangle size={14} className="animate-pulse" /> Rules Error
              </span>
              <span className="text-[9px] text-red-200">Click to fix Firebase Rules</span>
            </Link>
          ) : (
            <div className={`flex flex-col gap-2 p-2 rounded ${isCloudSynced ? 'bg-green-900/20' : 'bg-slate-800/50'}`}>
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 text-[10px] uppercase font-black tracking-widest ${isCloudSynced ? 'text-green-400' : 'text-amber-400'}`}>
                  {isSyncing ? (
                    <><Loader2 size={12} className="animate-spin" /> Syncing...</>
                  ) : isCloudSynced ? (
                    <><Cloud size={12} /> Cloud Synced</>
                  ) : (
                    <><CloudOff size={12} /> Sync Pending</>
                  )}
                </span>
                {!isCloudSynced && !isSyncing && (
                  <button
                    onClick={(e) => { e.preventDefault(); syncToCloud(); }}
                    className="text-blue-400 hover:text-white transition"
                    title="Retry Sync"
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>
              {!isCloudSynced && !isSyncing && (
                <p className="text-[9px] text-slate-500">Wait or click refresh to sync</p>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700">
          <button onClick={logout} className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-400 hover:bg-slate-800 rounded-lg transition">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
