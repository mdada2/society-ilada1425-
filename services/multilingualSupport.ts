import { VoiceCommand, TranslationEntry, BilingualResponse } from '../types';

// ============================================================================
// PHASE 9: MULTILINGUAL SUPPORT
// ============================================================================

// --- 1. Marathi Voice Commands Dictionary ---
export const marathiVoiceCommands: VoiceCommand[] = [
    // Analysis commands
    { id: '1', marathiCommand: 'विश्लेषण दाखवा', englishEquivalent: 'show analysis', action: '/analyze', confidence: 95, alternates: ['विश्लेषण', 'अहवाल दाखवा'] },
    { id: '2', marathiCommand: 'अंदाज दाखवा', englishEquivalent: 'show prediction', action: '/predict', confidence: 90, alternates: ['अंदाज', 'भविष्यवाणी'] },

    // Member commands
    { id: '3', marathiCommand: 'सदस्य शोधा', englishEquivalent: 'search members', action: '/search', confidence: 95, alternates: ['सदस्य', 'शोध'] },
    { id: '4', marathiCommand: 'गाव निहाय', englishEquivalent: 'village wise', action: '/village', confidence: 90, alternates: ['गावानुसार', 'गाव'] },

    // Loan commands
    { id: '5', marathiCommand: 'कर्ज पात्रता', englishEquivalent: 'loan eligibility', action: '/eligibility', confidence: 95, alternates: ['पात्रता', 'कर्ज'] },
    { id: '6', marathiCommand: 'कर्ज अंदाज', englishEquivalent: 'loan forecast', action: '/predictloans', confidence: 90, alternates: ['कर्ज भविष्यवाणी'] },

    // Report commands
    { id: '7', marathiCommand: 'नफा तोटा', englishEquivalent: 'profit loss', action: '/profitloss', confidence: 95, alternates: ['नफा', 'तोटा', 'लाभ हानी'] },
    { id: '8', marathiCommand: 'अहवाल तयार करा', englishEquivalent: 'generate report', action: '/autoreport', confidence: 90, alternates: ['अहवाल', 'रिपोर्ट'] },

    // Notification commands
    { id: '9', marathiCommand: 'आठवण दाखवा', englishEquivalent: 'show reminders', action: '/reminders', confidence: 95, alternates: ['आठवण', 'स्मरणपत्र'] },
    { id: '10', marathiCommand: 'सूचना दाखवा', englishEquivalent: 'show notifications', action: '/notifications', confidence: 90, alternates: ['सूचना'] },

    // Document commands
    { id: '11', marathiCommand: 'कर्ज करार', englishEquivalent: 'loan agreement', action: '/loanagreement', confidence: 95, alternates: ['करार'] },
    { id: '12', marathiCommand: 'पावती तयार करा', englishEquivalent: 'generate receipt', action: '/receipt', confidence: 90, alternates: ['पावती'] },

    // Workflow commands
    { id: '13', marathiCommand: 'स्वयं वर्गीकरण', englishEquivalent: 'auto categorize', action: '/autocategorize', confidence: 85, alternates: ['वर्गीकरण'] },
    { id: '14', marathiCommand: 'समेट करा', englishEquivalent: 'reconcile', action: '/reconcile', confidence: 90, alternates: ['समेट', 'तपासणी'] },
    { id: '15', marathiCommand: 'बॅकअप घ्या', englishEquivalent: 'take backup', action: '/backup', confidence: 95, alternates: ['बॅकअप', 'प्रत'] },
];

