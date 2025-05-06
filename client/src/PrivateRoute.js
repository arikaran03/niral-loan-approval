// src/PrivateRoute.js
import React from 'react';
import { Navigate } from 'react-router-dom';
import Layout from './components/super/Layout';

const PrivateRoute = () => {
const token = localStorage.getItem('token');
  // return <Layout/>
  return token ? <Layout/> : <Navigate to="/login" />;
};

export default PrivateRoute;
