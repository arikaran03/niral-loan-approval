// src/controllers/loanSubmission.controller.js
import LoanSubmission from '../database/models/LoanSubmissionModel.js';
import Loan from '../database/models/LoanModel.js';
import mongoose from 'mongoose';
// Correctly import the named export from loanRepayment.controller.js
import { createLoanRepaymentRecordInternal } from './loanRepayment.controller.js'; 


// Helper function
function formatMongooseError(err) {
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return messages.join('; ');
  }
  if (err.code === 11000) {
     return 'A duplicate key error occurred.';
  }
  return err.message || 'Server error';
}

export async function getDraft(req, res, next) {
    try {
      const { loanId } = req.params;
      const userId = req.user._id; 

      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        return res.status(400).json({ error: 'Invalid loan ID.' });
      }
      const draft = await LoanSubmission.findOne({
        loan_id: loanId,
        user_id: userId,
        stage: 'draft'
      })
      .populate('loan_id', 'title fields min_amount max_amount') 
      .populate('user_id', 'name email account_number'); 
      
      return res.json(draft || null);
    } catch (err) {
       console.error("Error in getDraft:", err);
       next(err);
    }
}


export async function createSubmission(req, res, next) {
    try {
      const { loanId } = req.params;
      const userId = req.user._id; // Assuming req.user is populated by auth middleware

      // Destructure all expected fields from the payload
      const { 
        amount, 
        fields, // Custom fields data
        requiredDocumentRefs, // Array of { documentTypeKey, fileRef }
        isFaceVerified, 
        annexureDocumentRef,
        aadhaar_data, // Extracted Aadhaar data object
        pan_data      // Extracted PAN data object
      } = req.body;

      console.log("Received payload for submission:", req.body);


      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        return res.status(400).json({ error: 'Invalid loan ID.' });
      }
      const loanDefinition = await Loan.findById(loanId).select('+fields +required_documents +aadhaar_card_definition +pan_card_definition');
      if (!loanDefinition) {
        return res.status(404).json({ error: 'Loan definition not found.' });
      }

      const existingFinalSubmission = await LoanSubmission.findOne({ 
        loan_id: loanId, 
        user_id: userId, 
        stage: { $nin: ['draft', 'rejected', 'closed'] } // Active stages
      });
      if (existingFinalSubmission) {
        return res.status(400).json({ error: 'You already have an active or pending submission for this loan.' });
      }

      // --- Basic Payload Validations ---
      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'Valid positive loan amount is required.' });
      }
      if (loanDefinition.min_amount !== null && amount < loanDefinition.min_amount) {
        return res.status(400).json({ error: `Amount must be at least ${loanDefinition.min_amount}.` });
      }
      if (loanDefinition.max_amount !== null && amount > loanDefinition.max_amount) {
        return res.status(400).json({ error: `Amount cannot exceed ${loanDefinition.max_amount}.` });
      }
      if (!Array.isArray(fields)) {
        return res.status(400).json({ error: 'Fields data must be an array.' });
      }
      if (!Array.isArray(requiredDocumentRefs)) { // This comes from frontend
        return res.status(400).json({ error: 'Required documents references must be an array.' });
      }
      if (!aadhaar_data || typeof aadhaar_data !== 'object' || Object.keys(aadhaar_data).length === 0) {
        return res.status(400).json({ error: 'Aadhaar data is missing or invalid.' });
      }
      if (!pan_data || typeof pan_data !== 'object' || Object.keys(pan_data).length === 0) {
        return res.status(400).json({ error: 'PAN data is missing or invalid.' });
      }
      // Face verification check (assuming aadhaar_card_definition is loaded with loanDefinition)
      let aadhaarRequiresFaceVerification = false;
      if (loanDefinition.aadhaar_card_definition && loanDefinition.aadhaar_card_definition.fields) {
            aadhaarRequiresFaceVerification = loanDefinition.aadhaar_card_definition.fields.some(f => f.key === 'photo');
      }
      if (aadhaarRequiresFaceVerification && isFaceVerified !== true) {
          return res.status(400).json({ error: 'Face verification is mandatory and not completed.' });
      }


      // --- Process and Validate Custom Fields ---
      const submissionFieldsValidated = [];
      const validationErrors = [];
      const submittedFieldsMap = new Map(fields.map(f => [f.field_id, f]));

      for (const schemaField of loanDefinition.fields) {
          const submittedField = submittedFieldsMap.get(schemaField.field_id);
          const value = submittedField?.value;
          const fileRef = submittedField?.fileRef; 

          if (schemaField.required) {
              if (schemaField.type === 'image' || schemaField.type === 'document') {
                  if (!fileRef || !mongoose.Types.ObjectId.isValid(fileRef)) { 
                    validationErrors.push(`File upload is required for custom field: ${schemaField.field_label}.`); 
                  }
              } else if (schemaField.type === 'checkbox') {
                   if (value !== true) { 
                    validationErrors.push(`Custom field ${schemaField.field_label} must be checked.`); 
                   }
              } else {
                  if (value === null || value === undefined || String(value).trim() === '') { 
                    validationErrors.push(`Value is required for custom field: ${schemaField.field_label}.`); 
                  }
              }
          }
          // Add to submission even if not required but value is present, or if it's a file field (fileRef might be null if not required)
          if (submittedField || (schemaField.type === 'image' || schemaField.type === 'document')) {
              submissionFieldsValidated.push({
                  field_id: schemaField.field_id, 
                  field_label: schemaField.field_label, 
                  type: schemaField.type,
                  value: (schemaField.type !== 'image' && schemaField.type !== 'document') ? value : null,
                  fileRef: (schemaField.type === 'image' || schemaField.type === 'document') ? (fileRef || null) : null 
              });
          } else if (schemaField.required) { // Should have been caught above, but as a fallback
              validationErrors.push(`Required custom field ${schemaField.field_label} was not submitted.`);
          }
      }

      // --- Process and Validate Required Document References ---
      const submissionRequiredDocsValidated = [];
      // Create a map of submitted document references for quick lookup
      const submittedRequiredDocsMap = new Map(requiredDocumentRefs.map(d => [d.documentTypeKey, d]));

      // 1. Validate Aadhaar Card
      const aadhaarSubmittedRef = submittedRequiredDocsMap.get('aadhaar_card');
      if (!aadhaarSubmittedRef || !aadhaarSubmittedRef.fileRef || !mongoose.Types.ObjectId.isValid(aadhaarSubmittedRef.fileRef)) {
          validationErrors.push('Aadhaar Card document upload is mandatory and missing/invalid.');
      } else {
          submissionRequiredDocsValidated.push({ documentTypeKey: 'aadhaar_card', fileRef: aadhaarSubmittedRef.fileRef });
      }

      // 2. Validate PAN Card
      const panSubmittedRef = submittedRequiredDocsMap.get('pan_card');
      if (!panSubmittedRef || !panSubmittedRef.fileRef || !mongoose.Types.ObjectId.isValid(panSubmittedRef.fileRef)) {
          validationErrors.push('PAN Card document upload is mandatory and missing/invalid.');
      } else {
          submissionRequiredDocsValidated.push({ documentTypeKey: 'pan_card', fileRef: panSubmittedRef.fileRef });
      }
      
      // 3. Validate Other Required Documents (from loan definition)
      const otherLoanRequiredDocs = (loanDefinition.required_documents || []).filter(
          docDef => docDef.name !== 'aadhaar_card' && docDef.name !== 'pan_card'
      );

      for (const reqDocDef of otherLoanRequiredDocs) {
           const submittedDoc = submittedRequiredDocsMap.get(reqDocDef.name); // reqDocDef.name is the documentTypeKey
           if (!submittedDoc || !submittedDoc.fileRef || !mongoose.Types.ObjectId.isValid(submittedDoc.fileRef)) {
               validationErrors.push(`Required document upload is missing for ${reqDocDef.label || reqDocDef.name}.`);
           } else {
               submissionRequiredDocsValidated.push({
                   documentTypeKey: reqDocDef.name,
                   fileRef: submittedDoc.fileRef 
               });
           }
       }
       
      // Annexure check - if annexureDocumentRef is provided, it must be a valid ObjectId
      if (annexureDocumentRef && !mongoose.Types.ObjectId.isValid(annexureDocumentRef)) {
        validationErrors.push('Invalid Annexure Document reference.');
      }


      if (validationErrors.length > 0) { 
        console.warn("Submission validation errors:", validationErrors);
        return res.status(400).json({ error: validationErrors.join('; ') }); 
      }
      
      // --- Prepare Submission Data ---
      let submission = await LoanSubmission.findOne({ loan_id: loanId, user_id: userId, stage: 'draft' });
      const now = new Date();
      const historyEntry = { stage: 'pending', changed_by: userId, changed_at: now }; 
      
      const finalSubmissionData = {
          loan_id: loanDefinition._id, 
          user_id: userId, 
          amount,
          fields: submissionFieldsValidated, // Use the validated and structured fields
          requiredDocumentRefs: submissionRequiredDocsValidated, // Use the validated and structured doc refs
          aadhaar_data, // Directly from payload
          pan_data,     // Directly from payload
          isFaceVerified: isFaceVerified || false, // Default to false if not provided
          annexureDocumentRef: annexureDocumentRef || null,
          stage: 'pending', 
          history: submission?.history ? [...submission.history, historyEntry] : [historyEntry], 
          updated_at: now,
          // Clear fields that might be set by an admin later
          approver_id: undefined,
          approval_date: undefined,
          rejection_reason: undefined
      };

      if (submission) { 
          console.log("Updating existing draft submission to 'pending'. ID:", submission._id);
          submission.set(finalSubmissionData); 
          // Set the transient field for pre-save hook for history
          submission.changed_by_user_id_for_stage_change = userId;
          await submission.save();
      } else { 
          console.log("Creating new submission with stage 'pending'.");
          submission = await LoanSubmission.create({ ...finalSubmissionData, created_at: now }); 
      }

      // Populate for response
      const populatedSubmission = await LoanSubmission.findById(submission._id)
          .populate('user_id', 'name email') // Adjust fields as needed
          .populate('loan_id', 'title interest_rate'); // Adjust fields as needed

      return res.status(201).json(populatedSubmission); 

    } catch (err) {
      if (err.name === 'ValidationError') {
          const msg = formatMongooseError(err);
          console.error("Mongoose Validation Error in createSubmission:", msg, err.errors);
          return res.status(400).json({ error: msg });
      }
      console.error("Error in createSubmission:", err);
      next(err); // Pass to global error handler
    }
}


