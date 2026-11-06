import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { InventoryPage } from './pages/InventoryPage';
import { NewSalePage } from './pages/NewSalePage';
import { SalesPage } from './pages/SalesPage';
import { CustomersPage } from './pages/CustomersPage';
import { CreditPage } from './pages/CreditPage';
import { PricingPage } from './pages/PricingPage';
import { AuditPage } from './pages/AuditPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsUsersPage } from './pages/SettingsUsersPage';
import { SettingsConfigPage } from './pages/SettingsConfigPage';
import { BusinessProfilePage } from './pages/BusinessProfilePage';
import { CashRegisterPage } from './pages/CashRegisterPage';
import { OrdersPage } from './pages/OrdersPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ReturnsPage } from './pages/ReturnsPage';
import { WarrantiesPage } from './pages/WarrantiesPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { SubscriptionPage } from './pages/SubscriptionPage';
import { SocialInboxPage } from './pages/SocialInboxPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { AutomationPage } from './pages/AutomationPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { HelpCenterPage } from './pages/HelpCenterPage';
import { ServicesPage } from './pages/ServicesPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { PartnersPage } from './pages/PartnersPage';
import { ResellerReceiptsPage } from './pages/ResellerReceiptsPage';
import { StaffAttendancePage } from './pages/StaffAttendancePage';
import { DischargesPage } from './pages/DischargesPage';
import { MarketplacePage } from './pages/MarketplacePage';
import { StockValuationPage } from './pages/StockValuationPage';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { SettingsPeripheralsPage } from './pages/SettingsPeripheralsPage';
import { ProgressivePurchasesPage } from './pages/ProgressivePurchasesPage';

function RequireAuth({ children }: { children: ReactElement }) {
  const { profile, loading, isSubscriptionExpired } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading-screen">Chargement...</div>;
  if (!profile) return <Navigate to="/login" replace />;

  // Si l'abonnement est expiré, le client peut se connecter,
  // mais il est dirigé directement vers l'espace d'abonnement pour nous contacter.
  const isSubscriptionRoute =
    location.pathname === '/settings/subscription' || location.pathname === '/subscription';
  if (isSubscriptionExpired && !isSubscriptionRoute) {
    return <Navigate to="/settings/subscription" replace />;
  }

  return children;
}

function RequireModule({
  moduleKey,
  children,
}: {
  moduleKey: string;
  children: ReactElement;
}) {
  const { menu, profile } = useAuth();
  const isAccessible =
    menu.some((m) => m.key === moduleKey || m.path === `/${moduleKey}`) ||
    profile?.enabledCapabilities.includes(moduleKey);

  if (!isAccessible) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="catalog" element={<ProductsPage />} />
        <Route
          path="inventory"
          element={
            <RequireModule moduleKey="inventory">
              <InventoryPage />
            </RequireModule>
          }
        />
        <Route path="sales/new" element={<NewSalePage />} />
        <Route path="sales" element={<SalesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route
          path="credit"
          element={
            <RequireModule moduleKey="credit">
              <CreditPage />
            </RequireModule>
          }
        />
        <Route
          path="pricing"
          element={
            <RequireModule moduleKey="pricing">
              <PricingPage />
            </RequireModule>
          }
        />
        <Route path="audit" element={<AuditPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="reports/calculations" element={<StockValuationPage />} />
        <Route path="stock-valuation" element={<StockValuationPage />} />
        <Route
          path="expenses"
          element={
            <RequireModule moduleKey="expenses">
              <ExpensesPage />
            </RequireModule>
          }
        />
        <Route
          path="automation"
          element={
            <RequireModule moduleKey="automation">
              <AutomationPage />
            </RequireModule>
          }
        />
        <Route
          path="diagnostics"
          element={
            <RequireModule moduleKey="diagnostics">
              <DiagnosticsPage />
            </RequireModule>
          }
        />
        <Route path="help" element={<HelpCenterPage />} />
        <Route path="settings/users" element={<SettingsUsersPage />} />
        <Route path="settings/config" element={<SettingsConfigPage />} />
        <Route path="settings/peripherals" element={<SettingsPeripheralsPage />} />
        <Route path="settings/business-profile" element={<BusinessProfilePage />} />
        <Route path="settings/subscription" element={<SubscriptionPage />} />
        <Route path="subscription" element={<SubscriptionPage />} />
        <Route
          path="cash"
          element={
            <RequireModule moduleKey="cash">
              <CashRegisterPage />
            </RequireModule>
          }
        />
        <Route
          path="services"
          element={
            <RequireModule moduleKey="services">
              <ServicesPage />
            </RequireModule>
          }
        />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route
          path="orders"
          element={
            <RequireModule moduleKey="orders">
              <OrdersPage />
            </RequireModule>
          }
        />
        <Route
          path="suppliers"
          element={
            <RequireModule moduleKey="suppliers">
              <SuppliersPage />
            </RequireModule>
          }
        />
        <Route
          path="returns"
          element={
            <RequireModule moduleKey="returns">
              <ReturnsPage />
            </RequireModule>
          }
        />
        <Route
          path="warranties"
          element={
            <RequireModule moduleKey="warranties">
              <WarrantiesPage />
            </RequireModule>
          }
        />
        <Route
          path="progressive-purchases"
          element={
            <RequireModule moduleKey="progressive-purchases">
              <ProgressivePurchasesPage />
            </RequireModule>
          }
        />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="discharges" element={<DischargesPage />} />
        <Route path="market" element={<MarketplacePage />} />
        <Route
          path="deliveries"
          element={
            <RequireModule moduleKey="deliveries">
              <DeliveriesPage />
            </RequireModule>
          }
        />
        <Route
          path="social"
          element={
            <RequireModule moduleKey="social">
              <SocialInboxPage />
            </RequireModule>
          }
        />
        <Route
          path="partners"
          element={
            <RequireModule moduleKey="partners">
              <PartnersPage />
            </RequireModule>
          }
        />
        <Route
          path="reseller-receipts"
          element={
            <RequireModule moduleKey="reseller-receipts">
              <ResellerReceiptsPage />
            </RequireModule>
          }
        />
        <Route
          path="staff-attendance"
          element={
            <RequireModule moduleKey="staff-attendance">
              <StaffAttendancePage />
            </RequireModule>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <PwaInstallPrompt />
    </AuthProvider>
  );
}
