// routes/loanRepayment.routes.js
import express from 'express';
import loanRepaymentController from '../controllers/loanRepayment.controller.js';
// Import your role-based authentication middleware
import { requireRole } from '../middlewares/auth.js'; // Adjust path if necessary
import addTimestamps from '../middlewares/timestamp.js'; // Assuming you might want timestamps for some actions

const router = express.Router(); // For applicant-facing routes
const adminRouter = express.Router(); // For admin-facing routes

// ===============================================
// APPLICANT (BORROWER) ROUTES
// Base Path: /api/repayments (mounted in app.js for this router)
// All these routes require at least a 'user' role (or 'applicant' if you have one)
// The controller logic will further ensure they only access their own data.
// ===============================================

/**
 * @route   GET /api/repayments/my-loans
 * @desc    Get a list of the authenticated user's loan repayments (summary view).
 * @access  Private (User/Applicant)
 */
router.get(
    '/my-loans',
    requireRole(['user', 'applicant']), // Assuming 'user' or 'applicant' role
    loanRepaymentController.getMyLoanRepayments
);

/**
 * @route   GET /api/repayments/:repaymentId
 * @desc    Get detailed information for a specific loan repayment record.
 * @access  Private (User/Applicant - controller ensures ownership)
 */
router.get(
    '/:repaymentId',
    requireRole(['user', 'applicant']),
    loanRepaymentController.getLoanRepaymentDetailsForApplicant
);

router.get(
    '/admin/:repaymentId',
    requireRole(['manager', 'staff', 'admin']),
    loanRepaymentController.adminGetLoanRepaymentDetails
);

/**
 * @route   POST /api/repayments/:repaymentId/communication
 * @desc    POST communication logs for a specific loan repayment record.
 * @access  Private (Admin/Manager - controller ensures ownership)
 */
router.post(
    '/:repaymentId/communication',
    requireRole(['manager', 'staff']),
    loanRepaymentController.adminAddCommunicationLog
);

/**
 * @route   POST /api/repayments/:repaymentId
 * @access  Private (User/Applicant - controller ensures ownership)
 * @desc    Update a specific loan repayment record (e.g., for payment updates).
 */
router.post(
    '/:repaymentId/communication-log',
    requireRole(['user', 'applicant']),
    addTimestamps, // Good for logging when the update was made
    loanRepaymentController.applicantAddCommunicationLog
);

/**
 * @route   GET /api/repayments/:repaymentId with multiple query parameters
 * @desc    Get detailed information for a specific loan repayment record with optional filters.
 * @access  Private (Admin/Manager - controller ensures ownership)
 */
router.get(
    '/',
    requireRole(['manager', 'staff']),
    loanRepaymentController.adminSearchRepayments
);

/**
 * @route   POST /api/repayments/:repaymentId/make-payment
 * @desc    Allows an applicant to initiate a payment towards their loan.
 * @access  Private (User/Applicant - controller ensures ownership)
 */
router.post(
    '/:repaymentId/make-payment',
    requireRole(['user', 'applicant']),
    addTimestamps, // Good for logging when payment was initiated
    loanRepaymentController.makePaymentForLoan
);

/**
 * @route   GET /api/repayments/:repaymentId/foreclosure-quote
 * @desc    Allows an applicant to request a quote for early loan closure (foreclosure).
 * @access  Private (User/Applicant - controller ensures ownership)
 */
router.get(
    '/:repaymentId/foreclosure-quote',
    requireRole(['user', 'applicant']),
    loanRepaymentController.getForeclosureQuote
);

/**
 * @route   POST /api/repayments/:repaymentId/confirm-foreclosure
 * @desc    Allows an applicant to confirm their intention to foreclose the loan.
 * @access  Private (User/Applicant - controller ensures ownership)
 */
router.post(
    '/:repaymentId/confirm-foreclosure',
    requireRole(['user', 'applicant']),
    addTimestamps, // Good for logging when foreclosure was confirmed
    loanRepaymentController.confirmForeclosure
);


// ===============================================
// ADMIN ROUTES
// Base Path: /api/admin/repayments (mounted in app.js for this adminRouter)
// These routes require 'manager' or 'staff' roles
// ===============================================

/**
 * @route   GET /api/admin/repayments
 * @desc    Admin: Get a list of all loan repayments with filtering and pagination.
 * @access  Private (Manager/Staff)
 */
