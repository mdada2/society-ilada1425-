
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

export interface StaffSalary {
  id: string;
  employeeName: string;           // कर्मचारी/रोजनदार चे नाव
  designation: string;             // पद (e.g., Manager, Clerk, Daily Worker)
  employeeType: 'Permanent' | 'Daily Wage' | 'Contract';  // कर्मचारी प्रकार
  month: string;                   // Format: 'YYYY-MM' (e.g., '2026-01')
  grossSalary: number;             // एकूण पगार
  deductions: number;              // कपात (PF, TDS, etc.)
  netPayable: number;              // निव्वळ देय (Gross - Deductions)
  accountNumber: string;           // खाते क्रमांक
  paymentDate: string;             // पेमेंट तारीख (ISO format)
  paymentStatus: 'Paid' | 'Pending' | 'Partial';  // पेमेंट स्थिती
  paymentMode?: 'Cash' | 'Bank Transfer' | 'Cheque';  // पेमेंट पद्धत
  remarks?: string;                // टिप्पणी
  timestamp: number;               // Creation timestamp
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
  season: string;        // Season code (e.g., "25K", "26R")
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

// ============================================================================
// PHASE 3: NOTIFICATIONS & REMINDERS
// ============================================================================

export interface Notification {
  id: string;
  type: 'payment' | 'meeting' | 'audit' | 'season' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  targetMembers?: string[]; // Member IDs, empty = all members
  scheduledDate?: string; // ISO date for scheduled notifications
  sentDate?: string; // ISO date when sent
  status: 'pending' | 'sent' | 'failed';
  createdBy: string;
  createdAt: number;
  metadata?: {
    meetingId?: string;
    seasonCode?: string;
    dueAmount?: number;
    daysOverdue?: number;
  };
}

export interface Reminder {
  id: string;
  type: 'payment' | 'meeting' | 'audit' | 'season';
  memberId?: string; // Specific member or null for society-wide
  title: string;
  description: string;
  dueDate: string; // ISO date
  reminderDate: string; // ISO date when to send reminder
  isRecurring: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  status: 'active' | 'completed' | 'cancelled';
  notificationSent: boolean;
  createdAt: number;
}

export interface NotificationSettings {
  enablePaymentReminders: boolean;
  paymentReminderDays: number; // Days before due date
  enableMeetingAlerts: boolean;
  meetingAlertDays: number; // Days before meeting
  enableAuditReminders: boolean;
  auditReminderDays: number; // Days before audit
  enableSeasonAlerts: boolean;
  seasonAlertDays: number; // Days before season start/end
  autoSendReminders: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
}

// ============================================================================
// PHASE 4: BULK OPERATIONS
// ============================================================================

export interface BulkOperation {
  id: string;
  type: 'sms' | 'whatsapp' | 'interest' | 'transaction' | 'member_update';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalItems: number;
  processedItems: number;
  failedItems: number;
  startedAt?: number;
  completedAt?: number;
  createdBy: string;
  createdAt: number;
  errorLog?: string[];
}

export interface BulkSMSJob {
  id: string;
  recipients: Array<{
    memberId: string;
    memberNo: string;
    name: string;
    mobile: string;
  }>;
  message: string;
  templateType?: 'payment_reminder' | 'meeting_alert' | 'general';
  scheduledDate?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  sentCount: number;
  failedCount: number;
  createdAt: number;
}

export interface BulkCalculationResult {
  memberId: string;
  memberNo: string;
  name: string;
  previousInterest: number;
  calculatedInterest: number;
  newTotalInterest: number;
  principal: number;
  totalDue: number;
  calculationDate: string;
  success: boolean;
  error?: string;
}

export interface BulkTransactionImport {
  id: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  status: 'validating' | 'importing' | 'completed' | 'failed';
  errors: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  createdAt: number;
}

// ============================================================================
// PHASE 5: DOCUMENT GENERATION
// ============================================================================

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'loan_agreement' | 'receipt' | 'meeting_minutes' | 'audit_report' | 'custom';
  language: 'marathi' | 'english' | 'bilingual';
  template: string; // HTML/Markdown template
  variables: string[]; // List of variables used in template
  createdAt: number;
  updatedAt: number;
}

export interface GeneratedDocument {
  id: string;
  templateId: string;
  type: 'loan_agreement' | 'receipt' | 'meeting_minutes' | 'audit_report';
  title: string;
  content: string; // Generated HTML/Markdown
  metadata: {
    memberId?: string;
    memberName?: string;
    transactionId?: string;
    meetingId?: string;
    amount?: number;
    date?: string;
    [key: string]: any;
  };
  format: 'html' | 'pdf' | 'markdown';
  status: 'draft' | 'generated' | 'sent';
  generatedBy: string;
  generatedAt: number;
}

export interface LoanAgreement {
  id: string;
  memberId: string;
  memberName: string;
  memberNo: string;
  loanAmount: number;
  interestRate: number;
  loanDate: string;
  repaymentPeriod: number; // months
  guarantorName?: string;
  guarantorMemberId?: string;
  terms: string[];
  witnessNames: string[];
  status: 'draft' | 'signed' | 'active' | 'completed';
  documentUrl?: string;
  createdAt: number;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  memberId: string;
  memberName: string;
  memberNo: string;
  transactionId: string;
  amount: number;
  accountType: AccountType;
  transactionType: TransactionType;
  date: string;
  details: string;
  paymentMode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Online';
  receivedBy: string;
  status: 'draft' | 'issued' | 'cancelled';
  documentUrl?: string;
  createdAt: number;
}

export interface MeetingMinutes {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  venue: string;
  attendees: Array<{
    memberId: string;
    name: string;
    role?: string;
  }>;
  agenda: string[];
  discussions: string[];
  resolutions: Array<{
    title: string;
    description: string;
    votedFor: number;
    votedAgainst: number;
    abstained: number;
    status: 'passed' | 'rejected';
  }>;
  nextMeetingDate?: string;
  preparedBy: string;
  approvedBy?: string;
  status: 'draft' | 'approved' | 'published';
  documentUrl?: string;
  createdAt: number;
}

// ============================================================================
// PHASE 6: SMART SEARCH & FILTERS
// ============================================================================

export interface SearchQuery {
  query: string;
  type: 'member' | 'transaction' | 'all';
  filters?: FilterCriteria;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export interface FilterCriteria {
  village?: string;
  gender?: 'Male' | 'Female';
  category?: string;
  hasLoan?: boolean;
  loanAmountMin?: number;
  loanAmountMax?: number;
  savingsMin?: number;
  savingsMax?: number;
  dateFrom?: string;
  dateTo?: string;
  accountType?: AccountType;
  transactionType?: TransactionType;
}

export interface SearchResult<T> {
  items: T[];
  totalCount: number;
  query: string;
  executionTime: number; // milliseconds
  suggestions?: string[];
}

export interface DuplicateDetectionResult {
  duplicates: Array<{
    group: Member[];
    reason: string;
    confidence: number; // 0-100
  }>;
  totalDuplicates: number;
  suggestions: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    value: any;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings: Array<{
    field: string;
    value: any;
    message: string;
  }>;
}
