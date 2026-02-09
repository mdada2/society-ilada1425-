import TelegramBot from 'node-telegram-bot-api';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

// --- GLOBAL PERSISTENT STATE ---
// This lives across warm invocations on Vercel
let initializedBot: TelegramBot | null = null;
let db: any = null;
let genAI: any = null;

// Persistent cache for society data (Invalidates after 2 minutes)
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
    if (initializedBot) {
        console.log('♻️ Reusing existing bot instance (warm start)');
        return { bot: initializedBot, db, genAI };
    }

    console.log('🔧 Initializing bot (cold start)...');
    console.log('📊 Environment check:');
    console.log('  - VITE_TELEGRAM_BOT_TOKEN:', process.env.VITE_TELEGRAM_BOT_TOKEN ? 'SET ✅' : 'MISSING ❌');
    console.log('  - TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'SET ✅' : 'MISSING ❌');
    console.log('  - GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET ✅' : 'MISSING ❌');
    console.log('  - VERCEL:', process.env.VERCEL ? 'SET ✅' : 'MISSING ❌');
    console.log('  - BOT_TOKEN value:', BOT_TOKEN ? `${BOT_TOKEN.substring(0, 10)}...` : 'EMPTY ❌');

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

    if (!BOT_TOKEN) {
        const error = 'BOT_TOKEN missing - neither VITE_TELEGRAM_BOT_TOKEN nor TELEGRAM_BOT_TOKEN are set';
        console.error('❌', error);
        throw new Error(error);
    }

    initializedBot = new TelegramBot(BOT_TOKEN, { polling: !IS_VERCEL });
    console.log('🤖 TelegramBot instance created, setting up handlers...');
    setupBotHandlers(initializedBot, db);
    console.log('✅ Bot initialization complete');

    return { bot: initializedBot, db, genAI };
}

// --- OPTIMIZED HANDLERS ---
function setupBotHandlers(bot: TelegramBot, firestore: any) {
    console.log('🎯 Setting up bot handlers...');
    const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

    async function getSocietyData() {
        const now = Date.now();
        if (globalSocietyCache && (now - lastCacheUpdate < CACHE_TTL)) {
            console.log('⚡ Using Warm Cache');
            console.log('📊 Cached members count:', globalSocietyCache.members?.length || 0);
            return globalSocietyCache;
        }

        console.log('📡 Fetching Fresh Data from Firestore...');
        try {
            const snap = await getDoc(doc(firestore, "societies", "ilada_main"));
            console.log('📡 Firestore response - exists:', snap.exists());

            if (snap.exists()) {
                const data = snap.data();
                console.log('📊 Members in Firestore:', data.members?.length || 0);
                console.log('📊 Sample member:', data.members?.[0] ? `${data.members[0].name} (#${data.members[0].memberNo})` : 'None');

                globalSocietyCache = data;
                lastCacheUpdate = now;
                return globalSocietyCache;
            } else {
                console.error('❌ Firestore document "societies/ilada_main" does not exist!');
                return null;
            }
        } catch (error: any) {
            console.error('❌ Error fetching society data:', error.message);
            console.error('Stack:', error.stack);
            return null;
        }
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
        } catch (e) { console.error('Save error:', e); }
    }

    // --- COMMAND FLOWS ---

    bot.onText(/^\/start$/, async (msg) => {
        console.log('🚀 /start command received from', msg.chat.id);
        const chatId = msg.chat.id;
        await saveSession(chatId, { chatId, awaitingMemberNo: true });
        bot.sendMessage(chatId, "🙏 नमस्कार! कृपया तुमचा *सदस्य क्रमांक* पाठवा (उदा: 101).", { parse_mode: 'Markdown' });
    });

    bot.onText(/^\/help$/, (msg) => {
        console.log('📚 /help command received from', msg.chat.id);
        bot.sendMessage(msg.chat.id, "📚 /myinfo, /balance, /loan\n💬 किंवा विचारा: *'प्रदीप चे कर्ज'*", { parse_mode: 'Markdown' });
    });

    async function handleCommand(msg: TelegramBot.Message, type: 'info' | 'balance' | 'loan') {
        const chatId = msg.chat.id;
        // Parallel fetch for speed
        const [session, data] = await Promise.all([getSession(chatId), getSocietyData()]);

        if (!session?.memberId) return bot.sendMessage(chatId, "⚠️ आधी /start करून नोंदणी करा.");
        const m = (data?.members || []).find((mem: any) => mem.id === session.memberId || mem.memberNo?.toString() === session.memberId);
        if (!m) return bot.sendMessage(chatId, "❌ माहिती सापडली नाही.");

        const total = (m.savingsBalance || 0) + (m.shareBalance || 0) + (m.fdBalance || 0);
        const loanTotal = (m.loanPrincipal || 0) + (m.loanInterestDue || 0);

        if (type === 'info') bot.sendMessage(chatId, `👤 *नाव:* ${m.name}\n🔢 *क्र:* ${m.memberNo}\n🏘️ *गाव:* ${m.village || 'N/A'}`, { parse_mode: 'Markdown' });
        if (type === 'balance') bot.sendMessage(chatId, `💰 *शिल्लक:* ${formatCurrency(total)}`, { parse_mode: 'Markdown' });
        if (type === 'loan') bot.sendMessage(chatId, m.loanPrincipal === 0 ? "✅ कर्ज नाही." : `🏦 *कर्ज:* ${formatCurrency(loanTotal)}`, { parse_mode: 'Markdown' });
    }

    bot.onText(/^\/myinfo$/, (msg) => handleCommand(msg, 'info'));
    bot.onText(/^\/balance$/, (msg) => handleCommand(msg, 'balance'));
    bot.onText(/^\/loan$/, (msg) => handleCommand(msg, 'loan'));

    // --- MESSAGE PROCESSING ---
    bot.on('message', async (msg) => {
        const text = (msg.text || '').trim();
        if (text.startsWith('/') || !text) return;

        const chatId = msg.chat.id;
        console.log('💬 Message received:', text, 'from chat:', chatId);

        // Start typing immediately
        bot.sendChatAction(chatId, 'typing');

        const [session, data] = await Promise.all([getSession(chatId), getSocietyData()]);
        console.log('📊 Session:', session ? 'Found' : 'Not found');
        console.log('📊 Data:', data ? `Loaded (${data.members?.length || 0} members)` : 'Not loaded');

        // A. Search logic
        const nameMatch = text.match(/(.+?)\s*(यांचे|यांची|यांचा|चे|ची|चा|)\s*(कर्ज|बचत|माहिती|लोन|balance|loan|karj|bajat)/i);
        if (nameMatch) {
            console.log('🔍 Name search triggered:', nameMatch[1]);
            const search = nameMatch[1].toLowerCase().trim();
            const matches = (data?.members || []).filter((m: any) => m.name?.toLowerCase().includes(search));
            console.log('🔍 Search results:', matches.length, 'matches found');

            if (matches.length === 0) return bot.sendMessage(chatId, "❌ सापडले नाही.");
            if (matches.length > 1) return bot.sendMessage(chatId, "⚠️ अनेक सदस्य सापडले. पूर्ण नाव वापरा.");
            const m = matches[0];
            return bot.sendMessage(chatId, `👤 *${m.name}*\n🏘️ गाव: ${m.village || 'N/A'}\n🏦 कर्ज: ${formatCurrency((m.loanPrincipal || 0) + (m.loanInterestDue || 0))}`, { parse_mode: 'Markdown' });
        }

        // B. Registration
        if (session?.awaitingMemberNo || /^\d+$/.test(text)) {
            console.log('🔢 Member number lookup:', text);
            console.log('🔢 Awaiting member no:', session?.awaitingMemberNo);

            const member = (data?.members || []).find((m: any) => m.memberNo?.toString().trim() === text);
            console.log('🔢 Member found:', member ? `Yes (${member.name})` : 'No');

            if (member) {
                await saveSession(chatId, { chatId, awaitingMemberNo: false, memberId: member.id, name: member.name, memberNo: member.memberNo });
                return bot.sendMessage(chatId, `✅ नोंदणी यशस्वी! नमस्कार ${member.name}.`);
            } else if (session?.awaitingMemberNo) {
                return bot.sendMessage(chatId, "❌ सदस्य सापडला नाही.");
            }
        }

        console.log('⚠️ No handler matched for message:', text);
    });
}

