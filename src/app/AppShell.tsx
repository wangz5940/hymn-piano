import {
  BookOpenText,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  Hand,
  Home,
  Library,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  Route,
  TrendingUp,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { BrandMark } from "@/components/BrandMark";
import { useAppStore } from "@/store/useAppStore";

const navigation = [
  { to: "/", label: "今日", icon: Home, end: true },
  { to: "/course", label: "课程", icon: Route },
  { to: "/fingering", label: "指法", icon: Hand },
  { to: "/hymns", label: "诗歌", icon: Library },
  { to: "/recommendations", label: "推荐", icon: TrendingUp },
  { to: "/service-set", label: "曲单", icon: ClipboardList },
  {
    to: "/records",
    label: "记录",
    icon: ChartNoAxesColumnIncreasing,
  },
];

export function AppShell() {
  const storageAvailable = useAppStore((state) => state.storage_available);
  const sidebarCollapsed = useAppStore(
    (state) => state.sidebar_collapsed,
  );
  const setSidebarCollapsed = useAppStore(
    (state) => state.setSidebarCollapsed,
  );

  return (
    <div
      className={`app-shell${
        sidebarCollapsed ? " app-shell--sidebar-collapsed" : ""
      }`}
    >
      <aside
        className="sidebar"
        id="primary-sidebar"
        aria-label="主侧边栏"
      >
        <button
          className="sidebar__toggle"
          type="button"
          aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          aria-controls="primary-sidebar"
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? (
            <PanelLeftOpen size={17} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={17} aria-hidden="true" />
          )}
        </button>
        <BrandMark />
        <nav className="sidebar__nav" aria-label="主导航">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              title={sidebarCollapsed ? label : undefined}
              className={({ isActive }) =>
                `nav-link${isActive ? " nav-link--active" : ""}`
              }
            >
              <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__note">
          <BookOpenText size={18} aria-hidden="true" />
          <p>48 周训练，从手位开始，走到聚会服侍。</p>
        </div>
        <div className="privacy-note">
          <LockKeyhole size={15} aria-hidden="true" />
          <span>数据仅保存在本机</span>
        </div>
      </aside>

      <main className="app-main">
        {!storageAvailable && (
          <div className="storage-warning" role="status">
            浏览器未允许本地存储，本次进度不会在刷新后保留。
          </div>
        )}
        <Outlet />
      </main>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `mobile-nav__link${isActive ? " mobile-nav__link--active" : ""}`
            }
          >
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
