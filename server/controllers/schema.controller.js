// controllers/schema.controller.js (or your actual file path)
import mongoose from "mongoose";
import GovDocumentDefinitionModel from "../database/models/GovDocumentDefinitionModel.js"; 
import GovDocumentSubmissionModel from "../database/models/GovDocumentSubmissionModel.js"; 
import FileModel from "../database/models/FileModel.js"; 

// --- Controller function to handle creating a new Schema Definition ---
export const createSchemaDefinition = async (req, res) => {
  console.log(
    "Received POST request for /api/document/schema-definition (in controller)"
  );
  const { schema_id, name, description, fields } = req.body;

  if (
    !schema_id ||
    !name ||
    !description ||
    !fields ||
    !Array.isArray(fields)
  ) {
    return res.status(400).json({
      message:
        "Missing required fields: schema_id, name, description, or fields array.",
    });
  }

  const fieldValidationErrors = [];
  for (const field of fields) {
    if (!field.key || !field.label || !field.prompt || !field.type) {
      fieldValidationErrors.push(
        `Field "${
          field.label || field.key || "Unknown field"
        }" is missing one or more required properties (key, label, prompt, type).`
      );
    }
    const applicableTypesForMinMax = ["text", "textarea", "number", "date", "datetime", "time"];
    if (applicableTypesForMinMax.includes(field.type)) {
        if (field.min_value === undefined || field.min_value === null || String(field.min_value).trim() === '') {
             fieldValidationErrors.push(`Field "${field.label || field.key}" requires a non-empty min_value.`);
        }
        if (field.max_value === undefined || field.max_value === null || String(field.max_value).trim() === '') {
             fieldValidationErrors.push(`Field "${field.label || field.key}" requires a non-empty max_value.`);
        }
    }

    if (
      (field.type === "select" || field.type === "multiselect") &&
      (!field.options ||
        !Array.isArray(field.options) ||
        field.options.length === 0)
    ) {
      fieldValidationErrors.push(
        `Field "${field.label}" (key: ${field.key}) requires a non-empty options array for type "${field.type}".`
      );
    }

    if (field.is_unique_identifier === true) {
        if (field.type !== "text") {
            fieldValidationErrors.push(`Field "${field.label}" is marked as a unique identifier but is not of type 'text'.`);
        }
        if (field.required !== true) {
            fieldValidationErrors.push(`Field "${field.label}" is marked as a unique identifier and therefore must be 'required'.`);
        }
        if (!field.unique_identifier_prompt || String(field.unique_identifier_prompt).trim() === "") {
            fieldValidationErrors.push(`Field "${field.label}" is marked as a unique identifier and requires a non-empty 'unique_identifier_prompt'.`);
        }
    }
  }

  if (fieldValidationErrors.length > 0) {
    return res.status(400).json({
      message: "Validation errors in field definitions.",
      errors: fieldValidationErrors,
    });
  }

  try {
    const newSchemaDefinition = new GovDocumentDefinitionModel({
      schema_id: schema_id.trim(),
      name: name.trim(),
      description: description.trim(),
      fields: fields.map((field) => ({
        key: field.key.trim(),
        label: field.label.trim(),
        prompt: field.prompt.trim(),
        type: field.type,
        required: field.required || false,
        options: field.options,
        min_value: field.min_value !== undefined ? String(field.min_value).trim() : undefined,
        max_value: field.max_value !== undefined ? String(field.max_value).trim() : undefined,
        is_unique_identifier: field.is_unique_identifier || false,
        unique_identifier_prompt: field.is_unique_identifier ? (String(field.unique_identifier_prompt || '').trim() || field.prompt) : undefined,
      })),
    });

    const savedSchemaDefinition = await newSchemaDefinition.save(); 

    res.status(201).json({
      message: "Schema definition created successfully!",
      schemaDefinition: savedSchemaDefinition,
    });
  } catch (error) {
    console.error("Error saving schema definition:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Validation failed", errors: messages });
    }
    if (error.code === 11000) { 
      const field = Object.keys(error.keyPattern)[0];
      return res
        .status(409)
        .json({ message: `Schema definition with this '${field}' already exists: ${error.keyValue[field]}` });
    }
    res.status(500).json({
      message: "An error occurred while saving the schema definition.",
      error: error.message,
    });
  }
};

