import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { axiosInstance } from "../../../config";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Spinner,
  Alert,
} from "react-bootstrap";
import { motion } from "framer-motion";
import { Briefcase, CheckCircle, FileText, Calendar } from "lucide-react"; // Import icons
import "./AvailableLoans.css"; // Import custom styles
import { format } from 'date-fns';

const loanCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.3,
      ease: "easeInOut",
    },
  }),
};

const AvailableLoans = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axiosInstance
      .get("/api/loans")
      .then((res) => {
        setLoans(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching available loans:", err);
        setLoading(false);
      });
  }, []);

  const handleApply = (loanId) => {
    navigate(`/apply/${loanId}`);
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center h-75">
        <div className="loading-container">
          <Spinner animation="border" variant="primary" size="lg" />
          <p className="mt-3">Loading available loans...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="my-5">
      <h2 className="page-title">
        <Briefcase className="mr-2" />
        Available Loan Applications
      </h2>
      {loans.length ? (
        <Row className="g-4">
          {loans.map((loan, idx) => (
            <Col key={idx} md={6} lg={6} className="mb-4">
              <motion.div
                variants={loanCardVariants}
                initial="hidden"
                animate="visible"
                custom={idx}
                className="loan-card-wrapper"
              >
                <Card className="loan-card h-100">
                  <Card.Body className="d-flex flex-column">
                    <Card.Title className="loan-title">
                      {loan.title}
                    </Card.Title>
                    <div className="loan-details">
                        <p><Calendar className="mr-1" size={16} /> <strong>Start Date:</strong> {loan.application_start ? format(new Date(loan.application_start), 'PPP') : 'N/A'}</p>
                        <p><Calendar className="mr-1" size={16}/> <strong>End Date:</strong> {loan.application_end ? format(new Date(loan.application_end), 'PPP') : 'N/A'}</p>
                        <p><strong>Amount Allocated:</strong> ₹{loan.amountAllocated || 'N/A'}</p>
                        <p><strong>Created By:</strong> {loan.created_by?.name || 'N/A'}</p>
                    </div>
                    {loan.fields?.length > 0 && (
                      <div className="loan-fields-preview">
                        <h6 className="fields-preview-title">
                          <FileText className="mr-1" size={16} />
                          Fields Preview
                        </h6>
                        <ul className="list-group list-group-flush">
                          {loan.fields
                            .slice(0, 3)
                            .map((f, index) => (
                              <li
                                key={f.field_id}
                                className={`list-group-item ${index === 0 ? "first-item" : ""} ${index === 2 ? "last-item" : ""}`}
                              >
                                <CheckCircle
                                  className="mr-1 text-success"
                                  size={16}
                                />
                                {f.field_label}
                              </li>
                            ))}
                           {loan.fields.length > 3 && (
                            <li className="list-group-item last-item">
                              <CheckCircle
                                  className="mr-1 text-success"
                                  size={16}
                                />
                              +{loan.fields.length - 3} more
                            </li>
                           )}
                        </ul>
                      </div>
                    )}
                    <Button
                      variant="primary"
                      className="apply-button mt-auto"
                      onClick={() => handleApply(loan._id)}
                    >
                      Apply Now
                    </Button>
                  </Card.Body>
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>
      ) : (
        <Alert variant="info" className="no-loans-alert">
          No available loans found. Please check back later.
        </Alert>
      )}
    </Container>
  );
};

export default AvailableLoans;

