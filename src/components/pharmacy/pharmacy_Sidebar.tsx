import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CreditCard,
  Boxes,
  Users,
  Truck,
  ReceiptText,
  ShoppingCart,
  RotateCcw,
  CalendarCheck,
  UserCog,
  Settings,
  CalendarDays,
  BarChart3,
  BookText,
  FileClock,
  Wallet,
  Users2,
  ClipboardCheck,
  Bell,
  Shield,
} from "lucide-react";

const nav = [
  { to: "/pharmacy", label: "Dashboard", end: true, Icon: LayoutDashboard },
  { to: "/pharmacy/pos", label: "Point of Sale", Icon: CreditCard },
  { to: "/pharmacy/inventory", label: "Inventory", Icon: Boxes },
  { to: "/pharmacy/customers", label: "Customers", Icon: Users },
  { to: "/pharmacy/suppliers", label: "Suppliers", Icon: Truck },
  { to: "/pharmacy/sales-history", label: "Sales History", Icon: ReceiptText },
  {
    to: "/pharmacy/purchase-history",
    label: "Purchase History",
    Icon: ShoppingCart,
  },
  { to: "/pharmacy/return-history", label: "Return History", Icon: RotateCcw },
  {
    to: "/pharmacy/staff-attendance",
    label: "Staff Attendance",
    Icon: CalendarCheck,
  },
  {
    to: "/pharmacy/staff-management",
    label: "Staff Management",
    Icon: UserCog,
  },
  { to: "/pharmacy/staff-settings", label: "Staff Settings", Icon: Settings },
  { to: "/pharmacy/staff-monthly", label: "Staff Monthly", Icon: CalendarDays },
  { to: "/pharmacy/reports", label: "Reports", Icon: BarChart3 },
  { to: "/pharmacy/notifications", label: "Notifications", Icon: Bell },
  { to: "/pharmacy/guidelines", label: "Guidelines", Icon: BookText },
  { to: "/pharmacy/returns", label: "Customer Return", Icon: RotateCcw },
  {
    to: "/pharmacy/supplier-returns",
    label: "Supplier Return",
    Icon: RotateCcw,
  },
  {
    to: "/pharmacy/prescriptions",
    label: "Prescription Intake",
    Icon: ClipboardCheck,
  },
  { to: "/pharmacy/referrals", label: "Referrals", Icon: FileClock },
  { to: "/pharmacy/audit-logs", label: "Audit Logs", Icon: FileClock },
  { to: "/pharmacy/expenses", label: "Expenses", Icon: Wallet },
  { to: "/pharmacy/pay-in-out", label: "Pay In/Out", Icon: Wallet },
  {
    to: "/pharmacy/manager-cash-count",
    label: "Manager Cash Count",
    Icon: Wallet,
  },
  { to: "/pharmacy/settings", label: "Settings", Icon: Settings },
  { to: "/pharmacy/user-management", label: "User Management", Icon: Users2 },
  {
    to: "/pharmacy/sidebar-permissions",
    label: "Sidebar Permissions",
    Icon: Shield,
  },
];

export const pharmacySidebarNav = nav;

type Props = { collapsed?: boolean };

export default function Pharmacy_Sidebar({ collapsed }: Props) {
  const navigate = useNavigate();
  return (
    <aside
      className={`hidden md:flex ${collapsed ? "md:w-16" : "md:w-64"} h-dvh overflow-hidden md:flex-col md:border-r md:text-white`}
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
        <div className="font-semibold">{collapsed ? "PB" : "Pharmacy"}</div>
        {!collapsed && <div className="ml-auto text-xs opacity-80">admin</div>}
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-hide p-3 space-y-1">
        {nav.map((item) => {
          const Icon = item.Icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/5"}`
              }
              end={item.end}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3">
        <button
          onClick={() => navigate("/pharmacy/login")}
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
