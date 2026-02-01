import { useEffect, useState } from "react";
import { hospitalApi } from "../../utils/api";
import Hospital_Modal from "../../components/hospital/bed-management/Hospital_Modal";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type Doctor = { id: string; name: string };

type Schedule = {
  _id: string;
  doctorId: string;
  departmentId?: string;
  dateIso: string;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  fee?: number;
  followupFee?: number;
  notes?: string;
};

export default function Hospital_DoctorSchedules() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [doctorId, setDoctorId] = useState("");
  const [dateIso, setDateIso] = useState(todayIso());
  const [rows, setRows] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    departmentId: "",
    startTime: "09:00",
    endTime: "12:00",
    slotMinutes: "30",
    fee: "",
    followupFee: "",
    notes: "",
  });
  const [editId, setEditId] = useState<string | null>(null);

  const [modal, setModal] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    type?: "info" | "error" | "success";
  }>({ open: false });
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title?: string;
    message?: string;
    onConfirm?: (() => void) | null;
  }>({ open: false });

  function showModal(
    title: string,
    message: string,
    type: "info" | "error" | "success" = "info",
  ) {
    setModal({ open: true, title, message, type });
  }
  function showConfirm(title: string, message: string, onConfirm: () => void) {
    setConfirmModal({ open: true, title, message, onConfirm });
  }

  useEffect(() => {
    (async () => {
      try {
        const [docRes, depRes] = await Promise.all([
          hospitalApi.listDoctors() as any,
          hospitalApi.listDepartments() as any,
        ]);
        setDoctors(
          (docRes?.doctors || []).map((d: any) => ({
            id: String(d._id),
            name: d.name,
          })),
        );
        setDepartments(
          (depRes?.departments || []).map((d: any) => ({
            id: String(d._id),
            name: d.name,
          })),
        );
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (doctorId && dateIso) load();
  }, [doctorId, dateIso]);

  async function load() {
    setLoading(true);
    try {
      const res = (await hospitalApi.listDoctorSchedules({
        doctorId,
        date: dateIso,
      })) as any;
      setRows(res?.schedules || []);
    } catch {
      setRows([]);
    }
    setLoading(false);
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) {
      showModal("Error", "Select doctor", "error");
      return;
    }
    if (!dateIso) {
      showModal("Error", "Select date", "error");
      return;
    }
    const payload: any = {
      doctorId,
      departmentId: form.departmentId || undefined,
      dateIso,
      startTime: form.startTime,
      endTime: form.endTime,
      slotMinutes: Math.max(5, parseInt(form.slotMinutes || "15", 10) || 15),
      fee: form.fee ? Number(form.fee) : undefined,
      followupFee: form.followupFee ? Number(form.followupFee) : undefined,
      notes: form.notes || undefined,
    };
    try {
      if (editId) {
        await hospitalApi.updateDoctorSchedule(editId, payload);
        setEditId(null);
      } else {
        await hospitalApi.createDoctorSchedule(payload);
      }
      await load();
      setForm({
        departmentId: form.departmentId,
        startTime: "09:00",
        endTime: "12:00",
        slotMinutes: "30",
        fee: "",
        followupFee: "",
        notes: "",
      });
      showModal("Success", "Schedule saved", "success");
    } catch (e: any) {
      showModal("Error", e?.message || "Failed to save schedule", "error");
    }
  };

  const remove = async (id: string) => {
    showConfirm("Delete Schedule", "Delete this schedule?", async () => {
      try {
        await hospitalApi.deleteDoctorSchedule(id);
        await load();
        showModal("Success", "Schedule deleted", "success");
      } catch (e: any) {
        showModal("Error", e?.message || "Failed to delete", "error");
      }
    });
  };

  const onEdit = (s: Schedule) => {
    setEditId(s._id);
    setDateIso(s.dateIso);
    setDoctorId(s.doctorId);
    setForm({
      departmentId: String(s.departmentId || ""),
      startTime: s.startTime,
      endTime: s.endTime,
      slotMinutes: String(s.slotMinutes || 15),
      fee: s.fee != null ? String(s.fee) : "",
      followupFee: s.followupFee != null ? String(s.followupFee) : "",
      notes: s.notes || "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold text-slate-800">
          Doctor Schedules
        </h2>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <form onSubmit={save} className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Doctor
            </label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Select doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Date
            </label>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => setDateIso(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Department (optional)
            </label>
            <select
              value={form.departmentId}
              onChange={(e) =>
                setForm((f) => ({ ...f, departmentId: e.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Not set</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Start Time
            </label>
            <input
              type="time"
              value={form.startTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, startTime: e.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              End Time
            </label>
            <input
              type="time"
              value={form.endTime}
              onChange={(e) =>
                setForm((f) => ({ ...f, endTime: e.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Slot Minutes
            </label>
            <input
              type="number"
              value={form.slotMinutes}
              onChange={(e) =>
                setForm((f) => ({ ...f, slotMinutes: e.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Fee (optional)
            </label>
            <input
              value={form.fee}
              onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Follow-up Fee (optional)
            </label>
            <input
              value={form.followupFee}
              onChange={(e) =>
                setForm((f) => ({ ...f, followupFee: e.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Notes
            </label>
            <input
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="md:col-span-6 flex items-center justify-end gap-2">
            {editId && (
              <button
                type="button"
                onClick={() => {
                  setEditId(null);
                  setForm({
                    departmentId: form.departmentId,
                    startTime: "09:00",
                    endTime: "12:00",
                    slotMinutes: "30",
                    fee: "",
                    followupFee: "",
                    notes: "",
                  });
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white"
            >
              {editId ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm">
          <div className="font-medium text-slate-800">
            Schedules on {dateIso || "-"}
          </div>
          <div className="text-slate-600">
            {loading ? "Loading..." : `${rows.length} item(s)`}
          </div>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Doctor</th>
              <th className="px-3 py-2 text-left">Dept</th>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">Slot</th>
              <th className="px-3 py-2 text-left">Fees</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s._id} className="border-b border-slate-100">
                <td className="px-3 py-2">
                  {doctors.find((d) => d.id === s.doctorId)?.name || s.doctorId}
                </td>
                <td className="px-3 py-2">
                  {departments.find((d) => d.id === s.departmentId)?.name ||
                    "-"}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {s.startTime} - {s.endTime}
                </td>
                <td className="px-3 py-2">{s.slotMinutes} min</td>
                <td className="px-3 py-2">
                  {s.fee != null ? `Rs. ${s.fee}` : "-"}
                  {s.followupFee != null
                    ? ` / Follow-up: Rs. ${s.followupFee}`
                    : ""}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(s)}
                      className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(s._id)}
                      className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No schedules
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

      {confirmModal.open && (
        <Hospital_Modal
          open={confirmModal.open}
          onClose={() => setConfirmModal({ open: false })}
        >
          <div className="text-lg font-semibold text-slate-900 mb-2">
            {confirmModal.title}
          </div>
          <div className="p-4">
            <p className="mb-4 text-slate-700">{confirmModal.message}</p>
            <div className="flex justify-end gap-2">
              <button
                className="btn-outline-navy"
                onClick={() => setConfirmModal({ open: false })}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={async () => {
                  try {
                    await confirmModal.onConfirm?.();
                  } finally {
                    setConfirmModal({ open: false });
                  }
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </Hospital_Modal>
      )}
    </div>
  );
}
