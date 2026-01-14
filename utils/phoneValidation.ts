/**
 * Phone number validation and formatting utilities
 */

/**
 * Validates if a phone number is valid for India
 * @param phoneNumber - Phone number to validate (can be with or without +91)
 * @returns true if valid, false otherwise
 */
export const isValidIndianPhoneNumber = (phoneNumber: string): boolean => {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    // Check if it's 10 digits (without country code) or 12 digits (with 91)
    if (digitsOnly.length === 10) {
        // Must start with 6, 7, 8, or 9
        return /^[6-9]\d{9}$/.test(digitsOnly);
    } else if (digitsOnly.length === 12) {
        // Must start with 91 followed by valid 10-digit number
        return /^91[6-9]\d{9}$/.test(digitsOnly);
    }

    return false;
};

/**
 * Converts phone number to E.164 format (+919876543210)
 * @param phoneNumber - Phone number to convert
 * @returns E.164 formatted phone number or null if invalid
 */
export const toE164Format = (phoneNumber: string): string | null => {
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    if (!isValidIndianPhoneNumber(phoneNumber)) {
        return null;
    }

    // If already has country code
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        return `+${digitsOnly}`;
    }

    // Add country code
    if (digitsOnly.length === 10) {
        return `+91${digitsOnly}`;
    }

    return null;
};

/**
 * Formats phone number for display (+91 98765 43210)
 * @param phoneNumber - Phone number to format
 * @returns Formatted phone number for display
 */
export const formatPhoneForDisplay = (phoneNumber: string): string => {
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    let number = digitsOnly;

    // Remove country code if present
    if (number.startsWith('91') && number.length === 12) {
        number = number.substring(2);
    }

    // Format as +91 98765 43210
    if (number.length === 10) {
        return `+91 ${number.substring(0, 5)} ${number.substring(5)}`;
    }

    return phoneNumber;
};

/**
 * Extracts just the 10-digit number without country code
 * @param phoneNumber - Phone number
 * @returns 10-digit number or original if invalid
 */
export const extractDigits = (phoneNumber: string): string => {
    const digitsOnly = phoneNumber.replace(/\D/g, '');

    if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
        return digitsOnly.substring(2);
    }

    return digitsOnly.length === 10 ? digitsOnly : phoneNumber;
};
