// src/controllers/loanSubmission.controller.js
import LoanSubmission from '../database/models/LoanSubmission.js';
import Loan from '../database/models/Loan.js';
import Image from '../database/models/Image.js'; // Still needed for validation checks potentially
import mongoose from 'mongoose';

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
      const userId = req.user._id; // Assuming req.user is populated by auth middleware

      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        return res.status(400).json({ error: 'Invalid loan ID.' });
      }

      // Find draft but DO NOT populate fileRefs
      const draft = await LoanSubmission.findOne({
        loan_id: loanId,
        user_id: userId,
        stage: 'draft'
      })
      .populate('loan_id', 'title fields min_amount max_amount') // Populate loan info
      .populate('user_id', 'name email account_number'); // Populate user info
      // REMOVED: .populate('fields.fileRef')
      // REMOVED: .populate('requiredDocumentRefs.fileRef')

      return res.json(draft || null); // fileRef fields will contain only ObjectIds
    } catch (err) {
       console.error("Error in getDraft:", err);
       next(err);
    }
}

export async function createSubmission(req, res, next) {
    try {
      const { loanId } = req.params;
      const userId = req.user._id;
      const { amount, fields, requiredDocumentRefs } = req.body;

      // --- Validations ---
      if (!mongoose.Types.ObjectId.isValid(loanId)) return res.status(400).json({ error: 'Invalid loan ID.' });
      const loan = await Loan.findById(loanId).select('+fields +required_documents');
      if (!loan) return res.status(404).json({ error: 'Loan definition not found.' });
      const existingFinal = await LoanSubmission.findOne({ loan_id: loanId, user_id: userId, stage: { $ne: 'draft' } });
      if (existingFinal) return res.status(400).json({ error: 'You have already submitted this application.' });
      if (typeof amount !== 'number' || amount < 0) return res.status(400).json({ error: 'Valid loan amount is required.' });
      if (loan.min_amount !== null && amount < loan.min_amount) return res.status(400).json({ error: `Amount must be at least ${loan.min_amount}.` });
      if (loan.max_amount !== null && amount > loan.max_amount) return res.status(400).json({ error: `Amount cannot exceed ${loan.max_amount}.` });
      if (!Array.isArray(fields)) return res.status(400).json({ error: 'Fields data must be an array.' });
      if (!Array.isArray(requiredDocumentRefs)) return res.status(400).json({ error: 'Required documents references must be an array.' });

      // --- Field and Document Validation Loop ---
      const submissionFields = [];
      const submissionRequiredDocs = [];
      const validationErrors = [];
      const submittedFieldsMap = new Map(fields.map(f => [f.field_id, f]));
      const submittedDocsMap = new Map(requiredDocumentRefs.map(d => [d.documentName, d]));

      // Validate Custom Fields
      for (const schemaField of loan.fields) {
          const submittedField = submittedFieldsMap.get(schemaField.field_id);
          const value = submittedField?.value;
          const fileRef = submittedField?.fileRef; // This is the ObjectId string from frontend

          if (schemaField.required) {
              if (schemaField.type === 'image' || schemaField.type === 'document') {
                  if (!fileRef || !mongoose.Types.ObjectId.isValid(fileRef)) { validationErrors.push(`File upload is required for ${schemaField.field_label}.`); }
                  // Check if Image exists (optional, adds DB load)
                  // else { const fileDoc = await Image.findById(fileRef); if (!fileDoc) validationErrors.push(`Uploaded file reference invalid for ${schemaField.field_label}.`); }
              } else if (schemaField.type === 'checkbox') {
                   if (value !== true) { validationErrors.push(`${schemaField.field_label} must be checked.`); }
              } else {
                  if (value === null || value === undefined || String(value).trim() === '') { validationErrors.push(`Value is required for ${schemaField.field_label}.`); }
              }
          }
          // Add other type/min/max validations here...

          if (submittedField) {
              submissionFields.push({
                  field_id: schemaField.field_id, field_label: schemaField.field_label, type: schemaField.type,
                  value: (schemaField.type !== 'image' && schemaField.type !== 'document') ? value : null,
                  fileRef: (schemaField.type === 'image' || schemaField.type === 'document') ? fileRef : null // Save the ObjectId
              });
          } else if (schemaField.required) {
              validationErrors.push(`Required field ${schemaField.field_label} was not submitted.`);
          }
      }

      // Validate Required Documents
       for (const reqDoc of loan.required_documents) {
           const submittedDoc = submittedDocsMap.get(reqDoc.name);
           const fileRef = submittedDoc?.fileRef; // This is the ObjectId string from frontend

           if (!fileRef || !mongoose.Types.ObjectId.isValid(fileRef)) {
               validationErrors.push(`Required document upload is missing for ${reqDoc.name}.`);
               // Optional: Check if Image exists
               // else { const fileDoc = await Image.findById(fileRef); if (!fileDoc) validationErrors.push(`Uploaded file reference invalid for ${reqDoc.name}.`); }
           } else {
               submissionRequiredDocs.push({
                   documentName: reqDoc.name,
                   fileRef: fileRef // Save the ObjectId
               });
           }
       }

      if (validationErrors.length > 0) { return res.status(400).json({ error: validationErrors.join('; ') }); }
      // --- End Validation ---

      // Find existing draft or prepare new submission data
      let submission = await LoanSubmission.findOne({ loan_id: loanId, user_id: userId, stage: 'draft' });
      const now = new Date();
      const historyEntry = { stage: 'pending', changed_by: userId, changed_at: now };
      const submissionData = {
          loan_id: loan._id, user_id: userId, amount,
          fields: submissionFields,
          requiredDocumentRefs: submissionRequiredDocs,
          stage: 'pending', history: [historyEntry], updated_at: now
      };

      if (submission) { // Update draft
          console.log(`Updating draft ${submission._id} to pending.`);
          submission.set(submissionData); // Use set to apply multiple fields
          if (submission.history.length === 0 || submission.history[submission.history.length - 1].stage !== 'pending') {
              submission.history.push(historyEntry);
          }
          await submission.save();
      } else { // Create new
          console.log(`Creating new submission in pending stage.`);
          submission = await LoanSubmission.create(submissionData);
      }

      console.log('Submission successful:', submission._id);

      // Populate only user and loan info for the response
      // DO NOT populate fileRefs here
      const finalSubmission = await LoanSubmission.findById(submission._id)
          .populate('user_id', 'name email account_number')
          .populate('loan_id', 'title');

      return res.status(201).json(finalSubmission); // Return submission with only IDs in fileRef fields

    } catch (err) {
      if (err.name === 'ValidationError') {
          const msg = formatMongooseError(err);
          console.error("Mongoose Validation Error:", msg);
          return res.status(400).json({ error: msg });
      }
      console.error("Error in createSubmission:", err);
      next(err);
    }
}

