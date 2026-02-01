import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api as coreApi, hospitalApi } from "../../../utils/api";
import Hospital_Modal from "../../../components/hospital/bed-management/Hospital_Modal";

export default function Hospital_InvoiceList() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState<null | { title: string; message: string }>(
    null,
  );
  const showModal = (title: string, message: string) =>
    setModal({ title, message });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [doc, setDoc] = useState<null | { title: string; html: string }>(null);

  useEffect(() => {
    load();
  }, [page, limit]);

  async function load() {
    setLoading(true);
    try {
      // There is no separate invoice collection; list discharged admissions and show invoice actions
      const res: any = await hospitalApi
        .listIPDAdmissions({ status: "discharged", q, page, limit })
        .catch(() => null);
      const admissions = res?.admissions || [];
      const mapped = admissions.map((e: any) => ({
        encounterId: String(e._id),
        patientName: e.patientId?.fullName,
        mrn: e.patientId?.mrn,
        cnic: e.patientId?.cnicNormalized,
        phone: e.patientId?.phoneNormalized,
        department: e.departmentId?.name,
        createdAt: e.endAt || e.startAt,
      }));
      setRows(mapped);
      setTotal(res?.total || mapped.length);
    } finally {
      setLoading(false);
    }
  }

  function sr(idx: number) {
    return (page - 1) * limit + idx + 1;
  }

  async function onPrint(encounterId: string) {
    setDoc({ title: "Final Invoice", html: "" });
    setDocLoading(true);
    try {
      const html = (await coreApi(
        `/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/final-invoice/print`,
      )) as any;
      setDoc({ title: "Final Invoice", html: String(html || "") });
    } catch (e: any) {
      setDoc(null);
      showModal("Failed", e?.message || "Failed to load invoice");
    } finally {
      setDocLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-800">
          Final Invoices
        </div>
        <div className="flex items-center gap-2">
          <input
            className="border rounded-md px-2 py-1 text-sm"
            placeholder="Search name / MRN / CNIC / phone / dept"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                load();
              }
            }}
          />
          <button
            className="btn-outline-navy text-sm"
            onClick={() => {
              setPage(1);
              load();
            }}
            disabled={loading}
          >
            Search
          </button>
        </div>
      </div>

      <div className="overflow-auto border rounded-md">
        <table className="min-w-[800px] w-full">
          <thead>
            <tr className="bg-slate-100 text-left text-sm text-slate-700">
              <th className="px-3 py-2">Sr #</th>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">MRN</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">CNIC</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((r, i) => (
              <tr key={r.encounterId} className="border-t">
                <td className="px-3 py-2">{sr(i)}</td>
                <td className="px-3 py-2">{r.patientName || "-"}</td>
                <td className="px-3 py-2">{r.mrn || "-"}</td>
                <td className="px-3 py-2">{r.department || "-"}</td>
                <td className="px-3 py-2">{r.cnic || "-"}</td>
                <td className="px-3 py-2">{r.phone || "-"}</td>
                <td className="px-3 py-2">
                  {new Date(r.createdAt || "").toLocaleString?.() || ""}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      className="btn-outline-navy text-xs"
                      onClick={() =>
                        navigate(
                          `/hospital/ipd/admissions/${encodeURIComponent(r.encounterId)}/invoice`,
                        )
                      }
                    >
                      Edit
                    </button>
                    <button
                      className="btn-outline-navy text-xs"
                      onClick={() => onPrint(String(r.encounterId))}
                    >
                      Print
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={8}>
                  {loading ? "Loading..." : "No records found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm">
        <span>Rows:</span>
        <select
          className="border rounded px-2 py-1"
          value={limit}
          onChange={(e) => {
            setLimit(parseInt(e.target.value) || 20);
            setPage(1);
          }}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span>
          Page {page} of {Math.max(1, Math.ceil(total / limit) || 1)}
        </span>
        <button
          className="btn-outline-navy"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <button
          className="btn-outline-navy"
          disabled={page >= Math.ceil(total / limit)}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
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
