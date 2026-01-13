import { GoogleGenAI, Type } from "@google/genai";
import { Member, Transaction } from "../types";
import { calculateLoanInterest } from '../utils/loanCalculator';

// --- 1. AI Chat Assistant (Society Mitra) ---
export const askSocietyAI = async (
  query: string,
  contextData: { members: Member[]; transactions: Transaction[] },
  apiKey?: string
) => {
  // Check if API key is provided
  if (!apiKey) {
    return { text: "⚠️ Please configure your Google Gemini API key in Settings to use Society Mitra AI." };
  }

  // Always create a new instance right before making an API call to ensure it uses the most up-to-date API key
  // Fix: Follow initialization guideline with exact syntax
  const ai = new GoogleGenAI({ apiKey });

  // Summarize data to save tokens (send only critical info)
  const memberSummary = contextData.members.map(m => {
    // Calculate accrued interest for accurate total
    let accruedInterest = 0;
    if (m.loanPrincipal > 0 && m.lastLoanCalculationDate) {
      const result = calculateLoanInterest(
        m.loanPrincipal,
        m.lastLoanCalculationDate,
        new Date().toISOString().split('T')[0]
      );
      accruedInterest = result.interest;
    }

    const totalInterest = Math.round((m.loanInterestDue || 0) + accruedInterest);

    return {
      id: m.id,
      no: m.memberNo,
      name: m.name,
      village: m.village,
      mobile: m.mobile,
      loan: Math.round(m.loanPrincipal || 0),
      interest: totalInterest,
      savings: Math.round(m.savingsBalance || 0)
    };
  });

  const recentTransactions = contextData.transactions
    .slice(-100)
    .map(t => ({
      date: t.date,
      type: t.type,
      amt: t.amount,
      name: t.memberName,
      acc: t.accountType
    }));

  const systemPrompt = `
    You are 'Society Mitra', an AI assistant for a Cooperative Society Management App.
    
    Current Data Context:
    - Members: ${JSON.stringify(memberSummary)}
    - Recent Transactions: ${JSON.stringify(recentTransactions)}
    
    INSTRUCTIONS:
    1. Answer questions based on the provided JSON data OR perform App Automation tasks.
    2. KEEP RESPONSES SHORT (Max 50 words unless asked for details). 
    3. DO NOT output large lists of data. If the user asks for "all members", list the first 5 and give a count.
    4. DO NOT echo the Input JSON in your response.
    
    APP AUTOMATION & CONTROL:
    - You are CAPABLE of changing the App Theme (Dark/Light), Navigating pages, and Logging out.
    - You are CAPABLE of Modifying Data (Add/Update Members, Add Transactions).
    - You are CAPABLE of changing Report Column Headers to English or Marathi.
    
    VALID ACTIONS SCHEMA (Use these to perform tasks):
    1. THEME Payload: { "value": "dark" } or { "value": "light" }
    2. NAVIGATE Payload: { "value": "/reports" } (or /members, /transactions, /settings)
    3. LOGOUT Payload: {}
    4. UPDATE_MEMBER Payload: { "memberId": "...", "updates": { "village": "Pune" } }
    5. ADD_MEMBER Payload: { "name": "Raju Patil", "village": "Ilada", "mobile": "99...", "gender": "Male", "memberNo": "101" }
    6. ADD_TRANSACTION Payload: { "memberId": "...", "txnType": "Credit", "accountType": "Savings", "amount": 500, "details": "..." }
    7. CHANGE_HEADER_LANGUAGE Payload: { "language": "en" } or { "language": "mr" } (Use 'mr' for Marathi/मराठी requests)
    
    Always find the correct 'memberId' from the context for updates/transactions.
    For ADD_MEMBER, if 'memberNo' is not provided, try to guess next number or leave blank.
  `;

  const actionSchema = {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING },
      payload: {
        type: Type.OBJECT,
        properties: {
          value: { type: Type.STRING },
          memberId: { type: Type.STRING },
          txnType: { type: Type.STRING },
          accountType: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          details: { type: Type.STRING },
          language: { type: Type.STRING },
          name: { type: Type.STRING },
          village: { type: Type.STRING },
          mobile: { type: Type.STRING },
          gender: { type: Type.STRING },
          category: { type: Type.STRING },
          memberNo: { type: Type.STRING },
          aadhar: { type: Type.STRING },
          updates: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              village: { type: Type.STRING },
              mobile: { type: Type.STRING },
              gender: { type: Type.STRING },
              category: { type: Type.STRING },
              memberNo: { type: Type.STRING },
              aadhar: { type: Type.STRING }
            }
          }
        }
      }
    },
  };

  try {
    // Add timeout handling to prevent infinite loading
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await ai.models.generateContent({
        // Use standard model for basic text tasks
        model: 'gemini-3-flash-preview',
        contents: query,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.1,
          maxOutputTokens: 1000,
          // Set a small thinking budget when maxOutputTokens is specified
          thinkingConfig: { thinkingBudget: 100 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              action: actionSchema
            }
          }
        },
      });

      clearTimeout(timeoutId); // Clear timeout if request completes

      // Use .text property directly instead of method call
      const textResponse = response.text || '{}';
      try {
        return JSON.parse(textResponse);
      } catch (parseError) {
        console.error("JSON Parse Error:", textResponse);
        return { text: "Sorry, I processed the request but encountered a data error." };
      }
    } catch (innerError: any) {
      clearTimeout(timeoutId);

      // Handle timeout specifically
      if (innerError.name === 'AbortError') {
        console.error("AI Request Timeout");
        return { text: "Request timed out. Please try again with a simpler question." };
      }
      throw innerError; // Re-throw other errors to outer catch
    }
  } catch (error: any) {
    console.error("AI Chat Error:", error);

    // Provide specific error messages
    if (error.name === 'AbortError') {
      return { text: "⏱️ Request timed out after 15 seconds. Please try a simpler query." };
    }

    return { text: "Sorry, I am having trouble connecting. Please check your internet connection." };
  }
};

