import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { axiosInstance } from '../../config';
import PopInfo from '../super/PopInfo';
import FilterInputs from './FilterInputs';
import ResultsList from './ResultsList';
import { Alert, Spinner } from 'react-bootstrap';
import { format, parseISO } from 'date-fns';

const processStageOptions = [
  { value: 'pending', label: "Pending Review" },
  { value: 'document_verification', label: "Document Verification" },
  { value: 'pending_approval', label: "Pending Approval" },
  { value: 'approved', label: "Approved" },
  { value: 'rejected', label: "Rejected" },
];

const SearchFilterBar = ({ onResults }) => {
  const [title] = useState("Search Filters");
  const [description, setDescription] = useState(
    "Use the filters below to find specific applications"
  );
  const [status, setStatus] = useState(false);
  const [formFields, setFormFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalResults, setTotalResults] = useState(0);

  const [filters, setFilters] = useState({
    loanId: '',
    accountNumber: '',
    applicantName: '',
    fromDate: '',
    toDate: '',
    stage: '',
  });

  const fetchResults = async (query = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...(query.loanId && { loanId: query.loanId }),
        ...(query.accountNumber && { accountNumber: query.accountNumber }),
        ...(query.applicantName && { applicantName: query.applicantName }),
        ...(query.stage && { stage: query.stage }),
        ...(query.fromDate && {
          fromDate: format(new Date(query.fromDate), 'yyyy-MM-dd'),
        }),
        ...(query.toDate && {
          toDate: format(new Date(query.toDate), 'yyyy-MM-dd'),
        }),
      };

      console.log("Querying /api/submissions with", params);
      const { data } = await axiosInstance.get('/api/application/submissions', { params });

      console.log("API Response:", data);

      const formatted = data.map((item) => ({
        id: item._id,
        loanId: item.loan._id,
        loanTitle: item.loan.title,
        applicantName: item.user.name,
        accountNumber: item.user.account_number,
        submittedAt: format(parseISO(item.created_at), 'yyyy-MM-dd HH:mm'),
        stage: item.stage,
        amount: item.amount,
      }));

      console.log("Formatted Results:", formatted); 

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
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSearch = () => {
    const clean = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== '')
    );
    fetchResults(clean);
  };

  const handleReset = () => {
    setFilters({
      loanId: '',
      accountNumber: '',
      applicantName: '',
      fromDate: '',
      toDate: '',
      stage: '',
    });
    fetchResults();
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
        <div className="text-center my-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2 text-muted">Loading applications...</p>
        </div>
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
};

export default SearchFilterBar;
