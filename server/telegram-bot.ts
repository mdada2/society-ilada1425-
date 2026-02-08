import TelegramBot from 'node-telegram-bot-api';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

// Load environment variables (Only locally)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    dotenv.config({ path: '.env.local' });
}

// In-memory types
interface UserSession {
    chatId: number;
    memberId?: string;
    memberNo?: string;
    name?: string;
    isAdmin?: boolean;
    awaitingMemberNo?: boolean;
}

// Bot token
const BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || '';
const IS_VERCEL = process.env.VERCEL === '1';

// Single entry point for initialization
let initializedBot: TelegramBot | null = null;
let db: any = null;

export async function initBot() {
    if (initializedBot) return { bot: initializedBot, db };

    console.log('🏁 Starting Bot Initialization Flow...');

    try {
        // 1. Initialize Firebase
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
        console.log('✅ Firebase Initialized');

        // 2. Initialize Bot
        if (!BOT_TOKEN) {
            throw new Error('VITE_TELEGRAM_BOT_TOKEN is missing');
        }

        initializedBot = new TelegramBot(BOT_TOKEN, { polling: !IS_VERCEL });
        console.log(`✅ Bot Instance Created (Polling: ${!IS_VERCEL})`);

        // 3. Setup Handlers
        setupBotHandlers(initializedBot, db);
        console.log('✅ Handlers Registered');

        return { bot: initializedBot, db };
    } catch (error: any) {
        console.error('❌ CRITICAL INITIALIZATION ERROR:', error.message);
        throw error;
    }
}

