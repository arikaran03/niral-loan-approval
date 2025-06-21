// src/components/ResultsList.jsx
import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Table,
  Badge,
  Button,
  Pagination,
  Stack, // Keep Stack for header sorting
  FormControl,
  InputGroup,
  Card, // Use Card for structure
  Row,
  Col
} from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isValid } from 'date-fns'; // Added isValid
import {
  FaSort,
  FaSortUp,
  FaSortDown,
  FaSearch,
  FaArrowRight
} from 'react-icons/fa';
import "./ResultsList.css";
import LiquidLoader from '../super/LiquidLoader';

// Stage labels and variants consistent with potential theme
const stageLabels = {
  draft: 'Draft', // Added draft
  pending: 'Pending Review',
  document_verification: 'Docs Verification', // Shortened
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected'
};

const stageVariants = {
  draft: 'secondary-subtle', // Subtle variants
  pending: 'warning-subtle',
  document_verification: 'info-subtle',
  pending_approval: 'primary-subtle',
  approved: 'success-subtle',
  rejected: 'danger-subtle'
};

const stageTextEmphasis = { // Matching text emphasis for subtle badges
    draft: 'secondary-emphasis',
    pending: 'warning-emphasis',
    document_verification: 'info-emphasis',
    pending_approval: 'primary-emphasis',
    approved: 'success-emphasis',
    rejected: 'danger-emphasis'
};


