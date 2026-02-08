import TelegramBot from 'node-telegram-bot-api';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

// --- CONFIGURATION & STATE ---
const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || '';
const IS_VERCEL = !!process.env.VERCEL;

let initializedBot: TelegramBot | null = null;
let db: any = null;
let genAI: any = null;

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
function setupBotHandlers(bot: TelegramBot, db: any) {
    const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

    // Session persistence
    async function getSession(chatId: number): Promise<UserSession | null> {
        try {
            const snap = await getDoc(doc(db, "sessions", chatId.toString()));
            return snap.exists() ? (snap.data() as UserSession) : null;
        } catch (e) { return null; }
    }

    async function saveSession(chatId: number, session: UserSession) {
        try {
            await setDoc(doc(db, "sessions", chatId.toString()), JSON.parse(JSON.stringify(session)));
        } catch (e) { console.error('Save session error:', e); }
    }

    // Member search/helpers
    async function getMemberByNo(memberNo: string) {
        const snap = await getDoc(doc(db, "societies", "ilada_main"));
        if (!snap.exists()) return null;
        const members = snap.data().members || [];
        // Support both number and string matching, trimmed
        const search = memberNo.toString().trim();
        return members.find((m: any) => m.memberNo?.toString().trim() === search) || null;
    }

    async function getMemberById(id: string) {
        const snap = await getDoc(doc(db, "societies", "ilada_main"));
        if (!snap.exists()) return null;
        return (snap.data().members || []).find((m: any) => m.id === id || m.memberNo?.toString() === id) || null;
    }

    async function searchMembersByName(searchName: string) {
        const snap = await getDoc(doc(db, "societies", "ilada_main"));
        if (!snap.exists()) return [];
        const search = searchName.toLowerCase().trim();
        return (snap.data().members || []).filter((m: any) => m.name?.toLowerCase().includes(search));
    }

    // --- COMMANDS ---

    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const userName = msg.from?.first_name || 'वापरकर्ता';
        await saveSession(chatId, { chatId, awaitingMemberNo: true });

        bot.sendMessage(chatId, `
🙏 नमस्कार ${userName}!
Welcome to *Society Mitra AI*!

मी तुम्हाला तुमच्या सोसायटीच्या माहितीत मदत करू शकतो.

📋 *सुरू करण्यासाठी:*
तुमचा *सदस्य क्रमांक* पाठवा (उदा: 101).
`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, `
📚 *कमांड्स:*
/myinfo - माझी माहिती
/balance - बचत/शेअर माहिती
/loan - कर्जाची माहिती
/npa - NPA रिपोर्ट (Admin)
/members - सदस्य संख्या
/start - पुन्हा नोंदणी

💬 *काहीही विचारा:*
उदा: "प्रदीप चे कर्ज किती?"
`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/myinfo/, async (msg) => {
        const chatId = msg.chat.id;
        const session = await getSession(chatId);
        if (!session?.memberId) return bot.sendMessage(chatId, "⚠️ आधी /start करून नोंदणी करा.");

        const m = await getMemberById(session.memberId);
        if (!m) return bot.sendMessage(chatId, "❌ माहिती सापडली नाही.");

        bot.sendMessage(chatId, `👤 *माहिती*\n\n📛 नाव: ${m.name}\n🔢 क्र: ${m.memberNo}\n🏘️ गाव: ${m.village || 'N/A'}\n📱 मोबाईल: ${m.mobile || 'N/A'}`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/balance/, async (msg) => {
        const chatId = msg.chat.id;
        const session = await getSession(chatId);
        if (!session?.memberId) return bot.sendMessage(chatId, "⚠️ आधी /start करून नोंदणी करा.");

        const m = await getMemberById(session.memberId);
        if (!m) return bot.sendMessage(chatId, "❌ माहिती सापडली नाही.");

        const savings = m.savingsBalance || 0;
        const shares = m.shareBalance || 0;
        const fd = m.fdBalance || 0;

        bot.sendMessage(chatId, `💰 *शिल्लक*\n\n├ बचत: ${formatCurrency(savings)}\n├ शेअर: ${formatCurrency(shares)}\n└ FD: ${formatCurrency(fd)}\n\n📈 *एकूण:* ${formatCurrency(savings + shares + fd)}`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/loan/, async (msg) => {
        const chatId = msg.chat.id;
        const session = await getSession(chatId);
        if (!session?.memberId) return bot.sendMessage(chatId, "⚠️ आधी /start करून नोंदणी करा.");

        const m = await getMemberById(session.memberId);
        if (!m) return bot.sendMessage(chatId, "❌ माहिती सापडली नाही.");

        const principal = m.loanPrincipal || 0;
        const interest = m.loanInterestDue || 0;

        if (principal === 0) return bot.sendMessage(chatId, "✅ तुम्हाला कोणतेही कर्ज नाही.");

        bot.sendMessage(chatId, `🏦 *कर्ज*\n\n├ मुद्दल: ${formatCurrency(principal)}\n├ व्याज: ${formatCurrency(interest)}\n└ एकूण: ${formatCurrency(principal + interest)}`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/npa/, async (msg) => {
        const snap = await getDoc(doc(db, "societies", "ilada_main"));
        if (!snap.exists()) return bot.sendMessage(msg.chat.id, "❌ डेटा नाही.");
        const members = snap.data().members || [];
        let p = 0, i = 0, count = 0;
        members.forEach((m: any) => {
            if (m.loanPrincipal > 0) { p += m.loanPrincipal; i += (m.loanInterestDue || 0); count++; }
        });
        bot.sendMessage(msg.chat.id, `📊 *NPA Summary*\n\n👥 कर्जदार: ${count}\n💰 मुद्दल: ${formatCurrency(p)}\n💹 व्याज: ${formatCurrency(i)}\n\n📈 *एकूण:* ${formatCurrency(p + i)}`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/test/, (msg) => { bot.sendMessage(msg.chat.id, "✅ Bot Active! (Recovery Mode)"); });

    // --- GENERAL LOGIC ---
    bot.on('message', async (msg) => {
        if (msg.text?.startsWith('/')) return;
        const chatId = msg.chat.id;
        const text = msg.text || '';
        const session = await getSession(chatId);

        // 1. Name search detection
        const nameMatch = text.match(/(.+?)\s*(यांचे|यांची|यांचा|चे|ची|चा|)\s*(कर्ज|बचत|माहिती|लोन|balance|loan|karj|bajat)/i);
        if (nameMatch) {
            bot.sendChatAction(chatId, 'typing');
            const matches = await searchMembersByName(nameMatch[1]);
            if (matches.length === 0) return bot.sendMessage(chatId, "❌ नाव सापडले नाही.");
            if (matches.length > 1) {
                const list = matches.slice(0, 5).map((m, i) => `${i + 1}. ${m.name} (${m.memberNo})`).join('\n');
                return bot.sendMessage(chatId, `⚠️ अनेक सदस्य सापडले:\n${list}\n\nकृपया पूर्ण नाव किंवा सदस्य क्र. वापरा.`);
            }
            const m = matches[0];
            bot.sendMessage(chatId, `👤 *${m.name}* (${m.memberNo})\n\n💰 बचत: ${formatCurrency(m.savingsBalance || 0)}\n🏦 कर्ज: ${formatCurrency((m.loanPrincipal || 0) + (m.loanInterestDue || 0))}`, { parse_mode: 'Markdown' });
            return;
        }

        // 2. Registration handling
        if (session?.awaitingMemberNo) {
            bot.sendChatAction(chatId, 'typing');
            const member = await getMemberByNo(text);
            if (member) {
                await saveSession(chatId, { ...session, awaitingMemberNo: false, memberId: member.id, name: member.name });
                bot.sendMessage(chatId, `✅ *नोंदणी यशस्वी!*\n\nनमस्कार ${member.name}. आता तुम्ही माहिती विचारू शकता.`, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, "❌ सदस्य क्रमांक सापडला नाही. कृपया पुन्हा प्रयत्न करा.");
            }
            return;
        }

        // 3. Fallback / AI
        if (session?.memberId) {
            bot.sendMessage(chatId, "पुढील माहितीसाठी कमांड वापरा: /myinfo, /balance, /loan");
        }
    });

    console.log('✅ Handlers setup complete');
}

// --- VERCEL HANDLER ---
export default async function handler(req: any, res: any) {
    if (req.method === 'POST') {
        try {
            const { bot } = await initBot();
            await bot.processUpdate(req.body);
            return res.status(200).send('OK');
        } catch (error: any) {
            console.error('API POST Error:', error.message);
            return res.status(200).json({ status: 'error', message: error.message });
        }
    }

    try {
        const { bot } = await initBot();
        const info = await bot.getWebHookInfo();
        return res.status(200).json({
            status: 'running',
            webhook: info.url,
            pending: info.pending_update_count,
            time: new Date().toISOString()
        });
    } catch (e: any) {
        return res.status(200).json({ status: 'error', message: e.message });
    }
}
