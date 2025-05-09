// controllers/loanRepayment.controller.js
import LoanRepayment from '../database/models/LoanRepaymentSchema.js'; // Assuming model path
import LoanSubmission from '../database/models/LoanSubmission.js'; // For linking
import Loan from '../database/models/Loan.js'; // For loan product details
import User from '../database/models/User.js'; // For user details
import mongoose from 'mongoose';

// Helper function for error responses
const handleError = (res, error, message = "An error occurred", statusCode = 500) => {
    console.error(message, error);
    // Check if the error is a Mongoose validation error
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ success: false, message: "Validation Error", errors });
    }
    // Check for Mongoose CastError (e.g., invalid ObjectId)
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
        return res.status(400).json({ success: false, message: "Invalid ID format." });
    }
    return res.status(statusCode).json({ success: false, message, error: error.message });
};


const loanRepaymentController = {
    // ===============================================
    // APPLICANT (BORROWER) CONTROLLERS
    // ===============================================

    /**
     * Get a list of the authenticated user's loan repayments (summary)
     */
    getMyLoanRepayments: async (req, res) => {
        try {
            // const userId = req.user._id; // Assuming isAuthenticated middleware sets req.user
            const userId = new mongoose.Types.ObjectId("605c72ef2916070015e80c34"); // Placeholder for testing; replace with req.user._id

            if (!userId) {
                return res.status(401).json({ success: false, message: "User not authenticated." });
            }

            const repayments = await LoanRepayment.find({ user_id: userId })
                .select('loan_id disbursed_amount initial_calculated_emi current_outstanding_principal next_due_date loan_repayment_status createdAt')
                .populate({ path: 'loan_id', select: 'title' }) // Populate loan title
                .sort({ createdAt: -1 });

            if (!repayments.length) {
                return res.status(200).json({ success: true, message: "No loan repayments found.", data: [] });
            }

            res.status(200).json({ success: true, data: repayments });
        } catch (error) {
            handleError(res, error, "Failed to fetch user's loan repayments.");
        }
    },

    /**
     * Get detailed information for a specific loan repayment record for an applicant
     */
    getLoanRepaymentDetailsForApplicant: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            // const userId = req.user._id; // Assuming isAuthenticated middleware sets req.user
            const userId = new mongoose.Types.ObjectId("605c72ef2916070015e80c34"); // Placeholder for testing; replace with req.user._id


            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!userId) {
                return res.status(401).json({ success: false, message: "User not authenticated." });
            }

            const repayment = await LoanRepayment.findOne({ _id: repaymentId, user_id: userId })
                .populate({ path: 'loan_id', select: 'title agreed_interest_rate_pa original_tenure_months' })
                .populate({ path: 'loan_submission_id', select: 'amount stage' });
                // Do not populate payment_transactions' processed_by for applicants for privacy

            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found or access denied." });
            }

            res.status(200).json({ success: true, data: repayment });
        } catch (error) {
            handleError(res, error, "Failed to fetch loan repayment details.");
        }
    },

    /**
     * Simulate initiating a payment for an installment (or the loan)
     */
    makePaymentForLoan: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            const { amount, installmentNumber, paymentMethod, referenceId, paymentModeDetails } = req.body;
            // const userId = req.user._id; // From auth middleware
            const userId = new mongoose.Types.ObjectId("605c72ef2916070015e80c34"); // Placeholder

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!userId) {
                return res.status(401).json({ success: false, message: "User not authenticated." });
            }
            if (!amount || typeof amount !== 'number' || amount <= 0) {
                return res.status(400).json({ success: false, message: "Invalid payment amount." });
            }
            if (!paymentMethod) {
                return res.status(400).json({ success: false, message: "Payment method is required." });
            }

            const repayment = await LoanRepayment.findOne({ _id: repaymentId, user_id: userId });

            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found or access denied." });
            }

            if (['Fully Repaid', 'Foreclosed', 'Write-Off'].includes(repayment.loan_repayment_status)) {
                return res.status(400).json({ success: false, message: `Loan is already ${repayment.loan_repayment_status}. No further payments accepted.` });
            }

            // Create a new payment transaction
            const newTransaction = {
                transaction_date: new Date(),
                amount_received: amount,
                payment_method: paymentMethod,
                reference_id: referenceId,
                payment_mode_details: paymentModeDetails,
                status: 'Pending Confirmation', // Or 'Processing' if directly sent to a gateway
                created_by_type: 'User', // Applicant initiated
                // Allocation (principal_component, etc.) will be done by processPayment model method
            };

            repayment.payment_transactions.push(newTransaction);
            const savedTransaction = repayment.payment_transactions[repayment.payment_transactions.length - 1];
            
            // IMPORTANT: The actual financial processing should be handled by a robust model method or service.
            // For this example, we are only saving the transaction. A background job or a more direct call
            // to a service function would handle the complex logic of payment allocation and status updates.
            // Conceptual call: await repayment.processPayment(savedTransaction._id);

            // Simulate updating some basic fields for now, as processPayment is conceptual in the model
            repayment.last_payment_amount = amount;
            repayment.last_payment_date = new Date();
            
            await repayment.save();


            res.status(201).json({
                success: true,
                message: "Payment initiated successfully. It will be processed shortly.",
                data: { transactionId: savedTransaction._id, repaymentStatus: repayment.loan_repayment_status }
            });

        } catch (error) {
            handleError(res, error, "Failed to make payment.");
        }
    },

    /**
     * Request a quote for early loan closure
     */
    getForeclosureQuote: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            // const userId = req.user._id;
            const userId = new mongoose.Types.ObjectId("605c72ef2916070015e80c34"); // Placeholder

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
            // Check lock-in period
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
                    case 'FixedAmount':
                        foreclosureFee = feeConfig.prepayment_fee_value;
                        break;
                    case 'PercentageOfOutstandingPrincipal':
                        foreclosureFee = (outstandingPrincipal * feeConfig.prepayment_fee_value) / 100;
                        break;
                    case 'PercentageOfPrepaidAmount': 
                        foreclosureFee = (outstandingPrincipal * feeConfig.prepayment_fee_value) / 100;
                        break;
                }
            }
            foreclosureFee = Math.round(foreclosureFee * 100) / 100;

            // Accrued interest calculation is complex. For this example, using a placeholder.
            // In a real system, this would involve daily accrual logic up to the quote date.
            const accruedInterest = repayment.accrued_interest_not_due || 0; // This should be accurately calculated by a model method

            const totalForeclosureAmount = outstandingPrincipal + accruedInterest + foreclosureFee;

            res.status(200).json({
                success: true,
                data: {
                    repaymentId: repayment._id,
                    outstandingPrincipal,
                    accruedInterest, 
                    foreclosureFee,
                    totalForeclosureAmount: Math.round(totalForeclosureAmount * 100) / 100,
                    quoteValidUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // Example: 24 hours validity
                    notes: "Accrued interest is an estimate. Final amount may vary. Please contact support for precise calculation if needed."
                }
            });

        } catch (error) {
            handleError(res, error, "Failed to get foreclosure quote.");
        }
    },

    /**
     * Confirm foreclosure after getting a quote and making payment
     */
    confirmForeclosure: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            const { paymentDetails } = req.body; // e.g., { amountPaid, transactionReference, paymentDate, paymentMethod, foreclosureFeePaid }
            // const userId = req.user._id;
            const userId = new mongoose.Types.ObjectId("605c72ef2916070015e80c34"); // Placeholder

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
             if (!paymentDetails || !paymentDetails.amountPaid || !paymentDetails.paymentMethod) {
                return res.status(400).json({ success: false, message: "Payment details (amountPaid, paymentMethod) are required." });
            }

            const repayment = await LoanRepayment.findOne({ _id: repaymentId, user_id: userId });

            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
            if (['Foreclosed', 'Fully Repaid', 'Write-Off'].includes(repayment.loan_repayment_status)) {
                return res.status(400).json({ success: false, message: "Loan is already closed." });
            }

            // Conceptual: In a real system, call a robust model method like `repayment.handleForeclosure(paymentDetails)`
            // This method would verify payment, update balances, set statuses, and log the transaction.

            // Simplified simulation:
            // 1. Log the foreclosure payment as a new transaction
            const foreclosureTransaction = {
                transaction_date: paymentDetails.paymentDate || new Date(),
                amount_received: paymentDetails.amountPaid,
                payment_method: paymentDetails.paymentMethod,
                reference_id: paymentDetails.transactionReference,
                payment_mode_details: paymentDetails.paymentModeDetails,
                status: 'Cleared', // Assuming payment is confirmed for foreclosure
                created_by_type: 'User',
                notes: `Foreclosure payment. Fee: ${paymentDetails.foreclosureFeePaid || 0}`,
                // Components should be derived from quote and actuals
                principal_component: repayment.current_outstanding_principal, // Simplified
                interest_component: repayment.accrued_interest_not_due || 0, // Simplified
                penalty_component: 0 // Assuming no penalties for this example
            };
            repayment.payment_transactions.push(foreclosureTransaction);
            
            // 2. Update repayment record for foreclosure
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
            repayment.current_overdue_principal = 0;
            repayment.current_overdue_interest = 0;
            repayment.current_overdue_penalties = 0;
            repayment.total_current_overdue_amount = 0;
            repayment.days_past_due = 0;
            repayment.next_due_date = null;
            repayment.next_emi_amount = null;

            repayment.scheduled_installments.forEach(inst => {
                if (!['Paid', 'Paid Late', 'Waived'].includes(inst.status)) {
                    inst.status = 'Cancelled';
                }
            });

            await repayment.save();

            res.status(200).json({ success: true, message: "Loan successfully foreclosed.", data: repayment });

        } catch (error) {
            handleError(res, error, "Failed to confirm foreclosure.");
        }
    },


    // ===============================================
    // ADMIN CONTROLLERS
    // ===============================================

    /**
     * Get a list of all loan repayments (Admin view)
     */
    adminGetAllLoanRepayments: async (req, res) => {
        try {
            const { status, userId, page = 1, limit = 10, loanId, sortBy = 'createdAt', sortOrder = 'desc', searchTerm } = req.query;
            const query = {};

            if (status) query.loan_repayment_status = status;
            if (userId && mongoose.Types.ObjectId.isValid(userId)) query.user_id = userId;
            if (loanId && mongoose.Types.ObjectId.isValid(loanId)) query.loan_id = loanId;
            
            // Basic search term functionality (can be expanded)
            // This example searches loan title (requires populating and then matching, or a more complex aggregation)
            // For simplicity, if searchTerm is used, we might need a different approach or limit search to indexed fields on LoanRepayment.
            // For now, let's assume searchTerm is not directly used on populated fields in this basic query.

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
                success: true,
                data: repayments,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalRecords / parseInt(limit)),
                    totalRecords,
                    limit: parseInt(limit)
                }
            });
        } catch (error) {
            handleError(res, error, "Failed to fetch all loan repayments.");
        }
    },

    /**
     * Get all loan repayments for a specific user (Admin view)
     */
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

    /**
     * Get detailed information for a specific loan repayment record (Admin view)
     */
    adminGetLoanRepaymentDetails: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }

            const repayment = await LoanRepayment.findById(repaymentId)
                .populate({ path: 'user_id', select: 'name email phone' }) // More details for admin
                .populate({ path: 'loan_id', select: 'title agreed_interest_rate_pa original_tenure_months status' })
                .populate({ path: 'loan_submission_id', select: 'amount stage created_at' })
                .populate({ path: 'payment_transactions.processed_by', select: 'name' }); // Admin who processed

            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }
            res.status(200).json({ success: true, data: repayment });
        } catch (error) {
            handleError(res, error, "Failed to fetch loan repayment details for admin.");
        }
    },

    /**
     * Manually record a payment transaction (e.g., for offline payments, adjustments)
     */
    adminRecordPaymentTransaction: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            // const adminUserId = req.user._id; // Admin user making the change
            const adminUserId = new mongoose.Types.ObjectId("605c72ef2916070015e80c33"); // Placeholder Admin ID

            const {
                transaction_date, amount_received, payment_method, reference_id, notes,
                status = 'Cleared', // Default to Cleared for admin entries, can be overridden
                principal_component, interest_component, penalty_component,
                payment_mode_details, value_date
            } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!amount_received || typeof amount_received !== 'number' || amount_received <= 0) { // Allow 0 for adjustments if needed
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
                amount_received,
                payment_method,
                reference_id,
                notes,
                status,
                principal_component: principal_component || 0,
                interest_component: interest_component || 0,
                penalty_component: penalty_component || 0,
                payment_mode_details,
                value_date: value_date || transaction_date || new Date(),
                processed_by: adminUserId,
                created_by_type: 'System' // Or 'Admin' if preferred
            };
            
            // Calculate unallocated amount if components are provided
            const allocated = (newTransaction.principal_component || 0) + (newTransaction.interest_component || 0) + (newTransaction.penalty_component || 0);
            newTransaction.unallocated_amount = amount_received - allocated;
            if (newTransaction.unallocated_amount < 0) {
                 return res.status(400).json({ success: false, message: "Sum of components cannot exceed amount received." });
            }


            repayment.payment_transactions.push(newTransaction);
            const savedTransaction = repayment.payment_transactions[repayment.payment_transactions.length - 1];

            // IMPORTANT: After adding the transaction, the loan's financial state needs to be updated.
            // This should ideally be handled by a robust model method like `repayment.processPayment(savedTransaction._id)`
            // or `repayment.recalculateAggregates()`.
            // For this example, we're just saving the transaction.
            // Conceptual call: await repayment.processPayment(savedTransaction._id);
            
            // Simulate some aggregate updates if components were directly provided and status is 'Cleared'
            if (status === 'Cleared') {
                repayment.total_principal_repaid += newTransaction.principal_component || 0;
                repayment.total_interest_repaid += newTransaction.interest_component || 0;
                repayment.total_penalties_paid += newTransaction.penalty_component || 0;
                repayment.current_outstanding_principal -= newTransaction.principal_component || 0;
                repayment.last_payment_amount = amount_received;
                repayment.last_payment_date = new Date(newTransaction.transaction_date);

                // Further updates to installment statuses, DPD, overall status would be needed here.
                // Conceptual call: await repayment.updateLoanRepaymentOverallStatus();
            }


            await repayment.save();
            res.status(201).json({ success: true, message: "Payment transaction recorded successfully.", data: savedTransaction });

        } catch (error) {
            handleError(res, error, "Failed to record payment transaction.");
        }
    },

    /**
     * Update an existing payment transaction's status or details
     */
    adminUpdatePaymentTransaction: async (req, res) => {
        try {
            const { repaymentId, transactionId } = req.params;
            // const adminUserId = req.user._id;
            const adminUserId = new mongoose.Types.ObjectId("605c72ef2916070015e80c33"); // Placeholder Admin ID
            const updateData = req.body; // e.g., { status, status_reason, notes, reference_id }

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

            // Store original status if changed, to see if reprocessing is needed
            const originalStatus = transaction.status;

            // Update allowed fields
            Object.keys(updateData).forEach(key => {
                if (['status', 'status_reason', 'notes', 'reference_id', 'payment_mode_details', 'value_date'].includes(key)) {
                    transaction[key] = updateData[key];
                }
            });
            transaction.processed_by = adminUserId; // Log who made the update

            await repayment.save();

            // If transaction status changed to 'Cleared' from something else, or from 'Cleared' to 'Bounced'/'Failed',
            // the loan aggregates and installment statuses might need reprocessing.
            // Conceptual call:
            // if (originalStatus !== transaction.status && (transaction.status === 'Cleared' || originalStatus === 'Cleared')) {
            //    await repayment.reProcessTransactionsAndAggregates();
            // }
            // For now, this reprocessing logic is assumed to be handled by a more comprehensive service/model method.

            res.status(200).json({ success: true, message: "Payment transaction updated successfully.", data: transaction });

        } catch (error) {
            handleError(res, error, "Failed to update payment transaction.");
        }
    },

    /**
     * Trigger late fee calculation and application for a loan
     */
    adminApplyLateFees: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            // const adminUserId = req.user._id;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }

            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }

            // Conceptual call to model method
            // await repayment.applyLateFees(adminUserId); // Pass adminId for logging if needed in model
            // The model method would iterate installments, check grace periods, calculate fees based on penalty_configuration,
            // update installment.penalty_due, installment.is_penalty_applied, and overall aggregates.

            // For this example, simulate a success message
            console.log(`Conceptual: Late fees applied for repayment ${repaymentId}`);
            // You would save the repayment document after the model method modifies it.
            // await repayment.save(); 

            res.status(200).json({ success: true, message: "Late fee application process triggered (conceptual).", data: { repaymentId } });

        } catch (error) {
            handleError(res, error, "Failed to apply late fees.");
        }
    },

    /**
     * Record a loan restructuring event
     */
    adminRestructureLoan: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            // const adminUserId = req.user._id;
            const adminUserId = new mongoose.Types.ObjectId("605c72ef2916070015e80c33"); // Placeholder Admin ID
            const { reason, previous_terms, new_terms, effective_from_installment, notes } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!reason || !new_terms) {
                return res.status(400).json({ success: false, message: "Reason and new terms are required for restructuring." });
            }

            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }

            const restructureEntry = {
                restructure_date: new Date(),
                reason,
                previous_terms: previous_terms || { // Capture key current terms before change
                    emi: repayment.initial_calculated_emi, // Or current EMI if it changed
                    tenure: repayment.original_tenure_months, // Or remaining tenure
                    interest_rate: repayment.agreed_interest_rate_pa,
                    outstanding_principal: repayment.current_outstanding_principal
                },
                new_terms, // e.g., { new_emi, new_tenure, new_interest_rate }
                effective_from_installment,
                notes,
                approved_by: adminUserId
            };
            repayment.restructure_history.push(restructureEntry);
            repayment.is_restructured = true;
            repayment.loan_repayment_status = 'Restructured'; // Or keep 'Active' if appropriate

            // IMPORTANT: After restructuring, the amortization schedule (`scheduled_installments`)
            // from `effective_from_installment` onwards needs to be regenerated based on `new_terms`.
            // Model methods like `repayment.regenerateScheduleFromInstallment(effective_from_installment, new_terms)` would be needed.
            // Also, update `initial_calculated_emi`, `original_tenure_months` (if changed), `agreed_interest_rate_pa` on the main doc if these reflect current terms.

            // For this example, we only log the event.
            await repayment.save();
            res.status(200).json({ success: true, message: "Loan restructuring event recorded. Schedule regeneration needed.", data: repayment });

        } catch (error) {
            handleError(res, error, "Failed to record loan restructuring.");
        }
    },

    /**
     * Waive specific charges for an installment
     */
    adminWaiveInstallmentCharges: async (req, res) => {
        try {
            const { repaymentId, installmentNumber } = req.params;
            // const adminUserId = req.user._id;
            const { principal_waived = 0, interest_waived = 0, penalty_waived = 0, notes } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
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
                return res.status(404).json({ success: false, message: `Installment number ${instNum} not found.` });
            }

            // Apply waivers (ensure not to waive more than due/paid)
            installment.principal_waived = (installment.principal_waived || 0) + Number(principal_waived);
            installment.interest_waived = (installment.interest_waived || 0) + Number(interest_waived);
            installment.penalty_waived = (installment.penalty_waived || 0) + Number(penalty_waived);
            if (notes) installment.notes = `${installment.notes || ''} Waiver: ${notes}`.trim();

            // Update total waivers on the main repayment document
            repayment.total_principal_waived = (repayment.total_principal_waived || 0) + Number(principal_waived);
            repayment.total_interest_waived = (repayment.total_interest_waived || 0) + Number(interest_waived);
            repayment.total_penalties_waived = (repayment.total_penalties_waived || 0) + Number(penalty_waived);
            
            // Check if installment becomes fully 'Waived' or 'Paid' (if waivers cover remaining dues)
            const remainingPrincipal = installment.principal_due - installment.principal_paid - installment.principal_waived;
            const remainingInterest = installment.interest_due - installment.interest_paid - installment.interest_waived;
            const remainingPenalty = installment.penalty_due - installment.penalty_paid - installment.penalty_waived;

            if (remainingPrincipal <= 0 && remainingInterest <= 0 && remainingPenalty <= 0) {
                // If all components are covered by payment or waiver
                if ((installment.principal_waived + installment.interest_waived + installment.penalty_waived) >= installment.total_emi_due) {
                     installment.status = 'Waived'; // If primarily waivers covered it
                } else {
                     installment.status = 'Paid'; // If payments covered it, and waivers were minor adjustments
                }
            } else if (installment.status === 'Pending' || installment.status === 'Overdue') {
                // Potentially still 'Partially Paid' or remains 'Overdue' if dues persist
                // More sophisticated status update logic might be needed here or in a separate model method.
            }
            
            // IMPORTANT: After waivers, loan aggregates (outstanding principal, overdue amounts) and overall status
            // might need recalculation. Conceptual call: await repayment.updateLoanRepaymentOverallStatus();

            await repayment.save();
            res.status(200).json({ success: true, message: `Charges waived for installment ${instNum}.`, data: installment });

        } catch (error) {
            handleError(res, error, "Failed to waive installment charges.");
        }
    },

    /**
     * Update the overall loan repayment status (e.g., 'Defaulted', 'Write-Off')
     */
    adminUpdateLoanRepaymentOverallStatus: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            // const adminUserId = req.user._id;
            const adminUserId = new mongoose.Types.ObjectId("605c72ef2916070015e80c33"); // Placeholder Admin ID
            const { loan_repayment_status, notes, writeOffAmount } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!loan_repayment_status) {
                return res.status(400).json({ success: false, message: "New loan repayment status is required." });
            }
            // Add validation for allowed statuses if necessary

            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }

            repayment.loan_repayment_status = loan_repayment_status;

            if (loan_repayment_status === 'Write-Off') {
                repayment.is_written_off = true;
                repayment.write_off_details = {
                    date: new Date(),
                    amount: writeOffAmount || repayment.current_outstanding_principal, // Default to current outstanding
                    reason: notes || "Loan written off by admin.",
                    approved_by: adminUserId
                };
                repayment.actual_closure_date = new Date();
                repayment.current_outstanding_principal = 0; // Typically after write-off
            }
            
            if (notes) {
                 repayment.internal_notes.push({ text: `Status changed to ${loan_repayment_status}. Reason: ${notes}`, added_by: adminUserId });
            } else {
                 repayment.internal_notes.push({ text: `Status changed to ${loan_repayment_status}.`, added_by: adminUserId });
            }


            await repayment.save();
            res.status(200).json({ success: true, message: "Loan repayment status updated successfully.", data: repayment });

        } catch (error) {
            handleError(res, error, "Failed to update loan repayment status.");
        }
    },

    /**
     * Add an entry to the communication log for a loan repayment
     */
    adminAddCommunicationLog: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            // const adminUserId = req.user._id;
            const adminUserId = new mongoose.Types.ObjectId("605c72ef2916070015e80c33"); // Placeholder Admin ID
            const { type, subject, summary, recipient, status } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!type || !summary) {
                return res.status(400).json({ success: false, message: "Communication type and summary are required." });
            }

            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }

            const logEntry = {
                log_date: new Date(),
                type,
                subject,
                summary,
                recipient,
                status: status || 'Sent', // Default status
                sent_by: adminUserId
            };
            repayment.communication_log.push(logEntry);

            await repayment.save();
            res.status(201).json({ success: true, message: "Communication log entry added.", data: logEntry });

        } catch (error) {
            handleError(res, error, "Failed to add communication log.");
        }
    },

    /**
     * Add an internal note to a loan repayment record
     */
    adminAddInternalNote: async (req, res) => {
        try {
            const { repaymentId } = req.params;
            // const adminUserId = req.user._id;
            const adminUserId = new mongoose.Types.ObjectId("605c72ef2916070015e80c33"); // Placeholder Admin ID
            const { text } = req.body;

            if (!mongoose.Types.ObjectId.isValid(repaymentId)) {
                return res.status(400).json({ success: false, message: "Invalid repayment ID format." });
            }
            if (!text || text.trim() === "") {
                return res.status(400).json({ success: false, message: "Note text cannot be empty." });
            }

            const repayment = await LoanRepayment.findById(repaymentId);
            if (!repayment) {
                return res.status(404).json({ success: false, message: "Loan repayment record not found." });
            }

            const noteEntry = {
                note_date: new Date(),
                text,
                added_by: adminUserId
            };
            repayment.internal_notes.push(noteEntry);

            await repayment.save();
            res.status(201).json({ success: true, message: "Internal note added.", data: noteEntry });

        } catch (error) {
            handleError(res, error, "Failed to add internal note.");
        }
    },
    
    /**
     * @description Create a new LoanRepayment record.
     * This is typically called internally when a LoanSubmission is approved and disbursed.
     * Not usually a direct admin API endpoint for creation from scratch without a submission.
     */
    createLoanRepaymentRecord: async (loanSubmissionId, disbursedAmount, repaymentStartDate, calculatedEMI, loanProductDetails, userId) => {
        // This is more of a service function than a direct controller method for an API.
        // It would be called by your loan disbursement logic.
        try {
            const existingRepayment = await LoanRepayment.findOne({ loan_submission_id: loanSubmissionId });
            if (existingRepayment) {
                console.warn(`LoanRepayment record already exists for submission ${loanSubmissionId}`);
                return existingRepayment;
            }

            const newRepayment = new LoanRepayment({
                loan_submission_id: loanSubmissionId,
                loan_id: loanProductDetails._id, // from Loan model
                user_id: userId,
                disbursed_amount: disbursedAmount,
                agreed_interest_rate_pa: loanProductDetails.interest_rate, // Assuming this is annual
                original_tenure_months: loanProductDetails.tenure_months,
                initial_calculated_emi: calculatedEMI,
                processing_fee_paid: loanProductDetails.processing_fee || 0, // Assuming it's paid from Loan model
                repayment_start_date: repaymentStartDate,
                original_expected_closure_date: new Date(new Date(repaymentStartDate).setMonth(new Date(repaymentStartDate).getMonth() + loanProductDetails.tenure_months)),
                current_outstanding_principal: disbursedAmount,
                loan_repayment_status: 'Active',
                // Copy penalty and prepayment configurations from the loan product (Loan model)
                penalty_configuration: loanProductDetails.penalty_config || { /* defaults */ },
                prepayment_configuration: loanProductDetails.prepayment_config || { /* defaults */ },
            });
            
            // IMPORTANT: Generate the amortization schedule
            // await newRepayment.generateAmortizationSchedule(); // This method needs full implementation in the model.
            // For now, ensure basic fields are set.
            if (newRepayment.scheduled_installments.length === 0 && newRepayment.original_tenure_months > 0) {
                 // Simplified placeholder for schedule generation - replace with actual logic
                const P = newRepayment.disbursed_amount;
                const R = newRepayment.agreed_interest_rate_pa / 12 / 100; // monthly rate
                const N = newRepayment.original_tenure_months;
                const EMI = newRepayment.initial_calculated_emi; // Use the provided EMI

                let balance = P;
                for (let i = 1; i <= N; i++) {
                    const interest_for_month = balance * R;
                    let principal_for_month = EMI - interest_for_month;
                    if (i === N) { // Last installment, adjust principal to clear balance
                        principal_for_month = balance;
                    }
                    balance -= principal_for_month;
                    if (balance < 0) balance = 0; // Avoid negative balance due to rounding

                    const installment_due_date = new Date(newRepayment.repayment_start_date);
                    installment_due_date.setMonth(newRepayment.repayment_start_date.getMonth() + (i - 1));
                    
                    newRepayment.scheduled_installments.push({
                        installment_number: i,
                        due_date: installment_due_date,
                        principal_due: Math.max(0, principal_for_month),
                        interest_due: Math.max(0, interest_for_month),
                        total_emi_due: EMI, // Or principal_for_month + interest_for_month for last EMI
                        status: 'Pending'
                    });
                }
                 if (newRepayment.scheduled_installments.length > 0) {
                    newRepayment.next_due_date = newRepayment.scheduled_installments[0].due_date;
                    newRepayment.next_emi_amount = newRepayment.scheduled_installments[0].total_emi_due;
                }
            }


            await newRepayment.save();
            console.log(`LoanRepayment record created for submission ${loanSubmissionId}`);
            return newRepayment;
        } catch (error) {
            console.error("Error creating LoanRepayment record:", error);
            throw error; // Re-throw to be handled by caller
        }
    }

};

export default loanRepaymentController;