export async function listByLoan(req, res, next) {
    try {
      const { loanId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        return res.status(400).json({ error: 'Invalid loan ID.' });
      }
      // Only populate user, leave fileRefs as IDs
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
      // Populate user and loan, but NOT fileRefs
      const submission = await LoanSubmission.findById(id)
        .populate('user_id', 'name email account_number')
        .populate('loan_id', 'title');
        // REMOVED: .populate('fields.fileRef')
        // REMOVED: .populate('requiredDocumentRefs.fileRef')

      if (!submission) {
        return res.status(404).json({ error: 'Submission not found.' });
      }
      return res.json(submission); // Returns submission with ObjectIds in fileRef fields
    } catch (err) {
        console.error("Error in getSubmission:", err);
        next(err);
    }
}

export async function updateSubmission(req, res, next) {
    // This function primarily updates stage/amount/reason.
    // It doesn't modify fileRefs, so no change needed for population here.
    // If it were to return the updated doc, we would ensure fileRefs are not populated.
    try {
      const { id } = req.params;
      const { stage, amount, rejection_reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid submission ID.' });
      }

      const submission = await LoanSubmission.findById(id);
       if (!submission) {
        return res.status(404).json({ error: 'Submission not found.' });
      }

      const update = {};
      let stageChanged = false;
      const now = new Date();

      if (stage && submission.stage !== stage) {
        if (!['pending','approved','rejected'].includes(stage)) return res.status(400).json({ error: 'Invalid target stage.' });
        if (submission.stage === 'draft') return res.status(400).json({ error: 'Cannot change stage from draft using this endpoint.' });

        update.stage = stage; stageChanged = true;
        const historyEntry = { stage: stage, changed_by: req.user._id, changed_at: now };
        submission.history.push(historyEntry);

         if (stage === 'approved') { update.approver_id = req.user._id; update.approval_date = now; update.rejection_reason = undefined; }
         else if (stage === 'rejected') { update.approver_id = req.user._id; update.approval_date = undefined; update.rejection_reason = rejection_reason || 'Rejected without specific reason.'; }
         else { update.approver_id = undefined; update.approval_date = undefined; update.rejection_reason = undefined; }
      }
      if (typeof amount === 'number') {
        if (amount < 0) return res.status(400).json({ error: 'Amount must be non-negative.' });
        update.amount = amount;
      }
      update.updated_at = now; // Explicitly set update time

      submission.set(update);
      const updatedSubmission = await submission.save();

      // Populate user/loan for response, NOT fileRefs
      await updatedSubmission.populate([
          { path: 'user_id', select: 'name email account_number' },
          { path: 'loan_id', select: 'title' }
      ]);

      return res.json(updatedSubmission);
    } catch (err) {
        if (err.name === 'ValidationError') { const msg = formatMongooseError(err); return res.status(400).json({ error: msg }); }
        console.error("Error in updateSubmission:", err); next(err);
    }
}

