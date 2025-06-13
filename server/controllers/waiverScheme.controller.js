// src/controllers/admin/waiverScheme.controller.js
import WaiverScheme from '../database/models/WaiverScheme.js'
import GovDocumentDefinitionModel from '../database/models/GovDocumentDefinitionModel.js'; // Adjust path as needed
import mongoose, { get } from 'mongoose';
import LoanSubmissionModel from '../database/models/LoanSubmissionModel.js';
import WaiverSubmissionModel from '../database/models/WaiverSubmissionModel.js';
// import { randomUUID } from 'crypto'; // Not used if field_id is handled by frontend

/**
 * Helper to format Mongoose validation errors into a single string.
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
   * Create a new Waiver Scheme.
   * Expects waiver scheme data in req.body.
   * created_by will be set if req.user is available.
   */
  async create(req, res) {
    try {
      const waiverSchemeData = { ...req.body };

      // Optional: Set created_by if user is authenticated
      // if (req.user && req.user._id) {
      //   waiverSchemeData.created_by = req.user._id; // Add created_by to your WaiverScheme model if needed
      // }

      // The WaiverSchemeFormBuilder should ideally send well-formed 'fields' array.
      // Unlike the loan controller example, we assume field_id is provided by the client
      // or handled by the model's defaults if any.
      // If specific processing for 'fields' is needed here (e.g., generating IDs), add it.
      // For example, if 'fields' need unique IDs generated server-side:
      // waiverSchemeData.fields = (waiverSchemeData.fields || []).map(field => ({
      //   ...field,
      //   field_id: field.field_id || randomUUID(), // Ensure field_id is present
      // }));

      const waiverScheme = await WaiverScheme.create(waiverSchemeData);
      return res.status(201).json(waiverScheme);
    } catch (err) {
      console.error("Error creating waiver scheme:", err);
      const msg = formatMongooseError(err);
      return res.status(400).json({ error: msg });
    }
  },

  /**
   * List all Waiver Schemes.
   * Supports optional query parameters for pagination and filtering (not implemented here).
   */
  async list(req, res) {
    try {
      // TODO: Implement pagination and filtering based on req.query if needed
      // const { status, page = 1, limit = 10 } = req.query;
      // const query = status ? { status } : {};
      const waiverSchemes = await WaiverScheme.find(/* query */)
        .sort({ created_at: -1 }) // Sort by newest first
        .lean(); // Use .lean() for faster queries if not modifying docs
      return res.json(waiverSchemes);
    } catch (err) {
      console.error("Error listing waiver schemes:", err);
      return res.status(500).json({ error: 'Failed to retrieve waiver schemes.' });
    }
  },

  /**
   * Get a single Waiver Scheme by its ID.
   * Attaches related document definitions (Aadhaar, PAN, others) for frontend use.
   */
  async getById(req, res) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid Waiver Scheme ID format.' });
    }
    try {
      const waiverScheme = await WaiverScheme.findOne({ _id: id, status: "published" }).lean();

      if (!waiverScheme) {
        return res.status(404).json({ error: 'Waiver Scheme not found.' });
      }

      const getExistigLoanSubmission = await LoanSubmissionModel.findOne({
        loan_id: waiverScheme.target_loan_id,
        stage: "paid_to_applicant",
        user_id: req.user._id
      }).lean();
      if (!getExistigLoanSubmission) {
        return res.status(404).json({ error: "You don't have access to apply for waivering without any existing loan pending repayments" });
      }

      const isAlreadyWaived = await WaiverSubmissionModel.findOne({
        waiver_scheme_id: id,
        user_id: req.user._id,
        stage: { $ne: "draft" }
      }).lean();

      if (isAlreadyWaived) {
        return res.status(400).json({ error: 'You have already applied for this waiver scheme.' });
      }

      // --- Logic to fetch and attach document_definitions ---
      // This is similar to the loan controller's logic
      const otherDocSchemaIdsToFetch = new Set();
      waiverScheme.document_definitions = {}; // Initialize

      // 1. Collect schema_ids from waiverScheme.required_documents
      // 'schema_id' field in required_documents holds the schema_id
      if (waiverScheme.required_documents && Array.isArray(waiverScheme.required_documents)) {
        waiverScheme.required_documents.forEach(doc => {
          if (doc && doc.schema_id && doc.schema_id !== 'aadhaar_card' && doc.schema_id !== 'pan_card') {
            otherDocSchemaIdsToFetch.add(doc.schema_id);
          }
        });
      }

      // 2. Collect schema_ids from waiverScheme.fields.auto_fill_sources
      if (waiverScheme.fields && Array.isArray(waiverScheme.fields)) {
        waiverScheme.fields.forEach(field => {
          if (field.auto_fill_sources && Array.isArray(field.auto_fill_sources)) {
            field.auto_fill_sources.forEach(sourceString => {
              if (typeof sourceString === 'string') {
                const docKey = sourceString.split('.')[0]; // e.g., "aadhaar_card" from "aadhaar_card.name"
                if (docKey && docKey !== 'aadhaar_card' && docKey !== 'pan_card') {
                  otherDocSchemaIdsToFetch.add(docKey);
                }
              }
            });
          }
        });
      }

      const uniqueOtherDocSchemaIds = Array.from(otherDocSchemaIdsToFetch);

      if (uniqueOtherDocSchemaIds.length > 0) {
        const otherDocDefsFromDB = await GovDocumentDefinitionModel.find({
          schema_id: { $in: uniqueOtherDocSchemaIds }
        }).lean();
        otherDocDefsFromDB.forEach(def => {
          if (def && def.schema_id) {
            waiverScheme.document_definitions[def.schema_id] = def;
          }
        });
      }

      // 3. Fetch and attach aadhaar_card and pan_card definitions separately
      // These are commonly needed for KYC irrespective of being explicitly in required_documents
      const aadhaarDef = await GovDocumentDefinitionModel.findOne({ schema_id: 'aadhaar_card' }).lean();
      const panDef = await GovDocumentDefinitionModel.findOne({ schema_id: 'pan_card' }).lean();

      if (aadhaarDef) {
        waiverScheme.aadhaar_card_definition = aadhaarDef;
        if (!waiverScheme.document_definitions.aadhaar_card) {
            waiverScheme.document_definitions.aadhaar_card = aadhaarDef;
        }
      } else {
        waiverScheme.aadhaar_card_definition = null;
        console.warn("Aadhaar card definition (schema_id: 'aadhaar_card') not found in GovDocumentDefinitionModel.");
      }

      if (panDef) {
        waiverScheme.pan_card_definition = panDef;
         if (!waiverScheme.document_definitions.pan_card) {
            waiverScheme.document_definitions.pan_card = panDef;
        }
      } else {
        waiverScheme.pan_card_definition = null;
        console.warn("PAN card definition (schema_id: 'pan_card') not found in GovDocumentDefinitionModel.");
      }
      // --- End of document_definitions logic ---

      return res.json(waiverScheme);
    } catch (err) {
      console.error(`Error fetching waiver scheme by ID ${id}:`, err);
      return res.status(500).json({ error: 'An error occurred while fetching the waiver scheme details.' });
    }
  },

  /**
   * Update an existing Waiver Scheme by its ID.
   * Expects update data in req.body.
   */
  async update(req, res) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid Waiver Scheme ID format.' });
    }

    // req.body should contain only the fields to be updated.
    // Mongoose pre-save hook will handle updated_at.
    // If specific fields like 'status' need special handling (e.g., audit trail for status change),
    // that logic could be added here or in a service layer.

    try {
      // FindByIdAndUpdate will run validators if `runValidators: true`
      // It also returns the modified document if `new: true`
      const updatedWaiverScheme = await WaiverScheme.findByIdAndUpdate(id, req.body, {
        new: true,          // Return the modified document rather than the original
        runValidators: true, // Ensure schema validations are run on update
      });

      if (!updatedWaiverScheme) {
        return res.status(404).json({ error: 'Waiver Scheme not found.' });
      }

      // If frontend expects document_definitions on update response,
      // you might need to re-fetch and attach them similar to getById.
      // For simplicity, returning the updated document directly.
      return res.json(updatedWaiverScheme);
    } catch (err) {
      console.error(`Error updating waiver scheme ID ${id}:`, err);
      const msg = formatMongooseError(err);
      return res.status(400).json({ error: msg });
    }
  },

  /**
   * Soft delete (archive) a Waiver Scheme by its ID.
   * Sets the status to 'archived'.
   */
  async remove(req, res) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid Waiver Scheme ID format.' });
    }
    try {
      const waiverScheme = await WaiverScheme.findById(id);
      if (!waiverScheme) {
        return res.status(404).json({ error: 'Waiver Scheme not found.' });
      }

      if (waiverScheme.status === 'archived') {
        return res.json({ message: 'Waiver Scheme is already archived.', waiverScheme });
      }

      waiverScheme.status = 'archived';
      // The pre-save hook in WaiverScheme model should handle updated_at
      const archivedScheme = await waiverScheme.save();

      return res.json({ message: 'Waiver Scheme archived successfully.', waiverScheme: archivedScheme });
    } catch (err) {
      console.error(`Error archiving waiver scheme ID ${id}:`, err);
      const msg = formatMongooseError(err); // Use formatMongooseError for consistency
      return res.status(500).json({ error: msg });
    }
  },
};
