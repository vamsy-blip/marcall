import { lazy, Suspense } from 'react';
import { Switch, Route, Router, Redirect } from 'wouter';
import { useHashLocation as _useHashLocation } from 'wouter/use-hash-location';

/**
 * Strips the query string from the hash path so wouter's <Route> matches
 * `/reset-password` even when the URL is `#/reset-password?token=…`.
 * Components read `?token=` directly via window.location.hash.
 */
function useHashLocation(): [string, (to: string, opts?: any) => void] {
  const [raw, navigate] = _useHashLocation() as unknown as [string, (to: string, opts?: any) => void];
  const q = raw.indexOf('?');
  const path = q === -1 ? raw : raw.slice(0, q);
  return [path, navigate];
}
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { MarcallLogo } from '@/components/Brand';

// Marketing pages stay EAGER — they're the first paint for almost every visitor
// and code-splitting them would add a network round-trip before hero render.
import Home from '@/pages/marketing/Home';
import SecurityPage from '@/pages/marketing/Security';
import Pricing from '@/pages/marketing/Pricing';
import HowItWorks from '@/pages/marketing/HowItWorks';
import Faq from '@/pages/marketing/Faq';
import VsHumano from '@/pages/marketing/VsHumano';
import StatusPage from '@/pages/marketing/Status';

// Demo + legal load on demand — they're not on the typical first-paint path.
const Demo = lazy(() => import('@/pages/marketing/Demo'));
const LegalPage = lazy(() => import('@/pages/legal/Legal'));

// Auth pages: lazy. Visitors see them only when they intentionally click
// "Sign in" or "Try free". Saves ~150KB on the marketing critical path.
const Signup = lazy(() => import('@/pages/auth/Signup'));
const Login = lazy(() => import('@/pages/auth/Login'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/auth/VerifyEmail'));
const CheckoutSuccess = lazy(() => import('@/pages/checkout/Success'));
const CheckoutCancel = lazy(() => import('@/pages/checkout/Cancel'));

// Tenant dashboard: lazy as a single shared chunk. Loaded only after sign-in.
const Resumen = lazy(() => import('@/pages/tenant/Resumen'));
const Onboarding = lazy(() => import('@/pages/tenant/Onboarding'));
const Llamadas = lazy(() => import('@/pages/tenant/Llamadas'));
const Citas = lazy(() => import('@/pages/tenant/Citas'));
const Mensajes = lazy(() => import('@/pages/tenant/Mensajes'));
const Leads = lazy(() => import('@/pages/tenant/Leads'));
const Asistente = lazy(() => import('@/pages/tenant/Asistente'));
const Numeros = lazy(() => import('@/pages/tenant/Numeros'));
const Equipo = lazy(() => import('@/pages/tenant/Equipo'));
const Facturacion = lazy(() => import('@/pages/tenant/Facturacion'));
const Configuracion = lazy(() => import('@/pages/tenant/Configuracion'));
const MfaSetup = lazy(() => import('@/pages/mfa-setup'));

// Admin + agency portals: rarely loaded by typical users. Lazy.
const AdminPanorama = lazy(() => import('@/pages/admin/Panorama'));
const AdminTenants = lazy(() => import('@/pages/admin/Tenants'));
const AdminResellers = lazy(() => import('@/pages/admin/Resellers'));
const AdminSuscripciones = lazy(() => import('@/pages/admin/Suscripciones'));
const AdminLlamadas = lazy(() => import('@/pages/admin/Llamadas'));
const AdminKYC = lazy(() => import('@/pages/admin/KYC'));
const AdminARCO = lazy(() => import('@/pages/admin/ARCO'));
const AdminAuditoria = lazy(() => import('@/pages/admin/Auditoria'));
const AdminSistema = lazy(() => import('@/pages/admin/Sistema'));

const AgencyPanorama = lazy(() => import('@/pages/agency/Panorama'));
const AgencyClientes = lazy(() => import('@/pages/agency/Clientes'));
const AgencyComisiones = lazy(() => import('@/pages/agency/Comisiones'));
const AgencyMarcaBlanca = lazy(() => import('@/pages/agency/MarcaBlanca'));
const AgencyOnboarding = lazy(() => import('@/pages/agency/Onboarding'));
const AgencyConfiguracion = lazy(() => import('@/pages/agency/Configuracion'));

import { useAuth, AuthProvider } from '@/components/AuthProvider';
import { LanguageProvider } from '@/components/LanguageProvider';
import { CookieProvider, CookieBanner } from '@/components/CookieBanner';
import { InstallBanner } from '@/components/InstallBanner';

// Suspense fallback shown while a lazy chunk downloads or while the Render
// free-tier cold-starts (~30s). Branded so users see something familiar
// rather than a blank screen.
function ChunkFallback() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background"
      data-testid="chunk-loading"
    >
      <MarcallLogo size={36} className="text-primary animate-pulse" />
      <div className="text-sm text-muted-foreground">Cargando…</div>
    </div>
  );
}