export async function listByLoan(req, res, next) {
    try {
      const { loanId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        return res.status(400).json({ error: 'Invalid loan ID.' });
      }
      const submissions = await LoanSubmission
        .find({ loan_id: loanId })
        .populate('user_id', 'name email')
        .sort('-created_at');

      return res.json(submissions);
    } catch (err) {
        console.error("Error in listByLoan:", err);
        next(err);
    }
}

export async function getSubmission(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid submission ID.' });
      }
      const submission = await LoanSubmission.findById(id)
        .populate('user_id', 'name email account_number')
        .populate('loan_id', 'title interest_rate tenure_months processing_fee'); // Populated fields needed for repayment

      if (!submission) {
        return res.status(404).json({ error: 'Submission not found.' });
      }

      const loanDetails = await Loan.findById(submission.loan_id);
      if (!loanDetails) {
        return res.status(404).json({ error: 'Associated loan product not found.' });
      }
      
      return res.json({
        ...submission.toObject(),
        loanDetails: {
          title: loanDetails.title,
          interest_rate: loanDetails.interest_rate,
          tenure_months: loanDetails.tenure_months,
          processing_fee: loanDetails.processing_fee
        }
      });
    } catch (err) {
        console.error("Error in getSubmission:", err);
        next(err);
    }
}

