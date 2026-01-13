
// Native Date utilities to avoid library dependency issues
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Parse YYYY-MM-DD to a UTC Date object (at midnight) to avoid timezone offset issues
const parseDate = (dateStr: string): Date => {
  const parts = dateStr.split('-');
  // Note: Month is 0-indexed in JS Date
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
};

const getDifferenceInDays = (d1: Date, d2: Date): number => {
  // Discard the time and time-zone information.
  const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.floor((utc2 - utc1) / MS_PER_DAY);
};

export const calculateLoanInterest = (
  principal: number,
  lastDateStr: string, // YYYY-MM-DD (Loan taken date or last calc date)
  currentDateStr: string, // YYYY-MM-DD
  fyStartStr: string = '2025-04-01', // Configurable FY Start
  fyEndStr: string = '2026-03-31'    // Configurable FY End
): { interest: number; breakdown: string[] } => {
  
  if (principal <= 0) return { interest: 0, breakdown: ['No principal pending'] };

  const lastDate = parseDate(lastDateStr);
  const currentDate = parseDate(currentDateStr);
  const policyChangeDate = parseDate('2023-04-01');
  const fyStart = parseDate(fyStartStr);
  const fyEnd = parseDate(fyEndStr);

  // Safety: If current date is before loan date
  if (getDifferenceInDays(lastDate, currentDate) <= 0) {
    return { interest: 0, breakdown: ['Date not advanced or invalid date range'] };
  }

  // --- NEW RULE: Zero Interest for Current Financial Year Loans ---
  // If the loan was taken (or last calculated) ON or AFTER the FY Start Date
  // AND the loan date is BEFORE or ON the FY End Date
  // AND the current calculation date is also BEFORE or ON the FY End Date
  if (lastDate.getTime() >= fyStart.getTime() && lastDate.getTime() <= fyEnd.getTime()) {
      if (currentDate.getTime() <= fyEnd.getTime()) {
          const days = getDifferenceInDays(lastDate, currentDate);
          return {
              interest: 0,
              breakdown: [`No Interest (Current FY Scheme): ${days} days (${lastDateStr} to ${currentDateStr})`]
          };
      }
      // Note: If currentDate > fyEnd, we would technically calculate interest starting from fyEnd + 1 day.
      // For now, the prompt focuses on "upto 31-3-2026", so this block handles the zero interest part.
  }

  let interest = 0;
  const breakdown: string[] = [];
  
  // LOGIC:
  // Period 1: Up to 31-03-2023 (6%)
  // Period 2: From 01-04-2023 (12%)

  // --- Period 1 Calculation ---
  if (lastDate.getTime() < policyChangeDate.getTime()) {
      // End of Period 1 is either Policy Change Date OR Current Date (whichever is earlier)
      let endP1 = currentDate.getTime() < policyChangeDate.getTime() ? currentDate : policyChangeDate;
      
      const daysP1 = getDifferenceInDays(lastDate, endP1);
      
      if (daysP1 > 0) {
          const intP1 = Math.round((principal * daysP1 * 6) / 36500);
          interest += intP1;
          breakdown.push(`P1 (6%): ${daysP1} days (${lastDateStr} to ${endP1.toISOString().split('T')[0]}) = ₹${intP1}`);
      }
  }

  // --- Period 2 Calculation ---
  // Start of Period 2 is either Policy Change Date OR Last Date (whichever is later)
  let startP2 = lastDate.getTime() > policyChangeDate.getTime() ? lastDate : policyChangeDate;
  
  if (currentDate.getTime() > startP2.getTime()) {
      const daysP2 = getDifferenceInDays(startP2, currentDate);
      
      if (daysP2 > 0) {
          const intP2 = Math.round((principal * daysP2 * 12) / 36500);
          interest += intP2;
          const startStr = startP2.toISOString().split('T')[0];
          breakdown.push(`P2 (12%): ${daysP2} days (${startStr} to ${currentDateStr}) = ₹${intP2}`);
      }
  }

  return { interest, breakdown };
};