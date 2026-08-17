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
        new Date().toISOString().split('T')[0],
        undefined,
        undefined,
        true, // Hide interest during first FY
        m.originalLoanDate // Pass original loan date
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

  // Calculate statistics to provide rich answers to the user
  const currentYear = new Date().getFullYear();
  const currentFYStart = `${currentYear}-04-01`;
  const prevFYStart = `${currentYear - 1}-04-01`;
  const prevFYEnd = `${currentYear}-03-31`;

  const newMembersThisYear = contextData.members.filter(m => m.membershipDate && m.membershipDate >= currentFYStart).length;
  const newMembersLastYear = contextData.members.filter(m => m.membershipDate && m.membershipDate >= prevFYStart && m.membershipDate <= prevFYEnd).length;

  const loanDisbursedThisYear = contextData.transactions
    .filter(t => t.type === 'Debit' && t.accountType === 'Loan' && t.date >= currentFYStart)
    .reduce((sum, t) => sum + t.amount, 0);

  const loanRecoveredThisYear = contextData.transactions
    .filter(t => t.type === 'Credit' && t.accountType === 'Loan' && t.date >= currentFYStart)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPrincipalOutstanding = contextData.members.reduce((sum, m) => sum + (m.loanPrincipal || 0), 0);
  const totalInterestOutstanding = contextData.members.reduce((sum, m) => sum + (m.loanInterestDue || 0), 0);

  const systemPrompt = `
    You are 'Society Mitra', an AI assistant for a Cooperative Society Management App.
    
    Current Data Context:
    - Members: ${JSON.stringify(memberSummary)}
    - Recent Transactions: ${JSON.stringify(recentTransactions)}
    - Society Statistics Summary:
      * New members registered this Financial Year (since ${currentFYStart}): ${newMembersThisYear}
      * New members registered last Financial Year: ${newMembersLastYear}
      * Total Loan Principal Disbursed this Financial Year: ₹${loanDisbursedThisYear.toLocaleString('en-IN')}
      * Total Loan Principal + Interest Recovered this Financial Year: ₹${loanRecoveredThisYear.toLocaleString('en-IN')}
      * Total Outstanding Loan Principal: ₹${totalPrincipalOutstanding.toLocaleString('en-IN')}
      * Total Outstanding Loan Interest: ₹${totalInterestOutstanding.toLocaleString('en-IN')}
    
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

// ============================================================================
// PHASE 1: ADVANCED ANALYTICS & CALCULATIONS
// ============================================================================

// --- 6. Monthly/Yearly Financial Summary ---
export const analyzeFinancialTrends = async (
  members: Member[],
  transactions: Transaction[],
  period: 'month' | 'year' | 'custom',
  startDate?: string,
  endDate?: string,
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for analytics." };

  const ai = new GoogleGenAI({ apiKey });

  // Calculate key metrics
  const totalLoans = members.reduce((sum, m) => sum + (m.loanPrincipal || 0), 0);
  const totalSavings = members.reduce((sum, m) => sum + (m.savingsBalance || 0), 0);
  const totalShares = members.reduce((sum, m) => sum + (m.shareBalance || 0), 0);
  const totalFD = members.reduce((sum, m) => sum + (m.fdBalance || 0), 0);

  // Filter transactions by period
  const now = new Date();
  let filteredTxns = transactions;

  if (period === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    filteredTxns = transactions.filter(t => new Date(t.date) >= monthStart);
  } else if (period === 'year') {
    const yearStart = new Date(now.getFullYear(), 0, 1);
    filteredTxns = transactions.filter(t => new Date(t.date) >= yearStart);
  } else if (startDate && endDate) {
    filteredTxns = transactions.filter(t => t.date >= startDate && t.date <= endDate);
  }

  const totalCredits = filteredTxns
    .filter(t => t.type === 'Credit')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebits = filteredTxns
    .filter(t => t.type === 'Debit')
    .reduce((sum, t) => sum + t.amount, 0);

  const prompt = `
    Analyze this Cooperative Society's financial data and provide insights in Marathi-English mix.
    
    Period: ${period === 'month' ? 'Current Month' : period === 'year' ? 'Current Year' : 'Custom Period'}
    
    Current Balances:
    - Total Loans Outstanding: ₹${totalLoans.toLocaleString('en-IN')}
    - Total Savings: ₹${totalSavings.toLocaleString('en-IN')}
    - Total Shares: ₹${totalShares.toLocaleString('en-IN')}
    - Total FD: ₹${totalFD.toLocaleString('en-IN')}
    
    Period Activity:
    - Total Credits (Receipts): ₹${totalCredits.toLocaleString('en-IN')}
    - Total Debits (Payments): ₹${totalDebits.toLocaleString('en-IN')}
    - Net Cash Flow: ₹${(totalCredits - totalDebits).toLocaleString('en-IN')}
    - Total Transactions: ${filteredTxns.length}
    
    Provide:
    1. Summary (2-3 sentences in Marathi-English)
    2. Key Insights (3-4 bullet points)
    3. Recommendations (2-3 suggestions)
    4. Health Score (0-100)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            insights: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            healthScore: { type: Type.INTEGER }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Financial Analysis Error:", error);
    return null;
  }
};

