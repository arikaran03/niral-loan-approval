import axios from 'axios';

// const BASE_URL = "http://localhost:3001";
// const BASE_URL = "https://h08bsvj6-3001.inc1.devtunnels.ms";
const BASE_URL = "https://docusift-server.vercel.app";

const APP_NAME = "Team Groove";
const APP_DESCRIPTION = "DocuSift - Simplified loan application management";
const APP_LOGO = "./assets/logo.png";
const APP_LOGO_ALT = "DocuSift Logo";
const BANK_NAME = "VidhyaSri Private Limited Bank Uh";
const AUTH_PAGE_DESCIPTION_USER = "Namma Bank welcomes you to DocuSift. Login to access your loan application OR submit a new application.";
const AUTH_PAGE_DESCIPTION_ADMIN = "DocuSift - Simplified loan application management. Login to your admin account to manage users and applications. If you don't have access to create account for applicants, please contact your bank admin.";


const proof_documents = {
  "aadhaar": {
    name: "Type: String, Name of the candidate",
    date_of_birth: "Type: Date, Date of birth in DD-MM-YYYY format",
    aadhaar_number: "Type: Number, A 12 digit number, May contain gaps but return as a single 12 digit number",
    phone_number: "Type: Number, A 10 digit number, May contain gaps but return as a single 10 digit number"
  },
  "pan": {
    name: "Type: String, Name of the candidate",
    pan_number: "Type: mixed of Capital letter and number, May contain gaps but return as a single 10 digit number",
    phone_number: "Type: Number, A 10 digit number, May contain gaps but return as a single 10 digit number",
    date_of_birth: "Type: Date, Date of birth in DD-MM-YYYY format"
  }
}

const axiosInstance = axios.create({
  baseURL: BASE_URL
});

axiosInstance.interceptors.request.use(async (config) => {
  try {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Failed to fetch JWT token:', error);
  }
  return config;
});

axiosInstance.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    // Check if the error is due to unauthorized access (401 status code)
    if (error.response && error.response.status === 401) {
      // Clear any user tokens or session data
      localStorage.clear()

      // Show an alert message to the user
      alert('Your login session expired or you are not authorized. Please log in again.');

      // Redirect the user to the login page
      window.location.href = '/login';
    }

    // Return the error to continue handling in your application
    return Promise.reject(error);
  }
);

export {
  axiosInstance,
  BASE_URL,
  APP_NAME,
  APP_DESCRIPTION,
  APP_LOGO,
  APP_LOGO_ALT,
  BANK_NAME,
  AUTH_PAGE_DESCIPTION_USER,
  AUTH_PAGE_DESCIPTION_ADMIN
}
