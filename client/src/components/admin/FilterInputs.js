import PropTypes from 'prop-types';
import { Form, Row, Col, Button, InputGroup } from 'react-bootstrap';
import { FaSearch, FaUser, FaCalendarAlt, FaIdBadge, FaFilter } from 'react-icons/fa';
import './FilterInputs.css'; // Keep this for custom styles

const FilterInputs = ({ filters, onChange, processStageOptions, onSearch }) => {
  return (
    <div className="filter-container">
      <h4 className="filter-header">
        <FaFilter className="mr-2" />
        Advanced Loan Filters
      </h4>

      <Form className="filter-form">
        <Row className="mb-4">
          <Col md={4} className="mb-md-0">
            <Form.Group controlId="filterLoanId">
              <Form.Label className="d-flex align-items-center">
                <FaIdBadge className="mr-2" />
                Loan ID
              </Form.Label>
              <InputGroup>
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
          <Col md={4} className="mb-md-0">
            <Form.Group controlId="filterAccount">
              <Form.Label className="d-flex align-items-center">
                <FaIdBadge className="mr-2" />
                Account No.
              </Form.Label>
              <InputGroup>
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
          <Col md={4} className="mb-md-0">
            <Form.Group controlId="filterUsername">
              <Form.Label className="d-flex align-items-center">
                <FaUser className="mr-2" />
                Applicant Name
              </Form.Label>
              <InputGroup>
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

        <Row className="mb-4">
          <Col md={3} className="mb-md-0">
            <Form.Group controlId="filterFrom">
              <Form.Label className="d-flex align-items-center">
                <FaCalendarAlt className="mr-2" />
                From Date
              </Form.Label>
              <Form.Control
                type="date"
                name="fromDate"
                value={filters.fromDate}
                onChange={onChange}
                className="filter-input"
              />
            </Form.Group>
          </Col>
          <Col md={3} className="mb-md-0">
            <Form.Group controlId="filterTo">
              <Form.Label className="d-flex align-items-center">
                <FaCalendarAlt className="mr-2" />
                To Date
              </Form.Label>
              <Form.Control
                type="date"
                name="toDate"
                value={filters.toDate}
                onChange={onChange}
                className="filter-input"
              />
            </Form.Group>
          </Col>
          <Col md={4} className="mb-md-0">
            <Form.Group controlId="filterStage">
              <Form.Label className="d-flex align-items-center">
                <FaFilter className="mr-2" />
                Process Stage
              </Form.Label>
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
          <Col md={2} className="d-flex align-items-end">
            <Button
              variant="primary"
              onClick={onSearch}
              className="w-100 search-button"
            >
              <FaSearch className="mr-2" />
              Apply
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

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
};

export default FilterInputs;
