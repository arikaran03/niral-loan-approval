import React from 'react';
import { Container, Row, Col, Card, Alert } from 'react-bootstrap';

const FormSubmitted = ({ submissionId }) => {
  return (
    <Container className="d-flex justify-content-center align-items-center min-vh-100">
      <Row className="w-100 justify-content-center">
        <Col xs={12} md={8} lg={6}>
          <Card className="shadow-lg border-success">
            <Card.Body>
              <Alert variant="success" className="text-center">
                <Alert.Heading>✅ Form Submitted Successfully!</Alert.Heading>
                <p className="mb-0">
                  Thank you for applying. You will receive a confirmation shortly.
                </p>
                {submissionId && (
                  <p className="mt-3 text-muted small">
                    Submission ID: <strong>{submissionId}</strong>
                  </p>
                )}
              </Alert>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default FormSubmitted;
