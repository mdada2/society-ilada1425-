import { Member, Transaction, SearchQuery, SearchResult, FilterCriteria, DuplicateDetectionResult, ValidationResult } from '../types';

// ============================================================================
// PHASE 6: SMART SEARCH & FILTERS
// ============================================================================

// --- 1. Natural Language Search for Members ---
export const searchMembers = (
    members: Member[],
    query: string,
    filters?: FilterCriteria
): SearchResult<Member> => {
    const startTime = Date.now();
    const searchTerm = query.toLowerCase().trim();

    let results = members;

    // Apply text search
    if (searchTerm) {
        results = results.filter(m =>
            m.name.toLowerCase().includes(searchTerm) ||
            m.memberNo.toLowerCase().includes(searchTerm) ||
            m.village?.toLowerCase().includes(searchTerm) ||
            m.mobile?.includes(searchTerm) ||
            m.bankAccountNo?.toLowerCase().includes(searchTerm)
        );
    }

    // Apply filters
    if (filters) {
        if (filters.village) {
            results = results.filter(m => m.village === filters.village);
        }
        if (filters.gender) {
            results = results.filter(m => m.gender === filters.gender);
        }
        if (filters.category) {
            results = results.filter(m => m.category === filters.category);
        }
        if (filters.hasLoan !== undefined) {
            results = results.filter(m => filters.hasLoan ? (m.loanPrincipal || 0) > 0 : (m.loanPrincipal || 0) === 0);
        }
        if (filters.loanAmountMin !== undefined) {
            results = results.filter(m => (m.loanPrincipal || 0) >= filters.loanAmountMin!);
        }
        if (filters.loanAmountMax !== undefined) {
            results = results.filter(m => (m.loanPrincipal || 0) <= filters.loanAmountMax!);
        }
        if (filters.savingsMin !== undefined) {
            results = results.filter(m => (m.savingsBalance || 0) >= filters.savingsMin!);
        }
        if (filters.savingsMax !== undefined) {
            results = results.filter(m => (m.savingsBalance || 0) <= filters.savingsMax!);
        }
    }

    const executionTime = Date.now() - startTime;

    return {
        items: results,
        totalCount: results.length,
        query: query,
        executionTime,
        suggestions: generateSearchSuggestions(query, members)
    };
};

// --- 2. Search Transactions ---
export const searchTransactions = (
    transactions: Transaction[],
    query: string,
    filters?: FilterCriteria
): SearchResult<Transaction> => {
    const startTime = Date.now();
    const searchTerm = query.toLowerCase().trim();

    let results = transactions;

    // Apply text search
    if (searchTerm) {
        results = results.filter(t =>
            t.memberName?.toLowerCase().includes(searchTerm) ||
            t.details.toLowerCase().includes(searchTerm) ||
            t.accountType.toLowerCase().includes(searchTerm) ||
            t.amount.toString().includes(searchTerm)
        );
    }

    // Apply filters
    if (filters) {
        if (filters.accountType) {
            results = results.filter(t => t.accountType === filters.accountType);
        }
        if (filters.transactionType) {
            results = results.filter(t => t.type === filters.transactionType);
        }
        if (filters.dateFrom) {
            results = results.filter(t => t.date >= filters.dateFrom!);
        }
        if (filters.dateTo) {
            results = results.filter(t => t.date <= filters.dateTo!);
        }
    }

    const executionTime = Date.now() - startTime;

    return {
        items: results,
        totalCount: results.length,
        query: query,
        executionTime
    };
};

// --- 3. Advanced Filter Engine ---
export const applyComplexFilters = (
    members: Member[],
    filters: FilterCriteria[]
): Member[] => {
    let results = members;

    filters.forEach(filter => {
        if (filter.village) {
            results = results.filter(m => m.village === filter.village);
        }
        if (filter.gender) {
            results = results.filter(m => m.gender === filter.gender);
        }
        if (filter.category) {
            results = results.filter(m => m.category === filter.category);
        }
        if (filter.hasLoan !== undefined) {
            results = results.filter(m => filter.hasLoan ? (m.loanPrincipal || 0) > 0 : (m.loanPrincipal || 0) === 0);
        }
        if (filter.loanAmountMin !== undefined) {
            results = results.filter(m => (m.loanPrincipal || 0) >= filter.loanAmountMin!);
        }
        if (filter.loanAmountMax !== undefined) {
            results = results.filter(m => (m.loanPrincipal || 0) <= filter.loanAmountMax!);
        }
    });

    return results;
};

// --- 4. Duplicate Detection ---
export const detectDuplicates = (members: Member[]): DuplicateDetectionResult => {
    const duplicates: Array<{ group: Member[]; reason: string; confidence: number }> = [];
    const processed = new Set<string>();

    // Check for exact name matches
    members.forEach((m1, i) => {
        if (processed.has(m1.id)) return;

        const nameMatches = members.filter((m2, j) =>
            i !== j &&
            !processed.has(m2.id) &&
            m1.name.toLowerCase() === m2.name.toLowerCase()
        );

        if (nameMatches.length > 0) {
            const group = [m1, ...nameMatches];
            duplicates.push({
                group,
                reason: 'Exact name match',
                confidence: 95
            });
            group.forEach(m => processed.add(m.id));
        }
    });

    // Check for similar names (Levenshtein distance)
    members.forEach((m1, i) => {
        if (processed.has(m1.id)) return;

        const similarNames = members.filter((m2, j) =>
            i !== j &&
            !processed.has(m2.id) &&
            calculateSimilarity(m1.name, m2.name) > 0.8
        );

        if (similarNames.length > 0) {
            const group = [m1, ...similarNames];
            duplicates.push({
                group,
                reason: 'Similar name',
                confidence: 75
            });
            group.forEach(m => processed.add(m.id));
        }
    });

    // Check for same mobile number
    members.forEach((m1, i) => {
        if (processed.has(m1.id) || !m1.mobile) return;

        const mobileMatches = members.filter((m2, j) =>
            i !== j &&
            !processed.has(m2.id) &&
            m2.mobile &&
            m1.mobile === m2.mobile
        );

        if (mobileMatches.length > 0) {
            const group = [m1, ...mobileMatches];
            duplicates.push({
                group,
                reason: 'Same mobile number',
                confidence: 90
            });
            group.forEach(m => processed.add(m.id));
        }
    });

    const suggestions = duplicates.map(d =>
        `Found ${d.group.length} members with ${d.reason}: ${d.group.map(m => m.name).join(', ')}`
    );

    return {
        duplicates,
        totalDuplicates: duplicates.reduce((sum, d) => sum + d.group.length, 0),
        suggestions
    };
};

