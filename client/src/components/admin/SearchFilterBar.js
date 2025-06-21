import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { axiosInstance } from '../../config';
import PopInfo from '../super/PopInfo';
import FilterInputs from './FilterInputs';
import ResultsList from './ResultsList';
import { Alert } from 'react-bootstrap';
import { format, parseISO, isValid } from 'date-fns';
import LiquidLoader from '../super/LiquidLoader';

const processStageOptions = [
  { value: 'pending', label: "Pending Review" },
  { value: 'approved', label: "Approved" },
  { value: 'paid_to_applicant', label: "Paid to Applicant" },
  { value: 'rejected', label: "Rejected" },
];

// Helper to get a clean filter object from URLSearchParams
const getFiltersFromParams = (params, defaultLoanId) => ({
  loanId: params.get('loanId') || defaultLoanId || '',
  accountNumber: params.get('accountNumber') || '',
  applicantName: params.get('applicantName') || '',
  fromDate: params.get('fromDate') || '',
  toDate: params.get('toDate') || '',
  stage: params.get('stage') || '',
});


const SearchFilterBar = ({ onResults }) => {
  const [title] = useState("Search Filters");
  const [description, setDescription] = useState("Use the filters below to find specific applications");
  const [status, setStatus] = useState(false);
  const [formFields, setFormFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);

  // useSearchParams hook to manage URL state
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters state from URL or props
  const [filters, setFilters] = useState(() => getFiltersFromParams(searchParams));

  const fetchResults = useCallback(async (query = {}) => {
    setLoading(true);
    setError(null);
    try {
      // Build query params for the API request from the filter object
      const params = {
        ...(query.loanId && { loanId: query.loanId }),
        ...(query.accountNumber && { accountNumber: query.accountNumber }),
        ...(query.applicantName && { applicantName: query.applicantName }),
        ...(query.stage && { stage: query.stage }),
        ...(query.fromDate && isValid(new Date(query.fromDate)) && {
          fromDate: format(new Date(query.fromDate), 'yyyy-MM-dd'),
        }),
        ...(query.toDate && isValid(new Date(query.toDate)) && {
          toDate: format(new Date(query.toDate), 'yyyy-MM-dd'),
        }),
      };

      const { data } = await axiosInstance.get('/api/application/submissions', { params });

      const formatted = data.map((item) => ({
        id: item._id,
        loanId: item.loan_id,
        loanTitle: item.loan.title,
        applicantName: item.user.name,
        accountNumber: item.user.account_number,
        submittedAt: format(parseISO(item.created_at), 'yyyy-MM-dd HH:mm'),
        stage: item.stage,
        amount: item.amount,
      }));

      setFormFields(formatted);
      setTotalResults(formatted.length);
      onResults(formatted);
    } catch (err) {
      console.error("API Error:", err.response?.data || err.message);
      setError("Failed to fetch applications. Please try again later.");
      setFormFields([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, [onResults]); // `onResults` is a stable function passed from parent

  // Effect now listens to `searchParams` changes (e.g., from URL, back/forward buttons)
  useEffect(() => {
    const currentFilters = getFiltersFromParams(searchParams);
    setFilters(currentFilters); // Sync local state with URL
    fetchResults(currentFilters);
  }, [searchParams, fetchResults]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };
  
  // handleSearch now updates the URL, which triggers the useEffect to fetch data
  const handleSearch = () => {
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v != null && v !== '')
    );
    setSearchParams(cleanFilters, { replace: true });
  };

  // handleReset clears the URL params (except for initial loan_id)
  const handleReset = () => {
    const resetState = {
      loanId: '',
      accountNumber: '',
      applicantName: '',
      fromDate: '',
      toDate: '',
      stage: '',
    };
    setFilters(resetState); // Update local UI immediately
    
    const resetParams = {};
    setSearchParams(resetParams, { replace: true });
  };

  const toggleModelStatus = () => {
    setStatus((s) => !s);
    setDescription((d) =>
      status
        ? "Use the filters below to find specific applications"
        : "Advanced search capabilities"
    );
  };

  return (
    <div className="search-filter-container">
      <PopInfo
        title={title}
        description={description}
        status={status}
        toggleModelStatus={toggleModelStatus}
      />

      <FilterInputs
        filters={filters}
        onChange={handleChange}
        processStageOptions={processStageOptions}
        onSearch={handleSearch}
        onReset={handleReset}
      />

      {loading ? (
        <LiquidLoader/>
      ) : error ? (
        <Alert variant="danger" className="mt-4">
          {error}
        </Alert>
      ) : formFields.length ? (
        <ResultsList formFields={formFields} totalResults={totalResults} />
      ) : (
        <Alert variant="light" className="mt-4 text-center">
          No applications found matching the filters.
        </Alert>
      )}
    </div>
  );
};

SearchFilterBar.propTypes = {
  onResults: PropTypes.func.isRequired,
  loan_id: PropTypes.string, // The component can optionally be scoped to a loan
};

export default SearchFilterBar;