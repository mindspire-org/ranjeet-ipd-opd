import { useEffect, useMemo, useRef, useState } from "react";
import { hospitalApi, financeApi } from "../../utils/api";

export default function Finance_DoctorPayouts() {
  const [doctors, setDoctors] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [doctorId, setDoctorId] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [payouts, setPayouts] = useState<
    Array<{ id: string; dateIso: string; memo?: string; amount: number }>
  >([]);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"Cash" | "Bank">("Cash");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [printOpen, setPrintOpen] = useState(false);
  const [printHtml, setPrintHtml] = useState("");
  const [printLabel, setPrintLabel] = useState("");
  const [printing, setPrinting] = useState(false);
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    loadDoctors();
  }, []);
  useEffect(() => {
    if (doctorId) {
      loadBalance();
      loadPayouts();
    } else {
      setBalance(null);
      setPayouts([]);
    }
  }, [doctorId, tick, from, to]);

  async function loadDoctors() {
    try {
      const res: any = await hospitalApi.listDoctors();
      const items = (res?.doctors || []).map((d: any) => ({
        id: String(d._id),
        name: d.name,
      }));
      setDoctors(items);
      if (items.length && !doctorId) setDoctorId(items[0].id);
    } catch {}
  }

  async function loadBalance() {
    try {
      const res: any = await financeApi.doctorBalance(doctorId);
      setBalance(Number(res?.payable || 0));
    } catch {
      setBalance(null);
    }
  }
  async function loadPayouts() {
    try {
      const res: any = await financeApi.doctorPayouts(doctorId, 50);
      setPayouts(res?.payouts || []);
    } catch {
      setPayouts([]);
    }
  }

  const filteredPayouts = useMemo(() => {
    const start = from ? new Date(from) : null;
    const end = to ? new Date(to) : null;
    if (end) end.setHours(23, 59, 59, 999);
    return (payouts || []).filter((p) => {
      if (!start && !end) return true;
      const d = new Date(String(p.dateIso || ""));
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });
  }, [payouts, from, to]);

  const totalSelected = useMemo(
    () => filteredPayouts.reduce((s, p) => s + Number(p.amount || 0), 0),
    [filteredPayouts],
  );

  function openPrintPreview(html: string, label: string) {
    setPrintHtml(html);
    setPrintLabel(label);
    setPrintOpen(true);
  }

  async function printFromPreview() {
    if (!printHtml) return;
    setPrinting(true);
    try {
      if (window.electronAPI?.printHTML) {
        await window.electronAPI.printHTML(printHtml, {});
      } else {
        const w = printFrameRef.current?.contentWindow;
        try {
          w?.focus();
        } catch {}
        try {
          w?.print();
        } catch {}
      }
      setPrintOpen(false);
    } finally {
      setPrinting(false);
    }
  }

  async function printSelectedSummary() {
    const doc = doctors.find((d) => d.id === doctorId);
    const rows = filteredPayouts;
    const html = buildPayoutSummaryHtml({
      title: "Doctor Payout Summary",
      subtitle: `${doc?.name || "Doctor"} (${from} to ${to})`,
      rows: rows.map((r) => ({
        dateIso: r.dateIso,
        amount: r.amount,
        memo: r.memo,
      })),
    });
    openPrintPreview(html, "Doctor Summary");
  }

  async function printAllDoctorsSummary() {
    try {
      if (!doctors.length) await loadDoctors();
    } catch {}
    const rangeFrom = from;
    const rangeTo = to;
    const lines: Array<{ doctorName: string; total: number }> = [];
    for (const d of doctors) {
      try {
        const res: any = await financeApi.doctorPayouts(d.id, 100);
        const list: any[] = res?.payouts || [];
        const start = rangeFrom ? new Date(rangeFrom) : null;
        const end = rangeTo ? new Date(rangeTo) : null;
        if (end) end.setHours(23, 59, 59, 999);
        const sum = list
          .filter((p) => {
            const dt = new Date(String(p.dateIso || ""));
            if (start && dt < start) return false;
            if (end && dt > end) return false;
            return true;
          })
          .reduce((s, p) => s + Number(p.amount || 0), 0);
        lines.push({ doctorName: d.name, total: sum });
      } catch {
        lines.push({ doctorName: d.name, total: 0 });
      }
    }
    const html = buildAllDoctorsPayoutHtml({
      title: "Doctor Payouts (All Doctors)",
      subtitle: `${rangeFrom} to ${rangeTo}`,
      rows: lines,
    });
    openPrintPreview(html, "All Doctors");
  }

  const canPay = useMemo(() => {
    const amt = parseFloat(amount || "0");
    return doctorId && !loading && amt > 0;
  }, [doctorId, amount, loading]);

  async function pay() {
    const amt = parseFloat(amount || "0");
    if (!(amt > 0) || !doctorId) return;
    setLoading(true);
    try {
      await financeApi.doctorPayout({
        doctorId,
        amount: amt,
        method,
        memo: memo || undefined,
      });
      setAmount("");
      setMemo("");
      setTick((t) => t + 1);
      alert("Payout recorded");
    } catch (e: any) {
      alert(e?.message || "Failed to record payout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-800">
            Doctor Payouts
          </div>
          <div className="text-sm text-slate-500">
            Make payouts and view recent history
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-700">Doctor</label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-700">
            Current Payable
          </label>
          <div
            className={`rounded-md border px-3 py-2 text-sm ${balance != null ? "border-amber-300 bg-amber-50 text-amber-800" : "text-slate-500"}`}
          >
            {balance != null ? `Rs ${balance.toFixed(2)}` : "-"}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-700">
            Payout Date Range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Total in range: Rs {totalSelected.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 grid gap-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm text-slate-700">
            Amount (Rs)
          </label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            step="0.01"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-700">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option>Cash</option>
            <option>Bank</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-slate-700">Memo</label>
          <input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Optional note"
          />
        </div>
        <div className="md:col-span-4 flex justify-end">
          <button
            disabled={!canPay}
            onClick={pay}
            className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Saving..." : "Pay Doctor"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-medium text-slate-800 flex items-center justify-between">
          <div>Recent Payouts</div>
          <div className="flex items-center gap-2">
            <button
              onClick={printSelectedSummary}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Print Doctor Summary
            </button>
            <button
              onClick={printAllDoctorsSummary}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Print All Doctors
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Amount</th>
                <th className="px-4 py-2 font-medium">Memo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredPayouts.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">{p.dateIso}</td>
                  <td className="px-4 py-2">Rs {p.amount.toFixed(2)}</td>
                  <td className="px-4 py-2">{p.memo || "-"}</td>
                </tr>
              ))}
              {filteredPayouts.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-slate-500"
                    colSpan={3}
                  >
                    No payouts
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {printOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-xl bg-white shadow-lg overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="font-medium text-slate-800">
                Print Preview{printLabel ? `: ${printLabel}` : ""}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={printFromPreview}
                  disabled={printing}
                  className="rounded-md bg-violet-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {printing ? "Printing..." : "Print"}
                </button>
              </div>
            </div>
            <div className="p-4">
              <iframe
                ref={printFrameRef}
                title="Print Preview"
                srcDoc={printHtml}
                className="h-[70vh] w-full rounded-md border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function escHtml(s: any) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPayoutSummaryHtml(args: {
  title: string;
  subtitle: string;
  rows: Array<{ dateIso: string; amount: number; memo?: string }>;
}) {
  const total = args.rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const body = args.rows
    .map(
      (r) => `
    <tr>
      <td>${escHtml(r.dateIso)}</td>
      <td style="text-align:right">Rs ${Number(r.amount || 0).toFixed(2)}</td>
      <td>${escHtml(r.memo || "")}</td>
    </tr>
  `,
    )
    .join("");
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escHtml(args.title)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        h1 { font-size: 18px; margin: 0; }
        .sub { margin: 4px 0 12px 0; color: #444; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #bbb; padding: 6px; }
        th { background: #f3f4f6; text-align: left; }
        .tot { margin-top: 10px; font-weight: 700; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${escHtml(args.title)}</h1>
      <div class="sub">${escHtml(args.subtitle)}</div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th style="text-align:right">Amount</th>
            <th>Memo</th>
          </tr>
        </thead>
        <tbody>
          ${body || '<tr><td colspan="3">No payouts</td></tr>'}
        </tbody>
      </table>
      <div class="tot">Total: Rs ${total.toFixed(2)}</div>
    </body>
  </html>`;
}

function buildAllDoctorsPayoutHtml(args: {
  title: string;
  subtitle: string;
  rows: Array<{ doctorName: string; total: number }>;
}) {
  const total = args.rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const sorted = [...args.rows].sort((a, b) =>
    String(a.doctorName).localeCompare(String(b.doctorName)),
  );
  const body = sorted
    .map(
      (r) => `
    <tr>
      <td>${escHtml(r.doctorName)}</td>
      <td style="text-align:right">Rs ${Number(r.total || 0).toFixed(2)}</td>
    </tr>
  `,
    )
    .join("");
  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escHtml(args.title)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        h1 { font-size: 18px; margin: 0; }
        .sub { margin: 4px 0 12px 0; color: #444; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #bbb; padding: 6px; }
        th { background: #f3f4f6; text-align: left; }
        .tot { margin-top: 10px; font-weight: 700; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>${escHtml(args.title)}</h1>
      <div class="sub">${escHtml(args.subtitle)}</div>
      <table>
        <thead>
          <tr>
            <th>Doctor</th>
            <th style="text-align:right">Total Paid</th>
          </tr>
        </thead>
        <tbody>
          ${body || '<tr><td colspan="2">No payouts</td></tr>'}
        </tbody>
      </table>
      <div class="tot">Grand Total: Rs ${total.toFixed(2)}</div>
    </body>
  </html>`;
}
