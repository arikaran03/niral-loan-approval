// src/controllers/openai.controller.js

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

// Ensure you have OPENAI_API_KEY in your .env file
if (!process.env.OPENAI_API_KEY) {
  console.error("FATAL ERROR: OPENAI_API_KEY environment variable is not set.");
  process.exit(1); // Exit if key is missing
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Tries to parse a string that might contain JSON, specifically looking for the expected object structure.
 * @param {string} text - The text possibly containing JSON.
 * @returns {object | null} - The parsed JSON object or null if parsing fails or structure is wrong.
 */
const extractExpectedJsonObject = (text) => {
  if (!text) return null;

  // Attempt to find the start of the JSON object `{"entities": [`
  // This is a common pattern if the LLM adds prefixes/suffixes despite instructions.
  const jsonStartMatch = text.match(/\{\s*"entities"\s*:\s*\[/);
  
  let jsonCandidate = text; // Default to parsing the whole text

  if (jsonStartMatch) {
    // If a clear start is found, try parsing from there.
    // This helps if there's leading non-JSON text.
    const startIndex = jsonStartMatch.index;
    jsonCandidate = text.substring(startIndex);
    console.log("Attempting to parse from detected JSON start.");
  } else {
    console.warn("Did not find typical '{\"entities\": [' start. Will attempt to parse the whole text.");
  }

  try {
    const parsed = JSON.parse(jsonCandidate);
    // Validate the structure after parsing
    if (
      parsed &&
      Array.isArray(parsed.entities) &&
      typeof parsed.doc_name === "string" &&
      parsed.entities.every(
        (item) =>
          item && typeof item.key === "string" && item.hasOwnProperty("value")
      )
    ) {
      console.log("Successfully parsed candidate JSON into expected structure.");
      return parsed;
    } else {
      console.warn(
        "Parsed JSON, but it doesn't match expected structure {entities: Array, doc_name: string} or entities items are malformed. Parsed:", parsed
      );
    }
  } catch (e) {
    console.warn(`Could not parse candidate JSON (Source: ${jsonStartMatch ? 'substring' : 'whole text'}):`, e.message);
    // If parsing a substring failed, and we haven't already tried the whole text, try it now.
    if (jsonStartMatch && jsonCandidate !== text) {
        console.log("Fallback: Trying to parse the whole original text as JSON.");
        try {
            const parsedWhole = JSON.parse(text);
             if (
                parsedWhole &&
                Array.isArray(parsedWhole.entities) &&
                typeof parsedWhole.doc_name === "string" &&
                parsedWhole.entities.every(
                    (item) =>
                    item && typeof item.key === "string" && item.hasOwnProperty("value")
                )
            ) {
                return parsedWhole;
            } else {
                 console.warn("Parsed whole text, but structure is still incorrect (fallback). Parsed:", parsedWhole);
            }
        } catch (e2) {
            console.warn("Could not parse the whole original text as JSON either (fallback):", e2.message);
        }
    }
  }
  return null; // Parsing failed or structure mismatch
};

export default {
  /**
   * Extracts entities from an uploaded document image using OpenAI Vision.
   * Expects:
   * - req.file: Uploaded file object from multer (e.g., named 'file' as per your frontend FormData)
   * - req.body.fields: JSON stringified object like:
   * { "label": "Doc Label", "fields": [{ "key": "field_key", "label": "Field Label", "prompt": "Optional Prompt" }, ...] }
   * - req.body.docType: String indicating the EXPECTED document type (e.g., 'aadhaar_card')
   */
  async extractEntitiesFromImage(req, res) {
    console.log("Received request for entity extraction (/api/application/extract-entity).");

    // 1. Validate Input
    if (!req.file) {
      console.error("Validation Error: No document image file uploaded.");
      return res.status(400).json({ error: "No document image file uploaded." });
    }
    if (!req.body.fields) {
      console.error("Validation Error: Missing required 'fields' data in request body.");
      return res.status(400).json({ error: 'Missing required "fields" data.' });
    }
    // docType is optional on backend if OpenAI is to determine it, but good for logging/context
    const expectedDocType = req.body.docType || "Unknown (not provided by client)";
    console.log(`Processing uploaded document. Client expects type (docType): ${expectedDocType}`);


    // Parse the 'fields' JSON string from req.body
    // This object should contain the schema definition for the fields to extract.
    let fieldsSchemaFromRequest; // This will be an object like { label: "...", fields: [...] }
    let fieldsArrayForPrompt;   // This will be the actual array: [...]
    try {
      fieldsSchemaFromRequest = JSON.parse(req.body.fields);
      if (
        !fieldsSchemaFromRequest ||
        !Array.isArray(fieldsSchemaFromRequest.fields) || // Check for the 'fields' array within the parsed object
        fieldsSchemaFromRequest.fields.some((f) => !f.key || typeof f.key !== "string")
      ) {
        console.error("Validation Error: Invalid 'fields' format. Expected JSON string of an object with a 'fields' array.", req.body.fields);
        throw new Error("Invalid fields format. Must be an object with a 'fields' array, and each field must have a 'key'.");
      }
      fieldsArrayForPrompt = fieldsSchemaFromRequest.fields;
      console.log(`Successfully parsed 'fields' from request. Document Label: ${fieldsSchemaFromRequest.label}, Number of fields to extract: ${fieldsArrayForPrompt.length}`);
    } catch (err) {
      console.error("Error parsing 'fields' JSON string from request body:", err.message);
      return res.status(400).json({ error: `Invalid 'fields' format in request body: ${err.message}` });
    }

    try {
      // 2. Prepare Image Data
      const base64Image = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;
      console.log(`Image prepared: ${mimeType}, size: ${req.file.size} bytes`);

      // 3. Construct Prompt for OpenAI
      // Use fieldsArrayForPrompt which is the actual array of field definitions
      const fieldDescriptions = fieldsArrayForPrompt
        .map(
          (f) =>
            `- Key: "${f.key}", Description: "${f.prompt || f.label || f.key}"`
        )
        .join("\n");

      const systemPrompt = `You are an advanced entity extraction AI specialized in analyzing official documents.
Your task is:
1. Identify the type of document shown in the image (e.g., 'aadhaar', 'pan_card', 'smart_card', 'bank_statement', 'other').
2. Extract specific pieces of information based on the user's requested fields.
3. Respond ONLY with a single, valid JSON object adhering STRICTLY to the following format:
   {
     "entities": [ { "key": "requested_key_1", "value": "extracted_value_1" }, ... ],
     "doc_name": "detected_document_type"
   }
   - The "entities" array must contain objects, each with a "key" matching EXACTLY one of the requested keys and a "value" holding the extracted text.
   - If a value for a key cannot be found or is not applicable, use an empty string "" or null for its value.
   - The "doc_name" key must contain a string representing the identified document type (e.g., "aadhaar_card", "pan_card", "smart_card", "bank_statement", or "other" if unsure/different).
ABSOLUTELY NO other text, explanations, apologies, markdown formatting (like \`\`\`json), or introductory/concluding remarks should be included in your response. The response must start directly with '{' and end directly with '}'.`;

      const userPrompt = `
Analyze the attached image and perform the following steps according to the system instructions:
1. Identify the document type.
2. Extract the values for these fields:
${fieldDescriptions}

Strictly return ONLY the JSON object in the specified format: { "entities": [{ "key": "key1", "value": "value1" }, ...], "doc_name": "detected_type" }
If you cannot find a value for a key, don't return the key at all, skip that key.
If you are unsure about the document type, use "other" as the value for "doc_name".
`;

      console.log("Sending request to OpenAI Vision (gpt-4o)...");

      // 4. Call OpenAI API
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Updated model
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: "auto", // "low" can be used for faster, less detailed analysis if applicable
                },
              },
            ],
          },
        ],
        max_tokens: 1500,
        temperature: 0.1,
        response_format: { type: "json_object" }, // Request JSON output
      });

      const messageContent = response.choices[0]?.message?.content;

      if (!messageContent) {
        console.error("OpenAI response was empty or invalid (no message content).");
        throw new Error("OpenAI response was empty or invalid.");
      }
      console.log("Raw Message Content from OpenAI:", messageContent);

      // 5. Parse the Response
      // response_format: { type: "json_object" } should ensure messageContent is a valid JSON string.
      let extractedData;
      try {
        extractedData = JSON.parse(messageContent);
      } catch (parseError) {
        console.warn(
          "Failed to parse OpenAI response content directly as JSON object, trying fallback helper. Error:",
          parseError.message
        );
        // Fallback parsing if direct parse fails (e.g., if LLM added prefixes/suffixes despite response_format)
        extractedData = extractExpectedJsonObject(messageContent);
        if (!extractedData) {
          console.error("Fallback parsing also failed. OpenAI response did not yield valid JSON matching the expected structure.");
          throw new Error(
            `OpenAI did not return valid JSON matching the expected structure. Response snippet: ${messageContent.substring(0,200)}...`
          );
        }
      }

      // 6. Validate Parsed JSON structure
      if (
        !extractedData ||
        typeof extractedData !== "object" ||
        !Array.isArray(extractedData.entities) ||
        typeof extractedData.doc_name !== "string"
      ) {
        console.error(
          "Parsed JSON does not match expected structure {entities: Array, doc_name: string}. Received:",
          extractedData
        );
        throw new Error("OpenAI response JSON structure is incorrect after parsing.");
      }
      if (
        !extractedData.entities.every(
          (item) =>
            item && typeof item.key === "string" && item.hasOwnProperty("value")
        )
      ) {
        console.error(
          "Parsed JSON 'entities' array has incorrect item structure. Received entities:",
          extractedData.entities
        );
        throw new Error(
          "OpenAI response JSON structure is incorrect within the 'entities' array items."
        );
      }

      console.log("Successfully validated parsed response object:", extractedData);

      // 7. Optional: Log mismatch if detected doc_name differs from client's expectedDocType
      if (expectedDocType !== "Unknown (not provided by client)" && extractedData.doc_name !== expectedDocType) {
          console.warn(`Document type mismatch. Client expected: ${expectedDocType}, AI detected: ${extractedData.doc_name}`);
          // Depending on requirements, you might modify the response or add a flag.
          // For now, we send what the AI detected.
      }

      // 8. Send Success Response
      // The frontend expects { extracted_data: { ... original OpenAI response ... }, unique_keys: { ... } }
      // The current OpenAI response IS the extracted_data part. We need to simulate unique_keys or decide how they are derived.
      // For now, assuming unique_keys are derived from specific keys in entities.
      // This part needs to align with how your frontend `processGovDocumentScan` uses `ocrRes.data.unique_keys`.

      const uniqueKeyDefinitions = { // Define which keys from schema are unique identifiers
        aadhaar_card: ['aadhaar_number'],
        pan_card: ['pan_number'],
        // Add other doc types and their unique keys
      };
      
      const unique_keys = {};
      if (uniqueKeyDefinitions[extractedData.doc_name]) {
        extractedData.entities.forEach(entity => {
          if (uniqueKeyDefinitions[extractedData.doc_name].includes(entity.key) && entity.value) {
            unique_keys[entity.key] = entity.value;
          }
        });
      }

      // The frontend (DynamicSchemaForm) expects a structure like:
      // ocrRes.data.extracted_data (this should be the map of key-value pairs for form fields)
      // ocrRes.data.unique_keys (this should be a map of unique keys and their values)
      // ocrRes.data.doc_name (implicitly, as the frontend uses schema_id_string for this)

      // Transform OpenAI's entities array into a flat object for `extracted_data`
      const flatExtractedData = extractedData.entities.reduce((acc, entity) => {
        acc[entity.key] = entity.value;
        return acc;
      }, {});

      const responsePayload = {
        extracted_data: flatExtractedData, // e.g., { full_name: "...", aadhaar_number: "..." }
        unique_keys: unique_keys,         // e.g., { aadhaar_number: "..." }
        doc_name: extractedData.doc_name  // e.g., "aadhaar_card"
      };
      
      console.log("Sending success response to client:", responsePayload);
      return res.status(200).json(responsePayload);

    } catch (error) {
      console.error("Error during OpenAI entity extraction process:", error);
      if (error instanceof OpenAI.APIError) {
        return res
          .status(error.status || 500)
          .json({ error: `OpenAI API Error: ${error.name} - ${error.message}` });
      }
      // Ensure a default message if error.message is not present
      const errorMessage = error.message || "Internal server error during entity extraction.";
      return res.status(500).json({ error: errorMessage });
    }
  },
};
