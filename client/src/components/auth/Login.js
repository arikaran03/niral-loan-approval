import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Container, Row, Col, Form } from "react-bootstrap";
import { FaUserShield, FaUser, FaCreditCard, FaLock } from "react-icons/fa";
import { axiosInstance, APP_NAME } from "../../config";
import { checkTokens } from "./config";
import "./Login.css"; // Create this CSS file

export default function Login() {
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState("user");
  const [accountNumber, setAccountNumber] = useState("");
  const [mpin, setMpin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isFormValid, setIsFormValid] = useState(false);

  useEffect(() => {
    checkTokens(navigate);
  }, [navigate]);

  useEffect(() => {
    if (loginType === "user") {
      setIsFormValid(/^\d{16}$/.test(accountNumber) && /^\d{4}$/.test(mpin));
      if (error) setError("");
    } else {
      setIsFormValid(email.trim() !== "" && password.trim() !== "");
      if (error) setError("");
    }
  }, [loginType, accountNumber, mpin, email, password, error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const payload =
      loginType === "user"
        ? { account_number: accountNumber, mpin, type: loginType }
        : { email, password, type: "staff" };

    try {
      const res = await axiosInstance.post(`/api/auth/login`, payload);
      
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("type", loginType);
      checkTokens(navigate);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Login failed";
      setError(msg);
    }
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
                  ? "Manage loan applications and user accounts with precision"
                  : "Track your loan status and manage your financial profile"}
              </p>
              <div className="features-list">
                <div className="feature-item">
                  <div className="feature-icon">
                    <FaUserShield />
                  </div>
                  <span>Military-grade encryption</span>
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
                  onClick={() => {
                    setLoginType("user");
                    setError("");
                    setEmail("");
                    setPassword("");
                  }}
                >
                  <FaUser className="me-2" />
                  Applicant
                </Button>
                <Button
                  variant="light"
                  className={`toggle-btn ${loginType === "admin" ? "active" : ""}`}
                  onClick={() => {
                    setLoginType("admin");
                    setError("");
                    setAccountNumber("");
                    setMpin("");
                  }}
                >
                  <FaUserShield className="me-2" />
                  Admin
                </Button>
              </div>

              <h3 className="form-title">Sign In to Continue</h3>
              
              <Form onSubmit={handleSubmit} className="login-form">
                {loginType === "user" ? (
                  <>
                    <Form.Group className="form-group">
                      <Form.Label><FaCreditCard className="input-icon" /> Account Number</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="16-digit account number"
                        value={accountNumber}
                        maxLength={16}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        isInvalid={accountNumber !== "" && !/^\d{16}$/.test(accountNumber)}
                      />
                      <Form.Control.Feedback type="invalid">
                        Must be exactly 16 digits
                      </Form.Control.Feedback>
                    </Form.Group>

                    <Form.Group className="form-group">
                      <Form.Label><FaLock className="input-icon" /> MPIN</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="4-digit security PIN"
                        value={mpin}
                        maxLength={4}
                        onChange={(e) => setMpin(e.target.value)}
                        isInvalid={mpin !== "" && !/^\d{4}$/.test(mpin)}
                      />
                      <Form.Control.Feedback type="invalid">
                        Must be exactly 4 digits
                      </Form.Control.Feedback>
                    </Form.Group>
                  </>
                ) : (
                  <>
                    <Form.Group className="form-group">
                      <Form.Label><FaUser className="input-icon" /> Email</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </Form.Group>

                    <Form.Group className="form-group">
                      <Form.Label><FaLock className="input-icon" /> Password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Form.Group>
                  </>
                )}

                {error && (
                  <div className="error-message">
                    <div className="alert-icon">!</div>
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="submit-btn"
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