// --- 7. Defaulter Prediction System ---
export const predictDefaulters = async (
  members: Member[],
  transactions: Transaction[],
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for predictions." };

  const ai = new GoogleGenAI({ apiKey });

  // Calculate risk factors for each member with outstanding loans
  const membersWithLoans = members.filter(m => (m.loanPrincipal || 0) > 0);

  const riskData = membersWithLoans.map(m => {
    const memberTxns = transactions.filter(t => t.memberId === m.id);
    const recentPayments = memberTxns
      .filter(t => t.type === 'Credit' && t.accountType === 'Loan')
      .slice(-5);

    const daysSinceLastPayment = m.lastLoanCalculationDate
      ? Math.floor((Date.now() - new Date(m.lastLoanCalculationDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    let totalInterest = m.loanInterestDue || 0;
    if (m.loanPrincipal > 0 && m.lastLoanCalculationDate) {
      const { interest } = calculateLoanInterest(
        m.loanPrincipal,
        m.lastLoanCalculationDate,
        new Date().toISOString().split('T')[0],
        undefined,
        undefined,
        true,
        m.originalLoanDate
      );
      totalInterest += interest;
    }

    return {
      id: m.id,
      no: m.memberNo,
      name: m.name,
      village: m.village,
      loan: m.loanPrincipal,
      interest: Math.round(totalInterest),
      daysSincePayment: daysSinceLastPayment,
      recentPaymentCount: recentPayments.length,
      savingsBalance: m.savingsBalance || 0,
      loanType: m.loanType || 'Short Term'
    };
  });

  const prompt = `
    Analyze these cooperative society members and predict defaulter risk.
    
    Members with Loans: ${JSON.stringify(riskData)}
    
    Risk Factors to Consider:
    - Days since last payment (>180 days = high risk)
    - Loan amount vs savings balance
    - Recent payment history
    - Total interest accumulated
    
    Return JSON array with:
    - memberId: string
    - memberNo: string
    - name: string
    - riskScore: number (0-100, higher = more risk)
    - riskLevel: "Low" | "Medium" | "High" | "Critical"
    - reason: string (short explanation in Marathi-English)
    
    Sort by riskScore descending. Only include members with riskScore > 30.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              memberId: { type: Type.STRING },
              memberNo: { type: Type.STRING },
              name: { type: Type.STRING },
              riskScore: { type: Type.INTEGER },
              riskLevel: { type: Type.STRING },
              reason: { type: Type.STRING }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (error) {
    console.error("Defaulter Prediction Error:", error);
    return null;
  }
};

// --- 8. Village-wise Analysis ---
export const analyzeByVillage = async (
  members: Member[],
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for analysis." };

  const ai = new GoogleGenAI({ apiKey });

  // Group members by village
  const villageData: Record<string, any> = {};

  members.forEach(m => {
    const village = m.village || 'Unknown';
    if (!villageData[village]) {
      villageData[village] = {
        memberCount: 0,
        totalLoans: 0,
        totalSavings: 0,
        totalShares: 0,
        activeMembers: 0
      };
    }

    villageData[village].memberCount++;
    villageData[village].totalLoans += m.loanPrincipal || 0;
    villageData[village].totalSavings += m.savingsBalance || 0;
    villageData[village].totalShares += m.shareBalance || 0;
    if (m.isActive) villageData[village].activeMembers++;
  });

  const prompt = `
    Analyze village-wise distribution for this cooperative society.
    
    Village Data: ${JSON.stringify(villageData)}
    
    Provide insights in Marathi-English:
    1. Which village has highest loan burden?
    2. Which village has best savings rate?
    3. Which village needs more attention?
    4. Overall distribution analysis
    
    Return JSON with villages array, each containing:
    - village: string
    - memberCount: number
    - totalLoans: number
    - totalSavings: number
    - avgLoanPerMember: number
    - insight: string (1 sentence)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            villages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  village: { type: Type.STRING },
                  memberCount: { type: Type.INTEGER },
                  totalLoans: { type: Type.NUMBER },
                  totalSavings: { type: Type.NUMBER },
                  avgLoanPerMember: { type: Type.NUMBER },
                  insight: { type: Type.STRING }
                }
              }
            },
            summary: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Village Analysis Error:", error);
    return null;
  }
};

