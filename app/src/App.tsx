import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import SignIn from '@/pages/auth/SignIn';
import Dashboard from '@/pages/Dashboard';
import OrdersList from '@/pages/orders/OrdersList';
import OrderNew from '@/pages/orders/OrderNew';
import OrderDetail from '@/pages/orders/OrderDetail';
import Clients from '@/pages/Clients';
import Carriers from '@/pages/Carriers';
import Fleet from '@/pages/Fleet';
import Payments from '@/pages/Payments';
import Reports from '@/pages/Reports';
import AiAssistant from '@/pages/AiAssistant';
import Spedition from '@/pages/Spedition';
import Settings from '@/pages/Settings';
import DriverWebview from '@/pages/DriverWebview';

export default function App() {
  const { session, ready } = useAuth();

  // driver webview is always public
  return (
    <Routes>
      <Route path="/d/:token" element={<DriverWebview />} />
      {!ready ? (
        <Route path="*" element={<div className="min-h-screen grid place-items-center">…</div>} />
      ) : !session ? (
        <>
          <Route path="/signin" element={<SignIn />} />
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </>
      ) : (
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersList />} />
          <Route path="orders/new" element={<OrderNew />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="ai" element={<AiAssistant />} />
          <Route path="fleet" element={<Fleet />} />
          <Route path="spedition" element={<Spedition />} />
          <Route path="clients" element={<Clients />} />
          <Route path="carriers" element={<Carriers />} />
          <Route path="payments" element={<Payments />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}
