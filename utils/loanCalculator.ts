
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
  fyStartStr: string = '2025-04-01', // Not used in new logic, kept for compatibility
  fyEndStr: string = '2026-03-31',    // Not used in new logic, kept for compatibility
  hideFirstYearInterest: boolean = true // Hide interest display during first FY
): { interest: number; breakdown: string[] } => {

  if (principal <= 0) return { interest: 0, breakdown: ['No principal pending'] };

  const lastDate = parseDate(lastDateStr);
  const currentDate = parseDate(currentDateStr);

  // Safety: If current date is before loan date
  if (getDifferenceInDays(lastDate, currentDate) <= 0) {
    return { interest: 0, breakdown: ['Date not advanced or invalid date range'] };
  }

  // NEW LOGIC: First Financial Year gets 6%, Subsequent years get 12%
  // Determine the end of first FY based on loan date
  const loanYear = lastDate.getFullYear();
  const loanMonth = lastDate.getMonth(); // 0-indexed (0 = Jan, 3 = Apr)

  // If loan is in Jan-Mar (months 0-2), first FY ends on 31-Mar of same year
  // If loan is in Apr-Dec (months 3-11), first FY ends on 31-Mar of next year
  const firstFYEnd = loanMonth < 3
    ? parseDate(`${loanYear}-03-31`)      // End is same year March 31
    : parseDate(`${loanYear + 1}-03-31`); // End is next year March 31

  let interest = 0;
  const breakdown: string[] = [];

  // Check if we're still in the first FY or have crossed into subsequent FYs
  if (currentDate.getTime() <= firstFYEnd.getTime()) {
    // Still in first FY - apply 6% for entire period
    const days = getDifferenceInDays(lastDate, currentDate);
    const int = Math.round((principal * days * 6) / 36500);
    interest += int;
    breakdown.push(`First FY (6%): ${days} days (${lastDateStr} to ${currentDateStr}) = ₹${int}`);

    // Hide interest during first FY if requested
    if (hideFirstYearInterest) {
      return {
        interest: 0,
        breakdown: [`व्याज पहिल्या आर्थिक वर्षाच्या शेवटी (${firstFYEnd.toISOString().split('T')[0]}) दाखवले जाईल`]
      };
    }
  } else {
    // Crossed into subsequent FYs - split into two periods

    // Period 1: Loan date to end of first FY @ 6% (EXCLUSIVE of 31st March)
    const daysP1 = getDifferenceInDays(lastDate, firstFYEnd); // No +1, exclusive of last day
    if (daysP1 > 0) {
      const intP1 = Math.round((principal * daysP1 * 6) / 36500);
      interest += intP1;
      breakdown.push(`First FY (6%): ${daysP1} days (${lastDateStr} to ${firstFYEnd.toISOString().split('T')[0]}) = ₹${intP1}`);
    }

    // Period 2: Start of next FY to current date @ 12% (INCLUSIVE of current date)
    const nextFYStart = new Date(firstFYEnd);
    nextFYStart.setDate(firstFYEnd.getDate() + 1); // Day after first FY end (1st April)

    const daysP2 = getDifferenceInDays(nextFYStart, currentDate) + 1; // +1 to include current date
    if (daysP2 > 0) {
      const intP2 = Math.round((principal * daysP2 * 12) / 36500);
      interest += intP2;
      breakdown.push(`Subsequent FYs (12%): ${daysP2} days (${nextFYStart.toISOString().split('T')[0]} to ${currentDateStr}) = ₹${intP2}`);
    }
  }

  return { interest, breakdown };
};