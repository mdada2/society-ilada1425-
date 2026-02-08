import TelegramBot from 'node-telegram-bot-api';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

// --- CONFIGURATION & STATE ---
const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || '';
const IS_VERCEL = process.env.VERCEL === '1';

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
            genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
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

    async function getSession(chatId: number): Promise<UserSession | null> {
        const snap = await getDoc(doc(db, "sessions", chatId.toString()));
        return snap.exists() ? (snap.data() as UserSession) : null;
    }

    async function saveSession(chatId: number, session: UserSession) {
        await setDoc(doc(db, "sessions", chatId.toString()), JSON.parse(JSON.stringify(session)));
    }

    async function getMemberByNo(memberNo: string) {
        const snap = await getDoc(doc(db, "societies", "ilada_main"));
        if (snap.exists()) {
            return (snap.data().members || []).find((m: any) => m.memberNo === memberNo);
        }
        return null;
    }

    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        await saveSession(chatId, { chatId, awaitingMemberNo: true });
        bot.sendMessage(chatId, "🙏 नमस्कार! कृपया तुमचा *सदस्य क्रमांक* पाठवा. (उदा: 101)", { parse_mode: 'Markdown' });
    });

    bot.onText(/\/test/, (msg) => {
        bot.sendMessage(msg.chat.id, "✅ Bot Active! (Single-File Mode)");
    });

    bot.on('message', async (msg) => {
        if (msg.text?.startsWith('/')) return;
        const chatId = msg.chat.id;
        const session = await getSession(chatId);

        if (session?.awaitingMemberNo) {
            const member = await getMemberByNo(msg.text || '');
            if (member) {
                await saveSession(chatId, { ...session, awaitingMemberNo: false, memberId: member.id, name: member.name });
                bot.sendMessage(chatId, `✅ नोंदणी यशस्वी! नमस्कार ${member.name}.`);
            } else {
                bot.sendMessage(chatId, "❌ सदस्य सापडला नाही. पुन्हा प्रयत्न करा.");
            }
        }
    });
}

// --- VERCEL HANDLER ---
export default async function handler(req: any, res: any) {
    if (req.method === 'POST') {
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