// --- 9. Loan Eligibility Calculator ---
export const calculateLoanEligibility = async (
  member: Member,
  transactions: Transaction[],
  requestedAmount: number,
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for eligibility check." };

  const ai = new GoogleGenAI({ apiKey });

  // Calculate member's financial profile
  const memberTxns = transactions.filter(t => t.memberId === member.id);
  const recentPayments = memberTxns
    .filter(t => t.type === 'Credit' && t.accountType === 'Loan')
    .slice(-10);

  const totalPastLoans = memberTxns
    .filter(t => t.accountType === 'Loan')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const prompt = `
    Evaluate loan eligibility for this cooperative society member.
    
    Member Profile:
    - Name: ${member.name}
    - Current Loan: ₹${member.loanPrincipal || 0}
    - Savings Balance: ₹${member.savingsBalance || 0}
    - Share Balance: ₹${member.shareBalance || 0}
    - Land Area: ${member.landArea || 'Not specified'}
    - Recent Payments: ${recentPayments.length} in last 10 transactions
    - Total Past Loans: ₹${totalPastLoans}
    
    Requested Loan Amount: ₹${requestedAmount}
    
    Society Rules (typical):
    - Maximum loan = 10x share balance OR ₹50,000 (whichever is higher)
    - No new loan if existing loan outstanding
    - Minimum 20% savings required
    
    Provide:
    - eligible: boolean
    - maxEligibleAmount: number
    - reason: string (Marathi-English explanation)
    - recommendations: string[] (suggestions to improve eligibility)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            eligible: { type: Type.BOOLEAN },
            maxEligibleAmount: { type: Type.NUMBER },
            reason: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Loan Eligibility Error:", error);
    return null;
  }
};

// --- 10. Interest Forecasting ---
export const forecastInterest = async (
  members: Member[],
  months: number,
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for forecasting." };

  const ai = new GoogleGenAI({ apiKey });

  // Calculate projected interest for all members with loans
  const membersWithLoans = members.filter(m => (m.loanPrincipal || 0) > 0);

  const projections = membersWithLoans.map(m => {
    const currentDate = new Date();
    const futureDate = new Date(currentDate);
    futureDate.setMonth(futureDate.getMonth() + months);

    const { interest } = calculateLoanInterest(
      m.loanPrincipal || 0,
      currentDate.toISOString().split('T')[0],
      futureDate.toISOString().split('T')[0],
      undefined,
      undefined,
      false,
      m.originalLoanDate
    );

    return {
      memberNo: m.memberNo,
      name: m.name,
      currentPrincipal: m.loanPrincipal,
      projectedInterest: Math.round(interest)
    };
  });

  const totalProjectedInterest = projections.reduce((sum, p) => sum + p.projectedInterest, 0);

  const prompt = `
    Forecast interest income for the next ${months} months.
    
    Total Members with Loans: ${membersWithLoans.length}
    Total Projected Interest: ₹${totalProjectedInterest.toLocaleString('en-IN')}
    
    Top 5 Contributors: ${JSON.stringify(projections.slice(0, 5))}
    
    Provide analysis in Marathi-English:
    - Monthly average interest income
    - Confidence level (High/Medium/Low)
    - Assumptions made
    - Risk factors
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalProjectedInterest: { type: Type.NUMBER },
            monthlyAverage: { type: Type.NUMBER },
            confidence: { type: Type.STRING },
            assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskFactors: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Interest Forecast Error:", error);
    return null;
  }
};

