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

  console.log("Request body:", req.body);

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


// --- Controller ---
export const submitDocumentData = async (req, res) => {
  console.log("Received POST request for /api/document/submission");
  // schema_id and fieldsData come from req.body because multer only processes files into req.files
  // and non-file fields into req.body if they are part of multipart/form-data
  const { schema_id: schema_definition_id } = req.body; 
  let { fieldsData } = req.body; // Keep as let if re-assigning after parse

  const user_id = req.user?._id; // From authentication middleware
  const created_by = req.user?._id; // From authentication middleware

  if (!schema_definition_id || !user_id || !created_by || !fieldsData) {
    console.error("Validation Error: Missing required top-level data.", { schema_definition_id, user_id, created_by, fieldsData_type: typeof fieldsData });
    return res.status(400).json({
      message:
        "Missing required submission data (schema_definition_id, fieldsData). User authentication also required.",
    });
  }
  if (!mongoose.Types.ObjectId.isValid(schema_definition_id)) {
      return res.status(400).json({ message: "Invalid schema_definition_id format." });
  }

  let parsedFieldsData;
  try {
    // Ensure fieldsData is a string before parsing, if it's already an object, this might not be needed
    // depending on how your frontend sends it and if any other middleware parsed it.
    // However, FormData typically sends all non-file fields as strings.
    if (typeof fieldsData === 'string') {
        parsedFieldsData = JSON.parse(fieldsData);
    } else if (typeof fieldsData === 'object' && fieldsData !== null) {
        // If it's already an object (e.g. from some other middleware, though unlikely with FormData directly)
        parsedFieldsData = fieldsData;
        console.warn("fieldsData was already an object. Ensure this is expected.");
    } else {
        throw new Error("fieldsData is not a string or object.");
    }

    if (!Array.isArray(parsedFieldsData)) {
      throw new Error("Parsed fieldsData is not an array.");
    }
  } catch (parseError) {
    console.error("Error parsing fieldsData JSON:", parseError, "Received fieldsData:", fieldsData);
    return res.status(400).json({ message: `Invalid format for fieldsData JSON string. Error: ${parseError.message}` });
  }

  try {
    const schemaDefinition = await GovDocumentDefinitionModel.findById(schema_definition_id);
    if (!schemaDefinition) {
        return res.status(404).json({ message: `Schema definition with ID ${schema_definition_id} not found.` });
    }

    const submissionFields = [];
    const uploadedFilesArray = req.files || []; // req.files will be an ARRAY when using upload.any()

    console.log(`Processing ${parsedFieldsData.length} fields from fieldsData.`);
    console.log(`Received ${uploadedFilesArray.length} files in req.files.`);
    // For debugging: log fieldnames of uploaded files
    // uploadedFilesArray.forEach(f => console.log(`File in req.files: fieldname='${f.fieldname}', originalname='${f.originalname}'`));


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
        // Find the file from the req.files array by its fieldname (which is field.key from frontend)
        const fileFromRequest = uploadedFilesArray.find(f => f.fieldname === definitionField.key); 

        if (fileFromRequest) {
          console.log(`Found file for field key "${definitionField.key}": ${fileFromRequest.originalname}`);
          const newFile = new FileModel({
            data: fileFromRequest.buffer, // multer.memoryStorage() provides buffer
            contentType: fileFromRequest.mimetype,
            filename: fileFromRequest.originalname,
            size: fileFromRequest.size,
            uploadedBy: user_id,
            // category could be schemaDefinition.name or schemaDefinition.schema_id for better organization
            category: schemaDefinition.schema_id 
          });
          const savedFile = await newFile.save();
          currentField.fileRef = savedFile._id; 
          console.log(
            `File saved for field "${definitionField.label}". File ID: ${savedFile._id}`
          );

        } else if (definitionField.required) {
          console.error(`File for required field "${definitionField.label}" (key: ${definitionField.key}) is missing from uploaded files.`);
          return res.status(400).json({ message: `File for required field "${definitionField.label}" (key: ${definitionField.key}) is missing.` });
        } else {
          console.log(`Optional file for field "${definitionField.label}" (key: ${definitionField.key}) not provided.`);
          currentField.fileRef = null; 
        }
      } else {
        // For non-file types, the value comes from the parsedFieldsData
        currentField.value = submittedFieldData.value;
        if (definitionField.required && (currentField.value === null || currentField.value === undefined || String(currentField.value).trim() === '')) {
            console.error(`Value for required field "${definitionField.label}" (key: ${definitionField.key}) is missing.`);
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
    if (error.name === "ValidationError") { // Mongoose validation error
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Submission validation failed", errors: messages });
    }
    res.status(500).json({
      message: "An error occurred while submitting document data.",
      error: error.message, // Send a more generic error in production
    });
  }
};


export const checkDocumentUniqueness = async (req, res) => {
  console.log("Received POST request for /api/document/check-unique");
  const { schema_definition_id, identifiers_to_check } = req.body;

  console.log(req.body);

  if (!schema_definition_id || !mongoose.Types.ObjectId.isValid(schema_definition_id)) {
    console.warn("Validation Error: Invalid or missing schema_definition_id.");
    return res.status(400).json({ message: "Valid schema_definition_id is required." });
  }
  if (!Array.isArray(identifiers_to_check) || identifiers_to_check.length === 0) {
    console.warn("Validation Error: identifiers_to_check is not a non-empty array.");
    return res.status(400).json({ message: "identifiers_to_check must be a non-empty array." });
  }

  try {
    const matchedSubmissions = []; // Stores unique submission documents that matched
    const seenSubmissionIds = new Set(); // Tracks IDs of submissions already added to matchedSubmissions

    console.log("Checking identifiers:", identifiers_to_check);

    for (const identifier of identifiers_to_check) {
      // Validate each identifier object from the client
      if (!identifier || typeof identifier.key !== 'string' || !identifier.key.trim() || 
          identifier.value === null || identifier.value === undefined || String(identifier.value).trim() === '') {
        console.warn("Skipping invalid or empty identifier in check:", identifier);
        continue; 
      }

      const trimmedValue = String(identifier.value).trim();
      console.log(`Querying for schema_id: ${schema_definition_id}, identifier key: ${identifier.key}, value: ${trimmedValue}`);

      // Correctly query for an element within the array that matches both key and value
      const existingSubmission = await GovDocumentSubmissionModel.findOne({
        schema_id: schema_definition_id,
        submitted_unique_identifiers: {
          $elemMatch: {
            key: identifier.key,
            value: trimmedValue // Use the trimmed value for matching
          }
        }
      });

      if (existingSubmission) {
        console.log(`Match found for key: ${identifier.key}, value: ${trimmedValue}. Submission ID: ${existingSubmission._id}`);
        // Add the submission document to our results only if we haven't seen its ID before
        if (!seenSubmissionIds.has(existingSubmission._id.toString())) {
          matchedSubmissions.push(existingSubmission);
          seenSubmissionIds.add(existingSubmission._id.toString());
          console.log(`Added unique submission ID ${existingSubmission._id.toString()} to results.`);
        } else {
          console.log(`Submission ID ${existingSubmission._id.toString()} already in results, not adding again.`);
        }
      } else {
        console.log(`No match found for key: ${identifier.key}, value: ${trimmedValue}`);
      }
    }

    if (matchedSubmissions.length > 0) {
      console.log(`Found ${matchedSubmissions.length} unique existing submission(s) matching identifiers.`);
      return res.status(200).json({
        message: "One or more unique identifiers match existing submissions.",
        // Frontend expects 'matched_keys' to be an array of submission documents.
        // If refactoring frontend, consider renaming to 'matched_submissions' for clarity.
        matched_keys: matchedSubmissions, 
        exists: true
      });
    } else {
      console.log("No existing submissions found for any of the provided unique identifiers.");
      const countTotalDocuments = await GovDocumentSubmissionModel.countDocuments({
        schema_id: schema_definition_id
      });
      return res.status(200).json({
        message: "No existing submissions found for the provided unique identifiers.",
        matched_keys: [], // Keep consistent response structure
        exists: false,
        totalCount: countTotalDocuments
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