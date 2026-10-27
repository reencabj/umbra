import { Component, Suspense, lazy, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  HashRouter,
  NavLink,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  ReceiptText,
  Users,
  Package,
  SlidersHorizontal,
  ChartNoAxesCombined,
  Settings2,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Toaster } from "sonner";
import { db, recoveryLink } from "./lib/supabase";
import Recovery from "./pages/Recovery";
import { today, localDate } from "./lib/domain";
import { useApp, Provider } from "./state";
import { Spinner } from "./components/ui";
import Login from "./pages/Login";
import Logo from "./components/Logo";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Sales = lazy(() => import("./pages/Sales"));
const Orders = lazy(() => import("./pages/Orders"));
const Organizations = lazy(() => import("./pages/Organizations"));
const Products = lazy(() => import("./pages/Products"));
const Limits = lazy(() => import("./pages/Limits"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const links = [
  { to: "/", name: "Dashboard", icon: LayoutDashboard },
  { to: "/sales", name: "Nueva venta", icon: ShoppingBag },
  { to: "/orders", name: "Pedidos", icon: ReceiptText },
  { to: "/organizations", name: "Organizaciones", icon: Users },
  { to: "/products", name: "Productos", icon: Package },
  { to: "/limits", name: "Stock semanal", icon: SlidersHorizontal },
  { to: "/reports", name: "Reportes", icon: ChartNoAxesCombined },
  { to: "/settings", name: "Configuración", icon: Settings2 },
];
function Shell() {
  const { session, profile, data, loading, error, reload } = useApp();
  const [mobile, setMobile] = useState(false);
  const [recover, setRecover] = useState(recoveryLink);
  useEffect(() => {
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((e) => {
      if (e === "PASSWORD_RECOVERY") setRecover(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  const [search, setSearch] = useState("");
  const location = useLocation();
  if (recover && session) return <Recovery onDone={() => setRecover(false)} />;
  if (!session) return loading ? <Spinner /> : <Login />;
  if (loading) return <Spinner />;
  if (!data)
    return (
      <div className="access-error">
        <ShieldCheck size={30} />
        <h2>No se pudo abrir el sistema</h2>
        <p>{error || "Tu cuenta todavía no está habilitada."}</p>
        <div className="row-actions">
          <button className="btn" onClick={() => void reload()}>
            Reintentar
          </button>
          <button className="btn" onClick={() => void db.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div className="brand">
          <Logo decorative />
          <div>{data.settings.system_name}</div>
          <button
            className="icon-button mobile-only"
            aria-label="Cerrar menú"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav>
          {links.map(({ to, name, icon: Icon }, i) => (
            <div key={to}>
              {i === 6 && <div className="nav-separator" />}
              <NavLink
                to={to}
                aria-label={name}
                end={to === "/"}
                onClick={() => setMobile(false)}
              >
                <Icon size={19} />
                <span>{name}</span>
                {to === "/sales" && <kbd>+</kbd>}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-profile">
            <span className="avatar">
              {profile?.email.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <b>{profile?.role === "admin" ? "Administrador" : "Operador"}</b>
              <small>{profile?.email}</small>
            </div>
            <button
              className="icon-button"
              title="Cerrar sesión"
              onClick={() => void db.auth.signOut()}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-only"
            aria-label="Abrir menú"
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            <Logo className="mobile-brand" decorative />
            <span className="breadcrumb-brand">UMBRA</span>
            <span>/</span>
            <b>
              {links.find((l) => l.to === location.pathname)?.name ||
                "Operaciones"}
            </b>
          </div>
          <div className="top-search">
            <Search size={16} />
            <input
              aria-label="Buscar sección"
              placeholder="Ir a una sección…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <div className="section-results">
                {links
                  .filter((l) =>
                    l.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((l) => (
                    <NavLink key={l.to} to={l.to} onClick={() => setSearch("")}>
                      {l.name}
                    </NavLink>
                  ))}
              </div>
            )}
          </div>
          <span className="top-date">
            {localDate(today())}
            <small>Argentina</small>
          </span>
          <button
            className="icon-button"
            title="Actualizar datos"
            onClick={() => void reload()}
          >
            <RefreshCw size={17} />
          </button>
          <span className="avatar small-avatar">
            {profile?.email.slice(0, 2).toUpperCase()}
          </span>
        </header>
        <main>
          {error && (
            <div className="inline-error">
              No se pudo actualizar la información: {error}
            </div>
          )}
          <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/organizations" element={<Organizations />} />
              <Route
                path="/inventory"
                element={<Navigate to="/limits" replace />}
              />
              <Route path="/products" element={<Products />} />
              <Route path="/limits" element={<Limits />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="access-error">
        <h2>Ocurrió un error inesperado</h2>
        <p>Actualizá la página para volver a cargar el sistema.</p>
        <button
          className="btn primary"
          onClick={() => window.location.reload()}
        >
          Recargar aplicación
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <Provider>
        <HashRouter>
          <Shell />
        </HashRouter>
        <Toaster theme="dark" position="bottom-right" />
      </Provider>
    </ErrorBoundary>
  );
}