export async function updateSubmission(req, res, next) {
    try {
      const { id } = req.params;
      const { stage, amount, rejection_reason } = req.body; 
      // const adminUserId = req.user._id; // Assuming admin is making this general update

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid submission ID.' });
      }

      const submission = await LoanSubmission.findById(id);
       if (!submission) {
        return res.status(404).json({ error: 'Submission not found.' });
      }

      if (submission.stage === 'paid_to_applicant' && stage && stage !== 'paid_to_applicant') {
          return res.status(400).json({ error: "Cannot change stage from 'Paid to Applicant' using this method. Loan is considered disbursed." });
      }
      if (stage === 'paid_to_applicant') {
          return res.status(400).json({ error: "Use the 'change-stage' endpoint to mark as 'Paid to Applicant'." });
      }
      // This endpoint is not for primary stage changes (approve, reject, paid).
      if (stage && submission.stage !== stage && ['pending', 'approved', 'rejected', 'paid_to_applicant'].includes(stage)) {
        return res.status(400).json({ error: "Please use the '/change-stage' endpoint for primary stage modifications (approve, reject, paid to applicant, revert to pending)." });
      }


      const update = {};
      const now = new Date();

      if (typeof amount === 'number') {
        if (amount <= 0) return res.status(400).json({ error: 'Amount must be positive.' });
        const loan = await Loan.findById(submission.loan_id);
        if (!loan) return res.status(404).json({ error: "Associated loan product not found." });
        if (loan.min_amount !== null && amount < loan.min_amount) return res.status(400).json({ error: `Amount must be at least ${loan.min_amount}.` });
        if (loan.max_amount !== null && amount > loan.max_amount) return res.status(400).json({ error: `Amount cannot exceed ${loan.max_amount}.` });
        update.amount = amount;
      }
      
      if (rejection_reason && submission.stage === 'rejected') {
          update.rejection_reason = rejection_reason;
      }
      
      // Only update if there are actual changes to save
      if (Object.keys(update).length > 0) {
        update.updated_at = now; 
        submission.set(update);
        // Optionally add a history entry for general admin updates if needed
        // submission.history.push({ stage: submission.stage, changed_by: adminUserId, changed_at: now, notes: "Admin general update (e.g., amount correction)" });
        await submission.save();
      }


      const populatedSubmission = await LoanSubmission.findById(submission._id).populate([
          { path: 'user_id', select: 'name email account_number' },
          { path: 'loan_id', select: 'title interest_rate tenure_months processing_fee' }
      ]);

      return res.json(populatedSubmission);
    } catch (err) {
        if (err.name === 'ValidationError') { const msg = formatMongooseError(err); return res.status(400).json({ error: msg }); }
        console.error("Error in updateSubmission:", err); next(err);
    }
}

