import PropTypes from 'prop-types';
import { Form, Row, Col, Button, InputGroup } from 'react-bootstrap';
import { FaSearch, FaUser, FaIdBadge, FaFilter, FaTimes } from 'react-icons/fa'; // Added FaTimes for Reset
import './FilterInputs.css';

// Added onReset to props
const FilterInputs = ({ filters, onChange, processStageOptions, onSearch, onReset }) => { 
  return (
    <div className="filter-container">
      <h4 className="filter-header">
        <FaFilter className="mr-2" />
        Advanced Loan Filters
      </h4>

      <Form className="filter-form" onSubmit={(e) => { e.preventDefault(); onSearch(); }}>
        <Row className="mb-4 align-items-center">
          <Col md={6} lg={4} className="mb-3 mb-lg-0">
            <Form.Group controlId="filterLoanId">
              <Form.Label>Loan ID</Form.Label>
              <InputGroup>
                <InputGroup.Text><FaIdBadge /></InputGroup.Text>
                <Form.Control
                  type="text"
                  name="loanId"
                  placeholder="Enter Loan ID"
                  value={filters.loanId}
                  onChange={onChange}
                  className="filter-input"
                />
              </InputGroup>
            </Form.Group>
          </Col>
          <Col md={6} lg={4} className="mb-3 mb-lg-0">
            <Form.Group controlId="filterAccount">
              <Form.Label>Account No.</Form.Label>
              <InputGroup>
                <InputGroup.Text><FaIdBadge /></InputGroup.Text>
                <Form.Control
                  type="text"
                  name="accountNumber"
                  placeholder="Enter Account Number"
                  value={filters.accountNumber}
                  onChange={onChange}
                  className="filter-input"
                />
              </InputGroup>
            </Form.Group>
          </Col>
          <Col md={12} lg={4} className="mb-3 mb-lg-0">
            <Form.Group controlId="filterUsername">
              <Form.Label>Applicant Name</Form.Label>
              <InputGroup>
                <InputGroup.Text><FaUser /></InputGroup.Text>
                <Form.Control
                  type="text"
                  name="applicantName"
                  placeholder="Enter Applicant Name"
                  value={filters.applicantName}
                  onChange={onChange}
                  className="filter-input"
                />
              </InputGroup>
            </Form.Group>
          </Col>
        </Row>

        <Row className="align-items-end">
          <Col md={6} lg={3} className="mb-3 mb-lg-0">
            <Form.Group controlId="filterFrom">
              <Form.Label>From Date</Form.Label>
              <Form.Control
                type="date"
                name="fromDate"
                value={filters.fromDate}
                onChange={onChange}
                className="filter-input"
                // --- CHANGE ADDED ---
                // This prevents selecting a fromDate that is after the toDate
                max={filters.toDate || ''}
              />
            </Form.Group>
          </Col>
          <Col md={6} lg={3} className="mb-3 mb-lg-0">
            <Form.Group controlId="filterTo">
              <Form.Label>To Date</Form.Label>
              <Form.Control
                type="date"
                name="toDate"
                value={filters.toDate}
                onChange={onChange}
                className="filter-input"
                // --- CHANGE ADDED ---
                // This prevents selecting a toDate that is before the fromDate
                min={filters.fromDate || ''}
              />
            </Form.Group>
          </Col>
          <Col md={12} lg={4} className="mb-3 mb-lg-0">
            <Form.Group controlId="filterStage">
              <Form.Label>Process Stage</Form.Label>
              <Form.Select
                name="stage"
                value={filters.stage}
                onChange={onChange}
                className="filter-select"
              >
                <option value="">All Stages</option>
                {processStageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={12} lg={2} className="d-flex gap-2">
            <Button
              variant="primary"
              onClick={onSearch}
              className="w-100 search-button"
            >
              <FaSearch className="mr-2" />
              Apply
            </Button>
            {/* Added Reset Button */}
            <Button
              variant="outline-secondary"
              onClick={onReset}
              className="w-100 outline-secondary"
            >
              <FaTimes />
              Reset Filters
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

// Updated propTypes to include onReset
FilterInputs.propTypes = {
  filters: PropTypes.shape({
    loanId: PropTypes.string,
    accountNumber: PropTypes.string,
    applicantName: PropTypes.string,
    fromDate: PropTypes.string,
    toDate: PropTypes.string,
    stage: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  processStageOptions: PropTypes.arrayOf(
    PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })
  ).isRequired,
  onSearch: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired, // Added onReset
};

export default FilterInputs;