import TelegramBot from 'node-telegram-bot-api';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

// --- CONFIGURATION & STATE ---
const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || '';
const IS_VERCEL = !!process.env.VERCEL;

// Global instances (persisted if warm)
let initializedBot: TelegramBot | null = null;
let db: any = null;
let genAI: any = null;

// Request-level cache to prevent multiple fetches of the same data
let societyDataCache: any = null;

interface UserSession {
    chatId: number;
    memberId?: string;
    memberNo?: string;
    name?: string;
    isAdmin?: boolean;
    awaitingMemberNo?: boolean;
}

// --- INITIALIZATION ---
async function initBot() {
    if (initializedBot) return { bot: initializedBot, db, genAI };

    try {
        const firebaseConfig = {
            apiKey: "AIzaSyAp3IzvsP7WM_ek4-wKvUTq7P7LHdaCR6k",
            authDomain: "society-ilada.firebaseapp.com",
            projectId: "society-ilada",
            storageBucket: "society-ilada.firebasestorage.app",
            messagingSenderId: "681551898740",
            appId: "1:681551898740:web:4210df21e473809d80c921"
        };

        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        db = getFirestore(app);

        if (process.env.GEMINI_API_KEY) {
            genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        }

        if (!BOT_TOKEN) throw new Error('BOT_TOKEN missing');

        initializedBot = new TelegramBot(BOT_TOKEN, { polling: !IS_VERCEL });
        setupBotHandlers(initializedBot, db);

        return { bot: initializedBot, db, genAI };
    } catch (error: any) {
        console.error('Initialization Failed:', error.message);
        throw error;
    }
}

