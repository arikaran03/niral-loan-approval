import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Container, Row, Col, Form } from "react-bootstrap";
import { FaUserShield, FaUser, FaCreditCard, FaLock } from "react-icons/fa";
import { axiosInstance, APP_NAME } from "../../config"; // Assuming these are correctly set up
import { checkTokens } from "./config"; // Assuming this is correctly set up
import "./Login.css"; // Ensure this CSS file exists and is styled

// Define regex patterns for validation for clarity and reusability
const ACCOUNT_NUMBER_REGEX = /^\d{16}$/;
const MPIN_REGEX = /^\d{4}$/;

export default function Login() {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState("user"); // "user" or "admin"
  const [accountNumber, setAccountNumber] = useState("");
  const [mpin, setMpin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(""); // For displaying server/submission errors
  const [isFormValid, setIsFormValid] = useState(false);

  // Effect to check if the user is already logged in on component mount
  useEffect(() => {
    checkTokens(navigate);
  }, [navigate]);

  // Effect to validate the form whenever relevant inputs or loginType change
  useEffect(() => {
    if (loginType === "user") {
      setIsFormValid(
        ACCOUNT_NUMBER_REGEX.test(accountNumber) && MPIN_REGEX.test(mpin)
      );
    } else { // admin login
      setIsFormValid(email.trim() !== "" && password.trim() !== "");
    }
  }, [loginType, accountNumber, mpin, email, password]);

  // Effect to clear any existing server error message when the user starts editing
  // the relevant input fields *after* an error has been displayed.
  useEffect(() => {
    if (error) {
        setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNumber, mpin, email, password]); 
  // Note: `error` is intentionally not in this dependency array to prevent
  // clearing the error immediately after it's set by handleSubmit.

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors before a new submission attempt

    const payload =
      loginType === "user"
        ? { account_number: accountNumber, mpin, type: loginType }
        : { email, password, type: "staff" }; // Server expects "staff" for admin type

    try {
      const res = await axiosInstance.post(`/api/auth/login`, payload);
      
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("type", loginType); 
      checkTokens(navigate); 
    } catch (err) {
      const msg = err.response?.data?.error || "Login failed. Please try again.";
      setError(msg);
    }
  };

  // Handler for switching login type
  const handleLoginTypeChange = (type) => {
    setLoginType(type);
    setAccountNumber("");
    setMpin("");
    setEmail("");
    setPassword("");
    setError("");
    setIsFormValid(false); 
  };

  // onChange handler for Account Number: Sanitize input to allow only digits
  const handleAccountNumberChange = (e) => {
    const value = e.target.value;
    const numericValue = value.replace(/\D/g, ''); // Remove all non-digit characters
    // Ensure the numeric value does not exceed the maxLength (though HTML maxLength helps)
    setAccountNumber(numericValue.slice(0, 16));
  };

  // onChange handler for MPIN: Sanitize input to allow only digits
  const handleMpinChange = (e) => {
    const value = e.target.value;
    const numericValue = value.replace(/\D/g, ''); // Remove all non-digit characters
     // Ensure the numeric value does not exceed the maxLength
    setMpin(numericValue.slice(0, 4));
  };

  return (
    <div className="login-container">
      <Container>
        <header className="auth-header">
          <Link to="/" className="brand-link">
            <img
              src="https://i.ibb.co/3cqXBWg/avatar6183774686-removebg-preview.png"
              alt="Logo"
              className="brand-logo"
            />
            <h1 className="app-name">{APP_NAME}</h1>
          </Link>
          <p className="tagline">Secure access to your financial world</p>
        </header>

        <Row className="justify-content-center">
          <Col lg={6} className="auth-illustration d-none d-lg-block">
            <div className="content-wrapper">
              <h2 className="auth-title">Welcome Back</h2>
              <p className="auth-description">
                {loginType === "admin"
                  ? "Manage loan applications and user accounts with precision."
                  : "Track your loan status and manage your financial profile."}
              </p>
              <div className="features-list">
                <div className="feature-item">
                  <div className="feature-icon">
                    <FaUserShield />
                  </div>
                  <span>Secured Loan Processing</span>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <FaCreditCard />
                  </div>
                  <span>Real-time application tracking</span>
                </div>
              </div>
            </div>
          </Col>

          <Col lg={6} className="auth-form-column">
            <div className="auth-form-container">
              <div className="role-toggle">
                <Button
                  variant="light"
                  className={`toggle-btn ${loginType === "user" ? "active" : ""}`}
                  onClick={() => handleLoginTypeChange("user")}
                >
                  <FaUser className="me-2" />
                  Applicant
                </Button>
                <Button
                  variant="light"
                  className={`toggle-btn ${loginType === "admin" ? "active" : ""}`}
                  onClick={() => handleLoginTypeChange("admin")}
                >
                  <FaUserShield className="me-2" />
                  Admin
                </Button>
              </div>

              <h3 className="form-title">Sign In to Continue</h3>
              
              <Form onSubmit={handleSubmit} className="login-form">
                {loginType === "user" ? (
                  <>
                    <Form.Group className="form-group mb-3">
                      <Form.Label><FaCreditCard className="input-icon me-2" /> Account Number</Form.Label>
                      <Form.Control
                        type="text" // Keep as text to allow sanitization; browser "number" type has its own UI
                        placeholder="16-digit account number"
                        value={accountNumber}
                        maxLength={16} // HTML5 maxLength attribute
                        onChange={handleAccountNumberChange}
                        isInvalid={!!(accountNumber && !ACCOUNT_NUMBER_REGEX.test(accountNumber))}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        Must be 16 digits. Only numbers are allowed (no spaces or letters).
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="form-group mb-3">
                      <Form.Label><FaLock className="input-icon me-2" /> MPIN</Form.Label>
                      <Form.Control
                        type="password" // Use password for masking, but sanitization still applies
                        placeholder="4-digit security PIN"
                        value={mpin}
                        maxLength={4} // HTML5 maxLength attribute
                        onChange={handleMpinChange}
                        isInvalid={!!(mpin && !MPIN_REGEX.test(mpin))}
                        required
                      />
                      <Form.Control.Feedback type="invalid">
                        Must be 4 digits. Only numbers are allowed (no spaces or letters).
                      </Form.Control.Feedback>
                    </Form.Group>
                  </>
                ) : ( // Admin login
                  <>
                    <Form.Group className="form-group mb-3">
                      <Form.Label><FaUser className="input-icon me-2" /> Email</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        isInvalid={!!(email && email.trim() === "")} 
                        required
                      />
                       <Form.Control.Feedback type="invalid">
                        Email is required.
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="form-group mb-3">
                      <Form.Label><FaLock className="input-icon me-2" /> Password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        isInvalid={!!(password && password.trim() === "")} 
                        required
                      />
                       <Form.Control.Feedback type="invalid">
                        Password is required.
                      </Form.Control.Feedback>
                    </Form.Group>
                  </>
                )}

                {error && (
                  <div className="error-message alert alert-danger d-flex align-items-center p-2">
                    <div className="alert-icon me-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16">
                        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                      </svg>
                    </div>
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="submit-btn w-100"
                  disabled={!isFormValid}
                >
                  Sign In
                </Button>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
