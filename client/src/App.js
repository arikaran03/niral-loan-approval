import { BrowserRouter, Route, Routes } from "react-router-dom";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import PrivateRoute from "./PrivateRoute";
import ApplicationForm from "./components/applicant/applications/ApplicationForm"; // Corrected path based on your image
import FormBuilderContainer from "./components/admin/FormBuilderContainer";
import PageNotFound from "./components/super/PageNotFound";
import ApplicationsPage from "./components/admin/ApplicationsPage";
import AvailableLoans from "./components/applicant/applications/AvailableLoans";
import SubmissionDetails from "./components/admin/SubmissionDetails";
import LoanListPage from "./components/admin/LoanListPage";
import Profile from "./components/Profile";
import AdminDashboard from "./components/admin/AdminDashboard";
import UserDashboard from "./components/applicant/UserDashboard";
import ApplicationFullDetails from "./components/applicant/applications/ApplicationFullDetails"; // Corrected path
import DynamicDocumentForm from "./components/admin/schema/DynamicDocumentForm";

// Import the new repayment components
import MyLoanRepaymentsPage from "./components/applicant/repayments/MyLoanRepaymentsPage";
import LoanRepaymentDetailPage from "./components/applicant/repayments/LoanRepaymentDetailPage";
import AdminLoanRepaymentsListPage from "./components/admin/repayments/AdminLoanRepaymentsListPage";
// You'll also need an AdminRepaymentDetailView component, let's assume its path for now:
// import AdminRepaymentDetailView from "./components/admin/repayments/AdminRepaymentDetailView";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Console Routes */}
        <Route path="/console" element={<PrivateRoute role={"admin"}/>}>
          <Route path="" element={<AdminDashboard />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/:id" element={<SubmissionDetails />} />
          <Route path="loans" element={<LoanListPage />} />
          <Route path="form-builder" element={<FormBuilderContainer />} />
          <Route
            path="form-builder/:loanId"
            element={<FormBuilderContainer />}
          />

          {/* Admin Repayment Routes */}
          <Route path="schema" element={<DynamicDocumentForm />} />
          <Route path="repayments" element={<AdminLoanRepaymentsListPage />} />
          {/* Assuming you'll create an AdminRepaymentDetailView component */}
          {/* <Route path="repayments/:repaymentId" element={<AdminRepaymentDetailView />} /> */}

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
          <Route path="apply/:loanId" element={<ApplicationForm />} />

          {/* Applicant Repayment Routes */}
          <Route path="repayments" element={<MyLoanRepaymentsPage />} />
          <Route
            path="repayments/:repaymentId"
            element={<LoanRepaymentDetailPage />}
          />
        </Route>

        <Route path="/profile" element={<PrivateRoute />}>
          <Route path="" element={<Profile />} />
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
