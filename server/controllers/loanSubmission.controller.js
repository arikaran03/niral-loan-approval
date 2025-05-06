// src/controllers/loanSubmission.controller.js
import LoanSubmission from '../database/models/LoanSubmission.js';
import Loan from '../database/models/Loan.js';
import Image from '../database/models/Image.js';
import mongoose from 'mongoose';

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
      });
  
      // return `null` if no draft
      return res.json(draft || null);
    } catch (err) {
      next(err);
    }
  }
  
  /**
   * POST /api/loans/:loanId/submissions
   * Final submission: either create new or upgrade existing draft → pending.
   * Blocks any second submission if one already in stage ≠ draft.
   */
  export async function createSubmission(req, res, next) {
    try {
      const { loanId } = req.params;
      const userId = req.user._id;
      const { amount, fields } = req.body;
  
      // Validate loan
      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        return res.status(400).json({ error: 'Invalid loan ID.' });
      }
      const loan = await Loan.findById(loanId);
      if (!loan) {
        return res.status(404).json({ error: 'Loan not found.' });
      }
  
      // Block if already submitted (not draft)
      const existingFinal = await LoanSubmission.findOne({
        loan_id: loanId,
        user_id: userId,
        stage: { $ne: 'draft' }
      });
      if (existingFinal) {
        return res
          .status(400)
          .json({ error: 'You have already submitted this application.' });
      }
  
      // Basic amount validation
      if (typeof amount !== 'number' || amount < 0) {
        return res.status(400).json({ error: 'Amount must be non-negative.' });
      }
      if (loan.max_allocation && amount > loan.max_allocation) {
        return res
          .status(400)
          .json({ error: `Amount cannot exceed ${loan.max_allocation}.` });
      }
  
      // Ensure fields array
      if (!Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({ error: 'Fields array is required.' });
      }
  
      // Prepare submissionFields with timestamps
      const submissionFields = [];
      for (const f of fields) {
        // Validate field_id exists on loan schema
        const schemaField = loan.fields.find((lf) => lf.field_id === f.field_id);
        if (!schemaField) {
          return res.status(400).json({ error: `Unknown field_id ${f.field_id}` });
        }
        // If image type, ensure Image exists
        if (schemaField.type === 'image') {
          if (!mongoose.Types.ObjectId.isValid(f.value)) {
            return res
              .status(400)
              .json({ error: `Image not uploaded for ${schemaField.field_label}` });
          }
          const img = await Image.findById(f.value);
          if (!img) {
            return res
              .status(400)
              .json({ error: `Image not uploaded for ${schemaField.field_label}` });
          }
        } else {
          // Non-image: require non-empty string
          if (typeof f.value !== 'string' || !f.value.trim()) {
            return res
              .status(400)
              .json({ error: `Value required for ${schemaField.field_label}` });
          }
        }
        submissionFields.push({
          ...f,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
  
      // Check for existing draft
      let submission = await LoanSubmission.findOne({
        loan_id: loanId,
        user_id: userId,
        stage: 'draft'
      });
  
      if (submission) {
        // Upgrade draft → pending
        submission.amount = amount;
        submission.fields = submissionFields;
        submission.stage = 'pending';
        submission.updated_at = new Date();
        await submission.save();
      } else {
        // Create brand-new pending submission
        submission = await LoanSubmission.create({
          loan_id: loan._id,
          user_id: userId,
          amount,
          fields: submissionFields,
          stage: 'pending',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      console.log('Submission:', submission._id);
  
      return res.status(201).json(submission);
    } catch (err) {
      next(err);
    }
  }

/**
 * List all submissions for a given loan.
 * GET /api/loans/:loanId/submissions
 */
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
    next(err);
  }
}

/**
 * Get a single submission by ID.
 * GET /api/submissions/:id
 */
export async function getSubmission(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid submission ID.' });
    }
    const submission = await LoanSubmission.findById(id)
      .populate('user_id', 'name email')
      .populate('loan_id', 'title');

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    return res.json(submission);
  } catch (err) {
    next(err);
  }
}

/**
 * Update a submission’s stage (approve/reject) or fields.
 * PATCH /api/submissions/:id
 */
export async function updateSubmission(req, res, next) {
  try {
    const { id } = req.params;
    const { stage, fields, amount } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid submission ID.' });
    }

    const update = { updated_at: new Date() };

    if (stage) {
      if (!['pending','approved','rejected'].includes(stage)) {
        return res.status(400).json({ error: 'Invalid stage.' });
      }
      update.stage = stage;
    }
    if (typeof amount === 'number') {
      if (amount < 0) {
        return res.status(400).json({ error: 'Amount must be non-negative.' });
      }
      update.amount = amount;
    }
    if (Array.isArray(fields)) {
      update.fields = fields.map(f => ({
        ...f,
        updated_at: new Date()
      }));
    }

    const submission = await LoanSubmission.findByIdAndUpdate(id, update, { new: true });
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found.' });
    }
    return res.json(submission);
  } catch (err) {
    next(err);
  }
}



