import GovDocumentDefinitionModel from "../database/models/GovDocumentDefinitionModel.js"; // Adjust path as needed
import GovDocumentSubmissionModel from "../database/models/GovDocumentSubmissionModel.js"; // Import the Submission Model
// Assume you have a file upload helper or service
// import { uploadFile } from '../services/fileUploadService'; // Example file upload helper

// NOTE: This controller requires a file upload middleware like 'multer' configured
// for the submission route to handle file uploads (req.files).

// --- Controller function to handle creating a new Schema Definition ---
// (Your existing function remains the same)
export const createSchemaDefinition = async (req, res) => {
  console.log(
    "Received POST request for /api/document/schema-definition (in controller)"
  );
  console.log("Request Body:", req.body);

  const { schema_id, name, description, fields } = req.body;

  // --- Server-side Validation ---
  if (
    !schema_id ||
    !name ||
    !description ||
    !fields ||
    !Array.isArray(fields)
  ) {
    console.error(
      "Validation Error: Missing required top-level fields or fields is not an array."
    );
    return res.status(400).json({
      message:
        "Missing required fields: schema_id, name, description, or fields array.",
    });
  }

  for (const field of fields) {
    if (
      !field.key ||
      !field.label ||
      !field.prompt ||
      !field.type ||
      field.min_value === undefined ||
      field.max_value === undefined
    ) {
      console.error(
        "Validation Error: Missing required field properties in fields array.",
        field
      );
      let missingProp = "";
      if (!field.key) missingProp = "key";
      else if (!field.label) missingProp = "label";
      else if (!field.prompt) missingProp = "prompt";
      else if (!field.type) missingProp = "type";
      else if (field.min_value === undefined) missingProp = "min_value";
      else if (field.max_value === undefined) missingProp = "max_value";

      return res.status(400).json({
        message: `Field "${
          field.label || field.key || "Unknown field"
        }" is missing the required property: ${missingProp}.`,
      });
    }
    if (
      (field.type === "select" || field.type === "multiselect") &&
      (!field.options ||
        !Array.isArray(field.options) ||
        field.options.length === 0)
    ) {
      console.error(
        "Validation Error: Options are required for select/multiselect types.",
        field
      );
      return res.status(400).json({
        message: `Field "${field.label}" (key: ${field.key}) requires options for type "${field.type}".`,
      });
    }
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
        min_value: field.min_value.trim(),
        max_value: field.max_value.trim(),
      })),
    });

    const savedSchemaDefinition = await newSchemaDefinition.save();

    console.log("Schema Definition saved successfully:", savedSchemaDefinition);

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
      return res
        .status(409)
        .json({ message: `Schema with ID '${schema_id}' already exists.` });
    }

    res.status(500).json({
      message: "An error occurred while saving the schema definition.",
      error: error.message,
    });
  }
};

// --- Controller function to handle fetching all Schema Definitions ---
// This function will be called by the router when a GET request hits /api/document/schema-definitions
export const getAllSchemaDefinitions = async (req, res) => {
  console.log(
    "Received GET request for /api/document/schema-definitions (in controller)"
  );
  try {
    // Fetch all schema definitions, selecting only necessary fields for the list
    const schemas = await GovDocumentDefinitionModel.find(
      {},
      "_id schema_id name description"
    );

    console.log(`Found ${schemas.length} schema definitions.`);

    // Send the list of schemas in the response
    res.status(200).json(schemas);
  } catch (error) {
    console.error("Error fetching schema definitions:", error);
    res.status(500).json({
      message: "An error occurred while fetching schema definitions.",
      error: error.message,
    });
  }
};

// --- Controller function to handle fetching a single Schema Definition by ID ---
// This function will be called by the router when a GET request hits /api/document/schema-definition/:schemaId
export const getSchemaDefinitionById = async (req, res) => {
  const schemaId = req.params.schemaId;
  console.log(
    `Received GET request for /api/document/schema-definition/${schemaId} (in controller)`
  );

  try {
    // Find the schema definition by its Mongoose _id
    const schemaDefinition = await GovDocumentDefinitionModel.findById(
      schemaId
    );

    if (!schemaDefinition) {
      console.warn(`Schema definition not found for ID: ${schemaId}`);
      return res.status(404).json({ message: "Schema definition not found." });
    }

    console.log(
      `Found schema definition for ID: ${schemaId}`,
      schemaDefinition
    );

    // Send the full schema definition in the response
    res.status(200).json(schemaDefinition);
  } catch (error) {
    console.error(
      `Error fetching schema definition for ID ${schemaId}:`,
      error
    );

    // Check for invalid ObjectId format error
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid schema ID format." });
    }

    res.status(500).json({
      message: "An error occurred while fetching the schema definition.",
      error: error.message,
    });
  }
};

