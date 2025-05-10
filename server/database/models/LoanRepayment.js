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
        'Waived',         // Entire installment waived
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
    enum: ['Bank Transfer', 'UPI', 'Card', 'Cash', 'Cheque', 'Auto-Debit', 'Internal Adjustment', 'Other'],
    required: true,
    comment: "Method used for the payment."
  },
  payment_mode_details: { // Store specific details based on payment_method
    type: mongoose.Schema.Types.Mixed,
    comment: "Details specific to the payment method (e.g., card_last_four, cheque_number, upi_ref_id)."
    // Example: { "cheque_number": "12345", "bank_name": "ABC Bank", "branch": "XYZ" }
    // Example: { "card_last_four": "1234", "card_type": "Visa" }
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
}, { timestamps: true, versionKey: false }); // _id: true is default, timestamps for transaction creation/update


/**
 * @description Schema for recording loan restructuring events.
 */
const RestructureHistorySchema = new mongoose.Schema({
    restructure_date:   { type: Date, default: Date.now, required: true },
    reason:             { type: String, required: true },
    previous_terms:     { type: mongoose.Schema.Types.Mixed, comment: "Snapshot of key terms before restructuring." }, // e.g., { emi, tenure, interest_rate }
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
    subject:    { type: String }, // e.g., "Payment Reminder", "Overdue Notice"
    summary:    { type: String, required: true },
    recipient:  { type: String, comment: "e.g., masked phone number or email address" },
    sent_by:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User or system if automated
    status:     { type: String, enum: ['Sent', 'Delivered', 'Failed', 'Read'] }
}, { _id: false, timestamps: true, versionKey: false });


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
    ref: 'Loan',
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
  repayment_type: { // Though current Loan schema implies EMI
    type: String, 
    enum: ['EMI', 'Bullet', 'Interest-Only then Bullet', 'Custom'], 
    default: 'EMI', 
    comment: "Type of repayment structure."
  },
  // interest_calculation_method: { type: String, enum: ['Reducing Balance', 'Flat Rate'], default: 'Reducing Balance' },
  // compounding_frequency: { type: String, enum: ['Daily', 'Monthly', 'Quarterly', 'Annually'], default: 'Monthly' },


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

  // --- Penalty Configuration (Snapshot from Loan product or custom for this loan) ---
  penalty_configuration: {
    applies_to_missed_full_emi: { type: Boolean, default: true },
    late_payment_fee_type: { type: String, enum: ['None', 'FixedAmount', 'PercentageOfOverdueEMI', 'PercentageOfOverduePrincipal'] },
    late_payment_fee_value: { type: Number, min: 0 },
    late_payment_grace_period_days: { type: Number, default: 0, min: 0 },
    // penalty_interest_rate_pa: { type: Number, min: 0, comment: "Penal interest rate on overdue amount, if applicable." },
    // penalty_compounding: { type: Boolean, default: false }
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
    amount: { type: Number }, // Amount written off
    reason: { type: String },
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // --- Communication & Notes ---
  communication_log: { type: [CommunicationLogSchema], default: [] },
  internal_notes: [{
    note_date: { type: Date, default: Date.now },
    text: { type: String, required: true },
    added_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

}, {
  timestamps: true, // For created_at, updated_at of the LoanRepayment record itself
  versionKey: false // Disable __v field
});

// --- Indexes ---
LoanRepaymentSchema.index({ user_id: 1, loan_repayment_status: 1 });
LoanRepaymentSchema.index({ next_due_date: 1, loan_repayment_status: 1 });
LoanRepaymentSchema.index({ days_past_due: 1, loan_repayment_status: 1 });


// --- METHODS (Conceptual - Full implementation is complex and application-specific) ---

/**
 * @description Generates the initial amortization schedule for the loan.
 * This should be called once upon creation of the LoanRepayment record.
 * Requires sophisticated financial logic for EMI calculation and principal/interest breakdown.
 * Factors to consider: principal, annual interest rate, tenure, repayment start date,
 * possibly different for first/last EMI, rounding rules.
 */
LoanRepaymentSchema.methods.generateAmortizationSchedule = async function() {
  // Placeholder for actual amortization logic.
  // 1. Get P (this.disbursed_amount), R (this.agreed_interest_rate_pa / 12 / 100), N (this.original_tenure_months).
  // 2. Calculate EMI (this.initial_calculated_emi should ideally be calculated here or passed in if pre-calculated).
  //    Formula: EMI = P * R * (1+R)^N / ((1+R)^N - 1)
  // 3. Loop N times to create each installment:
  //    - Calculate interest_component = current_outstanding_principal * R
  //    - Calculate principal_component = EMI - interest_component
  //    - Update current_outstanding_principal -= principal_component
  //    - Determine due_date for each installment based on this.repayment_start_date.
  //    - Push to this.scheduled_installments.
  // 4. Set initial outstanding_principal, next_due_date, next_emi_amount.
  
  // Example:
  // this.current_outstanding_principal = this.disbursed_amount;
  // if (this.scheduled_installments.length > 0) {
  //   this.next_due_date = this.scheduled_installments[0].due_date;
  //   this.next_emi_amount = this.scheduled_installments[0].total_emi_due;
  // }
  // await this.save(); // If called outside a pre-save hook
  console.warn("LoanRepaymentSchema.methods.generateAmortizationSchedule: Needs full implementation.");
};

/**
 * @description Processes a new payment transaction.
 * Allocates payment amounts to installments (penalties, interest, principal in order).
 * Updates installment statuses and overall loan aggregates and status.
 */
LoanRepaymentSchema.methods.processPayment = async function(paymentTransactionId) {
  // Placeholder for payment processing logic.
  // 1. Find the paymentTransaction from this.payment_transactions by ID.
  // 2. If transaction status is not 'Cleared' or 'Pending Confirmation' (depending on flow), handle appropriately.
  // 3. Iterate through this.scheduled_installments (oldest overdue/pending first).
  // 4. Allocate payment components (penalty_component, interest_component, principal_component) from transaction
  //    to installment's penalty_due, interest_due, principal_due.
  // 5. Update installment's paid amounts and status ('Paid', 'Partially Paid', 'Paid Late').
  // 6. Update overall aggregates: total_principal_repaid, total_interest_repaid, total_penalties_paid,
  //    current_outstanding_principal.
  // 7. Update last_payment_date, last_payment_amount.
  // 8. Call updateLoanRepaymentOverallStatus() to refresh overall loan status, DPD, overdue amounts.
  // await this.save();
  console.warn("LoanRepaymentSchema.methods.processPayment: Needs full implementation for transaction ID:", paymentTransactionId);
};

/**
 * @description Applies late fees to overdue installments based on penalty_configuration.
 * This might be called by a daily batch job or when a payment is processed.
 */
LoanRepaymentSchema.methods.applyLateFees = async function() {
  // Placeholder for late fee application logic.
  // 1. Iterate through overdue this.scheduled_installments.
  // 2. Check grace period (this.penalty_configuration.late_payment_grace_period_days).
  // 3. If overdue beyond grace and penalty not yet applied:
  //    - Calculate penalty amount based on this.penalty_configuration.
  //    - Add to installment.penalty_due.
  //    - Update installment.is_penalty_applied = true.
  //    - Update total_penalties_levied and current_overdue_penalties.
  // await this.save();
  console.warn("LoanRepaymentSchema.methods.applyLateFees: Needs full implementation.");
};

/**
 * @description Handles a prepayment (part or full/foreclosure).
 * Recalculates schedule or closes loan based on prepayment type.
 */
LoanRepaymentSchema.methods.handlePrepayment = async function(prepaymentAmount, prepaymentDate, isForeclosure = false) {
  // Placeholder for prepayment logic.
  // 1. Check if prepayment is allowed (this.prepayment_configuration.allow_prepayment, lock_in_period_months).
  // 2. Calculate prepayment fee if any.
  // 3. Reduce current_outstanding_principal.
  // 4. If isForeclosure:
  //    - Mark loan as 'Foreclosed', set actual_closure_date.
  //    - Update foreclosure_details.
  //    - Cancel/update remaining scheduled_installments.
  // 5. If part prepayment:
  //    - Option 1: Reduce EMI, tenure remains same.
  //    - Option 2: Reduce tenure, EMI remains same. (This requires regenerating/adjusting future installments).
  //    - Update aggregates.
  // await this.save();
  console.warn("LoanRepaymentSchema.methods.handlePrepayment: Needs full implementation for amount:", prepaymentAmount, "on", prepaymentDate);
};

/**
 * @description Recalculates and updates overall loan status fields like DPD, overdue amounts, next due date, and loan_repayment_status.
 * Should be called after any event affecting loan balance or installment status (payment, fee application, etc.).
 */
LoanRepaymentSchema.methods.updateLoanRepaymentOverallStatus = async function() {
  // Placeholder for status update logic.
  // 1. Calculate total_current_overdue_amount, current_overdue_principal, current_overdue_interest, current_overdue_penalties
  //    by summing up unpaid portions of overdue installments.
  // 2. Determine days_past_due (DPD) based on the oldest overdue installment's due_date.
  // 3. Count consecutive_missed_payments.
  // 4. Find next_due_date and next_emi_amount from pending installments.
  // 5. Update this.loan_repayment_status based on conditions:
  //    - If current_outstanding_principal <= 0 (considering small tolerance), status = 'Fully Repaid'.
  //    - If DPD > threshold, status = 'Defaulted' (based on business rules).
  //    - If DPD > 0, status = 'Active - Overdue'.
  //    - Else, status = 'Active'.
  //    - (Handle 'Foreclosed', 'Write-Off', 'Restructured' separately where those events occur).
  // await this.save();
  console.warn("LoanRepaymentSchema.methods.updateLoanRepaymentOverallStatus: Needs full implementation.");
};


// --- MIDDLEWARE ---
LoanRepaymentSchema.pre('save', async function(next) {
  // Ensure current_outstanding_principal is never negative.
  if (this.current_outstanding_principal < 0) {
    this.current_outstanding_principal = 0;
  }

  // If it's a new LoanRepayment record and schedule is empty, attempt to generate it.
  // This assumes disbursed_amount, rate, tenure etc., are set before first save.
  if (this.isNew && this.scheduled_installments.length === 0 && this.disbursed_amount > 0) {
    // await this.generateAmortizationSchedule(); // Better to call this explicitly after creation in service layer
                                               // to handle potential errors and ensure all data is present.
    // For now, just initialize outstanding principal
    this.current_outstanding_principal = this.disbursed_amount;
  }
  
  // Update total_current_overdue_amount
  this.total_current_overdue_amount = (this.current_overdue_principal || 0) + 
                                      (this.current_overdue_interest || 0) + 
                                      (this.current_overdue_penalties || 0);

  // Set actual_closure_date if loan is fully repaid or foreclosed and date is not set
  if ((this.loan_repayment_status === 'Fully Repaid' || this.loan_repayment_status === 'Foreclosed') && !this.actual_closure_date) {
    this.actual_closure_date = new Date();
  }
  
  next();
});

export default mongoose.model('LoanRepayment', LoanRepaymentSchema);