export async function changeSubmissionStage(req, res, next) {
    console.log('changeSubmissionStage called with body:', req.body);
    try {
      const { id } = req.params;
      const { stage, rejection_reason } = req.body;
      const adminUserId = req.user._id; 

      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid submission ID.' });
      
      const submission = await LoanSubmission.findById(id)
            .populate('loan_id', 'title interest_rate tenure_months processing_fee') // Ensure all needed fields are here
            .populate('user_id', '_id name email'); // Populate user details needed for repayment or logging
      
      if (!submission) return res.status(404).json({ error: 'Submission not found.' });
      if (!submission.loan_id) return res.status(500).json({ error: 'CRITICAL: Associated loan product details missing from submission.' });
      if (!submission.user_id || !submission.user_id._id) return res.status(500).json({ error: 'CRITICAL: Applicant user details missing from submission.' });


      const currentStage = submission.stage;
      const ALLOWED_TARGET_STAGES = ['pending', 'approved', 'rejected', 'paid_to_applicant'];
      
      if (!ALLOWED_TARGET_STAGES.includes(stage)) {
        return res.status(400).json({ error: `Target stage must be one of ${ALLOWED_TARGET_STAGES.join(', ')}.` });
      }
      if (currentStage === 'draft') {
        return res.status(400).json({ error: 'Cannot change stage from draft using this endpoint. Applicant must submit first.' });
      }
      if (currentStage === stage) {
        return res.status(400).json({ error: `Submission is already in stage: ${stage}.` });
      }

      // Core irreversibility rule
      if (currentStage === 'paid_to_applicant') { 
          return res.status(400).json({ error: "Cannot change stage from 'Paid to Applicant'. This action is final." });
      }

      // Define valid transitions
      const validTransitions = {
          pending: ['approved', 'rejected'],
          approved: ['pending', 'paid_to_applicant'], // Can revert to pending or move to paid
          rejected: ['pending'] // Can only revert to pending
          // 'paid_to_applicant' has no further transitions out of it via this logic
      };

      if (!validTransitions[currentStage] || !validTransitions[currentStage].includes(stage)) {
          return res.status(400).json({ error: `Invalid stage transition from '${currentStage}' to '${stage}'.` });
      }


      const now = new Date();
      const historyEntry = { stage: stage, changed_by: adminUserId, changed_at: now };
      submission.history.push(historyEntry);
      submission.stage = stage;

      if (stage === 'approved') { 
          submission.approver_id = adminUserId; 
          submission.approval_date = now; 
          submission.rejection_reason = undefined; 
      } else if (stage === 'rejected') { 
          submission.approver_id = adminUserId; 
          submission.approval_date = undefined; 
          submission.rejection_reason = rejection_reason || 'Rejected without specific reason.'; 
      } else if (stage === 'pending') { 
          submission.approver_id = undefined; 
          submission.approval_date = undefined; 
          submission.rejection_reason = undefined; 
      } else if (stage === 'paid_to_applicant') {
          // This check is technically covered by validTransitions, but good for explicitness
          if (currentStage !== 'approved') {
              return res.status(400).json({ error: "Loan must be 'approved' before it can be marked as 'paid_to_applicant'."});
          }
          // Add a field to LoanSubmission schema if you want to store disbursement date directly
          // submission.disbursement_date = now; 

          // --- Create LoanRepayment Record ---
          try {
            const loanProductDetails = submission.loan_id; 
            const disbursedAmount = submission.amount;
            
            // Determine repayment_start_date (e.g., 1st of next month, or configurable delay)
            const today = new Date();
            let repaymentStartDate = new Date(today.getFullYear(), today.getMonth() + 1, 1); // Default to 1st of next month
            // Example: If disbursement is late in month (e.g., after 20th), start repayment month after next
            if (today.getDate() > 20) { 
                repaymentStartDate = new Date(today.getFullYear(), today.getMonth() + 2, 1);
            }

            // Calculate EMI
            const P = disbursedAmount;
            const annualRate = loanProductDetails.interest_rate / 100; // Ensure interest_rate is a percentage like 12 for 12%
            const monthlyRate = annualRate / 12;
            const n = loanProductDetails.tenure_months; // Number of installments
            let calculatedEMI = 0;

            if (n <= 0) { // Validate tenure
                return res.status(400).json({ error: "Invalid loan tenure (must be > 0) for EMI calculation." });
            }
            if (P <= 0) { // Validate principal
                return res.status(400).json({ error: "Invalid loan amount (must be > 0) for EMI calculation." });
            }


            if (monthlyRate > 0) {
                 calculatedEMI = P * monthlyRate * Math.pow(1 + monthlyRate, n) / (Math.pow(1 + monthlyRate, n) - 1);
            } else { // Interest-free loan
                 calculatedEMI = P / n;
            }
            calculatedEMI = Math.round(calculatedEMI * 100) / 100; // Round to 2 decimal places

            if (isNaN(calculatedEMI) || !isFinite(calculatedEMI) || calculatedEMI <=0) {
                console.error("EMI Calculation error:", {P, annualRate, monthlyRate, n, calculatedEMI});
                return res.status(500).json({ error: "Could not calculate a valid EMI. Please check loan terms." });
            }

            await createLoanRepaymentRecordInternal(
                submission._id, 
                disbursedAmount, 
                repaymentStartDate, 
                calculatedEMI, 
                loanProductDetails, 
                submission.user_id._id, 
                adminUserId 
            );
            console.log(`LoanRepayment record creation successfully initiated for submission ${submission._id}`);

          } catch (repaymentError) {
              console.error("Error during LoanRepayment record creation:", repaymentError);
              // This is a critical failure. The stage should ideally not be 'paid_to_applicant' if this fails.
              // For robust systems, a transaction would wrap the stage change and repayment creation.
              // Here, we return an error and the frontend should understand the stage change might not be fully complete.
              return res.status(500).json({ 
                  error: `Failed to create repayment schedule: ${repaymentError.message}. The loan submission stage was NOT updated to 'paid_to_applicant'. Please resolve the issue and try again.`,
              });
          }
      }
      
      submission.updated_at = now;
      const updatedSubmission = await submission.save();

      // Re-populate after save to ensure all fields are fresh for the response
      const finalPopulatedSubmission = await LoanSubmission.findById(updatedSubmission._id)
        .populate('user_id', 'name email account_number')
        .populate('loan_id', 'title interest_rate tenure_months processing_fee');

      return res.json(finalPopulatedSubmission);
    } catch (err) {
        if (err.name === 'ValidationError') { const msg = formatMongooseError(err); return res.status(400).json({ error: msg }); }
        console.error("Error in changeSubmissionStage:", err); next(err);
    }
}

