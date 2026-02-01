import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hospitalApi } from "../../../utils/api";
import Hospital_Modal from "../../../components/hospital/bed-management/Hospital_Modal";

export default function Hospital_ShortStayList() {
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
  const [confirmState, setConfirmState] = useState<null | {
    title: string;
    message: string;
    onConfirm: () => void;
  }>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [doc, setDoc] = useState<null | { title: string; html: string }>(null);

  useEffect(() => {
    load();
  }, [page, limit]);

  async function load() {
    setLoading(true);
    try {
      // Try list API
      const res: any = await hospitalApi
        .listIpdShortStays({ q, page, limit })
        .catch(() => null);
      if (res && Array.isArray(res.results)) {
        setRows(res.results);
        setTotal(res.total || res.results.length || 0);
        return;
      }
      // Fallback: scan discharged encounters and include those with a short-stay doc
      const encs: any = await hospitalApi
        .listIPDAdmissions({ status: "discharged", q, page, limit })
        .catch(() => null);
      const admissions = encs?.admissions || [];
      const mapped = await Promise.all(
        admissions.map(async (e: any) => {
          try {
            const ss: any = await hospitalApi
              .getIpdShortStay(String(e._id))
              .catch(() => null);
            if (ss?.shortStay) {
              return {
                _id: ss.shortStay._id,
                encounterId: String(e._id),
                createdAt: ss.shortStay.createdAt || e.startAt,
                patientName: e.patientId?.fullName,
                mrn: e.patientId?.mrn,
                cnic: e.patientId?.cnicNormalized,
                phone: e.patientId?.phoneNormalized,
                department: e.departmentId?.name,
              };
            }
          } catch {}
          return null;
        }),
      );
      const rows = mapped.filter(Boolean) as any[];
      setRows(rows);
      setTotal(rows.length);
    } finally {
      setLoading(false);
    }
  }

  function sr(idx: number) {
    return (page - 1) * limit + idx + 1;
  }

  function fmtDateTime(d?: string, t?: string) {
    try {
      const dt = (d || "") + (t ? "T" + t : "");
      const x = new Date(dt);
      if (!isNaN(x.getTime())) return x.toLocaleString();
    } catch {}
    return [d, t].filter(Boolean).join(" ");
  }
  function esc(s?: string) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        (
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }) as any
        )[c],
    );
  }

  function buildShortStayPreviewHtml(enc: any, data: any, settings: any) {
    const p = enc?.patientId || {};
    const s = settings || {};
    const logo = s?.logoDataUrl
      ? `<img src="${esc(s.logoDataUrl)}" style="height:60px;object-fit:contain"/>`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>@page{size:A4;margin:12mm}body{font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;color:#111}.wrap{padding:0 4mm}.hdr{display:grid;grid-template-columns:96px 1fr 96px;align-items:center}.title{font-size:22px;font-weight:800;text-align:center}.muted{color:#475569;font-size:12px;text-align:center}.hr{border-bottom:2px solid #0f172a;margin:6px 0}.box{border:1px solid #e2e8f0;border-radius:10px;padding:6px;margin:8px 0}.kv{display:grid;grid-template-columns: 130px minmax(0,1fr) 130px minmax(0,1fr) 130px minmax(0,1fr);gap:4px 10px;font-size:12px;align-items:start}.kv>div:nth-child(2n){word-break:break-word}.sec{margin-top:6px}.sec .lbl{font-weight:700;margin-bottom:2px}</style></head><body><div class=wrap>
      <div class=hdr><div>${logo}</div><div><div class=title>${esc(s.name || "Hospital")}</div><div class=muted>${esc(s.address || "-")}</div><div class=muted>Ph: ${esc(s.phone || "")} ${s.email ? " • " + esc(s.email) : ""}</div></div><div></div></div>
      <div class=hr></div>
      <div class=box><div class=kv>
        <div>Medical Record No :</div><div>${esc(p.mrn || data.mrn || "-")}</div>
        <div>Admission No :</div><div>${esc(enc.admissionNo || "-")}</div>
        <div>Patient Name :</div><div>${esc(p.fullName || data.patientName || "-")}</div>
        <div>Age / Gender :</div><div>${esc(p.age || data.age || "")} / ${esc(p.gender || data.sex || "")}</div>
        <div>Reg. & Sample Time :</div><div>${esc(fmtDateTime(data.dateIn, data.timeIn))}</div>
        <div>Discharge Time :</div><div>${esc(fmtDateTime(data.dateOut, data.timeOut))}</div>
        <div>Address :</div><div>${esc(p.address || data.address || "-")}</div>
      </div></div>
      <div class=sec><div class=lbl>Final Diagnosis</div><div>${esc(data.finalDiagnosis || "")}</div></div>
      <div class=sec><div class=lbl>Presenting Complaints</div><div>${esc(data.presentingComplaints || "")}</div></div>
      <div class=sec><div class=lbl>Brief History</div><div>${esc(data.briefHistory || "")}</div></div>
      <div class=sec><div class=lbl>Treatment Given at Hospital</div><div>${esc(data.treatmentGiven || "")}</div></div>
      <div class=sec><div class=lbl>Treatment at Discharge</div><div>${esc(data.treatmentAtDischarge || "")}</div></div>
      <div class=sec><div class=lbl>Follow up Instructions</div><div>${esc(data.followUpInstructions || "")}</div></div>
      </div></body></html>`;
    return html;
  }

  async function onPrint(encounterId: string) {
    setDoc({ title: "Short Stay", html: "" });
    setDocLoading(true);
    try {
      const [encRes, ssRes, settings] = await Promise.all([
        hospitalApi.getIPDAdmissionById(encounterId) as any,
        hospitalApi.getIpdShortStay(encounterId) as any,
        hospitalApi.getSettings() as any,
      ]);
      const enc = encRes?.encounter || {};
      const data = ssRes?.shortStay?.data || {};
      const html = buildShortStayPreviewHtml(enc, data, settings);
      setDoc({ title: "Short Stay", html });
    } catch (e: any) {
      setDoc(null);
      showModal("Failed", e?.message || "Failed to load short stay preview");
    } finally {
      setDocLoading(false);
    }
  }

  async function doDelete(encounterId: string) {
    try {
      await hospitalApi.deleteIpdShortStay(encounterId);
    } catch (e: any) {
      showModal("Failed", e?.message || "Failed to delete");
    }
    load();
  }

  async function onDelete(encounterId: string) {
    setConfirmState({
      title: "Delete",
      message: "Delete this form?",
      onConfirm: () => doDelete(encounterId),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-800">
          Short Stay Forms
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
              <tr key={r._id} className="border-t">
                <td className="px-3 py-2">{sr(i)}</td>
                <td className="px-3 py-2">{r.patientName || "-"}</td>
                <td className="px-3 py-2">{r.mrn || "-"}</td>
                <td className="px-3 py-2">{r.department || "-"}</td>
                <td className="px-3 py-2">{r.cnic || "-"}</td>
                <td className="px-3 py-2">{r.phone || "-"}</td>
                <td className="px-3 py-2">
                  {new Date(
                    r.createdAt || r._id?.toString?.(),
                  ).toLocaleString?.() || ""}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      className="btn-outline-navy text-xs"
                      onClick={() =>
                        navigate(
                          `/hospital/ipd/admissions/${encodeURIComponent(r.encounterId)}/forms/short-stay`,
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
                    <button
                      className="btn-outline-navy text-xs"
                      onClick={() => onDelete(String(r.encounterId))}
                    >
                      Delete
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

      <Hospital_Modal
        open={!!confirmState}
        onClose={() => setConfirmState(null)}
      >
        <div className="space-y-4">
          <div className="text-lg font-semibold text-slate-800">
            {confirmState?.title || "Confirm"}
          </div>
          <div className="text-sm whitespace-pre-wrap text-slate-700">
            {confirmState?.message || "Are you sure?"}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmState(null)}
              className="btn-outline-navy"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const fn = confirmState?.onConfirm;
                setConfirmState(null);
                try {
                  fn?.();
                } catch {}
              }}
              className="btn"
            >
              Confirm
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