// --- Controller function to handle submitting document data ---
// This function will be called by the router when a POST request hits /api/document/submission
// NOTE: This requires file upload middleware like 'multer' to be configured for the route.
export const submitDocumentData = async (req, res) => {
  console.log(
    "Received POST request for /api/document/submission (in controller)"
  );

  // req.body will contain non-file fields (like schema_id, user_id, created_by, and fieldsData JSON string)
  // req.files will contain the uploaded files if using a middleware like multer
  console.log("Request Body:", req.body);
  console.log("Received Files:", req.files); // Should be populated by multer or similar middleware

  const { schema_id, fieldsData } = req.body;
  const user_id = req.user._id;
  const created_by = req.user._id;

  // --- Server-side Validation ---
  if (!schema_id || !user_id || !created_by || !fieldsData) {
    console.error("Validation Error: Missing required submission data.");
    return res.status(400).json({
      message:
        "Missing required submission data (schema_id, user_id, created_by, fieldsData).",
    });
  }

  let parsedFieldsData;
  try {
    // fieldsData is expected to be a JSON string from the frontend
    parsedFieldsData = JSON.parse(fieldsData);
    if (!Array.isArray(parsedFieldsData)) {
      throw new Error("fieldsData is not an array.");
    }
  } catch (parseError) {
    console.error("Validation Error: Invalid fieldsData format.", parseError);
    return res.status(400).json({ message: "Invalid format for fields data." });
  }

  try {
    // You might want to validate if the schema_id, user_id, created_by exist in your database
    // For this example, we proceed assuming they are valid ObjectIds or strings

    // Process fields data and handle file uploads
    const submissionFields = [];
    const uploadedFiles = req.files || {}; // Get uploaded files object from middleware

    // Iterate through the non-file field data received from the frontend
    for (const field of parsedFieldsData) {
      if (!field.field_id || !field.field_label || !field.type) {
        console.warn("Incomplete field data received:", field);
        // Depending on your requirements, you might return an error or skip the field
        continue; // Skip this malformed field entry
      }

      // Check if this field was meant to be a file upload type
      if (field.type === "image" || field.type === "document") {
        // Find the corresponding uploaded file using the field_id (which was the key in FormData)
        const file = uploadedFiles[field.field_id];

        if (file) {
          // --- File Upload Logic ---
          // This is where you would typically save the file to storage (S3, local disk, etc.)
          // and get a reference (like a path, filename, or cloud storage URL/ID).
          // The GovDocumentSubmissionModel expects a 'fileRef', which is a Mongoose ObjectId.
          // This implies you have a separate 'Image' or 'File' model where you save file metadata
          // and a reference to the actual file data.

          // Example placeholder for file saving:
          // Assuming `uploadFile` is a service that saves the file and returns the _id from your File model
          // const fileRefId = await uploadFile(file); // Implement this service

          // --- SIMPLIFIED PLACEHOLDER ---
          // In a real app, replace this with actual file saving and getting the ObjectId
          // For demonstration, let's assume req.files[field.field_id] provides enough info
          // and you map it to your File model structure before getting the ID.
          // If your File model just stores filename/path, you'd save the file and then create/find the File model entry.
          // Since the schema requires ObjectId, let's assume you create a File document.
          // Example: const newFile = new FileModel({ filename: file.originalname, path: file.path, ... }); await newFile.save(); const fileRefId = newFile._id;

          // For this example, let's simulate saving and getting an ObjectId
          // You MUST replace this with your actual file saving logic
          const simulatedFileRefId = new mongoose.Types.ObjectId(); // Simulate getting a new ObjectId after saving file

          submissionFields.push({
            field_id: field.field_id,
            field_label: field.field_label,
            type: field.type,
            // value is not used for file types in the submission model
            fileRef: simulatedFileRefId, // Use the actual ObjectId from your saved file model
          });

          console.log(
            `Processed file for field "${field.field_label}" (key: ${field.field_id}). Simulated fileRef: ${simulatedFileRefId}`
          );
        } else {
          // This case should ideally be caught by frontend validation if required
          // If it's a required file field and no file was uploaded, handle as an error
          console.warn(
            `File expected for field "${field.field_label}" (key: ${field.field_id}), but not found in upload.`
          );
          // You might add a check here if field was required in the definition:
          // const definitionField = await GovDocumentDefinitionModel.findOne({ _id: schema_id, 'fields.key': field.field_id }, { 'fields.$': 1 });
          // if (definitionField && definitionField.fields[0]?.required) {
          //    return res.status(400).json({ message: `File for field "${field.field_label}" is required.` });
          // }
          // If not required or validation is handled client-side, just skip or add with fileRef: null
          submissionFields.push({
            field_id: field.field_id,
            field_label: field.field_label,
            type: field.type,
            fileRef: null, // Or undefined, depending on schema default/behavior
          });
        }
      } else {
        // For non-file types, use the value from parsedFieldsData
        submissionFields.push({
          field_id: field.field_id,
          field_label: field.field_label,
          type: field.type,
          value: field.value, // Use the value received in the JSON string
        });
        console.log(
          `Processed value for field "${field.field_label}" (key: ${field.field_id}). Value: ${field.value}`
        );
      }
    }

    // Create a new GovDocumentSubmission document instance
    const newSubmission = new GovDocumentSubmissionModel({
      schema_id: schema_id, // Mongoose ObjectId
      user_id: user_id, // Mongoose ObjectId (assuming valid ID provided)
      created_by: created_by, // Mongoose ObjectId (assuming valid ID provided)
      fields: submissionFields, // Array of processed submission field objects
    });

    // Save the submission document to the database
    const savedSubmission = await newSubmission.save();

    console.log("Document Submission saved successfully:", savedSubmission);

    // Send a success response
    res.status(201).json({
      message: "Document data submitted successfully!",
      submission: savedSubmission, // Include the saved document in the response
    });
  } catch (error) {
    console.error("Error submitting document data:", error);

    // Handle potential Mongoose validation errors for the submission model
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res
        .status(400)
        .json({ message: "Submission validation failed", errors: messages });
    }

    // Handle errors related to file processing or database issues
    res.status(500).json({
      message: "An error occurred while submitting document data.",
      error: error.message,
    });
  }
};

// Add other controller functions here if needed
// e.g., updateSchemaDefinition, deleteSchemaDefinition, getSubmissionsBySchema etc.
