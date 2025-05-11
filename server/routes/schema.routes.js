// schema.routes.js
import express from "express";
const router = express.Router();
import * as schemaController from "../controllers/schema.controller"; // Adjust path as needed and import all exports

// --- Routes for Schema Definitions ---

// POST route to create a new document schema definition
// This route will handle the request from the admin form
router.post("/schema-definition", schemaController.createSchemaDefinition);

// You can add other routes here later, e.g., GET to fetch definitions, PUT/DELETE to update/remove

export default router; // Use default export
