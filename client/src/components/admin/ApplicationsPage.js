// src/pages/ApplicationsPage.jsx (or appropriate path)

import { useState } from 'react';
import {
  Container,
  Row,
  Col
} from 'react-bootstrap';
import { FaSearch } from 'react-icons/fa';
import SearchFilterBar from './SearchFilterBar'; // Adjust path as needed

const ApplicationsPage = () => {
  const [loading, setLoading] = useState(true); // Keep loading state if SearchFilterBar doesn't handle initial load display
  const [error, setError] = useState(null); // Keep error state for fetch errors within SearchFilterBar

  // This handler is now primarily for SearchFilterBar to signal completion
  // The actual results are handled internally by SearchFilterBar and ResultsList
  const handleSearchResults = (data) => {
    setLoading(false); // Stop loading indicator once SearchFilterBar has results (or error)
    setError(null); // Clear previous errors on new results
  };

  return (
    // Use Container fluid for full width, or regular Container for centered content
    <Container fluid className="p-3 p-md-4 application-page">
      {/* Header */}
      <Row className="mb-4">
        <Col className="text-center"> {/* Center align column content */}
           {/* Use d-inline-flex for inline alignment and align-items-center */}
          <h1 className="fw-bold d-inline-flex align-items-center page-main-title">
            <FaSearch className="me-3 text-primary mr-2" /> {/* Increased margin */}
            Application Search
          </h1>
          <p className="text-muted mb-0">Find and manage loan applications using various criteria.</p>
        </Col>
      </Row>

      {/* Search Bar Component */}
      {/* Pass down handlers and let SearchFilterBar manage its loading/error internally */}
      <SearchFilterBar
        onResults={handleSearchResults}
        // Optionally pass error/loading setters if SearchFilterBar needs to update parent
        // setLoading={setLoading}
        // setError={setError}
      />

      {/*
        Note: The ResultsList rendering, loading spinner, and error alert
        are now handled WITHIN the SearchFilterBar component based on the
        provided code for SearchFilterBar. This component (ApplicationsPage)
        primarily acts as a wrapper/layout container for SearchFilterBar.
      */}

    </Container>
  );
};

// Add PropTypes if SearchFilterBar requires onResults, etc.
// ApplicationsPage.propTypes = {
//   // Define props if any were needed
// };

export default ApplicationsPage;