// --- 11. EMI Calculator ---
export const calculateEMI = (
  principal: number,
  annualRate: number,
  tenureMonths: number
): { emi: number; totalInterest: number; totalAmount: number } => {
  const monthlyRate = annualRate / 12 / 100;
  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  const totalAmount = emi * tenureMonths;
  const totalInterest = totalAmount - principal;

  return {
    emi: Math.round(emi),
    totalInterest: Math.round(totalInterest),
    totalAmount: Math.round(totalAmount)
  };
};

// --- 12. Profit/Loss Analysis ---
export const analyzeProfitLoss = async (
  transactions: Transaction[],
  members: Member[],
  startDate: string,
  endDate: string,
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for P&L analysis." };

  const ai = new GoogleGenAI({ apiKey });

  // Filter transactions by date range
  const periodTxns = transactions.filter(t => t.date >= startDate && t.date <= endDate);

  // Calculate income
  const interestIncome = periodTxns
    .filter(t => t.type === 'Credit' && t.accountType === 'Loan' && (t.interestPaid || 0) > 0)
    .reduce((sum, t) => sum + (t.interestPaid || 0), 0);

  // Calculate expenses
  const totalExpenses = periodTxns
    .filter(t => t.accountType === 'Expense')
    .reduce((sum, t) => sum + t.amount, 0);

  // Other income (FD interest, etc.)
  const otherIncome = periodTxns
    .filter(t => t.type === 'Credit' && t.accountType === 'FD')
    .reduce((sum, t) => sum + t.amount, 0);

  const netProfitLoss = interestIncome + otherIncome - totalExpenses;

  const prompt = `
    Analyze Profit & Loss for this cooperative society.
    
    Period: ${startDate} to ${endDate}
    
    Income:
    - Interest Income: ₹${interestIncome.toLocaleString('en-IN')}
    - Other Income: ₹${otherIncome.toLocaleString('en-IN')}
    - Total Income: ₹${(interestIncome + otherIncome).toLocaleString('en-IN')}
    
    Expenses:
    - Total Expenses: ₹${totalExpenses.toLocaleString('en-IN')}
    
    Net Profit/Loss: ₹${netProfitLoss.toLocaleString('en-IN')}
    
    Provide analysis in Marathi-English:
    - Overall financial health
    - Income vs Expense ratio
    - Suggestions to improve profitability
    - Risk assessment
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            totalIncome: { type: Type.NUMBER },
            totalExpenses: { type: Type.NUMBER },
            netProfitLoss: { type: Type.NUMBER },
            profitMargin: { type: Type.NUMBER },
            analysis: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            healthRating: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("P&L Analysis Error:", error);
    return null;
  }
};

// ============================================================================
// PHASE 3: SMART NOTIFICATIONS & REMINDERS
// ============================================================================

// --- 13. Analyze Notification Priorities ---
export const analyzeNotificationPriorities = async (
  members: Member[],
  transactions: Transaction[],
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for analysis." };

  const ai = new GoogleGenAI({ apiKey });

  // Find members with overdue payments
  const today = new Date();
  const overdueMembers = members.filter(m => {
    if ((m.loanPrincipal || 0) <= 0) return false;

    const lastPaymentDate = m.lastLoanCalculationDate
      ? new Date(m.lastLoanCalculationDate)
      : new Date(0);

    const daysSincePayment = Math.floor((today.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSincePayment > 30;
  });

  const prompt = `
    Analyze payment reminder priorities for this cooperative society.
    
    Total Members with Loans: ${members.filter(m => (m.loanPrincipal || 0) > 0).length}
    Overdue Members (>30 days): ${overdueMembers.length}
    
    Overdue Details: ${JSON.stringify(overdueMembers.slice(0, 10).map(m => ({
    no: m.memberNo,
    name: m.name,
    loan: m.loanPrincipal,
    lastPayment: m.lastLoanCalculationDate
  })))}
    
    Provide analysis in Marathi-English:
    1. Who needs urgent reminders?
    2. Recommended reminder strategy
    3. Priority levels for each category
    
    Return JSON with:
    - urgentCount: number
    - highPriorityCount: number
    - mediumPriorityCount: number
    - strategy: string (Marathi-English)
    - recommendations: string[]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            urgentCount: { type: Type.INTEGER },
            highPriorityCount: { type: Type.INTEGER },
            mediumPriorityCount: { type: Type.INTEGER },
            strategy: { type: Type.STRING },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Notification Analysis Error:", error);
    return null;
  }
};

