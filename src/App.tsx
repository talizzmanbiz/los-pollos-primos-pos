import { Route, Routes } from 'react-router-dom';
import { RequireAuth, RoleGuard, ProductionLocationGuard } from './components/guards';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Home from './pages/Home';
import PosPage from './pages/pos/PosPage';
import KitchenPage from './pages/kitchen/KitchenPage';
import DeliveryPage from './pages/kitchen/DeliveryPage';
import CashPage from './pages/cash/CashPage';
import BatchesPage from './pages/batches/BatchesPage';
import InventoryPage from './pages/inventory/InventoryPage';
import TransfersPage from './pages/transfers/TransfersPage';
import ReportsPage from './pages/reports/ReportsPage';
import AdminPage from './pages/admin/AdminPage';
import StorePage, { StoreLayout } from './pages/store/StorePage';
import CheckoutPage from './pages/store/CheckoutPage';
import OrderStatusPage from './pages/store/OrderStatusPage';
import SiteLayout from './pages/site/SiteLayout';
import Landing from './pages/site/Landing';
import AboutPage from './pages/site/AboutPage';
import ContactPage from './pages/site/ContactPage';
import PrivacyPage from './pages/site/PrivacyPage';
import TermsPage from './pages/site/TermsPage';

export default function App() {
  return (
    <Routes>
      {/* public marketing site — los-pollosprimos.com (apex).
          On the pos.* host, SiteLayout redirects to the POS dashboard. */}
      <Route element={<SiteLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/nosotros" element={<AboutPage />} />
        <Route path="/contacto" element={<ContactPage />} />
        <Route path="/privacidad" element={<PrivacyPage />} />
        <Route path="/terminos" element={<TermsPage />} />
      </Route>

      {/* public storefront — los-pollosprimos.com/tienda */}
      <Route path="/tienda" element={<StoreLayout />}>
        <Route index element={<StorePage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="estado" element={<OrderStatusPage />} />
      </Route>

      <Route path="/login" element={<Login />} />

      {/* internal POS — requires auth + active profile */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/inicio" element={<Home />} />
          <Route
            path="/pos"
            element={
              <RoleGuard roles={['admin', 'cajero']}>
                <PosPage />
              </RoleGuard>
            }
          />
          <Route
            path="/kitchen"
            element={
              <RoleGuard roles={['admin', 'cocina']}>
                <ProductionLocationGuard>
                  <KitchenPage />
                </ProductionLocationGuard>
              </RoleGuard>
            }
          />
          <Route
            path="/delivery"
            element={
              <RoleGuard roles={['admin', 'cajero', 'repartidor']}>
                <DeliveryPage />
              </RoleGuard>
            }
          />
          <Route
            path="/cash"
            element={
              <RoleGuard roles={['admin', 'cajero']}>
                <CashPage />
              </RoleGuard>
            }
          />
          <Route
            path="/batches"
            element={
              <RoleGuard roles={['admin', 'cocina']}>
                <ProductionLocationGuard>
                  <BatchesPage />
                </ProductionLocationGuard>
              </RoleGuard>
            }
          />
          <Route
            path="/inventory"
            element={
              <RoleGuard roles={['admin', 'cajero']}>
                <InventoryPage />
              </RoleGuard>
            }
          />
          <Route
            path="/transfers"
            element={
              <RoleGuard roles={['admin']}>
                <TransfersPage />
              </RoleGuard>
            }
          />
          <Route
            path="/reports"
            element={
              <RoleGuard roles={['admin']}>
                <ReportsPage />
              </RoleGuard>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleGuard roles={['admin']}>
                <AdminPage />
              </RoleGuard>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
