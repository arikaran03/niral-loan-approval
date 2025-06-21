import { Outlet } from 'react-router-dom';
import CustomNavbar from '../CustomNavbar';

const Layout = () => {
  return (
    <div style={{minHeight: "400px"}}>
      <CustomNavbar />
      <Outlet />
    </div>
  );
};

export default Layout;