export async function changeSubmissionStage(req, res, next) {
    // This function also returns the submission, so remove fileRef population
    console.log('changeSubmissionStage called');
    try {
      const { id } = req.params;
      const { stage, rejection_reason } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid submission ID.' });
      const submission = await LoanSubmission.findById(id);
      if (!submission) return res.status(404).json({ error: 'Submission not found.' });

      const currentStage = submission.stage;
      const ALLOWED_TARGET_STAGES = ['pending', 'approved', 'rejected'];
      if (!ALLOWED_TARGET_STAGES.includes(stage)) return res.status(400).json({ error: `Target stage must be one of ${ALLOWED_TARGET_STAGES.join(', ')}.` });
      if (currentStage === 'draft') return res.status(400).json({ error: 'Cannot change stage from draft using this endpoint.' });
      if (currentStage === stage) return res.status(400).json({ error: `Submission is already in stage: ${stage}.` });
      if (!((currentStage === 'pending' && (stage === 'approved' || stage === 'rejected')) || ((currentStage === 'approved' || currentStage === 'rejected') && stage === 'pending'))) {
           return res.status(400).json({ error: `Cannot transition from stage '${currentStage}' to '${stage}'.` });
      }

      const now = new Date();
      const historyEntry = { stage: stage, changed_by: req.user._id, changed_at: now };
      submission.history.push(historyEntry);
      submission.stage = stage;
      if (stage === 'approved') { submission.approver_id = req.user._id; submission.approval_date = now; submission.rejection_reason = undefined; }
      else if (stage === 'rejected') { submission.approver_id = req.user._id; submission.approval_date = undefined; submission.rejection_reason = rejection_reason || 'Rejected without specific reason.'; }
      else { submission.approver_id = undefined; submission.approval_date = undefined; submission.rejection_reason = undefined; }
      submission.updated_at = now;

      const updatedSubmission = await submission.save();

      // Populate user/loan for response, NOT fileRefs
      await updatedSubmission.populate([
          { path: 'user_id', select: 'name email account_number' },
          { path: 'loan_id', select: 'title' }
      ]);

      return res.json(updatedSubmission);
    } catch (err) {
        if (err.name === 'ValidationError') { const msg = formatMongooseError(err); return res.status(400).json({ error: msg }); }
        console.error("Error in changeSubmissionStage:", err); next(err);
    }
}

