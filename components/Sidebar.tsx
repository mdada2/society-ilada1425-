
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, IndianRupee, FileText, Settings, LogOut, X, Calculator, Handshake, Receipt, ShoppingBag, Cloud, CloudOff, AlertTriangle, RefreshCw, Loader2, Landmark, Truck, Package, Wrench } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { logout, isCloudSynced, isSyncing, cloudPermissionError, syncToCloud } = useApp();
  const location = useLocation();

  const mainNavItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={22} />, shortLabel: 'Home' },
    { path: '/members', label: 'Members', icon: <Users size={22} />, shortLabel: 'Members' },
    { path: '/transactions', label: 'Transactions', icon: <IndianRupee size={22} />, shortLabel: 'Money' },
    { path: '/reports', label: 'Reports', icon: <FileText size={22} />, shortLabel: 'Reports' },
    { path: '/tools', label: 'Tools', icon: <Wrench size={22} />, shortLabel: 'Tools' },
    { path: '/settings', label: 'Settings', icon: <Settings size={22} />, shortLabel: 'Settings' },
  ];

  const allNavItems = [
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
    { path: '/tools', label: 'Tools', icon: <Wrench size={20} /> },
    { path: '/settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <>
      {/* Mobile Bottom Tab Bar - iOS Style */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-bottom">
        <div className="ios-tabbar px-2 py-2">
          <div className="flex items-center justify-around">
            {mainNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center min-w-[60px] py-1 px-2 rounded-ios transition-all duration-200 ios-touch ${isActive ? 'text-ios-blue' : 'text-ios-gray-500 dark:text-ios-gray-400'
                    }`}
                >
                  <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>
                    {item.icon}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${isActive ? 'font-semibold' : ''}`}>
                    {item.shortLabel}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop Sidebar - iOS Style */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-[60] md:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <div className={`w-64 bg-ios-gray-950 dark:bg-black text-white h-screen flex flex-col fixed left-0 top-0 z-[70] border-r border-ios-gray-800 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`} style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="p-6 border-b border-ios-gray-800 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-ios-blue">Society Ilada</h1>
            <p className="text-xs text-ios-gray-400 mt-1">Management System</p>
          </div>
          <button onClick={onClose} className="md:hidden text-ios-gray-400 hover:text-white ios-touch">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-ios-lg transition-all duration-200 ios-touch ${isActive
                    ? 'bg-ios-blue text-white shadow-ios'
                    : 'text-ios-gray-300 hover:bg-ios-gray-900'
                  }`}
              >
                <div className={isActive ? 'scale-110' : 'scale-100'}>
                  {item.icon}
                </div>
                <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Cloud Sync Status */}
        <div className="px-4 py-3 border-t border-ios-gray-800">
          {cloudPermissionError ? (
            <Link
              to="/settings"
              onClick={onClose}
              className="flex flex-col gap-1 p-3 rounded-ios-lg bg-ios-red/20 border border-ios-red/50 group hover:bg-ios-red/30 transition ios-touch"
            >
              <span className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-ios-red">
                <AlertTriangle size={14} className="animate-pulse" /> Rules Error
              </span>
              <span className="text-[9px] text-ios-red/80">Click to fix Firebase Rules</span>
            </Link>
          ) : (
            <div className={`flex flex-col gap-2 p-3 rounded-ios-lg ${isCloudSynced ? 'bg-ios-green/10' : 'bg-ios-gray-900'}`}>
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider ${isCloudSynced ? 'text-ios-green' : 'text-ios-orange'}`}>
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
                    className="text-ios-blue hover:text-white transition ios-touch"
                    title="Retry Sync"
                  >
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>
              {!isCloudSynced && !isSyncing && (
                <p className="text-[9px] text-ios-gray-500">Wait or click refresh to sync</p>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-ios-gray-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-ios-red hover:bg-ios-gray-900 rounded-ios-lg transition ios-touch"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
