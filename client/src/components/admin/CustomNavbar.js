// src/components/CustomNavbar.jsx
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom"; // Import useLocation
import { Navbar, Container, Nav, Dropdown, Spinner } from "react-bootstrap";
import {
  FaUserCircle,
  FaSignOutAlt,
  FaFolderOpen,
  FaPlusCircle,
  FaPaperPlane,
  FaTachometerAlt,
  FaCreditCard,
  FaWpforms,
  FaPercentage,
  FaClipboardList,
  FaHandHoldingUsd
} from "react-icons/fa";
import { BANK_NAME } from "../../config";
import logo from "../../assets/logo.png";
import { axiosInstance } from "../../config";
import "./CustomNavbar.css"; // Assuming you have this CSS file

// Key for storing user data in localStorage
const USER_CACHE_KEY = "userData";

export default function CustomNavbar() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation(); // Get location object

  // Fetch current user profile - now with caching
  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const cachedUser = localStorage.getItem(USER_CACHE_KEY);
        if (cachedUser) {
          const parsedUser = JSON.parse(cachedUser);
          if (parsedUser) {
            if (isMounted) {
              setUser(parsedUser);
              setLoading(false);
            }
            return;
          } else {
            localStorage.removeItem(USER_CACHE_KEY);
          }
        }
      } catch (error) {
        localStorage.removeItem(USER_CACHE_KEY);
      }
      try {
        const { data } = await axiosInstance.get("/api/user/me/navbar");
        if (isMounted) {
          setUser(data);
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
        }
      } catch (err) {
        localStorage.removeItem(USER_CACHE_KEY);
        localStorage.clear();
        if (isMounted) {
          // Only navigate if not already on login page to avoid loop if /api/user/me fails
          if (location.pathname !== "/login") {
            navigate("/login");
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Only load user if not on login page to prevent API call when navigating to login
    if (location.pathname !== "/login") {
      loadUser();
    } else {
      setLoading(false); // Not loading user, so stop loading state
    }

    return () => {
      isMounted = false;
    };
  }, [navigate, location.pathname]); // Added location.pathname to dependencies

  const handleLogout = () => {
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.clear();
    setUser(null);
    navigate("/login");
  };

  if (loading) {
    return (
      <Navbar expand="lg" className="banking-navbar">
        <Container fluid className="justify-content-center">
          <Spinner animation="border" variant="light" size="sm" />
          <span className="ms-2 text-light">Loading navigation...</span>
        </Container>
      </Navbar>
    );
  }

  // If user is not logged in (e.g., on login page or after failed fetch), don't render full navbar
  if (!user && location.pathname !== "/login") {
    // This case might occur if API fails and navigate('/login') happens.
    // To prevent rendering a broken navbar during redirect, return null.
    return null;
  }
  // If on login page and no user, render nothing or a minimal brand
  if (!user && location.pathname === "/login") {
    return (
      <Navbar expand="lg" className="banking-navbar">
        <Container fluid>
          <Navbar.Brand as={Link} to={"/login"} className="navbar-brand-custom">
            <div className="logo-container">
              <img src={logo} alt="Bank Logo" className="navbar-logo" />
            </div>
            <div className="brand-text">
              <span className="bank-name">{BANK_NAME}</span>
            </div>
          </Navbar.Brand>
        </Container>
      </Navbar>
    );
  }

  // This check should be safe now due to the above conditions
  if (!user) return null;

  const isAdmin = user.type === "manager" || user.type === "staff";
  const currentPath = location.pathname;

  return (
    <Navbar expand="lg" className="banking-navbar">
      <Container fluid>
        <Navbar.Brand
          as={Link}
          to={isAdmin ? "/console" : "/"}
          className="navbar-brand-custom"
        >
          <div className="logo-container">
            <img src={logo} alt="Bank Logo" className="navbar-logo" />
          </div>
          <div className="brand-text">
            <span className="bank-name">{BANK_NAME}</span>
            <span className="portal-text">
              {isAdmin ? "Admin Portal" : "User Portal"}
            </span>
          </div>
        </Navbar.Brand>

        <Navbar.Toggle
          aria-controls="main-navigation"
          className="toggle-button"
        />

        <Navbar.Collapse id="main-navigation">
          <Nav className="mx-auto">
            {isAdmin ? (
              <>
                <Nav.Link
                  as={Link}
                  to="/console"
                  className="nav-link-item"
                  active={currentPath === "/console"}
                >
                  <FaTachometerAlt className="nav-icon" /> Dashboard
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to="/console/applications"
                  className="nav-link-item"
                  active={currentPath.startsWith("/console/applications")}
                >
                  <FaPaperPlane className="nav-icon" /> Applications
                </Nav.Link>
                <Nav.Link
                  as={Link}
                  to="/console/loans"
                  className="nav-link-item"
                  active={currentPath.startsWith("/console/loans")}
                >
                  <FaFolderOpen className="nav-icon" /> Loan Schemes
                </Nav.Link>
                {/* /* Admin Repayments Link */}
                        <Nav.Link
                          as={Link}
                          to="/console/repayments"
                          className="nav-link-item"
                          active={currentPath.startsWith("/console/repayments")}
                        >
                          <FaCreditCard className="nav-icon" /> Repayments
                        </Nav.Link>
                        <Nav.Link
                          as={Link}
                          to="/console/form-builder"
                          className="nav-link-item"
                          active={currentPath.startsWith("/console/form-builder")}
                        >
                          <FaWpforms className="nav-icon" /> Create Loan
                        </Nav.Link>
                        <Nav.Link
                          as={Link}
                          to="/console/waiver-builder"
                          className="nav-link-item"
                          active={currentPath.startsWith("/console/waiver-builder")}
                        >
                          <FaPercentage className="nav-icon" /> Create Waiver Scheme
                        </Nav.Link>
                        <Nav.Link
                          as={Link}
                          to="/console/waiver-submissions"
                          className="nav-link-item"
                          active={currentPath.startsWith("/console/waiver-submissions")}
                        >
                          <FaClipboardList className="nav-icon" /> Waiver Submissions
                        </Nav.Link>
                        </>
                      ) : (
                        <>
                        <Nav.Link
                          as={Link}
                          to="/"
                          className="nav-link-item"
                          active={currentPath === "/"}
                        >
                          <FaHandHoldingUsd className="nav-icon" /> Apply for Loan
                        </Nav.Link>
                        <Nav.Link
                          as={Link}
                          to="/dashboard"
                          className="nav-link-item"
                          active={
                          currentPath === "/dashboard" ||
                          currentPath.startsWith("/applications/")
                          } // Also active for viewing full application details
                >
                  <FaTachometerAlt className="nav-icon" /> My Dashboard
                </Nav.Link>
                {/* Applicant Repayments Link */}
                <Nav.Link
                  as={Link}
                  to="/repayments"
                  className="nav-link-item"
                  active={currentPath.startsWith("/repayments")}
                >
                  <FaCreditCard className="nav-icon" /> My Repayments
                </Nav.Link>
              </>
            )}
          </Nav>

          <Nav className="align-items-center">
            <Dropdown align="end" className="profile-dropdown">
              <Dropdown.Toggle
                variant="link"
                id="profile-dropdown"
                className="profile-toggle text-decoration-none d-flex align-items-center p-0"
              >
                <span className="me-2 text-light d-none d-lg-inline mr-2">
                  {user.name || user.email}
                </span>
                <FaUserCircle className="profile-icon fs-4 text-light" />
              </Dropdown.Toggle>

              <Dropdown.Menu className="dropdown-menu-custom shadow-sm">
                <Dropdown.Header>
                  Signed in as <br />
                  <strong>{user.name || user.email}</strong>
                </Dropdown.Header>
                {!location.pathname.endsWith("/profile") && (
                  <>
                    <Dropdown.Divider />
                    <Dropdown.Item
                      as={Link}
                      to={
                        user.type.includes("user", "applicant")
                          ? "/profile"
                          : "/console/profile"
                      }
                      className={`dropdown-item-custom ${
                        currentPath === "/profile" ? "active" : ""
                      }`}
                    >
                      <FaUserCircle className="dropdown-icon" /> Account
                      Settings
                    </Dropdown.Item>
                  </>
                )}
                <Dropdown.Divider className="dropdown-divider" />
                <Dropdown.Item
                  onClick={handleLogout}
                  className="dropdown-item-custom logout-item text-danger"
                >
                  <FaSignOutAlt className="dropdown-icon" /> Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
