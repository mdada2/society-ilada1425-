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