// --- 5. Data Validation ---
export const validateMemberData = (member: Partial<Member>): ValidationResult => {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    // Required fields
    if (!member.name || member.name.trim().length === 0) {
        errors.push({
            field: 'name',
            value: member.name,
            message: 'Name is required',
            severity: 'error'
        });
    }

    if (!member.memberNo || member.memberNo.trim().length === 0) {
        errors.push({
            field: 'memberNo',
            value: member.memberNo,
            message: 'Member number is required',
            severity: 'error'
        });
    }

    // Mobile validation
    if (member.mobile) {
        if (!/^\d{10}$/.test(member.mobile)) {
            errors.push({
                field: 'mobile',
                value: member.mobile,
                message: 'Mobile number must be 10 digits',
                severity: 'error'
            });
        }
    } else {
        warnings.push({
            field: 'mobile',
            value: member.mobile,
            message: 'Mobile number is recommended'
        });
    }

    // Village validation
    if (!member.village || member.village.trim().length === 0) {
        warnings.push({
            field: 'village',
            value: member.village,
            message: 'Village is recommended'
        });
    }

    // Gender validation
    if (member.gender && !['Male', 'Female'].includes(member.gender)) {
        errors.push({
            field: 'gender',
            value: member.gender,
            message: 'Gender must be Male or Female',
            severity: 'error'
        });
    }

    // Loan validation
    if (member.loanPrincipal && member.loanPrincipal < 0) {
        errors.push({
            field: 'loanPrincipal',
            value: member.loanPrincipal,
            message: 'Loan principal cannot be negative',
            severity: 'error'
        });
    }

    // Savings validation
    if (member.savingsBalance && member.savingsBalance < 0) {
        errors.push({
            field: 'savingsBalance',
            value: member.savingsBalance,
            message: 'Savings balance cannot be negative',
            severity: 'error'
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
};

// --- 6. Transaction Validation ---
export const validateTransactionData = (transaction: Partial<Transaction>): ValidationResult => {
    const errors: ValidationResult['errors'] = [];
    const warnings: ValidationResult['warnings'] = [];

    // Required fields
    if (!transaction.date) {
        errors.push({
            field: 'date',
            value: transaction.date,
            message: 'Date is required',
            severity: 'error'
        });
    }

    if (!transaction.amount || transaction.amount <= 0) {
        errors.push({
            field: 'amount',
            value: transaction.amount,
            message: 'Amount must be greater than 0',
            severity: 'error'
        });
    }

    if (!transaction.accountType) {
        errors.push({
            field: 'accountType',
            value: transaction.accountType,
            message: 'Account type is required',
            severity: 'error'
        });
    }

    if (!transaction.type) {
        errors.push({
            field: 'type',
            value: transaction.type,
            message: 'Transaction type is required',
            severity: 'error'
        });
    }

    if (!transaction.details || transaction.details.trim().length === 0) {
        warnings.push({
            field: 'details',
            value: transaction.details,
            message: 'Transaction details are recommended'
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
};

// --- 7. Helper: Calculate String Similarity ---
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    if (s1 === s2) return 1;

    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0 || len2 === 0) return 0;

    // Simple similarity based on common characters
    const commonChars = new Set([...s1].filter(c => s2.includes(c)));
    const similarity = (commonChars.size * 2) / (len1 + len2);

    return similarity;
}

// --- 8. Generate Search Suggestions ---
function generateSearchSuggestions(query: string, members: Member[]): string[] {
    const suggestions: string[] = [];
    const searchTerm = query.toLowerCase().trim();

    if (searchTerm.length < 2) return suggestions;

    // Suggest villages
    const villages = [...new Set(members.map(m => m.village).filter(Boolean))];
    const matchingVillages = villages.filter(v => v!.toLowerCase().includes(searchTerm));
    matchingVillages.slice(0, 3).forEach(v => suggestions.push(`Search in ${v}`));

    // Suggest member names
    const matchingNames = members
        .filter(m => m.name.toLowerCase().includes(searchTerm))
        .slice(0, 3)
        .map(m => m.name);
    matchingNames.forEach(n => suggestions.push(n));

    return suggestions;
}

// --- 9. Sort Members ---
export const sortMembers = (
    members: Member[],
    sortBy: keyof Member,
    sortOrder: 'asc' | 'desc' = 'asc'
): Member[] => {
    return [...members].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (aVal === undefined || aVal === null) return 1;
        if (bVal === undefined || bVal === null) return -1;

        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
            comparison = aVal - bVal;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
    });
};

// --- 10. Get Unique Values ---
export const getUniqueValues = (
    members: Member[],
    field: keyof Member
): string[] => {
    const values = members.map(m => m[field]).filter(Boolean);
    return [...new Set(values as string[])].sort();
};