// --- 2. Member Credit Scoring ---
export const generateCreditScore = async (member: Member, history: Transaction[]) => {
  // Fix: Follow initialization guideline with exact syntax
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Analyze this Cooperative Society Member for creditworthiness.
    
    Member Details:
    - Name: ${member.name}
    - Village: ${member.village}
    - Loan Principal Pending: ${member.loanPrincipal}
    - Savings Balance: ${member.savingsBalance}
    - Share Balance: ${member.shareBalance}
    - Land Area: ${member.landArea}
    
    Transaction History (Last 20):
    ${JSON.stringify(history.slice(0, 20))}
    
    Task:
    Return a JSON object with:
    1. score: A number between 300 (Bad) and 900 (Excellent).
    2. rating: String (Excellent, Good, Average, Risky).
    3. reason: A 1-sentence explanation in Marathi/English mixed.
  `;

  try {
    const response = await ai.models.generateContent({
      // Use advanced model for complex reasoning and analysis
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            rating: { type: Type.STRING },
            reason: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Credit Score Error:", error);
    return null;
  }
};

// --- 3. Smart Narration ---
export const generateNarration = async (
  type: string,
  accountType: string,
  amount: number,
  memberName: string
) => {
  // Fix: Follow initialization guideline with exact syntax
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Write a short, professional accounting narration (under 15 words) for this transaction:
    Type: ${type}
    Account: ${accountType}
    Amount: ${amount}
    Member: ${memberName}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || "";
  } catch (error) {
    return "";
  }
};

// --- 4. OCR for ID Cards ---
export const scanIDCard = async (base64Image: string) => {
  // Fix: Follow initialization guideline with exact syntax
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Extract details from this Indian ID (Aadhar/PAN/Voter) into JSON: name, dob (YYYY-MM-DD), idNo (aadhar/pan), gender (Male/Female)." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            dob: { type: Type.STRING },
            idNo: { type: Type.STRING },
            gender: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("OCR Error:", error);
    return null;
  }
};

// --- 5. Scan Table/List from Image ---
export const scanTableData = async (base64Image: string) => {
  // Fix: Follow initialization guideline with exact syntax
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Analyze this image. It likely contains a table or list of cooperative society members.
    Extract the data into a JSON Array of objects.
    
    Look for columns like:
    - Member No / No / SR No (map to 'memberNo')
    - Name / Member Name (map to 'name')
    - Village / Address (map to 'village')
    - Mobile / Phone (map to 'mobile')
    - Category / Caste (map to 'category')
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              memberNo: { type: Type.STRING },
              name: { type: Type.STRING },
              village: { type: Type.STRING },
              mobile: { type: Type.STRING },
              category: { type: Type.STRING }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Table Scan Error:", error);
    return null;
  }
};
