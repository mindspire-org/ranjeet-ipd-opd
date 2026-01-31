import { useEffect, useMemo, useState } from "react";
import { hospitalApi, labApi } from "../../utils/api";
import { previewPrescriptionPdf } from "../../utils/prescriptionPdf";

type DoctorOpt = { id: string; name: string };

type Row = {
  id: string;
  createdAt: string;
  doctorName: string;
  patientName: string;
  mrn: string;
};

export default function Reception_Prescriptions() {
  const today = new Date().toISOString().slice(0, 10);
  const [doctors, setDoctors] = useState<DoctorOpt[]>([]);
  const [doctorId, setDoctorId] = useState<string>("All");
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const [mrn, setMrn] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await hospitalApi.listDoctors();
        const items: any[] = res?.doctors || [];
        const mapped: DoctorOpt[] = items.map((d) => ({
          id: String(d._id || d.id),
          name: String(d.name || "-"),
        }));
        setDoctors(mapped);
      } catch {
        setDoctors([]);
      }
    })();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, from, to, mrn, page, limit]);

  async function load() {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (doctorId && doctorId !== "All") params.doctorId = doctorId;
      if (from) params.from = from;
      if (to) params.to = to;
      const mr = mrn.trim();
      if (mr) params.patientMrn = mr;
      const res: any = await hospitalApi.listPrescriptions(params);
      const list: any[] = res?.prescriptions || [];
      const mapped: Row[] = list.map((p: any) => ({
        id: String(p._id || p.id),
        createdAt: String(p.createdAt || ""),
        doctorName: String(p.encounterId?.doctorId?.name || "-"),
        patientName: String(p.encounterId?.patientId?.fullName || "-"),
        mrn: String(p.encounterId?.patientId?.mrn || "-"),
      }));
      setRows(mapped);
      setTotal(Number(res?.total || mapped.length));
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      `${r.patientName} ${r.mrn} ${r.doctorName}`.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));

  async function handlePrint(id: string) {
    try {
      const data: any = await fetchPrintData(id);
      await previewPrescriptionPdf(
        {
          doctor: data.doctor || {},
          settings: data.settings || {},
          patient: data.patient || {},
          items: data.items || [],
          vitals: data.vitals,
          primaryComplaint: data.primaryComplaint,
          primaryComplaintHistory: data.primaryComplaintHistory,
          familyHistory: data.familyHistory,
          allergyHistory: data.allergyHistory,
          treatmentHistory: data.treatmentHistory,
          history: data.history,
          examFindings: data.examFindings,
          diagnosis: data.diagnosis,
          advice: data.advice,
          labTests: data.labTests || [],
          labNotes: data.labNotes || "",
          diagnosticTests: data.diagnosticTests || [],
          diagnosticNotes: data.diagnosticNotes || "",
          createdAt: data.createdAt,
        },
        "default",
      );
    } catch (e: any) {
      alert(e?.message || "Failed to print prescription");
    }
  }

  return (
    <div className="w-full px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-800">Prescriptions</div>
          <div className="text-sm text-slate-500">
            Reception view for all doctors
          </div>
        </div>
        <div className="text-sm text-slate-600">
          {loading ? "Loading..." : `${filtered.length} results`}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid items-end gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Doctor</label>
            <select
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="All">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">MR #</label>
            <input
              value={mrn}
              onChange={(e) => {
                setMrn(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="MR-YYMM-XXXXXX"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Rows</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {[20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-6">
            <label className="mb-1 block text-sm text-slate-700">Search</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="patient name, MR#, doctor"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-medium text-slate-800">
          Results
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2 font-medium">Date/Time</th>
                <th className="px-4 py-2 font-medium">Doctor</th>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-4 py-2 font-medium">MR #</th>
                <th className="px-4 py-2 font-medium">Print</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-2">{r.doctorName}</td>
                  <td className="px-4 py-2 font-medium">{r.patientName}</td>
                  <td className="px-4 py-2">{r.mrn}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handlePrint(r.id)}
                      className="text-sky-700 hover:underline"
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No prescriptions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <div>
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-slate-200 px-2 py-1 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function fetchPrintData(id: string) {
  const [detail, settings] = await Promise.all([
    hospitalApi.getPrescription(id) as any,
    hospitalApi.getSettings() as any,
  ]);
  const pres = detail?.prescription;
  let patient: any = {
    name: pres?.encounterId?.patientId?.fullName || "-",
    mrn: pres?.encounterId?.patientId?.mrn || "-",
  };
  try {
    if (patient?.mrn) {
      const resp: any = await labApi.getPatientByMrn(patient.mrn);
      const p = resp?.patient;
      if (p) {
        let ageTxt = "";
        try {
          if (p.age != null) ageTxt = String(p.age);
          else if (p.dob) {
            const dob = new Date(p.dob);
            if (!isNaN(dob.getTime()))
              ageTxt = String(
                Math.max(
                  0,
                  Math.floor((Date.now() - dob.getTime()) / 31557600000),
                ),
              );
          }
        } catch {}
        patient = {
          name: p.fullName || patient.name,
          mrn: p.mrn || patient.mrn,
          gender: p.gender || "-",
          fatherName: p.fatherName || "-",
          phone: p.phoneNormalized || "-",
          address: p.address || "-",
          age: ageTxt,
        };
      }
    }
  } catch {}

  let doctor: any = {
    name: pres?.encounterId?.doctorId?.name || "-",
    specialization: "",
    qualification: "",
    departmentName: "",
    phone: "",
  };
  try {
    const [drList, depRes] = await Promise.all([
      hospitalApi.listDoctors() as any,
      hospitalApi.listDepartments() as any,
    ]);
    const doctors: any[] = drList?.doctors || [];
    const depArray: any[] = (depRes?.departments || depRes || []) as any[];
    const drId = String(
      pres?.encounterId?.doctorId?._id || pres?.encounterId?.doctorId || "",
    );
    const d = doctors.find((x) => String(x._id || x.id) === drId);
    const deptName = d?.primaryDepartmentId
      ? depArray.find(
          (z: any) => String(z._id || z.id) === String(d.primaryDepartmentId),
        )?.name || ""
      : "";
    if (d)
      doctor = {
        name: d.name || doctor.name,
        specialization: d.specialization || "",
        qualification: d.qualification || "",
        departmentName: deptName || "",
        phone: d.phone || "",
      };
  } catch {}

  return {
    settings,
    doctor,
    patient,
    items: pres?.items || [],
    vitals: pres?.vitals,
    labTests: pres?.labTests || [],
    labNotes: pres?.labNotes,
    diagnosticTests: pres?.diagnosticTests || [],
    diagnosticNotes: pres?.diagnosticNotes,
    primaryComplaint: pres?.primaryComplaint || pres?.complaints,
    primaryComplaintHistory: pres?.primaryComplaintHistory,
    familyHistory: pres?.familyHistory,
    treatmentHistory: pres?.treatmentHistory,
    allergyHistory: pres?.allergyHistory,
    history: pres?.history,
    examFindings: pres?.examFindings,
    diagnosis: pres?.diagnosis,
    advice: pres?.advice,
    createdAt: pres?.createdAt,
  };
}
