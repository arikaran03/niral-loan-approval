import { BrowserRouter, Route, Routes } from "react-router-dom";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import PrivateRoute from "./PrivateRoute";
import ApplicationForm from "./components/applicant/applications/ApplicationForm"; // Corrected path based on your image
import FormBuilderContainer from "./components/admin/loan/FormBuilderContainer";
import PageNotFound from "./components/super/PageNotFound";
import ApplicationsPage from "./components/admin/ApplicationsPage";
import AvailableLoans from "./components/applicant/applications/AvailableLoans";
import SubmissionDetails from "./components/admin/SubmissionDetails";
import LoanListPage from "./components/admin/loan/LoanListPage";
import Profile from "./components/Profile";
import AdminDashboard from "./components/admin/AdminDashboard";
import UserDashboard from "./components/applicant/UserDashboard";
import ApplicationFullDetails from "./components/applicant/applications/ApplicationFullDetails"; // Corrected path
import DynamicDocumentForm from "./components/admin/schema/DynamicDocumentForm";
import DynamicDocumentSubmissionForm from "./components/admin/schema/DynamicDocumentSubmissionForm";

import WaiverBuilderContainer from "./components/admin/waivering/WaiveringBuilderContainer";
import WaiverApplicationForm from "./components/applicant/waivering/WaiverApplicationForm";

// Import the new repayment components
import MyLoanRepaymentsPage from "./components/applicant/repayments/MyLoanRepaymentsPage";
import LoanRepaymentDetailPage from "./components/applicant/repayments/LoanRepaymentDetailPage";
import AdminRepaymentsDashboard from "./components/admin/repayments/AdminRepaymentsDashboard";
import AdminRepaymentDetailPage from "./components/admin/repayments/AdminRepaymentDetailPage";
import WaiverSubmissionDetailsPage from "./components/admin/waivering/WaiverSubmissionDetailsPage";
import AdminWaiverSubmissionsPage from "./components/admin/waivering/AdminWaiverSubmissionsPage";
import WaiverSchemeListPage from "./components/admin/waivering/WaiverSchemeListPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Console Routes */}
        <Route path="/console" element={<PrivateRoute role={"admin"}/>}>
          <Route path="" element={<AdminDashboard />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="application/:id" element={<SubmissionDetails />} />
          <Route path="loans" element={<LoanListPage />} />
          <Route path="waiver-schemes" element={<WaiverSchemeListPage />} />
          <Route path="waiver-schemes/:waiverId" element={<WaiverBuilderContainer />} />
          <Route path="form-builder" element={<FormBuilderContainer />} />
          <Route path="waiver-builder" element={<WaiverBuilderContainer />} />
          <Route path="waiver-builder/:waiverId" element={<WaiverBuilderContainer />} />
          <Route path="waiver-submission/:submissionId" element={<WaiverSubmissionDetailsPage />} />
          <Route path="waiver-submissions" element={<AdminWaiverSubmissionsPage />} />
          
          {/* Admin Loan Routes */}
          <Route
            path="form-builder/:loanId"
            element={<FormBuilderContainer />}
          />

          {/* Admin Repayment Routes */}
          <Route path="schema" element={<DynamicDocumentForm />} />
          <Route
            path="submit-schema"
            element={<DynamicDocumentSubmissionForm />}
          />
          <Route path="repayments" element={<AdminRepaymentsDashboard/>} />
          <Route path="repayments/:repaymentId" element={<AdminRepaymentDetailPage />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<PageNotFound />} />
        </Route>

        {/* Applicant/User Routes */}
        <Route path="/" element={<PrivateRoute role={"applicant"} />}>
          <Route path="" element={<AvailableLoans />} />
          <Route path="dashboard" element={<UserDashboard />} />
          <Route
            path="applications/:submissionId"
            element={<ApplicationFullDetails />}
          />
          <Route path="waiver-application/:waiverSchemeId" element={<WaiverApplicationForm />} />
          <Route path="apply/:loanId" element={<ApplicationForm />} />

          {/* Applicant Repayment Routes */}
          <Route path="repayments" element={<MyLoanRepaymentsPage />} />
          <Route
            path="repayments/:repaymentId"
            element={<LoanRepaymentDetailPage />}
          />
           <Route path="profile" element={<Profile />} />
        </Route>

        {/* Auth Routes */}
        <Route path="/admin/register/new-user" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* Catch-all for Page Not Found */}
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
