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
  const jsonStartMatch = text.match(/\{\s*"entities"\s*:\s*\[/);
  if (!jsonStartMatch) {
    console.warn("Did not find expected '{\"entities\": [' start in the text.");
    // Try parsing the whole string as a last resort, maybe the LLM ignored prefix instructions
    try {
      const parsed = JSON.parse(text);
      if (
        parsed &&
        Array.isArray(parsed.entities) &&
        typeof parsed.doc_name === "string"
      ) {
        console.log(
          "Parsed whole string successfully into expected structure."
        );
        return parsed;
      }
    } catch (e) {
      console.warn("Could not parse the whole text as JSON either.");
      return null;
    }
    return null; // Did not find the start marker and couldn't parse whole string
  }

  // Find the substring starting from the detected start
  const startIndex = jsonStartMatch.index;
  const jsonCandidate = text.substring(startIndex);

  // Try to parse the candidate substring. This is still brittle if there's trailing text.
  // A more robust approach might involve finding matching brackets, but can be complex.
  try {
    const parsed = JSON.parse(jsonCandidate);
    // Validate the structure after parsing
    if (
      parsed &&
      Array.isArray(parsed.entities) &&
      typeof parsed.doc_name === "string"
    ) {
      // Further validation on entities array elements
      if (
        parsed.entities.every(
          (item) =>
            item && typeof item.key === "string" && item.hasOwnProperty("value")
        )
      ) {
        console.log("Successfully parsed substring into expected structure.");
        return parsed;
      } else {
        console.warn(
          "Parsed object, but 'entities' array has incorrect item structure."
        );
      }
    } else {
      console.warn(
        "Parsed object, but it doesn't match expected structure {entities: [], doc_name: string}."
      );
    }
  } catch (e) {
    console.warn(
      "Could not parse substring starting with '{ entities: [' as JSON:",
      e
    );
    // Try parsing the whole string again as a fallback if substring parsing failed
    try {
      const parsed = JSON.parse(text);
      if (
        parsed &&
        Array.isArray(parsed.entities) &&
        typeof parsed.doc_name === "string" &&
        parsed.entities.every(
          (item) =>
            item && typeof item.key === "string" && item.hasOwnProperty("value")
        )
      ) {
        console.log(
          "Parsed whole string successfully into expected structure (fallback)."
        );
        return parsed;
      }
    } catch (e2) {
      console.warn("Could not parse the whole text as JSON either (fallback).");
    }
  }

  return null; // Parsing failed or structure mismatch
};

export default {
  /**
   * Extracts entities from an uploaded document image using OpenAI Vision.
   * Expects:
   * - req.file: Uploaded file object from multer (named 'document')
   * - req.body.fields: JSON stringified object like:
   * { "label": "Doc Label", "fields": [{ "key": "field_key", "label": "Field Label", "prompt": "Optional Prompt" }, ...] }
   * - req.body.docType: String indicating the EXPECTED document type (e.g., 'aadhaar')
   */
  async extractEntitiesFromImage(req, res) {
    console.log("Received request for entity extraction.");

    // 1. Validate Input
    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No document image file uploaded." });
    }
    if (!req.body.fields) {
      return res.status(400).json({ error: 'Missing required "fields" data.' });
    }
    if (!req.body.docType) {
      return res
        .status(400)
        .json({ error: 'Missing required "docType" data.' });
    } // Expect docType

    let fieldsSchemaArray;
    try {
      const fieldsInput = JSON.parse(req.body.fields);
      if (
        !fieldsInput ||
        !Array.isArray(fieldsInput.fields) ||
        fieldsInput.fields.some((f) => !f.key || typeof f.key !== "string")
      ) {
        throw new Error("Invalid fields format.");
      }
      fieldsSchemaArray = fieldsInput.fields;
    } catch (err) {
      return res
        .status(400)
        .json({ error: `Invalid fields format: ${err.message}` });
    }

    const expectedDocType = req.body.docType; // The type frontend expects this doc to be
    console.log(
      `Processing uploaded document, expected type: ${expectedDocType}`
    );

    try {
      // 2. Prepare Image Data
      const base64Image = req.file.buffer.toString("base64");
      const mimeType = req.file.mimetype;

      // 3. Construct Prompt for OpenAI
      const fieldDescriptions = fieldsSchemaArray
        .map(
          (f) =>
            `- Key: "${f.key}", Description: "${f.prompt || f.label || f.key}"`
        )
        .join("\n");

      // *** UPDATED SYSTEM PROMPT ***
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
   - The "doc_name" key must contain a string representing the identified document type (e.g., "aadhaar", "pan_card", "smart_card", "bank_statement", or "other" if unsure/different).
ABSOLUTELY NO other text, explanations, apologies, markdown formatting (like \`\`\`json), or introductory/concluding remarks should be included in your response. The response must start directly with '{' and end directly with '}'.`;

      // *** UPDATED USER PROMPT ***
      const userPrompt = `
Analyze the attached image and perform the following steps according to the system instructions:
1. Identify the document type.
2. Extract the values for these fields:
${fieldDescriptions}

Strictly return ONLY the JSON object in the specified format: { "entities": [{ "key": "key1", "value": "value1" }, ...], "doc_name": "detected_type" }
If you cannot find a value for a key, use an empty string "" or null for its value.
If you are unsure about the document type, use "other" as the value for "doc_name".
`;
      // console.log("User Prompt:", userPrompt); // Keep for debugging if needed

      console.log("Sending request to OpenAI Vision (gpt-4o)...");

      // 4. Call OpenAI API
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Use the latest model like gpt-4o
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
                  detail: "auto",
                },
              },
            ],
          },
        ],
        max_tokens: 1500, // Increased slightly for potentially more complex extractions
        temperature: 0.1, // Low temperature for consistency
        response_format: { type: "json_object" }, // Explicitly request JSON output if model supports it
      });

      console.log("OpenAI Response Received.");
      const messageContent = response.choices[0]?.message?.content;

      if (!messageContent) {
        throw new Error("OpenAI response was empty or invalid.");
      }
      console.log("Raw Message Content:", messageContent);

      // 5. Parse the Response (expecting JSON object directly due to response_format)
      let extractedData;
      try {
        extractedData = JSON.parse(messageContent);
      } catch (parseError) {
        console.error(
          "Failed to parse OpenAI response content as JSON object:",
          parseError
        );
        console.error("Content was:", messageContent);
        // Try the helper as a fallback in case response_format didn't work perfectly
        extractedData = extractExpectedJsonObject(messageContent);
        if (!extractedData) {
          throw new Error(
            `OpenAI did not return valid JSON matching the expected structure. Response: ${messageContent.substring(
              0,
              200
            )}...`
          );
        }
        console.log("Parsed using fallback helper.");
      }

      // 6. Validate JSON structure
      if (
        !extractedData ||
        typeof extractedData !== "object" ||
        !Array.isArray(extractedData.entities) ||
        typeof extractedData.doc_name !== "string"
      ) {
        console.error(
          "Parsed JSON does not match expected structure {entities: [], doc_name: string}:",
          extractedData
        );
        throw new Error("OpenAI response JSON structure is incorrect.");
      }
      if (
        !extractedData.entities.every(
          (item) =>
            item && typeof item.key === "string" && item.hasOwnProperty("value")
        )
      ) {
        console.error(
          "Parsed JSON 'entities' array has incorrect item structure:",
          extractedData.entities
        );
        throw new Error(
          "OpenAI response JSON structure is incorrect within the entities array."
        );
      }

      console.log("Successfully parsed response object:", extractedData);

      // 7. Optional: Compare detected doc_name with expectedDocType (can also be done on frontend)
      // if (extractedData.doc_name !== expectedDocType) {
      //     console.warn(`Document type mismatch detected by AI. Expected: ${expectedDocType}, Detected: ${extractedData.doc_name}`);
      //     // You might choose to return an error or just pass the detected type along
      //     // return res.status(400).json({ error: `Document type mismatch. Expected ${expectedDocType}, but AI detected ${extractedData.doc_name}` });
      // }

      // 8. Send Success Response (including detected doc_name)
      return res.status(200).json(extractedData); // Send the full object { entities: [], doc_name: "..." }
    } catch (error) {
      console.error("Error during OpenAI entity extraction:", error);
      if (error instanceof OpenAI.APIError) {
        return res
          .status(error.status || 500)
          .json({ error: `OpenAI API Error: ${error.message}` });
      }
      return res
        .status(500)
        .json({
          error:
            error.message || "Internal server error during entity extraction.",
        });
    }
  },
};
