// src/models/LoanRepayment.js
import mongoose from 'mongoose';

// --- Subdocument Schemas ---

/**
 * @description Schema for each scheduled installment in the amortization plan.
 */
const ScheduledInstallmentSchema = new mongoose.Schema({
  installment_number: { type: Number, required: true, comment: "Sequential number of the installment." },
  due_date:           { type: Date, required: true, comment: "Date when this installment is due." },
  
  // Amounts Due for this installment
  principal_due:      { type: Number, required: true, min: 0, comment: "Principal amount due for this installment." },
  interest_due:       { type: Number, required: true, min: 0, comment: "Interest amount due for this installment." },
  total_emi_due:      { type: Number, required: true, min: 0, comment: "Total EMI amount due (principal_due + interest_due)." },
  penalty_due:        { type: Number, default: 0, min: 0, comment: "Penalty amount accrued and due for this installment (e.g., late fees)." },

  // Amounts Paid for this installment
  principal_paid:     { type: Number, default: 0, min: 0, comment: "Principal amount actually paid for this installment." },
  interest_paid:      { type: Number, default: 0, min: 0, comment: "Interest amount actually paid for this installment." },
  penalty_paid:       { type: Number, default: 0, min: 0, comment: "Penalty amount actually paid for this installment." },
  
  // Waivers for this installment
  principal_waived:   { type: Number, default: 0, min: 0, comment: "Principal amount waived for this installment." },
  interest_waived:    { type: Number, default: 0, min: 0, comment: "Interest amount waived for this installment." },
  penalty_waived:     { type: Number, default: 0, min: 0, comment: "Penalty amount waived for this installment." },

  status: {
    type: String,
    enum: [
        'Pending',        // Not yet due or due but unpaid within grace
        'Paid',           // Fully paid on time or within grace
        'Partially Paid', // Partially paid
        'Overdue',        // Past due date + grace period, still unpaid/partially paid
        'Paid Late',      // Fully paid but after the due date + grace period
        'Waived',         // Entire installment waived (could be due to a larger waiver event)
        'Skipped',        // Payment skipped (e.g., due to moratorium)
        'Cancelled'       // If an installment is cancelled due to loan restructuring/foreclosure
    ],
    default: 'Pending',
    required: true,
    comment: "Current status of this installment."
  },
  
  is_penalty_applied: { type: Boolean, default: false, comment: "Flag indicating if a late payment penalty has been calculated/applied to this installment." },
  last_payment_date_for_installment: { type: Date, comment: "Date of the last payment (full or partial) made towards this specific installment." },
  notes: { type: String, comment: "Any specific notes related to this installment." }
}, { _id: false, versionKey: false });


/**
 * @description Schema for each actual payment transaction received from the borrower.
 */
const PaymentTransactionSchema = new mongoose.Schema({
  transaction_date:   { type: Date, default: Date.now, required: true, comment: "Date and time the payment was recorded/received." },
  amount_received:    { type: Number, required: true, min: 0, comment: "Total amount received in this transaction." },

  // Allocation of the received amount by the processing logic
  principal_component: { type: Number, required: true, default: 0, min: 0, comment: "Portion of amount_received allocated to principal." },
  interest_component:  { type: Number, required: true, default: 0, min: 0, comment: "Portion of amount_received allocated to interest." },
  penalty_component:   { type: Number, default: 0, min: 0, comment: "Portion of amount_received allocated to penalties." },
  unallocated_amount:  { type: Number, default: 0, min: 0, comment: "Portion of amount_received not yet allocated (e.g., excess payment)." },

  payment_method: {
    type: String,
    enum: ['Bank Transfer', 'UPI', 'Card', 'Cash', 'Cheque', 'Auto-Debit', 'Internal Adjustment', 'Waiver Adjustment', 'Other'], // Added Waiver Adjustment
    required: true,
    comment: "Method used for the payment."
  },
  payment_mode_details: { 
    type: mongoose.Schema.Types.Mixed,
    comment: "Details specific to the payment method (e.g., card_last_four, cheque_number, upi_ref_id, waiver_submission_id for Waiver Adjustment)."
  },
  reference_id:     { type: String, index: true, comment: "External reference ID for the transaction (e.g., bank transaction ID, payment gateway ID)." },
  status: {
    type: String,
    enum: ['Pending Confirmation', 'Processing', 'Cleared', 'Failed', 'Bounced', 'Refunded', 'Cancelled'],
    default: 'Pending Confirmation',
    required: true,
    comment: "Status of the payment transaction itself."
  },
  status_reason:    { type: String, comment: "Reason for the current transaction status (e.g., bounce reason)." },
  value_date:       { type: Date, comment: "Date the funds are considered received/cleared, might differ from transaction_date." },
  
  notes:            { type: String, comment: "Notes related to this specific payment transaction." },
  processed_by:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', comment: "User ID of the admin/system that recorded/processed this payment." },
  created_by_type:  { type: String, enum: ['User', 'System'], default: 'User', comment: "Indicates if the transaction was created manually or by an automated system." }
}, { timestamps: true, versionKey: false });