export async function saveDraft(req, res, next) {
    try {
      const { loanId } = req.params;
      const userId = req.user._id;
      const { amount = 0, fields, requiredDocumentRefs } = req.body; 

      if (!mongoose.Types.ObjectId.isValid(loanId)) return res.status(400).json({ error: 'Invalid loan ID.' });
      const loan = await Loan.findById(loanId);
      if (!loan) return res.status(404).json({ error: 'Loan not found.' });
      if (!Array.isArray(fields)) return res.status(400).json({ error: '`fields` must be an array.' });
      if (requiredDocumentRefs && !Array.isArray(requiredDocumentRefs)) return res.status(400).json({ error: '`requiredDocumentRefs` must be an array if provided.' });

      const processedFields = fields.map(f => ({
          ...f,
          fileRef: (f.type === 'image' || f.type === 'document') && f.fileRef && mongoose.Types.ObjectId.isValid(f.fileRef) ? f.fileRef : null,
          value: (f.type === 'image' || f.type === 'document') ? null : f.value 
      }));

      const processedRequiredDocs = (requiredDocumentRefs || []).map(d => ({
          documentName: d.documentName,
          fileRef: d.fileRef && mongoose.Types.ObjectId.isValid(d.fileRef) ? d.fileRef : null
      })).filter(d => d.documentName && (d.fileRef !== null && d.fileRef !== undefined) ); 

      const draft = await LoanSubmission.findOneAndUpdate(
        { loan_id: loanId, user_id: userId, stage: 'draft' },
        {
          loan_id: loanId,
          user_id: userId,
          amount: Number(amount) || 0, 
          fields: processedFields, 
          requiredDocumentRefs: processedRequiredDocs, 
          stage: 'draft',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, timestamps: true }
      );
      
      return res.status(200).json(draft);
    } catch (err) {
        if (err.name === 'ValidationError') { const msg = formatMongooseError(err); return res.status(400).json({ error: msg }); }
        console.error("Error in saveDraft:", err); next(err);
    }
}


