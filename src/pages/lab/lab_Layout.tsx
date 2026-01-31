import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Lab_Sidebar from "../../components/lab/lab_Sidebar";
import Lab_Header from "../../components/lab/lab_Header";

export default function Lab_Layout() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("lab.sidebar.collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggle = () => {
    setCollapsed((v) => {
      const nv = !v;
      try {
        localStorage.setItem("lab.sidebar.collapsed", nv ? "1" : "0");
      } catch {}
      return nv;
    });
  };
  // Theme (dark/light) scoped to Lab only
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const t = localStorage.getItem("lab.theme") as "light" | "dark";
      return t || "light";
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("lab.theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    try {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    } catch {}
  }, []);
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const navigate = useNavigate();
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lab.session");
      if (!raw) navigate("/lab/login");
    } catch {
      navigate("/lab/login");
    }
  }, [navigate]);
  const shell =
    theme === "dark"
      ? "h-dvh overflow-hidden bg-slate-900 text-slate-100"
      : "h-dvh overflow-hidden bg-slate-50 text-slate-900";
  return (
    <div className={theme === "dark" ? "lab-scope dark" : "lab-scope"}>
      <div className={shell}>
        <div className="flex h-dvh w-full overflow-hidden">
          <Lab_Sidebar collapsed={collapsed} />
          <div className="flex h-dvh min-h-0 flex-1 flex-col overflow-hidden">
            <Lab_Header
              onToggleSidebar={toggle}
              onToggleTheme={toggleTheme}
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