export const getAllSchemaDefinitions = async (req, res) => {
  try {
    const schemas = await GovDocumentDefinitionModel.find(
      {},
      "_id schema_id name description" 
    ).sort({ name: 1 }); 
    res.status(200).json(schemas);
  } catch (error) {
    console.error("Error fetching schema definitions:", error);
    res.status(500).json({
      message: "An error occurred while fetching schema definitions.",
      error: error.message,
    });
  }
};

export const getSchemaDefinitionById = async (req, res) => {
  const objectId = req.params.id; // Use .id as defined in the route
  
  if (!mongoose.Types.ObjectId.isValid(objectId)) {
    return res.status(400).json({ message: "Invalid schema definition ID format." });
  }

  try {
    const schemaDefinition = await GovDocumentDefinitionModel.findById(objectId);
    if (!schemaDefinition) {
      return res.status(404).json({ message: "Schema definition not found with the given Object ID." });
    }
    res.status(200).json(schemaDefinition);
  } catch (error) {
    console.error(`Error fetching schema definition for ID ${objectId}:`, error);
    res.status(500).json({
      message: "An error occurred while fetching the schema definition by Object ID.",
      error: error.message,
    });
  }
};

// --- NEW CONTROLLER FUNCTION ---
export const getSchemaDefinitionBySchemaIdString = async (req, res) => {
  const schemaIdString = req.params.schema_id_string;
  console.log(`Attempting to fetch schema by string ID: ${schemaIdString}`); // For debugging

  if (!schemaIdString || typeof schemaIdString !== 'string' || schemaIdString.trim() === '') {
    return res.status(400).json({ message: "Invalid or missing schema_id_string parameter." });
  }

  try {
    // Find by the 'schema_id' field which stores strings like "aadhaar_card"
    const schemaDefinition = await GovDocumentDefinitionModel.findOne({ schema_id: schemaIdString.trim() });
    
    if (!schemaDefinition) {
      console.log(`Schema definition not found for schema_id: ${schemaIdString}`); // For debugging
      return res.status(404).json({ message: `Schema definition not found for schema_id '${schemaIdString}'.` });
    }
    console.log(`Schema definition found for schema_id '${schemaIdString}':`, schemaDefinition.name); // For debugging
    res.status(200).json(schemaDefinition);
  } catch (error) {
    console.error(`Error fetching schema definition for schema_id_string ${schemaIdString}:`, error);
    res.status(500).json({
      message: "An error occurred while fetching the schema definition by string schema_id.",
      error: error.message,
    });
  }
};


