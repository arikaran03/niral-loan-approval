// src/components/admin/AdminDashboard.jsx

import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Spinner, Alert, Card, Table, Badge, Button } from 'react-bootstrap';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell // Removed unused Legend
} from 'recharts';
import { Link } from 'react-router-dom'; // Import Link for actions
import { axiosInstance } from '../../config'; // Adjust the path if needed
import {
    FaLandmark, FaFileAlt, FaChartBar, FaUsers, FaCoins, FaRegChartBar, FaExclamationTriangle, FaInfoCircle, FaEye
} from 'react-icons/fa'; // Added/changed icons
import moment from 'moment'; // Use moment for date formatting
import './AdminDashboard.css'; // Import dedicated CSS

// Define colors for charts for consistency
const COLORS = ['#0d6efd', '#6f42c1', '#d63384', '#fd7e14', '#ffc107', '#198754', '#20c997', '#dc3545', '#6c757d'];

// Helper to format stage names nicely
const formatStageName = (stageKey) => {
    return stageKey
        .replace(/_/g, ' ') // Replace underscores with spaces
        .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize first letter of each word
};

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDashboardStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axiosInstance.get('/api/admin/dashboard');
        if (isMounted) {
            // Add default empty objects/arrays if API might omit them
            setStats({
                submissionsByStage: {},
                loansByType: [],
                recentSubmissions: [],
                ...response.data // Spread the actual data, potentially overwriting defaults
            });
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        if (isMounted) setError(err.response?.data?.error || err.message || 'Failed to fetch dashboard data');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDashboardStats();
    return () => { isMounted = false; }; // Cleanup
  }, []);

  // --- Data Preparation for Charts ---
  // Ensure submissionsByStageData is always an array, even if stats.submissionsByStage is empty
  const submissionsByStageData = stats ? Object.entries(stats.submissionsByStage).map(
    ([stage, count]) => ({
      name: formatStageName(stage), // Use formatted name for display
      count,
    })
  ) : [];

  // Ensure loansByTypeData is always an array
  const loansByTypeData = stats?.loansByType || [];

  // --- Loading State ---
  if (loading) {
    return (
      <Container fluid className="d-flex flex-column justify-content-center align-items-center dashboard-message-container">
        <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
        <p className="mt-3 text-muted fs-5">Loading Dashboard Data...</p>
      </Container>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <Container fluid className="p-4 dashboard-message-container">
        <Alert variant="danger" className="text-center shadow-sm">
           <FaExclamationTriangle className="me-2" /> <strong>Error:</strong> {error}
        </Alert>
      </Container>
    );
  }

  // --- No Data State ---
  if (!stats) {
    return (
        <Container fluid className="p-4 dashboard-message-container">
            <Alert variant="info" className="text-center shadow-sm">
                <FaInfoCircle className="me-2" /> No dashboard data available to display.
            </Alert>
        </Container>
    );
  }

  // --- Main Dashboard Render ---
  return (
    <Container fluid className="admin-dashboard p-3 p-md-4">
      {/* Header */}
      <Row className="mb-4 align-items-center page-header">
        <Col>
          <h1 className="h3 mb-0 text-dark d-flex align-items-center">
            <FaRegChartBar className="me-3 text-primary icon-header fs-4" /> {/* Changed icon */}
            Admin Dashboard
          </h1>
        </Col>
      </Row>

      {/* Stats Cards Row */}
      <Row className="g-4 mb-4"> {/* Use g-4 for gutters */}
        <Col md={6} lg={3}>
          <Card className="stat-card shadow-sm h-100 border-start border-primary border-4">
            <Card.Body className="d-flex align-items-center">
              <FaLandmark className="stat-icon text-primary opacity-75 me-3 mr-2" />
              <div>
                <div className="stat-label text-muted text-uppercase small">Total Loan Schemes</div>
                <div className="stat-value fw-bold fs-4">{stats.totalLoans ?? 0}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="stat-card shadow-sm h-100 border-start border-success border-4">
            <Card.Body className="d-flex align-items-center">
              <FaFileAlt className="stat-icon text-success opacity-75 me-3 mr-2" />
              <div>
                <div className="stat-label text-muted text-uppercase small">Total Submissions</div>
                <div className="stat-value fw-bold fs-4">{stats.totalSubmissions ?? 0}</div>
              </div>
            </Card.Body>
          </Card>
        </Col>
         <Col md={6} lg={3}>
          <Card className="stat-card shadow-sm h-100 border-start border-info border-4">
            <Card.Body className="d-flex align-items-center">
              <FaUsers className="stat-icon text-info opacity-75 me-3 mr-2" />
              <div>
                <div className="stat-label text-muted text-uppercase small">Total Users</div>
                <div className="stat-value fw-bold fs-4">{stats.totalUsers ?? 0}</div> {/* Assuming you add totalUsers */}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3}>
          <Card className="stat-card shadow-sm h-100 border-start border-warning border-4">
            <Card.Body className="d-flex align-items-center">
              <FaCoins className="stat-icon text-warning opacity-75 me-3 mr-2" />
              <div>
                <div className="stat-label text-muted text-uppercase small">Avg. Amount Requested</div>
                <div className="stat-value fw-bold fs-4">
                  ₹{stats.averageAmount ? stats.averageAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row className="g-4 mb-4">
        <Col lg={6}>
          <Card className="shadow-sm h-100 dashboard-chart-card">
            <Card.Header className="bg-light">
                <FaChartBar className="me-2 text-primary" /> Submissions by Stage
            </Card.Header>
            <Card.Body>
              {submissionsByStageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={submissionsByStageData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}> {/* Adjust margins */}
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={12} tick={{ dy: 5 }}/>
                    <YAxis fontSize={12} tick={{ dx: -5 }}/>
                    <Tooltip cursor={{fill: 'rgba(206, 212, 218, 0.3)'}}/>
                    {/* <Legend /> */}
                    <Bar dataKey="count" name="Submissions" radius={[4, 4, 0, 0]}>
                       {submissionsByStageData.map((_, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                 <div className="text-center text-muted p-5">No submission data for chart.</div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="shadow-sm h-100 dashboard-chart-card">
             <Card.Header className="bg-light">
                <FaLandmark className="me-2 text-success" /> Loan Schemes by Type
            </Card.Header>
            <Card.Body>
              {loansByTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={loansByTypeData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="type" fontSize={12} tick={{ dy: 5 }}/> {/* Assuming API returns 'type' */}
                    <YAxis fontSize={12} tick={{ dx: -5 }}/>
                    <Tooltip cursor={{fill: 'rgba(206, 212, 218, 0.3)'}}/>
                    {/* <Legend /> */}
                    <Bar dataKey="count" name="Schemes" fill="#82ca9d" radius={[4, 4, 0, 0]}>
                        {loansByTypeData.map((_, index) => (
                         <Cell key={`cell-loan-${index}`} fill={COLORS[(index + 3) % COLORS.length]} /> // Offset colors
                       ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                  <div className="text-center text-muted p-5">No loan type data for chart.</div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Submissions Table Row */}
      <Row>
        <Col md={12}>
          <Card className="shadow-sm border-0 recent-submissions-card">
             <Card.Header className="bg-light">
                <FaUsers className="me-2 text-info" /> Recent Submissions
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover className="align-middle mb-0 recent-submissions-table">
                  <thead className="table-light">
                    <tr>
                      <th>Loan Title</th>
                      <th>Applicant</th>
                      <th>Submitted</th>
                      <th className="text-center">Stage</th>
                      <th className="text-end">Amount (₹)</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSubmissions?.length > 0 ? (
                      stats.recentSubmissions.map((submission) => (
                        <tr key={submission._id}>
                          <td>
                            <Link to={`/console/loans/${submission.loan_id?._id}`} className="fw-medium text-decoration-none link-dark">
                                {submission.loan_id?.title ?? <span className="text-muted fst-italic">N/A</span>}
                            </Link>
                             <small className="d-block text-muted">Loan ID: {submission.loan_id?._id ?? 'N/A'}</small>
                          </td>
                          <td>{submission.user_id?.name ?? <span className="text-muted fst-italic">N/A</span>}</td>
                          <td>{moment(submission.created_at).format("MMM D, YYYY")}</td>
                          <td className="text-center">
                             <Badge
                                pill
                                bg={{ approved: 'success', pending: 'warning', rejected: 'danger' }[submission.stage] || 'light'}
                                text={{ approved: 'light', pending: 'dark', rejected: 'light' }[submission.stage] || 'dark'}
                                className="status-badge-table"
                             >
                                {formatStageName(submission.stage)}
                             </Badge>
                          </td>
                          <td className="text-end fw-medium">
                             {submission.amount?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) ?? 'N/A'}
                          </td>
                          <td className="text-center">
                            <Link to={`/console/applications/${submission._id}`} title="View Submission">
                              <Button size="sm" variant="outline-primary" className="action-button view">
                                <FaEye />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="text-center text-muted p-4">
                          No recent submissions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminDashboard;

