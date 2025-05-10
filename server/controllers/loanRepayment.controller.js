// src/controllers/loanRepayment.controller.js
import LoanRepayment from '../database/models/LoanRepayment.js';
import LoanSubmission from '../database/models/LoanSubmission.js';
import Loan from '../database/models/Loan.js';
import User from '../database/models/User.js';
import mongoose from 'mongoose';

// Helper function for error responses
const handleError = (res, error, message = "An error occurred", statusCode = 500) => {
    console.error(message, error);
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ success: false, message: "Validation Error", errors });
    }
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
        return res.status(400).json({ success: false, message: "Invalid ID format." });
    }
    return res.status(statusCode).json({ success: false, message, error: error.message });
};

// --- Internal Service Function for Creating Loan Repayment Record ---
export async function createLoanRepaymentRecordInternal(
    loanSubmissionId,
    disbursedAmount,
    repaymentStartDate,
    calculatedEMI,
    loanProductDetails, 
    userId, 
    adminUserId 
) {
    try {
        const existingRepayment = await LoanRepayment.findOne({ loan_submission_id: loanSubmissionId });
        if (existingRepayment) {
            console.warn(`LoanRepayment record already exists for submission ${loanSubmissionId}`);
            return existingRepayment;
        }

        if (!loanProductDetails || !loanProductDetails._id) {
            throw new Error("Loan product details are missing or invalid for repayment creation.");
        }
        if (!userId) {
            throw new Error("User ID is missing for repayment creation.");
        }

        const newRepayment = new LoanRepayment({
            loan_submission_id: loanSubmissionId,
            loan_id: loanProductDetails._id,
            user_id: userId,
            disbursed_amount: disbursedAmount,
            agreed_interest_rate_pa: loanProductDetails.interest_rate,
            original_tenure_months: loanProductDetails.tenure_months,
            initial_calculated_emi: calculatedEMI,
            processing_fee_paid: loanProductDetails.processing_fee || 0,
            repayment_start_date: repaymentStartDate,
            original_expected_closure_date: new Date(new Date(repaymentStartDate).setMonth(new Date(repaymentStartDate).getMonth() + loanProductDetails.tenure_months)),
            current_outstanding_principal: disbursedAmount,
            loan_repayment_status: 'Active',
            penalty_configuration: loanProductDetails.penalty_config || { 
                late_payment_fee_type: 'None', 
                late_payment_grace_period_days: 0 
            },
            prepayment_configuration: loanProductDetails.prepayment_config || { 
                allow_prepayment: true, 
                prepayment_fee_type: 'None',
                lock_in_period_months: 0
            },
            internal_notes: adminUserId ? [{
                text: `Repayment schedule initiated by admin ${adminUserId}.`,
                added_by: adminUserId,
                note_date: new Date()
            }] : []
        });

        // --- Generate Amortization Schedule ---
        if (newRepayment.original_tenure_months > 0 && newRepayment.disbursed_amount > 0 && newRepayment.initial_calculated_emi > 0) {
            const P = newRepayment.disbursed_amount;
            const R = newRepayment.agreed_interest_rate_pa / 12 / 100; // monthly rate
            const N = newRepayment.original_tenure_months;
            const EMI = newRepayment.initial_calculated_emi;

            let balance = P;
            for (let i = 1; i <= N; i++) {
                const interest_for_month = balance * R;
                let principal_for_month = EMI - interest_for_month;
                
                // Adjust last installment's principal to ensure balance is zero
                if (i === N) {
                    principal_for_month = balance;
                }
                
                balance -= principal_for_month;
                // Minor adjustment for floating point inaccuracies for the very last balance
                if (i === N && Math.abs(balance) < 0.01) {
                    principal_for_month += balance; // Add remaining tiny balance to last principal payment
                    balance = 0;
                }


                const installment_due_date = new Date(newRepayment.repayment_start_date);
                installment_due_date.setMonth(newRepayment.repayment_start_date.getMonth() + (i - 1));
                
                const currentEMI = (i === N && N > 1 && (Math.abs(balance) > 0.01 || principal_for_month + interest_for_month !== EMI)) ? 
                                   (Math.round((principal_for_month + interest_for_month) * 100) / 100) : EMI;


                newRepayment.scheduled_installments.push({
                    installment_number: i,
                    due_date: installment_due_date,
                    principal_due: Math.max(0, Math.round(principal_for_month * 100) / 100),
                    interest_due: Math.max(0, Math.round(interest_for_month * 100) / 100),
                    total_emi_due: currentEMI,
                    status: 'Pending',
                    principal_paid: 0,
                    interest_paid: 0,
                    penalty_due: 0,
                    penalty_paid: 0,
                    principal_waived: 0,
                    interest_waived: 0,
                    penalty_waived: 0,
                    is_penalty_applied: false,
                });
            }
             if (newRepayment.scheduled_installments.length > 0) {
                newRepayment.next_due_date = newRepayment.scheduled_installments[0].due_date;
                newRepayment.next_emi_amount = newRepayment.scheduled_installments[0].total_emi_due;
            }
        } else {
            console.warn(`Skipping amortization schedule generation for submission ${loanSubmissionId} due to invalid terms (tenure: ${newRepayment.original_tenure_months}, amount: ${newRepayment.disbursed_amount}, EMI: ${newRepayment.initial_calculated_emi})`);
        }
        
        await newRepayment.save();
        console.log(`LoanRepayment record created: ${newRepayment._id} for submission ${loanSubmissionId}`);
        return newRepayment;
    } catch (error) {
        console.error(`Error in createLoanRepaymentRecordInternal for submission ${loanSubmissionId}:`, error);
        throw error; 
    }
}