export async function changeSubmissionStage(req, res, next) {

    console.log('changeSubmissionStage called');
    try {
      const { id } = req.params;
      const { stage } = req.body;
  
      // validate ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid submission ID.' });
      }
  
      // only allow these three transitions
      const ALLOWED = ['pending', 'approved', 'rejected'];
      if (!ALLOWED.includes(stage)) {
        return res.status(400).json({ error: `Stage must be one of ${ALLOWED.join(', ')}.` });
      }
  
      // update just the stage
      const submission = await LoanSubmission.findByIdAndUpdate(
        id,
        { stage, updated_at: new Date() },
        { new: true }
      );
  
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found.' });
      }
  
      return res.json(submission);
    } catch (err) {
      next(err);
    }
  }

export async function saveDraft(req, res, next) {
    try {
      const { loanId } = req.params;
      const userId = req.user._id;
      const { amount = 0, fields } = req.body;
  
      // Validate loan
      if (!mongoose.Types.ObjectId.isValid(loanId)) {
        return res.status(400).json({ error: 'Invalid loan ID.' });
      }
      const loan = await Loan.findById(loanId);
      if (!loan) {
        return res.status(404).json({ error: 'Loan not found.' });
      }
  
      // Validate fields array
      if (!Array.isArray(fields)) {
        return res.status(400).json({ error: '`fields` must be an array.' });
      }
  
      // Upsert draft submission
      const draft = await LoanSubmission.findOneAndUpdate(
        { loan_id: loanId, user_id: userId, stage: 'draft' },
        {
          loan_id: loanId,
          user_id: userId,
          amount,
          fields: fields.map(f => ({
            ...f,
            updated_at: new Date(),
            created_at: f.created_at || new Date()
          })),
          stage: 'draft',
          updated_at: new Date(),
          // if no existing, set created_at:
          ...( !req.body._id && { created_at: new Date() } )
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
  
      return res.status(200).json(draft);
    } catch (err) {
      next(err);
    }
  }


  export async function filterSubmissions(req, res, next) {
    try {
      const {
        loanId,
        accountNumber,
        applicantName,
        fromDate,
        toDate,
        stage
      } = req.query;
  
      const match = {};
  
      // loanId filter
      if (loanId && mongoose.Types.ObjectId.isValid(loanId)) {
        match.loan_id = mongoose.Types.ObjectId(loanId);
      }
  
      // stage filter
      if (stage) {
        match.stage = stage;
      }
  
      // date range filter
      if (fromDate || toDate) {
        match.created_at = {};
        if (fromDate) {
          match.created_at.$gte = new Date(fromDate);
        }
        if (toDate) {
          match.created_at.$lte = new Date(toDate);
        }
      }
  
      // Build aggregation pipeline
      const pipeline = [
        { $match: match },
        // bring in user data
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' }
      ];
  
      // accountNumber filter
      if (accountNumber) {
        pipeline.push({
          $match: { 'user.account_number': accountNumber }
        });
      }
  
      // applicantName partial regex filter
      if (applicantName) {
        pipeline.push({
          $match: {
            'user.name': {
              $regex: applicantName,
              $options: 'i'
            }
          }
        });
      }
  
      // Optionally populate loan details as well
      pipeline.push({
        $lookup: {
          from: 'loans',
          localField: 'loan_id',
          foreignField: '_id',
          as: 'loan'
        }
      }, { $unwind: '$loan' });
  
      // Finally sort by newest first
      pipeline.push({ $sort: { created_at: -1 } });
  
      // Execute
      const submissions = await LoanSubmission.aggregate(pipeline);
  
      return res.json(submissions);
    } catch (err) {
      next(err);
    }
  }