// --- 14. Generate Smart Reminder Message ---
export const generateSmartReminderMessage = async (
  member: Member,
  reminderType: 'payment' | 'meeting' | 'general',
  context: any,
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required." };

  const ai = new GoogleGenAI({ apiKey });

  let prompt = '';

  if (reminderType === 'payment') {
    const totalDue = (member.loanPrincipal || 0) + (member.loanInterestDue || 0);
    prompt = `
      Generate a polite payment reminder message in Marathi-English mix.
      
      Member: ${member.name} (${member.memberNo})
      Village: ${member.village}
      Total Due: ₹${totalDue.toLocaleString('en-IN')}
      Principal: ₹${(member.loanPrincipal || 0).toLocaleString('en-IN')}
      Interest: ₹${(member.loanInterestDue || 0).toLocaleString('en-IN')}
      
      Create a friendly but firm reminder message (max 150 words).
      Include:
      - Polite greeting
      - Amount details
      - Request for payment
      - Contact information
    `;
  } else if (reminderType === 'meeting') {
    prompt = `
      Generate a meeting reminder message in Marathi-English mix.
      
      Meeting: ${context.title}
      Date: ${context.date}
      Venue: ${context.venue || 'TBD'}
      Type: ${context.type}
      
      Create a professional reminder (max 100 words).
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            subject: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Message Generation Error:", error);
    return null;
  }
};

// ============================================================================
// PHASE 4: BULK OPERATIONS
// ============================================================================

// --- 15. Analyze Bulk Operation Feasibility ---
export const analyzeBulkOperation = async (
  members: Member[],
  transactions: Transaction[],
  operationType: 'interest' | 'sms' | 'transaction',
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for analysis." };

  const ai = new GoogleGenAI({ apiKey });

  let prompt = '';

  if (operationType === 'interest') {
    const membersWithLoans = members.filter(m => (m.loanPrincipal || 0) > 0);
    const totalPrincipal = membersWithLoans.reduce((sum, m) => sum + (m.loanPrincipal || 0), 0);

    prompt = `
      Analyze bulk interest calculation feasibility for this cooperative society.
      
      Total Members with Loans: ${membersWithLoans.length}
      Total Principal Outstanding: ₹${totalPrincipal.toLocaleString('en-IN')}
      
      Sample Members: ${JSON.stringify(membersWithLoans.slice(0, 5).map(m => ({
      no: m.memberNo,
      name: m.name,
      principal: m.loanPrincipal,
      lastCalc: m.lastLoanCalculationDate
    })))}
      
      Provide analysis in Marathi-English:
      1. Is bulk calculation recommended?
      2. Estimated total interest to be calculated
      3. Any risks or warnings
      4. Best practices
      
      Return JSON with:
      - recommended: boolean
      - estimatedInterest: number
      - warnings: string[]
      - recommendations: string[]
    `;
  } else if (operationType === 'sms') {
    const membersWithMobile = members.filter(m => m.mobile && m.mobile.length === 10);

    prompt = `
      Analyze bulk SMS sending feasibility for this cooperative society.
      
      Total Members: ${members.length}
      Members with Valid Mobile: ${membersWithMobile.length}
      Coverage: ${Math.round((membersWithMobile.length / members.length) * 100)}%
      
      Provide analysis in Marathi-English:
      1. Is bulk SMS recommended?
      2. Estimated cost (assume ₹0.20 per SMS)
      3. Coverage analysis
      4. Recommendations
      
      Return JSON with:
      - recommended: boolean
      - estimatedCost: number
      - coverage: number
      - warnings: string[]
      - recommendations: string[]
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommended: { type: Type.BOOLEAN },
            estimatedInterest: { type: Type.NUMBER },
            estimatedCost: { type: Type.NUMBER },
            coverage: { type: Type.NUMBER },
            warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Bulk Operation Analysis Error:", error);
    return null;
  }
};