const loanRepaymentController = {
    getMyLoanRepayments: async (req, res) => {
        // ... (same as before)
        try {
            const userId = req.user._id; 
            if (!userId) {
                return res.status(401).json({ success: false, message: "User not authenticated." });
            }
            const repayments = await LoanRepayment.find({ user_id: userId })
                .select('loan_id disbursed_amount initial_calculated_emi current_outstanding_principal next_due_date loan_repayment_status createdAt')
                .populate({ path: 'loan_id', select: 'title' }) 
                .sort({ createdAt: -1 });

            if (!repayments.length) {
                return res.status(200).json({ success: true, message: "No loan repayments found.", data: [] });
            }
            res.status(200).json({ success: true, data: repayments });
        } catch (error) {
            handleError(res, error, "Failed to fetch user's loan repayments.");
        }
    },

    getLoanRepaymentDetailsForApplicant: async (req, res) => {
        // ... (same as before)
        try {
            const { repaymentId } = req.params;
            const userId = req.user._id; 

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!userId) {
                return res.status(401).json({ success: false, message: "User not authenticated." });
            }
            const repayment = await LoanRepayment.findOne({ _id: repaymentId, user_id: userId })
                .populate({ path: 'loan_id', select: 'title agreed_interest_rate_pa original_tenure_months' })
                .populate({ path: 'loan_submission_id', select: 'amount stage' });
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found or access denied." });
            }
            res.status(200).json({ success: true, data: repayment });
        } catch (error) {
            handleError(res, error, "Failed to fetch loan repayment details.");
        }
    },

    makePaymentForLoan: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            const { amount, paymentMethod, referenceId, paymentModeDetails } = req.body;
            const userId = req.user._id; 

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!userId) { return res.status(401).json({ success: false, message: "User not authenticated." }); }
            if (!amount || typeof amount !== 'number' || amount <= 0) {
                return res.status(400).json({ success: false, message: "Invalid payment amount." });
            }
            if (!paymentMethod) {
                return res.status(400).json({ success: false, message: "Payment method is required." });
            }

            const repayment = await LoanRepayment.findById(repaymentId); // Find by ID, ownership check later if needed for admin
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
             // Ensure the payment is made by the loan owner if it's an applicant route
            if (repayment.user_id.toString() !== userId.toString()) {
                return res.status(403).json({ success: false, message: "Access denied. You are not the owner of this loan repayment." });
            }

            if (['Fully Repaid', 'Foreclosed', 'Write-Off'].includes(repayment.loan_repayment_status)) {
                return res.status(400).json({ success: false, message: `Loan is already ${repayment.loan_repayment_status}. No further payments accepted.` });
            }

            const newTransaction = {
                transaction_date: new Date(),
                amount_received: amount,
                payment_method: paymentMethod,
                reference_id: referenceId,
                payment_mode_details: paymentModeDetails,
                status: 'Cleared', // Simulate payment as Cleared for better UX
                created_by_type: 'User', 
                // Allocation will be done by processPayment method
                principal_component: 0, // Initialize, to be set by processPayment
                interest_component: 0,  // Initialize
                penalty_component: 0,   // Initialize
            };
            repayment.payment_transactions.push(newTransaction);
            const savedTransaction = repayment.payment_transactions[repayment.payment_transactions.length - 1];
            
            // --- Conceptual Call to Process Payment ---
            // In a real system, this method would be robust and handle all financial logic.
            // It should be an instance method on the LoanRepayment model.
            if (typeof repayment.processPayment === 'function') {
                await repayment.processPayment(savedTransaction._id); // Pass transaction ID
            } else {
                // Simplified fallback if processPayment model method is not implemented yet
                console.warn("LoanRepayment.processPayment() method not implemented. Performing simplified update.");
                // This simplified update is NOT a substitute for proper financial processing.
                let remainingAmountToAllocate = amount;
                
                // Find first pending/overdue installment
                const firstPendingInstallment = repayment.scheduled_installments.find(
                    inst => ['Pending', 'Overdue', 'Partially Paid'].includes(inst.status)
                );

                if (firstPendingInstallment) {
                    const principalNeeded = firstPendingInstallment.principal_due - firstPendingInstallment.principal_paid;
                    const interestNeeded = firstPendingInstallment.interest_due - firstPendingInstallment.interest_paid;
                    
                    const interestPaidNow = Math.min(remainingAmountToAllocate, interestNeeded);
                    savedTransaction.interest_component += interestPaidNow;
                    firstPendingInstallment.interest_paid += interestPaidNow;
                    remainingAmountToAllocate -= interestPaidNow;

                    if (remainingAmountToAllocate > 0) {
                        const principalPaidNow = Math.min(remainingAmountToAllocate, principalNeeded);
                        savedTransaction.principal_component += principalPaidNow;
                        firstPendingInstallment.principal_paid += principalPaidNow;
                        remainingAmountToAllocate -= principalPaidNow;
                    }
                     // Update installment status (simplified)
                    if ((firstPendingInstallment.principal_due - firstPendingInstallment.principal_paid <= 0.01) &&
                        (firstPendingInstallment.interest_due - firstPendingInstallment.interest_paid <= 0.01)) {
                        firstPendingInstallment.status = 'Paid';
                        firstPendingInstallment.last_payment_date_for_installment = new Date();
                    } else if (firstPendingInstallment.principal_paid > 0 || firstPendingInstallment.interest_paid > 0) {
                        firstPendingInstallment.status = 'Partially Paid';
                    }
                }
                
                savedTransaction.unallocated_amount = remainingAmountToAllocate > 0 ? remainingAmountToAllocate : 0;

                repayment.total_principal_repaid += savedTransaction.principal_component;
                repayment.total_interest_repaid += savedTransaction.interest_component;
                repayment.current_outstanding_principal -= savedTransaction.principal_component;
                if (repayment.current_outstanding_principal < 0) repayment.current_outstanding_principal = 0;
                
                if (repayment.current_outstanding_principal <= 0.01) { // Check for full repayment
                    repayment.loan_repayment_status = 'Fully Repaid';
                    repayment.actual_closure_date = new Date();
                }
            }
            // --- End Conceptual Call ---
            
            repayment.last_payment_amount = amount;
            repayment.last_payment_date = new Date();
            await repayment.save();

            res.status(201).json({
                success: true,
                message: "Payment recorded successfully. Loan details are being updated.",
                data: { transactionId: savedTransaction._id, repaymentStatus: repayment.loan_repayment_status }
            });
        } catch (error) {
            handleError(res, error, "Failed to make payment.");
        }
    },

    getForeclosureQuote: async (req, res) => {
        // ... (same as before)
        try {
            const { repaymentId } = req.params;
            const userId = req.user._id;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            const repayment = await LoanRepayment.findOne({ _id: repaymentId, user_id: userId });
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found or access denied." });
            }
            if (!repayment.prepayment_configuration.allow_prepayment) {
                 return res.status(400).json({ success: false, message: "Foreclosure is not allowed for this loan." });
            }
            const lockInEndDate = new Date(repayment.repayment_start_date);
            lockInEndDate.setMonth(lockInEndDate.getMonth() + (repayment.prepayment_configuration.lock_in_period_months || 0));
            if (new Date() < lockInEndDate) {
                return res.status(400).json({ success: false, message: `Foreclosure not allowed during lock-in period. Available after ${lockInEndDate.toLocaleDateString()}.` });
            }

            const outstandingPrincipal = repayment.current_outstanding_principal;
            let foreclosureFee = 0;
            const feeConfig = repayment.prepayment_configuration;

            if (feeConfig.prepayment_fee_type !== 'None' && feeConfig.prepayment_fee_value > 0) {
                switch (feeConfig.prepayment_fee_type) {
                    case 'FixedAmount': foreclosureFee = feeConfig.prepayment_fee_value; break;
                    case 'PercentageOfOutstandingPrincipal': foreclosureFee = (outstandingPrincipal * feeConfig.prepayment_fee_value) / 100; break;
                    case 'PercentageOfPrepaidAmount': foreclosureFee = (outstandingPrincipal * feeConfig.prepayment_fee_value) / 100; break;
                }
            }
            foreclosureFee = Math.round(foreclosureFee * 100) / 100;
            // TODO: Implement accurate accrued interest calculation up to quote date.
            const accruedInterest = repayment.accrued_interest_not_due || 0; 
            const totalForeclosureAmount = outstandingPrincipal + accruedInterest + foreclosureFee;

            res.status(200).json({
                success: true,
                data: {
                    repaymentId: repayment._id, outstandingPrincipal, accruedInterest, foreclosureFee,
                    totalForeclosureAmount: Math.round(totalForeclosureAmount * 100) / 100,
                    quoteValidUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Example: 24 hours validity
                    notes: "Accrued interest is an estimate and may vary. Final settlement amount will be confirmed upon payment."
                }
            });
        } catch (error) {
            handleError(res, error, "Failed to get foreclosure quote.");
        }
    },

    confirmForeclosure: async (req, res) => {
        // ... (same as before, but ensure processPayment or similar logic is robust)
        try {
            const { repaymentId } = req.params;
            const { paymentDetails } = req.body; 
            const userId = req.user._id;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!paymentDetails || !paymentDetails.amountPaid || !paymentDetails.paymentMethod) {
                return res.status(400).json({ success: false, message: "Payment details are required." });
            }
            const repayment = await LoanRepayment.findById(repaymentId); // Ownership check later if admin route
             if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
            if (repayment.user_id.toString() !== userId.toString()) {
                return res.status(403).json({ success: false, message: "Access denied." });
            }
            if (['Foreclosed', 'Fully Repaid', 'Write-Off'].includes(repayment.loan_repayment_status)) {
                return res.status(400).json({ success: false, message: "Loan is already closed." });
            }

            // Ideally, this would call a robust `repayment.handleForeclosure(paymentDetails)` model method.
            // The method would record the transaction, verify amount against quote, update all balances to zero,
            // set foreclosure_details, change loan_repayment_status, and cancel pending installments.

            // Simplified simulation:
            const foreclosureTransaction = {
                transaction_date: paymentDetails.paymentDate || new Date(),
                amount_received: paymentDetails.amountPaid,
                payment_method: paymentDetails.paymentMethod,
                reference_id: paymentDetails.transactionReference,
                status: 'Cleared', // Assuming payment confirmed for foreclosure
                created_by_type: 'User',
                notes: `Foreclosure payment. Fee: ${paymentDetails.foreclosureFeePaid || 0}. Ref: ${paymentDetails.transactionReference}`,
                principal_component: repayment.current_outstanding_principal, // Simplified, should be exact
                interest_component: repayment.accrued_interest_not_due || 0, // Simplified
                penalty_component: 0, // Assuming no penalties for this example
                unallocated_amount: Math.max(0, paymentDetails.amountPaid - (repayment.current_outstanding_principal + (repayment.accrued_interest_not_due || 0) + (paymentDetails.foreclosureFeePaid || 0)))
            };
            repayment.payment_transactions.push(foreclosureTransaction);
            
            repayment.foreclosure_details = {
                is_foreclosed: true,
                foreclosure_date: new Date(foreclosureTransaction.transaction_date),
                foreclosure_amount_paid: paymentDetails.amountPaid,
                foreclosure_fee_paid: paymentDetails.foreclosureFeePaid || 0,
                foreclosure_notes: paymentDetails.notes || "Foreclosed by applicant via confirmed payment."
            };
            repayment.loan_repayment_status = 'Foreclosed';
            repayment.actual_closure_date = new Date(repayment.foreclosure_details.foreclosure_date);
            repayment.current_outstanding_principal = 0;
            repayment.accrued_interest_not_due = 0;
            repayment.total_principal_repaid += foreclosureTransaction.principal_component; // Update aggregates
            repayment.total_interest_repaid += foreclosureTransaction.interest_component;
            // repayment.total_penalties_paid += ... (if foreclosure fee is treated as penalty)

            repayment.scheduled_installments.forEach(inst => {
                if (!['Paid', 'Paid Late', 'Waived'].includes(inst.status)) { 
                    inst.status = 'Cancelled'; 
                }
            });
            repayment.next_due_date = null;
            repayment.next_emi_amount = null;

            await repayment.save();
            res.status(200).json({ success: true, message: "Loan successfully foreclosed.", data: repayment });
        } catch (error) {
            handleError(res, error, "Failed to confirm foreclosure.");
        }
    },
    
    // ... other admin controllers remain largely the same but should use robust model methods ...
    adminGetAllLoanRepayments: async (req, res) => {
        try {
            const { status, userId, page = 1, limit = 10, loanId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
            const query = {};
            if (status) query.loan_repayment_status = status;
            if (userId && mongoose.Types.ObjectId.isValid(userId)) query.user_id = userId;
            if (loanId && mongoose.Types.ObjectId.isValid(loanId)) query.loan_id = loanId;

            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const repayments = await LoanRepayment.find(query)
                .populate({ path: 'user_id', select: 'name email' }) 
                .populate({ path: 'loan_id', select: 'title' })
                .select('-scheduled_installments -payment_transactions.payment_mode_details') 
                .limit(parseInt(limit))
                .skip(skip)
                .sort(sortOptions);
            const totalRecords = await LoanRepayment.countDocuments(query);

            res.status(200).json({
                success: true, data: repayments,
                pagination: {
                    currentPage: parseInt(page), totalPages: Math.ceil(totalRecords / parseInt(limit)),
                    totalRecords, limit: parseInt(limit)
                }
            });
        } catch (error) {
            handleError(res, error, "Failed to fetch all loan repayments.");
        }
    },

    adminGetRepaymentsByUserId: async (req, res) => {
        try {
            const { userId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ success: false, message: "Invalid User ID format." });
            }
            const repayments = await LoanRepayment.find({ user_id: userId })
                .populate({ path: 'loan_id', select: 'title' })
                .sort({ createdAt: -1 });
            if (!repayments.length) {
                return res.status(200).json({ success: true, message: `No loan repayments found for user ${userId}.`, data: [] });
            }
            res.status(200).json({ success: true, data: repayments });
        } catch (error) {
            handleError(res, error, `Failed to fetch loan repayments for user ${userId}.`);
        }
    },

    adminGetLoanRepaymentDetails: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            const repayment = await LoanRepayment.findById(repaymentId)
                .populate({ path: 'user_id', select: 'name email phone' }) 
                .populate({ path: 'loan_id', select: 'title agreed_interest_rate_pa original_tenure_months status' })
                .populate({ path: 'loan_submission_id', select: 'amount stage created_at' })
                .populate({ path: 'payment_transactions.processed_by', select: 'name' }); 
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
            res.status(200).json({ success: true, data: repayment });
        } catch (error) {
            handleError(res, error, "Failed to fetch loan repayment details for admin.");
        }
    },

    adminRecordPaymentTransaction: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            const adminUserId = req.user._id; 
            const {
                transaction_date, amount_received, payment_method, reference_id, notes,
                status = 'Cleared', principal_component, interest_component, penalty_component,
                payment_mode_details, value_date
            } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (amount_received === undefined || typeof amount_received !== 'number' ) { 
                return res.status(400).json({ success: false, message: "Valid amount_received is required." });
            }
            if (!payment_method) {
                return res.status(400).json({ success: false, message: "Payment method is required." });
            }

            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }

            const newTransaction = {
                transaction_date: transaction_date || new Date(),
                amount_received, payment_method, reference_id, notes, status,
                principal_component: principal_component || 0,
                interest_component: interest_component || 0,
                penalty_component: penalty_component || 0,
                payment_mode_details,
                value_date: value_date || transaction_date || new Date(),
                processed_by: adminUserId,
                created_by_type: 'System' // Or 'Admin'
            };
            const allocated = (newTransaction.principal_component || 0) + (newTransaction.interest_component || 0) + (newTransaction.penalty_component || 0);
            newTransaction.unallocated_amount = amount_received - allocated;
            if (newTransaction.unallocated_amount < -0.01) { 
                 return res.status(400).json({ success: false, message: "Sum of components cannot exceed amount received." });
            }
            if (Math.abs(newTransaction.unallocated_amount) < 0.01) newTransaction.unallocated_amount = 0;


            repayment.payment_transactions.push(newTransaction);
            const savedTransaction = repayment.payment_transactions[repayment.payment_transactions.length - 1];
            
            if (status === 'Cleared') {
                // This is where a robust repayment.processPayment(savedTransaction._id, adminUserId) would be ideal.
                // Simplified update:
                repayment.total_principal_repaid += newTransaction.principal_component || 0;
                repayment.total_interest_repaid += newTransaction.interest_component || 0;
                repayment.total_penalties_paid += newTransaction.penalty_component || 0;
                repayment.current_outstanding_principal -= newTransaction.principal_component || 0;
                if (repayment.current_outstanding_principal < 0) repayment.current_outstanding_principal = 0;
                repayment.last_payment_amount = amount_received;
                repayment.last_payment_date = new Date(newTransaction.transaction_date);
                // TODO: Call a method to update installment statuses and overall loan status based on this payment.
                // e.g., await repayment.updateLoanRepaymentOverallStatus();
            }
            await repayment.save();
            res.status(201).json({ success: true, message: "Payment transaction recorded.", data: savedTransaction });
        } catch (error) {
            handleError(res, error, "Failed to record payment transaction.");
        }
    },
    // Other admin controllers (adminUpdatePaymentTransaction, adminApplyLateFees, etc.) would similarly benefit from
    // calling robust instance methods on the `repayment` object and then saving.
    // For brevity, I'll omit repeating them here but the pattern would be:
    // 1. Fetch repayment.
    // 2. Call `await repayment.methodName(paramsFromReqBody, req.user._id);`
    // 3. `await repayment.save();` (though model methods might save themselves)
    // 4. Send response.
    // ... (rest of the admin controllers from previous version)
    adminUpdatePaymentTransaction: async (req, res) => {
        try {
            const { repaymentId, transactionId } = req.params;
            const adminUserId = req.user._id;
            const updateData = req.body; 

            if (!mongoose.Types.ObjectId.isValid(repaymentId) || !mongoose.Types.ObjectId.isValid(transactionId)) {
                return res.status(400).json({ success: false, message: "Invalid ID format." });
            }
            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
            const transaction = repayment.payment_transactions.id(transactionId);
            if (!transaction) {
                return res.status(404).json({ success: false, message: "Payment transaction not found." });
            }

            Object.keys(updateData).forEach(key => {
                if (['status', 'status_reason', 'notes', 'reference_id', 'payment_mode_details', 'value_date'].includes(key)) {
                    transaction[key] = updateData[key];
                }
            });
            transaction.processed_by = adminUserId; 
            await repayment.save();
            // Conceptual call: if status changed significantly, await repayment.reProcessTransactionsAndAggregates();
            res.status(200).json({ success: true, message: "Payment transaction updated.", data: transaction });
        } catch (error) {
            handleError(res, error, "Failed to update payment transaction.");
        }
    },

    adminApplyLateFees: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
            // Conceptual call: await repayment.applyLateFees(req.user._id);
            console.log(`Conceptual: Late fees applied for repayment ${repaymentId}`);
            // await repayment.save(); 
            res.status(200).json({ success: true, message: "Late fee application process triggered (conceptual).", data: { repaymentId } });
        } catch (error) {
            handleError(res, error, "Failed to apply late fees.");
        }
    },

    adminRestructureLoan: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            const adminUserId = req.user._id;
            const { reason, previous_terms, new_terms, effective_from_installment, notes } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!reason || !new_terms) {
                return res.status(400).json({ success: false, message: "Reason and new terms are required." });
            }
            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }

            const restructureEntry = {
                restructure_date: new Date(), reason,
                previous_terms: previous_terms || { 
                    emi: repayment.initial_calculated_emi, tenure: repayment.original_tenure_months,
                    interest_rate: repayment.agreed_interest_rate_pa,
                    outstanding_principal: repayment.current_outstanding_principal
                },
                new_terms, effective_from_installment, notes, approved_by: adminUserId
            };
            repayment.restructure_history.push(restructureEntry);
            repayment.is_restructured = true;
            repayment.loan_repayment_status = 'Restructured'; 
            // IMPORTANT: Amortization schedule needs regeneration.
            // Conceptual call: await repayment.regenerateSchedule(new_terms, effective_from_installment);
            await repayment.save();
            res.status(200).json({ success: true, message: "Loan restructuring recorded. Schedule regeneration needed.", data: repayment });
        } catch (error) {
            handleError(res, error, "Failed to record loan restructuring.");
        }
    },

    adminWaiveInstallmentCharges: async (req, res) => {
        try {
            const { repaymentId, installmentNumber } = req.params;
            const { principal_waived = 0, interest_waived = 0, penalty_waived = 0, notes } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID." });
            }
            const instNum = parseInt(installmentNumber);
            if (isNaN(instNum) || instNum <= 0) {
                return res.status(400).json({ success: false, message: "Invalid installment number." });
            }
            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
            const installment = repayment.scheduled_installments.find(inst => inst.installment_number === instNum);
            if (!installment) {
                return res.status(404).json({ success: false, message: `Installment ${instNum} not found.` });
            }

            installment.principal_waived = (installment.principal_waived || 0) + Number(principal_waived);
            installment.interest_waived = (installment.interest_waived || 0) + Number(interest_waived);
            installment.penalty_waived = (installment.penalty_waived || 0) + Number(penalty_waived);
            if (notes) installment.notes = `${installment.notes || ''} Waiver by ${req.user._id}: ${notes}`.trim();

            repayment.total_principal_waived = (repayment.total_principal_waived || 0) + Number(principal_waived);
            repayment.total_interest_waived = (repayment.total_interest_waived || 0) + Number(interest_waived);
            repayment.total_penalties_waived = (repayment.total_penalties_waived || 0) + Number(penalty_waived);
            
            const remainingPrincipal = installment.principal_due - installment.principal_paid - installment.principal_waived;
            const remainingInterest = installment.interest_due - installment.interest_paid - installment.interest_waived;
            const remainingPenalty = installment.penalty_due - installment.penalty_paid - installment.penalty_waived;

            if (remainingPrincipal <= 0.01 && remainingInterest <= 0.01 && remainingPenalty <= 0.01) {
                 if ((installment.principal_waived + installment.interest_waived + installment.penalty_waived) >= (installment.total_emi_due + installment.penalty_due - installment.principal_paid - installment.interest_paid - installment.penalty_paid - 0.01) ) {
                     installment.status = 'Waived'; 
                } else {
                     installment.status = 'Paid'; 
                }
            }
            // Conceptual call: await repayment.updateLoanRepaymentOverallStatus();
            await repayment.save();
            res.status(200).json({ success: true, message: `Charges waived for installment ${instNum}.`, data: installment });
        } catch (error) {
            handleError(res, error, "Failed to waive installment charges.");
        }
    },

    adminUpdateLoanRepaymentOverallStatus: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            const adminUserId = req.user._id;
            const { loan_repayment_status, notes, writeOffAmount } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID." });
            }
            if (!loan_repayment_status) {
                return res.status(400).json({ success: false, message: "New status is required." });
            }
            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }

            repayment.loan_repayment_status = loan_repayment_status;
            if (loan_repayment_status === 'Write-Off') {
                repayment.is_written_off = true;
                repayment.write_off_details = {
                    date: new Date(),
                    amount: writeOffAmount || repayment.current_outstanding_principal,
                    reason: notes || "Loan written off by admin.",
                    approved_by: adminUserId
                };
                repayment.actual_closure_date = new Date();
                repayment.current_outstanding_principal = 0; 
            }
            const noteText = `Status changed to ${loan_repayment_status}${notes ? `. Reason: ${notes}` : '.'}`;
            repayment.internal_notes.push({ text: noteText, added_by: adminUserId });
            await repayment.save();
            res.status(200).json({ success: true, message: "Status updated.", data: repayment });
        } catch (error) {
            handleError(res, error, "Failed to update loan repayment status.");
        }
    },

    adminAddCommunicationLog: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            const adminUserId = req.user._id;
            const { type, subject, summary, recipient, status } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID." });
            }
            if (!type || !summary) {
                return res.status(400).json({ success: false, message: "Type and summary are required." });
            }
            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
            const logEntry = {
                log_date: new Date(), type, subject, summary, recipient,
                status: status || 'Sent', sent_by: adminUserId
            };
            repayment.communication_log.push(logEntry);
            await repayment.save();
            res.status(201).json({ success: true, message: "Communication log added.", data: logEntry });
        } catch (error) {
            handleError(res, error, "Failed to add communication log.");
        }
    },

    adminAddInternalNote: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            const adminUserId = req.user._id;
            const { text } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID." });
            }
            if (!text || text.trim() === "") {
                return res.status(400).json({ success: false, message: "Note text cannot be empty." });
            }
            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
            const noteEntry = { note_date: new Date(), text, added_by: adminUserId };
            repayment.internal_notes.push(noteEntry);
            await repayment.save();
            res.status(201).json({ success: true, message: "Internal note added.", data: noteEntry });
        } catch (error) {
            handleError(res, error, "Failed to add internal note.");
        }
    },
};

export default loanRepaymentController;
