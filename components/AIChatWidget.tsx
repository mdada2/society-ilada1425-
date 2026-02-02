
import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Mic, Loader2, Sparkles, Command, MessageSquarePlus, Check, AlertTriangle, ArrowRight, UserPlus, Paperclip, FileSpreadsheet, Camera, GripHorizontal, WifiOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
    askSocietyAI,
    scanTableData,
    analyzeFinancialTrends,
    predictDefaulters,
    analyzeByVillage,
    calculateLoanEligibility,
    forecastInterest,
    calculateEMI,
    analyzeProfitLoss,
    analyzeNotificationPriorities,
    generateSmartReminderMessage,
    analyzeBulkOperation,
    generateDocumentContent
} from '../services/ai';
import {
    generatePaymentReminders,
    generateMeetingAlerts,
    generateAuditReminders,
    generateSeasonAlerts,
    scheduleReminders
} from '../services/notifications';
import {
    bulkCalculateInterest,
    applyBulkInterestCalculation,
    prepareBulkSMS,
    exportBulkCalculationToCSV
} from '../services/bulkOperations';
import {
    generateLoanAgreement,
    generateReceipt,
    generateMeetingMinutes,
    validateDocumentData
} from '../services/documentGeneration';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Member, ReportHeaders, ThemeMode } from '../types';


const COMMANDS = [
    { cmd: '/home', label: 'Go to Dashboard', text: 'Go to Dashboard', action: 'NAVIGATE', payload: '/' },
    { cmd: '/members', label: 'Members List', text: 'Go to Members', action: 'NAVIGATE', payload: '/members' },
    { cmd: '/transactions', label: 'Daily Transactions', text: 'Open Transactions', action: 'NAVIGATE', payload: '/transactions' },
    { cmd: '/reports', label: 'Reports', text: 'Open Reports', action: 'NAVIGATE', payload: '/reports' },
    { cmd: '/calc', label: 'Loan Calculator', text: 'Open Loan Calculator', action: 'NAVIGATE', payload: '/loan-calculator' },
    { cmd: '/settings', label: 'Settings', text: 'Open Settings', action: 'NAVIGATE', payload: '/settings' },
    { cmd: '/dark', label: 'Dark Mode', text: 'Turn on Dark Mode', action: 'THEME', payload: 'dark' },
    { cmd: '/light', label: 'Light Mode', text: 'Turn on Light Mode', action: 'THEME', payload: 'light' },
    { cmd: '/logout', label: 'Logout', text: 'Logout', action: 'LOGOUT', payload: null },
    // Phase 1: Advanced Analytics Commands
    { cmd: '/analyze', label: '📊 Financial Analysis', text: 'Analyze financial trends', action: 'AI_FUNCTION', payload: 'analyze' },
    { cmd: '/predict', label: '🎯 Predict Defaulters', text: 'Predict defaulter risk', action: 'AI_FUNCTION', payload: 'predict' },
    { cmd: '/village', label: '🏘️ Village Analysis', text: 'Analyze by village', action: 'AI_FUNCTION', payload: 'village' },
    { cmd: '/eligibility', label: '✅ Loan Eligibility', text: 'Check loan eligibility', action: 'AI_FUNCTION', payload: 'eligibility' },
    { cmd: '/forecast', label: '📈 Interest Forecast', text: 'Forecast interest income', action: 'AI_FUNCTION', payload: 'forecast' },
    { cmd: '/emi', label: '💰 EMI Calculator', text: 'Calculate EMI', action: 'AI_FUNCTION', payload: 'emi' },
    { cmd: '/profitloss', label: '📉 P&L Analysis', text: 'Analyze profit/loss', action: 'AI_FUNCTION', payload: 'profitloss' },
    // Phase 3: Notification & Reminder Commands
    { cmd: '/reminders', label: '🔔 Payment Reminders', text: 'Show payment reminders', action: 'AI_FUNCTION', payload: 'reminders' },
    { cmd: '/notifications', label: '📬 Notifications', text: 'Analyze notification priorities', action: 'AI_FUNCTION', payload: 'notifications' },
    // Phase 4: Bulk Operations Commands
    { cmd: '/bulkinterest', label: '🧮 Bulk Interest Calc', text: 'Calculate interest for all members', action: 'AI_FUNCTION', payload: 'bulkinterest' },
    { cmd: '/bulksms', label: '📱 Bulk SMS', text: 'Prepare bulk SMS', action: 'AI_FUNCTION', payload: 'bulksms' },
    { cmd: '/bulkanalysis', label: '📊 Bulk Analysis', text: 'Analyze bulk operation', action: 'AI_FUNCTION', payload: 'bulkanalysis' },
    // Phase 5: Document Generation Commands
    { cmd: '/loanagreement', label: '📄 Loan Agreement', text: 'Generate loan agreement', action: 'AI_FUNCTION', payload: 'loanagreement' },
    { cmd: '/receipt', label: '🧾 Receipt', text: 'Generate receipt', action: 'AI_FUNCTION', payload: 'receipt' },
    { cmd: '/minutes', label: '📝 Meeting Minutes', text: 'Generate meeting minutes', action: 'AI_FUNCTION', payload: 'minutes' },
];


