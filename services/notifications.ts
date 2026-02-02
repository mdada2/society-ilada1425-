import { Member, Transaction, Meeting, PaddySeason, Notification, Reminder } from '../types';
import { calculateLoanInterest } from '../utils/loanCalculator';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';

// ============================================================================
// PHASE 3: SMART NOTIFICATIONS & REMINDERS
// ============================================================================

// --- 1. Payment Reminder System ---
export const generatePaymentReminders = (
    members: Member[],
    transactions: Transaction[],
    reminderDaysBefore: number = 7
): Reminder[] => {
    const reminders: Reminder[] = [];
    const today = new Date();
    const reminderDate = format(addDays(today, reminderDaysBefore), 'yyyy-MM-dd');

    // Find members with outstanding loans
    members.forEach(member => {
        if ((member.loanPrincipal || 0) <= 0) return;

        // Calculate days since last payment
        const lastPaymentDate = member.lastLoanCalculationDate
            ? parseISO(member.lastLoanCalculationDate)
            : new Date(0);

        const daysSincePayment = differenceInDays(today, lastPaymentDate);

        // Calculate total outstanding
        let totalInterest = member.loanInterestDue || 0;
        if (member.loanPrincipal > 0 && member.lastLoanCalculationDate) {
            const { interest } = calculateLoanInterest(
                member.loanPrincipal,
                member.lastLoanCalculationDate,
                format(today, 'yyyy-MM-dd'),
                undefined,
                undefined,
                true,
                member.originalLoanDate
            );
            totalInterest += interest;
        }

        const totalDue = (member.loanPrincipal || 0) + totalInterest;

        // Create reminder if payment is overdue or approaching due date
        if (daysSincePayment > 30 || totalDue > 0) {
            reminders.push({
                id: `payment-${member.id}-${Date.now()}`,
                type: 'payment',
                memberId: member.id,
                title: `Payment Reminder - ${member.name}`,
                description: `कर्ज परतफेड: ₹${Math.round(totalDue).toLocaleString('en-IN')} (मुद्दल: ₹${member.loanPrincipal?.toLocaleString('en-IN')}, व्याज: ₹${Math.round(totalInterest).toLocaleString('en-IN')})`,
                dueDate: format(addDays(today, 7), 'yyyy-MM-dd'),
                reminderDate: reminderDate,
                isRecurring: true,
                recurringPattern: 'monthly',
                status: 'active',
                notificationSent: false,
                createdAt: Date.now()
            });
        }
    });

    return reminders;
};

// --- 2. Meeting Alert System ---
export const generateMeetingAlerts = (
    meetings: Meeting[],
    members: Member[],
    alertDaysBefore: number = 3
): Notification[] => {
    const notifications: Notification[] = [];
    const today = new Date();

    // Find upcoming meetings
    meetings.forEach(meeting => {
        const meetingDate = parseISO(meeting.date);
        const daysUntilMeeting = differenceInDays(meetingDate, today);

        // Generate alert if meeting is within alert window
        if (daysUntilMeeting > 0 && daysUntilMeeting <= alertDaysBefore) {
            notifications.push({
                id: `meeting-${meeting.id}-${Date.now()}`,
                type: 'meeting',
                priority: daysUntilMeeting <= 1 ? 'urgent' : 'high',
                title: `Upcoming Meeting: ${meeting.title}`,
                message: `सभा: ${meeting.title}\nतारीख: ${format(meetingDate, 'dd-MM-yyyy')}\nठिकाण: ${meeting.venue || 'TBD'}\nप्रकार: ${meeting.type}\n\n${daysUntilMeeting} दिवसांत सभा आहे. कृपया उपस्थित रहा.`,
                targetMembers: meeting.attendees || [], // Empty = all members
                scheduledDate: format(addDays(meetingDate, -alertDaysBefore), 'yyyy-MM-dd'),
                status: 'pending',
                createdBy: 'system',
                createdAt: Date.now(),
                metadata: {
                    meetingId: meeting.id
                }
            });
        }
    });

    return notifications;
};

// --- 3. Audit Reminders ---
export const generateAuditReminders = (
    lastAuditDate: string | undefined,
    reminderDaysBefore: number = 15
): Notification[] => {
    const notifications: Notification[] = [];
    const today = new Date();

    // Calculate next audit date (typically quarterly or yearly)
    // Assuming quarterly audits (every 3 months)
    const lastAudit = lastAuditDate ? parseISO(lastAuditDate) : addDays(today, -90);
    const nextAuditDate = addDays(lastAudit, 90); // 3 months
    const daysUntilAudit = differenceInDays(nextAuditDate, today);

    // Generate reminder if audit is approaching
    if (daysUntilAudit > 0 && daysUntilAudit <= reminderDaysBefore) {
        notifications.push({
            id: `audit-${Date.now()}`,
            type: 'audit',
            priority: daysUntilAudit <= 7 ? 'urgent' : 'high',
            title: 'Bank Audit Reminder',
            message: `बँक ऑडिट आगामी आहे!\n\nतारीख: ${format(nextAuditDate, 'dd-MM-yyyy')}\nउर्वरित दिवस: ${daysUntilAudit}\n\nकृपया सर्व कागदपत्रे तयार ठेवा:\n• बँक स्टेटमेंट\n• व्यवहार नोंदी\n• कर्ज नोंदी\n• सभासद यादी`,
            targetMembers: [], // All board members
            scheduledDate: format(addDays(nextAuditDate, -reminderDaysBefore), 'yyyy-MM-dd'),
            status: 'pending',
            createdBy: 'system',
            createdAt: Date.now()
        });
    }

    return notifications;
};

