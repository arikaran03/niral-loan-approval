import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Alert, Badge, Row, Col, ProgressBar } from 'react-bootstrap';
import { List, Eye, DollarSign, CalendarDays, CheckCircle, AlertTriangle, Hourglass, FolderSearch } from 'lucide-react';
import { formatCurrency, formatDate, getStatusBadgeVariant } from '../../../utils/formatters';
import { axiosInstance } from '../../../config';
import LiquidLoader from '../../super/LiquidLoader';

// Helper component for custom CSS styles
const PageStyles = () => (
  <style type="text/css">{`
    .loan-repayment-card {
      transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
      border: 1px solid #e9ecef;
    }
    .loan-repayment-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.08) !important;
    }
    .page-title {
        font-weight: 600;
        color: #343a40;
    }
    .summary-card {
        background-color: #f8f9fa;
        border: none;
    }
    .empty-state {
        padding: 50px;
        text-align: center;
        background-color: #f8f9fa;
        border-radius: 8px;
    }
    .empty-state .lucide {
        color: #adb5bd;
    }
  `}</style>
);


// API call function - Assumes API now also returns total_principal_repaid
const fetchMyLoanRepaymentsAPI = async () => {
    try {
        const response = await axiosInstance.get('/api/repayments/my-loans');
        return response.data.data;
    } catch (error) {
       console.error("API call failed, returning mock data for UI demo.", error);
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
                console.error("Fetch repayments error:", err);
                setError(err.response?.data?.message || err.message || 'Failed to fetch loan repayments.');
            } finally {
                setLoading(false);
            }
        };
        loadRepayments();
    }, []);
    
    const totalOutstanding = repayments.reduce((acc, rp) => acc + (rp.current_outstanding_principal || 0), 0);
    const isLoanActive = (status) => ['Active', 'Active - Overdue'].includes(status);

    if (loading) {
        return <LiquidLoader />;
    }

    return (
        <>
            <PageStyles />
            <Container fluid="lg" className="my-4">
                {/* --- Page Header --- */}
                <div className="page-header mb-4">
                    <Row className="align-items-center g-3">
                        <Col md>
                            <h2 className="page-title d-flex align-items-center">
                                <List size={32} className="me-3 text-primary" /> My Loan Repayments
                            </h2>
                            <p className="text-muted mb-0">
                                View and manage all your ongoing and completed loans.
                            </p>
                        </Col>
                        {repayments.length > 0 && (
                            <Col md="auto">
                                <Card className="summary-card">
                                    <Card.Body className="p-3 text-center">
                                        <small className="text-muted d-block mb-1">Total Outstanding</small>
                                        <div className="fs-4 fw-bold text-primary">{formatCurrency(totalOutstanding)}</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        )}
                    </Row>
                </div>

                {/* --- Content Area --- */}
                {error && <Alert variant="danger">{error}</Alert>}
                
                {!error && repayments.length === 0 && (
                    <div className="empty-state">
                        <FolderSearch size={64} className="mb-3" />
                        <h4 className="mb-2">No Loans Found</h4>
                        <p className="text-muted">You currently have no active or past loan repayments to display.</p>
                        <Button variant="primary" onClick={() => navigate('/browse-loans')}>Explore Loan Products</Button>
                    </div>
                )}

                {repayments.length > 0 && (
                    <Row xs={1} xl={2} className="g-4">
                        {repayments.map(rp => {
                            const progressPercent = rp.disbursed_amount > 0 
                                ? ((rp.total_principal_repaid || 0) / rp.disbursed_amount) * 100 
                                : 0;
                            
                            const statusVariant = getStatusBadgeVariant(rp.loan_repayment_status);

                            return (
                                <Col key={rp._id}>
                                    <Card className="h-100 loan-repayment-card shadow-sm">
                                        <Card.Header className="d-flex justify-content-between align-items-center bg-transparent border-bottom-0 pt-3">
                                            <span className="fw-bold fs-6">{rp?.loan_details?.title || 'N/A'}</span>
                                            <Badge pill bg={statusVariant} text={statusVariant === 'light' ? 'dark' : 'white'}>
                                                {rp.loan_repayment_status === 'Active' && <Hourglass size={12} className="me-1" />}
                                                {rp.loan_repayment_status === 'Active - Overdue' && <AlertTriangle size={12} className="me-1" />}
                                                {rp.loan_repayment_status === 'Fully Repaid' && <CheckCircle size={12} className="me-1" />}
                                                {rp.loan_repayment_status}
                                            </Badge>
                                        </Card.Header>
                                        <Card.Body className="d-flex flex-column p-4">
                                            <Row className="text-center mb-4">
                                                <Col xs={6}>
                                                    <small className="text-muted">Outstanding</small>
                                                    <div className="fs-3 fw-bolder text-primary">{formatCurrency(rp.current_outstanding_principal)}</div>
                                                </Col>
                                                <Col xs={6} className="border-start">
                                                    <small className="text-muted">EMI Amount</small>
                                                    <div className="fs-3 fw-bolder">{formatCurrency(rp.initial_calculated_emi)}</div>
                                                </Col>
                                            </Row>

                                            <div className="mt-auto">
                                                <div className="d-flex justify-content-between mb-1 small fw-medium">
                                                    <span>Repaid: {formatCurrency(rp.total_principal_repaid || 0)}</span>
                                                    <span className="text-muted">Total: {formatCurrency(rp.disbursed_amount)}</span>
                                                </div>
                                                <ProgressBar now={progressPercent} variant="success" striped style={{height: '8px'}} />

                                                <div className="d-flex justify-content-between align-items-center mt-4 pt-3 border-top">
                                                    <div className="d-flex align-items-center">
                                                         <CalendarDays size={16} className="me-2 text-muted" />
                                                         <span className="fw-medium">
                                                            {rp.next_due_date ? `Due: ${formatDate(rp.next_due_date)}` : 'Loan Closed'}
                                                         </span>
                                                    </div>
                                                    <div className="actions">
                                                        {isLoanActive(rp.loan_repayment_status) && (
                                                            <Button 
                                                                variant="success" 
                                                                size="sm" 
                                                                className="me-2"
                                                                onClick={() => navigate(`/repayments/${rp._id}?make_payment=true&initial_calculated_emi=${rp.initial_calculated_emi}`)}
                                                            >
                                                                <DollarSign size={16} className="me-1" /> Pay Now
                                                            </Button>
                                                        )}
                                                        <Button 
                                                            variant="outline-secondary" 
                                                            size="sm" 
                                                            onClick={() => navigate(`/repayments/${rp._id}`)} 
                                                            title="View Details"
                                                        >
                                                            <Eye size={16} className="me-1" /> Details
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>
                )}
                 <Card.Footer className="text-center text-muted small bg-transparent border-0 mt-4">
                    Found {repayments.length} loan repayment record(s).
                </Card.Footer>
            </Container>
        </>
    );
}