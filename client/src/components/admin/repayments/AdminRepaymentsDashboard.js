import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Form, Row, Col, Button, Table, Badge, Pagination, Spinner, Alert, InputGroup, Accordion } from 'react-bootstrap';
import { SlidersHorizontal, Search, Eye, XCircle } from 'lucide-react';
import { formatCurrency, formatDate, getStatusBadgeVariant } from '../../../utils/formatters';
import { axiosInstance } from '../../../config';
import LiquidLoader from '../../super/LiquidLoader'; // Ensure this path is correct

// Debounce helper to prevent excessive API calls while typing
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export default function AdminRepaymentsDashboard() {
    const navigate = useNavigate();
    const [repayments, setRepayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [outstandingRangeError, setOutstandingRangeError] = useState(null); // State for outstanding amount range validation error
    
    // State for filters and pagination
    const [filters, setFilters] = useState({
        status: '',
        userId: '',
        loanId: '',
        minOutstanding: '',
        maxOutstanding: ''
    });
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalRecords: 0
    });

    const debouncedFilters = useDebounce(filters, 500); // Debounce filter inputs by 500ms

    const fetchRepayments = useCallback(async () => {
        setLoading(true);
        setError('');
        setOutstandingRangeError(null);


        if (debouncedFilters.minOutstanding.startsWith("0") && debouncedFilters.minOutstanding.length > 1) {
            setOutstandingRangeError("'Min Outstanding' cannot start with zero unless it is exactly '0'.");
            setLoading(false);
            setRepayments([]);
            setPagination({ currentPage: 1, totalPages: 1, totalRecords: 0 });
            return; // Prevent API call
        }

        if (debouncedFilters.maxOutstanding.startsWith("0") && debouncedFilters.maxOutstanding.length > 1) {
            setOutstandingRangeError("'Max Outstanding' cannot start with zero unless it is exactly '0'.");
            setLoading(false);
            setRepayments([]);
            setPagination({ currentPage: 1, totalPages: 1, totalRecords: 0 });
            return; // Prevent API call
        }

        const minVal = parseFloat(debouncedFilters.minOutstanding);
        const maxVal = parseFloat(debouncedFilters.maxOutstanding);

        // **Validation 1: minOutstanding cannot be negative**
        if (!isNaN(minVal) && minVal < 0) {
            setOutstandingRangeError("'Min Outstanding' cannot be a negative value.");
            setLoading(false);
            setRepayments([]);
            setPagination({ currentPage: 1, totalPages: 1, totalRecords: 0 });
            return; // Prevent API call
        }

        // **Validation 2: minOutstanding cannot be greater than maxOutstanding**
        if (!isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal) {
            setOutstandingRangeError("'Min Outstanding' cannot be greater than 'Max Outstanding'.");
            setLoading(false);
            setRepayments([]);
            setPagination({ currentPage: 1, totalPages: 1, totalRecords: 0 });
            return; // Prevent API call
        }


        try {
            // Remove empty filters before creating query string
            const activeFilters = Object.fromEntries(
                Object.entries(debouncedFilters).filter(([, v]) => v !== '')
            );
            
            const params = new URLSearchParams({
                ...activeFilters,
                page: pagination.currentPage,
                limit: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            const { data } = await axiosInstance.get(`/api/repayments?${params.toString()}`);
            
            setRepayments(data.data);
            setPagination(data.pagination);

        } catch (err) {
            console.error("Failed to fetch repayments:", err);
            setError(err.response?.data?.message || 'An error occurred while fetching data.');
        } finally {
            setLoading(false);
        }
    }, [pagination.currentPage, debouncedFilters]); // Added debouncedFilters to deps

    useEffect(() => {
        fetchRepayments();
    }, [fetchRepayments]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => {
            const newFilters = { ...prev, [name]: value };

            const minVal = parseFloat(newFilters.minOutstanding);
            const maxVal = parseFloat(newFilters.maxOutstanding);
            let currentError = null; // Use a local variable to manage error state within this function

            // **Real-time Validation 1: minOutstanding cannot be negative**
            if (name === 'minOutstanding' && !isNaN(minVal) && minVal < 0) {
                currentError = "'Min Outstanding' cannot be a negative value.";
            } 
            // **Real-time Validation 2: minOutstanding cannot be greater than maxOutstanding**
            else if (!isNaN(minVal) && !isNaN(maxVal) && minVal > maxVal) {
                currentError = "'Min Outstanding' cannot be greater than 'Max Outstanding'.";
            }
            
            setOutstandingRangeError(currentError); // Set or clear the error based on validation

            // Reset to page 1 when filters change, but only if there's no outstanding error
            // to avoid resetting page while user is fixing an invalid input.
            if (pagination.currentPage !== 1 && currentError === null) {
                setPagination(prev => ({ ...prev, currentPage: 1 }));
            }
            return newFilters;
        });
    };

    const handleResetFilters = () => {
        setFilters({
            status: '',
            userId: '',
            loanId: '',
            minOutstanding: '',
            maxOutstanding: ''
        });
        setOutstandingRangeError(null); // Clear outstanding range error on reset
        if (pagination.currentPage !== 1) {
            setPagination(prev => ({ ...prev, currentPage: 1 }));
        }
    };
    
    const handlePageChange = (pageNumber) => {
        // Prevent page change if there's an active outstanding range error
        if (outstandingRangeError) {
            return;
        }
        if (pageNumber > 0 && pageNumber <= pagination.totalPages) {
            setPagination(prev => ({ ...prev, currentPage: pageNumber }));
        }
    };

    const renderPaginationItems = () => {
        const items = [];
        const { currentPage, totalPages } = pagination;
        const maxPagesToShow = 5;
        let startPage, endPage;

        if (totalPages <= maxPagesToShow) {
            startPage = 1;
            endPage = totalPages;
        } else {
            const maxPagesBeforeCurrentPage = Math.floor(maxPagesToShow / 2);
            const maxPagesAfterCurrentPage = Math.ceil(maxPagesToShow / 2) - 1;
            if (currentPage <= maxPagesBeforeCurrentPage) {
                startPage = 1;
                endPage = maxPagesToShow;
            } else if (currentPage + maxPagesAfterCurrentPage >= totalPages) {
                startPage = totalPages - maxPagesToShow + 1;
                endPage = totalPages;
            } else {
                startPage = currentPage - maxPagesBeforeCurrentPage;
                endPage = currentPage + maxPagesAfterCurrentPage;
            }
        }

        for (let number = startPage; number <= endPage; number++) {
            items.push(
                <Pagination.Item key={number} active={number === currentPage} onClick={() => handlePageChange(number)}>
                    {number}
                </Pagination.Item>
            );
        }
        return items;
    };


    return (
        <Container fluid="lg" className="my-4">
            <h2 className="mb-4 fw-bold">Loan Repayments Dashboard</h2>

            <Accordion defaultActiveKey="0" className="mb-4">
                <Accordion.Item eventKey="0">
                    <Accordion.Header>
                        <SlidersHorizontal size={20} className="me-2"  /> Filter & Search Repayments
                    </Accordion.Header>
                    <Accordion.Body className="bg-light">
                        <Form>
                            <Row className="g-3">
                                <Col md={6} lg={3}>
                                    <Form.Group controlId="statusFilter">
                                        <Form.Label>Loan Status</Form.Label>
                                        <Form.Select name="status" value={filters.status} onChange={handleFilterChange}>
                                            <option value="">All Statuses</option>
                                            <option value="Active">Active</option>
                                            <option value="Active - Overdue">Active - Overdue</option>
                                            <option value="Fully Repaid">Fully Repaid</option>
                                            <option value="Foreclosed">Foreclosed</option>
                                            <option value="Restructured">Restructured</option>
                                            <option value="Write-Off">Write-Off</option>
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6} lg={3}>
                                    <Form.Group controlId="userIdFilter">
                                        <Form.Label>User ID</Form.Label>
                                        <Form.Control type="text" placeholder="Enter User ID" name="userId" value={filters.userId} onChange={handleFilterChange}/>
                                    </Form.Group>
                                </Col>
                                <Col md={6} lg={3}>
                                    <Form.Group controlId="loanIdFilter">
                                        <Form.Label>Loan ID</Form.Label>
                                        <Form.Control type="text" placeholder="Enter Loan ID" name="loanId" value={filters.loanId} onChange={handleFilterChange}/>
                                    </Form.Group>
                                </Col>
                                <Col md={6} lg={3}>
                                     <Form.Label>Outstanding Amount Range</Form.Label>
                                     <InputGroup>
                                        <Form.Control
                                            type="number"
                                            placeholder="Min"
                                            name="minOutstanding"
                                            value={filters.minOutstanding}
                                            onChange={handleFilterChange}
                                            isInvalid={!!outstandingRangeError} // Apply Bootstrap invalid style
                                            min="0"
                                        />
                                        <Form.Control
                                            type="number"
                                            placeholder="Max"
                                            name="maxOutstanding"
                                            value={filters.maxOutstanding}
                                            onChange={handleFilterChange}
                                            isInvalid={!!outstandingRangeError} // Apply Bootstrap invalid style
                                        />
                                     </InputGroup>
                                     {outstandingRangeError && (
                                        <Form.Text className="text-danger">
                                            {outstandingRangeError}
                                        </Form.Text>
                                    )}
                                </Col>
                            </Row>
                            <Row className="mt-3">
                                <Col className="text-end">
                                     <Button variant="outline-secondary" onClick={handleResetFilters}>
                                        Reset
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                    </Accordion.Body>
                </Accordion.Item>
            </Accordion>


            <Card className="shadow-sm">
                <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Repayment Records</h5>
                    <span className="text-muted small">
                        Showing {repayments.length} of {pagination.totalRecords} records
                    </span>
                </Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    
                    <div className="table-responsive">
                        <Table hover className="align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>Loan Title / ID</th>
                                    <th>Applicant</th>
                                    <th className="text-end">Disbursed</th>
                                    <th className="text-end">Outstanding</th>
                                    <th>Next Due Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="text-center">
                                            <LiquidLoader />
                                        </td>
                                    </tr>
                                ) : repayments.length > 0 ? (
                                    repayments.map(rp => (
                                        <tr key={rp._id}>
                                            <td>
                                                <span className="fw-medium">{rp.loan_id?.title || 'N/A'}</span>
                                                <small className="d-block text-muted">ID: {rp._id}</small>
                                            </td>
                                            <td>
                                                <span>{rp.user_id?.name || 'N/A'}</span>
                                                <small className="d-block text-muted">{rp.user_id?.email}</small>
                                            </td>
                                            <td className="text-end">{formatCurrency(rp.disbursed_amount)}</td>
                                            <td className="text-end text-primary fw-bold">{formatCurrency(rp.current_outstanding_principal)}</td>
                                            <td>{formatDate(rp.next_due_date)}</td>
                                            <td>
                                                <Badge pill bg={getStatusBadgeVariant(rp.loan_repayment_status)}>
                                                    {rp.loan_repayment_status}
                                                </Badge>
                                            </td>
                                            <td>
                                                <Button 
                                                    variant="outline-primary" 
                                                    size="sm" 
                                                    onClick={() => navigate(`/console/repayments/${rp._id}`)} // Adjust route as needed
                                                    title="View Full Details"
                                                >
                                                    <Eye size={16} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5">
                                            <XCircle size={40} className="text-muted mb-2" />
                                            <h5 className="mb-1">No Records Found</h5>
                                            <p className="text-muted">Try adjusting your filters or search again later.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
                {repayments.length > 0 && pagination.totalPages > 1 && (
                    <Card.Footer className="d-flex justify-content-center">
                        <Pagination>
                            <Pagination.First onClick={() => handlePageChange(1)} disabled={pagination.currentPage === 1 || !!outstandingRangeError} />
                            <Pagination.Prev onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage === 1 || !!outstandingRangeError} />
                            {renderPaginationItems()}
                            <Pagination.Next onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages || !!outstandingRangeError} />
                            <Pagination.Last onClick={() => handlePageChange(pagination.totalPages)} disabled={pagination.currentPage === pagination.totalPages || !!outstandingRangeError} />
                        </Pagination>
                    </Card.Footer>
                )}
            </Card>
        </Container>
    );
}