// --- 2. Translation Dictionary ---
export const translationDictionary: TranslationEntry[] = [
    // UI Elements
    { id: 'ui_1', english: 'Members', marathi: 'सदस्य', category: 'ui' },
    { id: 'ui_2', english: 'Transactions', marathi: 'व्यवहार', category: 'ui' },
    { id: 'ui_3', english: 'Reports', marathi: 'अहवाल', category: 'ui' },
    { id: 'ui_4', english: 'Settings', marathi: 'सेटिंग्ज', category: 'ui' },
    { id: 'ui_5', english: 'Dashboard', marathi: 'डॅशबोर्ड', category: 'ui' },

    // Financial Terms
    { id: 'fin_1', english: 'Loan', marathi: 'कर्ज', category: 'message' },
    { id: 'fin_2', english: 'Savings', marathi: 'बचत', category: 'message' },
    { id: 'fin_3', english: 'Interest', marathi: 'व्याज', category: 'message' },
    { id: 'fin_4', english: 'Principal', marathi: 'मुद्दल', category: 'message' },
    { id: 'fin_5', english: 'Balance', marathi: 'शिल्लक', category: 'message' },
    { id: 'fin_6', english: 'Payment', marathi: 'देयक', category: 'message' },
    { id: 'fin_7', english: 'Deposit', marathi: 'जमा', category: 'message' },
    { id: 'fin_8', english: 'Withdrawal', marathi: 'काढणे', category: 'message' },

    // Commands
    { id: 'cmd_1', english: 'Search', marathi: 'शोधा', category: 'command' },
    { id: 'cmd_2', english: 'Filter', marathi: 'गाळणी', category: 'command' },
    { id: 'cmd_3', english: 'Export', marathi: 'निर्यात', category: 'command' },
    { id: 'cmd_4', english: 'Print', marathi: 'छापा', category: 'command' },
    { id: 'cmd_5', english: 'Save', marathi: 'जतन करा', category: 'command' },

    // Messages
    { id: 'msg_1', english: 'Success', marathi: 'यशस्वी', category: 'message' },
    { id: 'msg_2', english: 'Error', marathi: 'त्रुटी', category: 'message' },
    { id: 'msg_3', english: 'Warning', marathi: 'चेतावणी', category: 'message' },
    { id: 'msg_4', english: 'Loading', marathi: 'लोड होत आहे', category: 'message' },
    { id: 'msg_5', english: 'Please wait', marathi: 'कृपया प्रतीक्षा करा', category: 'message' },

    // Report Terms
    { id: 'rpt_1', english: 'Total Members', marathi: 'एकूण सदस्य', category: 'report' },
    { id: 'rpt_2', english: 'Total Loans', marathi: 'एकूण कर्ज', category: 'report' },
    { id: 'rpt_3', english: 'Total Savings', marathi: 'एकूण बचत', category: 'report' },
    { id: 'rpt_4', english: 'Outstanding', marathi: 'थकबाकी', category: 'report' },
    { id: 'rpt_5', english: 'Profit', marathi: 'नफा', category: 'report' },
    { id: 'rpt_6', english: 'Loss', marathi: 'तोटा', category: 'report' },
];

// --- 3. Voice Command Recognition ---
export const recognizeVoiceCommand = (
    spokenText: string
): VoiceCommand | null => {
    const normalized = spokenText.toLowerCase().trim();

    // Try exact match first
    for (const cmd of marathiVoiceCommands) {
        if (normalized === cmd.marathiCommand.toLowerCase()) {
            return cmd;
        }
    }

    // Try alternates
    for (const cmd of marathiVoiceCommands) {
        if (cmd.alternates) {
            for (const alt of cmd.alternates) {
                if (normalized === alt.toLowerCase()) {
                    return { ...cmd, confidence: cmd.confidence - 5 }; // Slightly lower confidence
                }
            }
        }
    }

    // Try partial match
    for (const cmd of marathiVoiceCommands) {
        if (normalized.includes(cmd.marathiCommand.toLowerCase()) ||
            cmd.marathiCommand.toLowerCase().includes(normalized)) {
            return { ...cmd, confidence: cmd.confidence - 10 };
        }
    }

    return null;
};

// --- 4. Translation Engine ---
export const translate = (
    text: string,
    direction: 'en-to-mr' | 'mr-to-en'
): string => {
    let result = text;

    translationDictionary.forEach(entry => {
        if (direction === 'en-to-mr') {
            const regex = new RegExp(`\\b${entry.english}\\b`, 'gi');
            result = result.replace(regex, entry.marathi);
        } else {
            const regex = new RegExp(`\\b${entry.marathi}\\b`, 'gi');
            result = result.replace(regex, entry.english);
        }
    });

    return result;
};

