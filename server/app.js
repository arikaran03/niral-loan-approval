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
import imageRoutes from "./routes/Image.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import openAIRoutes from "./routes/openai.routes.js";
import {
  applicantRepaymentRoutes,
  adminRepaymentRoutes,
} from "./routes/loanRepayment.routes.js";
import govSchemaRoutes from "./routes/schema.routes.js";

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
  "https://docusift-groove.vercel.app",
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
app.use("/api/image", imageRoutes);

// Admin-only dashboard stats
app.use("/api/admin", adminRoutes);

app.use("/api/application", openAIRoutes);

app.use("/api/repayments", applicantRepaymentRoutes); // For applicant-facing endpoints

app.use("/api/admin/repayments", adminRepaymentRoutes); // For admin-facing endpoints
app.use("/api/document", govSchemaRoutes);

// Global error handler (catches both express-jwt errors and any thrown below)
app.use(errorHandler);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
export default app;
