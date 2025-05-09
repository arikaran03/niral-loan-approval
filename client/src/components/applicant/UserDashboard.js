// src/pages/UserDashboard.jsx (or components/dashboard/UserDashboard.jsx)

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, Table, Badge, Button, Accordion, ListGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { axiosInstance } from '../../config'; // Adjust path
import moment from 'moment';
import { FaTachometerAlt, FaFileAlt, FaCheckCircle, FaTimesCircle, FaClock, FaEye, FaHistory, FaInfoCircle, FaPlus } from 'react-icons/fa'; // Icons
import './UserDashboard.css'; // Import CSS

// Consistent Stage Labels/Variants/Icons
const STAGE_LABELS = {
  draft: 'Draft',
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected'
};
const stageVariants = {
    draft: 'secondary-subtle',
    pending: 'warning-subtle',
    approved: 'success-subtle',
    rejected: 'danger-subtle'
};
const stageTextEmphasis = {
    draft: 'secondary-emphasis',
    pending: 'warning-emphasis',
    approved: 'success-emphasis',
    rejected: 'danger-emphasis'
};
const getStatusIcon = (stage) => {
    switch (stage) {
        case 'approved': return <FaCheckCircle className="me-1 text-success" />;
        case 'rejected': return <FaTimesCircle className="me-1 text-danger" />;
        case 'pending': return <FaClock className="me-1 text-warning" />;
        case 'draft': return <FaFileAlt className="me-1 text-secondary"/>;
        default: return null;
    }
};


const UserDashboard = () => {
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        const fetchSubmissions = async () => {
            setLoading(true);
            setError(null);
            try {
                const { data } = await axiosInstance.get('/api/user/my-submissions');
                if (isMounted) {
                    setSubmissions(data || []); // Ensure it's an array
                }
            } catch (err) {
                console.error("Error fetching user submissions:", err);
                if (isMounted) {
                    setError(err.response?.data?.error || "Failed to load your applications.");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchSubmissions();
        return () => { isMounted = false; }; // Cleanup
    }, []);

    const renderHistory = (history) => {
        if (!history || history.length === 0) {
            return <p className="text-muted small mb-0">No status changes recorded yet.</p>;
        }
        // Sort history chronologically (oldest first) for display
        const sortedHistory = [...history].sort((a, b) => new Date(a.changed_at) - new Date(b.changed_at));
        return (
            <ListGroup variant="flush" className="history-list small">
                {sortedHistory.map((entry, index) => (
                    <ListGroup.Item key={index} className="d-flex justify-content-between align-items-center px-0 py-1">
                        <span>
                            {getStatusIcon(entry.stage)}
                            <Badge
                                bg={stageVariants[entry.stage] || 'light'}
                                text={stageTextEmphasis[entry.stage] || 'dark'}
                                className="me-2 history-badge"
                            >
                                {STAGE_LABELS[entry.stage] || entry.stage}
                            </Badge>
                             on {moment(entry.changed_at).format('MMM D, YYYY, h:mm A')}
                             {/* Optionally show who changed it if needed and available */}
                             {/* {entry.changed_by?.name && ` by ${entry.changed_by.name}`} */}
                        </span>
                    </ListGroup.Item>
                ))}
            </ListGroup>
        );
    };


    if (loading) {
        return (
            <Container fluid className="d-flex flex-column justify-content-center align-items-center page-loading-container">
                <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                <p className="mt-3 text-muted fs-5">Loading Your Dashboard...</p>
            </Container>
        );
    }

    return (
        <Container fluid className="p-3 p-md-4 user-dashboard-page">
            {/* Header */}
            <Row className="mb-4 align-items-center page-header">
                <Col>
                    <h1 className="h3 mb-0 text-dark d-flex align-items-center">
                        <FaTachometerAlt className="me-3 text-primary icon-header fs-4" />
                        My Loan Dashboard
                    </h1>
                </Col>
                 <Col xs="auto">
                    <Link to="/"> {/* Link to start a new application */}
                        <Button variant="primary" size="sm" className="create-button">
                            <FaPlus className="me-1" /> Apply for New Loan
                        </Button>
                    </Link>
                </Col>
            </Row>

            {error && (
                <Alert variant="danger" className="shadow-sm">{error}</Alert>
            )}

            {/* Submissions List/Cards */}
            {submissions.length === 0 && !loading && !error && (
                 <Alert variant="info" className="text-center shadow-sm">
                    <FaInfoCircle className="me-2"/> You haven't applied for any loans yet.
                    <Link to="/" className="alert-link ms-2">Apply Now!</Link>
                 </Alert>
            )}

            {submissions.length > 0 && (
                 <Card className="shadow-sm border-0 data-card">
                    <Card.Header className="bg-light card-header-title">
                        Your Applications ({submissions.length})
                    </Card.Header>
                    <Card.Body className="p-0">
                         <div className="table-responsive">
                            <Table hover className="align-middle mb-0 user-submissions-table">
                                <thead className="table-light">
                                    <tr>
                                        <th>Loan Program</th>
                                        <th className="text-center">Status</th>
                                        <th className="text-end">Amount (₹)</th>
                                        <th>Submitted On</th>
                                        <th>Last Updated</th>
                                        <th className="text-center">History / Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {submissions.map((sub) => (
                                        <tr key={sub._id}>
                                            <td>
                                                <span className="fw-medium d-block">{sub.loan_id?.title || <span className="text-muted fst-italic">N/A</span>}</span>
                                                <small className="text-muted">ID: {sub._id}</small>
                                            </td>
                                            <td className="text-center">
                                                <Badge
                                                    pill
                                                    bg={stageVariants[sub.stage] || 'light'}
                                                    text={stageTextEmphasis[sub.stage] || 'dark'}
                                                    className="status-badge-table"
                                                >
                                                    {getStatusIcon(sub.stage)} {STAGE_LABELS[sub.stage] || sub.stage}
                                                </Badge>
                                            </td>
                                            <td className="text-end fw-medium">
                                                {sub.amount?.toLocaleString('en-IN') ?? 'N/A'}
                                            </td>
                                            <td>{moment(sub.created_at).format("MMM D, YYYY")}</td>
                                            <td>{moment(sub.updated_at).fromNow()}</td>
                                            <td className="text-center">
                                                 {/* Example using Accordion for history */}
                                                 <Accordion flush className="history-accordion">
                                                    <Accordion.Item eventKey={sub._id}>
                                                        <Accordion.Header as="div" className="p-0">
                                                            <Button variant="link" size="sm" className="text-decoration-none p-0 view-details-button">
                                                                <FaHistory className="me-1"/> View History
                                                            </Button>
                                                        </Accordion.Header>
                                                        <Accordion.Body className="p-2">
                                                            {renderHistory(sub.history)}
                                                            {/* Link to full details */}
                                                            <Link to={`/applications/${sub._id}`} className="d-block text-center mt-2 small">View Full Details</Link>
                                                        </Accordion.Body>
                                                    </Accordion.Item>
                                                </Accordion>
                                                {/* Alternative: Simple Link
                                                <Link to={`/application/${sub._id}`} title="View Details">
                                                    <Button size="sm" variant="outline-primary" className="action-button view">
                                                        <FaEye />
                                                    </Button>
                                                </Link>
                                                */}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                         </div>
                    </Card.Body>
                </Card>
            )}

        </Container>
    );
};

// Add PropTypes if needed, e.g., if context provides user info
// UserDashboard.propTypes = { ... };

export default UserDashboard;