export async function saveDraft(req, res, next) {
    // Drafts might not need population in response, but ensure fileRefs are saved as IDs
    try {
      const { loanId } = req.params;
      const userId = req.user._id;
      const { amount = 0, fields, requiredDocumentRefs } = req.body; // Expect requiredDocumentRefs

      if (!mongoose.Types.ObjectId.isValid(loanId)) return res.status(400).json({ error: 'Invalid loan ID.' });
      const loan = await Loan.findById(loanId);
      if (!loan) return res.status(404).json({ error: 'Loan not found.' });
      if (!Array.isArray(fields)) return res.status(400).json({ error: '`fields` must be an array.' });
      if (requiredDocumentRefs && !Array.isArray(requiredDocumentRefs)) return res.status(400).json({ error: '`requiredDocumentRefs` must be an array if provided.' });


      // Prepare fields - ensure fileRef is ObjectId or null
      const processedFields = fields.map(f => ({
          ...f,
          fileRef: (f.type === 'image' || f.type === 'document') && f.fileRef && mongoose.Types.ObjectId.isValid(f.fileRef) ? f.fileRef : null,
          value: (f.type === 'image' || f.type === 'document') ? null : f.value // Clear value if fileRef exists
      }));

      // Prepare required docs - ensure fileRef is ObjectId or null
      const processedRequiredDocs = (requiredDocumentRefs || []).map(d => ({
          documentName: d.documentName,
          fileRef: d.fileRef && mongoose.Types.ObjectId.isValid(d.fileRef) ? d.fileRef : null
      })).filter(d => d.documentName && d.fileRef); // Filter out invalid entries

      const draft = await LoanSubmission.findOneAndUpdate(
        { loan_id: loanId, user_id: userId, stage: 'draft' },
        {
          loan_id: loanId,
          user_id: userId,
          amount,
          fields: processedFields, // Use processed fields
          requiredDocumentRefs: processedRequiredDocs, // Use processed refs
          stage: 'draft',
          // timestamps: true handles updated_at
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, timestamps: true }
      );

      // Return draft with only IDs for fileRefs
      return res.status(200).json(draft);
    } catch (err) {
        if (err.name === 'ValidationError') { const msg = formatMongooseError(err); return res.status(400).json({ error: msg }); }
        console.error("Error in saveDraft:", err); next(err);
    }
}


export async function filterSubmissions(req, res, next) {
    // This uses aggregation, population needs to be handled differently
    // Keeping it as is for now, returning IDs only by default from aggregation
    try {
      const { loanId, accountNumber, applicantName, fromDate, toDate, stage } = req.query;
      const match = {};
      if (loanId && mongoose.Types.ObjectId.isValid(loanId)) { match.loan_id = new mongoose.Types.ObjectId(loanId); }
      if (stage) { match.stage = stage; }
      if (fromDate || toDate) { match.created_at = {}; if (fromDate) { match.created_at.$gte = new Date(fromDate); } if (toDate) { match.created_at.$lte = new Date(toDate); } }

      const pipeline = [
        { $match: match },
        { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
        // Use $unwind with preserveNullAndEmptyArrays to keep submissions even if user lookup fails
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
      ];

      if (accountNumber) { pipeline.push({ $match: { 'user.account_number': accountNumber } }); }
      if (applicantName) { pipeline.push({ $match: { 'user.name': { $regex: applicantName, $options: 'i' } } }); }

      pipeline.push(
        { $lookup: { from: 'loans', localField: 'loan_id', foreignField: '_id', as: 'loan' } },
        // Use $unwind with preserveNullAndEmptyArrays for loan too
        { $unwind: { path: '$loan', preserveNullAndEmptyArrays: true } }
      );

      // Project only necessary fields from loan/user to keep response smaller if needed
      pipeline.push({
          $project: {
              // Include all original submission fields
              amount: 1, stage: 1, fields: 1, requiredDocumentRefs: 1, history: 1,
              approver_id: 1, approval_date: 1, rejection_reason: 1, created_at: 1, updated_at: 1,
              // Select specific fields from populated docs
              'loan._id': '$loan._id', // Rename _id to avoid conflict if needed
              'loan.title': '$loan.title',
              'user._id': '$user._id',
              'user.name': '$user.name',
              'user.email': '$user.email',
              'user.account_number': '$user.account_number',
              // Explicitly include IDs needed for frontend links
              'loan_id': 1,
              'user_id': 1
          }
      });

      pipeline.push({ $sort: { created_at: -1 } });

      const submissions = await LoanSubmission.aggregate(pipeline);

      // Result 'submissions' will have user/loan embedded, but fileRefs will be ObjectIds
      return res.json(submissions);
    } catch (err) {
        console.error("Error in filterSubmissions:", err);
        next(err);
    }
}

export async function getMySubmissions(req, res, next) {
  try {
    const userId = req.user._id; // Get user ID from authentication middleware

    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }

    // Find submissions for the user, populate necessary details
    // Sort by most recently updated
    const submissions = await LoanSubmission.find({ user_id: userId })
      .populate('loan_id', 'title interest_rate tenure_months') // Populate loan details needed for display
      // Don't populate user_id again as it's the current user
      // Optionally populate history details if needed directly on dashboard
      // .populate('history.changed_by', 'name') // Might not be needed for user view
      .sort({ updated_at: -1 }); // Show most recent first

    return res.json(submissions);

  } catch (err) {
    console.error("Error fetching user's submissions:", err);
    next(err); // Pass to global error handler
  }
}
