// src/controllers/waiverSubmission.controller.js
import WaiverSubmission from '../database/models/WaiverSubmissionModel.js'; // Adjust path as needed
import WaiverScheme from '../database/models/WaiverScheme.js';       // Adjust path as needed
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
      const {
        waiver_scheme_id,
        fields,
        requiredDocumentRefs,
        aadhaar_data,
        pan_data,
        isFaceVerified,
        isOtpVerified, // Field from your payload
        annexureDocumentRef,
        stage = 'draft' // Default to 'draft' if not provided, though payload shows 'pending_review'
      } = req.body;

      let userIdFromAuth;
      if (req.user && req.user._id) {
        userIdFromAuth = req.user._id;
      } else if (req.body.user_id && mongoose.Types.ObjectId.isValid(req.body.user_id)) {
        // Fallback if user_id is in body (e.g. for system-to-system or specific admin actions)
        // Ensure proper authorization if using this fallback.
        userIdFromAuth = req.body.user_id;
        console.warn("WaiverSubmission create: user_id taken from req.body. Ensure this is an authorized action.");
      } else {
        return res.status(401).json({ success: false, error: 'User ID is required and not found in authenticated session or request body.' });
      }

      if (!waiver_scheme_id || !mongoose.Types.ObjectId.isValid(waiver_scheme_id)) {
        return res.status(400).json({ success: false, error: 'Valid Waiver Scheme ID is required.' });
      }

      const scheme = await WaiverScheme.findById(waiver_scheme_id);
      if (!scheme) {
        return res.status(404).json({ success: false, error: 'Associated Waiver Scheme not found.' });
      }
      if (scheme.status !== 'published') {
        return res.status(400).json({ success: false, error: 'Applications can only be submitted for published waiver schemes.' });
      }
      const now = new Date();
      if (now < new Date(scheme.application_start_date) || now > new Date(scheme.application_end_date)) {
          return res.status(400).json({ success: false, error: 'Waiver scheme is not currently active for submissions.' });
      }

      const submissionData = {
        waiver_scheme_id,
        user_id: userIdFromAuth,
        fields: fields || [],
        requiredDocumentRefs: requiredDocumentRefs || [],
        aadhaar_data: aadhaar_data || {},
        pan_data: pan_data || {},
        isFaceVerified: isFaceVerified !== undefined ? isFaceVerified : false,
        isOtpVerified: isOtpVerified !== undefined ? isOtpVerified : false, // Include from payload; ensure model supports it
        annexureDocumentRef: annexureDocumentRef || null,
        stage,
      };

      if (submissionData.stage && submissionData.stage !== 'draft') {
         submissionData.changed_by_user_id_for_stage_change = userIdFromAuth;
      }


      const waiverSubmission = await WaiverSubmission.create(submissionData);
      return res.status(201).json(waiverSubmission);
    } catch (err) {
      console.error("Error creating waiver submission:", err);
      const msg = formatMongooseError(err);
      return res.status(400).json({ success: false, error: msg });
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
      // If user_id is provided in query, use it. Otherwise, if admin, show all. If user, show their own.
      if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
        query.user_id = user_id;
      } else if (req.user && !req.user.isAdmin) { // Example: Check if user is not admin
        query.user_id = req.user._id;
      }


      const submissions = await WaiverSubmission.find(query)
        .populate('waiver_scheme_id', 'title waiver_type')
        .populate('user_id', 'name email')
        .sort({ created_at: -1 })
        .lean();
      return res.status(200).json({ success: true, data: submissions });
    } catch (err) {
      console.error("Error listing waiver submissions:", err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve waiver submissions.' });
    }
  },

  /**
   * Get a single Waiver Submission by its ID.
   * Populates related WaiverScheme details.
   */
  async getById(req, res) {
    const { id } = req.params;
     if (!mongoose.Types.ObjectId.isValid(id)) { // Moved validation here from routes for consistency
      return res.status(400).json({ success: false, error: 'Invalid Submission ID format.' });
    }
    try {
      const submission = await WaiverSubmission.findById(id)
        .populate('waiver_scheme_id')
        .populate('user_id', 'name email username')
        .populate('reviewer_id', 'name email username')
        .populate('requiredDocumentRefs.fileRef')
        .populate('annexureDocumentRef')
        .populate({
            path: 'fields.fileRef',
            model: 'File'
        })
        .lean();

      if (!submission) {
        return res.status(404).json({ success: false, error: 'Waiver Submission not found.' });
      }
      return res.status(200).json({ success: true, data: submission });
    } catch (err) {
      console.error(`Error fetching waiver submission by ID ${id}:`, err);
      return res.status(500).json({ success: false, error: 'An error occurred while fetching the submission details.' });
    }
  },

  /**
   * Update a Waiver Submission by its ID.
   * Typically used by admins to change stage, add review notes, etc.
   */
  async update(req, res) {
    const { id } = req.params;
     if (!mongoose.Types.ObjectId.isValid(id)) { // Moved validation here
      return res.status(400).json({ success: false, error: 'Invalid Submission ID format.' });
    }
    const updateData = { ...req.body };

    try {
      const submission = await WaiverSubmission.findById(id);
      if (!submission) {
        return res.status(404).json({ success: false, error: 'Waiver Submission not found.' });
      }

      if (updateData.stage && updateData.stage !== submission.stage) {
        if (!req.user || !req.user._id) {
          return res.status(401).json({ success: false, error: 'User not authenticated for updating submission stage.' });
        }
        submission.changed_by_user_id_for_stage_change = req.user._id;
        if (['approved', 'rejected'].includes(updateData.stage)) {
            // Ensure updateData.reviewer_id is not accidentally passed from client for these fields
            submission.reviewer_id = req.user._id;
            submission.review_date = new Date();
        }
      }
      
      // Explicitly set fields to avoid unintended updates from req.body spread
      const allowedUpdates = [
        'stage', 'fields', 'requiredDocumentRefs', 'aadhaar_data', 'pan_data',
        'isFaceVerified', 'isOtpVerified', 'annexureDocumentRef',
        'rejection_reason', 'application_notes' // Add other fields admins can update
      ];

      allowedUpdates.forEach(key => {
        if (updateData.hasOwnProperty(key)) {
            // For nested objects like 'fields' or 'aadhaar_data', ensure they are handled correctly
            // For simple assignment:
            submission[key] = updateData[key];
        }
      });


      const updatedSubmission = await submission.save();
      return res.status(200).json({ success: true, data: updatedSubmission });
    } catch (err) {
      console.error(`Error updating waiver submission ID ${id}:`, err);
      const msg = formatMongooseError(err);
      return res.status(400).json({ success: false, error: msg });
    }
  },

  /**
   * Cancel or Close a Waiver Submission by its ID (Soft Delete).
   * Changes the stage to 'closed' or 'cancelled'.
   */
  async removeOrCancel(req, res) {
    const { id } = req.params;
     if (!mongoose.Types.ObjectId.isValid(id)) { // Moved validation here
      return res.status(400).json({ success: false, error: 'Invalid Submission ID format.' });
    }
    try {
      const submission = await WaiverSubmission.findById(id);
      if (!submission) {
        return res.status(404).json({ success: false, error: 'Waiver Submission not found.' });
      }

      if (submission.stage === 'closed' || submission.stage === 'cancelled') {
        return res.status(200).json({ success: true, message: 'Submission is already closed or cancelled.', data: submission });
      }

      submission.stage = 'closed'; // Or 'cancelled'
      if (req.user && req.user._id) {
        submission.changed_by_user_id_for_stage_change = req.user._id;
      } else {
         console.warn(`Attempting to cancel submission ${id} without an identified user.`);
      }

      const updatedSubmission = await submission.save();
      return res.status(200).json({ success: true, message: 'Waiver Submission has been closed/cancelled.', data: updatedSubmission });
    } catch (err) {
      console.error(`Error cancelling/closing waiver submission ID ${id}:`, err);
      const msg = formatMongooseError(err);
      return res.status(500).json({ success: false, error: msg });
    }
  },

  /**
   * List Waiver Submissions for a specific Waiver Scheme.
   */
  async listByScheme(req, res) {
    const { schemeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(schemeId)) {
      return res.status(400).json({ success: false, error: 'Invalid Waiver Scheme ID format.' });
    }
    try {
      const submissions = await WaiverSubmission.find({ waiver_scheme_id: schemeId })
        .populate('user_id', 'name email')
        .sort({ created_at: -1 })
        .lean();
      return res.status(200).json({ success: true, data: submissions });
    } catch (err) {
      console.error(`Error listing submissions for scheme ID ${schemeId}:`, err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve submissions for the scheme.' });
    }
  },

  /**
   * (Example) List Waiver Submissions for the authenticated user.
   */
  async listByUser(req, res) {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, error: 'User not authenticated.' });
    }
    try {
      const submissions = await WaiverSubmission.find({ user_id: req.user._id })
        .populate('waiver_scheme_id', 'title')
        .sort({ created_at: -1 })
        .lean();
      return res.status(200).json({ success: true, data: submissions });
    } catch (err) {
      console.error(`Error listing submissions for user ID ${req.user._id}:`, err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve your submissions.' });
    }
  },
};
