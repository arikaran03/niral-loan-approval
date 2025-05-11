// src/components/admin/repayments/AdminLoanRepaymentsListPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Table, Button, Spinner, Alert, Badge, Row, Col, Form, Pagination } from 'react-bootstrap';
import { ListChecks, Eye, SlidersHorizontal, X } from 'lucide-react';
// Placeholder for your API call function
// import { axiosInstance } from '../../../config'; // Adjust path as needed

// Import helper functions from your utility file
import { formatCurrency, formatDate, getStatusBadgeVariant } from '../../../utils/formatters'; // Adjust path if your utils folder is elsewhere

// Mock API call - replace with your actual API call
const fetchAdminLoanRepaymentsAPI = async (filters = { page: 1, limit: 10 }) => {
    // const queryParams = new URLSearchParams(filters).toString();
    // const response = await axiosInstance.get(`/api/admin/repayments?${queryParams}`);
    // return response.data; // Assuming API returns { data: [], pagination: {} }
    console.log("Fetching admin repayments with filters:", filters);
    const allItems = [
        { _id: 'repayment123', user_id: { _id: 'userA', name: 'Alice Wonderland' }, loan_id: { _id: 'loanABC', title: 'Personal Loan' }, disbursed_amount: 50000, current_outstanding_principal: 25000, loan_repayment_status: 'Active', createdAt: '2025-01-15T00:00:00.000Z' },
        { _id: 'repayment456', user_id: { _id: 'userB', name: 'Bob The Builder' }, loan_id: { _id: 'loanDEF', title: 'Home Renovation' }, disbursed_amount: 200000, current_outstanding_principal: 0, loan_repayment_status: 'Fully Repaid', createdAt: '2023-07-10T00:00:00.000Z' },
        { _id: 'repayment789', user_id: { _id: 'userA', name: 'Alice Wonderland' }, loan_id: { _id: 'loanGHI', title: 'Education Top-up' }, disbursed_amount: 75000, current_outstanding_principal: 75000, loan_repayment_status: 'Active - Overdue', createdAt: '2024-11-01T00:00:00.000Z' },
        { _id: 'repayment101', user_id: { _id: 'userC', name: 'Charlie Brown' }, loan_id: { _id: 'loanJKL', title: 'Car Loan' }, disbursed_amount: 300000, current_outstanding_principal: 150000, loan_repayment_status: 'Active', createdAt: '2024-08-20T00:00:00.000Z' },
    ];
    // Simulate filtering
    let filteredItems = allItems;
    if (filters.status) {
        filteredItems = filteredItems.filter(item => item.loan_repayment_status === filters.status);
    }
    if (filters.userId) {
        filteredItems = filteredItems.filter(item => item.user_id._id === filters.userId);
    }
    // Simulate pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedItems = filteredItems.slice(startIndex, endIndex);

    return new Promise(resolve => setTimeout(() => resolve({
        data: paginatedItems,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(filteredItems.length / limit),
            totalRecords: filteredItems.length,
            limit: limit
        }
    }), 1000));
};


