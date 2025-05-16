// --- LoanInfoHeader.js ---
// src/components/applicant/applications/LoanInfoHeader.js
import React from 'react';
import PropTypes from 'prop-types';
import { Card, Row, Col } from 'react-bootstrap';

const LoanInfoHeader = ({ loanSchemaData }) => {
    if (!loanSchemaData) return null;

    return (
        <Card className="shadow-sm mb-4 loan-info-card">
            <Card.Body>
                <Row className="align-items-center">
                    <Col>
                        <h3 className="mb-1 loan-info-title">Apply for: <span className="text-primary fw-bold">{loanSchemaData.title}</span></h3>
                        {loanSchemaData.description && <div className="text-muted loan-info-description" dangerouslySetInnerHTML={{ __html: loanSchemaData.description }} />}
                    </Col>
                    <Col xs="auto" className="text-end loan-info-quick-details">
                        <div className="mb-1"><small className="text-muted">Rate:</small> <strong className="text-success">{loanSchemaData.interest_rate}%</strong></div>
                        <div><small className="text-muted">Max Tenure:</small> <strong>{loanSchemaData.tenure_months} mo</strong></div>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
    );
};

LoanInfoHeader.propTypes = {
    loanSchemaData: PropTypes.object,
};
export default LoanInfoHeader;