// src/controllers/loan.controller.js
import Loan from '../database/models/LoanModel.js';
import GovDocumentDefinitionModel from '../database/models/GovDocumentDefinitionModel.js'; // Adjust path as needed
import { randomUUID } from 'crypto';
import mongoose from 'mongoose'; 

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
  async create(req, res, next) {
    // Ensure req.user and req.user._id exist from an authentication middleware
    if (!req.user || !req.user._id) {
        return res.status(401).json({ error: 'User not authenticated for creating a loan.' });
    }
    req.body.created_by = req.user._id;

    // Ensure fields have necessary properties, especially if they are optional in the request
    req.body.fields = (req.body.fields || []).map((field) => ({
      field_id: randomUUID(), // Generate new UUID for field_id
      created_at: new Date(),
      updated_at: new Date(),
      key: field.key || '', 
      label: field.label || '', 
      prompt: field.prompt || '',
      type: field.type || 'text', 
      required: field.required || false,
      options: field.options || [],
      min_value: field.min_value || '', 
      max_value: field.max_value || '', 
      is_unique_identifier: field.is_unique_identifier || false,
      unique_identifier_prompt: field.unique_identifier_prompt || '',
      auto_fill_sources: field.auto_fill_sources || [],
      // Add other default properties for a field definition as per your LoanModel schema
    }));

    try {
      const loan = await Loan.create(req.body);
      return res.status(201).json({ loan });
    } catch (err) {
      console.error("Error creating loan:", err);
      const msg = formatMongooseError(err);
      return res.status(400).json({ error: msg });
    }
  },

  async list(req, res, next) {
    try {
      const loans = await Loan.find().lean(); 
      return res.json(loans);
    } catch (err) {
      console.error("Error listing loans:", err);
      return res.status(500).json({ error: 'Failed to retrieve loans.' });
    }
  },

  async getById(req, res, next) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid loan ID format.' });
    }
    try {
      const loan = await Loan.findById(id).lean(); 

      if (!loan) {
        return res.status(404).json({ error: 'Loan not found.' });
      }

      // --- Logic to fetch and attach document_definitions ---
      const otherDocSchemaIdsToFetch = new Set();

      // 1. Collect schema_ids from loan.required_documents (excluding Aadhaar/PAN)
      // 'name' field in required_documents holds the schema_id (e.g., "driving_license")
      if (loan.required_documents && Array.isArray(loan.required_documents)) {
        loan.required_documents.forEach(doc => {
          if (doc && doc.name && doc.name !== 'aadhaar_card' && doc.name !== 'pan_card') {
            otherDocSchemaIdsToFetch.add(doc.name);
          }
        });
      }

      // 2. Collect schema_ids from loan.fields.auto_fill_sources (excluding Aadhaar/PAN)
      if (loan.fields && Array.isArray(loan.fields)) {
        loan.fields.forEach(field => {
          if (field.auto_fill_sources && Array.isArray(field.auto_fill_sources)) {
            field.auto_fill_sources.forEach(sourceString => {
              if (typeof sourceString === 'string') {
                const docKey = sourceString.split('.')[0];
                if (docKey && docKey !== 'aadhaar_card' && docKey !== 'pan_card') {
                  otherDocSchemaIdsToFetch.add(docKey);
                }
              }
            });
          }
        });
      }
      
      // Initialize document_definitions for other docs
      loan.document_definitions = {}; 
      const uniqueOtherDocSchemaIds = Array.from(otherDocSchemaIdsToFetch);

      if (uniqueOtherDocSchemaIds.length > 0) {
        // Fetch definitions using schema_id field from GovDocumentDefinitionModel
        const otherDocDefsFromDB = await GovDocumentDefinitionModel.find({ 
          schema_id: { $in: uniqueOtherDocSchemaIds } 
        }).lean();

        otherDocDefsFromDB.forEach(def => {
          if (def && def.schema_id) {
            // Use schema_id as the key for the frontend
            loan.document_definitions[def.schema_id] = def;
          }
        });
      }
      
      // 3. Fetch and attach aadhaar_card and pan_card definitions separately
      const aadhaarDef = await GovDocumentDefinitionModel.findOne({ schema_id: 'aadhaar_card' }).lean();
      const panDef = await GovDocumentDefinitionModel.findOne({ schema_id: 'pan_card' }).lean();

      if (aadhaarDef) {
        loan.aadhaar_card_definition = aadhaarDef;
        // Also ensure it's in the main document_definitions, keyed by its schema_id
        if (!loan.document_definitions.aadhaar_card) { // Check using the schema_id string
             loan.document_definitions.aadhaar_card = aadhaarDef;
        }
      } else {
        loan.aadhaar_card_definition = null; 
        console.warn("Aadhaar card definition (schema_id: 'aadhaar_card') not found in GovDocumentDefinitionModel.");
      }

      if (panDef) {
        loan.pan_card_definition = panDef;
        // Also ensure it's in the main document_definitions, keyed by its schema_id
        if (!loan.document_definitions.pan_card) { // Check using the schema_id string
            loan.document_definitions.pan_card = panDef;
        }
      } else {
        loan.pan_card_definition = null; 
        console.warn("PAN card definition (schema_id: 'pan_card') not found in GovDocumentDefinitionModel.");
      }
      // --- End of logic ---

      return res.json(loan);
    } catch (err) {
      console.error(`Error fetching loan by ID ${id}:`, err);
      return res.status(500).json({ error: 'An error occurred while fetching the loan details.' });
    }
  },

  async update(req, res, next) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid loan ID format.' });
    }
    
    // Add updated_at timestamp automatically by Mongoose or manually:
    // req.body.updated_at = new Date(); 

    try {
      const loan = await Loan.findByIdAndUpdate(id, req.body, {
        new: true, 
        runValidators: true, 
      });
      if (!loan) {
        return res.status(404).json({ error: 'Loan not found.' });
      }
      // If returning updated loan, and frontend expects definitions, repeat the getById logic for definitions
      // For now, just returning the updated loan document.
      return res.json(loan);
    } catch (err) {
      console.error(`Error updating loan ID ${id}:`, err);
      const msg = formatMongooseError(err);
      return res.status(400).json({ error: msg });
    }
  },

  async remove(req, res, next) {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid loan ID format.' });
    }
    try {
      const result = await Loan.findByIdAndDelete(id);
      if (!result) {
        return res.status(404).json({ error: 'Loan not found.' });
      }
      return res.status(204).send(); 
    } catch (err) {
      console.error(`Error removing loan ID ${id}:`, err);
      return res.status(500).json({ error: 'An error occurred while removing the loan.' });
    }
  },
};
