import { useEffect, useMemo, useState } from "react";
import { financeApi } from "../../utils/api";
import Hospital_Modal from "../../components/hospital/bed-management/Hospital_Modal";

type DailyRow = {
  dateIso: string;
  opdRevenue: number;
  ipdRevenue: number;
  procedureRevenue: number;
  totalRevenue: number;
  expenses: number;
  doctorPayouts: number;
  cashIn: number;
  cashOut: number;
  bankIn: number;
  bankOut: number;
  netCash: number;
};

type WeeklyRow = {
  weekStart: string;
  opdRevenue: number;
  ipdRevenue: number;
  procedureRevenue: number;
  totalRevenue: number;
  expenses: number;
  doctorPayouts: number;
  cashIn: number;
  cashOut: number;
  bankIn: number;
  bankOut: number;
  netCash: number;
};

export default function Finance_Ledger() {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<"daily" | "weekly">("daily");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [weeklyRows, setWeeklyRows] = useState<WeeklyRow[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    type?: "info" | "error" | "success";
  }>({ open: false });
  function showModal(
    title: string,
    message: string,
    type: "info" | "error" | "success" = "info",
  ) {
    setModal({ open: true, title, message, type });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, from, to]);

  async function load() {
    setLoading(true);
    try {
      if (mode === "daily") {
        const res: any = await financeApi.ledgerDaily({ from, to });
        setDailyRows(Array.isArray(res?.rows) ? res.rows : []);
        setWeeklyRows([]);
        setTotals(res?.totals || null);
      } else {
        const res: any = await financeApi.ledgerWeekly({ from, to });
        setWeeklyRows(Array.isArray(res?.rows) ? res.rows : []);
        setDailyRows([]);
        setTotals(res?.totals || null);
      }
    } catch (e: any) {
      setDailyRows([]);
      setWeeklyRows([]);
      setTotals(null);
      showModal("Error", e?.message || "Failed to load ledger", "error");
    } finally {
      setLoading(false);
    }
  }

  const rowsAny = useMemo(
    () => (mode === "daily" ? dailyRows : weeklyRows) as any[],
    [mode, dailyRows, weeklyRows],
  );

  const exportCSV = () => {
    const headers =
      mode === "daily"
        ? [
            "dateIso",
            "opdRevenue",
            "ipdRevenue",
            "procedureRevenue",
            "totalRevenue",
            "expenses",
            "doctorPayouts",
            "cashIn",
            "cashOut",
            "bankIn",
            "bankOut",
            "netCash",
          ]
        : [
            "weekStart",
            "opdRevenue",
            "ipdRevenue",
            "procedureRevenue",
            "totalRevenue",
            "expenses",
            "doctorPayouts",
            "cashIn",
            "cashOut",
            "bankIn",
            "bankOut",
            "netCash",
          ];
    const lines = [headers.join(",")];
    for (const r of rowsAny) {
      lines.push(
        headers
          .map((h) => {
            const v = (r as any)[h];
            return typeof v === "string"
              ? `"${v.replace(/"/g, '""')}"`
              : String(Number(v || 0));
          })
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ledger_${mode}_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-800">Ledger</div>
          <div className="text-sm text-slate-500">
            Daily / Weekly summary (Revenue, Expenses, Payouts, Cash/Bank)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-outline-navy">
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button onClick={exportCSV} className="btn-outline-navy">
            Export CSV
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid items-end gap-3 md:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm text-slate-700">View</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-3 grid gap-2 sm:grid-cols-3">
            <Summary
              title="Total Revenue"
              value={
                totals
                  ? `Rs ${Number(totals.totalRevenue || 0).toFixed(2)}`
                  : "-"
              }
              tone="emerald"
            />
            <Summary
              title="Total Expenses"
              value={
                totals ? `Rs ${Number(totals.expenses || 0).toFixed(2)}` : "-"
              }
              tone="rose"
            />
            <Summary
              title="Net Cash/Bank"
              value={
                totals ? `Rs ${Number(totals.netCash || 0).toFixed(2)}` : "-"
              }
              tone="amber"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-medium text-slate-800">
          {mode === "daily" ? "Daily" : "Weekly"} rows
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2 font-medium">
                  {mode === "daily" ? "Date" : "Week Start (Mon)"}
                </th>
                <th className="px-4 py-2 font-medium">OPD Rev</th>
                <th className="px-4 py-2 font-medium">IPD Rev</th>
                <th className="px-4 py-2 font-medium">Proc Rev</th>
                <th className="px-4 py-2 font-medium">Total Rev</th>
                <th className="px-4 py-2 font-medium">Expenses</th>
                <th className="px-4 py-2 font-medium">Doctor Payouts</th>
                <th className="px-4 py-2 font-medium">Cash In</th>
                <th className="px-4 py-2 font-medium">Cash Out</th>
                <th className="px-4 py-2 font-medium">Bank In</th>
                <th className="px-4 py-2 font-medium">Bank Out</th>
                <th className="px-4 py-2 font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {rowsAny.map((r: any) => (
                <tr
                  key={mode === "daily" ? r.dateIso : r.weekStart}
                  className="hover:bg-slate-50/50"
                >
                  <td className="px-4 py-2">
                    {mode === "daily" ? r.dateIso : r.weekStart}
                  </td>
                  <td className="px-4 py-2">
                    Rs {Number(r.opdRevenue || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    Rs {Number(r.ipdRevenue || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    Rs {Number(r.procedureRevenue || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    Rs {Number(r.totalRevenue || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    Rs {Number(r.expenses || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    Rs {Number(r.doctorPayouts || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    Rs {Number(r.cashIn || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    Rs {Number(r.cashOut || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    Rs {Number(r.bankIn || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    Rs {Number(r.bankOut || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 font-semibold">
                    Rs {Number(r.netCash || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
              {rowsAny.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {modal.open && (
        <Hospital_Modal
          open={modal.open}
          onClose={() => setModal({ open: false })}
        >
          <div className="text-lg font-semibold text-slate-900 mb-2">
            {modal.title}
          </div>
          <div
            className={`p-4 ${modal.type === "error" ? "text-red-600" : modal.type === "success" ? "text-green-600" : "text-slate-700"}`}
          >
            {modal.message}
          </div>
        </Hospital_Modal>
      )}
    </div>
  );
}

function Summary({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "emerald" | "rose" | "amber";
}) {
  const tones: any = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <div className="text-xs opacity-80">{title}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