// --- 5. Bilingual Response Generator ---
export const generateBilingualResponse = (
    englishText: string,
    format: 'text' | 'voice' = 'text'
): BilingualResponse => {
    const marathiText = translate(englishText, 'en-to-mr');

    return {
        english: englishText,
        marathi: marathiText,
        format,
        timestamp: Date.now()
    };
};

// --- 6. Format Bilingual Message ---
export const formatBilingualMessage = (
    english: string,
    marathi: string,
    style: 'inline' | 'stacked' = 'stacked'
): string => {
    if (style === 'inline') {
        return `${marathi} / ${english}`;
    } else {
        return `${marathi}\n${english}`;
    }
};

// --- 7. Get Voice Command Suggestions ---
export const getVoiceCommandSuggestions = (
    category?: 'analysis' | 'member' | 'loan' | 'report' | 'notification' | 'document' | 'workflow'
): VoiceCommand[] => {
    if (!category) {
        return marathiVoiceCommands.slice(0, 5); // Top 5
    }

    const categoryMap: { [key: string]: number[] } = {
        analysis: [1, 2],
        member: [3, 4],
        loan: [5, 6],
        report: [7, 8],
        notification: [9, 10],
        document: [11, 12],
        workflow: [13, 14, 15]
    };

    const ids = categoryMap[category] || [];
    return marathiVoiceCommands.filter(cmd => ids.includes(parseInt(cmd.id)));
};

// --- 8. Detect Language ---
export const detectLanguage = (text: string): 'marathi' | 'english' | 'mixed' => {
    const marathiChars = text.match(/[\u0900-\u097F]/g);
    const englishChars = text.match(/[a-zA-Z]/g);

    const marathiCount = marathiChars ? marathiChars.length : 0;
    const englishCount = englishChars ? englishChars.length : 0;

    if (marathiCount === 0 && englishCount > 0) return 'english';
    if (englishCount === 0 && marathiCount > 0) return 'marathi';
    return 'mixed';
};

// --- 9. Transliterate (Devanagari to Latin) ---
export const transliterate = (marathiText: string): string => {
    const transliterationMap: { [key: string]: string } = {
        'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
        'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
        'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'ङ': 'nga',
        'च': 'cha', 'छ': 'chha', 'ज': 'ja', 'झ': 'jha', 'ञ': 'nya',
        'ट': 'ta', 'ठ': 'tha', 'ड': 'da', 'ढ': 'dha', 'ण': 'na',
        'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na',
        'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma',
        'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va',
        'श': 'sha', 'ष': 'sha', 'स': 'sa', 'ह': 'ha',
        'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
        'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
        '्': '', 'ं': 'n', 'ः': 'h', 'ँ': 'n'
    };

    let result = '';
    for (const char of marathiText) {
        result += transliterationMap[char] || char;
    }

    return result;
};

// --- 10. Get Translation Coverage ---
export const getTranslationCoverage = (): {
    totalEntries: number;
    byCategory: { [key: string]: number };
    coverage: number;
} => {
    const byCategory: { [key: string]: number } = {};

    translationDictionary.forEach(entry => {
        byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    });

    // Estimate coverage (assuming 200 common terms needed)
    const coverage = Math.min((translationDictionary.length / 200) * 100, 100);

    return {
        totalEntries: translationDictionary.length,
        byCategory,
        coverage
    };
};

// --- 11. Get Multilingual Summary ---
export const getMultilingualSummary = (): string => {
    const coverage = getTranslationCoverage();

    return `
🌐 **Multilingual Support Summary**
भाषा समर्थन सारांश

Voice Commands: ${marathiVoiceCommands.length}
आवाज आदेश: ${marathiVoiceCommands.length}

Translation Entries: ${coverage.totalEntries}
भाषांतर नोंदी: ${coverage.totalEntries}

Coverage: ${coverage.coverage.toFixed(0)}%
कव्हरेज: ${coverage.coverage.toFixed(0)}%

**By Category / श्रेणीनुसार:**
• UI: ${coverage.byCategory.ui || 0}
• Commands: ${coverage.byCategory.command || 0}
• Messages: ${coverage.byCategory.message || 0}
• Reports: ${coverage.byCategory.report || 0}
  `.trim();
};