/**
 * @description Schema for recording loan restructuring events.
 */
const RestructureHistorySchema = new mongoose.Schema({
    restructure_date:   { type: Date, default: Date.now, required: true },
    reason:             { type: String, required: true },
    previous_terms:     { type: mongoose.Schema.Types.Mixed, comment: "Snapshot of key terms before restructuring." }, 
    new_terms:          { type: mongoose.Schema.Types.Mixed, required: true, comment: "Snapshot of key terms after restructuring." },
    effective_from_installment: { type: Number, comment: "Installment number from which new terms apply." },
    notes:              { type: String },
    approved_by:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: false, timestamps: true, versionKey: false });

/**
 * @description Schema for logging communication with the borrower regarding repayments.
 */
const CommunicationLogSchema = new mongoose.Schema({
    log_date:   { type: Date, default: Date.now, required: true },
    type:       { type: String, enum: ['SMS', 'Email', 'Call', 'Letter', 'System Alert'], required: true },
    subject:    { type: String }, 
    summary:    { type: String, required: true },
    recipient:  { type: String, comment: "e.g., masked phone number or email address" },
    sent_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, 
    status:     { type: String, enum: ['Sent', 'Delivered', 'Failed', 'Read'] }
}, { _id: false, timestamps: true, versionKey: false });

/**
 * @description NEW: Schema to store information about an applied waiver.
 */
const AppliedWaiverInfoSchema = new mongoose.Schema({
  waiver_submission_id: { // The specific waiver application that was approved
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WaiverSubmission', // Ensure you have a 'WaiverSubmission' model
    required: true,
    comment: "Reference to the approved waiver submission that resulted in this waiver."
  },
  waiver_scheme_id: { // The scheme under which the waiver was granted (snapshot or direct ref)
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WaiverScheme', // Ensure you have a 'WaiverScheme' model
    required: true,
    comment: "Reference to the waiver scheme definition."
  },
  date_applied: { // Date this waiver's effects were recorded/processed on the loan repayment
    type: Date,
    default: Date.now,
    required: true,
    comment: "Date the waiver was officially applied to this loan repayment record."
  },
  waiver_details_summary: { // A brief summary of what was waived
    type: String,
    comment: "e.g., '10% interest waiver on overdue interest as of YYYY-MM-DD due to COVID-19 relief scheme.'"
  },
  waived_components: [{ // Could detail which components were affected by this waiver event, if not granularly in installments
    component_type: { type: String, enum: ['principal', 'interest', 'penalty'], required: true },
    amount_waived_by_this_event: { type: Number, required: true, min: 0 } // Amount waived specifically by this waiver event
  }],
  notes: { type: String, comment: "Specific notes related to the application of this waiver." }
}, { _id: false, versionKey: false });


