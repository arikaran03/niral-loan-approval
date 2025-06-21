// src/components/admin/WaiverSchemeListPage.jsx

import { useEffect, useState } from "react";
import { Container, Table, Button, Alert, Card, Row, Col, Badge, Tooltip, OverlayTrigger } from "react-bootstrap";
import { Link } from "react-router-dom";
import { axiosInstance } from "../../../config";
import moment from "moment";
import { FaEdit, FaFileInvoice, FaHandHoldingUsd, FaPlus } from 'react-icons/fa';
import LiquidLoader from "../../super/LiquidLoader";

export default function WaiverSchemeListPage() {
  const [schemes, setSchemes] = useState([]);
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

        const { data: schemesData } = await axiosInstance.get("/api/waiver-schemes");
        if (isMounted) setSchemes(schemesData);

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
        return <Badge pill bg="success-subtle" text="success-emphasis">Published</Badge>;
      case 'draft':
        return <Badge pill bg="secondary-subtle" text="secondary-emphasis">Draft</Badge>;
      default:
        return <Badge pill bg="light" text="dark">{status || 'Unknown'}</Badge>;
    }
  };
  
  const formatApplicableOn = (text) => {
      if (!text) return '';
      return text.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  const renderTooltip = (props, text) => (
    <Tooltip id={`tooltip-${text.toLowerCase().replace(/ /g, '-')}`} {...props}>
      {text}
    </Tooltip>
  );

  if (loading) {
    return <LiquidLoader />;
  }

  return (
    <Container fluid className="p-3 p-md-4 loan-list-page waiver-scheme-list-page">
      <Row className="mb-4 align-items-center page-header">
        <Col>
          <h1 className="h3 mb-0 d-flex align-items-center">
            <FaHandHoldingUsd className="me-3 icon-header fs-4 mr-2" />
            Waiver Scheme Management
          </h1>
          {userName && <small className="text-muted d-block mt-1">Administrator: {userName}</small>}
        </Col>
        <Col xs="auto">
          <Link to="/console/waiver-builder">
            <Button variant="primary" size="sm" className="create-button">
              <FaPlus className="me-1" /> Create New Scheme
            </Button>
          </Link>
        </Col>
      </Row>

      {errorMessage && (
        <Alert variant="danger" className="shadow-sm">
          {errorMessage}
        </Alert>
      )}

      <Card className="shadow-sm data-card">
        <Card.Body className="p-0">
          {schemes.length === 0 && !loading ? (
            <div className="text-center p-5 text-muted">
              No waiver schemes found. Start by creating one!
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="align-middle mb-0 loan-list-table">
                <thead className="table-light">
                  <tr>
                    <th>Title</th>
                    <th className="text-center">Status</th>
                    <th>Target Loan</th>
                    <th>Waiver Details</th>
                    <th>Last Updated</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schemes.map((scheme) => (
                    <tr key={scheme._id}>
                      <td>
                        <Link to={`/console/waiver-builder/${scheme._id}`} className="fw-bold text-decoration-none loan-title-link">
                          {scheme.title}
                        </Link>
                        <small className="d-block text-muted">ID: {scheme._id}</small>
                      </td>
                      <td className="text-center">{getStatusBadge(scheme.status)}</td>
                      <td>
                        {scheme.target_loan_id && typeof scheme.target_loan_id === 'object' ? (
                           <Link to={`/console/form-builder/${scheme.target_loan_id._id}`} target="_blank" rel="noopener noreferrer" className="text-decoration-none">
                            {scheme.target_loan_id.title}
                           </Link>
                        ) : (
                            <span className="text-muted">{scheme.target_loan_id || 'N/A'}</span>
                        )}
                      </td>
                      <td>
                        <strong>
                          {scheme.waiver_type === 'percentage'
                            ? `${scheme.waiver_value}%`
                            : `₹${scheme.waiver_value?.toLocaleString('en-IN')}`
                          }
                        </strong>
                        <small className="d-block text-muted">
                          on {formatApplicableOn(scheme.applicable_on)}
                        </small>
                      </td>
                      <td>{moment(scheme.updated_at).format("MMM D, YYYY h:mm A")}</td>
                      <td className="text-center">
                        <div className="d-inline-flex gap-2 action-buttons-group">
                          <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'Edit Scheme')}>
                            <Link to={`/console/waiver-builder/${scheme._id}`}>
                              <Button size="sm" variant="outline-secondary" className="action-button edit">
                                <FaEdit />
                              </Button>
                            </Link>
                          </OverlayTrigger>
                          <OverlayTrigger placement="top" overlay={(props) => renderTooltip(props, 'View Applications')}>
                            <Link to={`/console/waiver-submissions?_id=${scheme._id}`}>
                              <Button size="sm" variant="outline-secondary" className="action-button submissions">
                                <FaFileInvoice />
                              </Button>
                            </Link>
                          </OverlayTrigger>
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
