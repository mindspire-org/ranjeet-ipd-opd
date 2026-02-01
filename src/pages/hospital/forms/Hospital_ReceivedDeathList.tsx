import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hospitalApi, api as coreApi } from "../../../utils/api";
import Hospital_Modal from "../../../components/hospital/bed-management/Hospital_Modal";

export default function Hospital_ReceivedDeathList() {
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
  const pdfUrlRef = useRef<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [doc, setDoc] = useState<null | {
    title: string;
    kind: "html" | "pdf";
    html?: string;
    src?: string;
  }>(null);

  useEffect(() => {
    load();
  }, [page, limit]);

  async function load() {
    setLoading(true);
    try {
      // Preferred: server-side list endpoint
      const res: any = await hospitalApi
        .listIpdReceivedDeaths({ q, page, limit })
        .catch(() => null);
      if (res && Array.isArray(res.results)) {
        setRows(res.results);
        setTotal(res.total || res.results.length || 0);
        return;
      }
      // Fallback: scan discharged encounters and pick those with a saved form
      const encs: any = await hospitalApi
        .listIPDAdmissions({ status: "discharged", q, page, limit })
        .catch(() => null);
      const admissions = encs?.admissions || [];
      const mapped = await Promise.all(
        admissions.map(async (e: any) => {
          try {
            const rd: any = await hospitalApi
              .getIpdReceivedDeath(String(e._id))
              .catch(() => null);
            if (rd?.receivedDeath) {
              return {
                _id: rd.receivedDeath._id,
                encounterId: String(e._id),
                createdAt: rd.receivedDeath.createdAt || e.startAt,
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

  async function openHtmlDoc(title: string, path: string) {
    setDoc({ title, kind: "html", html: "" });
    setDocLoading(true);
    try {
      const html = (await coreApi(path)) as any;
      setDoc({ title, kind: "html", html: String(html || "") });
    } catch (e: any) {
      setDoc(null);
      showModal("Failed", e?.message || "Failed to load document");
    } finally {
      setDocLoading(false);
    }
  }

  async function openPdfDoc(title: string, url: string) {
    setDoc({ title, kind: "pdf", src: "" });
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
      const res = await fetch(url, {
        headers: token
          ? ({ Authorization: `Bearer ${token}` } as any)
          : undefined,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "Failed to load document");
        setDoc(null);
        showModal(
          "Not Available",
          String(txt || "").slice(0, 500) || "Failed to load document",
        );
        return;
      }
      const blob = await res.blob();
      if (pdfUrlRef.current) {
        try {
          URL.revokeObjectURL(pdfUrlRef.current);
        } catch {}
      }
      const objUrl = URL.createObjectURL(blob);
      pdfUrlRef.current = objUrl;
      setDoc({ title, kind: "pdf", src: objUrl });
    } catch (e: any) {
      setDoc(null);
      showModal("Failed", e?.message || "Failed to load document");
    } finally {
      setDocLoading(false);
    }
  }

  async function onPrint(encounterId: string) {
    return openHtmlDoc(
      "Received Death",
      `/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/received-death/print`,
    );
  }

  function onDownloadPdf(encounterId: string) {
    const isFile =
      typeof window !== "undefined" && window.location?.protocol === "file:";
    const isElectronUA =
      typeof navigator !== "undefined" &&
      /Electron/i.test(navigator.userAgent || "");
    const apiBase =
      (import.meta as any).env?.VITE_API_URL ||
      (isFile || isElectronUA
        ? "http://127.0.0.1:4000/api"
        : "http://localhost:4000/api");
    const url = `${apiBase}/hospital/ipd/admissions/${encodeURIComponent(encounterId)}/received-death/print-pdf`;
    openPdfDoc("Received Death (PDF)", url);
  }

  async function doDelete(encounterId: string) {
    try {
      await hospitalApi.deleteIpdReceivedDeath(encounterId);
    } catch (e: any) {
      showModal("Failed", e?.message || "Failed to delete");
    }
    load();
  }

  async function onDelete(encounterId: string) {
    setConfirmState({
      title: "Delete",
      message: "Delete this form?",
      onConfirm: () => {
        doDelete(encounterId);
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-800">
          Received Death Forms
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
                          `/hospital/ipd/admissions/${encodeURIComponent(r.encounterId)}/forms/received-death`,
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
                      onClick={() => onDownloadPdf(String(r.encounterId))}
                    >
                      Download PDF
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

      <Hospital_Modal
        open={!!doc}
        onClose={() => {
          if (pdfUrlRef.current) {
            try {
              URL.revokeObjectURL(pdfUrlRef.current);
            } catch {}
            pdfUrlRef.current = null;
          }
          setDoc(null);
        }}
      >
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
              <button
                onClick={() => {
                  if (pdfUrlRef.current) {
                    try {
                      URL.revokeObjectURL(pdfUrlRef.current);
                    } catch {}
                    pdfUrlRef.current = null;
                  }
                  setDoc(null);
                }}
                className="btn"
              >
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
              src={doc?.kind === "pdf" ? doc?.src || "" : undefined}
              srcDoc={doc?.kind === "html" ? doc?.html || "" : undefined}
            />
          )}
        </div>
      </Hospital_Modal>
    </div>
  );
}
