import { Outlet, useNavigate } from "react-router-dom";
import Doctor_Sidebar from "../../components/doctor/doctor_Sidebar";
import Doctor_Header from "../../components/doctor/doctor_Header";
import { useEffect, useState } from "react";

export default function Doctor_Layout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      return (
        (localStorage.getItem("doctor.theme") as "light" | "dark") || "light"
      );
    } catch {
      return "light";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("doctor.theme", theme);
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
  useEffect(() => {
    try {
      const raw = localStorage.getItem("doctor.session");
      if (!raw) navigate("/hospital/login");
    } catch {
      navigate("/hospital/login");
    }
  }, [navigate]);
  const shell =
    theme === "dark"
      ? "h-dvh overflow-hidden bg-slate-900 text-slate-100"
      : "h-dvh overflow-hidden bg-slate-50 text-slate-900";
  return (
    <div className={theme === "dark" ? "doctor-scope dark" : "doctor-scope"}>
      <div className={shell}>
        <div className="flex h-dvh w-full overflow-hidden">
          <Doctor_Sidebar collapsed={collapsed} />
          <div className="flex h-dvh min-h-0 flex-1 flex-col overflow-hidden">
            <Doctor_Header
              onToggle={() => setCollapsed((c) => !c)}
              onToggleTheme={() =>
                setTheme((t) => (t === "dark" ? "light" : "dark"))
              }
              theme={theme}
            />
            <main className="w-full flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