const AIChatWidget = () => {
    const { members, transactions, settings, localSettings, updateSettings, updateLocalSettings, logout, updateMember, addTransaction, addMember } = useApp();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
        { role: 'ai', text: 'Namaskar! I am Society Mitra. How can I help you today?' }
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [lastAction, setLastAction] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<{ type: string, payload: any } | null>(null);
    const [pendingDownload, setPendingDownload] = useState<any[] | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Draggable Button Position
    const [btnPos, setBtnPos] = useState<{ x: number, y: number }>(() => {
        const saved = localStorage.getItem('mitra_btn_pos');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Initial safe bounds check
            return {
                x: Math.max(10, Math.min(window.innerWidth - 80, parsed.x)),
                y: Math.max(10, Math.min(window.innerHeight - 100, parsed.y))
            };
        }
        return { x: window.innerWidth - 80, y: window.innerHeight - 150 };
    });

    const isDragging = useRef(false);
    const hasMoved = useRef(false);
    const dragOffset = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const toggleButtonRef = useRef<HTMLButtonElement>(null);

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
    useEffect(scrollToBottom, [messages]);

    // Sync button position to storage
    useEffect(() => {
        localStorage.setItem('mitra_btn_pos', JSON.stringify(btnPos));
    }, [btnPos]);

    // Ensure button doesn't stay off-screen when resizing or switching to mobile
    useEffect(() => {
        const handleResize = () => {
            setBtnPos(prev => ({
                x: Math.max(10, Math.min(window.innerWidth - 80, prev.x)),
                y: Math.max(10, Math.min(window.innerHeight - 100, prev.y))
            }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Drag Handlers
    const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        dragOffset.current = {
            x: clientX - btnPos.x,
            y: clientY - btnPos.y
        };
        isDragging.current = true;
        hasMoved.current = false;

        const onMove = (moveEvent: MouseEvent | TouchEvent) => {
            if (!isDragging.current) return;
            const mX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const mY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

            const newX = mX - dragOffset.current.x;
            const newY = mY - dragOffset.current.y;

            // Boundary checks
            const boundedX = Math.max(10, Math.min(window.innerWidth - 70, newX));
            const boundedY = Math.max(10, Math.min(window.innerHeight - 70, newY));

            if (Math.abs(newX - btnPos.x) > 5 || Math.abs(newY - btnPos.y) > 5) {
                hasMoved.current = true;
            }

            setBtnPos({ x: boundedX, y: boundedY });
        };

        const onEnd = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    };

    const handleToggle = () => {
        if (!hasMoved.current) {
            setIsOpen(!isOpen);
        }
    };

    if (!localSettings.enableAI) return null;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        setShowSuggestions(val.startsWith('/'));
    };

    const handleCommandSelect = (cmdText: string) => {
        const commandObj = COMMANDS.find(c => c.text === cmdText || c.cmd === cmdText);
        if (commandObj) {
            setQuery(commandObj.cmd);
            setTimeout(() => handleSend(commandObj.cmd), 50);
        } else {
            setQuery(cmdText);
        }
        setShowSuggestions(false);
    };

    const handleNewChat = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMessages([{ role: 'ai', text: 'Namaskar! I am Society Mitra. How can I help you today?' }]);
        setQuery('');
        setLastAction(null);
        setPendingAction(null);
        setPendingDownload(null);
        setShowSuggestions(false);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!navigator.onLine) {
            setMessages(prev => [...prev, { role: 'ai', text: "Offline: Cannot scan images without internet connection." }]);
            return;
        }
        setMessages(prev => [...prev, { role: 'user', text: "📷 Scanning image for table data..." }]);
        setIsLoading(true);
        setPendingDownload(null);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            const data = await scanTableData(base64);
            setIsLoading(false);
            if (data && data.length > 0) {
                setPendingDownload(data);
                setMessages(prev => [...prev, { role: 'ai', text: `Success! I extracted ${data.length} records from the image.` }]);
            } else {
                setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I couldn't identify any clear table data in that image." }]);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleDownloadCSV = () => {
        if (!pendingDownload) return;
        const headers = ["MemberNo", "Name", "Village", "Mobile", "Category"];
        const csvContent = [
            headers.join(','),
            ...pendingDownload.map(row => [row.memberNo || '', `"${row.name || ''}"`, row.village || '', row.mobile || '', row.category || ''].join(','))
        ].join('\n');
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url; link.download = `Scanned_Data_${format(new Date(), 'dd-MM-yyyy')}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setPendingDownload(null);
        setLastAction("Extracted Data Downloaded");
    };

    const executePendingAction = () => {
        if (!pendingAction) return;
        const { type, payload } = pendingAction;
        try {
            if (type === 'UPDATE_MEMBER') {
                const member = members.find(m => m.id === payload.memberId);
                if (member && payload.updates) {
                    updateMember({ ...member, ...payload.updates });
                    setLastAction(`Member Updated: ${member.name}`);
                    setMessages(prev => [...prev, { role: 'ai', text: `Done! I have updated details for ${member.name}.` }]);
                } else {
                    setMessages(prev => [...prev, { role: 'ai', text: `Failed. Member not found or invalid updates.` }]);
                }
            }
            else if (type === 'ADD_MEMBER') {
                const nextNo = payload.memberNo || `TEMP-${Math.floor(Math.random() * 1000)}`;
                const newMember: Member = {
                    id: Date.now().toString(), memberNo: nextNo, name: payload.name || 'New Member',
                    village: payload.village || '', mobile: payload.mobile || '', gender: payload.gender || 'Male',
                    category: payload.category || 'OPEN', dob: payload.dob || '', aadhar: payload.aadhar || '',
                    isActive: true, shareBalance: 0, savingsBalance: 0, loanPrincipal: 0, loanInterestDue: 0, fdBalance: 0,
                    bankAccountNo: '', landArea: '', loanAccountNo: ''
                };
                addMember(newMember);
                setLastAction(`New Member Added: ${newMember.name}`);
                setMessages(prev => [...prev, { role: 'ai', text: `Success! ${newMember.name} (No: ${newMember.memberNo}) has been added.` }]);
            }
            else if (type === 'ADD_TRANSACTION') {
                const transaction: any = {
                    id: Date.now().toString(), date: format(new Date(), 'yyyy-MM-dd'), type: payload.txnType || 'Credit',
                    accountType: payload.accountType, amount: payload.amount, details: payload.details || 'Entry via AI Assistant',
                    timestamp: Date.now(), memberId: payload.memberId, memberName: members.find(m => m.id === payload.memberId)?.name
                };
                addTransaction(transaction);
                setLastAction(`Transaction Added: ₹${payload.amount}`);
                setMessages(prev => [...prev, { role: 'ai', text: `Done! Added transaction of ₹${payload.amount} successfully.` }]);
            }
        } catch (e) { alert("Failed to execute action."); }
        setPendingAction(null);
    };

    const cancelPendingAction = () => {
        setPendingAction(null);
        setMessages(prev => [...prev, { role: 'ai', text: "Action cancelled. (कृती रद्द केली)." }]);
    };

    // Handle Phase 1 AI Functions
    const handleAIFunction = async (functionType: string) => {
        if (!navigator.onLine) {
            setMessages(prev => [...prev, { role: 'ai', text: "⚠️ Offline. Analytics require internet connection." }]);
            return;
        }

        setIsLoading(true);
        try {
            switch (functionType) {
                case 'analyze':
                    const analysisResult = await analyzeFinancialTrends(
                        members,
                        transactions,
                        'month',
                        undefined,
                        undefined,
                        settings.geminiApiKey
                    );
                    if (analysisResult) {
                        const msg = `📊 **Financial Analysis (Current Month)**\n\n${analysisResult.summary}\n\n**Key Insights:**\n${analysisResult.insights?.map((i: string) => `• ${i}`).join('\n')}\n\n**Health Score:** ${analysisResult.healthScore}/100`;
                        setMessages(prev => [...prev, { role: 'ai', text: msg }]);
                        setLastAction('Financial Analysis Complete');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "Analysis failed. Please try again." }]);
                    }
                    break;

                case 'predict':
                    const defaulters = await predictDefaulters(members, transactions, settings.geminiApiKey);
                    if (defaulters && defaulters.length > 0) {
                        const msg = `🎯 **Defaulter Risk Prediction**\n\nFound ${defaulters.length} members at risk:\n\n${defaulters.slice(0, 5).map((d: any) => `${d.memberNo} - ${d.name}\nRisk: ${d.riskLevel} (${d.riskScore}/100)\n${d.reason}\n`).join('\n')}`;
                        setMessages(prev => [...prev, { role: 'ai', text: msg }]);
                        setLastAction('Defaulter Prediction Complete');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "✅ Good news! No high-risk members found." }]);
                    }
                    break;

                case 'village':
                    const villageAnalysis = await analyzeByVillage(members, settings.geminiApiKey);
                    if (villageAnalysis) {
                        const msg = `🏘️ **Village-wise Analysis**\n\n${villageAnalysis.summary}\n\n${villageAnalysis.villages?.slice(0, 5).map((v: any) => `**${v.village}**\n• Members: ${v.memberCount}\n• Loans: ₹${v.totalLoans?.toLocaleString('en-IN')}\n• ${v.insight}\n`).join('\n')}`;
                        setMessages(prev => [...prev, { role: 'ai', text: msg }]);
                        setLastAction('Village Analysis Complete');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "Analysis failed. Please try again." }]);
                    }
                    break;

                case 'eligibility':
                    setMessages(prev => [...prev, { role: 'ai', text: "Please specify: Member Number and Requested Amount\nExample: Check eligibility for member 101 for ₹50000" }]);
                    break;

                case 'forecast':
                    const forecast = await forecastInterest(members, 3, settings.geminiApiKey);
                    if (forecast) {
                        const msg = `📈 **Interest Forecast (Next 3 Months)**\n\nProjected Interest: ₹${forecast.totalProjectedInterest?.toLocaleString('en-IN')}\nMonthly Average: ₹${forecast.monthlyAverage?.toLocaleString('en-IN')}\nConfidence: ${forecast.confidence}\n\n**Assumptions:**\n${forecast.assumptions?.map((a: string) => `• ${a}`).join('\n')}`;
                        setMessages(prev => [...prev, { role: 'ai', text: msg }]);
                        setLastAction('Interest Forecast Complete');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "Forecast failed. Please try again." }]);
                    }
                    break;

                case 'emi':
                    // Simple EMI calculation - no API needed
                    const emiResult = calculateEMI(100000, 12, 12);
                    const msg = `💰 **EMI Calculator**\n\nExample: ₹1,00,000 @ 12% for 12 months\n\nEMI: ₹${emiResult.emi.toLocaleString('en-IN')}/month\nTotal Interest: ₹${emiResult.totalInterest.toLocaleString('en-IN')}\nTotal Amount: ₹${emiResult.totalAmount.toLocaleString('en-IN')}\n\nAsk me for custom calculation!`;
                    setMessages(prev => [...prev, { role: 'ai', text: msg }]);
                    setLastAction('EMI Calculated');
                    break;

                case 'profitloss':
                    const now = new Date();
                    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                    const today = now.toISOString().split('T')[0];

                    const plAnalysis = await analyzeProfitLoss(transactions, members, yearStart, today, settings.geminiApiKey);
                    if (plAnalysis) {
                        const msg = `📉 **Profit & Loss Analysis (YTD)**\n\nIncome: ₹${plAnalysis.totalIncome?.toLocaleString('en-IN')}\nExpenses: ₹${plAnalysis.totalExpenses?.toLocaleString('en-IN')}\nNet P/L: ₹${plAnalysis.netProfitLoss?.toLocaleString('en-IN')}\n\n${plAnalysis.analysis}\n\n**Health:** ${plAnalysis.healthRating}`;
                        setMessages(prev => [...prev, { role: 'ai', text: msg }]);
                        setLastAction('P&L Analysis Complete');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "Analysis failed. Please try again." }]);
                    }
                    break;

                case 'reminders':
                    // Generate payment reminders
                    const paymentReminders = generatePaymentReminders(members, transactions, 7);
                    if (paymentReminders.length > 0) {
                        const msg = `🔔 **Payment Reminders**\n\nFound ${paymentReminders.length} members needing reminders:\n\n${paymentReminders.slice(0, 5).map(r => `• ${members.find(m => m.id === r.memberId)?.name} (${members.find(m => m.id === r.memberId)?.memberNo})\n${r.description}`).join('\n\n')}\n\n${paymentReminders.length > 5 ? `...and ${paymentReminders.length - 5} more` : ''}`;
                        setMessages(prev => [...prev, { role: 'ai', text: msg }]);
                        setLastAction('Payment Reminders Generated');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "✅ No pending payment reminders!" }]);
                    }
                    break;

                case 'notifications':
                    // Analyze notification priorities
                    const notifAnalysis = await analyzeNotificationPriorities(members, transactions, settings.geminiApiKey);
                    if (notifAnalysis) {
                        const msg = `📬 **Notification Priority Analysis**\n\n🔴 Urgent: ${notifAnalysis.urgentCount}\n🟠 High Priority: ${notifAnalysis.highPriorityCount}\n🟡 Medium Priority: ${notifAnalysis.mediumPriorityCount}\n\n**Strategy:**\n${notifAnalysis.strategy}\n\n**Recommendations:**\n${notifAnalysis.recommendations?.map((r: string) => `• ${r}`).join('\n')}`;
                        setMessages(prev => [...prev, { role: 'ai', text: msg }]);
                        setLastAction('Notification Analysis Complete');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "Analysis failed. Please try again." }]);
                    }
                    break;

                case 'bulkinterest':
                    // Bulk interest calculation
                    const bulkResults = bulkCalculateInterest(members);
                    const successCount = bulkResults.filter(r => r.success).length;
                    const totalInterest = bulkResults.reduce((sum, r) => sum + r.calculatedInterest, 0);

                    const bulkMsg = `🧮 **Bulk Interest Calculation**\n\nProcessed: ${bulkResults.length} members\nSuccess: ${successCount}\nFailed: ${bulkResults.length - successCount}\n\nTotal Interest Calculated: ₹${Math.round(totalInterest).toLocaleString('en-IN')}\n\n**Top 5 Results:**\n${bulkResults.slice(0, 5).map(r => `${r.memberNo} - ${r.name}\nInterest: ₹${Math.round(r.calculatedInterest).toLocaleString('en-IN')}\nTotal Due: ₹${Math.round(r.totalDue).toLocaleString('en-IN')}`).join('\n\n')}\n\n💡 Use this data to apply bulk updates or export to CSV.`;
                    setMessages(prev => [...prev, { role: 'ai', text: bulkMsg }]);
                    setLastAction('Bulk Interest Calculated');
                    break;

                case 'bulksms':
                    // Prepare bulk SMS
                    const smsJob = prepareBulkSMS(members, 'Sample message', { hasLoan: true });
                    const smsMsg = `📱 **Bulk SMS Preparation**\n\nTotal Recipients: ${smsJob.recipients.length}\nValid Mobile Numbers: ${smsJob.recipients.length}\n\n**Sample Recipients:**\n${smsJob.recipients.slice(0, 5).map(r => `${r.memberNo} - ${r.name}\n${r.mobile}`).join('\n\n')}\n\n💡 Ready to send! Configure message template and send.`;
                    setMessages(prev => [...prev, { role: 'ai', text: smsMsg }]);
                    setLastAction('Bulk SMS Prepared');
                    break;

                case 'bulkanalysis':
                    // Analyze bulk operation
                    const bulkAnalysis = await analyzeBulkOperation(members, transactions, 'interest', settings.geminiApiKey);
                    if (bulkAnalysis) {
                        const analysisMsg = `📊 **Bulk Operation Analysis**\n\n${bulkAnalysis.recommended ? '✅ Recommended' : '⚠️ Not Recommended'}\n\nEstimated Interest: ₹${bulkAnalysis.estimatedInterest?.toLocaleString('en-IN')}\n\n**Warnings:**\n${bulkAnalysis.warnings?.map((w: string) => `⚠️ ${w}`).join('\n')}\n\n**Recommendations:**\n${bulkAnalysis.recommendations?.map((r: string) => `• ${r}`).join('\n')}`;
                        setMessages(prev => [...prev, { role: 'ai', text: analysisMsg }]);
                        setLastAction('Bulk Analysis Complete');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "Analysis failed. Please try again." }]);
                    }
                    break;

                case 'loanagreement':
                    // Generate loan agreement suggestions
                    const loanDoc = await generateDocumentContent('loan_agreement', {
                        memberName: members[0]?.name || 'Sample Member',
                        loanAmount: 50000,
                        interestRate: 12,
                        repaymentPeriod: 12
                    }, settings.geminiApiKey);

                    if (loanDoc) {
                        const docMsg = `📄 **Loan Agreement Generator**\n\n**Suggested Terms:**\n${loanDoc.terms?.map((t: string) => `• ${t}`).join('\n')}\n\n**Important Clauses:**\n${loanDoc.clauses?.map((c: string) => `• ${c}`).join('\n')}\n\n**Warnings:**\n${loanDoc.warnings?.map((w: string) => `⚠️ ${w}`).join('\n')}\n\n💡 Use these suggestions to create a comprehensive loan agreement.`;
                        setMessages(prev => [...prev, { role: 'ai', text: docMsg }]);
                        setLastAction('Loan Agreement Suggestions Generated');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "Document generation failed. Please try again." }]);
                    }
                    break;

                case 'receipt':
                    // Generate receipt preview
                    if (members.length > 0 && transactions.length > 0) {
                        const sampleMember = members[0];
                        const sampleTxn = transactions[0];
                        const receiptNo = `RCP-${Date.now()}`;

                        const receiptMsg = `🧾 **Receipt Generator**\n\nReceipt Preview:\n\nReceipt No: ${receiptNo}\nMember: ${sampleMember.name} (${sampleMember.memberNo})\nAmount: ₹${sampleTxn.amount.toLocaleString('en-IN')}\nType: ${sampleTxn.type}\nAccount: ${sampleTxn.accountType}\n\n✅ Receipt template ready! You can generate full HTML/PDF receipts for any transaction.`;
                        setMessages(prev => [...prev, { role: 'ai', text: receiptMsg }]);
                        setLastAction('Receipt Preview Generated');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "No transactions found to generate receipt." }]);
                    }
                    break;

                case 'minutes':
                    // Generate meeting minutes suggestions
                    const meetingDoc = await generateDocumentContent('meeting_minutes', {
                        meetingType: 'Monthly',
                        topic: 'General Meeting'
                    }, settings.geminiApiKey);

                    if (meetingDoc) {
                        const minutesMsg = `📝 **Meeting Minutes Generator**\n\n**Suggested Agenda:**\n${meetingDoc.agenda?.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}\n\n**Common Resolutions:**\n${meetingDoc.resolutions?.map((r: string) => `• ${r}`).join('\n')}\n\n**Discussion Points:**\n${meetingDoc.discussionPoints?.map((d: string) => `• ${d}`).join('\n')}\n\n💡 Use these suggestions to create comprehensive meeting minutes.`;
                        setMessages(prev => [...prev, { role: 'ai', text: minutesMsg }]);
                        setLastAction('Meeting Minutes Suggestions Generated');
                    } else {
                        setMessages(prev => [...prev, { role: 'ai', text: "Document generation failed. Please try again." }]);
                    }
                    break;

                default:
                    setMessages(prev => [...prev, { role: 'ai', text: "Unknown function. Please try again." }]);
            }
        } catch (error: any) {
            console.error("AI Function Error:", error);
            setMessages(prev => [...prev, { role: 'ai', text: "❌ Error processing request. Please check your API key and try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (overrideQuery?: string) => {
        const userText = overrideQuery || query;
        if (!userText.trim()) return;

        setQuery('');
        setShowSuggestions(false);
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
        setLastAction(null);
        setPendingAction(null);
        setPendingDownload(null);

        const matchedCommand = COMMANDS.find(c => c.cmd.toLowerCase() === userText.toLowerCase().trim());
        if (matchedCommand) {
            setIsLoading(true);
            setTimeout(() => {
                setIsLoading(false);
                if (matchedCommand.action === 'NAVIGATE') {
                    navigate(matchedCommand.payload);
                    setLastAction(`Navigated to ${matchedCommand.label}`);
                    setMessages(prev => [...prev, { role: 'ai', text: `Navigating to ${matchedCommand.label}...` }]);
                }
                else if (matchedCommand.action === 'THEME') {
                    updateLocalSettings({ theme: matchedCommand.payload as ThemeMode });
                    setLastAction(`Theme set to ${matchedCommand.payload} (स्थानिक सेटिंग बदलली)`);
                    setMessages(prev => [...prev, { role: 'ai', text: `Theme updated to ${matchedCommand.payload}. This change is local.` }]);
                }
                else if (matchedCommand.action === 'LOGOUT') {
                    setIsOpen(false);
                    logout();
                }
                else if (matchedCommand.action === 'AI_FUNCTION') {
                    // Handle Phase 1 AI Functions
                    handleAIFunction(matchedCommand.payload);
                }
            }, 300);
            return;
        }

        if (!navigator.onLine) {
            setMessages(prev => [...prev, { role: 'ai', text: "⚠️ You are offline. I can only perform commands like /home, /dark, /reports etc. Please connect to internet for questions." }]);
            return;
        }

        setIsLoading(true);
        try {
            const responseData = await askSocietyAI(userText, { members, transactions }, settings.geminiApiKey);
            setMessages(prev => [...prev, { role: 'ai', text: responseData.text || "Processed." }]);
            if (responseData.action) {
                const { type, payload } = responseData.action;
                if (['NAVIGATE', 'THEME', 'LOGOUT', 'CHANGE_HEADER_LANGUAGE'].includes(type)) {
                    setTimeout(() => {
                        switch (type) {
                            case 'NAVIGATE': if (payload?.value) { navigate(payload.value); setLastAction(`Navigated to ${payload.value}`); } break;
                            case 'THEME': if (payload?.value === 'dark' || payload?.value === 'light') { updateLocalSettings({ theme: payload.value as ThemeMode }); setLastAction(`Switched to ${payload.value} mode`); } break;
                            case 'LOGOUT': setIsOpen(false); logout(); break;
                            case 'CHANGE_HEADER_LANGUAGE':
                                let newHeaders: ReportHeaders;
                                if (payload?.language === 'mr') {
                                    newHeaders = { memberNo: 'सभासद क्र.', name: 'नाव', village: 'गाव', loanDate: 'कर्ज तारीख', days: 'दिवस', principal: 'मुद्दल', interest: 'व्याज', totalDue: 'एकूण बाकी', dp_memberNo: 'सभासद क्र.', dp_name: 'नाव', dp_category: 'प्रवर्ग', dp_village: 'गाव', dp_disbursementDate: 'वाटप दिनांक', dp_principal: 'मुद्दल', dp_repaymentDate: 'परतफेड दिनांक', dp_repaidAmount: 'परतफेड रक्कम', dp_days: 'दिवस', dp_product: 'गुणाकार (Product)', dp_incentive: '३% प्रोत्साहन', dp_bankAccount: 'बँक खाते' };
                                    setLastAction('Headers set to Marathi');
                                } else {
                                    newHeaders = { memberNo: 'Member No', name: 'Name', village: 'Village', loanDate: 'Loan Date', days: 'Days', principal: 'Principal', interest: 'Interest', totalDue: 'Total Due', dp_memberNo: 'Member No', dp_name: 'Name', dp_category: 'Category', dp_village: 'Village', dp_disbursementDate: 'Disb. Date', dp_principal: 'Principal', dp_repaymentDate: 'Repay Date', dp_repaidAmount: 'Repaid Amt', dp_days: 'Days', dp_product: 'Product', dp_incentive: '3% Incentive', dp_bankAccount: 'Bank Acc' };
                                    setLastAction('Headers set to English');
                                }
                                updateSettings({ reportHeaders: newHeaders });
                                setMessages(prev => [...prev, { role: 'ai', text: `Report Headers updated to ${payload?.language === 'mr' ? 'Marathi' : 'English'}.` }]);
                                break;
                        }
                    }, 500);
                }
                else if (['UPDATE_MEMBER', 'ADD_TRANSACTION', 'ADD_MEMBER'].includes(type)) { setPendingAction({ type, payload }); }
            }
        } catch (e: any) {
            console.error("Chat Error:", e);
            // Show user-friendly error message
            const errorMsg = e.message?.includes('timeout') || e.name === 'AbortError'
                ? "⏱️ Request timed out. Please try a simpler question."
                : "❌ Error processing request. Please check your connection and try again.";
            setMessages(prev => [...prev, { role: 'ai', text: errorMsg }]);
        } finally { setIsLoading(false); }
    };

    const handleMicClick = () => {
        if (!('webkitSpeechRecognition' in window)) { alert("Voice input not supported."); return; }
        if (isListening) return;
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.lang = 'en-IN'; recognition.interimResults = false; recognition.maxAlternatives = 1;
        setIsListening(true);
        recognition.onresult = (event: any) => { setQuery(event.results[0][0].transcript); setIsListening(false); };
        recognition.onerror = () => { setIsListening(false); };
        recognition.onend = () => { setIsListening(false); };
        recognition.start();
    };

    const filteredCommands = COMMANDS.filter(c => c.cmd.toLowerCase().startsWith(query.toLowerCase()) || c.label.toLowerCase().includes(query.toLowerCase().replace('/', '')));

    const opacity = (localSettings.aiTransparency || 30) / 100;
    const blurClass = { 'none': '', 'sm': 'backdrop-blur-sm', 'md': 'backdrop-blur-md', 'xl': 'backdrop-blur-xl', '2xl': 'backdrop-blur-2xl' }[localSettings.aiBlurStrength || 'xl'];
    const isOffline = !navigator.onLine;

    return (
        <>
            {/* Floating Draggable Button */}
            <button
                ref={toggleButtonRef}
                onMouseDown={onDragStart}
                onTouchStart={onDragStart}
                onClick={handleToggle}
                style={{ left: btnPos.x, top: btnPos.y }}
                className={`fixed z-[9999] bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:scale-110 active:scale-95 transition-transform flex items-center gap-2 cursor-move touch-none select-none ${!isOpen ? 'animate-bounce' : 'opacity-0 scale-0 pointer-events-none'}`}
            >
                <Bot size={28} /> <span className="hidden md:inline font-bold">Society Mitra</span>
            </button>

            {/* Centered Chat Window */}
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                    {/* Backdrop to catch clicks outside the chat container */}
                    <div
                        className="fixed inset-0 pointer-events-auto bg-black/5"
                        onClick={() => setIsOpen(false)}
                    />

                    <div
                        ref={chatContainerRef}
                        style={{ '--ai-opacity': opacity } as React.CSSProperties}
                        onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing the widget
                        className={`w-full max-w-md h-[550px] max-h-[85vh] rounded-3xl flex flex-col overflow-hidden animate-fade-in-up bg-white/[var(--ai-opacity)] dark:bg-slate-900/[var(--ai-opacity)] ${blurClass} border border-white/50 dark:border-slate-600/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto relative z-10`}
                    >
                        <div className="bg-gradient-to-r from-blue-600/80 to-indigo-600/80 p-4 flex justify-between items-center text-white backdrop-blur-md border-b border-white/10 select-none">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-full"><Sparkles size={20} /></div>
                                <div>
                                    <h3 className="font-black text-shadow-sm flex items-center gap-2">Society Mitra</h3>
                                    <p className="text-[10px] opacity-80 flex items-center gap-1">{isOffline ? <span className="flex items-center gap-1 text-yellow-200"><WifiOff size={10} /> Offline</span> : "AI Assistant • Online"}</p>
                                </div>
                            </div>
                            <div className="flex gap-1 items-center">
                                <button onClick={handleNewChat} className="hover:bg-white/20 p-2 rounded-full transition" title="New Chat"><MessageSquarePlus size={20} /></button>
                                <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition" title="Close"><X size={20} /></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-300/50 dark:scrollbar-thumb-slate-600/50">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm backdrop-blur-md ${msg.role === 'user' ? 'bg-blue-600/90 text-white rounded-br-none' : 'bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-bl-none border border-white/40 dark:border-slate-600/50'}`}>
                                        {msg.text}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white/60 dark:bg-slate-800/60 p-3.5 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-3 border border-white/40 dark:border-slate-600/50 backdrop-blur-md">
                                        <Loader2 size={16} className="animate-spin text-blue-600" />
                                        <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Thinking...</span>
                                    </div>
                                </div>
                            )}
                            {pendingDownload && !isLoading && (
                                <div className="bg-emerald-50/80 dark:bg-emerald-900/40 border border-emerald-200/60 dark:border-emerald-700/60 p-4 rounded-xl animate-fade-in backdrop-blur-md">
                                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm mb-2"><FileSpreadsheet size={16} /> Data Extracted</div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">I found {pendingDownload.length} records. Download to review.</p>
                                    <div className="flex gap-2">
                                        <button onClick={handleDownloadCSV} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-black shadow-sm transition">DOWNLOAD CSV</button>
                                        <button onClick={() => setPendingDownload(null)} className="px-3 bg-slate-200/80 text-slate-700 rounded-lg text-xs font-bold transition">CANCEL</button>
                                    </div>
                                </div>
                            )}
                            {pendingAction && !isLoading && (
                                <div className="bg-amber-50/80 dark:bg-amber-900/40 border border-amber-200/60 dark:border-amber-700/60 p-4 rounded-xl animate-fade-in backdrop-blur-md">
                                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm mb-1"><AlertTriangle size={16} /> Admin Confirmation</div>
                                    <p className="text-[10px] text-slate-500 mb-3 italic">Shall I proceed with the requested data update?</p>
                                    <div className="flex gap-2">
                                        <button onClick={executePendingAction} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-xs font-black shadow-sm transition"><Check size={14} className="inline mr-1" /> APPROVE</button>
                                        <button onClick={cancelPendingAction} className="flex-1 bg-slate-200/80 text-slate-700 py-2 rounded-lg text-xs font-black transition"><X size={14} className="inline mr-1" /> REJECT</button>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {showSuggestions && (
                            <div className="px-3 pb-2">
                                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-xl shadow-2xl border dark:border-slate-600 overflow-hidden max-h-40 overflow-y-auto animate-fade-in-up">
                                    <div className="px-3 py-2 bg-slate-100/80 dark:bg-slate-700/80 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b dark:border-slate-600 flex justify-between">
                                        <span>Automation</span>
                                        <span className="text-blue-600">DRAG UP/DOWN</span>
                                    </div>
                                    {filteredCommands.map((cmd) => (
                                        <button key={cmd.cmd} onClick={() => handleCommandSelect(cmd.cmd)} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700/50 flex justify-between items-center border-b dark:border-slate-700 last:border-0 transition-colors">
                                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">{cmd.cmd}</span>
                                            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{cmd.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="p-4 bg-white/30 dark:bg-slate-900/30 backdrop-blur-md border-t border-white/20 dark:border-slate-700/50 flex gap-3 items-center">
                            <div className="flex gap-1">
                                <label className={`p-2 rounded-full hover:bg-white/40 dark:hover:bg-slate-700/40 text-slate-500 transition cursor-pointer ${isOffline ? 'opacity-30' : ''}`} title="Scan Document">
                                    <Paperclip size={20} />
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isLoading || isOffline} />
                                </label>
                                <button onClick={handleMicClick} className={`p-2 rounded-full transition ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-white/40 dark:hover:bg-slate-700/40 text-slate-500'}`} title="Voice Input" disabled={isOffline}>
                                    <Mic size={20} />
                                </button>
                            </div>
                            <input
                                type="text"
                                value={query}
                                onChange={handleInputChange}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder={isOffline ? "Offline..." : "Ask me anything..."}
                                className="flex-1 bg-white/50 dark:bg-slate-800/50 px-4 py-2 rounded-2xl border-none outline-none text-sm text-slate-800 dark:text-white placeholder-slate-500 font-medium shadow-inner"
                                autoFocus
                                disabled={isLoading}
                            />
                            <button onClick={() => handleSend()} disabled={!query.trim() || isLoading} className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition disabled:opacity-50 shadow-lg active:scale-90">
                                <Send size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIChatWidget;