function ProtectedTenant({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Redirect to="/login" />;
  if (user.role === 'superadmin') return <Redirect to="/admin/panorama" />;
  if (user.role === 'reseller') return <Redirect to="/agency/panorama" />;
  return <Component />;
}

function ProtectedAdmin({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Redirect to="/login" />;
  if (user.role !== 'superadmin') return <Redirect to="/app" />;
  return <Component />;
}

function ProtectedAgency({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando…</div>;
  if (!user) return <Redirect to="/login" />;
  if (user.role !== 'reseller' && user.role !== 'superadmin') return <Redirect to="/app" />;
  return <Component />;
}

function AppRouter() {
  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Home} />
      <Route path="/signup" component={Signup} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/checkout/cancel" component={CheckoutCancel} />
      <Route path="/legal/:doc" component={LegalPage} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/demo" component={Demo} />
      <Route path="/compliance" component={SecurityPage} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/precios" component={Pricing} />
      <Route path="/como-funciona" component={HowItWorks} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/preguntas-frecuentes" component={Faq} />
      <Route path="/faq" component={Faq} />
      <Route path="/vs-recepcionista" component={VsHumano} />
      <Route path="/vs-receptionist" component={VsHumano} />
      <Route path="/estado" component={StatusPage} />
      <Route path="/status" component={StatusPage} />

      {/* Tenant */}
      <Route path="/onboarding">{() => <ProtectedTenant component={Onboarding} />}</Route>
      <Route path="/app">{() => <Redirect to="/app/resumen" />}</Route>
      <Route path="/app/resumen">{() => <ProtectedTenant component={Resumen} />}</Route>
      <Route path="/app/llamadas">{() => <ProtectedTenant component={Llamadas} />}</Route>
      <Route path="/app/citas">{() => <ProtectedTenant component={Citas} />}</Route>
      <Route path="/app/mensajes">{() => <ProtectedTenant component={Mensajes} />}</Route>
      <Route path="/app/leads">{() => <ProtectedTenant component={Leads} />}</Route>
      <Route path="/app/asistente">{() => <ProtectedTenant component={Asistente} />}</Route>
      <Route path="/app/numeros">{() => <ProtectedTenant component={Numeros} />}</Route>
      <Route path="/app/equipo">{() => <ProtectedTenant component={Equipo} />}</Route>
      <Route path="/app/facturacion">{() => <ProtectedTenant component={Facturacion} />}</Route>
      <Route path="/app/configuracion">{() => <ProtectedTenant component={Configuracion} />}</Route>
      <Route path="/app/security/mfa">{() => <ProtectedTenant component={MfaSetup} />}</Route>

      {/* === ADMIN ROUTES === */}
      <Route path="/admin">{() => <Redirect to="/admin/panorama" />}</Route>
      <Route path="/admin/panorama">{() => <ProtectedAdmin component={AdminPanorama} />}</Route>
      <Route path="/admin/tenants">{() => <ProtectedAdmin component={AdminTenants} />}</Route>
      <Route path="/admin/resellers">{() => <ProtectedAdmin component={AdminResellers} />}</Route>
      <Route path="/admin/suscripciones">{() => <ProtectedAdmin component={AdminSuscripciones} />}</Route>
      <Route path="/admin/llamadas">{() => <ProtectedAdmin component={AdminLlamadas} />}</Route>
      <Route path="/admin/kyc">{() => <ProtectedAdmin component={AdminKYC} />}</Route>
      <Route path="/admin/arco">{() => <ProtectedAdmin component={AdminARCO} />}</Route>
      <Route path="/admin/auditoria">{() => <ProtectedAdmin component={AdminAuditoria} />}</Route>
      <Route path="/admin/sistema">{() => <ProtectedAdmin component={AdminSistema} />}</Route>

      {/* === AGENCY ROUTES === */}
      <Route path="/agency">{() => <Redirect to="/agency/panorama" />}</Route>
      <Route path="/agency/panorama">{() => <ProtectedAgency component={AgencyPanorama} />}</Route>
      <Route path="/agency/clientes">{() => <ProtectedAgency component={AgencyClientes} />}</Route>
      <Route path="/agency/comisiones">{() => <ProtectedAgency component={AgencyComisiones} />}</Route>
      <Route path="/agency/marca-blanca">{() => <ProtectedAgency component={AgencyMarcaBlanca} />}</Route>
      <Route path="/agency/onboarding">{() => <ProtectedAgency component={AgencyOnboarding} />}</Route>
      <Route path="/agency/configuracion">{() => <ProtectedAgency component={AgencyConfiguracion} />}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <CookieProvider>
            <TooltipProvider>
              <Toaster />
              <Router hook={useHashLocation}>
                <Suspense fallback={<ChunkFallback />}>
                  <AppRouter />
                </Suspense>
              </Router>
              <CookieBanner />
              <InstallBanner />
            </TooltipProvider>
          </CookieProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
