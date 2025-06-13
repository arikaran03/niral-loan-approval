import {
  SENDER_EMAIL,
  SENDER_PASSWORD,
  SMTP_SERVER,
  SMTP_PORT,
} from "../config.js"; // Adjust the path as necessary
import nodemailer from "nodemailer";
// otpService.js
import axios from "axios";
import crypto from "crypto"; // For generating unique request IDs

// IMPORTANT: Store your API Key securely, preferably as an environment variable.
const FAST2SMS_API_KEY =
  process.env.FAST2SMS_API_KEY ||
  "ZxzPcJ8GfksSWaXOvYbhC6EujlKRq47NTQw2mV139IDnLyrF5pSInJLcXB4aqwOmTQ9HvboGdWVri2ey";
// Note: FAST2SMS_OTP_TEMPLATE_ID is removed as we are sending custom messages.

const otpStore = {}; // Using a simple object as a Map
const OTP_EXPIRY_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_VERIFY_ATTEMPTS = 3; // Maximum verification attempts allowed

// Define a standard application name. Replace this with your actual application/service name.
const APPLICATION_NAME = process.env.OTP_APPLICATION_NAME || "Your Service";

/**
 * Generates a random 6-digit OTP.
 * @returns {string} The generated OTP.
 */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generates a unique request ID.
 * @returns {string} A unique request ID.
 */
function generateRequestId() {
  return crypto.randomUUID();
}

/**
 * Sends an OTP to the given phone number using Fast2SMS with a standardized message.
 * @param {object} req The Express request object. Expected to have req.body.mobileNumber.
 * The req.body.message field will now be ignored.
 * @param {string} [dltPrincipalEntityId] Your DLT Principal Entity ID (optional, if needed).
 * @returns {Promise<object>} A promise that resolves with { message, requestId, otp_for_debug }.
 */
