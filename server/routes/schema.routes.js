// routes/schema.routes.js
import express from "express";
import {
  createSchemaDefinition,
  getAllSchemaDefinitions,
  getSchemaDefinitionById,
  getSchemaDefinitionBySchemaIdString, // <<< ADDED IMPORT
  submitDocumentData,
  checkDocumentUniqueness
} from "../controllers/schema.controller.js"; 
import multer from "multer";
import { requireRole } from '../middlewares/auth.js'; 

const router = express.Router();

const storage = multer.memoryStorage();
const allowedMimeTypes = [
    'image/jpeg', 
    'image/png', 
    'application/pdf'
];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); 
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Invalid file type: ${file.mimetype}. Only JPEG, PNG, and PDF are allowed.`), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 
  }
});

// --- Routes for Schema Definitions (GovDocumentDefinition) ---

router.post(
    "/schema-definition",
    createSchemaDefinition
);

router.get(
    "/schema-definitions",
    requireRole(['admin', 'manager', 'staff', 'user', 'applicant']), 
    getAllSchemaDefinitions
);

// GET route to fetch a single schema definition by its Mongoose _id
router.get(
  "/schema-definition/:id", 
  requireRole(['admin', 'manager', 'staff', 'user', 'applicant']),
  getSchemaDefinitionById 
);

// --- NEW ROUTE ---
// GET route to fetch a single schema definition by its string schema_id (e.g., "aadhaar_card")
router.get(
  "/schema-definition/by-schema-id/:schema_id_string", // <<< NEW ROUTE
  requireRole(['admin', 'manager', 'staff', 'user', 'applicant']), // Adjust roles as needed
  getSchemaDefinitionBySchemaIdString // <<< NEW CONTROLLER FUNCTION
);


// --- Routes for Document Submissions (GovDocumentSubmission) ---

router.post(
  "/submission",
  requireRole(['admin', 'manager', 'staff', 'user', 'applicant']), 
  upload.any(), 
  submitDocumentData
);

router.post(
    "/check-unique",
    requireRole(['user', 'applicant', 'staff', 'manager']), 
    checkDocumentUniqueness
);

export default router;