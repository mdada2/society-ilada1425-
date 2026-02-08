import TelegramBot from 'node-telegram-bot-api';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, child } from 'firebase/database';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDAJsPacF8j8DdUpHqGKPSNcjnE67eGxs8",
    authDomain: "studio-70628387-62b15.firebaseapp.com",
    databaseURL: "https://studio-70628387-62b15-default-rtdb.firebaseio.com",
    projectId: "studio-70628387-62b15",
    storageBucket: "studio-70628387-62b15.firebasestorage.app",
    messagingSenderId: "851892826071",
    appId: "1:851892826071:web:a6b47e0fe81b8e61bd05d9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Bot token
const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || '';

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
    process.exit(1);
}

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Society Mitra Telegram Bot Started!');

// In-memory user sessions
interface UserSession {
    chatId: number;
    memberId?: string;
    memberNo?: string;
    name?: string;
    isAdmin?: boolean;
    awaitingMemberNo?: boolean;
}

const userSessions: Map<number, UserSession> = new Map();

// Helper: Get member by member number
async function getMemberByNo(memberNo: string) {
    try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, 'members'));

        if (snapshot.exists()) {
            const members = snapshot.val();
            const memberEntry = Object.entries(members).find(
                ([_, member]: [string, any]) => member.memberNo === memberNo
            );

            if (memberEntry) {
                const [id, memberData] = memberEntry;
                return { id, ...(memberData as Record<string, any>) };
            }
        }
        return null;
    } catch (error) {
        console.error('Error fetching member:', error);
        return null;
    }
}

// Helper: Format currency
function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString('en-IN')}`;
}

// Command: /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from?.first_name || 'वापरकर्ता';

    // Initialize session
    userSessions.set(chatId, {
        chatId,
        awaitingMemberNo: true
    });

    const welcomeMessage = `
🙏 नमस्कार ${userName}!

Welcome to *Society Mitra AI* - तुमचा डिजिटल सहाय्यक!

मी तुम्हाला तुमच्या सोसायटीच्या माहितीत मदत करू शकतो.

📋 *सुरू करण्यासाठी:*
कृपया तुमचा *सदस्य क्रमांक* पाठवा.

उदा: 101
`;

    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Command: /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);

    if (!session?.memberId) {
        bot.sendMessage(chatId, '⚠️ कृपया प्रथम /start command वापरून नोंदणी करा.');
        return;
    }

    const helpMessage = `
📚 *उपलब्ध Commands:*

👤 *सदस्य माहिती:*
/myinfo - माझी माहिती पहा
/balance - बचत, शेअर, FD पहा
/loan - कर्झाची माहिती पहा

📊 *अहवाल (Admin):*
/npa - NPA Summary
/members - एकूण सदस्य
/dispatch - आजचे dispatch

💬 *AI चॅट:*
कोणताही प्रश्न विचारा आणि मी उत्तर देईन!

उदा:
"माझी बचत किती आहे?"
"या महिन्यात किती dispatch झाले?"
`;

    bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Command: /myinfo
bot.onText(/\/myinfo/, async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);

    if (!session?.memberId) {
        bot.sendMessage(chatId, '⚠️ कृपया प्रथम /start command वापरून नोंदणी करा.');
        return;
    }

    try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `members/${session.memberId}`));

        if (snapshot.exists()) {
            const member = snapshot.val();

            const message = `
👤 *सदस्य माहिती*

📛 नाव: ${member.name}
🔢 सदस्य क्र.: ${member.memberNo}
📱 मोबाईल: ${member.mobile || 'N/A'}
🏘️ गाव: ${member.village || 'N/A'}
👥 लिंग: ${member.gender || 'N/A'}
📂 प्रवर्ग: ${member.category || 'N/A'}
`;

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, '❌ सदस्य माहिती उपलब्ध नाही.');
        }
    } catch (error) {
        console.error('Error in /myinfo:', error);
        bot.sendMessage(chatId, '❌ काहीतरी चूक झाली. पुन्हा प्रयत्न करा.');
    }
});

// Command: /balance
bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);

    if (!session?.memberId) {
        bot.sendMessage(chatId, '⚠️ कृपया प्रथम /start command वापरून नोंदणी करा.');
        return;
    }

    try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `members/${session.memberId}`));

        if (snapshot.exists()) {
            const member = snapshot.val();

            const savings = member.savingsBalance || 0;
            const shares = member.shareBalance || 0;
            const fd = member.fdBalance || 0;
            const total = savings + shares + fd;

            const message = `
💰 *आर्थिक माहिती*

📛 नाव: ${member.name}
🔢 सदस्य क्र.: ${member.memberNo}

💵 *शिल्लक:*
├ बचत: ${formatCurrency(savings)}
├ शेअर: ${formatCurrency(shares)}
└ FD: ${formatCurrency(fd)}

