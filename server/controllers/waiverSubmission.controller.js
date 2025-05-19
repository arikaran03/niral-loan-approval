// src/controllers/waiverSubmission.controller.js
import WaiverSubmission from '../models/WaiverSubmission.js'; // Adjust path as needed
import WaiverScheme from '../models/WaiverScheme.js';       // Adjust path as needed
// import GovDocumentDefinitionModel from '../models/GovDocumentDefinitionModel.js'; // If needed for doc defs in submission details
import mongoose from 'mongoose';

/**
 * Helper to format Mongoose validation errors.
 */
function formatMongooseError(err) {
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return messages.join('; ');
  }
  return err.message || 'Server error';
}

export default {
  /**
   * Create a new Waiver Submission.
   * Expects submission data in req.body.
   * user_id should be set from authenticated user.
   */
  async create(req, res) {
    try {
      const submissionData = { ...req.body };

      // Ensure user_id is set (assuming it comes from auth middleware)
      if (!req.user || !req.user._id) { // Example: if using req.user from auth
        // If user_id is passed directly in body for some reason, ensure it's validated
        if (!submissionData.user_id) {
             return res.status(400).json({ error: 'User ID is required for submission.' });
        }
      } else {
        submissionData.user_id = req.user._id;
      }

      // Validate waiver_scheme_id
      if (!submissionData.waiver_scheme_id || !mongoose.Types.ObjectId.isValid(submissionData.waiver_scheme_id)) {
        return res.status(400).json({ error: 'Valid Waiver Scheme ID is required.' });
      }

      // Check if the referenced WaiverScheme exists and is published (optional, but good practice)
      const scheme = await WaiverScheme.findById(submissionData.waiver_scheme_id);
      if (!scheme) {
        return res.status(404).json({ error: 'Associated Waiver Scheme not found.' });
      }
      if (scheme.status !== 'published') {
        return res.status(400).json({ error: 'Applications can only be submitted for published waiver schemes.' });
      }
      // Ensure application is within the scheme's active window
      const now = new Date();
      if (now < new Date(scheme.application_start_date) || now > new Date(scheme.application_end_date)) {
          return res.status(400).json({ error: 'Waiver scheme is not currently active for submissions.' });
      }


      // The pre-save hook in WaiverSubmissionModel will handle history for new docs.
      // It will also run validations if stage is directly set to 'pending_review'.
      // If creating as 'draft', fewer validations might apply initially.
      // Default stage is 'draft' in the model. If submitting directly, set stage: 'pending_review'.
      if (submissionData.stage && submissionData.stage !== 'draft') {
         submissionData.changed_by_user_id_for_stage_change = submissionData.user_id;
      }


      const waiverSubmission = await WaiverSubmission.create(submissionData);
      return res.status(201).json(waiverSubmission);
    } catch (err) {
      console.error("Error creating waiver submission:", err);
      const msg = formatMongooseError(err);
      return res.status(400).json({ error: msg });
    }
  },

  /**
   * List Waiver Submissions.
   * Can be filtered by req.query (e.g., status, waiver_scheme_id, user_id).
   */
  async list(req, res) {
    try {
      const query = {};
      const { status, waiver_scheme_id, user_id } = req.query;

      if (status) query.status = status;
      if (waiver_scheme_id && mongoose.Types.ObjectId.isValid(waiver_scheme_id)) {
        query.waiver_scheme_id = waiver_scheme_id;
      }
      if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
        query.user_id = user_id;
      }
      // Example: For an admin, list all. For a user, list only their own.
      // if (req.user && !req.user.isAdmin) { // Assuming isAdmin flag on user object
      //   query.user_id = req.user._id;
      // }

      const submissions = await WaiverSubmission.find(query)
        .populate('waiver_scheme_id', 'title waiver_type') // Populate some scheme details
        .populate('user_id', 'name email') // Populate some user details
        .sort({ created_at: -1 })
        .lean();
      return res.json(submissions);
    } catch (err) {
      console.error("Error listing waiver submissions:", err);
      return res.status(500).json({ error: 'Failed to retrieve waiver submissions.' });
    }
  },

  /**
   * Get a single Waiver Submission by its ID.
   * Populates related WaiverScheme details.
   */
  async getById(req, res) {
    const { id } = req.params; // ID validation is done by middleware in routes
    try {
      const submission = await WaiverSubmission.findById(id)
        .populate('waiver_scheme_id') // Populate full waiver scheme details
        .populate('user_id', 'name email username') // Populate user details
        .populate('reviewer_id', 'name email username') // Populate reviewer details
        .populate('requiredDocumentRefs.fileRef') // Populate file details for required docs
        .populate('annexureDocumentRef') // Populate annexure file details
        .populate({ // Populate file details for custom fields of type image/document
            path: 'fields.fileRef',
            model: 'File' // Assuming your File model is named 'File'
        })
        .lean();

      if (!submission) {
        return res.status(404).json({ error: 'Waiver Submission not found.' });
      }

      // If you need to attach GovDocumentDefinitions similar to loan/scheme controllers:
      // You would collect schema_ids from submission.waiver_scheme_id.required_documents
      // and submission.waiver_scheme_id.fields.auto_fill_sources, then fetch and attach.
      // This might be redundant if the frontend can get them from the populated waiver_scheme_id.

      return res.json(submission);
    } catch (err) {
      console.error(`Error fetching waiver submission by ID ${id}:`, err);
      return res.status(500).json({ error: 'An error occurred while fetching the submission details.' });
    }
  },

  /**
   * Update a Waiver Submission by its ID.
   * Typically used by admins to change stage, add review notes, etc.
   */
  async update(req, res) {
    const { id } = req.params; // ID validation by middleware
    const updateData = { ...req.body };

    try {
      const submission = await WaiverSubmission.findById(id);
      if (!submission) {
        return res.status(404).json({ error: 'Waiver Submission not found.' });
      }

      // If stage is being changed, set the user responsible for audit
      if (updateData.stage && updateData.stage !== submission.stage) {
        if (!req.user || !req.user._id) {
          return res.status(401).json({ error: 'User not authenticated for updating submission stage.' });
        }
        // Pass the user ID to the pre-save hook for history tracking
        submission.changed_by_user_id_for_stage_change = req.user._id;

        // Add reviewer_id and review_date if stage moves to approved/rejected
        if (['approved', 'rejected'].includes(updateData.stage)) {
            updateData.reviewer_id = req.user._id;
            updateData.review_date = new Date();
        }
      }


      // Apply updates
      Object.assign(submission, updateData);

      const updatedSubmission = await submission.save(); // This will trigger pre-save hooks

      return res.json(updatedSubmission);
    } catch (err) {
      console.error(`Error updating waiver submission ID ${id}:`, err);
      const msg = formatMongooseError(err);
      return res.status(400).json({ error: msg });
    }
  },

  /**
   * Cancel or Close a Waiver Submission by its ID (Soft Delete).
   * Changes the stage to 'closed' or 'cancelled'.
   */
  async removeOrCancel(req, res) {
    const { id } = req.params; // ID validation by middleware
    try {
      const submission = await WaiverSubmission.findById(id);
      if (!submission) {
        return res.status(404).json({ error: 'Waiver Submission not found.' });
      }

      // Determine if user can cancel (e.g., only if in 'draft' or 'pending_review')
      // Or if admin is closing it.
      // For simplicity, let's assume this endpoint sets it to 'closed'.
      if (submission.stage === 'closed' || submission.stage === 'cancelled') {
        return res.json({ message: 'Submission is already closed or cancelled.', submission });
      }

      submission.stage = 'closed'; // Or 'cancelled' based on your logic
      if (req.user && req.user._id) {
        submission.changed_by_user_id_for_stage_change = req.user._id;
      } else {
         // Fallback or error if changer is unknown for a non-user initiated cancel
         console.warn(`Attempting to cancel submission ${id} without an identified user.`);
      }


      const updatedSubmission = await submission.save();
      return res.json({ message: 'Waiver Submission has been closed/cancelled.', submission: updatedSubmission });
    } catch (err) {
      console.error(`Error cancelling/closing waiver submission ID ${id}:`, err);
      const msg = formatMongooseError(err);
      return res.status(500).json({ error: msg });
    }
  },

  /**
   * List Waiver Submissions for a specific Waiver Scheme.
   */
  async listByScheme(req, res) {
    const { schemeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(schemeId)) {
      return res.status(400).json({ error: 'Invalid Waiver Scheme ID format.' });
    }
    try {
      const submissions = await WaiverSubmission.find({ waiver_scheme_id: schemeId })
        .populate('user_id', 'name email')
        .sort({ created_at: -1 })
        .lean();
      return res.json(submissions);
    } catch (err) {
      console.error(`Error listing submissions for scheme ID ${schemeId}:`, err);
      return res.status(500).json({ error: 'Failed to retrieve submissions for the scheme.' });
    }
  },

  /**
   * (Example) List Waiver Submissions for the authenticated user.
   */
  async listByUser(req, res) {
    // This assumes req.user._id is available from authentication middleware
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'User not authenticated.' });
    }
    try {
      const submissions = await WaiverSubmission.find({ user_id: req.user._id })
        .populate('waiver_scheme_id', 'title')
        .sort({ created_at: -1 })
        .lean();
      return res.json(submissions);
    } catch (err) {
      console.error(`Error listing submissions for user ID ${req.user._id}:`, err);
      return res.status(500).json({ error: 'Failed to retrieve your submissions.' });
    }
  },
};
