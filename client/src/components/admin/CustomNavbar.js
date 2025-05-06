// src/components/CustomNavbar.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Navbar, Container, Nav, Dropdown, Spinner } from "react-bootstrap";
import {
  FaUserCircle,
  FaSignOutAlt,
  FaHome,
  FaFolderOpen,
  FaPlusCircle,
  FaPaperPlane,
  FaTachometerAlt,
} from "react-icons/fa";
import { BANK_NAME } from "../../config";
import logo from "../../assets/logo.png";
import { axiosInstance } from "../../config";
import "./CustomNavbar.css"; // Assuming you have this CSS file

// Key for storing user data in localStorage
const USER_CACHE_KEY = "userData";

export default function CustomNavbar() {
  const [user, setUser] = useState(null);
  // Start with loading true until cache is checked or API call finishes
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch current user profile - now with caching
  useEffect(() => {
    let isMounted = true; // Prevent state update on unmounted component

    const loadUser = async () => {
      // 1. Try loading from localStorage cache first
      try {
        const cachedUser = localStorage.getItem(USER_CACHE_KEY);
        if (cachedUser) {
          const parsedUser = JSON.parse(cachedUser);
          // Basic check if parsed data looks like a user object
          if (parsedUser && parsedUser._id && parsedUser.email) {
             if (isMounted) {
                 console.log("Navbar: Loaded user from cache.");
                 setUser(parsedUser);
                 setLoading(false); // Stop loading, we have data
             }
            return; // Exit early, no need to call API
          } else {
            // Invalid data in cache, remove it
            localStorage.removeItem(USER_CACHE_KEY);
          }
        }
      } catch (error) {
        // Error parsing cache, remove invalid data
        console.error("Navbar: Error reading user cache:", error);
        localStorage.removeItem(USER_CACHE_KEY);
      }

      // 2. If cache miss or invalid, call the API
      console.log("Navbar: Cache miss or invalid, calling /api/user/me");
      try {
        const { data } = await axiosInstance.get("/api/user/me");
        if (isMounted) {
          setUser(data);
          // 3. Cache the fetched data
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
          console.log("Navbar: User fetched from API and cached.");
        }
      } catch (err) {
        // 4. On API error, clear cache and log out
        console.error("Navbar: Failed to fetch user:", err);
        localStorage.removeItem(USER_CACHE_KEY); // Clear potentially invalid cache
        localStorage.clear(); // Clear other potential auth tokens etc.
        if (isMounted) {
          navigate("/login"); // Redirect to login
        }
      } finally {
         if (isMounted) {
             setLoading(false); // Stop loading after API call attempt
         }
      }
    };

    loadUser();

    return () => { isMounted = false; } // Cleanup function

  }, [navigate]); // navigate dependency is technically stable but included

  const handleLogout = () => {
    // Ensure both the specific user cache and potentially other auth tokens are cleared
    localStorage.removeItem(USER_CACHE_KEY);
    localStorage.clear(); // Use clear() for broader cleanup if needed
    setUser(null); // Clear user state immediately
    navigate("/login");
  };

  // While loading user (either from cache check or API call)
  if (loading) {
    return (
      <Navbar expand="lg" className="banking-navbar">
        <Container fluid className="justify-content-center">
          {/* Optionally add the brand here even during load */}
          <Spinner animation="border" variant="light" size="sm"/>
          <span className="ms-2 text-light">....</span>
        </Container>
      </Navbar>
    );
  }

  // If loading is finished but user is still null (should only happen on error redirect)
  if (!user) {
     // Render minimal navbar or null, as redirect should happen
     return null;
     // Or a minimal navbar:
     /*
     return (
       <Navbar expand="lg" className="banking-navbar">
         <Container fluid>
           <Navbar.Brand as={Link} to="/" className="navbar-brand-custom">...</Navbar.Brand>
         </Container>
       </Navbar>
     );
     */
  }

  // User is loaded (from cache or API)
  const isAdmin = user.type === "manager" || user.type === "staff";

  return (
    <Navbar expand="lg" className="banking-navbar">
      <Container fluid>
        {/* Brand Section */}
        <Navbar.Brand as={Link} to={isAdmin ? "/console" : "/"} className="navbar-brand-custom">
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
          {/* Center Navigation Links */}
          <Nav className="mx-auto">
            {isAdmin ? (
              <>
                {/* Link to admin dashboard */}
                <Nav.Link as={Link} to="/console" className="nav-link-item">
                  <FaTachometerAlt className="nav-icon" /> Dashboard
                </Nav.Link>
                {/* Link to view all applications */}
                <Nav.Link as={Link} to="/console/applications" className="nav-link-item">
                  <FaPaperPlane className="nav-icon" /> Applications
                </Nav.Link>
                 {/* Link to view loan schemes */}
                <Nav.Link as={Link} to="/console/loans" className="nav-link-item">
                  <FaFolderOpen className="nav-icon" /> Loan Schemes
                </Nav.Link>
                 {/* Link to create/build loan schemes */}
                <Nav.Link as={Link} to="/console/form-builder" className="nav-link-item">
                  <FaPlusCircle className="nav-icon" /> Create Loan
                </Nav.Link>
              </>
            ) : (
              <>
                {/* Link for regular users to apply */}
                <Nav.Link as={Link} to="" className="nav-link-item"> {/* Changed path to /apply */}
                  <FaPaperPlane className="nav-icon" /> Apply for Loan
                </Nav.Link>
                 {/* Link for regular users to view their dashboard/submissions */}
                 <Nav.Link as={Link} to="/dashboard" className="nav-link-item"> {/* Added dashboard link */}
                  <FaTachometerAlt className="nav-icon" /> My Dashboard
                </Nav.Link>
              </>
            )}
          </Nav>

          {/* Right Navigation Section */}
          <Nav className="align-items-center">
            <Dropdown align="end" className="profile-dropdown">
              <Dropdown.Toggle variant="link" id="profile-dropdown" className="profile-toggle text-decoration-none d-flex align-items-center p-0">
                 {/* Display user name or email if available */}
                <span className="me-2 text-light d-none d-lg-inline"> {/* Hide on smaller screens */}
                    {user.name || user.email}
                </span>
                <FaUserCircle className="profile-icon fs-4 text-light" />
              </Dropdown.Toggle>

              <Dropdown.Menu className="dropdown-menu-custom shadow-sm">
                 <Dropdown.Header>
                    Signed in as <br/><strong>{user.name || user.email}</strong>
                 </Dropdown.Header>
                 <Dropdown.Divider />
                <Dropdown.Item as={Link} to={"/profile"} className="dropdown-item-custom">
                  <FaUserCircle className="dropdown-icon" /> Account Settings
                </Dropdown.Item>
                {/* Add other relevant links here */}
                <Dropdown.Divider className="dropdown-divider" />
                <Dropdown.Item onClick={handleLogout} className="dropdown-item-custom logout-item text-danger">
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