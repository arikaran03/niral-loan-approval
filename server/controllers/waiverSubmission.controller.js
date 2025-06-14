// src/controllers/waiverSubmission.controller.js
import WaiverSubmission from "../database/models/WaiverSubmissionModel.js"; // Adjust path as needed
import WaiverScheme from "../database/models/WaiverScheme.js"; // Adjust path as needed
// import GovDocumentDefinitionModel from '../models/GovDocumentDefinitionModel.js'; // If needed for doc defs in submission details
import mongoose from "mongoose";
import LoanRepayment from "../database/models/LoanRepaymentModel.js"; // If needed for loan repayment logic
import { sendConfiguredEmail } from "../functions/communicate.js"; // Adjust path as needed

const handleError = (res, error, message) => {
  console.error(message, error);
  const errorMessage = error.message || "An unexpected error occurred.";
  res.status(500).json({
    success: false,
    message: errorMessage,
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

/**
 * Helper to format Mongoose validation errors.
 */
function formatMongooseError(err) {
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return messages.join("; ");
  }
  return err.message || "Server error";
}

// NEW: Helper function to generate dynamic email content for stage changes
const generateWaiverStageChangeEmailHTML = (
  applicantName,
  schemeTitle,
  newStage,
  notes
) => {
  let subject = "";
  let headline = "";
  let body = "";

  switch (newStage) {
    case "approved":
      subject = `✅ Your Waiver Application for "${schemeTitle}" has been Approved!`;
      headline = "Congratulations! Your waiver has been approved.";
      body = `<p>Your application for the waiver scheme has been successfully processed and approved. The relevant waivers have now been applied to your loan account's pending installments.</p><p>No further action is required from your end regarding this waiver.</p>`;
      break;
    case "rejected":
      subject = `❌ Update on your Waiver Application for "${schemeTitle}"`;
      headline = "Update on Your Waiver Application";
      body = `<p>We have reviewed your application for the waiver scheme and regret to inform you that it has been rejected at this time.</p>`;
      if (notes) {
        body += `<p><strong>Reason Provided:</strong> ${notes}</p>`;
      }
      body += `<p>If you have any questions, please contact our support team.</p>`;
      break;
    case "pending_review":
      subject = `⏳ Your Waiver Application for "${schemeTitle}" is Under Review`;
      headline = "Your Application is Being Reviewed";
      body = `<p>Thank you for your submission. Your application for the waiver scheme is now being reviewed by our team. We will notify you once a decision has been made.</p>`;
      break;
    default: // For 'draft' or other cases
      subject = `Update on your Waiver Application for "${schemeTitle}"`;
      headline = "Your Waiver Application has been updated";
      body = `<p>The status of your application has been updated to '${newStage}'. You can log in to your portal to view the details.</p>`;
  }

  return {
    subject,
    htmlBody: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2>${headline}</h2>
              <p>Dear ${applicantName},</p>
              ${body}
              <hr style="border: none; border-top: 1px solid #eee;">
              <p>Thank you,<br>The Support Team</p>
            </div>
        `,
  };
};

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
        stage = "draft", // Default to 'draft' if not provided, though payload shows 'pending_review'
      } = req.body;

      let userIdFromAuth;
      if (req.user && req.user._id) {
        userIdFromAuth = req.user._id;
      } else if (
        req.body.user_id &&
        mongoose.Types.ObjectId.isValid(req.body.user_id)
      ) {
        // Fallback if user_id is in body (e.g. for system-to-system or specific admin actions)
        // Ensure proper authorization if using this fallback.
        userIdFromAuth = req.body.user_id;
        console.warn(
          "WaiverSubmission create: user_id taken from req.body. Ensure this is an authorized action."
        );
      } else {
        return res.status(401).json({
          success: false,
          error:
            "User ID is required and not found in authenticated session or request body.",
        });
      }

      if (
        !waiver_scheme_id ||
        !mongoose.Types.ObjectId.isValid(waiver_scheme_id)
      ) {
        return res.status(400).json({
          success: false,
          error: "Valid Waiver Scheme ID is required.",
        });
      }

      const scheme = await WaiverScheme.findById(waiver_scheme_id);
      if (!scheme) {
        return res.status(404).json({
          success: false,
          error: "Associated Waiver Scheme not found.",
        });
      }
      if (scheme.status !== "published") {
        return res.status(400).json({
          success: false,
          error:
            "Applications can only be submitted for published waiver schemes.",
        });
      }
      const now = new Date();
      if (
        now < new Date(scheme.application_start_date) ||
        now > new Date(scheme.application_end_date)
      ) {
        return res.status(400).json({
          success: false,
          error: "Waiver scheme is not currently active for submissions.",
        });
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

      if (submissionData.stage && submissionData.stage !== "draft") {
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
      if (
        waiver_scheme_id &&
        mongoose.Types.ObjectId.isValid(waiver_scheme_id)
      ) {
        query.waiver_scheme_id = waiver_scheme_id;
      }
      // If user_id is provided in query, use it. Otherwise, if admin, show all. If user, show their own.
      if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
        query.user_id = user_id;
      } else if (req.user && !req.user.isAdmin) {
        // Example: Check if user is not admin
        query.user_id = req.user._id;
      }

      const submissions = await WaiverSubmission.find(query)
        .populate("waiver_scheme_id", "title waiver_type")
        .populate("user_id", "name email")
        .sort({ created_at: -1 })
        .lean();
      return res.status(200).json({ success: true, data: submissions });
    } catch (err) {
      console.error("Error listing waiver submissions:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve waiver submissions.",
      });
    }
  },

  /**
   * Get a single Waiver Submission by its ID.
   * Populates related WaiverScheme details.
   */
  async getById(req, res) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      // Moved validation here from routes for consistency
      return res
        .status(400)
        .json({ success: false, error: "Invalid Submission ID format." });
    }
    try {
      const submission = await WaiverSubmission.findById(id)
        .populate("waiver_scheme_id")
        .populate("user_id", "name email username")
        .populate("reviewer_id", "name email username")
        .populate("requiredDocumentRefs.fileRef")
        .populate("annexureDocumentRef")
        .populate({
          path: "fields.fileRef",
          model: "File",
        })
        .lean();

      if (!submission) {
        return res
          .status(404)
          .json({ success: false, error: "Waiver Submission not found." });
      }
      return res.status(200).json({ success: true, data: submission });
    } catch (err) {
      console.error(`Error fetching waiver submission by ID ${id}:`, err);
      return res.status(500).json({
        success: false,
        error: "An error occurred while fetching the submission details.",
      });
    }
  },

  /**
   * Update a Waiver Submission by its ID.
   * Typically used by admins to change stage, add review notes, etc.
   */
  async update(req, res) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      // Moved validation here
      return res
        .status(400)
        .json({ success: false, error: "Invalid Submission ID format." });
    }
    const updateData = { ...req.body };

    try {
      const submission = await WaiverSubmission.findById(id);
      if (!submission) {
        return res
          .status(404)
          .json({ success: false, error: "Waiver Submission not found." });
      }

      if (updateData.stage && updateData.stage !== submission.stage) {
        if (!req.user || !req.user._id) {
          return res.status(401).json({
            success: false,
            error: "User not authenticated for updating submission stage.",
          });
        }
        submission.changed_by_user_id_for_stage_change = req.user._id;
        if (["approved", "rejected"].includes(updateData.stage)) {
          // Ensure updateData.reviewer_id is not accidentally passed from client for these fields
          submission.reviewer_id = req.user._id;
          submission.review_date = new Date();
        }
      }

      // Explicitly set fields to avoid unintended updates from req.body spread
      const allowedUpdates = [
        "stage",
        "fields",
        "requiredDocumentRefs",
        "aadhaar_data",
        "pan_data",
        "isFaceVerified",
        "isOtpVerified",
        "annexureDocumentRef",
        "rejection_reason",
        "application_notes", // Add other fields admins can update
      ];

      allowedUpdates.forEach((key) => {
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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      // Moved validation here
      return res
        .status(400)
        .json({ success: false, error: "Invalid Submission ID format." });
    }
    try {
      const submission = await WaiverSubmission.findById(id);
      if (!submission) {
        return res
          .status(404)
          .json({ success: false, error: "Waiver Submission not found." });
      }

      if (submission.stage === "closed" || submission.stage === "cancelled") {
        return res.status(200).json({
          success: true,
          message: "Submission is already closed or cancelled.",
          data: submission,
        });
      }

      submission.stage = "closed"; // Or 'cancelled'
      if (req.user && req.user._id) {
        submission.changed_by_user_id_for_stage_change = req.user._id;
      } else {
        console.warn(
          `Attempting to cancel submission ${id} without an identified user.`
        );
      }

      const updatedSubmission = await submission.save();
      return res.status(200).json({
        success: true,
        message: "Waiver Submission has been closed/cancelled.",
        data: updatedSubmission,
      });
    } catch (err) {
      console.error(
        `Error cancelling/closing waiver submission ID ${id}:`,
        err
      );
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
      return res
        .status(400)
        .json({ success: false, error: "Invalid Waiver Scheme ID format." });
    }
    try {
      const submissions = await WaiverSubmission.find({
        waiver_scheme_id: schemeId,
      })
        .populate("user_id", "name email")
        .sort({ created_at: -1 })
        .lean();
      return res.status(200).json({ success: true, data: submissions });
    } catch (err) {
      console.error(
        `Error listing submissions for scheme ID ${schemeId}:`,
        err
      );
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve submissions for the scheme.",
      });
    }
  },

  /**
   * (Example) List Waiver Submissions for the authenticated user.
   */
  async listByUser(req, res) {
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ success: false, error: "User not authenticated." });
    }
    try {
      const submissions = await WaiverSubmission.find({ user_id: req.user._id })
        .populate("waiver_scheme_id", "title")
        .sort({ created_at: -1 })
        .lean();
      return res.status(200).json({ success: true, data: submissions });
    } catch (err) {
      console.error(
        `Error listing submissions for user ID ${req.user._id}:`,
        err
      );
      return res.status(500).json({
        success: false,
        error: "Failed to retrieve your submissions.",
      });
    }
  },

  /**
   * Updates the stage of a waiver submission.
   * This single function handles all stage transitions, including the logic for 'approved'.
   * @param {string} req.params.submissionId - The ID of the waiver submission.
   * @param {string} req.body.stage - The new stage: 'draft', 'pending_review', 'approved', 'rejected'.
   * @param {string} [req.body.notes] - Optional notes from the admin.
   */
  updateWaiverSubmissionStage: async (req, res) => {
    const { submissionId } = req.params;
    const { stage: newStage, notes: adminNotes } = req.body;
    const adminUserId = req.user._id;

    // 1. Validation
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Submission ID format." });
    }
    const allowedStages = ["draft", "pending_review", "approved", "rejected"];
    if (!allowedStages.includes(newStage)) {
      return res
        .status(400)
        .json({ success: false, message: `Invalid stage.` });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const submission = await WaiverSubmission.findById(submissionId)
        .populate("user_id", "name email")
        .populate(
          "waiver_scheme_id",
          "title waiver_type applicable_on waiver_value"
        )
        .session(session);

      if (!submission) throw new Error("Waiver submission not found.");
      if (submission.stage === newStage)
        throw new Error(
          `Waiver submission is already in the '${newStage}' stage.`
        );

      // 2. Main Logic - Update submission fields directly
      submission.stage = newStage;
      submission.processed_by = adminUserId;
      submission.processed_at = new Date();

      // FIX: Handle notes and history correctly within the controller
      if (adminNotes) {
        if (newStage === "rejected") {
          submission.rejection_reason = adminNotes;
        }
        submission.application_notes =
          (submission.application_notes
            ? `${submission.application_notes}\n\n`
            : "") + `Admin Note (${newStage}): ${adminNotes}`;
      }

      // Add a new, accurate entry to the history array
      submission.history.push({
        stage: newStage,
        changed_by: adminUserId, // Correctly logs the admin's ID
        changed_at: new Date(),
        comment: adminNotes || `Stage changed to ${newStage} by admin.`, // Add the notes as a comment
      });

      // 3. Conditional logic for the 'approved' stage
      if (newStage === "approved") {
        const scheme = submission.waiver_scheme_id; // Already populated
        if (
          scheme.waiver_type !== "percentage" ||
          scheme.applicable_on !== "interest_due"
        ) {
          throw new Error(
            `Scheme logic mismatch: Not a percentage waiver on interest.`
          );
        }

        var query = {
          user_id: submission.user_id._id
        };
        if (req.user.type.includes('applicant', 'user')) {
          query.user_id = req.user._id;
        }

        const loanRepayment = await LoanRepayment.findOne(query).session(session);
        if (!loanRepayment)
          throw new Error("Target loan repayment record not found.");

        let totalWaivedForThisEvent = 0;
        const waiverPercentage = scheme.waiver_value / 100;

        loanRepayment.scheduled_installments.forEach((installment) => {
          if (installment.status === "Pending") {
            const interestToWaive = installment.interest_due * waiverPercentage;
            installment.interest_waived =
              (installment.interest_waived || 0) + interestToWaive;
            totalWaivedForThisEvent += interestToWaive;
          }
        });

        if (totalWaivedForThisEvent > 0) {
          loanRepayment.total_interest_waived += totalWaivedForThisEvent;
          loanRepayment.internal_notes.push({
            text: `Waiver approved via submission ${
              submission._id
            }. A total of ${formatCurrency(
              totalWaivedForThisEvent
            )} in interest was waived by admin ${adminUserId}.`,
            added_by: adminUserId,
          });
        }
        await loanRepayment.save({ session });
      }

      const updatedSubmission = await submission.save({ session });

      // 4. Send email notification
      try {
        const { subject, htmlBody } = generateWaiverStageChangeEmailHTML(
          submission.user_id.name,
          submission.waiver_scheme_id.title,
          newStage,
          adminNotes
        );
        await sendConfiguredEmail({
          to: submission.user_id.email,
          subject,
          htmlBody,
        });
      } catch (emailError) {
        console.error(
          `Email notification failed for submission ${submissionId}, but the stage change was successful.`,
          emailError
        );
      }

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({
        success: true,
        message: `Waiver submission stage successfully updated to '${newStage}'.`,
        data: updatedSubmission,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      handleError(
        res,
        error,
        `An error occurred while updating the waiver stage.`
      );
    }
  },

  getSubmissionById: async (req, res) => {
    const { submissionId } = req.params;

    console.log(`Fetching waiver submission details for ID: ${submissionId}`);

    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Submission ID format." });
    }

    try {
      const submission = await WaiverSubmission.findById(submissionId)
        .populate({
          path: "user_id",
          select: "name email phone account_number",
        })
        .populate({
          path: "waiver_scheme_id", // Populate the full scheme details
        })
        .populate({
          path: "history.changed_by",
          select: "name type",
        })
        .lean(); // Use .lean() for faster, plain JS object results

      if (!submission) {
        return res
          .status(404)
          .json({ success: false, message: "Waiver Submission not found." });
      }

      // You can add more populated data here if needed, like file details from 'fileRef'

      return res.json({ success: true, data: submission });
    } catch (error) {
      handleError(
        res,
        error,
        `An error occurred while fetching waiver submission ${submissionId}`
      );
    }
  },

    searchSubmissions: async (req, res) => {
    try {
      const {
        stage,
        waiver_scheme_id,
        user_id,
        applicantIdentifier, // Can be user's name or email
        startDate,
        endDate,
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query;

      const query = {};

      // Build the query object dynamically based on provided filters
      if (stage) query.stage = stage;
      if (waiver_scheme_id && mongoose.Types.ObjectId.isValid(waiver_scheme_id)) {
        query.waiver_scheme_id = waiver_scheme_id;
      }
      if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
        query.user_id = user_id;
      }

      // Handle date range filtering on the submission creation date
      if (startDate || endDate) {
        query.created_at = {};
        if (startDate) query.created_at.$gte = new Date(startDate);
        if (endDate) {
            let toDate = new Date(endDate);
            toDate.setHours(23, 59, 59, 999); // Include the whole end day
            query.created_at.$lte = toDate;
        }
      }

      // Advanced: Handle search by applicant name or email
      if (applicantIdentifier) {
        // This requires querying the User model first
        const userQuery = {
            $or: [
                { name: { $regex: applicantIdentifier, $options: 'i' } },
                { email: { $regex: applicantIdentifier, $options: 'i' } }
            ]
        };
        // We import the User model directly here for the search
        const User = mongoose.model('User'); 
        const matchingUsers = await User.find(userQuery).select('_id').lean();
        
        if (matchingUsers.length > 0) {
            const userIds = matchingUsers.map(u => u._id);
            // If user_id is already in query, this might conflict.
            // A real-world app might prioritize one or merge them. Here we overwrite.
            query.user_id = { $in: userIds };
        } else {
            // If no users match, no submissions will match. Return empty.
            return res.status(200).json({ success: true, data: [], pagination: { totalRecords: 0, totalPages: 0, currentPage: 1 } });
        }
      }

      const sortOptions = {};
      const validSortFields = ['created_at', 'updated_at', 'stage'];
      if (validSortFields.includes(sortBy)) {
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      } else {
        sortOptions['created_at'] = -1; // Default sort
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const submissions = await WaiverSubmission.find(query)
        .populate({ path: "user_id", select: "name email" })
        .populate({ path: "waiver_scheme_id", select: "title" })
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      
      const totalRecords = await WaiverSubmission.countDocuments(query);

      res.status(200).json({
        success: true,
        data: submissions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalRecords / parseInt(limit)),
          totalRecords,
          limit: parseInt(limit),
        },
      });
    } catch (error) {
      handleError(res, error, "Failed to search waiver submissions.");
    }
  },
};