adminRouter.get(
    '/',
    requireRole(['manager', 'staff']),
    loanRepaymentController.adminGetAllLoanRepayments
);

/**
 * @route   GET /api/admin/repayments/user/:userId
 * @desc    Admin: Get all loan repayments for a specific user.
 * @access  Private (Manager/Staff)
 */
adminRouter.get(
    '/user/:userId',
    requireRole(['manager', 'staff']),
    loanRepaymentController.adminGetRepaymentsByUserId
);

/**
 * @route   GET /api/admin/repayments/:repaymentId
 * @desc    Admin: Get detailed information for a specific loan repayment record.
 * @access  Private (Manager/Staff)
 */
adminRouter.get(
    '/:repaymentId',
    requireRole(['manager', 'staff']),
    loanRepaymentController.adminGetLoanRepaymentDetails
);

/**
 * @route   POST /api/admin/repayments/:repaymentId/transactions
 * @desc    Admin: Manually record a payment transaction.
 * @access  Private (Manager/Staff)
 */
adminRouter.post(
    '/:repaymentId/transactions',
    requireRole(['manager', 'staff']),
    addTimestamps, // For transaction recording time
    loanRepaymentController.adminRecordPaymentTransaction
);

/**
 * @route   PUT /api/admin/repayments/:repaymentId/transactions/:transactionId
 * @desc    Admin: Update an existing payment transaction's status or details.
 * @access  Private (Manager/Staff)
 */
adminRouter.put(
    '/:repaymentId/transactions/:transactionId',
    requireRole(['manager', 'staff']),
    addTimestamps, // For update time of transaction
    loanRepaymentController.adminUpdatePaymentTransaction
);

/**
 * @route   POST /api/admin/repayments/:repaymentId/apply-late-fees
 * @desc    Admin: Trigger late fee calculation and application for overdue installments on a loan.
 * @access  Private (Manager/Staff)
 */
adminRouter.post(
    '/:repaymentId/apply-late-fees',
    requireRole(['manager', 'staff']),
    addTimestamps, // For logging when this action was taken
    loanRepaymentController.adminApplyLateFees
);

/**
 * @route   POST /api/admin/repayments/:repaymentId/restructure
 * @desc    Admin: Record a loan restructuring event.
 * @access  Private (Manager/Staff)
 */
adminRouter.post(
    '/:repaymentId/restructure',
    requireRole(['manager', 'staff']),
    addTimestamps, // For restructure event time
    loanRepaymentController.adminRestructureLoan
);

/**
 * @route   POST /api/admin/repayments/:repaymentId/installments/:installmentNumber/waive
 * @desc    Admin: Waive specific charges (principal, interest, penalty) for a particular installment.
 * @access  Private (Manager/Staff)
 */
adminRouter.post(
    '/:repaymentId/installments/:installmentNumber/waive',
    requireRole(['manager', 'staff']),
    addTimestamps, // For waiver action time
    loanRepaymentController.adminWaiveInstallmentCharges
);

/**
 * @route   PUT /api/admin/repayments/:repaymentId/status
 * @desc    Admin: Manually update the overall loan repayment status.
 * @access  Private (Manager/Staff)
 */
adminRouter.put(
    '/:repaymentId/status',
    requireRole(['manager', 'staff']),
    addTimestamps, // For status change time
    loanRepaymentController.adminUpdateLoanRepaymentOverallStatus
);

/**
 * @route   POST /api/admin/repayments/:repaymentId/communication-log
 * @desc    Admin: Add an entry to the communication log for a loan repayment.
 * @access  Private (Manager/Staff)
 */
adminRouter.post(
    '/:repaymentId/communication-log',
    requireRole(['manager', 'staff']),
    addTimestamps, // For log entry time
    loanRepaymentController.adminAddCommunicationLog
);

/**
 * @route   POST /api/admin/repayments/:repaymentId/internal-note
 * @desc    Admin: Add an internal note to a loan repayment record for administrative tracking.
 * @access  Private (Manager/Staff)
 */
adminRouter.post(
    '/:repaymentId/internal-note',
    requireRole(['manager', 'staff']),
    addTimestamps, // For note creation time
    loanRepaymentController.adminAddInternalNote
);

export { router as applicantRepaymentRoutes, adminRouter as adminRepaymentRoutes };
