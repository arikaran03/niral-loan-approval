// src/PrivateRoute.js
import { Navigate } from 'react-router-dom';
import Layout from './components/super/Layout';

const PrivateRoute = ({ role }) => {
  
const token = localStorage.getItem('token');
const userRole = localStorage.getItem('type');
  if (userRole !== role) {
    if (userRole === 'admin' || userRole === 'manager' || userRole === 'staff') {
      return <Navigate to="/console" />;
    }
    if (userRole === 'applicant') {
      return <Navigate to="/" />;
    }
  }
  return token ? <Layout/> : <Navigate to="/login" />;
};

export default PrivateRoute;
