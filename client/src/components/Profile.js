// src/components/Profile.jsx
import { useState, useEffect } from "react";
import { axiosInstance } from "../config";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
  ListGroup,
  Badge
} from "react-bootstrap";
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaUserShield,
  FaUsersCog,
  FaKey,
  FaInfoCircle,
  FaExternalLinkAlt,
  FaLandmark,
  FaCog
} from "react-icons/fa";
import { Link } from "react-router-dom";
import './Profile.css';
import LiquidLoader from "./super/LiquidLoader";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [passwordData, setPasswordData] = useState({ old_password: "", new_password: "" });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(true);

  const PASSWORD_CHANGE_ENABLED = false;

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
        setLoading(true); setMessage("");
        try {
            const { data } = await axiosInstance.get("/api/user/me");
            if (isMounted) setUser(data);
        } catch (err) {
            console.error(err);
            if (isMounted) { setMessage(err.response?.data?.error || "Failed to load profile."); setMessageType("danger"); }
        } finally { if (isMounted) setLoading(false); }
    };
    fetchProfile();
    return () => { isMounted = false; };
  }, []);

  const handlePasswordChange = (e) => setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  const submitPassword = (e) => { e.preventDefault(); };

  if (loading) {
    return <LiquidLoader/>
  }

  if (!user) {
    return (
      <Container className="mt-5">
         {message && <Alert variant={messageType || 'danger'} className="shadow-sm">{message}</Alert>}
         {!message && <Alert variant="warning" className="shadow-sm">Could not load user profile data.</Alert>}
      </Container>
    );
  }

  const isAdmin = user.type === "manager" || user.type === "staff";
  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <Container className="profile-page-container my-4 my-lg-5">
      <Row className="justify-content-center">
        <Col xl={9} lg={10}>
        

          {/* --- Profile Header --- */}
           <div className="profile-header mb-4 text-center">
             <div className="avatar-placeholder mb-3">
               <span>{userInitial}</span>
             </div>
             <h2 className="fw-bold text-dark mb-1">Welcome, {user.name || 'User'}!</h2>
             <p className="text-muted">Manage your profile information and settings below.</p>
           </div>

           {/* Display General Messages */}
          {message && !loading && (
            <Alert variant={messageType} className="mb-4 shadow-sm" dismissible onClose={() => setMessage("")}>
              {message}
            </Alert>
          )}

          {/* --- Profile Information Card --- */}
          <Card className="shadow-sm mb-4 profile-card">
            {/* Adjusted icon margin to me-2 */}
            <Card.Header className="profile-card-header">
              <FaUser className="me-2" /> Profile Information
            </Card.Header>
            <Card.Body className="p-4">
               <ListGroup variant="flush">
                 {/* Adjusted icon margin to me-3 */}
                 <ListGroup.Item className="d-flex align-items-center px-0 py-3">
                   <FaUser size={18} className="text-primary me-3 flex-shrink-0 mr-3" />
                   <div className="flex-grow-1">
                     <small className="text-muted d-block">Name</small>
                     <span className="fw-medium profile-value">{user.name || 'N/A'}</span>
                   </div>
                 </ListGroup.Item>
                 <ListGroup.Item className="d-flex align-items-center px-0 py-3">
                   <FaEnvelope size={18} className="text-primary me-3 flex-shrink-0 mr-3" />
                   <div className="flex-grow-1">
                     <small className="text-muted d-block">Email</small>
                     <span className="fw-medium profile-value">{user.email || 'N/A'}</span>
                   </div>
                 </ListGroup.Item>
                 <ListGroup.Item className="d-flex align-items-center px-0 py-3">
                   <FaKey size={18} className="text-primary me-3 flex-shrink-0 mr-3" />
                   <div className="flex-grow-1">
                     <small className="text-muted d-block">Account #</small>
                     <span className="fw-medium font-monospace profile-value">{user.account_number || 'N/A'}</span>
                   </div>
                 </ListGroup.Item>
                 {isAdmin && (
                   <ListGroup.Item className="d-flex align-items-center px-0 py-3">
                     <FaUserShield size={18} className="text-primary me-3 flex-shrink-0 mr-3" />
                     <div className="flex-grow-1">
                       <small className="text-muted d-block">Role</small>
                       <Badge bg="info-subtle" text="info-emphasis" className="text-uppercase fw-bold role-badge">
                         {user.type}
                       </Badge>
                     </div>
                   </ListGroup.Item>
                 )}
               </ListGroup>
            </Card.Body>
          </Card>

          {/* --- Admin Panel Links Card --- */}
          {isAdmin && (
            <Card className="shadow-sm mb-4 admin-card">
              {/* Adjusted icon margin to me-2 */}
              <Card.Header className="profile-card-header">
                <FaUsersCog className="me-2" /> Administrator Panel
              </Card.Header>
               <ListGroup variant="flush">
                    {/* Adjusted icon margin to me-2 */}
                    <ListGroup.Item action as={Link} to="/console/loans" className="admin-link-item">
                         <FaLandmark className="me-2 text-secondary"/> Manage Loan Schemes
                        <FaExternalLinkAlt className="ml-2 text-muted small ms-auto" />
                    </ListGroup.Item>
               </ListGroup>
            </Card>
          )}

          {/* --- Security Card - Disabled --- */}
          <Card className="shadow-sm mb-4 security-card">
             {/* Adjusted icon margin to me-2 */}
            <Card.Header className="profile-card-header">
              <FaLock className="me-2" /> Security Settings
            </Card.Header>
            <Card.Body className={`p-4 ${!PASSWORD_CHANGE_ENABLED ? 'disabled-section' : ''}`}>
               <h6 className="mb-3 text-dark">Update Password</h6>
              <Form onSubmit={submitPassword}>
                 <fieldset disabled={!PASSWORD_CHANGE_ENABLED}>
                    <Form.Group className="mb-3" controlId="old_password">
                    <Form.Label className="text-muted small"> Current Password </Form.Label>
                    <Form.Control
                        type="password" name="old_password" value={passwordData.old_password}
                        onChange={handlePasswordChange} required={PASSWORD_CHANGE_ENABLED}
                        placeholder="••••••••"
                    />
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="new_password">
                    <Form.Label className="text-muted small"> New Password </Form.Label>
                    <Form.Control
                        type="password" name="new_password" value={passwordData.new_password}
                        onChange={handlePasswordChange} required={PASSWORD_CHANGE_ENABLED}
                        placeholder="••••••••"
                    />
                    </Form.Group>

                    <div className="d-flex justify-content-between align-items-center mt-4">
                       {!PASSWORD_CHANGE_ENABLED && (
                           <Badge bg="warning-subtle" text="warning-emphasis" className="p-2 disabled-message">
                               {/* Adjusted icon margin to me-2 */}
                               <FaInfoCircle className="me-2"/> Password change is currently disabled.
                           </Badge>
                       )}
                        <Button
                            type="submit" variant="primary" size="sm"
                            className={`change-password-button ${!PASSWORD_CHANGE_ENABLED ? 'disabled' : ''}`}
                            disabled={!PASSWORD_CHANGE_ENABLED} aria-disabled={!PASSWORD_CHANGE_ENABLED}
                        >
                             {/* Adjusted icon margin to me-1 */}
                            <FaCog className="me-1" /> Update Password
                        </Button>
                    </div>
                 </fieldset>
              </Form>
            </Card.Body>
          </Card>

        </Col>
      </Row>
    </Container>
  );
};

export default Profile;