// --- HANDLERS ---
function setupBotHandlers(bot: TelegramBot, firestore: any) {
    const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

    console.log('🛠️ Registering Optimized Bot Handlers');

    // Helper: Centralized society data fetch with caching
    async function getSocietyData() {
        if (societyDataCache) return societyDataCache;
        console.log('📡 Fetching Society Data from Firestore...');
        const snap = await getDoc(doc(firestore, "societies", "ilada_main"));
        if (snap.exists()) {
            societyDataCache = snap.data();
            return societyDataCache;
        }
        return null;
    }

    async function getSession(chatId: number): Promise<UserSession | null> {
        try {
            const snap = await getDoc(doc(firestore, "sessions", chatId.toString()));
            return snap.exists() ? (snap.data() as UserSession) : null;
        } catch (e) { return null; }
    }

    async function saveSession(chatId: number, session: UserSession) {
        try {
            await setDoc(doc(firestore, "sessions", chatId.toString()), JSON.parse(JSON.stringify(session)));
        } catch (e) { console.error('Save session error:', e); }
    }

    // --- COMMANDS ---

    bot.onText(/^\/start$/, async (msg) => {
        const chatId = msg.chat.id;
        await saveSession(chatId, { chatId, awaitingMemberNo: true });
        bot.sendMessage(chatId, "🙏 नमस्कार! *Society Mitra AI* मध्ये आपले स्वागत आहे.\n\n📋 सुरू करण्यासाठी कृपया तुमचा *सदस्य क्रमांक* पाठवा (उदा: 101).", { parse_mode: 'Markdown' });
    });

    bot.onText(/^\/help$/, (msg) => {
        bot.sendMessage(msg.chat.id, "📚 *कमांड्स:*\n/myinfo - माझी माहिती\n/balance - बचत/शेअर\n/loan - कर्जाची माहिती\n/npa - NPA रिपोर्ट\n/start - पुन्हा नोंदणी\n\n💬 किंवा नावाने विचारू शकता: *'प्रदीप चे कर्ज'*", { parse_mode: 'Markdown' });
    });

    // Helper for personalized commands
    async function processPersonalCommand(msg: TelegramBot.Message, type: 'info' | 'balance' | 'loan') {
        const chatId = msg.chat.id;
        const session = await getSession(chatId);
        if (!session?.memberId) return bot.sendMessage(chatId, "⚠️ आधी /start करून नोंदणी करा.");

        const data = await getSocietyData();
        const m = (data?.members || []).find((mem: any) => mem.id === session.memberId || mem.memberNo?.toString() === session.memberId);

        if (!m) return bot.sendMessage(chatId, "❌ माहिती सापडली नाही.");

        if (type === 'info') {
            bot.sendMessage(chatId, `👤 *माहिती*\n\n📛 नाव: ${m.name}\n🔢 क्र: ${m.memberNo}\n🏘️ गाव: ${m.village || 'N/A'}\n📱 मोबाईल: ${m.mobile || 'N/A'}`, { parse_mode: 'Markdown' });
        } else if (type === 'balance') {
            const total = (m.savingsBalance || 0) + (m.shareBalance || 0) + (m.fdBalance || 0);
            bot.sendMessage(chatId, `💰 *शिल्लक*\n\n├ बचत: ${formatCurrency(m.savingsBalance || 0)}\n├ शेअर: ${formatCurrency(m.shareBalance || 0)}\n└ FD: ${formatCurrency(m.fdBalance || 0)}\n\n📈 *एकूण:* ${formatCurrency(total)}`, { parse_mode: 'Markdown' });
        } else if (type === 'loan') {
            const total = (m.loanPrincipal || 0) + (m.loanInterestDue || 0);
            if (m.loanPrincipal === 0) return bot.sendMessage(chatId, "✅ तुम्हाला कोणतेही कर्ज नाही.");
            bot.sendMessage(chatId, `🏦 *कर्ज*\n\n├ मुद्दल: ${formatCurrency(m.loanPrincipal || 0)}\n├ व्याज: ${formatCurrency(m.loanInterestDue || 0)}\n└ एकूण: ${formatCurrency(total)}`, { parse_mode: 'Markdown' });
        }
    }

    bot.onText(/^\/myinfo$/, (msg) => processPersonalCommand(msg, 'info'));
    bot.onText(/^\/balance$/, (msg) => processPersonalCommand(msg, 'balance'));
    bot.onText(/^\/loan$/, (msg) => processPersonalCommand(msg, 'loan'));

    bot.onText(/^\/npa$/, async (msg) => {
        const data = await getSocietyData();
        if (!data) return bot.sendMessage(msg.chat.id, "❌ डेटा उपलब्ध नाही.");
        let p = 0, i = 0, count = 0;
        (data.members || []).forEach((m: any) => {
            if (m.loanPrincipal > 0) { p += m.loanPrincipal; i += (m.loanInterestDue || 0); count++; }
        });
        bot.sendMessage(msg.chat.id, `📊 *NPA Summary*\n\n👥 कर्जदार: ${count}\n💰 मुद्दल: ${formatCurrency(p)}\n💹 व्याज: ${formatCurrency(i)}\n\n📈 *एकूण:* ${formatCurrency(p + i)}`, { parse_mode: 'Markdown' });
    });

    // --- MESSAGE PROCESSING ---
    bot.on('message', async (msg) => {
        const text = (msg.text || '').trim();
        if (text.startsWith('/') || !text) return;

        const chatId = msg.chat.id;
        const session = await getSession(chatId);

        // A. Name search detection
        const nameMatch = text.match(/(.+?)\s*(यांचे|यांची|यांचा|चे|ची|चा|)\s*(कर्ज|बचत|माहिती|लोन|balance|loan|karj|bajat)/i);
        if (nameMatch) {
            const data = await getSocietyData();
            const search = nameMatch[1].toLowerCase().trim();
            const matches = (data?.members || []).filter((m: any) => m.name?.toLowerCase().includes(search));

            if (matches.length === 0) return bot.sendMessage(chatId, `❌ "${nameMatch[1]}" सापडला नाही.`);
            if (matches.length > 1) {
                const list = matches.slice(0, 5).map((m: any, i: number) => `${i + 1}. ${m.name} (${m.memberNo})`).join('\n');
                return bot.sendMessage(chatId, `⚠️ अनेक सदस्य सापडले:\n${list}\n\nकृपया पूर्ण नाव वापरा.`);
            }

            const m = matches[0];
            bot.sendMessage(chatId, `👤 *${m.name}* (${m.memberNo})\n🏘️ गाव: ${m.village || 'N/A'}\n\n💰 बचत: ${formatCurrency(m.savingsBalance || 0)}\n🏦 एकूण कर्ज: ${formatCurrency((m.loanPrincipal || 0) + (m.loanInterestDue || 0))}`, { parse_mode: 'Markdown' });
            return;
        }

        // B. Registration / Member Number
        if (session?.awaitingMemberNo || /^\d+$/.test(text)) {
            const data = await getSocietyData();
            const search = text.toString().trim();
            const member = (data?.members || []).find((m: any) => m.memberNo?.toString().trim() === search);

            if (member) {
                await saveSession(chatId, {
                    chatId, awaitingMemberNo: false,
                    memberId: member.id || member.memberNo,
                    name: member.name, memberNo: member.memberNo
                });
                return bot.sendMessage(chatId, `✅ *नोंदणी यशस्वी!*\n\nनमस्कार ${member.name}. आता तुम्ही तुमची माहिती विचारू शकता.`, { parse_mode: 'Markdown' });
            } else if (session?.awaitingMemberNo) {
                return bot.sendMessage(chatId, "❌ सदस्य क्रमांक सापडला नाही. कृपया पुन्हा प्रयत्न करा.");
            }
        }
    });
}

// --- VERCEL HANDLER ---
export default async function handler(req: any, res: any) {
    if (req.method === 'POST') {
        // Clear request-level cache for each new incoming webhook
        societyDataCache = null;

        try {
            const { bot } = await initBot();
            await bot.processUpdate(req.body);
            return res.status(200).send('OK');
        } catch (error: any) {
            return res.status(200).json({ error: error.message });
        }
    }

    // Status Check
    try {
        await initBot();
        return res.status(200).json({ status: 'running', vercel: true });
    } catch (e: any) {
        return res.status(200).json({ status: 'error', message: e.message });
    }
}