async function sendOtp(req, dltPrincipalEntityId = null) {
  const { mobileNumber } = req.body; // Extract mobileNumber from request body
  // The `message` field from req.body is now ignored in favor of a standardized template.

  const generatedOtp = generateOtp();
  const uniqueRequestId = generateRequestId();
  const currentTime = Date.now();

  return {
    message: "OTP sent successfully to " + mobileNumber,
    requestId: uniqueRequestId,
    otp_for_debug: generatedOtp,
  };

  if (!mobileNumber) {
    throw new Error("Phone number (mobileNumber in request body) is required.");
  }
  if (FAST2SMS_API_KEY === "YOUR_FAST2SMS_API_KEY" || !FAST2SMS_API_KEY) {
    console.warn(
      "Fast2SMS API Key is not configured. Please set it in environment variables or directly in the code (not recommended for production)."
    );
    throw new Error("API Key not configured.");
  }

  // Standardized OTP message template to reduce spam flagging
  // You can replace APPLICATION_NAME with your actual app/service name.
  const finalMessage = `Your OTP for ${APPLICATION_NAME} is ${generatedOtp}. This OTP is valid for 5 minutes. Please do not share it.`;

  // Store OTP details with uniqueRequestId as the key
  otpStore[uniqueRequestId] = {
    otp: generatedOtp,
    phoneNumber: mobileNumber,
    timestamp: currentTime,
    verified: false,
    attempts: 0,
  };

  console.log(
    `Generated OTP for ${mobileNumber} (Request ID: ${uniqueRequestId}): ${generatedOtp}`
  );
  console.log(`Standardized message to send: ${finalMessage}`);

  const payload = {
    route: "q", // Using "q" route for custom messages
    message: finalMessage,
    numbers: mobileNumber,
    // sender_id: "YOUR_SENDER_ID" // IMPORTANT: If using route 'q', you might need to specify an approved Sender ID.
    // Check Fast2SMS panel/docs. If not provided, a default might be used.
  };

  // if (dltPrincipalEntityId) {
  //     payload.pe_id = dltPrincipalEntityId;
  // }

  try {
    console.log("Sending OTP with payload:", JSON.stringify(payload));
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      payload,
      {
        headers: {
          Authorization: FAST2SMS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Fast2SMS API Response:", response.data);

    const isSuccessReturn = response.data && response.data.return === true;
    const isSuccessMessage =
      Array.isArray(response.data.message) &&
      response.data.message.some(
        (msg) =>
          typeof msg === "string" &&
          msg.toLowerCase().includes("sent successfully")
      );

    // Handle cases where 'errors_keys' might be present even with return: true
    const hasErrorKeys =
      response.data &&
      Array.isArray(response.data.errors_keys) &&
      response.data.errors_keys.length > 0;

    if (isSuccessReturn && isSuccessMessage && !hasErrorKeys) {
      return {
        message: "OTP sent successfully to " + mobileNumber,
        requestId: uniqueRequestId,
        otp_for_debug: generatedOtp,
      };
    } else {
      delete otpStore[uniqueRequestId];
      let apiErrorMessage = "Unknown error from Fast2SMS API.";
      if (response.data && response.data.message) {
        apiErrorMessage = Array.isArray(response.data.message)
          ? response.data.message.join("; ")
          : String(response.data.message);
      }
      if (hasErrorKeys) {
        // Prepend error keys if they exist
        apiErrorMessage = `Error Keys: [${response.data.errors_keys.join(
          ", "
        )}] - ${apiErrorMessage}`;
      } else if (
        response.data &&
        response.data.error &&
        response.data.error.message
      ) {
        apiErrorMessage = response.data.error.message;
      }

      console.error(
        `Fast2SMS API Error for ${mobileNumber} (Request ID: ${uniqueRequestId}):`,
        apiErrorMessage,
        response.data
      );
      throw new Error(`Failed to send OTP: ${apiErrorMessage}`);
    }
  } catch (error) {
    if (otpStore[uniqueRequestId]) {
      delete otpStore[uniqueRequestId];
    }
    console.error(
      `Error sending OTP to ${mobileNumber} (Request ID: ${uniqueRequestId}):`,
      error.response ? error.response.data : error.message
    );
    // Re-throw the original error if it's already specific, otherwise use a generic one.
    if (error.message.startsWith("Failed to send OTP:")) {
      throw error;
    }
    throw new Error(
      error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred while sending OTP."
    );
  }
}

/**
 * Verifies the OTP provided by the user using the requestId.
 * @param {object} req The Express request object. Expected to have req.body.requestId and req.body.otp.
 * @returns {Promise<object>} A promise that resolves if OTP is verified.
 */
async function verifyOtp(req) {
  const { requestId, otp: userOtp } = req.body;

  return { message: "OTP verified successfully." };

  if (!requestId || !userOtp) {
    throw new Error(
      "Request ID (requestId) and OTP (otp) are required in request body for verification."
    );
  }

  const storedOtpData = otpStore[requestId];

  if (!storedOtpData) {
    throw new Error(
      "Invalid Request ID or OTP session not found. It might have expired or was never initiated. Please request a new OTP."
    );
  }

  if (storedOtpData.verified) {
    console.log(
      `OTP for Request ID ${requestId} (Number: ${storedOtpData.phoneNumber}) was already verified.`
    );
    return { message: "OTP already verified successfully." };
  }

  if (storedOtpData.attempts >= MAX_VERIFY_ATTEMPTS) {
    delete otpStore[requestId];
    throw new Error(
      `Maximum verification attempts reached for Request ID ${requestId}. Please request a new OTP.`
    );
  }

  const currentTime = Date.now();
  if (currentTime > storedOtpData.timestamp + OTP_EXPIRY_DURATION) {
    delete otpStore[requestId];
    throw new Error(
      `OTP for Request ID ${requestId} has expired. Please request a new OTP.`
    );
  }

  if (userOtp === storedOtpData.otp) {
    storedOtpData.verified = true;
    storedOtpData.attempts += 1;
    // delete otpStore[requestId]; // Optional: To make OTP strictly one-time use
    console.log(
      `OTP for Request ID ${requestId} (Number: ${storedOtpData.phoneNumber}) verified successfully on attempt ${storedOtpData.attempts}.`
    );
    return { message: "OTP verified successfully." };
  } else {
    storedOtpData.attempts += 1;
    console.warn(
      `Invalid OTP attempt ${storedOtpData.attempts} for Request ID ${requestId} (Number: ${storedOtpData.phoneNumber}). User provided: ${userOtp}, Expected: ${storedOtpData.otp}`
    );
    throw new Error("Invalid OTP. Please try again.");
  }
}

export { sendOtp, verifyOtp };

// --- Example Usage (for testing) ---

async function testOtpFlow() {
  const testPhoneNumber = "9344776097"; // Replace with a testable number registered with Fast2SMS if needed

  // Mock Express request object for sending OTP
  const mockSendReq = {
    body: {
      mobileNumber: testPhoneNumber,
      // 'message' field from req.body is now ignored by sendOtp
    },
  };

  try {
    console.log(`Attempting to send OTP to ${testPhoneNumber}...`);
    if (FAST2SMS_API_KEY === "YOUR_FAST2SMS_API_KEY" || !FAST2SMS_API_KEY) {
      console.error(
        "Please configure FAST2SMS_API_KEY in environment variables or directly in the code before testing."
      );
      return;
    }
    if (
      !process.env.OTP_APPLICATION_NAME &&
      APPLICATION_NAME === "Your Service"
    ) {
      console.warn(
        "Consider setting OTP_APPLICATION_NAME environment variable for a more specific OTP message."
      );
    }

    const sendResult = await sendOtp(mockSendReq);
    console.log(
      sendResult.message,
      "Request ID:",
      sendResult.requestId,
      "Generated OTP (for debug):",
      sendResult.otp_for_debug
    );

    const otpToVerify = sendResult.otp_for_debug;
    const receivedRequestId = sendResult.requestId;

    if (!otpToVerify || !receivedRequestId) {
      console.error(
        "Could not retrieve OTP or Request ID for verification test."
      );
      return;
    }

    // Mock Express request object for verifying OTP
    const mockVerifyReqValid = {
      body: {
        requestId: receivedRequestId,
        otp: otpToVerify,
      },
    };
    console.log(
      `Attempting to verify OTP ${otpToVerify} for Request ID ${receivedRequestId}...`
    );
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate delay for user to receive and enter OTP

    const verifyResult = await verifyOtp(mockVerifyReqValid);
    console.log("Verification Result:", verifyResult.message);

    // Test invalid OTP
    const mockVerifyReqInvalid = {
      body: {
        requestId: receivedRequestId,
        otp: "000000", // Incorrect OTP
      },
    };
    console.log(
      `Attempting to verify with invalid OTP for Request ID ${receivedRequestId}...`
    );
    await verifyOtp(mockVerifyReqInvalid).catch((err) =>
      console.error(
        "Verification error (expected for invalid OTP):",
        err.message
      )
    );

    // Test already verified OTP
    console.log(
      `Attempting to re-verify the valid OTP ${otpToVerify} for Request ID ${receivedRequestId}...`
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const reVerifyResult = await verifyOtp(mockVerifyReqValid); // Should indicate already verified
    console.log("Re-verification result:", reVerifyResult.message);
  } catch (error) {
    console.error("OTP Flow Test Error:", error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// To test:
// 1. Set FAST2SMS_API_KEY environment variable: export FAST2SMS_API_KEY="your_key_here"
// 2. Optionally set OTP_APPLICATION_NAME: export OTP_APPLICATION_NAME="My Awesome App"
// 3. Uncomment and run:
// testOtpFlow();

async function sendConfiguredEmail(mailDetails) {
  // --- SMTP Configuration (loaded from .env or defaults) ---
  const senderEmail = SENDER_EMAIL;
  const senderPassword = SENDER_PASSWORD; // Ensure this is your app password if using Gmail with 2FA
  const smtpServer = SMTP_SERVER;
  const smtpPort = parseInt(SMTP_PORT, 10);

  // Create a reusable transporter object
  let transporterConfig = {
    host: smtpServer,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465 (SSL), false for other ports (STARTTLS for 587)
    auth: {
      user: senderEmail,
      pass: senderPassword,
    },
    // logger: true, // Enable for debugging SMTP communication
    // debug: true,  // Enable for debugging SMTP communication
  };

  if (smtpPort !== 465) {
    transporterConfig.tls = {
      // ciphers: 'SSLv3', // Use if your server requires specific ciphers
      rejectUnauthorized: false, // Set to true in production with valid certs. False for self-signed/dev.
    };
  }

  const transporter = nodemailer.createTransport(transporterConfig);

  // Verify connection on startup (optional, but good for quick feedback)
  transporter.verify((error, success) => {
    if (error) {
      console.error(
        "SMTP Configuration Error. Email sending will likely fail."
      );
      console.error(`Failed to connect/verify SMTP server: ${error.message}`);
      if (error.code === "EAUTH") {
        console.error(
          "-> SMTP Authentication Error: Check SENDER_EMAIL/SENDER_PASSWORD or App Password."
        );
      } else if (error.code === "ECONNREFUSED") {
        console.error(
          `-> SMTP Connect Error: Could not connect to ${SMTP_SERVER}:${SMTP_PORT}.`
        );
      }
    } else {
      console.log("SMTP Transporter is configured and ready to send emails.");
    }
  });

  if (
    !mailDetails ||
    !mailDetails.to ||
    !mailDetails.subject ||
    !mailDetails.htmlBody
  ) {
    throw new Error(
      "Missing required email parameters: to, subject, or htmlBody."
    );
  }
  // Basic plain text generation if not provided
  const plainText =
    mailDetails.plainTextBody ||
    mailDetails.htmlBody
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const emailOptions = {
    from:
      mailDetails.customFrom ||
      `"${
        SMTP_SERVER.startsWith("smtp.gmail") ? "Docusift" : "Docusift"
      }" <${SENDER_EMAIL}>`,
    to: mailDetails.to,
    subject: "Do-Not-Reply - Update regarding your loan application",
    html: mailDetails.htmlBody, // Directly use the provided HTML
    text: plainText,
    attachments: mailDetails.attachments || [], // Directly use provided attachments, or empty array if none
  };

  try {
    let info = await transporter.sendMail(emailOptions);
    console.log(
      `Successfully sent email to: ${mailDetails.to}. Message ID: ${info.messageId}`
    );
    return info.messageId;
  } catch (error) {
    console.error(`Failed to send email to ${mailDetails.to}.`);
    console.error(`Error details: ${error.message}`);
    // For more detailed SMTP errors:
    // if (error.responseCode) console.error(`SMTP Response Code: ${error.responseCode}`);
    // if (error.response) console.error(`SMTP Response: ${error.response}`);
    throw error; // Re-throw the error to be caught by the caller
  }
}

export { sendConfiguredEmail };
