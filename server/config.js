// load dotenv file
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URL = process.env.MONGODB_URL;
const PORT = process.env.PORT;
const JWT_SECRET = process.env.JWT_SECRET;
const CLIENT_URL = process.env.CLIENT_URL;
const DB_NAME = process.env.DB_NAME;

// Email Sending configuration
const SENDER_EMAIL = process.env.SENDER_EMAIL;
const SENDER_PASSWORD = process.env.SENDER_PASSWORD;
const SMTP_SERVER = process.env.SMTP_SERVER; // smtp.gmail.com 
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);

export {
    MONGODB_URL,
    PORT,
    JWT_SECRET,
    CLIENT_URL,
    DB_NAME,
    SENDER_EMAIL,
    SENDER_PASSWORD,
    SMTP_SERVER,
    SMTP_PORT
}