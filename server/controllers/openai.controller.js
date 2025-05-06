// src/controllers/openai.controller.js

import OpenAI from 'openai';
import dotenv from 'dotenv';

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
 * Tries to parse a string that might contain JSON, even with surrounding text/markdown.
 * @param {string} text - The text possibly containing JSON.
 * @returns {object | null} - The parsed JSON object or null if parsing fails.
 */
const extractJsonFromString = (text) => {
    if (!text) return null;
    // Try finding JSON array brackets [] first - most likely response structure
    const jsonArrayMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (jsonArrayMatch) {
        try {
            return JSON.parse(jsonArrayMatch[0]);
        } catch (e) {
            console.warn("Could not parse detected JSON array:", e);
            // Continue to try parsing the whole string if array parsing fails
        }
    }
    // Fallback: Try parsing the entire string as JSON (object or array)
     try {
         const parsed = JSON.parse(text);
         // Basic validation if it looks like the expected array format
         if (Array.isArray(parsed) && parsed.every(item => item && typeof item.key === 'string' && item.hasOwnProperty('value'))) {
             return parsed;
         }
         // If it parsed but isn't the expected array, log a warning but still return null for expected structure
         console.warn("Parsed JSON but not in the expected format [{key, value}, ...]:", parsed);
         return null;
     } catch (e) {
         console.warn("Could not parse text as JSON:", e);
     }

    return null;
};


export default {
    /**
     * Extracts entities from an uploaded document image using OpenAI Vision.
     * Expects:
     * - req.file: Uploaded file object from multer (named 'document')
     * - req.body.fields: JSON stringified object like:
     * { "label": "Doc Label", "fields": [{ "key": "field_key", "label": "Field Label", "prompt": "Optional Prompt" }, ...] }
     * - req.body.docType: String indicating document type (e.g., 'aadhaar')
     */
    async extractEntitiesFromImage(req, res) {
        console.log("Received request for entity extraction.");
        // console.log("Request Body:", req.body); // Debug: Log body
        // console.log("Request File:", req.file); // Debug: Log file info

        // 1. Validate Input
        if (!req.file) {
            return res.status(400).json({ error: 'No document image file uploaded.' });
        }
        if (!req.body.fields) {
            return res.status(400).json({ error: 'Missing required "fields" data in request body.' });
        }

        let fieldsSchemaArray; // This will hold the array like [{key, label, prompt}, ...]
        try {
            // Parse the incoming JSON string for fields
            const fieldsInput = JSON.parse(req.body.fields);

            // Validate the parsed structure and extract the nested array
            if (!fieldsInput || !Array.isArray(fieldsInput.fields) || fieldsInput.fields.some(f => !f.key || typeof f.key !== 'string')) {
                 throw new Error("Invalid fields format. Expected object with nested 'fields' array containing objects with 'key'.");
            }
            fieldsSchemaArray = fieldsInput.fields; // Get the nested array
            console.log("Parsed fields schema array:", fieldsSchemaArray);
        } catch (err) {
            console.error("Error parsing fields schema:", err);
            return res.status(400).json({ error: `Invalid fields format: ${err.message}` });
        }

        const docType = req.body.docType || 'document'; // Get docType or default
        console.log(`Processing document type: ${docType}`);

        try {
            // 2. Prepare Image Data
            const base64Image = req.file.buffer.toString('base64');
            const mimeType = req.file.mimetype;

            // 3. Construct Prompt for OpenAI using the nested fields array
            const fieldDescriptions = fieldsSchemaArray.map(f =>
                `- Key: "${f.key}", Description: "${f.prompt || f.label || f.key}"` // Use prompt, fallback to label/key
            ).join('\n');

            const systemPrompt = `You are an expert entity extraction assistant. Your task is to analyze the provided image of a ${docType} and extract specific pieces of information based on the requested fields. Respond ONLY with a valid JSON array containing objects. Each object must have a "key" corresponding exactly to one of the requested keys, and a "value" containing the extracted text for that key from the image. If a value for a key cannot be found, use an empty string "" or null for its value. Do not include any explanations, introductory text, markdown formatting, or anything else outside the JSON array structure: [{ "key": "...", "value": "..." }, ...].`;

            const userPrompt = `
Extract the following fields from the attached image:
${fieldDescriptions}

Return the result ONLY as a JSON array: [{ "key": "requested_key_1", "value": "extracted_value_1" }, { "key": "requested_key_2", "value": "extracted_value_2" }, ...]
`;
            console.log("User Prompt:", userPrompt);

            console.log("Sending request to OpenAI Vision...");

            // 4. Call OpenAI API
            const response = await openai.chat.completions.create({
                model: "gpt-4o", // Or "gpt-4o" or latest vision model
                messages: [
                    { role: "system", content: systemPrompt },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: userPrompt },
                            {
                                type: "image_url",
                                image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "auto" },
                            },
                        ],
                    },
                ],
                max_tokens: 1000,
                temperature: 0.1,
            });

            console.log("OpenAI Response Received.");
            const messageContent = response.choices[0]?.message?.content;

            if (!messageContent) {
                console.error("OpenAI response missing message content.");
                throw new Error('OpenAI response was empty or invalid.');
            }
            console.log("Raw Message Content:", messageContent);

            // 5. Parse the Response (expecting ONLY JSON array)
            let extractedJson = extractJsonFromString(messageContent);

            if (!extractedJson) {
                console.error("Failed to parse OpenAI response content as JSON array.");
                console.error("Content was:", messageContent);
                throw new Error(`OpenAI did not return valid JSON array. Response: ${messageContent.substring(0, 200)}...`);
            }

            // 6. Validate JSON structure
            if (!Array.isArray(extractedJson) || !extractedJson.every(item => item && typeof item.key === 'string' && item.hasOwnProperty('value'))) {
                 console.error("Parsed JSON is not in the expected format [{key, value}, ...]:", extractedJson);
                 throw new Error('OpenAI response JSON structure is incorrect.');
            }

            console.log("Successfully extracted entities:", extractedJson);
            // 7. Send Success Response
            return res.status(200).json(extractedJson); // Send the array directly

        } catch (error) {
            console.error("Error during OpenAI entity extraction:", error);
            if (error instanceof OpenAI.APIError) {
                 return res.status(error.status || 500).json({ error: `OpenAI API Error: ${error.message}` });
            }
            return res.status(500).json({ error: error.message || 'Internal server error during entity extraction.' });
        }
    },
};
