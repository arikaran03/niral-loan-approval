import { BrowserRouter, Route, Router, Routes } from "react-router-dom";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";
import PrivateRoute from "./PrivateRoute";
import ApplicationForm from "./components/applicant/ApplicationForm";
import FormBuilderContainer from "./components/admin/FormBuilderContainer";
import PageNotFound from "./components/super/PageNotFound";
import ApplicationsPage from "./components/admin/ApplicationsPage";
import AvailableLoans from "./components/applicant/applications/AvailableLoans";
import SubmissionDetails from "./components/admin/SubmissionDetails";
import LoanListPage from "./components/admin/LoanListPage";
import Profile from "./components/Profile";
import AdminDashboard from "./components/admin/AdminDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/console" element={<PrivateRoute />}>
          <Route path="" element={<AdminDashboard />} />
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/:id" element={<SubmissionDetails />} />
          <Route path="loans" element={<LoanListPage />} />
          <Route path="form-builder" element={<FormBuilderContainer />} />
          <Route path="form-builder/:loanId" element={<FormBuilderContainer />} />
          <Route path="*" element={<PageNotFound />} />
        </Route>

        <Route path="/" element={<PrivateRoute />}>
          <Route path="" element={<AvailableLoans />} />
          <Route path="/apply/:loanId" element={<ApplicationForm />} />
        </Route>
        <Route path="/profile" element={<PrivateRoute />}>
          <Route path="" element={<Profile/>} />
        </Route>

        <Route path="/admin/register/new-user" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<PageNotFound />} />
        {/* <Route path="*" element={<Home/>}></Route> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
