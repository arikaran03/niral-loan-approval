// src/components/admin/LoanListPage.jsx

import React, { useEffect, useState } from "react";
import { Container, Table, Button, Spinner, Alert, Card, Row, Col, Badge, Tooltip, OverlayTrigger } from "react-bootstrap"; // Added Tooltip, OverlayTrigger
import { Link } from "react-router-dom";
import { axiosInstance } from "../../config"; // Adjust path if needed
import moment from "moment";
import { FaEdit, FaFileInvoice, FaList, FaPlus } from 'react-icons/fa';
import "./LoanListPage.css"; // Import the updated CSS

export default function LoanListPage() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const userRes = await axiosInstance.get("/api/user/me");
        if (isMounted) setUserName(userRes.data.name);

        const { data: loansData } = await axiosInstance.get("/api/loans");
        if (isMounted) setLoans(loansData);

      } catch (err) {
        console.error("Error fetching data:", err);
         if (isMounted) setErrorMessage(err.response?.data?.error || "Failed to load required data.");
      } finally {
         if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false };
  }, []);

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
        return <Badge pill bg="success-subtle" text="success-emphasis">Published</Badge>; // Use subtle variants
      case 'draft':
        return <Badge pill bg="secondary-subtle" text="secondary-emphasis">Draft</Badge>;
      default:
        return <Badge pill bg="light" text="dark">{status || 'Unknown'}</Badge>;
    }
  };

  // Tooltip renderer
  const renderTooltip = (props, text) => (
    <Tooltip id={`tooltip-${text.toLowerCase().replace(' ','-')}`} {...props}>
      {text}
    </Tooltip>
  );


  if (loading) {
    return (
      // Improved Loading State Centering and Spacing
      <Container fluid className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: 'calc(100vh - 100px)' }}> {/* Adjust minHeight */}
        <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
        <span className="mt-3 text-muted fs-5">Loading Loan Schemes...</span> {/* Added margin-top and font-size */}
      </Container>
    );
  }

  return (
    <Container fluid className="p-3 p-md-4 loan-list-page"> {/* Added page class */}
      {/* Header Row */}
      <Row className="mb-4 align-items-center page-header">
        <Col>
          <h1 className="h3 mb-0 text-dark d-flex align-items-center">
            {/* Increased margin (me-3) and size (fs-4) */}
            <FaList className="me-3 text-primary icon-header fs-4 mr-2" />
            Loan Scheme Management
          </h1>
           {userName && <small className="text-muted d-block mt-1">Administrator: {userName}</small>}
        </Col>
        <Col xs="auto">
           <Link to="/console/form-builder">
             <Button variant="primary" size="sm" className="create-button"> {/* Added class */}
               <FaPlus className="me-1" /> Create New Scheme
             </Button>
           </Link>
        </Col>
      </Row>

      {/* Error Message Display */}
      {errorMessage && (
        <Alert variant="danger" className="shadow-sm">
          {errorMessage}
        </Alert>
      )}

      {/* Loans Table Card */}
      <Card className="shadow-sm border-0 data-card"> {/* Added class */}
        <Card.Body className="p-0">
          {loans.length === 0 && !loading ? (
            <div className="text-center p-5 text-muted">
              No loan schemes found. Start by creating one!
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0 loan-list-table">
                <thead className="table-light">
                  <tr>
                    <th>Title</th>
                    <th className="text-center">Status</th>
                    <th>Amount Range (₹)</th> {/* Added Rupee symbol to header */}
                    <th className="text-center">Interest Rate</th>
                    <th>Last Updated</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => (
                    <tr key={loan._id}>
                      <td>
                        <Link to={`/console/form-builder/${loan._id}`} className="fw-bold text-decoration-none link-primary loan-title-link">
                          {loan.title}
                        </Link>
                        <small className="d-block text-muted">ID: {loan._id}</small>
                      </td>
                      <td className="text-center">{getStatusBadge(loan.status)}</td>
                      {/* Changed $ to ₹ */}
                      <td>
                        <span className="text-muted">₹</span>{loan.min_amount?.toLocaleString('en-IN')} {/* Added locale for formatting */}
                        <span className="text-muted mx-1">-</span>
                        <span className="text-muted">₹</span>{loan.max_amount?.toLocaleString('en-IN')} {/* Added locale for formatting */}
                      </td>
                      <td className="text-center">{loan.interest_rate}%</td>
                      <td>{moment(loan.updated_at).format("MMM D, YYYY h:mm A")}</td> {/* Corrected date format */}
                      <td className="text-center">
                        <div className="d-inline-flex gap-2 action-buttons-group"> {/* Added class */}
                          <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Edit Scheme')}>
                            <Link to={`/console/form-builder/${loan._id}`}>
                              <Button size="sm" variant="outline-secondary" className="action-button edit"> {/* Changed variant */}
                                <FaEdit />
                              </Button>
                            </Link>
                          </OverlayTrigger>
                          <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'View Submissions')}>
                            <Link to={`/console/submissions/${loan._id}`}>
                              <Button size="sm" variant="outline-secondary" className="action-button submissions"> {/* Changed variant */}
                                <FaFileInvoice />
                              </Button>
                            </Link>
                          </OverlayTrigger>
                          {/* Add Delete button here if needed with Tooltip */}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
}