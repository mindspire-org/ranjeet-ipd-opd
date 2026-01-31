import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Finance_Sidebar from "../../components/finance/finance_Sidebar";
import Finance_Header from "../../components/finance/finance_Header";

export default function Finance_Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return (
        (localStorage.getItem("finance.theme") as "light" | "dark") || "light"
      );
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("finance.theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    const html = document.documentElement;
    const enable = theme === "dark";
    try {
      html.classList.toggle("dark", enable);
    } catch {}
    return () => {
      try {
        html.classList.remove("dark");
      } catch {}
    };
  }, [theme]);
  const shell =
    theme === "dark"
      ? "h-dvh overflow-hidden bg-slate-900 text-slate-100"
      : "h-dvh overflow-hidden bg-slate-50 text-slate-900";
  return (
    <div className={theme === "dark" ? "finance-scope dark" : "finance-scope"}>
      <div className={shell}>
        <div className="flex h-dvh w-full overflow-hidden">
          <Finance_Sidebar collapsed={collapsed} />
          <div className="flex h-dvh min-h-0 flex-1 flex-col overflow-hidden">
            <Finance_Header
              onToggleSidebar={() => setCollapsed((c) => !c)}
              onToggleTheme={() =>
                setTheme((t) => (t === "dark" ? "light" : "dark"))
              }
              theme={theme}
            />
            <main className="w-full flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-4">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
