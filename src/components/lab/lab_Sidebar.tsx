import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { labApi } from "../../utils/api";
import {
  LayoutDashboard,
  ClipboardPlus,
  ListChecks,
  FlaskConical,
  FileText,
  BarChart3,
  PieChart,
  Boxes,
  Truck,
  History,
  Undo2,
  RotateCcw,
  CalendarCheck,
  Users,
  Settings as Cog,
  CalendarDays,
  UserCog,
  ScrollText,
  Receipt,
  Droplets,
  PackageOpen,
  UserPlus,
  Wallet,
  Calculator,
  Shield,
} from "lucide-react";

type Item = { to: string; label: string; end?: boolean; icon: any };
const nav: Item[] = [
  { to: "/lab", label: "Dashboard", end: true, icon: LayoutDashboard },
  { to: "/lab/orders", label: "Sample Intake", icon: ClipboardPlus },
  { to: "/lab/tracking", label: "Sample Tracking", icon: ListChecks },
  { to: "/lab/tests", label: "Test Catalog", icon: FlaskConical },
  { to: "/lab/results", label: "Result Entry", icon: FileText },
  { to: "/lab/referrals", label: "Referrals", icon: ListChecks },
  { to: "/lab/reports", label: "Reports Generator", icon: BarChart3 },
  { to: "/lab/reports-summary", label: "Reports", icon: PieChart },
  { to: "/lab/inventory", label: "Inventory", icon: Boxes },
  { to: "/lab/suppliers", label: "Suppliers", icon: Truck },
  { to: "/lab/purchase-history", label: "Purchase History", icon: History },
  { to: "/lab/supplier-returns", label: "Supplier Returns", icon: Undo2 },
  { to: "/lab/return-history", label: "Return History", icon: RotateCcw },
  // Blood Bank
  { to: "/lab/bb/donors", label: "BB • Donors", icon: UserPlus },
  { to: "/lab/bb/inventory", label: "BB • Inventory", icon: PackageOpen },
  { to: "/lab/bb/receivers", label: "BB • Receivers", icon: Droplets },
  {
    to: "/lab/staff-attendance",
    label: "Staff Attendance",
    icon: CalendarCheck,
  },
  { to: "/lab/staff-management", label: "Staff Management", icon: Users },
  { to: "/lab/staff-settings", label: "Staff Settings", icon: Cog },
  { to: "/lab/staff-monthly", label: "Staff Monthly", icon: CalendarDays },
  { to: "/lab/user-management", label: "User Management", icon: UserCog },
  {
    to: "/lab/sidebar-permissions",
    label: "Sidebar Permissions",
    icon: Shield,
  },
  { to: "/lab/audit-logs", label: "Audit Logs", icon: ScrollText },
  { to: "/lab/expenses", label: "Expenses", icon: Receipt },
  { to: "/lab/pay-in-out", label: "Pay In / Out", icon: Wallet },
  {
    to: "/lab/manager-cash-count",
    label: "Manager Cash Count",
    icon: Calculator,
  },
  { to: "/lab/settings", label: "Settings", icon: Cog },
];

export const labSidebarNav = nav;

export default function Lab_Sidebar({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const navigate = useNavigate();
  const [allowedPaths, setAllowedPaths] = useState<Set<string> | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        let role = "";
        try {
          const raw = localStorage.getItem("lab.session");
          const s = raw ? JSON.parse(raw) : null;
          role = String(s?.role || "")
            .trim()
            .toLowerCase();
        } catch {}
        if (mounted) setCurrentRole(role || null);
        if (!role) {
          if (mounted) setAllowedPaths(null);
          return;
        }
        const res = await labApi.listSidebarPermissions(role);
        const items = Array.isArray(res) ? res : [];
        const perms = (items.find(
          (r: any) => String(r?.role || "").toLowerCase() === role,
        )?.permissions || []) as Array<{ path: string; visible: boolean }>;
        const set = new Set<string>();
        for (const p of perms) {
          if (p?.visible && p?.path) set.add(p.path);
        }
        if (mounted) setAllowedPaths(set);
      } catch {
        if (mounted) setAllowedPaths(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  const logout = () => {
    try {
      localStorage.removeItem("lab.session");
    } catch {}
    navigate("/lab/login");
  };
  const width = collapsed ? "md:w-16" : "md:w-64";
  const visibleNav = currentRole
    ? allowedPaths
      ? nav.filter((item) => allowedPaths.has(item.to))
      : []
    : nav;
  return (
    <aside
      className={`hidden md:flex ${width} h-dvh overflow-hidden md:flex-col md:border-r md:text-white`}
      style={{
        background:
          "linear-gradient(180deg, var(--navy) 0%, var(--navy-700) 100%)",
        borderColor: "rgba(255,255,255,0.12)",
      }}
    >
      <div
        className="h-16 px-4 flex items-center border-b"
        style={{ borderColor: "rgba(255,255,255,0.12)" }}
      >
        {!collapsed && <div className="font-semibold">SideBar</div>}
        <div
          className={`ml-auto text-xs opacity-80 ${collapsed ? "hidden" : ""}`}
        >
          admin
        </div>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-hide p-3 space-y-1">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium flex items-center ${collapsed ? "justify-center gap-0" : "gap-2"} ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"}`
              }
              end={item.end}
            >
              <Icon className="h-4 w-4" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3">
        <button
          onClick={logout}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            color: "#ffffff",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
