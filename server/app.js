import express from "express";
import morgan from "morgan";
import cors from "cors";
import mongodbConnect from "./database/db.js";
import cookieParser from "cookie-parser";
import responseTime from "response-time";

import {
  authMiddleware,
  attachUser,
  errorHandler,
} from "./middlewares/auth.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import adminUserRoutes from "./routes/adminUser.routes.js";
import loanRoutes from "./routes/loan.routes.js";
import loanSubmissionRoutes from "./routes/loanSubmission.routes.js";
import fileRoutes from "./routes/file.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import openAIRoutes from "./routes/openai.routes.js";
import {
  applicantRepaymentRoutes,
  adminRepaymentRoutes,
} from "./routes/loanRepayment.routes.js";
import govSchemaRoutes from "./routes/schema.routes.js";
import { sendOtp, verifyOtp } from "./functions/communicate.js";
import waiverSchemeRoutes from "./routes/waiverScheme.routes.js";
import waiverSubmissionRoutes from "./routes/waiverSubmission.routes.js";

mongodbConnect();

const app = express();

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Response time tracking
app.use(
  responseTime((req, res, time) => {
    res.responseTime = time.toFixed(2);
  })
);

// Morgan logging (skip OPTIONS)
morgan.token("response-time", (req, res) => `${res.responseTime}ms`);
morgan.token("method", (req) => req.method);
morgan.token("url", (req) => req.url);
morgan.token("status", (req, res) => res.statusCode);
const customMorgan = (req, res, next) => {
  if (req.method !== "OPTIONS") {
    morgan(":method :url :status - :response-time")(req, res, next);
  } else {
    next();
  }
};
app.use(customMorgan);

// Cookie parsing
app.use(cookieParser());

// CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "https://h08bsvj6-3000.inc1.devtunnels.ms",
  "https://docusift-groove.vercel.app"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Handle preflight requests
app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(204);
});

// Healthcheck
app.get("/healthcheck", (req, res) => {
  res.json({ status: "success" });
});

// Public auth routes
app.use("/api/auth", authRoutes);

// Protected routes — require valid JWT
app.use(authMiddleware);
app.use(attachUser);

// User self-service
app.use("/api/user", userRoutes);

// Admin user management (manager/staff only)
app.use("/api/admin/users", adminUserRoutes);

// Loan management
app.use("/api/loans", loanRoutes);

// Loan submissions
app.use("/api/application", loanSubmissionRoutes);

// Image upload & fetch
app.use("/api/image", fileRoutes);

// Admin-only dashboard stats
app.use("/api/admin", adminRoutes);

app.use("/api/application", openAIRoutes);

app.use("/api/repayments", applicantRepaymentRoutes); // For applicant-facing endpoints

app.use("/api/admin/repayments", adminRepaymentRoutes); // For admin-facing endpoints

app.use("/api/document", govSchemaRoutes);

app.post("/api/otp/send", async (req, res) => { // Added async and res
  try {
    // The sendOtp function from otp_functions_nodejs expects req.body to have:
    // - mobileNumber: The phone number to send OTP to.
    // - message: The message template string with "{OTP}" placeholder.
    // It will be called as sendOtp(req)

    const result = await sendOtp(req); // Pass the entire req object

    // Send back the requestId to the client, as it's needed for verification
    res.status(200).json({
      message: `OTP sent successfully to ${req.body.mobileNumber}`, // Or result.message
      requestId: result.requestId // Crucial for the client to use in the verify step
    });
  } catch (error) {
    console.error("Error sending OTP from route:", error.message);
    // Determine status code based on error type
    let statusCode = 500; // Default to internal server error
    if (error.message.includes("required") || error.message.includes("placeholder") || error.message.includes("API Key not configured")) {
        statusCode = 400; // Bad request from client or server misconfiguration perceived as bad input
    } else if (error.message.startsWith("Failed to send OTP:")) {
        statusCode = 502; // Bad Gateway - if the external API (Fast2SMS) failed
    }
    res.status(statusCode).json({ error: error.message || "Failed to send OTP" });
  }
});

app.post("/api/otp/verify", async (req, res) => { // Added async and res
  try {
    // The verifyOtp function from otp_functions_nodejs expects req.body to have:
    // - requestId: The unique ID received from the /api/otp/send response.
    // - otp: The OTP entered by the user.
    // It will be called as verifyOtp(req)

    await verifyOtp(req); // Pass the entire req object

    res.status(200).json({ verified: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error verifying OTP from route:", error.message);
    let statusCode = 400; // Default for client-side errors (invalid OTP, expired, max attempts, bad requestId)
    if (error.message.includes("service failed") || error.message.includes("unexpected error")) {
        statusCode = 500; // Internal server error
    } else if (error.message.includes("Invalid Request ID") || error.message.includes("Maximum verification attempts") || error.message.includes("OTP has expired") || error.message.includes("Invalid OTP")) {
        statusCode = 400; // Specific client errors
    }
    res.status(statusCode).json({ verified: false, error: error.message || "Failed to verify OTP" });
  }
});

app.use('/api/waiver-schemes', waiverSchemeRoutes);

app.use('/api/waiver-submissions', waiverSubmissionRoutes);

// Global error handler (catches both express-jwt errors and any thrown below)
app.use(errorHandler);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => {
//   console.log(`Server started on port ${PORT}`);
// });
export default app;
