import TelegramBot from 'node-telegram-bot-api';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

// --- GLOBAL PERSISTENT STATE ---
let initializedBot: TelegramBot | null = null;
let db: any = null;
let genAI: any = null;

let globalSocietyCache: any = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 120000; // 2 minutes

const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';
const IS_VERCEL = !!process.env.VERCEL;

interface UserSession {
    chatId: number;
    memberId?: string;
    memberNo?: string;
    name?: string;
    isAdmin?: boolean;
    awaitingMemberNo?: boolean;
}

// --- FAST INITIALIZATION ---
async function initBot() {
    if (initializedBot) return { bot: initializedBot, db, genAI };

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

    // On Vercel, we don't need polling or an internal webhook server.
    // We just process updates passed to the handler.
    initializedBot = new TelegramBot(BOT_TOKEN, { polling: !IS_VERCEL });

    return { bot: initializedBot, db, genAI };
}

// --- CORE LOGIC (FULLY AWAITED) ---
// This replaces the event system to ensure Vercel doesn't kill the process early.
async function handleBotUpdate(bot: TelegramBot, firestore: any, update: any) {
    if (!update.message) return;
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const lcText = text.toLowerCase();

    const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

    // 1. Helper: Get Society Data
    const getSocietyData = async () => {
        const now = Date.now();
        if (globalSocietyCache && (now - lastCacheUpdate < CACHE_TTL)) return globalSocietyCache;
        const snap = await getDoc(doc(firestore, "societies", "ilada_main"));
        if (snap.exists()) {
            globalSocietyCache = snap.data();
            lastCacheUpdate = now;
            return globalSocietyCache;
        }
        return null;
    };

    // 2. Helper: Session Management
    const getSession = async () => {
        try {
            const snap = await getDoc(doc(firestore, "sessions", chatId.toString()));
            return snap.exists() ? (snap.data() as UserSession) : null;
        } catch (e) { return null; }
    };

    const saveSession = async (session: UserSession) => {
        try {
            await setDoc(doc(firestore, "sessions", chatId.toString()), JSON.parse(JSON.stringify(session)));
        } catch (e) { console.error('Save error:', e); }
    };

    // 3. Command Decision Logic
    console.log(`📩 Processing [${chatId}]: ${text}`);

    if (lcText === '/start') {
        await saveSession({ chatId, awaitingMemberNo: true });
        await bot.sendMessage(chatId, "🙏 नमस्कार! कृपया तुमचा *सदस्य क्रमांक* पाठवा (उदा: 101).", { parse_mode: 'Markdown' });
    } else if (lcText === '/help') {
        await bot.sendMessage(chatId, "📚 /myinfo, /balance, /loan\n💬 किंवा विचारा: *'प्रदीप चे कर्ज'*", { parse_mode: 'Markdown' });
    } else if (['/myinfo', '/balance', '/loan'].includes(lcText)) {
        bot.sendChatAction(chatId, 'typing');
        const type = text.substring(1) as 'info' | 'balance' | 'loan';
        const [session, data] = await Promise.all([getSession(), getSocietyData()]);

        if (!session?.memberId) return await bot.sendMessage(chatId, "⚠️ आधी /start करून नोंदणी करा.");
        const m = (data?.members || []).find((mem: any) => mem.id === session.memberId || mem.memberNo?.toString() === session.memberId);
        if (!m) return await bot.sendMessage(chatId, "❌ माहिती सापडली नाही.");

        const total = (m.savingsBalance || 0) + (m.shareBalance || 0) + (m.fdBalance || 0);
        const loanTotal = (m.loanPrincipal || 0) + (m.loanInterestDue || 0);

        if (type === 'myinfo' as any) await bot.sendMessage(chatId, `👤 *नाव:* ${m.name}\n🔢 *क्र:* ${m.memberNo}\n🏘️ *गाव:* ${m.village || 'N/A'}`, { parse_mode: 'Markdown' });
        if (type === 'balance') await bot.sendMessage(chatId, `💰 *शिल्लक:* ${formatCurrency(total)}`, { parse_mode: 'Markdown' });
        if (type === 'loan') await bot.sendMessage(chatId, m.loanPrincipal === 0 ? "✅ कर्ज नाही." : `🏦 *कर्ज:* ${formatCurrency(loanTotal)}`, { parse_mode: 'Markdown' });
    } else if (text) {
        // Natural Language or Registration
        bot.sendChatAction(chatId, 'typing');
        const [session, data] = await Promise.all([getSession(), getSocietyData()]);

        // A. Search logic
        const nameMatch = text.match(/(.+?)\s*(यांचे|यांची|यांचा|चे|ची|चा|)\s*(कर्ज|बचत|माहिती|लोन|balance|loan|karj|bajat)/i);
        if (nameMatch) {
            const search = nameMatch[1].toLowerCase().trim();
            const matches = (data?.members || []).filter((m: any) => m.name?.toLowerCase().includes(search));
            if (matches.length === 0) return await bot.sendMessage(chatId, "❌ सापडले नाही.");
            if (matches.length > 1) return await bot.sendMessage(chatId, "⚠️ अनेक सदस्य सापडले. पूर्ण नाव वापरा.");
            const m = matches[0];
            return await bot.sendMessage(chatId, `👤 *${m.name}*\n🏘️ गाव: ${m.village || 'N/A'}\n🏦 कर्ज: ${formatCurrency((m.loanPrincipal || 0) + (m.loanInterestDue || 0))}`, { parse_mode: 'Markdown' });
        }

        // B. Registration
        if (session?.awaitingMemberNo || /^\d+$/.test(text)) {
            const member = (data?.members || []).find((m: any) => m.memberNo?.toString().trim() === text);
            if (member) {
                await saveSession({ chatId, awaitingMemberNo: false, memberId: member.id, name: member.name, memberNo: member.memberNo });
                return await bot.sendMessage(chatId, `✅ नोंदणी यशस्वी! नमस्कार ${member.name}.`);
            } else if (session?.awaitingMemberNo) {
                return await bot.sendMessage(chatId, "❌ सदस्य सापडला नाही.");
            }
        }
    }
}

// --- VERCEL HANDLER ---
export default async function handler(req: any, res: any) {
    if (req.method === 'POST') {
        try {
            const { bot, db } = await initBot();
            // Critical Change: We AWAIT the logic entirely.
            // This force-keeps the serverless function alive until the reply is sent.
            await handleBotUpdate(bot, db, req.body);
            console.log('✅ Update fully processed and replied.');
            return res.status(200).send('OK');
        } catch (error: any) {
            console.error('💥 Execution Error:', error.message);
            return res.status(200).send('OK'); // Always return 200 to Telegram
        }
    }

    // Diagnostics
    try {
        const { bot } = await initBot();
        const info = await bot.getWebHookInfo();
        return res.status(200).json({
            status: 'running_sync_mode',
            vercel: true,
            webhook: info.url,
            last_error: info.last_error_message,
            cache: !!globalSocietyCache
        });
    } catch (e) {
        return res.status(200).json({ status: 'init_failed' });
    }
}
