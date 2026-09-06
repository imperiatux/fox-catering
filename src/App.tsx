import OrderPage from './pages/OrderPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

export default function App() {
  const path = window.location.pathname;

  if (path === '/admin/dashboard') {
    return <AdminDashboardPage />;
  }

  if (path === '/admin' || path === '/admin/login' || path.startsWith('/admin/')) {
    return <AdminLoginPage />;
  }

  return <OrderPage />;
}