// --- VERCEL HANDLER ---
export default async function handler(req: any, res: any) {
    // Always set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

    if (req.method === 'POST') {
        console.log('📨 Webhook POST received');
        console.log('Body:', JSON.stringify(req.body, null, 2));

        try {
            // Initialize bot
            const { bot } = await initBot();
            console.log('✅ Bot initialized');

            // Validate webhook body
            if (!req.body || typeof req.body !== 'object') {
                console.error('❌ Invalid webhook body - not an object');
                return res.status(200).send('OK'); // Still return 200 to Telegram
            }

            if (!req.body.update_id) {
                console.error('❌ Invalid webhook body - missing update_id');
                return res.status(200).send('OK'); // Still return 200 to Telegram
            }

            console.log('📝 Processing update ID:', req.body.update_id);

            // Process the update - wrap in try-catch to prevent crashes
            try {
                await bot.processUpdate(req.body);
                console.log('✅ Update processed successfully');
            } catch (processError: any) {
                console.error('❌ Error processing update:', processError.message);
                console.error('Stack:', processError.stack);
                // Don't throw - just log and continue
            }

            // ALWAYS return 200 OK to Telegram
            return res.status(200).send('OK');

        } catch (initError: any) {
            console.error('❌ Initialization error:', initError.message);
            console.error('Stack:', initError.stack);
            // STILL return 200 OK to prevent Telegram from marking webhook as failed
            return res.status(200).send('OK');
        }
    }

    // GET request - diagnostics
    try {
        const { bot } = await initBot();
        const webhookInfo = await bot.getWebHookInfo();
        return res.status(200).json({
            status: 'running',
            webhook_url: webhookInfo.url,
            pending_updates: webhookInfo.pending_update_count,
            last_error: webhookInfo.last_error_message,
            last_error_date: webhookInfo.last_error_date,
            cache: !!globalSocietyCache,
            timestamp: new Date().toISOString()
        });
    } catch (e: any) {
        console.error('❌ Diagnostics error:', e.message);
        return res.status(200).json({
            status: 'error',
            message: e.message,
            stack: e.stack
        });
    }
}
