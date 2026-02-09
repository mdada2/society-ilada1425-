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

    // Set command menu (next to input field)
    initializedBot.setMyCommands([
        { command: 'start', description: 'सुरू करा / नोंदणी' },
        { command: 'myinfo', description: 'माझी माहिती' },
        { command: 'balance', description: 'माझी शिल्लक' },
        { command: 'loan', description: 'कर्ज माहिती' },
        { command: 'help', description: 'मदत' }
    ]).catch(e => console.error('Menu error:', e));

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

    const menuKeyboard = {
        keyboard: [
            [{ text: '👤 माझी माहिती' }, { text: '💰 माझी शिल्लक' }],
            [{ text: '🏦 कर्ज माहिती' }, { text: '❓ मदत' }]
        ],
        resize_keyboard: true
    };

    if (lcText === '/start') {
        await saveSession({ chatId, awaitingMemberNo: true });
        await bot.sendMessage(chatId, "🙏 नमस्कार! कृपया तुमचा *सदस्य क्रमांक* पाठवा (उदा: 101).", {
            parse_mode: 'Markdown',
            reply_markup: { remove_keyboard: true } // Hide during reg
        });
    } else if (lcText === '/help' || text === '❓ मदत') {
        await bot.sendMessage(chatId, "📚 खालील पर्यायांवर क्लिक करा किंवा विचारा: *'प्रदीप चे कर्ज'*", {
            parse_mode: 'Markdown',
            reply_markup: menuKeyboard
        });
    } else if (text) {
        // Generalized handling for messages
        bot.sendChatAction(chatId, 'typing');
        const [session, data] = await Promise.all([getSession(), getSocietyData()]);

        // A. Search logic (PRIORITY: Specific name-based inquiries)
        const nameMatch = text.match(/(.+?)\s*(यांचे|यांची|यांचा|चे|ची|चा|)\s*(कर्ज|बचत|माहिती|लोन|balance|loan|karj|bajat)/i);
        if (nameMatch) {
            const searchTerms = nameMatch[1].toLowerCase().trim().split(/\s+/);
            const matches = (data?.members || []).filter((m: any) => {
                const memberName = m.name?.toLowerCase() || '';
                return searchTerms.every(term => memberName.includes(term));
            });
            if (matches.length === 0) return await bot.sendMessage(chatId, "❌ सापडले नाही.");
            if (matches.length > 1) return await bot.sendMessage(chatId, "⚠️ अनेक सदस्य सापडले. पूर्ण नाव वापरा.");
            const m = matches[0];
            const principal = m.loanPrincipal || 0;
            const interest = m.loanInterestDue || 0;
            const loanTotal = principal + interest;

            let msg = `👤 *${m.name}*\n🏘️ गाव: ${m.village || 'N/A'}\n`;
            if (principal === 0 && interest === 0) {
                msg += `✅ कर्ज नाही.`;
            } else {
                msg += `🏦 मुद्दल: ${formatCurrency(principal)}\n`;
                msg += `📈 व्याज: ${formatCurrency(interest)}\n`;
                msg += `💰 एकूण कर्ज: ${formatCurrency(loanTotal)}`;
            }
            return await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        }

        // B. Command/Button Logic (Handle slash commands or exact button text)
        if (lcText.startsWith('/') || lcText.includes('माहिती') || lcText.includes('शिल्लक') || lcText.includes('कर्ज')) {
            let type: 'info' | 'balance' | 'loan' = 'info';
            if (lcText.includes('balance') || lcText.includes('शिल्लक')) type = 'balance';
            else if (lcText.includes('loan') || lcText.includes('कर्ज')) type = 'loan';
            else type = 'info';

            if (!session?.memberId) return await bot.sendMessage(chatId, "⚠️ आधी /start करून नोंदणी करा.");
            const m = (data?.members || []).find((mem: any) => mem.id === session.memberId || mem.memberNo?.toString() === session.memberId);
            if (!m) return await bot.sendMessage(chatId, "❌ माहिती सापडली नाही.");

            const total = (m.savingsBalance || 0) + (m.shareBalance || 0) + (m.fdBalance || 0);
            const principal = m.loanPrincipal || 0;
            const interest = m.loanInterestDue || 0;
            const loanTotal = principal + interest;

            if (type === 'info') await bot.sendMessage(chatId, `👤 *तुमची माहिती (${m.name}):*\n🔢 *क्र:* ${m.memberNo}\n🏘️ *गाव:* ${m.village || 'N/A'}`, { parse_mode: 'Markdown' });
            if (type === 'balance') await bot.sendMessage(chatId, `💰 *तुमची शिल्लक (${m.name}):* ${formatCurrency(total)}`, { parse_mode: 'Markdown' });
            if (type === 'loan') {
                if (principal === 0 && interest === 0) {
                    await bot.sendMessage(chatId, `✅ *${m.name}*, तुमच्यावर कोणतेही कर्ज नाही.`);
                } else {
                    await bot.sendMessage(chatId, `🏦 *तुमचे कर्ज (${m.name}):*\n🔹 मुद्दल: ${formatCurrency(principal)}\n🔹 व्याज: ${formatCurrency(interest)}\n🔸 एकूण: ${formatCurrency(loanTotal)}`, { parse_mode: 'Markdown' });
                }
            }
            return;
        }

        // C. Registration (Member number lookup)
        if (session?.awaitingMemberNo || /^\d+$/.test(text)) {
            const member = (data?.members || []).find((m: any) => m.memberNo?.toString().trim() === text);
            if (member) {
                await saveSession({ chatId, awaitingMemberNo: false, memberId: member.id, name: member.name, memberNo: member.memberNo });
                return await bot.sendMessage(chatId, `✅ नोंदणी यशस्वी! नमस्कार ${member.name}.`, {
                    reply_markup: menuKeyboard
                });
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