// ============================================================================
// PHASE 5: DOCUMENT GENERATION
// ============================================================================

// --- 16. Generate Document Content Suggestions ---
export const generateDocumentContent = async (
  documentType: 'loan_agreement' | 'receipt' | 'meeting_minutes',
  context: any,
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for document generation." };

  const ai = new GoogleGenAI({ apiKey });

  let prompt = '';

  if (documentType === 'loan_agreement') {
    prompt = `
      Generate loan agreement terms and conditions in Marathi-English bilingual format.
      
      Member: ${context.memberName}
      Loan Amount: ₹${context.loanAmount?.toLocaleString('en-IN')}
      Interest Rate: ${context.interestRate}%
      Period: ${context.repaymentPeriod} months
      
      Provide:
      1. Key terms and conditions (5-7 points)
      2. Important clauses
      3. Warnings/notices
      
      Return JSON with:
      - terms: string[] (Marathi-English)
      - clauses: string[]
      - warnings: string[]
    `;
  } else if (documentType === 'meeting_minutes') {
    prompt = `
      Generate meeting agenda and resolution suggestions in Marathi-English.
      
      Meeting Type: ${context.meetingType}
      Topic: ${context.topic || 'General Meeting'}
      
      Provide:
      1. Suggested agenda items (5-7 points)
      2. Common resolutions for this type of meeting
      3. Discussion points
      
      Return JSON with:
      - agenda: string[]
      - resolutions: string[]
      - discussionPoints: string[]
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            terms: { type: Type.ARRAY, items: { type: Type.STRING } },
            clauses: { type: Type.ARRAY, items: { type: Type.STRING } },
            warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
            agenda: { type: Type.ARRAY, items: { type: Type.STRING } },
            resolutions: { type: Type.ARRAY, items: { type: Type.STRING } },
            discussionPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Document Generation Error:", error);
    return null;
  }
};

// ============================================================================
// PHASE 6: SMART SEARCH & FILTERS
// ============================================================================

// --- 17. Natural Language Search Query Parser ---
export const parseNaturalLanguageQuery = async (
  query: string,
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for natural language search." };

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Parse this natural language search query into structured filters.
    
    Query: "${query}"
    
    Identify:
    1. Search type (member/transaction/general)
    2. Filters (village, gender, loan status, amount range, date range)
    3. Sort preferences
    4. Intent (what is the user looking for?)
    
    Examples:
    - "Show me all male members from Ilada with loans" → { type: "member", filters: { gender: "Male", village: "Ilada", hasLoan: true } }
    - "Find transactions above 10000 in last month" → { type: "transaction", filters: { amountMin: 10000, dateFrom: "last month" } }
    - "Who has the highest loan?" → { type: "member", sortBy: "loanPrincipal", sortOrder: "desc" }
    
    Return JSON with:
    - searchType: string
    - filters: object
    - sortBy: string (optional)
    - sortOrder: string (optional)
    - intent: string
    - suggestions: string[]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            searchType: { type: Type.STRING },
            filters: { type: Type.OBJECT },
            sortBy: { type: Type.STRING },
            sortOrder: { type: Type.STRING },
            intent: { type: Type.STRING },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Natural Language Search Error:", error);
    return null;
  }
};

// ============================================================================
// PHASE 7: PREDICTIVE ANALYTICS
// ============================================================================

// --- 18. Generate Prediction Insights ---
export const generatePredictionInsights = async (
  predictionType: 'cash_flow' | 'loan_recovery' | 'member_growth',
  predictionData: any,
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for prediction insights." };

  const ai = new GoogleGenAI({ apiKey });

  let prompt = '';

  if (predictionType === 'cash_flow') {
    prompt = `
      Analyze this cash flow prediction and provide insights in Marathi-English.
      
      Prediction: ${JSON.stringify(predictionData)}
      
      Provide:
      1. Key insights (3-5 points)
      2. Risks and opportunities
      3. Actionable recommendations
      4. Trend analysis
      
      Return JSON with:
      - insights: string[]
      - risks: string[]
      - opportunities: string[]
      - recommendations: string[]
      - trendAnalysis: string
    `;
  } else if (predictionType === 'loan_recovery') {
    prompt = `
      Analyze loan recovery forecasts and provide insights in Marathi-English.
      
      High Risk Loans: ${predictionData.highRiskCount}
      Total Outstanding: ₹${predictionData.totalOutstanding}
      
      Provide:
      1. Recovery strategy recommendations
      2. Risk mitigation steps
      3. Priority actions
      
      Return JSON with:
      - strategy: string[]
      - riskMitigation: string[]
      - priorityActions: string[]
    `;
  } else if (predictionType === 'member_growth') {
    prompt = `
      Analyze member growth prediction and provide insights in Marathi-English.
      
      Prediction: ${JSON.stringify(predictionData)}
      
      Provide:
      1. Growth opportunities
      2. Retention strategies
      3. Expansion recommendations
      
      Return JSON with:
      - opportunities: string[]
      - retentionStrategies: string[]
      - expansionRecommendations: string[]
    `;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: { type: Type.ARRAY, items: { type: Type.STRING } },
            risks: { type: Type.ARRAY, items: { type: Type.STRING } },
            opportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            trendAnalysis: { type: Type.STRING },
            strategy: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskMitigation: { type: Type.ARRAY, items: { type: Type.STRING } },
            priorityActions: { type: Type.ARRAY, items: { type: Type.STRING } },
            retentionStrategies: { type: Type.ARRAY, items: { type: Type.STRING } },
            expansionRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Prediction Insights Error:", error);
    return null;
  }
};

// ============================================================================
// PHASE 8: AUTOMATED WORKFLOWS
// ============================================================================

// --- 19. Workflow Optimization Suggestions ---
export const suggestWorkflowOptimizations = async (
  workflowType: 'categorization' | 'reconciliation' | 'backup' | 'report',
  currentRules: any[],
  apiKey?: string
) => {
  if (!apiKey) return { text: "⚠️ API key required for workflow optimization." };

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Analyze current workflow rules and suggest optimizations in Marathi-English.
    
    Workflow Type: ${workflowType}
    Current Rules: ${currentRules.length}
    
    Provide:
    1. Optimization suggestions (3-5 points)
    2. New rule recommendations
    3. Efficiency improvements
    4. Best practices
    
    Return JSON with:
    - optimizations: string[]
    - newRules: string[]
    - efficiencyTips: string[]
    - bestPractices: string[]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            optimizations: { type: Type.ARRAY, items: { type: Type.STRING } },
            newRules: { type: Type.ARRAY, items: { type: Type.STRING } },
            efficiencyTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            bestPractices: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Workflow Optimization Error:", error);
    return null;
  }
};