export default function ResultsList({ formFields }) {
  const navigate = useNavigate();
  const [sortConfig, setSortConfig] = useState({ key: 'submittedAt', direction: 'desc' });
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Items per page

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page on sort
  };

  // Filtering logic (adjust fields as needed)
  const filteredData = formFields.filter(item => {
    const q = filter.toLowerCase().trim();
    if (!q) return true; // Show all if filter is empty
    return (
      item.loanTitle?.toLowerCase().includes(q) ||
      item.applicantName?.toLowerCase().includes(q) ||
      item.accountNumber?.includes(q) ||
      item.id?.toLowerCase().includes(q) || // Allow filtering by ID
      (stageLabels[item.stage] || item.stage)?.toLowerCase().includes(q) // Allow filtering by status label
    );
  });

  // Sorting logic
  const sortedData = [...filteredData].sort((a, b) => {
    const { key, direction } = sortConfig;
    let valA = a[key];
    let valB = b[key];

    // Handle date sorting
    if (key === 'submittedAt') {
      valA = a.submittedAt ? new Date(a.submittedAt) : new Date(0); // Handle potential invalid dates
      valB = b.submittedAt ? new Date(b.submittedAt) : new Date(0);
      const diff = valA - valB;
      return direction === 'asc' ? diff : -diff;
    }

    // Handle stage sorting (alphabetical on label)
    if (key === 'stage') {
      valA = stageLabels[a.stage] || a.stage || '';
      valB = stageLabels[b.stage] || b.stage || '';
    }

    // Handle other string sorting (case-insensitive)
    if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
    }

    // Default comparison
    if (valA < valB) return direction === 'asc' ? -1 : 1;
    if (valA > valB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const startItemIndex = (currentPage - 1) * itemsPerPage;
  const endItemIndex = startItemIndex + paginatedData.length;

  // Helper for sort icons
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="sort-icon" />;
    return sortConfig.direction === 'asc' ? (
      <FaSortUp className="sort-icon sort-icon-active" />
    ) : (
      <FaSortDown className="sort-icon sort-icon-active" />
    );
  };

  // Helper for date formatting
  const formatDate = (dateString) => {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'MMM d, yyyy · h:mm a') : 'Invalid Date';
  }

  // Handle no data initial state
  if (!formFields) {
     return <LiquidLoader/>;
  }


  return (
    // Use Card for overall structure
    <Card className="shadow-sm border-0 results-list-card">
      <Card.Header className="bg-light p-3 results-header">
        <Row className="align-items-center g-2"> {/* Use Row/Col for layout */}
          <Col xs={12} md="auto" className="results-count">
             {/* Improved count display */}
             {filteredData.length > 0 ? (
                <span className="text-muted">
                    Showing {startItemIndex + 1}-{endItemIndex} of {filteredData.length} result{filteredData.length !== 1 ? 's' : ''}
                    {filter && ` (filtered from ${formFields.length})`}
                </span>
             ) : (
                 <span className="text-muted">
                    {filter ? `0 results match "${filter}"` : `0 applications found`}
                 </span>
             )}
          </Col>
          <Col xs={12} md={true} lg={5} xl={4} className="ms-md-auto"> {/* Search input */}
            <InputGroup size="sm" className="search-input-group">
              <InputGroup.Text className="bg-white border-end-0">
                 <FaSearch className="text-secondary" />
              </InputGroup.Text>
              <FormControl
                placeholder="Filter by title, name, account, status..."
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setCurrentPage(1); // Reset page on filter change
                }}
                className="border-start-0 search-input"
              />
               {filter && ( // Show clear button only when filter has text
                    <Button variant="outline-secondary" size="sm" onClick={() => { setFilter(''); setCurrentPage(1); }} className="clear-filter-btn">
                        &times; {/* Clear icon */}
                    </Button>
                )}
            </InputGroup>
          </Col>
        </Row>
      </Card.Header>

      <Card.Body className="p-0"> {/* Remove padding if table fills body */}
        <div className="table-responsive">
          <Table hover className="results-table align-middle mb-0"> {/* Added align-middle */}
            <thead className="table-light">
              <tr>
                {/* Use Stack for header content + sort icon */}
                <th onClick={() => handleSort('submittedAt')} className="sortable-header">
                  <Stack direction="horizontal" gap={1}> Date Submitted {getSortIcon('submittedAt')} </Stack>
                </th>
                <th>Loan</th>
                <th>Applicant</th>
                <th>Account #</th>
                <th onClick={() => handleSort('stage')} className="sortable-header text-center">
                   <Stack direction="horizontal" gap={1} className="justify-content-center"> Status {getSortIcon('stage')} </Stack>
                </th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? paginatedData.map((item) => (
                <tr key={item.id} className="data-row">
                  <td className="text-nowrap date-cell">{formatDate(item.submittedAt)}</td>
                  <td className="">{item.loanTitle || 'N/A'}</td>
                  <td className="applicant-name">{item.applicantName || 'N/A'}</td>
                  <td className="account-number">{item.accountNumber || 'N/A'}</td>
                  <td className="text-center">
                    <Badge
                        pill
                        bg={stageVariants[item.stage] || 'light'}
                        text={stageTextEmphasis[item.stage] || 'dark'}
                        className="status-badge"
                    >
                      {stageLabels[item.stage] || item.stage}
                    </Badge>
                  </td>
                  <td className="text-center action-cell">
                    <Button
                      variant="outline-primary" // Consistent outline style
                      size="sm"
                      onClick={() => navigate(`/console/application/${item.id}`)}
                      className="view-button"
                      title="View Application Details" // Tooltip text
                    >
                      View <FaArrowRight className="ms-1" />
                    </Button>
                  </td>
                </tr>
              )) : (
                 <tr>
                    <td colSpan={6} className="text-center text-muted p-4">
                        {filter ? `No results match "${filter}"` : 'No applications available.'}
                    </td>
                 </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Card.Body>

      {/* Pagination - Only show if needed */}
      {totalPages > 1 && (
        <Card.Footer className="bg-light border-top pagination-footer">
          <Pagination size="sm" className="justify-content-center mb-0 results-pagination">
            <Pagination.First onClick={() => setCurrentPage(1)} disabled={currentPage === 1} />
            <Pagination.Prev onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} />

            {/* Generate page numbers (simplified example, could add ellipsis for many pages) */}
             {Array.from({ length: totalPages }, (_, i) => (
               <Pagination.Item
                 key={i + 1}
                 active={i + 1 === currentPage}
                 onClick={() => setCurrentPage(i + 1)}
               >
                 {i + 1}
               </Pagination.Item>
             ))}

            <Pagination.Next onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} />
            <Pagination.Last onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} />
          </Pagination>
        </Card.Footer>
      )}
    </Card>
  );
}

// PropTypes remain the same
ResultsList.propTypes = {
  formFields: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      submittedAt: PropTypes.string.isRequired,
      loanTitle: PropTypes.string.isRequired,
      applicantName: PropTypes.string.isRequired,
      accountNumber: PropTypes.string.isRequired,
      stage: PropTypes.string.isRequired,
    })
  ).isRequired,
};