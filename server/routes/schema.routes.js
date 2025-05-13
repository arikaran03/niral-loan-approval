// schema.routes.js
import express from "express";
import * as schemaController from "../controllers/schema.controller.js"; // Import all exports
import multer from "multer";
// Assume you have configured and imported multer middleware
// import upload from '../middleware/uploadMiddleware'; // Example multer configuration

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Routes for Schema Definitions ---

// POST route to create a new document schema definition
// Handles the request from the admin schema definition form (DynamicDocumentForm.js)
router.post("/schema-definition", schemaController.createSchemaDefinition);

// GET route to fetch ALL schema definitions (for the list in submission form)
// Handles the initial fetch by DynamicDocumentSubmissionForm.js
router.get("/schema-definitions", schemaController.getAllSchemaDefinitions); // New route

// GET route to fetch a single schema definition by its ID
// Handles fetching the specific schema details when selected in the submission form
router.get(
  "/schema-definition/:schemaId",
  schemaController.getSchemaDefinitionById // Now connected to the controller function
);

// --- Route for Document Submissions ---

// POST route to submit document data for a specific schema
// Handles the request from the DynamicDocumentSubmissionForm.js
// NOTE: This route REQUIRES file upload middleware (like multer) before the controller
// Example using a hypothetical 'upload' middleware configured for multiple files:
// router.post("/submission", upload.any(), schemaController.submitDocumentData); // Example with multer.any()
// Or configure multer fields specifically if you know the field names:
// router.post("/submission", upload.fields([...]), schemaController.submitDocumentData);

// For this example, we'll add the route assuming middleware is applied elsewhere or you add it here:
router.post(
  "/submission",
  upload.single("image"),
  schemaController.submitDocumentData
); // Add your multer middleware BEFORE schemaController.submitDocumentData

// You will need to ensure your express app uses a body-parser middleware for JSON/URL-encoded bodies
// and specifically configure multer or similar for handling multipart/form-data on the '/submission' route.

export default router;
