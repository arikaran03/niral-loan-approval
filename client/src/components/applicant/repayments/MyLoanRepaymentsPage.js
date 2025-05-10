// src/components/applicant/repayments/MyLoanRepaymentsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { Container, Card, Table, Button, Spinner, Alert, Badge, Row, Col } from 'react-bootstrap';
import { List, Eye, DollarSign, CalendarDays, CheckCircle, AlertTriangle, Hourglass } from 'lucide-react';
import { formatCurrency, formatDate, getStatusBadgeVariant } from '../../../utils/formatters'; 
import { axiosInstance } from '../../../config'; // Assuming this is your configured axios instance

// Actual API call function
const fetchMyLoanRepaymentsAPI = async () => {
    const response = await axiosInstance.get('/api/repayments/my-loans'); // Endpoint from your routes
    return response.data.data; // Assuming API returns { success: true, data: [...] }
};

export default function MyLoanRepaymentsPage() {
    const [repayments, setRepayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const loadRepayments = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await fetchMyLoanRepaymentsAPI();
                setRepayments(data);
            } catch (err) {
                console.error("Fetch repayments error:", err);
                setError(err.response?.data?.message || err.message || 'Failed to fetch loan repayments.');
            } finally {
                setLoading(false);
            }
        };
        loadRepayments();
    }, []);

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <Spinner animation="border" variant="primary" />
                <span className="ms-2">Loading your loan repayments...</span>
            </Container>
        );
    }

    return (
        <Container fluid="lg" className="my-4">
            <Card className="shadow-sm">
                <Card.Header className="bg-light py-3">
                    <Row className="align-items-center">
                        <Col>
                            <h4 className="mb-0 d-flex align-items-center">
                                <List size={28} className="me-2 text-primary" /> My Loan Repayments
                            </h4>
                        </Col>
                    </Row>
                </Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {repayments.length === 0 && !error && (
                        <Alert variant="info">You currently have no active or past loan repayments to display.</Alert>
                    )}
                    {repayments.length > 0 && (
                        <Table responsive hover className="align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>Loan Title</th>
                                    <th className="text-end">Disbursed Amount</th>
                                    <th className="text-end">EMI</th>
                                    <th className="text-end">Outstanding Principal</th>
                                    <th>Next Due Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {repayments.map(rp => (
                                    <tr key={rp._id}>
                                        <td>
                                            <span className="fw-medium">{rp.loan_id?.title || 'N/A'}</span>
                                            <small className="d-block text-muted">Ref: {rp._id.slice(-6)}</small>
                                        </td>
                                        <td className="text-end">{formatCurrency(rp.disbursed_amount)}</td>
                                        <td className="text-end">{formatCurrency(rp.initial_calculated_emi)}</td>
                                        <td className="text-end text-info fw-bold">{formatCurrency(rp.current_outstanding_principal)}</td>
                                        <td>{formatDate(rp.next_due_date)}</td>
                                        <td>
                                            <Badge pill bg={getStatusBadgeVariant(rp.loan_repayment_status)}
                                                   text={getStatusBadgeVariant(rp.loan_repayment_status) === 'light' ? 'dark' : undefined}>
                                                {rp.loan_repayment_status === 'Active' && <Hourglass size={12} className="me-1" />}
                                                {rp.loan_repayment_status === 'Active - Overdue' && <AlertTriangle size={12} className="me-1" />}
                                                {rp.loan_repayment_status === 'Fully Repaid' && <CheckCircle size={12} className="me-1" />}
                                                {rp.loan_repayment_status}
                                            </Badge>
                                        </td>
                                        <td>
                                            <Button 
                                                variant="outline-primary" 
                                                size="sm" 
                                                onClick={() => navigate(`/repayments/${rp._id}`)} 
                                                title="View Details"
                                            >
                                                <Eye size={16} className="me-1" /> Details
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
                 <Card.Footer className="text-muted small">
                    Found {repayments.length} loan repayment record(s).
                </Card.Footer>
            </Card>
        </Container>
    );
}