📈 *एकूण:* ${formatCurrency(total)}
`;

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, '❌ सदस्य माहिती उपलब्ध नाही.');
        }
    } catch (error) {
        console.error('Error in /balance:', error);
        bot.sendMessage(chatId, '❌ काहीतरी चूक झाली. पुन्हा प्रयत्न करा.');
    }
});

// Command: /loan
bot.onText(/\/loan/, async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);

    if (!session?.memberId) {
        bot.sendMessage(chatId, '⚠️ कृपया प्रथम /start command वापरून नोंदणी करा.');
        return;
    }

    try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, `members/${session.memberId}`));

        if (snapshot.exists()) {
            const member = snapshot.val();

            const principal = member.loanPrincipal || 0;
            const interest = member.loanInterestDue || 0;
            const total = principal + interest;

            if (principal === 0) {
                bot.sendMessage(chatId, '✅ तुम्हाला कोणतेही कर्ज नाही!');
                return;
            }

            const message = `
🏦 *कर्ज माहिती*

📛 नाव: ${member.name}
🔢 सदस्य क्र.: ${member.memberNo}

💳 *कर्ज तपशील:*
├ मुद्दल: ${formatCurrency(principal)}
├ व्याज: ${formatCurrency(interest)}
└ एकूण थकबाकी: ${formatCurrency(total)}

${member.loanDate ? `📅 कर्ज दिनांक: ${new Date(member.loanDate).toLocaleDateString('en-IN')}` : ''}
`;

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, '❌ सदस्य माहिती उपलब्ध नाही.');
        }
    } catch (error) {
        console.error('Error in /loan:', error);
        bot.sendMessage(chatId, '❌ काहीतरी चूक झाली. पुन्हा प्रयत्न करा.');
    }
});

// Command: /members (Admin only)
bot.onText(/\/members/, async (msg) => {
    const chatId = msg.chat.id;
    const session = userSessions.get(chatId);

    if (!session?.memberId) {
        bot.sendMessage(chatId, '⚠️ कृपया प्रथम /start command वापरून नोंदणी करा.');
        return;
    }

    try {
        const dbRef = ref(database);
        const snapshot = await get(child(dbRef, 'members'));

        if (snapshot.exists()) {
            const members = snapshot.val();
            const totalCount = Object.keys(members).length;

            // Count by gender
            const maleCount = Object.values(members).filter((m: any) => m.gender === 'पुरुष').length;
            const femaleCount = Object.values(members).filter((m: any) => m.gender === 'महिला').length;
            const otherCount = totalCount - maleCount - femaleCount;

            const message = `
👥 *सदस्य सांख्यिकी*

📊 *एकूण सदस्य:* ${totalCount}

👤 *लिंगानुसार:*
├ पुरुष: ${maleCount}
├ महिला: ${femaleCount}
└ इतर: ${otherCount}
`;

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, '❌ सदस्य माहिती उपलब्ध नाही.');
        }
    } catch (error) {
        console.error('Error in /members:', error);
        bot.sendMessage(chatId, '❌ काहीतरी चूक झाली. पुन्हा प्रयत्न करा.');
    }
});

// Handle text messages (registration + AI queries)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';

    // Ignore if it's a command
    if (text.startsWith('/')) return;

    const session = userSessions.get(chatId);

    // Handle member number registration
    if (session?.awaitingMemberNo) {
        const memberNo = text.trim();

        // Validate member number
        const member = await getMemberByNo(memberNo);

        if (member) {
            // Update session
            userSessions.set(chatId, {
                chatId,
                memberId: member.id,
                memberNo: member.memberNo,
                name: member.name,
                isAdmin: member.designation === 'अध्यक्ष' || member.designation === 'उपाध्यक्ष',
                awaitingMemberNo: false
            });

            const message = `
✅ *नोंदणी यशस्वी!*

नमस्कार ${member.name}! 👋

तुमची नोंदणी पूर्ण झाली आहे.

📋 आता तुम्ही:
• /help - सर्व commands पहा
• /balance - शिल्लक पहा
• /loan - कर्ज पहा
• किंवा मला काहीही विचारा!

उदा: "माझी बचत किती आहे?"
`;

            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        } else {
            bot.sendMessage(chatId, `❌ सदस्य क्रमांक "${memberNo}" सापडला नाही.\n\nकृपया योग्य सदस्य क्रमांक पाठवा.`);
        }
        return;
    }

    // Handle AI queries
    if (session?.memberId) {
        try {
            bot.sendChatAction(chatId, 'typing');

            // Get member data for context
            const dbRef = ref(database);
            const memberSnapshot = await get(child(dbRef, `members/${session.memberId}`));
            const member = memberSnapshot.val();

            // Prepare context for AI
            const context = `
User: ${member.name} (Member No: ${member.memberNo})
Query: ${text}

Member Details:
- Savings: ₹${member.savingsBalance || 0}
- Shares: ₹${member.shareBalance || 0}
- Loan Principal: ₹${member.loanPrincipal || 0}
- Loan Interest: ₹${member.loanInterestDue || 0}

Respond in Marathi and English (bilingual). Be concise and helpful.
`;

            // Call Gemini AI
            const model = genAI.createTextGenerator({ model: 'gemini-2.0-flash-exp' });
            const result = await model.generate(context);
            const response = result.text;

            bot.sendMessage(chatId, response || '❌ Sorry, I could not process your query.');
        } catch (error) {
            console.error('Error in AI query:', error);
            bot.sendMessage(chatId, '❌ काहीतरी चूक झाली. पुन्हा प्रयत्न करा.');
        }
    } else {
        bot.sendMessage(chatId, '⚠️ कृपया प्रथम /start command वापरून नोंदणी करा.');
    }
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

console.log('🚀 Bot is ready and listening for messages...');
