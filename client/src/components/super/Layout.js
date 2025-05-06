import React from 'react';
import { Outlet } from 'react-router-dom';
import CustomNavbar from '../admin/CustomNavbar';

const Layout = () => {
    const type = localStorage.getItem('type');

  return (
    <div style={{minHeight: "400px"}}>
      <CustomNavbar />
      <Outlet />
    </div>
  );
};

export default Layout;