// --- 4. Season-based Alerts ---
export const generateSeasonAlerts = (
    seasons: PaddySeason[],
    alertDaysBefore: number = 7
): Notification[] => {
    const notifications: Notification[] = [];
    const today = new Date();

    seasons.forEach(season => {
        const startDate = parseISO(season.startDate);
        const endDate = parseISO(season.endDate);
        const daysUntilStart = differenceInDays(startDate, today);
        const daysUntilEnd = differenceInDays(endDate, today);

        // Alert for season start
        if (daysUntilStart > 0 && daysUntilStart <= alertDaysBefore) {
            notifications.push({
                id: `season-start-${season.id}-${Date.now()}`,
                type: 'season',
                priority: 'high',
                title: `${season.name} - Season Starting Soon`,
                message: `${season.name} सुरू होणार आहे!\n\nसुरुवात तारीख: ${format(startDate, 'dd-MM-yyyy')}\nउर्वरित दिवस: ${daysUntilStart}\n\nकृपया तयारी करा:\n• गोदाम साफसफाई\n• पाळी व्यवस्था\n• वाहतूक व्यवस्था`,
                targetMembers: [],
                scheduledDate: format(addDays(startDate, -alertDaysBefore), 'yyyy-MM-dd'),
                status: 'pending',
                createdBy: 'system',
                createdAt: Date.now(),
                metadata: {
                    seasonCode: season.code
                }
            });
        }

        // Alert for season end
        if (daysUntilEnd > 0 && daysUntilEnd <= alertDaysBefore && season.isActive) {
            notifications.push({
                id: `season-end-${season.id}-${Date.now()}`,
                type: 'season',
                priority: 'medium',
                title: `${season.name} - Season Ending Soon`,
                message: `${season.name} संपणार आहे!\n\nसमाप्ती तारीख: ${format(endDate, 'dd-MM-yyyy')}\nउर्वरित दिवस: ${daysUntilEnd}\n\nअंतिम कामे:\n• शिल्लक धान्य पाठवणी\n• हिशोब तपासणी\n• अहवाल तयार करणे`,
                targetMembers: [],
                scheduledDate: format(addDays(endDate, -alertDaysBefore), 'yyyy-MM-dd'),
                status: 'pending',
                createdBy: 'system',
                createdAt: Date.now(),
                metadata: {
                    seasonCode: season.code
                }
            });
        }
    });

    return notifications;
};

// --- 5. Smart Reminder Scheduling ---
export const scheduleReminders = (
    members: Member[],
    transactions: Transaction[],
    meetings: Meeting[],
    seasons: PaddySeason[],
    lastAuditDate?: string
): { notifications: Notification[]; reminders: Reminder[] } => {
    const notifications: Notification[] = [];
    const reminders: Reminder[] = [];

    // Generate all types of notifications and reminders
    reminders.push(...generatePaymentReminders(members, transactions, 7));
    notifications.push(...generateMeetingAlerts(meetings, members, 3));
    notifications.push(...generateAuditReminders(lastAuditDate, 15));
    notifications.push(...generateSeasonAlerts(seasons, 7));

    return { notifications, reminders };
};

// --- 6. Get Pending Notifications ---
export const getPendingNotifications = (
    notifications: Notification[]
): Notification[] => {
    const today = format(new Date(), 'yyyy-MM-dd');

    return notifications.filter(n =>
        n.status === 'pending' &&
        (!n.scheduledDate || n.scheduledDate <= today)
    ).sort((a, b) => {
        // Sort by priority
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
};

// --- 7. Get Active Reminders ---
export const getActiveReminders = (
    reminders: Reminder[]
): Reminder[] => {
    const today = format(new Date(), 'yyyy-MM-dd');

    return reminders.filter(r =>
        r.status === 'active' &&
        r.reminderDate <= today &&
        !r.notificationSent
    ).sort((a, b) => {
        // Sort by due date (earliest first)
        return a.dueDate.localeCompare(b.dueDate);
    });
};

// --- 8. Format Notification Message ---
export const formatNotificationMessage = (
    notification: Notification,
    memberName?: string
): string => {
    let message = notification.message;

    if (memberName) {
        message = `नमस्कार ${memberName},\n\n${message}`;
    }

    message += `\n\n- ${notification.title}`;

    return message;
};

// --- 9. Bulk Notification Generator ---
export const generateBulkNotifications = (
    type: 'payment' | 'meeting' | 'general',
    title: string,
    message: string,
    targetMembers: string[],
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
): Notification => {
    return {
        id: `bulk-${type}-${Date.now()}`,
        type,
        priority,
        title,
        message,
        targetMembers,
        status: 'pending',
        createdBy: 'admin',
        createdAt: Date.now()
    };
};