export async function filterSubmissions(req, res, next) {
    try {
      const { loanId, accountNumber, applicantName, fromDate, toDate, stage } = req.query;
      const match = {};
      if (loanId && mongoose.Types.ObjectId.isValid(loanId)) { match.loan_id = new mongoose.Types.ObjectId(loanId); }
      if (stage) { match.stage = stage; }
      if (fromDate || toDate) { 
          match.created_at = {}; 
          if (fromDate) { match.created_at.$gte = new Date(new Date(fromDate).setHours(0,0,0,0)); } 
          if (toDate) { match.created_at.$lte = new Date(new Date(toDate).setHours(23,59,59,999)); } 
      }

      const pipeline = [
        { $match: match },
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user_doc' } }, 
        { $unwind: { path: '$user_doc', preserveNullAndEmptyArrays: true } }
      ];

      if (accountNumber) { pipeline.push({ $match: { 'user_doc.account_number': accountNumber } }); }
      if (applicantName) { pipeline.push({ $match: { 'user_doc.name': { $regex: applicantName, $options: 'i' } } }); }

      pipeline.push(
        { $lookup: { from: 'loans', localField: 'loan_id', foreignField: '_id', as: 'loan_doc' } }, 
        { $unwind: { path: '$loan_doc', preserveNullAndEmptyArrays: true } }
      );

      pipeline.push({
          $project: {
              amount: 1, stage: 1, fields: 1, requiredDocumentRefs: 1, history: 1,
              approver_id: 1, approval_date: 1, rejection_reason: 1, created_at: 1, updated_at: 1,
              loan_id: 1, 
              user_id: 1, 
              loan: { _id: '$loan_doc._id', title: '$loan_doc.title' }, 
              user: { _id: '$user_doc._id', name: '$user_doc.name', email: '$user_doc.email', account_number: '$user_doc.account_number' } 
          }
      });

      pipeline.push({ $sort: { created_at: -1 } });

      const submissions = await LoanSubmission.aggregate(pipeline);
      
      return res.json(submissions);
    } catch (err) {
        console.error("Error in filterSubmissions:", err);
        next(err);
    }
}

export async function getMySubmissions(req, res, next) {
  try {
    const userId = req.user._id; 

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }

    const submissions = await LoanSubmission.find({ user_id: userId })
      .populate('loan_id', 'title interest_rate tenure_months') 
      .sort({ updated_at: -1 }); 

    return res.json(submissions);

  } catch (err) {
    console.error("Error fetching user's submissions:", err);
    next(err); 
  }
}