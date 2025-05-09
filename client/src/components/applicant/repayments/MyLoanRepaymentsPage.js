// src/components/applicant/repayments/MyLoanRepaymentsPage.js
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Assuming react-router-dom
import { Container, Card, Table, Button, Spinner, Alert, Badge, Row, Col } from 'react-bootstrap';
import { List, Eye, DollarSign, CalendarDays, CheckCircle, AlertTriangle, Hourglass } from 'lucide-react';
// Placeholder for your API call function
// import { axiosInstance } from '../../../config';

// Mock API call - replace with your actual API call
const fetchMyLoanRepaymentsAPI = async () => {
    // const response = await axiosInstance.get('/api/repayments/my-loans');
    // return response.data.data;
    return new Promise(resolve => setTimeout(() => resolve([
        { _id: 'repayment123', loan_id: { _id: 'loanABC', title: 'Personal Loan for Vacation' }, disbursed_amount: 50000, initial_calculated_emi: 5000, current_outstanding_principal: 25000, next_due_date: '2025-06-05T00:00:00.000Z', loan_repayment_status: 'Active', createdAt: '2025-01-15T00:00:00.000Z' },
        { _id: 'repayment456', loan_id: { _id: 'loanDEF', title: 'Home Renovation Loan' }, disbursed_amount: 200000, initial_calculated_emi: 15000, current_outstanding_principal: 0, next_due_date: null, loan_repayment_status: 'Fully Repaid', createdAt: '2023-07-10T00:00:00.000Z' },
        { _id: 'repayment789', loan_id: { _id: 'loanGHI', title: 'Education Top-up' }, disbursed_amount: 75000, initial_calculated_emi: 7000, current_outstanding_principal: 75000, next_due_date: '2025-05-20T00:00:00.000Z', loan_repayment_status: 'Active - Overdue', createdAt: '2024-11-01T00:00:00.000Z' },
    ]), 1000));
};

// Helper to format currency - create a utils/formatters.js or similar
const formatCurrency = (amount, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency, minimumFractionDigits: 0 }).format(amount);
};

// Helper to format dates
const formatDate = (dateString, options = { year: 'numeric', month: 'short', day: 'numeric' }) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', options);
};

const getStatusBadgeVariant = (status) => {
    switch (status) {
        case 'Active': return 'success';
        case 'Active - Overdue': return 'danger';
        case 'Fully Repaid': return 'primary';
        case 'Foreclosed': return 'info';
        default: return 'secondary';
    }
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
                setError(err.response?.data?.message || err.message || 'Failed to fetch loan repayments.');
                console.error("Fetch repayments error:", err);
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
                                            <Badge pill bg={getStatusBadgeVariant(rp.loan_repayment_status)}>
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
                                                onClick={() => navigate(`/repayments/${rp._id}`)} // Adjust route as per your setup
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