export const submitDocumentData = async (req, res) => {
  console.log("Received POST request for /api/document/submission");
  const { schema_definition_id, fieldsData } = req.body; 
  const user_id = req.user?._id; 
  const created_by = req.user?._id;

  if (!schema_definition_id || !user_id || !created_by || !fieldsData) {
    return res.status(400).json({
      message:
        "Missing required submission data (schema_definition_id, user_id, created_by, fieldsData).",
    });
  }
  if (!mongoose.Types.ObjectId.isValid(schema_definition_id)) {
      return res.status(400).json({ message: "Invalid schema_definition_id format." });
  }

  let parsedFieldsData;
  try {
    parsedFieldsData = JSON.parse(fieldsData);
    if (!Array.isArray(parsedFieldsData)) {
      throw new Error("fieldsData is not an array.");
    }
  } catch (parseError) {
    return res.status(400).json({ message: "Invalid format for fieldsData JSON string." });
  }

  try {
    const schemaDefinition = await GovDocumentDefinitionModel.findById(schema_definition_id);
    if (!schemaDefinition) {
        return res.status(404).json({ message: `Schema definition with ID ${schema_definition_id} not found.` });
    }

    const submissionFields = [];
    const uploadedFiles = req.files || {}; 

    for (const submittedFieldData of parsedFieldsData) {
      const definitionField = schemaDefinition.fields.find(f => f.key === submittedFieldData.field_id);
      
      if (!definitionField) {
        console.warn(`Submitted field_id "${submittedFieldData.field_id}" not found in schema definition "${schemaDefinition.name}". Skipping.`);
        continue; 
      }

      const currentField = {
        field_id: definitionField.key, 
        field_label: definitionField.label,
        type: definitionField.type,
      };

      if (definitionField.type === "image" || definitionField.type === "document") {
        const fileFromRequest = uploadedFiles[definitionField.key]; 

        if (fileFromRequest) {
          const newFile = new FileModel({
            data: fileFromRequest.buffer,
            contentType: fileFromRequest.mimetype,
            filename: fileFromRequest.originalname,
            size: fileFromRequest.size,
            uploadedBy: user_id,
            category: schemaDefinition.schema_id 
          });
          const savedFile = await newFile.save();
          currentField.fileRef = savedFile._id; 
          console.log(
            `File saved for field "${definitionField.label}". File ID: ${savedFile._id}`
          );

        } else if (definitionField.required) {
          return res.status(400).json({ message: `File for required field "${definitionField.label}" (key: ${definitionField.key}) is missing.` });
        } else {
          currentField.fileRef = null; 
        }
      } else {
        currentField.value = submittedFieldData.value;
        if (definitionField.required && (currentField.value === null || currentField.value === undefined || String(currentField.value).trim() === '')) {
            return res.status(400).json({ message: `Value for required field "${definitionField.label}" (key: ${definitionField.key}) is missing.` });
        }
      }
      submissionFields.push(currentField);
    }

    const newSubmission = new GovDocumentSubmissionModel({
      schema_id: schema_definition_id, 
      user_id: user_id, 
      created_by: created_by, 
      fields: submissionFields, 
    });

    const savedSubmission = await newSubmission.save(); 

    console.log("Document Submission saved successfully:", savedSubmission._id);
    res.status(201).json({
      message: "Document data submitted successfully!",
      submissionId: savedSubmission._id, 
    });
  } catch (error) {
    console.error("Error submitting document data:", error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Submission validation failed", errors: messages });
    }
    res.status(500).json({
      message: "An error occurred while submitting document data.",
      error: error.message,
    });
  }
};

export const checkDocumentUniqueness = async (req, res) => {
  console.log("Received POST request for /api/document/check-unique");
  const { schema_definition_id, identifiers_to_check } = req.body;

  if (!schema_definition_id || !mongoose.Types.ObjectId.isValid(schema_definition_id)) {
    return res.status(400).json({ message: "Valid schema_definition_id is required." });
  }
  if (!Array.isArray(identifiers_to_check) || identifiers_to_check.length === 0) {
    return res.status(400).json({ message: "identifiers_to_check must be a non-empty array." });
  }

  try {
    const foundKeys = [];
    for (const identifier of identifiers_to_check) {
      if (!identifier.key || !identifier.value || String(identifier.value).trim() === '') {
        console.warn("Skipping invalid identifier in check:", identifier);
        continue; 
      }

      const existingSubmission = await GovDocumentSubmissionModel.findOne({
        schema_id: schema_definition_id, 
        "submitted_unique_identifiers.key": identifier.key,
        "submitted_unique_identifiers.value": String(identifier.value).trim(),
      });

      if (existingSubmission) {
        foundKeys.push(existingSubmission);
      }
    }

    if (foundKeys.length > 0) {
      return res.status(200).json({
        message: "One or more unique identifiers match existing submissions.",
        matched_keys: foundKeys, 
        exists: true
      });
    } else {
      return res.status(200).json({
        message: "No existing submissions found for the provided unique identifiers.",
        matched_keys: [],
        exists: false
      });
    }
  } catch (error) {
    console.error("Error checking document uniqueness:", error);
    res.status(500).json({
      message: "An error occurred while checking document uniqueness.",
      error: error.message,
    });
  }
};
