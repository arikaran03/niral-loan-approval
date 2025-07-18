// src/components/admin/AdminWaiverSubmissionsPage.jsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Container,
  Card,
  Form,
  Row,
  Col,
  Button,
  Table,
  Badge,
  Pagination,
  Spinner,
  Alert,
  Accordion,
} from "react-bootstrap";
import {
  Sliders,
  Eye,
  XCircle,
  Clock,
  CheckCircle as CheckCircleIcon,
} from "lucide-react";
import { formatDate } from "../../../utils/formatters"; // Adjust path
import { axiosInstance } from "../../../config"; // Adjust path
import LiquidLoader from "../../super/LiquidLoader";

// Debounce hook to prevent API calls on every keystroke
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

const STAGE_LABELS = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};
const stageBadgeVariant = {
  draft: "secondary",
  pending_review: "warning",
  approved: "success",
  rejected: "danger",
};
const getStatusIcon = (stage) => {
  switch (stage) {
    case "approved":
      return <CheckCircleIcon size={14} className="me-1" />;
    case "rejected":
      return <XCircle size={14} className="me-1" />;
    case "pending_review":
      return <Clock size={14} className="me-1" />;
    default:
      return null;
  }
};

export default function AdminWaiverSubmissionsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRangeError, setDateRangeError] = useState(null);

  // Initialize filters from the URL search params
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(location.search);
    return {
      stage: params.get("stage") || "",
      applicantIdentifier: params.get("applicantIdentifier") || "",
      _id: params.get("_id") || "",
      startDate: params.get("startDate") || "",
      endDate: params.get("endDate") || "",
    };
  });

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
  });

  const debouncedIdentifier = useDebounce(filters.applicantIdentifier, 500);

  // This effect syncs the URL with the filters state
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.stage) params.set("stage", filters.stage);
    if (debouncedIdentifier)
      params.set("applicantIdentifier", debouncedIdentifier);
    if (filters._id) params.set("_id", filters._id);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", filters.endDate);

    // Use replace to avoid polluting browser history on every filter change
    navigate(`${location.pathname}?${params.toString()}`, { replace: true });
  }, [filters, debouncedIdentifier, navigate, location.pathname]);

  const fetchSubmissions = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");
      setDateRangeError(null);

      const currentParams = new URLSearchParams(location.search);

      if (currentParams.get("startDate") && currentParams.get("endDate")) {
        const start = new Date(currentParams.get("startDate"));
        const end = new Date(currentParams.get("endDate"));
        if (start > end) {
          setDateRangeError("'Start Date' cannot be after 'End Date'.");
          setLoading(false);
          setSubmissions([]);
          setPagination({ currentPage: 1, totalPages: 1, totalRecords: 0 });
          return;
        }
      }

      try {
        currentParams.set("page", page);

        const { data } = await axiosInstance.get(
          `/api/waiver-submissions/search?${currentParams.toString()}`
        );

        setSubmissions(data.data);
        setPagination(data.pagination);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "An error occurred while fetching submissions."
        );
      } finally {
        setLoading(false);
      }
    },
    [location.search]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const page = parseInt(params.get("page"), 10) || 1;
    fetchSubmissions(page);
  }, [fetchSubmissions, location.search]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const newFilters = { ...prev, [name]: value };

      if (name === "startDate" || name === "endDate") {
        const startDate = newFilters.startDate
          ? new Date(newFilters.startDate)
          : null;
        const endDate = newFilters.endDate
          ? new Date(newFilters.endDate)
          : null;

        if (startDate && endDate && startDate > endDate) {
          setDateRangeError("'Start Date' cannot be after 'End Date'.");
        } else {
          setDateRangeError(null);
        }
      }
      return newFilters;
    });
  };

  const handleResetFilters = () => {
    setFilters({
      stage: "",
      applicantIdentifier: "",
      _id: "",
      startDate: "",
      endDate: "",
    });
    setDateRangeError(null);
  };

  const handlePageChange = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= pagination.totalPages) {
      const params = new URLSearchParams(location.search);
      params.set("page", pageNumber);
      navigate(`${location.pathname}?${params.toString()}`);
    }
  };

  return (
    <Container fluid="lg" className="my-4">
      <h2 className="mb-4 fw-bold">Waiver Submissions</h2>

      <Accordion defaultActiveKey="0" className="mb-4 shadow-sm">
        <Accordion.Item eventKey="0">
          <Accordion.Header>
            <Sliders size={20} className="me-2" /> Advanced Filters
          </Accordion.Header>
          <Accordion.Body className="bg-light">
            <Form>
              <Row className="g-3">
                <Col md={6} lg={3}>
                  <Form.Group>
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      name="stage"
                      value={filters.stage}
                      onChange={handleFilterChange}
                    >
                      <option value="">All</option>
                      <option value="pending_review">Pending Review</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="draft">Draft</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6} lg={3}>
                  <Form.Group>
                    <Form.Label>Applicant Name or Email</Form.Label>
                    <Form.Control
                      type="text"
                      name="applicantIdentifier"
                      placeholder="Search..."
                      value={filters.applicantIdentifier}
                      onChange={handleFilterChange}
                    />
                  </Form.Group>
                </Col>
                <Col md={6} lg={3}>
                  <Form.Group>
                    <Form.Label>Start Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="startDate"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                      isInvalid={!!dateRangeError}
                    />
                  </Form.Group>
                </Col>
                <Col md={6} lg={3}>
                  <Form.Group>
                    <Form.Label>End Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="endDate"
                      value={filters.endDate}
                      onChange={handleFilterChange}
                      isInvalid={!!dateRangeError}
                    />
                  </Form.Group>
                </Col>
                <Col md={6} lg={3}>
                  <Form.Group>
                    <Form.Label>Waiver Scheme ID</Form.Label>
                    <Form.Control
                      type="text"
                      name="_id"
                      placeholder="ID"
                      value={filters._id}
                      onChange={handleFilterChange}
                    />
                  </Form.Group>
                </Col>
              </Row>
              {dateRangeError && (
                <Row className="mt-2">
                  <Col>
                    <Alert variant="danger" className="py-2 px-3 m-0">
                      {dateRangeError}
                    </Alert>
                  </Col>
                </Row>
              )}
              <Row className="mt-3">
                <Col className="text-end">
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={handleResetFilters}
                  >
                    Reset Filters
                  </Button>
                </Col>
              </Row>
            </Form>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>

      <Card className="shadow-sm">
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Submission Records</h5>
          <span className="text-muted small">
            Showing {submissions.length} of {pagination.totalRecords} records
          </span>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="table-responsive">
            <Table hover className="align-middle">
              <thead className="table-light">
                <tr>
                  <th>Applicant</th>
                  <th>Waiver Scheme</th>
                  <th>Submission Date</th>
                  <th>Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center align-middle">
                      <LiquidLoader />
                    </td>
                  </tr>
                ) : submissions.length > 0 ? (
                  submissions.map((sub) => (
                    <tr key={sub._id}>
                      <td>
                        <div>{sub.user_id?.name || "N/A"}</div>
                        <small className="text-muted">
                          {sub.user_id?.email}
                        </small>
                      </td>
                      <td >
                        <Link to={`/console/waiver-builder/${sub.waiver_scheme_id._id}`} className="text-decoration-none">
                            {sub.waiver_scheme_id.title}
                        </Link>
                    </td>
                      <td>{formatDate(sub.created_at)}</td>
                      <td>
                        <Badge
                          pill
                          bg={stageBadgeVariant[sub.stage]}
                          className="d-flex align-items-center"
                        >
                          {getStatusIcon(sub.stage)} {STAGE_LABELS[sub.stage]}
                        </Badge>
                      </td>
                      <td className="text-center">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() =>
                            navigate(`/console/waiver-submission/${sub._id}`)
                          }
                        >
                          <Eye size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-5">
                      <XCircle size={40} className="text-muted mb-2" />
                      <h5 className="mb-1">No Submissions Found</h5>
                      <p className="text-muted">Try adjusting your filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
        {submissions.length > 0 && pagination.totalPages > 1 && (
          <Card.Footer className="d-flex justify-content-center">
            <Pagination>
              <Pagination.First
                onClick={() => handlePageChange(1)}
                disabled={pagination.currentPage === 1}
              />
              <Pagination.Prev
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
              />
              {[...Array(pagination.totalPages)].map((_, i) => (
                <Pagination.Item
                  key={i + 1}
                  active={i + 1 === pagination.currentPage}
                  onClick={() => handlePageChange(i + 1)}
                >
                  {i + 1}
                </Pagination.Item>
              ))}
              <Pagination.Next
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
              />
              <Pagination.Last
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.currentPage === pagination.totalPages}
              />
            </Pagination>
          </Card.Footer>
        )}
      </Card>
    </Container>
  );
}
