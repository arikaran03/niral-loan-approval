// src/utils/formatters.js

/**
 * Formats a number as currency.
 * @param {number} amount - The amount to format.
 * @param {string} currency - The currency code (e.g., 'INR', 'USD').
 * @returns {string} The formatted currency string.
 */
export const formatCurrency = (amount, currency = 'INR') => {
    if (amount === null || amount === undefined || isNaN(Number(amount))) {
        return 'N/A';
    }
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
};

/**
 * Formats a date string into a more readable format.
 * @param {string | Date} dateString - The date string or Date object to format.
 * @param {object} options - Intl.DateTimeFormat options.
 * @returns {string} The formatted date string or 'N/A'.
 */
export const formatDate = (dateString, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A'; // Invalid date
        return date.toLocaleDateString('en-GB', options);
    } catch (e) {
        return 'N/A';
    }
};

/**
 * Determines the Bootstrap badge variant based on loan repayment status.
 * @param {string} status - The loan repayment status string.
 * @returns {string} The Bootstrap badge background variant (e.g., 'success', 'danger').
 */
export const getStatusBadgeVariant = (status) => {
    switch (status) {
        case 'Active': return 'success';
        case 'Active - Grace Period': return 'warning';
        case 'Active - Overdue': return 'danger';
        case 'Fully Repaid': return 'primary';
        case 'Foreclosed': return 'info';
        case 'Restructured': return 'secondary';
        case 'Defaulted': return 'dark';
        case 'Write-Off': return 'dark';
        case 'Legal Action Pending': return 'warning';
        default: return 'light'; // Use 'light' with 'text-dark' for better contrast if needed
    }
};

/**
 * Determines the Bootstrap badge variant for installment status.
 * @param {string} status - The installment status string.
 * @returns {string} The Bootstrap badge background variant.
 */
export const getInstallmentStatusBadgeVariant = (status) => {
    switch (status) {
        case 'Paid': return 'success';
        case 'Pending': return 'warning';
        case 'Overdue': return 'danger';
        case 'Paid Late': return 'info';
        case 'Waived': return 'secondary';
        case 'Skipped': return 'light';
        case 'Cancelled': return 'dark';
        default: return 'light';
    }
};
