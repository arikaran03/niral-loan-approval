import { Link, useNavigate } from "react-router-dom";
import { axiosInstance, APP_NAME } from "../../config";
import { useState } from "react";
import { Button, Container, Form, Row, Col } from "react-bootstrap";
import { FaUserShield, FaUser, FaEnvelope, FaLock } from "react-icons/fa";
import { AUTH_PAGE_DESCIPTION_USER, AUTH_PAGE_DESCIPTION_ADMIN } from "../../config";
import "./Register.css";

const Register = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loginType, setLoginType] = useState("applicant");
  const [title, setTitle] = useState("Admin Attention!");
  const [description, setDescription] = useState(
    "Account will be created on the provided name and details will be displayed only once in the dashboard. Please make sure the name is correct and saved with yourself."
  );
  const [status, setStatus] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    const confirmPassword = e.target.confirmPassword.value;

    if (name.length < 3) {
      setError("Name too short");
      return;
    } else if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    } else if (password !== confirmPassword) {
      setError("Password and Confirm password must be the same");
      return;
    }

    const role = loginType === "admin" ? "staff" : "user";

    const requestBody = {
      name,
      email,
      password,
      role,
    };

    console.log("Request Body:", requestBody);

    try {
      const response = await axiosInstance.post(`/api/auth/register`, requestBody);

      console.log("Response:", response.data);

      if (response.status === 201) {
        setTitle("Account Created!");
        setDescription(
          "Account created successfully. Account details will be displayed in the dashboard."
        );
        setStatus(true);
        setError("");
        alert(JSON.stringify(response.data, null, 2));
      } else {
        setError(response.data.error || "Something went wrong");
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to register.");
      }
      console.error("Failed to register:", err);
    }
    finally {
      setTimeout(() => {
        setError("");
      }, 2000);
    }
  };

  return (
    <div className="register-container">
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
          <p className="tagline">Start your financial journey with us</p>
        </header>

        <Row className="justify-content-center">
          <Col lg={6} className="auth-illustration d-none d-lg-block">
            <div className="content-wrapper">
              <h2 className="auth-title">Welcome to {APP_NAME}</h2>
              <p className="auth-description">
                {loginType === "admin"
                  ? "Manage loan applications efficiently with powerful admin tools"
                  : "Apply for loans quickly and track your application status in real-time"}
              </p>
              <div className="features-list">
                <div className="feature-item">
                  <div className="feature-icon">
                    <FaUserShield />
                  </div>
                  <span>Secure & Encrypted</span>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <FaUser />
                  </div>
                  <span>User Friendly Dashboard</span>
                </div>
              </div>
            </div>
          </Col>

          <Col lg={6} className="auth-form-column">
            <div className="auth-form-container">
              <div className="role-toggle">
                <Button
                  variant="light"
                  className={`toggle-btn ${loginType === "applicant" ? "active" : ""}`}
                  onClick={() => {
                    setLoginType("applicant");
                    setDescription(AUTH_PAGE_DESCIPTION_USER);
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
                    setDescription(AUTH_PAGE_DESCIPTION_ADMIN);
                  }}
                >
                  <FaUserShield className="me-2" />
                  Admin
                </Button>
              </div>

              <h3 className="form-title">Create Account</h3>
              
              <Form onSubmit={handleSubmit} className="register-form">
                <Form.Group className="form-group">
                  <Form.Label><FaUser className="input-icon" /> Full Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    placeholder="Enter your full name"
                    required
                  />
                </Form.Group>

                <Form.Group className="form-group">
                  <Form.Label><FaEnvelope className="input-icon" /> Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    placeholder="Enter your email"
                    required
                  />
                </Form.Group>

                <Form.Group className="form-group">
                  <Form.Label><FaLock className="input-icon" /> Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    placeholder="Create password (min 6 characters)"
                    required
                  />
                </Form.Group>

                <Form.Group className="form-group">
                  <Form.Label><FaLock className="input-icon" /> Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="confirmPassword"
                    placeholder="Confirm your password"
                    required
                  />
                </Form.Group>

                {error && (
                  <div className="error-message">
                    <div className="alert-icon">!</div>
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="submit-btn"
                  disabled={error !== ""}
                >
                  Create Account
                </Button>

                <p className="login-link">
                  Already have an account? <Link to="/login">Sign in</Link>
                </p>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Register;