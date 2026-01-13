# Society Ilada Manager - Product Requirements Document

## Product Overview
Society Ilada Manager is a comprehensive cooperative society management application built with React, TypeScript, and Firebase. It manages member accounts, transactions, loans, paddy procurement, meetings, and generates detailed reports.

## Core Features

### 1. Authentication & Security
- PIN-based login system (4-digit)
- Master code reset functionality (ADMIN)
- Secure session management

### 2. Member Management
- Member registration with complete profile
- Photo and signature upload
- Account tracking (Savings, Loan, Shares, FD)
- Member categorization (ST/SC/OBC/OPEN)
- Farmer type classification (Small/Large)
- Active/Inactive status management

### 3. Transaction Management
- Daily transaction entry
- Multiple account types support
- Credit/Debit operations
- Interest calculation and tracking
- Transaction history with filters

### 4. Loan Management
- Loan disbursement tracking
- Interest calculation (configurable rates)
- Principal and interest payment tracking
- NPA (Non-Performing Asset) reporting
- Bank incentive calculations

### 5. Paddy Purchase Module
- Purchase record entry with date and center
- Tribal/Non-tribal member tracking
- Bag type management (New/Old/Used Once)
- Storage allocation (Godown/Shed/Open)
- Cumulative inventory tracking
- Text format report generation

### 6. Dispatch Management
- Mill dispatch tracking
- DO/TP number management
- Truck and driver details
- Bag usage tracking from storage

### 7. Meeting Management
- Meeting record creation
- Notice generation with Marathi support
- Attendance tracking
- Resolution documentation
- Multiple meeting types (AGM/Monthly/Emergency/Committee)

### 8. Reports & Analytics
- Loan Reports (NPA Summary, Bank Incentive)
- Member Reports
- Transaction Reports
- CSV and PDF export with Unicode support
- Share functionality

### 9. Expense Tracking
- Expense entry with categories
- Receipt upload support
- Expense reports

### 10. Bank Audit
- Society bank account management
- Audit notes tracking
- Balance monitoring

## Technical Requirements

### Frontend
- React 19.2.0 with TypeScript
- Vite for build tooling
- React Router for navigation
- Responsive design (mobile-first)
- Dark mode support
- Print-optimized layouts

### Data Persistence
- Firebase Firestore for cloud storage
- Real-time synchronization
- Google Drive backup integration

### UI/UX Requirements
- Marathi language support
- Responsive across all screen sizes
- Accessible navigation
- Print-friendly reports
- Export functionality (CSV/PDF)

### Performance Requirements
- Fast page load times
- Smooth animations
- Efficient data fetching
- Optimized bundle size

## User Flows

### Login Flow
1. User enters 4-digit PIN
2. System validates PIN
3. On success: Navigate to Dashboard
4. On failure: Show error, clear PIN field
5. Forgot PIN: Enter master code to reset

### Transaction Entry Flow
1. Navigate to Transactions page
2. Select member (optional for expenses)
3. Select account type
4. Enter amount and details
5. Submit transaction
6. View in recent transactions table

### Meeting Notice Generation Flow
1. Navigate to Meetings
2. Create/Edit meeting record
3. Click "Preview Notice"
4. Review formatted notice
5. Print or share

### Report Export Flow
1. Navigate to Reports
2. Select report type
3. Configure filters/date range
4. Click Export CSV or Export PDF
5. File downloads with proper filename

## Validation Rules
- PIN must be exactly 4 digits
- Member number must be unique
- Transaction amount must be positive
- Dates must be valid and not in future
- Required fields must be filled

## Error Handling
- Display user-friendly error messages
- Validate inputs before submission
- Handle network failures gracefully
- Show loading states during operations
