import { useEffect, useMemo, useState } from "react";
import "./Sidebar.css";
import { useAuth } from "./hooks/useAuth";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { usePrefersDarkMode } from "./hooks/usePrefersDarkMode";
import { canAccessMasterData } from "./lib/authorization";
import {
  getOutlinedButtonStyle,
  getPrimaryButtonStyle,
  getTextInputStyle,
} from "./lib/controlStyles";
import DashboardPage from "./pages/DashboardPage";
import KanbanPage from "./pages/KanbanPage";
import MasterDataPage from "./pages/MasterDataPage";
import BudgetingPage from "./pages/BudgetingPage";
import ReportingPage from "./pages/ReportingPage";
import TaskPage from "./pages/TaskPage";
import TimelinePage from "./pages/TimelinePage";
import TrackingPage from "./pages/TrackingPage";

const ACTIVE_PAGE_STORAGE_KEY = "kelola_tugas_active_page";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "kelola_tugas_sidebar_collapsed";
const DEFAULT_ACTIVE_PAGE = "kanban";
const VALID_ACTIVE_PAGES = new Set([
  "dashboard",
  "master-data",
  "task",
  "reporting",
  "kanban",
  "timeline",
  "tracking",
  "budgeting",
]);

function MenuIcon({ name }) {
  const common = {
    width: 23,
    height: 23,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (name === "dashboard") {
    return (
      <svg {...common} stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }

  if (name === "kanban") {
    return (
      <svg {...common} stroke="currentColor">
        <line x1="6" y1="5" x2="6" y2="19" />
        <line x1="12" y1="9" x2="12" y2="15" />
        <line x1="18" y1="5" x2="18" y2="13" />
      </svg>
    );
  }

  if (name === "task") {
    return (
      <svg {...common} stroke="currentColor">
        <circle cx="12" cy="7" r="3" />
        <path d="M4 20c2-5 14-5 16 0" />
      </svg>
    );
  }

  if (name === "tracking") {
    return (
      <svg {...common} stroke="currentColor">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  }

  if (name === "reporting") {
    return (
      <svg {...common} stroke="currentColor">
        <path d="M6 2h9l5 5v15H6z" />
        <path d="M15 2v6h5" />
        <line x1="10" y1="18" x2="10" y2="14" />
        <line x1="14" y1="18" x2="14" y2="12" />
        <line x1="18" y1="18" x2="18" y2="16" />
      </svg>
    );
  }

  if (name === "timeline") {
    return (
      <svg {...common} stroke="currentColor">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="16" y1="3" x2="16" y2="7" />
      </svg>
    );
  }

  if (name === "budgeting") {
    return (
      <svg {...common} stroke="currentColor">
        <rect x="3" y="7" width="18" height="12" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2H5" />
        <circle cx="17" cy="13" r="1.5" />
      </svg>
    );
  }

  if (name === "master-data") {
    return (
      <svg {...common} stroke="currentColor">
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </svg>
    );
  }

  return null;
}

function App() {
  const prefersDarkMode = usePrefersDarkMode();
  const [activePage, setActivePage] = useState(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return DEFAULT_ACTIVE_PAGE;
    }

    const storedPage = String(
      window.localStorage.getItem(ACTIVE_PAGE_STORAGE_KEY) || ""
    ).trim();

    return VALID_ACTIVE_PAGES.has(storedPage)
      ? storedPage
      : DEFAULT_ACTIVE_PAGE;
  });
  const [timelineContext, setTimelineContext] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginMessage, setLoginMessage] = useState("");
  const auth = useAuth();
  const isNarrowLayout = useMediaQuery("(max-width: 960px)");

  function handleMenuChange(nextPage) {
    setActivePage(nextPage);
    setTimelineContext(null);
  }

  function handleOpenTaskInTimeline(task) {
    setTimelineContext({
      task_id: task?.task_id || null,
      search: task?.task_title || task?.sub_activity_name || "",
    });
    setActivePage("timeline");
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoginMessage("");

    try {
      await auth.signIn(loginForm);
      setLoginForm((currentForm) => ({
        ...currentForm,
        password: "",
      }));
      setLoginMessage("Login berhasil. Session sedang disinkronkan.");
    } catch (error) {
      setLoginMessage(error?.message || "Login gagal.");
    }
  }

  async function handleLogout() {
    setLoginMessage("");

    try {
      await auth.signOut();
      setLoginForm((currentForm) => ({
        ...currentForm,
        password: "",
      }));
      setLoginMessage("Logout berhasil.");
    } catch (error) {
      setLoginMessage(error?.message || "Logout gagal.");
    }
  }

  const canOpenMasterData = canAccessMasterData(auth.roleCode);

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage) {
      return;
    }

    const pageToStore = VALID_ACTIVE_PAGES.has(activePage)
      ? activePage
      : DEFAULT_ACTIVE_PAGE;

    window.localStorage.setItem(ACTIVE_PAGE_STORAGE_KEY, pageToStore);
  }, [activePage]);

  const currentPage = useMemo(() => {
    if (activePage === "dashboard") return <DashboardPage />;
    if (activePage === "master-data") {
      if (!canOpenMasterData) {
        return (
          <div style={{ padding: 24, color: "#7f1d1d" }}>
            Anda tidak memiliki izin untuk membuka halaman Master Data.
          </div>
        );
      }

      return <MasterDataPage />;
    }
    if (activePage === "task") return <TaskPage />;
    if (activePage === "reporting") return <ReportingPage />;
    if (activePage === "tracking") {
      return <TrackingPage onOpenTaskInTimeline={handleOpenTaskInTimeline} />;
    }
    if (activePage === "timeline") {
      return <TimelinePage navigationContext={timelineContext} />;
    }
    if (activePage === "budgeting") {
      return <BudgetingPage />;
    }
    return <KanbanPage />;
  }, [activePage, canOpenMasterData, timelineContext]);

  const menus = useMemo(() => {
    const baseMenus = [
      { key: "dashboard", label: "Dashboard" },
      { key: "task", label: "Task" },
      { key: "tracking", label: "Tracking" },
      { key: "kanban", label: "Kanban" },
      { key: "reporting", label: "Pelaporan" },
      { key: "timeline", label: "Timeline" },
      { key: "budgeting", label: "Anggaran" },
    ];

    const finalMenus = [...baseMenus];
    if (canOpenMasterData) {
      finalMenus.push({ key: "master-data", label: "Master Data" });
    }

    return finalMenus;
  }, [canOpenMasterData]);

  const authPanel = (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div style={{ minWidth: 260, fontSize: 10, lineHeight: 1.4 }}>
        <div>
          {auth.isLoading
            ? "Memeriksa session pengguna..."
            : auth.isAuthenticated
              ? `Pengguna aktif: ${auth.fullName || auth.username} (${auth.roleName || auth.roleCode || "-"})`
              : "Belum ada session login aktif."}
        </div>
        {loginMessage ? <div>{loginMessage}</div> : null}
        {auth.error ? <div>{auth.error}</div> : null}
      </div>

      <div>
        {auth.isAuthenticated ? (
          <button
            type="button"
            onClick={handleLogout}
            disabled={auth.isSubmitting}
            style={getOutlinedButtonStyle(prefersDarkMode, {
              isEnabled: !auth.isSubmitting,
              height: 38,
              size: "sm",
            })}
          >
            {auth.isSubmitting ? "Memproses..." : "Logout"}
          </button>
        ) : (
          <form onSubmit={handleLoginSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <input
              type="email"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((currentForm) => ({
                  ...currentForm,
                  email: event.target.value,
                }))
              }
              placeholder="Email"
              autoComplete="username"
              style={{ ...getTextInputStyle(prefersDarkMode, { tone: "panel", height: 38 }), minWidth: 220 }}
            />
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((currentForm) => ({
                  ...currentForm,
                  password: event.target.value,
                }))
              }
              placeholder="Password"
              autoComplete="current-password"
              style={{ ...getTextInputStyle(prefersDarkMode, { tone: "panel", height: 38 }), minWidth: 180 }}
            />
            <button
              type="submit"
              disabled={auth.isSubmitting || auth.isLoading}
              style={{
                ...getPrimaryButtonStyle(prefersDarkMode, {
                  isEnabled: !(auth.isSubmitting || auth.isLoading),
                  height: 38,
                  size: "sm",
                }),
                cursor: auth.isSubmitting ? "wait" : "pointer",
              }}
            >
              {auth.isSubmitting ? "Masuk..." : "Login"}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  // sidebarCollapsed is now defined above

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: 16 }}>
        {isNarrowLayout ? (
          <div style={{ width: "100%", display: "grid", gap: 12 }}>
            {authPanel}

            <div
              style={{
                display: "flex",
                gap: 10,
                padding: 12,
                border: "1px solid var(--sidebar-border)",
                background: "var(--sidebar-bg)",
                borderRadius: 12,
                boxShadow: "var(--sidebar-shadow)",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                width: "100%",
              }}
              aria-label="Navigasi utama"
            >
              {menus.map((menu) => {
                const isActive = activePage === menu.key;
                return (
                  <button
                    key={menu.key}
                    type="button"
                    onClick={() => handleMenuChange(menu.key)}
                    aria-current={isActive ? "page" : undefined}
                    className="sidebar-nav-button"
                  >
                    <span className="sidebar-nav-icon" aria-hidden="true">
                      <MenuIcon name={menu.key} />
                    </span>
                    <div className="sidebar-tooltip">{menu.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <nav
            className="sidebar sidebar--collapsed"
            style={{
              width: 74,
              flex: "0 0 74px",
              background: "transparent",
              border: "none",
              boxShadow: "none",
              position: "fixed",
              top: 16,
              left: 16,
              bottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              overflow: "visible !important",
              zIndex: 99999,
            }}
            aria-label="Navigasi utama"
          >
            {/* Toggle removed per requirement for icon-only sidebar */}

            <div style={{ display: "grid", gap: 0, flex: "0 0 auto", zIndex: 10000, overflow: "visible !important" }}>
              {menus.map((menu) => {
                const isActive = activePage === menu.key;
                return (
                  <button
                    key={menu.key}
                    type="button"
                    onClick={() => handleMenuChange(menu.key)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={menu.label}
                    className="sidebar-nav-button"
                  >
                    <span className="sidebar-nav-icon" aria-hidden="true">
                      <MenuIcon name={menu.key} />
                    </span>
                    <div className="sidebar-tooltip">{menu.label}</div>
                  </button>
                );
                })}
              </div>
          </nav>
        )}

        <div style={{ flex: "1 1 auto", minWidth: 0, display: "grid", gap: 12, position: "relative", zIndex: 1, marginLeft: 88 }}>
          {!isNarrowLayout ? authPanel : null}
          {currentPage}
        </div>
      </div>
    </div>
  );
}

export default App;
