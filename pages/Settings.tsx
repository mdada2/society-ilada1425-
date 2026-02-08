import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useDialog } from '../context/DialogContext';
import { Lock, Moon, Sun, Monitor, Download, HardDrive, CalendarRange, Loader2, Check, AlertTriangle, AlertCircle, Copy, CloudDownload, RefreshCw, Sliders, Bot, ToggleLeft, ToggleRight, Smartphone, Cloud, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { ThemeMode } from '../types';
import { format } from 'date-fns';
import { downloadBlob } from '../utils/downloadUtils';
import { useGoogleDrive } from '../utils/googleDrive';

const Settings = () => {
    const { settings, localSettings, updateSettings, updateLocalSettings, restoreFromCloud, cloudPermissionError } = useApp();
    const { showConfirm } = useDialog();
    const [newPin, setNewPin] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRestoringCloud, setIsRestoringCloud] = useState(false);
    const [editingProvider, setEditingProvider] = useState<string | null>(null);

    // Google Drive Hook
    const { isInitialized, accessToken, user: googleUser, login: googleLogin, logout: googleLogout, uploadFile, findFile, downloadFile, error: googleError } = useGoogleDrive();
    const [isBackingUpDrive, setIsBackingUpDrive] = useState(false);
    const [isRestoringDrive, setIsRestoringDrive] = useState(false);
    const [driveStatus, setDriveStatus] = useState<string | null>(null);

    const handleUpdatePin = () => {
        if (newPin.length < 4) return alert("PIN must be at least 4 digits");
        updateSettings({ securityPin: newPin });
        alert("Security PIN Updated Successfully");
        setNewPin('');
    };

    const changeTheme = (theme: ThemeMode) => {
        updateLocalSettings({ theme });
    };

    const handleFYUpdate = (field: 'start' | 'end', value: string) => {
        if (field === 'start') updateSettings({ financialYearStart: value });
        else updateSettings({ financialYearEnd: value });
    };

    const toggleAutoBackup = () => {
        updateSettings({ autoBackupOnLogout: !settings.autoBackupOnLogout });
    };

    const toggleAI = () => {
        updateLocalSettings({ enableAI: !localSettings.enableAI });
    };

    const handleDownloadBackup = () => {
        setIsLoading(true);
        setTimeout(() => {
            let membersData = [];
            let transactionsData = [];
            let meetingsData = [];
            let paddyData = [];
            try {
                const storedMembers = localStorage.getItem('members');
                const storedTrans = localStorage.getItem('transactions');
                const storedMeetings = localStorage.getItem('meetings');
                const storedPaddy = localStorage.getItem('paddyPurchases');
                if (storedMembers) membersData = JSON.parse(storedMembers);
                if (storedTrans) transactionsData = JSON.parse(storedTrans);
                if (storedMeetings) meetingsData = JSON.parse(storedMeetings);
                if (storedPaddy) paddyData = JSON.parse(storedPaddy);
            } catch (e) { console.error(e); }
            const timestamp = Date.now();
            const backupData = {
                members: membersData,
                transactions: transactionsData,
                meetings: meetingsData,
                paddyPurchases: paddyData,
                settings: { ...settings, lastBackupDate: timestamp },
                timestamp: timestamp, version: "1.0"
            };
            const fileName = `Society_Ilada_Backup_${format(new Date(), 'dd-MM-yyyy')}.json`;
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
            downloadBlob(blob, fileName);
            updateSettings({ lastBackupDate: timestamp });
            setIsLoading(false);
        }, 1000);
    };

    const handleCloudRestore = async () => {
        const confirmed = await showConfirm({
            title: 'Restore from Cloud?',
            titleMr: 'Cloud वरून पुनर्संचयित करा?',
            message: 'Current data will be REPLACED. This action cannot be undone.',
            messageMr: 'सध्याचा डेटा बदलला जाईल. ही क्रिया पूर्ववत करता येणार नाही.',
            icon: '☁️',
            confirmText: 'Restore',
            confirmTextMr: 'पुनर्संचयित करा',
            confirmColor: 'amber'
        });

        if (confirmed) {
            setIsRestoringCloud(true); setIsLoading(true);
            const success = await restoreFromCloud();
            if (success) { alert("Restore Successful!"); window.location.reload(); }
            else { setIsRestoringCloud(false); setIsLoading(false); }
        }
    };

    const getFullBackupData = () => {
        let membersData = [];
        let transactionsData = [];
        let meetingsData = [];
        let paddyData = [];
        try {
            const storedMembers = localStorage.getItem('members');
            const storedTrans = localStorage.getItem('transactions');
            const storedMeetings = localStorage.getItem('meetings');
            const storedPaddy = localStorage.getItem('paddyPurchases');
            if (storedMembers) membersData = JSON.parse(storedMembers);
            if (storedTrans) transactionsData = JSON.parse(storedTrans);
            if (storedMeetings) meetingsData = JSON.parse(storedMeetings);
            if (storedPaddy) paddyData = JSON.parse(storedPaddy);
        } catch (e) { console.error(e); }

        return {
            members: membersData,
            transactions: transactionsData,
            meetings: meetingsData,
            paddyPurchases: paddyData,
            settings: { ...settings, lastBackupDate: Date.now() },
            timestamp: Date.now(),
            version: "1.0",
            appName: "Society Ilada Manager"
        };
    };

    const handleGoogleDriveBackup = async () => {
        if (!accessToken) {
            alert("Please sign in with Google first.");
            return;
        }
        setIsBackingUpDrive(true);
        setDriveStatus("Preparing Data...");

        try {
            const data = getFullBackupData();
            const fileName = "society_ilada_backup.json";

            setDriveStatus("Uploading to Drive...");
            const success = await uploadFile(data, fileName);

            if (success) {
                const timestamp = format(new Date(), 'dd-MM-yyyy HH:mm a');
                setDriveStatus(timestamp);
                alert("Backup uploaded to Google Drive successfully!");
            } else {
                setDriveStatus("Configuration Required");
                setTimeout(() => setDriveStatus(null), 8000);
                alert(
                    "⚠️ Google Drive Backup Not Configured\n\n" +
                    "Google Drive API needs to be set up in Google Cloud Console.\n\n" +
                    "✅ Recommended: Use 'Cloud Sync' instead - it's already working perfectly!\n\n" +
                    "Or use 'Download JSON Backup' for manual backups."
                );
            }
        } catch (e) {
            console.error(e);
            setDriveStatus("Configuration Required");
            setTimeout(() => setDriveStatus(null), 8000);
            alert(
                "⚠️ Google Drive Backup Not Configured\n\n" +
                "Google Drive API needs to be set up in Google Cloud Console.\n\n" +
                "✅ Recommended: Use 'Cloud Sync' instead - it's already working perfectly!\n\n" +
                "Or use 'Download JSON Backup' for manual backups."
            );
        } finally {
            setIsBackingUpDrive(false);
        }
    };

    const handleGoogleDriveRestore = async () => {
        if (!accessToken) {
            alert("Please sign in with Google first.");
            return;
        }

        if (!window.confirm("This will OVERWRITE all current data with the backup from Google Drive. Are you sure?")) {
            return;
        }

        setIsRestoringDrive(true);
        setDriveStatus("Searching for backup...");

        try {
            const fileName = "society_ilada_backup.json";
            const fileId = await findFile(fileName);

            if (!fileId) {
                alert("No backup file found in Google Drive.");
                setDriveStatus("No backup found");
                setIsRestoringDrive(false);
                return;
            }

            setDriveStatus("Downloading Backup...");
            const data = await downloadFile(fileId);

            if (data) {
                setDriveStatus("Restoring Data...");
                // Saving to LocalStorage
                if (data.members) localStorage.setItem('members', JSON.stringify(data.members));
                if (data.transactions) localStorage.setItem('transactions', JSON.stringify(data.transactions));
                if (data.meetings) localStorage.setItem('meetings', JSON.stringify(data.meetings));
                if (data.paddyPurchases) localStorage.setItem('paddyPurchases', JSON.stringify(data.paddyPurchases));
                if (data.settings) localStorage.setItem('settings', JSON.stringify(data.settings));

                alert("Data restored successfully! The app will reload.");
                window.location.reload();
            } else {
                setDriveStatus("Download Failed");
                setTimeout(() => setDriveStatus(null), 8000);
                alert(
                    "⚠️ Failed to download backup content from Google Drive.\n\n" +
                    "This might be due to network issues or incorrect file permissions.\n\n" +
                    "Please try again or use 'Sync from Cloud' for a more reliable backup/restore."
                );
            }
        } catch (e) {
            console.error(e);
            setDriveStatus("Error during restore");
            setTimeout(() => setDriveStatus(null), 8000);
            alert(
                "⚠️ An error occurred during Google Drive restore.\n\n" +
                "This could be due to API configuration issues, network problems, or insufficient permissions.\n\n" +
                "Please ensure your Google Drive API is correctly set up or use 'Sync from Cloud' instead."
            );
        } finally {
            setIsRestoringDrive(false);
        }
    };

    const lastBackupStr = settings.lastBackupDate ? format(new Date(settings.lastBackupDate), 'dd-MM-yyyy HH:mm a') : 'Never';

    return (
        <div className="p-6 max-w-2xl mx-auto relative pb-24">
            {isLoading && !isRestoringCloud && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center animate-fade-in border border-slate-200 dark:border-slate-700">
                        <Loader2 className="w-16 h-16 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
                        <p className="text-xl font-bold text-slate-800 dark:text-white">Processing Data...</p>
                    </div>
                </div>
            )}

            <h2 className="text-2xl font-bold mb-8 text-slate-800 dark:text-white">Settings</h2>

            {cloudPermissionError && (
                <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-xl border-2 border-red-500 shadow-lg mb-8">
                    <div className="flex items-center gap-3 text-red-700 dark:text-red-400 mb-4">
                        <AlertTriangle size={28} />
                        <h3 className="text-lg font-black uppercase">Firebase Rules Error!</h3>
                    </div>
                    <p className="text-sm text-red-800 dark:text-red-300 mb-4 font-bold">Please update your Firestore rules to allow read/write.</p>
                    <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-xs relative overflow-x-auto">
                        <pre>{`allow read, write: if true;`}</pre>
                        <button onClick={() => { navigator.clipboard.writeText("allow read, write: if true;"); alert("Copied!"); }} className="absolute top-2 right-2 p-2 bg-slate-800 rounded text-slate-400"><Copy size={16} /></button>
                    </div>
                </div>
            )}

            {/* Local Visual Preferences (Does NOT Sync to Cloud) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700 mb-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                    <Monitor size={20} /> Device Settings (स्थानिक - Local)
                </h3>
                <p className="text-xs text-slate-500 mb-4 italic">या सेटिंग्ज फक्त याच मोबाईलमध्ये सेव्ह होतील. (Local only)</p>

                {/* AI Assistant Toggle moved here as requested */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${localSettings.enableAI ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'}`}>
                            <Bot size={24} />
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-white text-sm">Society Mitra (AI)</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">Enable or disable AI on this device.</p>
                        </div>
                    </div>
                    <button
                        onClick={toggleAI}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${localSettings.enableAI ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localSettings.enableAI ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                    <button onClick={() => changeTheme('light')} className={`p-3 rounded-lg border flex flex-col items-center gap-2 ${localSettings.theme === 'light' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-slate-700 dark:border-blue-400' : 'border-slate-200 dark:border-slate-600'}`}><Sun size={24} />Light</button>
                    <button onClick={() => changeTheme('dark')} className={`p-3 rounded-lg border flex flex-col items-center gap-2 ${localSettings.theme === 'dark' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-slate-700 dark:border-blue-400' : 'border-slate-200 dark:border-slate-600'}`}><Moon size={24} />Dark</button>
                    <button onClick={() => changeTheme('system')} className={`p-3 rounded-lg border flex flex-col items-center gap-2 ${localSettings.theme === 'system' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-slate-700 dark:border-blue-400' : 'border-slate-200 dark:border-slate-600'}`}><Monitor size={24} />System</button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Sliders size={14} /> AI Window Transparency ({localSettings.aiTransparency}%)
                        </label>
                        <input
                            type="range" min="10" max="100" step="5"
                            value={localSettings.aiTransparency}
                            onChange={e => updateLocalSettings({ aiTransparency: Number(e.target.value) })}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Glass Blur Strength</label>
                        <div className="flex flex-wrap gap-2">
                            {['none', 'sm', 'md', 'xl', '2xl'].map(lvl => (
                                <button
                                    key={lvl}
                                    onClick={() => updateLocalSettings({ aiBlurStrength: lvl as any })}
                                    className={`px-3 py-1 text-xs rounded-full border transition ${localSettings.aiBlurStrength === lvl ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}
                                >
                                    {lvl.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Syncable Settings */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700 mb-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                    <HardDrive size={20} /> Data Backup (Cloud Synced)
                </h3>
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-600">
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2"><Check size={16} className="text-green-600" />Last Local Success: <b>{lastBackupStr}</b></p>
                    <div className="flex items-center justify-between pt-3 border-t dark:border-slate-600">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${settings.autoBackupOnLogout ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>{settings.autoBackupOnLogout ? <Download size={20} /> : <AlertCircle size={20} />}</div>
                            <p className="font-bold text-slate-800 dark:text-white text-sm">Auto Backup on Logout</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={settings.autoBackupOnLogout || false} onChange={toggleAutoBackup} />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                        </label>
                    </div>
                </div>
                <button onClick={handleDownloadBackup} disabled={isLoading} className="w-full p-4 border dark:border-slate-600 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-left transition disabled:opacity-50 flex items-center justify-between">
                    <div className="flex items-center gap-3 font-bold text-blue-700 dark:text-blue-300"><Download size={24} /> Download JSON Backup</div>
                    <Download size={20} className="text-blue-400" />
                </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 mb-6 overflow-hidden relative p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><CloudDownload size={20} className="text-indigo-600" /> Sync from Cloud</h3>
                <button onClick={handleCloudRestore} disabled={isLoading} className={`w-full py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition flex items-center justify-center gap-3 ${isRestoringCloud ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                    {isRestoringCloud ? <RefreshCw size={24} className="animate-spin" /> : <CloudDownload size={24} />}
                    {isRestoringCloud ? 'Restoring...' : 'Restore From Cloud'}
                </button>
            </div>

            {/* Google Drive Backup Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700 mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Cloud size={100} />
                </div>

                <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-white relative z-10">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" alt="Drive" className="w-6 h-6" />
                    Google Account Backup
                </h3>

                {/* Account Status */}
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-6 border dark:border-slate-600 relative z-10">
                    {!accessToken ? (
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-slate-700 dark:text-slate-200">Not Connected</h4>
                                <p className="text-xs text-slate-500">Sign in to backup to Google Drive</p>
                            </div>
                            <button
                                onClick={googleLogin}
                                className="bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg font-bold text-sm shadow-sm hover:bg-slate-50 flex items-center gap-2 transition"
                            >
                                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
                                Add Account
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {googleUser?.picture ? (
                                    <img src={googleUser.picture} alt="Profile" className="w-10 h-10 rounded-full border-2 border-green-500" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                        {googleUser?.name?.charAt(0) || 'G'}
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{googleUser?.name || 'Google User'}</h4>
                                    <p className="text-xs text-slate-500">{googleUser?.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={googleLogout}
                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                                title="Sign Out"
                            >
                                <LogOut size={20} />
                            </button>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="space-y-3 relative z-10">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 mb-1">Last Backup: {driveStatus || "Checking..."}</p>
                            <button
                                onClick={handleGoogleDriveBackup}
                                disabled={!accessToken || isBackingUpDrive}
                                className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${!accessToken ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500' : 'bg-green-600 hover:bg-green-700 text-white shadow-md'}`}
                            >
                                {isBackingUpDrive ? <Loader2 size={18} className="animate-spin" /> : <Cloud size={18} />}
                                {isBackingUpDrive ? 'Backing Up...' : 'Back Up Now'}
                            </button>
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-slate-500 mb-1">Restore Data</p>
                            <button
                                onClick={handleGoogleDriveRestore}
                                disabled={!accessToken || isRestoringDrive}
                                className={`w-full py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition ${!accessToken ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500' : 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-white'}`}
                            >
                                {isRestoringDrive ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                {isRestoringDrive ? 'Restoring...' : 'Restore'}
                            </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
                        <Lock size={10} /> End-to-end encrypted on your device before upload
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700 mb-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><CalendarRange size={20} /> Current Financial Year</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="date" value={settings.financialYearStart} onChange={(e) => handleFYUpdate('start', e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                    <input type="date" value={settings.financialYearEnd} onChange={(e) => handleFYUpdate('end', e.target.value)} className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                </div>
            </div>

            {/* Loan Interest Policy Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800 dark:text-white">
                        <CalendarRange size={20} /> Loan Interest Policy (कर्ज व्याज धोरण)
                    </h3>

                    {/* Lock/Unlock Toggle */}
                    <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${settings.interestRatesLocked ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {settings.interestRatesLocked ? '🔒 Locked' : '🔓 Unlocked'}
                        </span>
                        <button
                            onClick={async () => {
                                if (!settings.interestRatesLocked) {
                                    // Locking - just lock it
                                    updateSettings({ interestRatesLocked: true });
                                } else {
                                    // Unlocking - require confirmation
                                    const confirmed = await showConfirm({
                                        title: 'Unlock Interest Rates?',
                                        titleMr: 'व्याज दर Unlock करायचे?',
                                        message: 'Changes will affect all future loan calculations.',
                                        messageMr: 'बदल केल्यास भविष्यातील सर्व कर्ज गणनेवर परिणाम होईल.',
                                        icon: '🔓',
                                        confirmText: 'Unlock',
                                        confirmTextMr: 'Unlock करा',
                                        confirmColor: 'amber'
                                    });
                                    if (confirmed) {
                                        updateSettings({ interestRatesLocked: false });
                                    }
                                }
                            }}
                            className={`px-4 py-2 rounded-lg font-bold transition-all shadow-sm flex items-center gap-2 ${settings.interestRatesLocked
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                                }`}
                        >
                            {settings.interestRatesLocked ? '🔓 Unlock' : '🔒 Lock'}
                        </button>
                    </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 italic">
                    💡 सदस्यांच्या कर्जावरील व्याज दर येथे सेट करा. बदल फक्त भविष्यातील गणनेवर लागू होतील.
                </p>

                {settings.interestRatesLocked && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400 text-xl">🔒</span>
                        <div>
                            <p className="text-sm font-bold text-red-700 dark:text-red-300">व्याज दर Lock आहेत</p>
                            <p className="text-xs text-red-600 dark:text-red-400">बदल करण्यासाठी वरील "Unlock" बटण दाबा</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* First Year Interest Rate */}
                    <div className={`p-4 rounded-lg border transition-all ${settings.interestRatesLocked
                        ? 'bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 opacity-60'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        }`}>
                        <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                            पहिल्या आर्थिक वर्षाचा व्याज दर (%)
                        </label>
                        <p className="text-[10px] text-slate-500 mb-2">First Financial Year Interest Rate</p>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            disabled={settings.interestRatesLocked}
                            value={settings.firstYearInterestRate ?? 6}
                            onChange={async (e) => {
                                const value = parseFloat(e.target.value);
                                if (value >= 0 && value <= 100) {
                                    const confirmed = await showConfirm({
                                        title: 'Change First Year Interest Rate?',
                                        titleMr: 'पहिल्या वर्षाचा व्याज दर बदलवायचा?',
                                        message: `Set first year interest rate to ${value}%? This will apply to future loans only.`,
                                        messageMr: `पहिल्या वर्षाचा व्याज दर ${value}% करायचा? हा बदल फक्त नवीन कर्जांवर लागू होईल.`,
                                        icon: '⚠️',
                                        confirmText: 'Change',
                                        confirmTextMr: 'बदला',
                                        confirmColor: 'blue'
                                    });
                                    if (confirmed) {
                                        updateSettings({ firstYearInterestRate: value });
                                    }
                                } else {
                                    alert('व्याज दर 0 ते 100% च्या दरम्यान असावा');
                                }
                            }}
                            className={`w-full p-2 border dark:border-slate-600 rounded text-center text-xl font-bold transition-all ${settings.interestRatesLocked
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
                                }`}
                        />
                        <p className="text-xs text-slate-500 mt-2 text-center">Default: 6%</p>
                    </div>

                    {/* Subsequent Years Interest Rate */}
                    <div className={`p-4 rounded-lg border transition-all ${settings.interestRatesLocked
                        ? 'bg-slate-100 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 opacity-60'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        }`}>
                        <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                            नंतरच्या वर्षांचा व्याज दर (%)
                        </label>
                        <p className="text-[10px] text-slate-500 mb-2">Subsequent Years Interest Rate</p>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            disabled={settings.interestRatesLocked}
                            value={settings.subsequentYearInterestRate ?? 12}
                            onChange={async (e) => {
                                const value = parseFloat(e.target.value);
                                if (value >= 0 && value <= 100) {
                                    const confirmed = await showConfirm({
                                        title: 'Change Subsequent Years Rate?',
                                        titleMr: 'नंतरच्या वर्षांचा व्याज दर बदलवायचा?',
                                        message: `Set subsequent years rate to ${value}%? This will apply to future loans only.`,
                                        messageMr: `नंतरच्या वर्षांचा व्याज दर ${value}% करायचा? हा बदल फक्त नवीन कर्जांवर लागू होईल.`,
                                        icon: '⚠️',
                                        confirmText: 'Change',
                                        confirmTextMr: 'बदला',
                                        confirmColor: 'blue'
                                    });
                                    if (confirmed) {
                                        updateSettings({ subsequentYearInterestRate: value });
                                    }
                                } else {
                                    alert('व्याज दर 0 ते 100% च्या दरम्यान असावा');
                                }
                            }}
                            className={`w-full p-2 border dark:border-slate-600 rounded text-center text-xl font-bold transition-all ${settings.interestRatesLocked
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white'
                                }`}
                        />
                        <p className="text-xs text-slate-500 mt-2 text-center">Default: 12%</p>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <AlertTriangle size={14} />
                        <span><strong>सूचना:</strong> व्याज दर बदलल्यास फक्त भविष्यातील गणनांवर परिणाम होईल. जुन्या व्याजाची पुनर्गणना होणार नाही.</span>
                    </p>
                </div>

                {/* Sync-on-Lock Info */}
                <div className={`mt-3 p-3 rounded-lg border flex items-start gap-2 ${settings.interestRatesLocked
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    }`}>
                    <span className="text-lg">{settings.interestRatesLocked ? '☁️' : '📱'}</span>
                    <div className="flex-1">
                        {settings.interestRatesLocked ? (
                            <>
                                <p className="text-sm font-bold text-green-700 dark:text-green-300">Cloud Sync सक्षम आहे</p>
                                <p className="text-xs text-green-600 dark:text-green-400">व्याज दर सर्व devices वर sync होतील</p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Local-Only मोड</p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">बदल फक्त या device वर राहतील. Lock केल्यावरच Cloud वर sync होतील.</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* AI Configuration Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700 mb-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><Bot size={20} /> Society Mitra AI Configuration</h3>

                {/* Provider Selection */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Select AI Provider</label>
                    <select
                        value={settings.selectedAiProvider || 'gemini'}
                        onChange={e => updateSettings({ selectedAiProvider: e.target.value as 'gemini' | 'openai' | 'claude' })}
                        className="w-full p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    >
                        <option value="gemini">🤖 Google Gemini</option>
                        <option value="openai">🧠 OpenAI GPT</option>
                        <option value="claude">💬 Anthropic Claude</option>
                    </select>
                </div>

                {/* Conditional API Key Form - Show only selected provider */}
                {(settings.selectedAiProvider === 'gemini' || !settings.selectedAiProvider) && (
                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-600">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${settings.geminiApiKey ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Google Gemini API</h4>
                            </div>
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">Get Key</a>
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <input
                                    type={settings.geminiApiKey && editingProvider !== 'gemini' ? "password" : "text"}
                                    className={`w-full p-2 border dark:border-slate-600 rounded text-sm font-mono ${settings.geminiApiKey && editingProvider !== 'gemini' ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-white dark:bg-slate-700'} text-slate-900 dark:text-white`}
                                    value={settings.geminiApiKey || ''}
                                    onChange={e => updateSettings({ geminiApiKey: e.target.value })}
                                    placeholder="AIza..."
                                    readOnly={settings.geminiApiKey && editingProvider !== 'gemini'}
                                />
                            </div>
                            {settings.geminiApiKey && editingProvider !== 'gemini' ? (
                                <button
                                    onClick={() => setEditingProvider('gemini')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition text-sm"
                                >
                                    Edit
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (settings.geminiApiKey) {
                                            setEditingProvider(null);
                                            alert("Gemini API Key saved!");
                                        }
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition text-sm"
                                >
                                    Save
                                </button>
                            )}
                        </div>
                        {settings.geminiApiKey && editingProvider !== 'gemini' && (
                            <div className="mt-2 flex items-center gap-2 text-green-600 text-xs">
                                <CheckCircle2 size={14} /> Configured • Click Edit to change
                            </div>
                        )}
                    </div>
                )}

                {settings.selectedAiProvider === 'openai' && (
                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-600">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${settings.openaiApiKey ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">OpenAI GPT API</h4>
                            </div>
                            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">Get Key</a>
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <input
                                    type={settings.openaiApiKey && editingProvider !== 'openai' ? "password" : "text"}
                                    className={`w-full p-2 border dark:border-slate-600 rounded text-sm font-mono ${settings.openaiApiKey && editingProvider !== 'openai' ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-white dark:bg-slate-700'} text-slate-900 dark:text-white`}
                                    value={settings.openaiApiKey || ''}
                                    onChange={e => updateSettings({ openaiApiKey: e.target.value })}
                                    placeholder="sk-..."
                                    readOnly={settings.openaiApiKey && editingProvider !== 'openai'}
                                />
                            </div>
                            {settings.openaiApiKey && editingProvider !== 'openai' ? (
                                <button
                                    onClick={() => setEditingProvider('openai')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition text-sm"
                                >
                                    Edit
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (settings.openaiApiKey) {
                                            setEditingProvider(null);
                                            alert("OpenAI API Key saved!");
                                        }
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition text-sm"
                                >
                                    Save
                                </button>
                            )}
                        </div>
                        {settings.openaiApiKey && editingProvider !== 'openai' && (
                            <div className="mt-2 flex items-center gap-2 text-green-600 text-xs">
                                <CheckCircle2 size={14} /> Configured • Click Edit to change
                            </div>
                        )}
                    </div>
                )}

                {settings.selectedAiProvider === 'claude' && (
                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-600">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${settings.claudeApiKey ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Anthropic Claude API</h4>
                            </div>
                            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">Get Key</a>
                        </div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <input
                                    type={settings.claudeApiKey && editingProvider !== 'claude' ? "password" : "text"}
                                    className={`w-full p-2 border dark:border-slate-600 rounded text-sm font-mono ${settings.claudeApiKey && editingProvider !== 'claude' ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-white dark:bg-slate-700'} text-slate-900 dark:text-white`}
                                    value={settings.claudeApiKey || ''}
                                    onChange={e => updateSettings({ claudeApiKey: e.target.value })}
                                    placeholder="sk-ant-..."
                                    readOnly={settings.claudeApiKey && editingProvider !== 'claude'}
                                />
                            </div>
                            {settings.claudeApiKey && editingProvider !== 'claude' ? (
                                <button
                                    onClick={() => setEditingProvider('claude')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition text-sm"
                                >
                                    Edit
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (settings.claudeApiKey) {
                                            setEditingProvider(null);
                                            alert("Claude API Key saved!");
                                        }
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition text-sm"
                                >
                                    Save
                                </button>
                            )}
                        </div>
                        {settings.claudeApiKey && editingProvider !== 'claude' && (
                            <div className="mt-2 flex items-center gap-2 text-green-600 text-xs">
                                <CheckCircle2 size={14} /> Configured • Click Edit to change
                            </div>
                        )}
                    </div>
                )}

                <p className="text-xs text-slate-500 italic mt-4">
                    💡 Tip: Configure all providers and switch between them using the dropdown above. Currently only Gemini is functional.
                </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700 mb-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><Smartphone size={20} /> App Information</h3>
                <div className="space-y-3">
                    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Web Deployment</p>
                        <a
                            href="https://society-ilada1425.vercel.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 font-mono text-sm hover:underline flex items-center gap-2"
                        >
                            society-ilada1425.vercel.app
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Version</p>
                            <p className="font-bold text-slate-800 dark:text-white">1.0.0</p>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                            <p className="text-xs text-slate-500 dark:text-slate-400">Platform</p>
                            <p className="font-bold text-slate-800 dark:text-white">Web + Android</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border dark:border-slate-700 mb-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800 dark:text-white"><Lock size={20} /> Security</h3>
                <div className="flex items-end gap-4">
                    <input type="text" className="flex-1 p-2 border dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="New PIN" />
                    <button onClick={handleUpdatePin} className="bg-slate-800 dark:bg-blue-600 text-white px-4 py-2 rounded">Update</button>
                </div>
            </div>
        </div>
    );
};

export default Settings;