export default function AdminLoanRepaymentsListPage() {
    const [repayments, setRepayments] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalRecords: 0, limit: 10 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [filters, setFilters] = useState({
        status: '',
        userId: '',
        loanId: '',
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
    });
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        const loadRepayments = async () => {
            setLoading(true);
            setError('');
            try {
                const response = await fetchAdminLoanRepaymentsAPI(filters);
                setRepayments(response.data);
                setPagination(response.pagination);
            } catch (err) {
                setError(err.response?.data?.message || err.message || 'Failed to fetch loan repayments.');
                console.error("Fetch admin repayments error:", err);
            } finally {
                setLoading(false);
            }
        };
        loadRepayments();
    }, [filters]);

    const handleFilterChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value, page: 1 }));
    };
    
    const handlePageChange = (pageNumber) => {
        setFilters(prev => ({ ...prev, page: pageNumber }));
    };

    const clearFilters = () => {
        setFilters({ status: '', userId: '', loanId: '', page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
    };

    if (loading && filters.page === 1) { // Show full page loader only on initial load
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <Spinner animation="border" variant="primary" />
                <span className="ms-2">Loading all loan repayments...</span>
            </Container>
        );
    }
    
    const repaymentStatuses = ['Active', 'Active - Grace Period', 'Active - Overdue', 'Fully Repaid', 'Foreclosed', 'Restructured', 'Defaulted', 'Write-Off', 'Legal Action Pending'];


    return (
        <Container fluid="lg" className="my-4">
            <Card className="shadow-sm">
                <Card.Header className="bg-light py-3">
                    <Row className="align-items-center">
                        <Col md={8}>
                            <h4 className="mb-0 d-flex align-items-center">
                                <ListChecks size={28} className="me-2 text-primary" /> All Loan Repayments (Admin)
                            </h4>
                        </Col>
                        <Col md={4} className="text-md-end">
                             <Button variant="outline-secondary" onClick={() => setShowFilters(!showFilters)} size="sm">
                                <SlidersHorizontal size={16} className="me-1" /> {showFilters ? 'Hide' : 'Show'} Filters
                            </Button>
                        </Col>
                    </Row>
                </Card.Header>

                {showFilters && (
                    <Card.Body className="border-bottom">
                        <Form>
                            <Row className="g-3">
                                <Col md={3}>
                                    <Form.Group controlId="filterStatus">
                                        <Form.Label className="small mb-1">Status</Form.Label>
                                        <Form.Select size="sm" name="status" value={filters.status} onChange={handleFilterChange}>
                                            <option value="">All Statuses</option>
                                            {repaymentStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group controlId="filterUserId">
                                        <Form.Label className="small mb-1">User ID</Form.Label>
                                        <Form.Control size="sm" type="text" name="userId" placeholder="Enter User ID" value={filters.userId} onChange={handleFilterChange} />
                                    </Form.Group>
                                </Col>
                                <Col md={3}>
                                    <Form.Group controlId="filterLoanId">
                                        <Form.Label className="small mb-1">Loan ID</Form.Label>
                                        <Form.Control size="sm" type="text" name="loanId" placeholder="Enter Loan ID" value={filters.loanId} onChange={handleFilterChange} />
                                    </Form.Group>
                                </Col>
                                <Col md={3} className="d-flex align-items-end">
                                    <Button variant="outline-danger" size="sm" onClick={clearFilters} className="w-100">
                                        <X size={16} className="me-1" /> Clear Filters
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                    </Card.Body>
                )}

                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {loading && filters.page > 1 && <div className="text-center my-3"><Spinner animation="grow" size="sm" variant="primary" /> Fetching more...</div>}
                    
                    {!loading && repayments.length === 0 && !error && (
                        <Alert variant="info">No loan repayments found matching your criteria.</Alert>
                    )}

                    {repayments.length > 0 && (
                        <Table responsive hover className="align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>User</th>
                                    <th>Loan Title</th>
                                    <th className="text-end">Disbursed</th>
                                    <th className="text-end">Outstanding</th>
                                    <th>Status</th>
                                    <th>Created At</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {repayments.map(rp => (
                                    <tr key={rp._id}>
                                        <td>
                                            <span className="fw-medium">{rp.user_id?.name || 'N/A'}</span>
                                            <small className="d-block text-muted">{rp.user_id?._id || 'N/A'}</small>
                                        </td>
                                        <td>
                                            <span className="fw-medium">{rp.loan_id?.title || 'N/A'}</span>
                                            <small className="d-block text-muted">Repay ID: {rp._id.slice(-6)}</small>
                                        </td>
                                        <td className="text-end">{formatCurrency(rp.disbursed_amount)}</td>
                                        <td className="text-end text-info fw-bold">{formatCurrency(rp.current_outstanding_principal)}</td>
                                        <td>
                                            <Badge pill bg={getStatusBadgeVariant(rp.loan_repayment_status)} 
                                                   text={getStatusBadgeVariant(rp.loan_repayment_status) === 'light' ? 'dark' : undefined}>
                                                {rp.loan_repayment_status}
                                            </Badge>
                                        </td>
                                        <td>{formatDate(rp.createdAt)}</td>
                                        <td>
                                            <Button 
                                                variant="outline-primary" 
                                                size="sm" 
                                                onClick={() => navigate(`/console/repayments/${rp._id}`)} // Adjust route
                                                title="View Details"
                                            >
                                                <Eye size={16} className="me-1" /> View
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                     {pagination.totalPages > 1 && (
                        <div className="d-flex justify-content-center mt-3">
                            <Pagination size="sm">
                                <Pagination.First onClick={() => handlePageChange(1)} disabled={pagination.currentPage === 1 || loading} />
                                <Pagination.Prev onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage === 1 || loading} />
                                {[...Array(pagination.totalPages).keys()].map(num => {
                                    const pageNum = num + 1;
                                    // Simple pagination display logic, can be enhanced for many pages
                                    if (pagination.totalPages <= 5 || 
                                        pageNum === 1 || pageNum === pagination.totalPages || 
                                        (pageNum >= pagination.currentPage - 1 && pageNum <= pagination.currentPage + 1)) {
                                        return (
                                            <Pagination.Item 
                                                key={pageNum} 
                                                active={pageNum === pagination.currentPage} 
                                                onClick={() => handlePageChange(pageNum)}
                                                disabled={loading}
                                            >
                                                {pageNum}
                                            </Pagination.Item>
                                        );
                                    } else if (pageNum === pagination.currentPage - 2 || pageNum === pagination.currentPage + 2) {
                                        return <Pagination.Ellipsis key={pageNum} disabled />;
                                    }
                                    return null;
                                })}
                                <Pagination.Next onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages || loading} />
                                <Pagination.Last onClick={() => handlePageChange(pagination.totalPages)} disabled={pagination.currentPage === pagination.totalPages || loading} />
                            </Pagination>
                        </div>
                    )}
                </Card.Body>
                 <Card.Footer className="text-muted small">
                    Displaying {repayments.length} of {pagination.totalRecords} record(s). 
                    Page {pagination.currentPage} of {pagination.totalPages}.
                </Card.Footer>
            </Card>
        </Container>
    );
}