// --- Main Loan Repayment Schema ---
const LoanRepaymentSchema = new mongoose.Schema({
  loan_submission_id: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LoanSubmission',
    required: true,
    unique: true, 
    index: true,
    comment: "Link to the specific loan application that was approved and disbursed."
  },
  loan_id: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan', // Reference to the Loan model from artifact LoanModel_with_WaiverFK_JS
    required: true,
    comment: "Reference to the original Loan product definition."
  },
  user_id: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
    comment: "The borrower ID."
  },

  // --- Core Loan Terms (at time of disbursement/agreement) ---
  disbursed_amount:    { type: Number, required: true, min: 0, comment: "Principal amount actually disbursed to the borrower." },
  agreed_interest_rate_pa: { type: Number, required: true, min: 0, comment: "Annual interest rate agreed upon at disbursement." },
  original_tenure_months: { type: Number, required: true, min: 1, comment: "Original loan tenure in months." },
  initial_calculated_emi: { type: Number, required: true, min: 0, comment: "The EMI amount calculated at the start of the loan." },
  processing_fee_paid: { type: Number, default: 0, comment: "Processing fee amount collected from the borrower." },
  repayment_type: { 
    type: String, 
    enum: ['EMI', 'Bullet', 'Interest-Only then Bullet', 'Custom'], 
    default: 'EMI', 
    comment: "Type of repayment structure."
  },

  // --- Repayment Schedule & Dates ---
  repayment_start_date: { type: Date, required: true, comment: "Date of the first EMI payment." },
  original_expected_closure_date: { type: Date, required: true, comment: "Original expected loan closure date based on tenure." },
  actual_closure_date: { type: Date, comment: "Actual date the loan was fully repaid or closed." },

  scheduled_installments: { type: [ScheduledInstallmentSchema], default: [], comment: "The amortization schedule for the loan." },
  payment_transactions:   { type: [PaymentTransactionSchema], default: [], comment: "Log of all payment transactions received." },

  // --- Aggregated Repayment Status (Calculated Fields, updated by methods) ---
  total_principal_repaid: { type: Number, default: 0, min: 0 },
  total_interest_repaid:  { type: Number, default: 0, min: 0 },
  total_penalties_levied: { type: Number, default: 0, min: 0, comment: "Total penalties charged to the borrower." },
  total_penalties_paid:   { type: Number, default: 0, min: 0, comment: "Total penalties actually paid by the borrower." },
  total_penalties_waived: { type: Number, default: 0, min: 0 },
  total_principal_waived: { type: Number, default: 0, min: 0 },
  total_interest_waived:  { type: Number, default: 0, min: 0 },
  
  current_outstanding_principal: { type: Number, required: true, default: 0, min: 0, comment: "Current outstanding principal balance." },
  accrued_interest_not_due: { type: Number, default: 0, min: 0, comment: "Interest accrued since last EMI but not yet part of a due installment." },
  
  next_due_date:    { type: Date, comment: "Due date of the next upcoming installment." },
  next_emi_amount:  { type: Number, comment: "Amount of the next EMI due (can change if restructured)." },
  
  current_overdue_principal: { type: Number, default: 0, comment: "Total principal amount currently past due." },
  current_overdue_interest:  { type: Number, default: 0, comment: "Total interest amount currently past due." },
  current_overdue_penalties: { type: Number, default: 0, comment: "Total penalty amount currently past due." },
  total_current_overdue_amount: { type: Number, default: 0, comment: "Sum of all current overdue components." },
  
  days_past_due:     { type: Number, default: 0, comment: "Number of days the oldest unpaid installment is overdue." },
  consecutive_missed_payments: { type: Number, default: 0, comment: "Count of consecutive EMIs missed." },
  
  last_payment_amount: { type: Number },
  last_payment_date:   { type: Date, comment: "Date of the latest payment received for this loan." },

  loan_repayment_status: {
    type: String,
    enum: [
        'Active',               // Loan is ongoing, payments are current or within grace.
        'Active - Grace Period',// Within grace period for a due payment.
        'Active - Overdue',     // Loan has one or more overdue payments.
        'Fully Repaid',         // All dues cleared, loan closed successfully.
        'Foreclosed',           // Loan closed early by full prepayment.
        'Restructured',         // Loan terms have been modified.
        'Defaulted',            // Borrower has significantly failed to meet obligations.
        'Write-Off',            // Unrecoverable debt, written off by the lender.
        'Legal Action Pending'  // Legal proceedings initiated.
    ],
    default: 'Active',
    required: true,
    index: true,
    comment: "Overall status of the loan repayment."
  },

  // --- Penalty Configuration ---
  penalty_configuration: {
    applies_to_missed_full_emi: { type: Boolean, default: true },
    late_payment_fee_type: { type: String, enum: ['None', 'FixedAmount', 'PercentageOfOverdueEMI', 'PercentageOfOverduePrincipal'] },
    late_payment_fee_value: { type: Number, min: 0 },
    late_payment_grace_period_days: { type: Number, default: 0, min: 0 },
  },

  // --- Prepayment/Foreclosure Configuration & Details ---
  prepayment_configuration: {
    allow_prepayment: { type: Boolean, default: true },
    allow_part_prepayment: { type: Boolean, default: true },
    prepayment_fee_type: { type: String, enum: ['None', 'FixedAmount', 'PercentageOfOutstandingPrincipal', 'PercentageOfPrepaidAmount'] },
    prepayment_fee_value: { type: Number, min: 0 },
    min_prepayment_amount: { type: Number, min: 0 },
    max_prepayment_amount_per_instance: { type: Number, min: 0 },
    lock_in_period_months: { type: Number, default: 0, comment: "No prepayments allowed during this period from disbursement." }
  },
  foreclosure_details: {
    is_foreclosed: { type: Boolean, default: false },
    foreclosure_date: { type: Date },
    foreclosure_amount_paid: { type: Number },
    foreclosure_fee_paid: { type: Number },
    foreclosure_notes: { type: String }
  },

  // --- Restructuring & Write-Off ---
  is_restructured: { type: Boolean, default: false },
  restructure_history: { type: [RestructureHistorySchema], default: [] },

  is_written_off: { type: Boolean, default: false },
  write_off_details: {
    date: { type: Date },
    amount: { type: Number }, 
    reason: { type: String },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // --- NEW: Information about any waiver applied to this loan repayment ---
  applied_waiver_info: {
    type: AppliedWaiverInfoSchema, // Using the new subdocument schema
    default: null, // Null if no waiver has been applied
    required: false,
    comment: "Details of the waiver scheme application that was approved and applied to this loan."
  },

  // --- Communication & Notes ---
  communication_log: { type: [CommunicationLogSchema], default: [] },
  internal_notes: [{
    note_date: { type: Date, default: Date.now },
    text: { type: String, required: true },
    added_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

}, {
  timestamps: true, 
  versionKey: false 
});

// --- Indexes ---
LoanRepaymentSchema.index({ user_id: 1, loan_repayment_status: 1 });
LoanRepaymentSchema.index({ next_due_date: 1, loan_repayment_status: 1 });
LoanRepaymentSchema.index({ days_past_due: 1, loan_repayment_status: 1 });
LoanRepaymentSchema.index({ 'applied_waiver_info.waiver_submission_id': 1 }, { sparse: true }); // Index if querying by applied waiver


// --- METHODS (Placeholders - Full implementation is complex) ---
LoanRepaymentSchema.methods.generateAmortizationSchedule = async function() {
  console.warn("LoanRepaymentSchema.methods.generateAmortizationSchedule: Needs full implementation.");
};
LoanRepaymentSchema.methods.processPayment = async function(paymentTransactionId) {
  console.warn("LoanRepaymentSchema.methods.processPayment: Needs full implementation for transaction ID:", paymentTransactionId);
};
LoanRepaymentSchema.methods.applyLateFees = async function() {
  console.warn("LoanRepaymentSchema.methods.applyLateFees: Needs full implementation.");
};
LoanRepaymentSchema.methods.handlePrepayment = async function(prepaymentAmount, prepaymentDate, isForeclosure = false) {
  console.warn("LoanRepaymentSchema.methods.handlePrepayment: Needs full implementation for amount:", prepaymentAmount, "on", prepaymentDate);
};
LoanRepaymentSchema.methods.updateLoanRepaymentOverallStatus = async function() {
  console.warn("LoanRepaymentSchema.methods.updateLoanRepaymentOverallStatus: Needs full implementation.");
};

// --- MIDDLEWARE ---
LoanRepaymentSchema.pre('save', async function(next) {
  if (this.current_outstanding_principal < 0) {
    this.current_outstanding_principal = 0;
  }
  if (this.isNew && this.scheduled_installments.length === 0 && this.disbursed_amount > 0) {
    this.current_outstanding_principal = this.disbursed_amount;
  }
  this.total_current_overdue_amount = (this.current_overdue_principal || 0) + 
                                      (this.current_overdue_interest || 0) + 
                                      (this.current_overdue_penalties || 0);
  if ((this.loan_repayment_status === 'Fully Repaid' || this.loan_repayment_status === 'Foreclosed') && !this.actual_closure_date) {
    this.actual_closure_date = new Date();
  }
  next();
});

export default mongoose.model('LoanRepayment', LoanRepaymentSchema);
