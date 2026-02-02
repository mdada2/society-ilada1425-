import { Member, Transaction, Meeting, LoanAgreement, Receipt, MeetingMinutes, GeneratedDocument } from '../types';
import { format } from 'date-fns';

// ============================================================================
// PHASE 5: DOCUMENT GENERATION
// ============================================================================

// --- 1. Generate Loan Agreement ---
export const generateLoanAgreement = (
    member: Member,
    loanAmount: number,
    interestRate: number,
    repaymentPeriod: number,
    guarantorName?: string,
    societyName: string = 'सहकारी संस्था'
): string => {
    const today = format(new Date(), 'dd-MM-yyyy');

    return `
<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <title>कर्ज करार - ${member.name}</title>
  <style>
    body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; margin: 40px; line-height: 1.8; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header h2 { margin: 5px 0; font-size: 18px; color: #666; }
    .content { margin: 20px 0; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; font-size: 16px; margin: 15px 0 10px 0; }
    .terms { margin-left: 20px; }
    .terms li { margin: 10px 0; }
    .signature-section { margin-top: 60px; display: flex; justify-content: space-between; }
    .signature-box { width: 45%; }
    .signature-line { border-top: 1px solid #000; margin-top: 60px; padding-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    td { padding: 8px; border: 1px solid #ddd; }
    td:first-child { font-weight: bold; width: 40%; background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${societyName}</h1>
    <h2>कर्ज करार / Loan Agreement</h2>
    <p>तारीख / Date: ${today}</p>
  </div>

  <div class="content">
    <div class="section">
      <div class="section-title">१. सभासद माहिती / Member Information:</div>
      <table>
        <tr>
          <td>सभासद क्रमांक / Member No.</td>
          <td>${member.memberNo}</td>
        </tr>
        <tr>
          <td>नाव / Name</td>
          <td>${member.name}</td>
        </tr>
        <tr>
          <td>गाव / Village</td>
          <td>${member.village}</td>
        </tr>
        <tr>
          <td>मोबाईल / Mobile</td>
          <td>${member.mobile}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">२. कर्ज तपशील / Loan Details:</div>
      <table>
        <tr>
          <td>कर्ज रक्कम / Loan Amount</td>
          <td>₹${loanAmount.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td>व्याज दर / Interest Rate</td>
          <td>${interestRate}% प्रति वर्ष / per annum</td>
        </tr>
        <tr>
          <td>परतफेड कालावधी / Repayment Period</td>
          <td>${repaymentPeriod} महिने / months</td>
        </tr>
        <tr>
          <td>कर्ज तारीख / Loan Date</td>
          <td>${today}</td>
        </tr>
        ${guarantorName ? `
        <tr>
          <td>जामीनदार / Guarantor</td>
          <td>${guarantorName}</td>
        </tr>
        ` : ''}
      </table>
    </div>

    <div class="section">
      <div class="section-title">३. अटी व शर्ती / Terms and Conditions:</div>
      <ul class="terms">
        <li>कर्जदार वरील नमूद केलेल्या रकमेवर ${interestRate}% व्याज दराने व्याज भरण्यास बांधील राहील.</li>
        <li>कर्ज रक्कम ${repaymentPeriod} महिन्यांच्या आत परत करणे आवश्यक आहे.</li>
        <li>कर्जदाराने दरमहा किमान व्याज भरणे आवश्यक आहे.</li>
        <li>कर्ज परतफेड न केल्यास कायदेशीर कारवाई केली जाईल.</li>
        <li>कर्जदार आपल्या शेअर्स/बचत खात्यावरून कर्ज काढू शकत नाही.</li>
        ${guarantorName ? '<li>जामीनदार कर्जदाराच्या कर्जासाठी जबाबदार राहील.</li>' : ''}
      </ul>
    </div>

    <div class="section">
      <p style="margin-top: 30px;">
        मी, <strong>${member.name}</strong>, वरील सर्व अटी व शर्ती मान्य करतो/करते आणि 
        कर्ज रक्कम वेळेवर परत करण्याचे वचन देतो/देते.
      </p>
    </div>

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line">
          कर्जदाराची सही / Borrower's Signature<br>
          नाव: ${member.name}<br>
          तारीख: ${today}
        </div>
      </div>
      <div class="signature-box">
        <div class="signature-line">
          अधिकृत सही / Authorized Signature<br>
          ${societyName}<br>
          तारीख: ${today}
        </div>
      </div>
    </div>

    ${guarantorName ? `
    <div class="signature-section" style="margin-top: 40px;">
      <div class="signature-box">
        <div class="signature-line">
          जामीनदाराची सही / Guarantor's Signature<br>
          नाव: ${guarantorName}<br>
          तारीख: ${today}
        </div>
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>
  `.trim();
};

// --- 2. Generate Receipt ---
export const generateReceipt = (
    member: Member,
    transaction: Transaction,
    receiptNo: string,
    receivedBy: string,
    societyName: string = 'सहकारी संस्था'
): string => {
    const txnDate = format(new Date(transaction.date), 'dd-MM-yyyy');

    return `
<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <title>पावती - ${receiptNo}</title>
  <style>
    body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; margin: 20px; }
    .receipt { max-width: 600px; margin: 0 auto; border: 2px solid #000; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 22px; }
    .header h2 { margin: 5px 0; font-size: 16px; color: #666; }
    .receipt-no { text-align: right; font-weight: bold; margin-bottom: 20px; }
    table { width: 100%; margin: 20px 0; }
    td { padding: 10px 5px; }
    td:first-child { font-weight: bold; width: 40%; }
    .amount-box { background: #f0f0f0; padding: 15px; margin: 20px 0; text-align: center; border: 1px dashed #000; }
    .amount-box .amount { font-size: 24px; font-weight: bold; color: #000; }
    .footer { margin-top: 40px; text-align: right; }
    .signature-line { border-top: 1px solid #000; margin-top: 60px; padding-top: 5px; display: inline-block; min-width: 200px; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>${societyName}</h1>
      <h2>पावती / Receipt</h2>
    </div>

    <div class="receipt-no">
      पावती क्र. / Receipt No: <span style="color: #d00;">${receiptNo}</span>
    </div>

    <table>
      <tr>
        <td>तारीख / Date:</td>
        <td>${txnDate}</td>
      </tr>
      <tr>
        <td>सभासद क्र. / Member No:</td>
        <td>${member.memberNo}</td>
      </tr>
      <tr>
        <td>सभासदाचे नाव / Name:</td>
        <td>${member.name}</td>
      </tr>
      <tr>
        <td>गाव / Village:</td>
        <td>${member.village}</td>
      </tr>
      <tr>
        <td>खाते प्रकार / Account Type:</td>
        <td>${transaction.accountType}</td>
      </tr>
      <tr>
        <td>व्यवहार प्रकार / Transaction Type:</td>
        <td>${transaction.type === 'Credit' ? 'जमा / Credit' : 'नावे / Debit'}</td>
      </tr>
      <tr>
        <td>तपशील / Details:</td>
        <td>${transaction.details}</td>
      </tr>
    </table>

    <div class="amount-box">
      <div>रक्कम / Amount</div>
      <div class="amount">₹${transaction.amount.toLocaleString('en-IN')}</div>
      <div style="margin-top: 10px; font-size: 14px;">
        (${numberToMarathiWords(transaction.amount)})
      </div>
    </div>

    <div class="footer">
      <div style="margin-bottom: 10px;">
        प्राप्त केले / Received By: ${receivedBy}
      </div>
      <div class="signature-line">
        अधिकृत सही / Authorized Signature
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
};

// --- 3. Generate Meeting Minutes ---
export const generateMeetingMinutes = (
    meeting: Meeting,
    attendees: Member[],
    resolutions: Array<{ title: string; description: string; votedFor: number; votedAgainst: number }>,
    preparedBy: string,
    societyName: string = 'सहकारी संस्था'
): string => {
    const meetingDate = format(new Date(meeting.date), 'dd-MM-yyyy');

    return `
<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <title>सभा कार्यवृत्त - ${meeting.title}</title>
  <style>
    body { font-family: 'Noto Sans Devanagari', Arial, sans-serif; margin: 40px; line-height: 1.8; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header h2 { margin: 5px 0; font-size: 18px; color: #666; }
    .section { margin: 25px 0; }
    .section-title { font-weight: bold; font-size: 16px; margin: 15px 0 10px 0; background: #f0f0f0; padding: 10px; }
    .attendees { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 15px 0; }
    .attendee { padding: 5px; }
    .resolution { border: 1px solid #ddd; padding: 15px; margin: 15px 0; background: #fafafa; }
    .resolution-title { font-weight: bold; margin-bottom: 10px; }
    .vote-result { margin-top: 10px; font-size: 14px; }
    .vote-result span { margin-right: 20px; }
    .passed { color: green; font-weight: bold; }
    .rejected { color: red; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${societyName}</h1>
    <h2>सभा कार्यवृत्त / Meeting Minutes</h2>
  </div>

  <div class="section">
    <table style="width: 100%;">
      <tr>
        <td style="width: 30%; font-weight: bold;">सभेचा विषय / Meeting Title:</td>
        <td>${meeting.title}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">सभेचा प्रकार / Type:</td>
        <td>${meeting.type}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">तारीख / Date:</td>
        <td>${meetingDate}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">ठिकाण / Venue:</td>
        <td>${meeting.venue || 'N/A'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold;">उपस्थित सदस्य / Attendees:</td>
        <td>${meeting.attendeesCount} सदस्य</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">उपस्थित सदस्यांची यादी / Attendees List:</div>
    <div class="attendees">
      ${attendees.map((a, i) => `<div class="attendee">${i + 1}. ${a.name} (${a.memberNo})</div>`).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">ठराव / Resolutions:</div>
    ${resolutions.map((r, i) => `
      <div class="resolution">
        <div class="resolution-title">ठराव ${i + 1}: ${r.title}</div>
        <div>${r.description}</div>
        <div class="vote-result">
          <span>बाजूने / For: <strong>${r.votedFor}</strong></span>
          <span>विरोधात / Against: <strong>${r.votedAgainst}</strong></span>
          <span class="${r.votedFor > r.votedAgainst ? 'passed' : 'rejected'}">
            ${r.votedFor > r.votedAgainst ? '✓ मंजूर / PASSED' : '✗ नामंजूर / REJECTED'}
          </span>
        </div>
      </div>
    `).join('')}
  </div>

  <div class="section">
    <div class="section-title">सभा विसर्जन / Adjournment:</div>
    <p>सभा ${meetingDate} रोजी संपली.</p>
  </div>

  <div style="margin-top: 60px; display: flex; justify-content: space-between;">
    <div>
      <div style="border-top: 1px solid #000; padding-top: 5px; min-width: 200px;">
        तयार केले / Prepared By<br>
        ${preparedBy}<br>
        तारीख: ${meetingDate}
      </div>
    </div>
    <div>
      <div style="border-top: 1px solid #000; padding-top: 5px; min-width: 200px;">
        मंजूर केले / Approved By<br>
        अध्यक्ष / President<br>
        तारीख: __________
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
};

// --- 4. Helper: Number to Marathi Words ---
function numberToMarathiWords(num: number): string {
    if (num === 0) return 'शून्य रुपये';

    const ones = ['', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ'];
    const tens = ['', 'दहा', 'वीस', 'तीस', 'चाळीस', 'पन्नास', 'साठ', 'सत्तर', 'ऐंशी', 'नव्वद'];
    const teens = ['दहा', 'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सतरा', 'अठरा', 'एकोणीस'];

    // Simplified version - returns approximate Marathi words
    if (num < 10) return ones[num] + ' रुपये';
    if (num < 20) return teens[num - 10] + ' रुपये';
    if (num < 100) {
        const ten = Math.floor(num / 10);
        const one = num % 10;
        return tens[ten] + (one ? ' ' + ones[one] : '') + ' रुपये';
    }
    if (num < 1000) {
        const hundred = Math.floor(num / 100);
        const remainder = num % 100;
        return ones[hundred] + ' शे' + (remainder ? ' ' + numberToMarathiWords(remainder).replace(' रुपये', '') : '') + ' रुपये';
    }

    return num.toLocaleString('en-IN') + ' रुपये';
}

// --- 5. Generate Document Summary ---
export const generateDocumentSummary = (
    type: 'loan_agreement' | 'receipt' | 'meeting_minutes',
    metadata: any
): string => {
    switch (type) {
        case 'loan_agreement':
            return `Loan Agreement for ${metadata.memberName} - ₹${metadata.amount?.toLocaleString('en-IN')}`;
        case 'receipt':
            return `Receipt #${metadata.receiptNo} - ${metadata.memberName} - ₹${metadata.amount?.toLocaleString('en-IN')}`;
        case 'meeting_minutes':
            return `Meeting Minutes: ${metadata.meetingTitle} - ${metadata.date}`;
        default:
            return 'Document';
    }
};

// --- 6. Validate Document Data ---
export const validateDocumentData = (
    type: 'loan_agreement' | 'receipt' | 'meeting_minutes',
    data: any
): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (type === 'loan_agreement') {
        if (!data.member) errors.push('Member information required');
        if (!data.loanAmount || data.loanAmount <= 0) errors.push('Valid loan amount required');
        if (!data.interestRate || data.interestRate <= 0) errors.push('Valid interest rate required');
        if (!data.repaymentPeriod || data.repaymentPeriod <= 0) errors.push('Valid repayment period required');
    } else if (type === 'receipt') {
        if (!data.member) errors.push('Member information required');
        if (!data.transaction) errors.push('Transaction information required');
        if (!data.receiptNo) errors.push('Receipt number required');
        if (!data.receivedBy) errors.push('Receiver name required');
    } else if (type === 'meeting_minutes') {
        if (!data.meeting) errors.push('Meeting information required');
        if (!data.attendees || data.attendees.length === 0) errors.push('At least one attendee required');
        if (!data.resolutions || data.resolutions.length === 0) errors.push('At least one resolution required');
        if (!data.preparedBy) errors.push('Preparer name required');
    }

    return { valid: errors.length === 0, errors };
};
