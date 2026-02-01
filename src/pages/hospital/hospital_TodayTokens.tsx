import { useEffect, useMemo, useState } from "react";
import { hospitalApi } from "../../utils/api";
import Hospital_TokenSlip, {
  type TokenSlipData,
} from "../../components/hospital/Hospital_TokenSlip";
import Hospital_Modal from "../../components/hospital/bed-management/Hospital_Modal";

interface TokenRow {
  _id: string;
  time: string;
  tokenNo: string;
  mrNo: string;
  patient: string;
  age?: string;
  gender?: string;
  phone?: string;
  doctor?: string;
  department?: string;
  baseFee: number;
  discount: number;
  fee: number;
  status: "queued" | "in-progress" | "completed" | "returned" | "cancelled";
}

export default function Hospital_TodayTokens() {
  const [rows, setRows] = useState<TokenRow[]>([]);
  const [query, setQuery] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [showSlip, setShowSlip] = useState(false);
  const [slipData, setSlipData] = useState<TokenSlipData | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const [modal, setModal] = useState<null | { title: string; message: string }>(
    null,
  );
  const [confirmState, setConfirmState] = useState<null | {
    title: string;
    message: string;
    onConfirm: () => void;
  }>(null);

  const showModal = (title: string, message: string) =>
    setModal({ title, message });

  const [editState, setEditState] = useState<{
    row: TokenRow;
    value: string;
  } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const res = (await hospitalApi.listTokens({ date: today })) as any;
    const items: TokenRow[] = (res.tokens || []).map((t: any) => ({
      _id: t._id,
      time: t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : "",
      tokenNo: t.tokenNo,
      mrNo: t.patientId?.mrn || t.mrn || "-",
      patient: t.patientId?.fullName || t.patientName || "-",
      age: t.patientId?.age,
      gender: t.patientId?.gender,
      phone: t.patientId?.phoneNormalized,
      doctor: t.doctorId?.name || "-",
      department: t.departmentId?.name || "-",
      baseFee: Number(
        t.baseFee ?? (Number(t.fee || 0) + Number(t.discount || 0) || 0),
      ),
      discount: Number(t.discount || 0),
      fee: Number(t.fee || 0),
      status: t.status,
    }));
    setRows(items.filter((r) => r.status !== "cancelled"));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.patient,
        r.mrNo,
        r.tokenNo,
        r.phone,
        r.doctor,
        r.department,
        r.gender,
        r.time,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [query, rows]);

  const totalPatients = filtered.length;
  const totalTokens = filtered.length;
  const totalRevenue = filtered.reduce((s, r) => s + r.fee, 0);
  const totalDiscount = filtered.reduce((s, r) => s + (r.discount || 0), 0);
  const discountedCount = filtered.filter((r) => (r.discount || 0) > 0).length;
  const returnedPatients = filtered.filter(
    (r) => r.status === "returned",
  ).length;

  const start = (page - 1) * rowsPerPage;
  const pageRows = filtered.slice(start, start + rowsPerPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));

  async function setStatus(row: TokenRow, status: TokenRow["status"]) {
    try {
      setActioningId(row._id);
      await hospitalApi.updateTokenStatus(row._id, status);
      await load();
    } catch (e: any) {
      showModal("Failed", e?.message || "Failed to update status");
    } finally {
      setActioningId(null);
    }
  }

  function printSlip(r: TokenRow) {
    const slip: TokenSlipData = {
      tokenNo: r.tokenNo,
      departmentName: r.department || "-",
      doctorName: r.doctor || "-",
      patientName: r.patient || "-",
      phone: r.phone || "",
      mrn: r.mrNo || "",
      age: r.age,
      gender: r.gender,
      amount: r.baseFee,
      discount: r.discount,
      payable: r.fee,
      createdAt: new Date().toISOString(),
    };
    setSlipData(slip);
    setShowSlip(true);
  }

  // No index mapping needed when actions use row ids

  const exportCSV = () => {
    const cols = [
      "Time",
      "Token #",
      "MR #",
      "Patient",
      "Age",
      "Gender",
      "Phone",
      "Doctor",
      "Department",
      "Fee",
      "Returned",
    ];
    const lines = [cols.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          r.time,
          r.tokenNo,
          r.mrNo,
          r.patient,
          r.age ?? "",
          r.gender ?? "",
          r.phone ?? "",
          r.doctor ?? "",
          r.department ?? "",
          r.fee,
          r.status === "returned" ? "Yes" : "No",
        ]
          .map((v) =>
            typeof v === "string" && v.includes(",")
              ? `"${v.replace(/"/g, '""')}"`
              : String(v),
          )
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `todays-tokens-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">
          Today's Tokens{" "}
          <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {filtered.length}
          </span>
        </h2>
        <button
          onClick={exportCSV}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Export CSV
        </button>
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, token#, MR#, phone, doctor, department, age, gender, address, or time..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <StatCard title="Today's Patients" value={totalPatients} tone="blue" />
        <StatCard title="Tokens Generated" value={totalTokens} tone="green" />
        <StatCard
          title="Today's Revenue"
          value={`Rs. ${totalRevenue.toLocaleString()}`}
          tone="violet"
        />
        <StatCard
          title="Discount (PKR)"
          value={`Rs. ${totalDiscount.toLocaleString()}`}
          tone="violet"
        />
        <StatCard
          title="Discounted Tokens"
          value={discountedCount}
          tone="green"
        />
        <StatCard
          title="Returned Patients"
          value={returnedPatients}
          tone="amber"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-600">
              <Th>Time</Th>
              <Th>Token #</Th>
              <Th>MR #</Th>
              <Th>Patient</Th>
              <Th>Age</Th>
              <Th>Gender</Th>
              <Th>Phone</Th>
              <Th>Doctor</Th>
              <Th>Department</Th>
              <Th>Fee</Th>
              <Th>Print</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {pageRows.map((r) => (
              <tr
                key={r._id}
                className={`text-slate-700 ${r.status === "returned" ? "bg-amber-50" : ""}`}
              >
                <Td>{r.time}</Td>
                <Td>{r.tokenNo}</Td>
                <Td>{r.mrNo}</Td>
                <Td className="font-medium">{r.patient}</Td>
                <Td>{r.age}</Td>
                <Td>{r.gender}</Td>
                <Td>{r.phone || "-"}</Td>
                <Td>{r.doctor || "-"}</Td>
                <Td>{r.department || "-"}</Td>
                <Td className="font-semibold text-emerald-600">
                  Rs. {r.fee.toLocaleString()}
                </Td>
                <Td>
                  <button
                    onClick={() => printSlip(r)}
                    className="text-sky-600 hover:underline"
                  >
                    Print Slip
                  </button>
                </Td>
                <Td>
                  <div className="flex gap-2">
                    <button
                      disabled={actioningId === r._id}
                      onClick={() =>
                        setEditState({ row: r, value: String(r.discount || 0) })
                      }
                      title="Edit"
                      className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      ✏️
                    </button>
                    {/* Removed Admit to IPD action button per request */}

                    {/* Removed Complete action button per request */}
                    <button
                      disabled={actioningId === r._id}
                      onClick={() =>
                        setStatus(
                          r,
                          r.status === "returned" ? "queued" : "returned",
                        )
                      }
                      title="Return"
                      className={`hover:text-amber-800 ${r.status === "returned" ? "text-amber-800" : "text-amber-600"} disabled:opacity-50`}
                    >
                      ↩️
                    </button>
                    <button
                      disabled={actioningId === r._id}
                      onClick={() =>
                        setConfirmState({
                          title: "Delete Token",
                          message: "Delete this token?",
                          onConfirm: () => setStatus(r, "cancelled"),
                        })
                      }
                      title="Cancel"
                      className="text-rose-600 hover:text-rose-800 disabled:opacity-50"
                    >
                      🗑️
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-slate-300 px-2 py-1"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showSlip && slipData && (
        <Hospital_TokenSlip
          open={showSlip}
          onClose={() => setShowSlip(false)}
          data={slipData}
          autoPrint={false}
        />
      )}

      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
            <div className="text-sm font-semibold text-slate-800">
              Edit Discount
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Token #{editState.row.tokenNo} • Base Fee: Rs.{" "}
              {editState.row.baseFee.toLocaleString()}
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-sm text-slate-700">
                Discount (PKR)
              </label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                value={editState.value}
                onChange={(e) =>
                  setEditState((s) => (s ? { ...s, value: e.target.value } : s))
                }
                placeholder="0"
                inputMode="decimal"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2 text-sm">
              <button
                onClick={() => setEditState(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const n = Number(editState.value);
                  if (!Number.isFinite(n) || n < 0) {
                    showModal("Invalid", "Invalid discount");
                    return;
                  }
                  if (n > editState.row.baseFee) {
                    showModal("Invalid", "Discount cannot exceed base fee");
                    return;
                  }
                  try {
                    setActioningId(editState.row._id);
                    await hospitalApi.updateToken(editState.row._id, {
                      discount: n,
                    });
                    await load();
                    setEditState(null);
                  } catch (e: any) {
                    showModal("Failed", e?.message || "Failed to update token");
                  } finally {
                    setActioningId(null);
                  }
                }}
                className="rounded-md bg-violet-700 px-3 py-1.5 text-white hover:bg-violet-800 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2 font-medium">{children}</th>;
}
function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2 ${className}`}>{children}</td>;
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: React.ReactNode;
  tone: "blue" | "green" | "violet" | "amber";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-sm text-slate-600">{title}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">Real-time data</div>
    </div>
  );
}
