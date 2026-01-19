
// Global JSX Declaration
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

export enum AccountType {
  SAVINGS = 'Savings',
  LOAN = 'Loan',
  SHARES = 'Shares',
  FD = 'FD'
}

export enum TransactionType {
  CREDIT = 'Credit', // Receipt (Jama)
  DEBIT = 'Debit'    // Payment (Nave/Kharch)
}

export interface SocietyBank {
  id: string;
  bankName: string;
  accountNo: string;
  accountType: 'Current' | 'Savings';
  balance: number;
}

export interface AuditNote {
  id: string;
  date: string;
  subject: string;
  description: string;
  status: 'Pending' | 'Resolved';
}

export interface Transaction {
  id: string;
  date: string;
  memberId: string | null;
  memberName?: string;
  accountType: AccountType | 'Expense' | 'BankTransfer';
  type: TransactionType;
  amount: number;
  details: string;
  timestamp: number;
  interestAccrued?: number;
  interestPaid?: number;
  principalPaid?: number;
  previousLoanCalculationDate?: string;
  expenseCategory?: string;
  bankId?: string; // Link to society bank if it's a bank transaction
  receiptUrl?: string; // Image of the bill
}

export interface Meeting {
  id: string;
  date: string;
  title: string;
  venue?: string;
  type: 'AGM' | 'Monthly' | 'Emergency' | 'Committee';
  attendeesCount: number;
  attendees?: string[];
  resolutions: string;
  timestamp: number;
}

export interface PaddySeason {
  id: string;
  code: string;          // e.g., "25K", "26R"
  name: string;          // e.g., "खरीप 2025-26", "रब्बी 2026"
  type: 'kharif' | 'rabi';
  startDate: string;     // ISO date
  endDate: string;       // ISO date
  isActive: boolean;     // Only one season can be active
  createdAt: number;
}

export interface PaddyPurchaseRecord {
  id: string;
  date: string;
  season: string;        // Season code (e.g., "25K", "26R")
  centerName: string;
  tribalMembers: number;
  nonTribalMembers: number;
  newBags: number;
  newWeight: number;
  oldBags: number;
  oldWeight: number;
  usedOnceBags: number;
  usedOnceWeight: number;
  godownBags: number;
  godownWeight: number;
  shedBags: number;
  shedWeight: number;
  openBags: number;
  openWeight: number;
  cumulativeGodownBags?: number;
  cumulativeGodownWeight?: number;
  cumulativeShedBags?: number;
  cumulativeShedWeight?: number;
  cumulativeOpenBags?: number;
  cumulativeOpenWeight?: number;
  cumulativeNewBags?: number;
  cumulativeNewWeight?: number;
  cumulativeOldBags?: number;
  cumulativeOldWeight?: number;
  cumulativeUsedOnceBags?: number;
  cumulativeUsedOnceWeight?: number;
  timestamp: number;
}

export interface DispatchRecord {
  id: string;
  date: string;
  millName: string;
  doNumber?: string;
  tpNumber?: string;
  truckNumber: string;
  driverName?: string;
  storageSource: 'Godown' | 'Shed' | 'Open';
  bags: number;
  weight: number;
  newBagsUsed: number;
  oldBagsUsed: number;
  usedOnceBagsUsed: number;
  timestamp: number;
}

export interface InventoryAdjustment {
  id: string;
  date: string;
  type: 'NewStock' | 'OpeningStock' | 'Damage' | 'Correction';
  item: 'NewBags' | 'OldBags' | 'UsedOnceBags' | 'PaddyGodown' | 'PaddyShed' | 'PaddyOpen';
  quantity: number;
  weight?: number; // For paddy
  reason: string;
  timestamp: number;
}

export interface Member {
  id: string;
  name: string;
  village: string;
  gender: 'Male' | 'Female' | 'Other';
  designation?: string;
  dob: string;
  membershipDate?: string;
  category: 'ST' | 'SC' | 'OBC' | 'OPEN';
  memberNo: string;
  bankAccountNo: string;
  landArea: string;
  loanAccountNo: string;
  loanType?: 'Short Term' | 'Medium Term';
  farmerType?: 'Small Farmer' | 'Large Farmer';
  mobile: string;
  aadhar: string;
  photoUrl?: string;
  signatureUrl?: string;
  isActive: boolean;
  shareBalance: number;
  savingsBalance: number;
  loanPrincipal: number;
  loanInterestDue: number;
  fdBalance: number;
  lastLoanCalculationDate?: string;
  originalLoanDate?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ReportHeaders {
  memberNo: string;
  name: string;
  village: string;
  loanDate: string;
  days: string;
  principal: string;
  interest: string;
  totalDue: string;
  dp_memberNo: string;
  dp_name: string;
  dp_category: string;
  dp_village: string;
  dp_disbursementDate: string;
  dp_principal: string;
  dp_repaymentDate: string;
  dp_repaidAmount: string;
  dp_days: string;
  dp_product: string;
  dp_incentive: string;
  dp_bankAccount: string;
}

export interface AllowanceSettings {
  travelAllowance: number;
  incidentalExpenses: number;
  meetingFee: number;
}

export interface AppSettings {
  securityPin: string;
  societyName: string;
  financialYearStart: string;
  financialYearEnd: string;
  reportHeaders: ReportHeaders;
  boardMembers: string[];
  chairmanId?: string;
  viceChairmanIds?: string[];
  allowanceSettings?: AllowanceSettings;
  lastBackupDate?: number;
  autoBackupOnLogout?: boolean;
  paddySettings?: {
    godownCapacity: number;
    shedCapacity: number;
    currentSeason?: string;  // Active season code
  };
  geminiApiKey?: string;
  openaiApiKey?: string;
  claudeApiKey?: string;
  selectedAiProvider?: 'gemini' | 'openai' | 'claude';
}

export interface LocalSettings {
  theme: ThemeMode;
  enableAI: boolean;
  aiTransparency: number;
  aiBlurStrength: 'none' | 'sm' | 'md' | 'xl' | '2xl';
}

export interface LoanCalculationResult {
  interest: number;
  breakdown: string[];
}
