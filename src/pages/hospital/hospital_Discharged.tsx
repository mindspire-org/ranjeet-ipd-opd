import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { hospitalApi } from "../../utils/api";
import Hospital_Modal from "../../components/hospital/bed-management/Hospital_Modal";

type Discharge = {
  id: string;
  patientId?: string;
  mrn?: string;
  name: string;
  doctor?: string;
  bed?: number;
  admitted?: string;
  discharged: string;
  note?: string;
};

function toCsv(rows: Discharge[]) {
  const headers = [
    "id",
    "mrn",
    "name",
    "doctor",
    "bed",
    "admitted",
    "discharged",
    "note",
  ];
  const body = rows.map((r) => [
    r.id,
    r.mrn || "",
    r.name,
    r.doctor || "",
    String(r.bed ?? ""),
    r.admitted || "",
    r.discharged,
    r.note || "",
  ]);
  return [headers, ...body]
    .map((arr) =>
      arr.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
}

export default function Hospital_Discharged() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [tick, setTick] = useState(0);
  const [serverRows, setServerRows] = useState<Discharge[]>([]);

  const [modal, setModal] = useState<null | { title: string; message: string }>(
    null,
  );
  const showModal = (title: string, message: string) =>
    setModal({ title, message });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [doc, setDoc] = useState<null | { title: string; html: string }>(null);
  const [docLoading, setDocLoading] = useState(false);

  const apiBase = useMemo(() => {
    const isFile =
      typeof window !== "undefined" && window.location?.protocol === "file:";
    const isElectronUA =
      typeof navigator !== "undefined" &&
      /Electron/i.test(navigator.userAgent || "");
    const envBase = (import.meta as any).env?.VITE_API_URL;
    return (
      envBase ||
      (isFile || isElectronUA
        ? "http://127.0.0.1:4000/api"
        : "http://localhost:4000/api")
    );
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = (await hospitalApi.listIPDAdmissions({
          status: "discharged",
          limit: 500,
        })) as any;
        const rows: any[] = res?.admissions || [];
        const mapped: Discharge[] = rows.map((r: any) => ({
          id: String(r._id),
          patientId: String(r.patientId?._id || ""),
          mrn: String(r.patientId?.mrn || ""),
          name: String(r.patientId?.fullName || "").toLowerCase(),
          doctor: String(r.doctorId?.name || ""),
          bed: r.bedLabel || "",
          admitted: r.startAt,
          discharged: r.endAt || r.updatedAt || r.createdAt,
        }));
        setServerRows(mapped);
      } catch {}
    })();
  }, [tick]);

  const all = useMemo(
    () =>
      serverRows.sort(
        (a, b) =>
          new Date(b.discharged).getTime() - new Date(a.discharged).getTime(),
      ),
    [serverRows],
  );
  const filtered = useMemo(() => {
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    return all.filter((r) => {
      if (fromDate && new Date(r.discharged) < fromDate) return false;
      if (
        toDate &&
        new Date(r.discharged) >
          new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1)
      )
        return false;
      if (q) {
        const hay = `${r.name} ${r.mrn ?? ""} ${r.doctor ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [all, from, to, q]);

  const openDocModal = async (title: string, fullUrl: string) => {
    setDoc({ title, html: "" });
    setDocLoading(true);
    try {
      const token = ((): string => {
        try {
          return (
            localStorage.getItem("hospital.token") ||
            localStorage.getItem("token") ||
            ""
          );
        } catch {
          return "";
        }
      })();
      const res = await fetch(fullUrl, {
        headers: token
          ? ({ Authorization: `Bearer ${token}` } as any)
          : undefined,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "Failed to load document");
        const msg =
          String(txt || "").slice(0, 500) || "Failed to load document";
        setDoc(null);
        showModal("Not Available", msg);
        return;
      }
      const html = await res.text();
      setDoc({ title, html: String(html || "") });
      setTimeout(() => {
        try {
          iframeRef.current?.contentWindow?.focus();
        } catch {}
      }, 0);
    } catch (e: any) {
      setDoc(null);
      showModal("Failed", e?.message || "Failed to load document");
    } finally {
      setDocLoading(false);
    }
  };

  const printSummary = (id: string) =>
    openDocModal(
      "Discharge Summary",
      `${apiBase}/hospital/ipd/admissions/${encodeURIComponent(id)}/discharge-summary/print`,
    );
  const printDeathCert = (id: string) =>
    openDocModal(
      "Death Certificate",
      `${apiBase}/hospital/ipd/admissions/${encodeURIComponent(id)}/death-certificate/print`,
    );
  const printInvoice = (id: string) =>
    openDocModal(
      "Final Invoice",
      `${apiBase}/hospital/ipd/admissions/${encodeURIComponent(id)}/final-invoice/print`,
    );

  const exportCsv = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `discharged_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xl font-bold text-slate-800">
          Discharged Patients
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTick((t) => t + 1)}
            className="btn-outline-navy"
          >
            Refresh
          </button>
          <button onClick={exportCsv} className="btn-outline-navy">
            Export CSV
          </button>
          <Link to="/hospital/patient-list" className="btn-outline-navy">
            Patient List
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid items-end gap-3 md:grid-cols-6">
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
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm text-slate-700">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="name, MRN, doctor"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Rows</label>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(parseInt(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2 font-medium">SR.NO</th>
                <th className="px-4 py-2 font-medium">MRN</th>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-4 py-2 font-medium">Doctor</th>
                <th className="px-4 py-2 font-medium">Bed</th>
                <th className="px-4 py-2 font-medium">Admitted</th>
                <th className="px-4 py-2 font-medium">Discharged</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filtered.slice(0, rowsPerPage).map((r, idx) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">{idx + 1}</td>
                  <td className="px-4 py-2">{r.mrn || "-"}</td>
                  <td className="px-4 py-2 capitalize">{r.name}</td>
                  <td className="px-4 py-2">{r.doctor || "-"}</td>
                  <td className="px-4 py-2">{r.bed ?? "-"}</td>
                  <td className="px-4 py-2">
                    {r.admitted ? new Date(r.admitted).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-2">
                    {new Date(r.discharged).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-emerald-600 px-2 py-1 text-xs text-white">
                      Discharged
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => printSummary(r.id)}
                        className="btn-outline-navy"
                      >
                        Summary
                      </button>
                      <button
                        onClick={() => printInvoice(r.id)}
                        className="btn-outline-navy"
                      >
                        Invoice
                      </button>
                      <button
                        onClick={() => printDeathCert(r.id)}
                        className="btn-outline-navy"
                      >
                        Death Cert
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No discharged patients
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Hospital_Modal open={!!modal} onClose={() => setModal(null)}>
        <div className="space-y-4">
          <div className="text-lg font-semibold text-slate-800">
            {modal?.title}
          </div>
          <div className="text-sm whitespace-pre-wrap text-slate-700">
            {modal?.message}
          </div>
          <div className="flex justify-end">
            <button onClick={() => setModal(null)} className="btn">
              OK
            </button>
          </div>
        </div>
      </Hospital_Modal>

      <Hospital_Modal open={!!doc} onClose={() => setDoc(null)}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-semibold text-slate-800">
              {doc?.title}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  try {
                    iframeRef.current?.contentWindow?.print();
                  } catch {}
                }}
                className="btn-outline-navy"
                disabled={!doc || docLoading}
              >
                Print
              </button>
              <button onClick={() => setDoc(null)} className="btn">
                Close
              </button>
            </div>
          </div>
          {docLoading ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Loading...
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              title={doc?.title || "Document"}
              className="h-[75vh] w-full rounded-md border border-slate-200 bg-white"
              srcDoc={doc?.html || ""}
            />
          )}
        </div>
      </Hospital_Modal>
    </div>
  );
}
