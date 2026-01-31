import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hospitalApi } from "../../utils/api";
import Hospital_Modal from "../../components/hospital/bed-management/Hospital_Modal";

export default function Pharmacy_Referrals() {
  const [list, setList] = useState<any[]>([]);
  const [status, setStatus] = useState<
    "pending" | "completed" | "cancelled" | "all"
  >("pending");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const navigate = useNavigate();
  const [notice, setNotice] = useState<{
    text: string;
    kind: "success" | "error";
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [status, page, limit, from, to]);

  async function load() {
    try {
      const res: any = await hospitalApi.listReferrals({
        type: "pharmacy",
        status: status === "all" ? undefined : status,
        from: from || undefined,
        to: to || undefined,
        page,
        limit,
      });
      setList(res?.referrals || []);
      setTotal(Number(res?.total || 0));
    } catch {
      setList([]);
      setTotal(0);
    }
  }

  async function mark(id: string, st: "completed" | "cancelled" | "pending") {
    try {
      await hospitalApi.updateReferralStatus(id, st);
      await load();
    } catch (e: any) {
      setNotice({ text: e?.message || "Failed", kind: "error" });
      try {
        setTimeout(() => setNotice(null), 3000);
      } catch {}
    }
  }
  async function remove(id: string) {
    setDeleteId(id);
    setDeleteOpen(true);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list || []).filter(
      (r: any) =>
        !s ||
        `${r.encounterId?.patientId?.fullName || ""} ${r.encounterId?.patientId?.mrn || ""} ${r.doctorId?.name || ""}`
          .toLowerCase()
          .includes(s),
    );
  }, [list, q]);

  return (
    <div className="space-y-4">
      {notice && (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${notice.kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}
        >
          {notice.text}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xl font-semibold text-slate-800">
          Pharmacy Referrals
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <span className="text-slate-500 text-sm">to</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as any);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
          <select
            value={limit}
            onChange={(e) => {
              setPage(1);
              setLimit(parseInt(e.target.value) || 20);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm">
          <div className="font-medium text-slate-800">
            Results
          </div>
          <div className="text-slate-600">
            {total
              ? `${(page - 1) * limit + 1}-${Math.min(page * limit, total)} of ${total}`
              : ""}
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {filtered.map((r: any) => (
            <div key={r._id} className="px-4 py-3 text-sm">
              <div className="font-medium text-slate-900">
                {r.encounterId?.patientId?.fullName || "-"}{" "}
                <span className="text-xs text-slate-500">
                  {r.encounterId?.patientId?.mrn || ""}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                {new Date(r.createdAt).toLocaleString()} • Status: {r.status} •
                By: Dr. {r.doctorId?.name || "-"}
              </div>
              {r.notes && (
                <div className="mt-1 text-xs text-slate-700">
                  <span className="font-semibold">Notes:</span> {r.notes}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  className="btn"
                  disabled={!r.prescriptionId}
                  onClick={() =>
                    navigate(`/pharmacy/prescriptions/${r.prescriptionId}`)
                  }
                >
                  Open Intake
                </button>
                <button
                  className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-700"
                  onClick={() => mark(r._id, "completed")}
                >
                  Mark Completed
                </button>
                <button
                  className="rounded-md border border-slate-300 px-3 py-1 text-sm"
                  onClick={() => mark(r._id, "pending")}
                >
                  Mark Pending
                </button>
                <button
                  className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1 text-sm text-rose-700"
                  onClick={() => remove(r._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">
              No referrals
            </div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <button
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <div className="text-slate-600">Page {page}</div>
          <button
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50"
            disabled={page * limit >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <Hospital_Modal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteId(null);
        }}
      >
        <div className="space-y-4">
          <div className="text-lg font-semibold">Confirm Delete</div>
          <div className="text-sm text-slate-700">
            Delete this referral?
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setDeleteOpen(false);
                setDeleteId(null);
              }}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                const id = deleteId;
                setDeleteOpen(false);
                setDeleteId(null);
                if (!id) return;
                try {
                  await hospitalApi.deleteReferral(id);
                  await load();
                  setNotice({ text: "Referral deleted", kind: "success" });
                  try {
                    setTimeout(() => setNotice(null), 2500);
                  } catch {}
                } catch (e: any) {
                  setNotice({ text: e?.message || "Failed", kind: "error" });
                  try {
                    setTimeout(() => setNotice(null), 3000);
                  } catch {}
                }
              }}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
            >
              Delete
            </button>
          </div>
        </div>
      </Hospital_Modal>
    </div>
  );
}