function setupBotHandlers(bot: TelegramBot, db: any) {
    console.log('🛠️ Registering Bot Handlers...');


    // Session persistence in Firestore
    async function getSession(chatId: number): Promise<UserSession | null> {
        try {
            const sessionRef = doc(db, "sessions", chatId.toString());
            const sessionSnap = await getDoc(sessionRef);
            if (sessionSnap.exists()) {
                console.log(`💾 Session FOUND for ${chatId}:`, sessionSnap.data());
                return sessionSnap.data() as UserSession;
            }
            console.log(`ℹ️ No session found in Firestore for ${chatId}`);
            return null;
        } catch (error) {
            console.error('❌ Error getting session:', error);
            return null;
        }
    }

    async function saveSession(chatId: number, session: UserSession): Promise<void> {
        try {
            const sessionRef = doc(db, "sessions", chatId.toString());
            // Remove undefined values to avoid Firestore errors
            const sanitized = JSON.parse(JSON.stringify(session));
            await setDoc(sessionRef, sanitized);
            console.log(`✅ Session SAVED for ${chatId}:`, sanitized);
        } catch (error) {
            console.error('❌ Error saving session:', error);
        }
    }

    // Helper: Get member by member number from Firestore
    async function getMemberByNo(memberNo: string): Promise<any | null> {
        try {
            const docRef = doc(db, "societies", "ilada_main");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const members = data.members || [];
                return members.find((m: any) => m.memberNo === memberNo) || null;
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

    // Helper: Search members by name from Firestore
    async function searchMembersByName(searchName: string): Promise<any[]> {
        try {
            console.log('🔍 Searching for member:', searchName);
            console.log('📡 Connecting to Firestore...');

            const docRef = doc(db, "societies", "ilada_main");
            const docSnap = await getDoc(docRef);
            console.log('📦 Firestore response received');

            if (docSnap.exists()) {
                const data = docSnap.data();
                const members = data.members || [];
                console.log('📊 Total members in database:', members.length);

                const matches = members.filter((member: any) => {
                    if (!member || !member.name) return false;
                    const memberName = member.name.toLowerCase();
                    const search = searchName.toLowerCase();
                    const isMatch = memberName.includes(search);
                    if (isMatch) {
                        console.log('✅ Found match:', member.name, '(Member No:', member.memberNo, ')');
                    }
                    return isMatch;
                });

                console.log('🎯 Total matches found:', matches.length);
                return matches;
            } else {
                console.log('❌ No members found - society data document does not exist');
                return [];
            }
        } catch (error) {
            console.error('❌ Error searching members:');
            console.error('Error:', error);
            return [];
        }
    }

    // Command: /start
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const userName = msg.from?.first_name || 'वापरकर्ता';

        const session: UserSession = {
            chatId,
            awaitingMemberNo: true
        };
        await saveSession(chatId, session);

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
        const session = await getSession(chatId);

        const helpMessage = `
📚 *उपलब्ध Commands:*

👤 *सदस्य माहिती (नोंदणी आवश्यक):*
/myinfo - माझी माहिती पहा
/balance - बचत, शेअर, FD पहा
/loan - कर्झाची माहिती पहा

📊 *अहवाल (Admin):*
/npa - NPA Summary
/members - एकूण सदस्य
/dispatch - आजचे dispatch

💬 *काहीही विचारा:*
उदा: "राज चे कर्ज किती?"
"धर्मा मुका टेंभुणे बचत"

${!session?.memberId ? '\n⚠️ *टीप:* काही कमांड्स वापरण्यासाठी प्रथम /start नी नोंदणी करा.' : ''}
`;

        bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });

    // Command: /myinfo
    bot.onText(/\/myinfo/, async (msg) => {
        const chatId = msg.chat.id;
        const session = await getSession(chatId);

        if (!session?.memberId) {
            bot.sendMessage(chatId, '⚠️ कृपया प्रथम /start command वापरून नोंदणी करा.');
            return;
        }

        try {
            const member = await getMemberById(session.memberId);

            if (member) {
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
        const session = await getSession(chatId);

        if (!session?.memberId) {
            bot.sendMessage(chatId, '⚠️ कृपया प्रथम /start command वापरून नोंदणी करा.');
            return;
        }

        try {
            const member = await getMemberById(session.memberId);

            if (member) {
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
        const session = await getSession(chatId);

        if (!session?.memberId) {
            bot.sendMessage(chatId, '⚠️ कृपया प्रथम /start command वापरून नोंदणी करा.');
            return;
        }

        try {
            const member = await getMemberById(session.memberId);

            if (member) {
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

    // Command: /npa (Admin)
    bot.onText(/\/npa/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            const docRef = doc(db, "societies", "ilada_main");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const members = docSnap.data().members || [];
                let totalPrincipal = 0;
                let totalInterest = 0;
                let npaCount = 0;

                members.forEach((m: any) => {
                    const principal = m.loanPrincipal || 0;
                    const interest = m.loanInterestDue || 0;
                    if (principal > 0) {
                        totalPrincipal += principal;
                        totalInterest += interest;
                        npaCount++;
                    }
                });

                const message = `
📊 *सोसायटी कर्ज अहवाल (NPA)*

👥 एकूण कर्जदार: ${npaCount}
💰 एकूण मुद्दल: ${formatCurrency(totalPrincipal)}
Interest: ${formatCurrency(totalInterest)}

📈 *एकूण थकबाकी:* ${formatCurrency(totalPrincipal + totalInterest)}
`;
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, '❌ डेटा उपलब्ध नाही.');
            }
        } catch (error) {
            console.error('Error in /npa:', error);
            bot.sendMessage(chatId, '❌ काहीतरी चूक झाली.');
        }
    });

    // Command: /dispatch (Admin)
    bot.onText(/\/dispatch/, async (msg) => {
        const chatId = msg.chat.id;
        try {
            const docRef = doc(db, "societies", "ilada_main");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const dispatches = docSnap.data().dispatches || [];
                const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

                const todaysDispatches = dispatches.filter((d: any) => d.date && d.date.startsWith(today));

                if (todaysDispatches.length === 0) {
                    bot.sendMessage(chatId, '📭 आज कोणतेही dispatch झालेले नाहीत.');
                    return;
                }

                let totalBags = 0;
                let summary = todaysDispatches.map((d: any, i: number) => {
                    totalBags += (d.bags || 0);
                    return `${i + 1}. गाड़ी: ${d.vehicleNo || 'N/A'} - ${d.bags || 0} बॅगा`;
                }).join('\n');

                const message = `
🚚 *आजचे Dispatch अहवाल*
📆 दिनांक: ${new Date().toLocaleDateString('en-IN')}

${summary}

📦 *एकूण बॅगा:* ${totalBags}
`;
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, '❌ डेटा उपलब्ध नाही.');
            }
        } catch (error) {
            console.error('Error in /dispatch:', error);
            bot.sendMessage(chatId, '❌ काहीतरी चूक झाली.');
        }
    });

    // Command: /members (Admin only)
    bot.onText(/\/members/, async (msg) => {
        const chatId = msg.chat.id;

        try {
            const docRef = doc(db, "societies", "ilada_main");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const members = docSnap.data().members || [];
                const totalCount = members.length;

                // Count by gender
                const maleCount = members.filter((m: any) => m.gender === 'पुरुष' || m.gender === 'Male').length;
                const femaleCount = members.filter((m: any) => m.gender === 'महिला' || m.gender === 'Female').length;
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

    // Helper: Get member by ID or MemberNo from Firestore
    async function getMemberById(idOrNo: string): Promise<any | null> {
        try {
            const docRef = doc(db, "societies", "ilada_main");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const members = docSnap.data().members || [];
                // Try matching by ID first, then by memberNo
                return members.find((m: any) => m.id === idOrNo || m.memberNo === idOrNo) || null;
            }
            return null;
        } catch (error) {
            console.error('Error getting member by ID:', error);
            return null;
        }
    }

    // Command: /test - Simple test to verify bot is working
    bot.onText(/\/test/, async (msg) => {
        const chatId = msg.chat.id;
        console.log('🧪 TEST command received from chat:', chatId);
        bot.sendMessage(chatId, '✅ Bot काम करतो आहे! Bot is working!');
    });

    // Handle text messages (registration + AI queries)
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text || '';

        console.log('\n🔔 NEW MESSAGE RECEIVED');
        console.log('Chat ID:', chatId);
        console.log('Text:', text);

        // Ignore if it's a command
        if (text.startsWith('/')) {
            console.log('❌ Ignoring - it\'s a command');
            return;
        }

        const session = await getSession(chatId);
        console.log('Session status:', session ? 'EXISTS' : 'NO SESSION');

        // FIRST: Check if user is asking about a member by name (WORKS WITHOUT LOGIN!)
        console.log('🔍 Checking for name-based pattern...');

        const namePatterns = [
            /(.+?)\s*(यांचे|यांची|यांचा|चे|ची|चा|)\s*(कर्ज|बचत|माहिती|लोन|balance|loan|karj|bajat)/i,  // Broad Marathi/English
            /^(.+?)\s+(कर्ज|बचत|लोन|loan|balance)$/i // Simple "Name Loan" format
        ];

        let targetMemberName: string | null = null;
        for (const pattern of namePatterns) {
            const match = text.match(pattern);
            if (match) {
                targetMemberName = match[1].trim();
                console.log('✅ Pattern matched! Member name:', targetMemberName);
                break;
            }
        }

        // If asking about specific member by name
        if (targetMemberName) {
            console.log('🎯 Processing name-based query...');
            try {
                bot.sendChatAction(chatId, 'typing');
                const matches = await searchMembersByName(targetMemberName);

                if (matches.length === 0) {
                    bot.sendMessage(chatId, `❌ "${targetMemberName}" नावाचा सभासद सापडला नाही.\n\nकृपया बरोबर नाव टाका.`);
                    return;
                }

                if (matches.length > 1) {
                    const memberList = matches.map((m: any, i: number) =>
                        `${i + 1}. ${m.name} (सदस्य क्र.: ${m.memberNo}) - ${m.village || 'N/A'}`
                    ).join('\n');

                    bot.sendMessage(chatId, `⚠️ *एकापेक्षा जास्त सभासद सापडले:*\n\n${memberList}\n\nकृपया सदस्य क्रमांकासह विचारा.`, { parse_mode: 'Markdown' });
                    return;
                }

                const targetMember = matches[0];
                const principal = targetMember.loanPrincipal || 0;
                const interest = targetMember.loanInterestDue || 0;
                const total = principal + interest;
                const savings = targetMember.savingsBalance || 0;
                const shares = targetMember.shareBalance || 0;
                const fd = targetMember.fdBalance || 0;

                const message = `
👤 *सभासद माहिती*

📛 नाव: ${targetMember.name}
🔢 सदस्य क्र.: ${targetMember.memberNo}
🏘️ गाव: ${targetMember.village || 'N/A'}

💰 *आर्थिक माहिती:*
├ बचत: ${formatCurrency(savings)}
├ शेअर: ${formatCurrency(shares)}
└ FD: ${formatCurrency(fd)}

🏦 *कर्ज तपशील:*
├ मुद्दल: ${formatCurrency(principal)}
├ व्याज: ${formatCurrency(interest)}
└ एकूण थकबाकी: ${formatCurrency(total)}

${targetMember.originalLoanDate ? `📅 कर्ज दिनांक: ${new Date(targetMember.originalLoanDate).toLocaleDateString('en-IN')}` : ''}
`;

                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error in name search:', error);
                bot.sendMessage(chatId, '❌ काहीतरी चूक झाली. पुन्हा प्रयत्न करा.');
            }
            return;
        }

        // SECOND: Handle member number registration
        if (session?.awaitingMemberNo) {
            console.log('📝 Processing member registration...');
            const memberNo = text.trim();

            // Validate member number
            const member = await getMemberByNo(memberNo);

            if (member) {
                // Update session
                session.awaitingMemberNo = false;
                // Ensure we have an identifier (id or memberNo)
                session.memberId = member.id || member.memberNo;
                session.memberNo = member.memberNo;
                session.name = member.name;
                await saveSession(chatId, session);

                const message = `
✅ *नोंदणी यशस्वी!*

📛 नाव: ${member.name}
🔢 सदस्य क्र.: ${member.memberNo}
${member.designation ? `👔 पद: ${member.designation}` : ''}

आता तुम्ही सर्व Commands वापरू शकता!
`;
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            } else {
                bot.sendMessage(chatId, `❌ सदस्य क्रमांक "${memberNo}" सापडला नाही.\n\nकृपया योग्य सदस्य क्रमांक पाठवा.`);
            }
            return;
        }

        // Handle AI queries (requires login or detected info)
        if (session?.memberId) {
            try {
                bot.sendChatAction(chatId, 'typing');
                console.log('📨 AI Query logic executing for:', session.name);

                const member = await getMemberById(session.memberId);

                if (member) {
                    const response = `
तुमची माहिती:
💰 बचत: ₹${member.savingsBalance || 0}
📊 शेअर: ₹${member.shareBalance || 0}
🏦 कर्ज मुद्दल: ₹${member.loanPrincipal || 0}
💳 कर्ज व्याज: ₹${member.loanInterestDue || 0}

अधिक माहितीसाठी commands वापरा:
/balance - संपूर्ण शिल्लक
/loan - कर्ज तपशील
/myinfo - माझी माहिती
`;
                    bot.sendMessage(chatId, response);
                }
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
    console.log('✅ All Bot Handlers Registered Successfully!');
}
