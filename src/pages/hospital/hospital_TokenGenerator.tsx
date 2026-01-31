import { useEffect, useMemo, useRef, useState } from "react";
import { logAudit } from "../../utils/hospital_audit";
import { hospitalApi } from "../../utils/api";
import Hospital_TokenSlip, {
  type TokenSlipData,
} from "../../components/hospital/Hospital_TokenSlip";

export default function Hospital_TokenGenerator() {
  const [departments, setDepartments] = useState<
    Array<{ id: string; name: string; fee?: number }>
  >([]);
  const [doctors, setDoctors] = useState<
    Array<{ id: string; name: string; fee?: number }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const dRes = (await hospitalApi.listDepartments()) as any;
        const deps = (dRes.departments || dRes || []).map((d: any) => ({
          id: String(d._id || d.id),
          name: d.name,
          fee: Number(d.opdBaseFee ?? d.baseFee ?? d.fee ?? 0),
        }));
        const docRes = (await hospitalApi.listDoctors()) as any;
        const docs = (docRes.doctors || docRes || []).map((r: any) => ({
          id: String(r._id || r.id),
          name: r.name,
          fee: Number(r.opdBaseFee ?? r.baseFee ?? r.fee ?? 0),
        }));
        if (!cancelled) {
          setDepartments(deps);
          setDoctors(docs);
        }
      } catch {}
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);
  const [form, setForm] = useState({
    phone: "",
    mrNumber: "",
    patientName: "",
    age: "",
    gender: "",
    guardianRel: "",
    guardianName: "",
    cnic: "",
    address: "",
    doctor: "",
    departmentId: "",
    billingType: "Cash",
    consultationFee: "",
    discount: "0",
  });

  // Scheduling (OPD appointments)
  const [apptDate, setApptDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [schedules, setSchedules] = useState<
    Array<{
      _id: string;
      doctorId: string;
      dateIso: string;
      startTime: string;
      endTime: string;
      slotMinutes: number;
      fee?: number;
      followupFee?: number;
    }>
  >([]);
  const [scheduleId, setScheduleId] = useState("");

  const finalFee = useMemo(() => {
    const fee = parseFloat(form.consultationFee || "0");
    const discount = parseFloat(form.discount || "0");
    const f = Math.max(fee - discount, 0);
    return isNaN(f) ? 0 : f;
  }, [form.consultationFee, form.discount]);

  const update = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm({
      phone: "",
      mrNumber: "",
      patientName: "",
      age: "",
      gender: "",
      guardianRel: "",
      guardianName: "",
      cnic: "",
      address: "",
      doctor: "",
      departmentId: "",
      billingType: "Cash",
      consultationFee: "",
      discount: "0",
    });
  };

  const [showSlip, setShowSlip] = useState(false);
  const [slipData, setSlipData] = useState<TokenSlipData | null>(null);
  const [slipFbr, setSlipFbr] = useState<null | {
    fbrInvoiceNo: string;
    status?: string;
    qrCode?: string;
    mode?: string;
    error?: string;
  }>(null);

  // IPD inline admit state
  const isIPD = useMemo(() => {
    const dep = departments.find(
      (d) => String(d.id) === String(form.departmentId),
    );
    return (dep?.name || "").trim().toLowerCase() === "ipd";
  }, [departments, form.departmentId]);
  const [ipdBeds, setIpdBeds] = useState<
    Array<{ _id: string; label: string; charges?: number }>
  >([]);
  const [ipdBedId, setIpdBedId] = useState("");
  const [ipdDeposit, setIpdDeposit] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadBeds() {
      if (!isIPD) return;
      try {
        const res = (await hospitalApi.listBeds({
          status: "available",
        })) as any;
        if (!cancelled) setIpdBeds(res.beds || []);
      } catch {}
    }
    loadBeds();
    return () => {
      cancelled = true;
    };
  }, [isIPD]);

  // When a bed is selected, auto-fill Bed Charges from bed.charges
  useEffect(() => {
    if (!ipdBedId) {
      setIpdDeposit("");
      return;
    }
    const sel = ipdBeds.find((b) => String(b._id) === String(ipdBedId));
    if (sel && sel.charges != null) setIpdDeposit(String(sel.charges));
  }, [ipdBedId, ipdBeds]);

  // Auto-quote fee when department/doctor changes
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!form.departmentId) return;
      // No corporate or failed local compute: use backend quote (non-corporate)
      try {
        const res = (await hospitalApi.quoteOPDPrice({
          departmentId: form.departmentId,
          doctorId: form.doctor || undefined,
          visitType: undefined,
        })) as any;
        if (!cancelled) {
          const feeCandidate = [
            res?.fee,
            res?.feeResolved,
            res?.pricing?.feeResolved,
            res?.amount,
            res?.price,
            res?.data?.fee,
          ]
            .map((x: any) => Number(x))
            .find((n) => Number.isFinite(n) && n >= 0);
          if (feeCandidate != null)
            setForm((prev) => ({
              ...prev,
              consultationFee: String(feeCandidate),
            }));
        }
      } catch {}
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.departmentId, form.doctor]);

  // Load doctor schedules for selected date (non-IPD only)
  useEffect(() => {
    let cancelled = false;
    async function loadSchedules() {
      try {
        if (!form.doctor) {
          setSchedules([]);
          setScheduleId("");
          return;
        }
        const res = (await hospitalApi.listDoctorSchedules({
          doctorId: form.doctor,
          date: apptDate,
        })) as any;
        const items = (res?.schedules || []) as any[];
        if (cancelled) return;
        setSchedules(items);
        if (items.length === 1) setScheduleId(String(items[0]._id));
        else setScheduleId("");
      } catch {
        setSchedules([]);
        setScheduleId("");
      }
    }
    if (!isIPD) loadSchedules();
    return () => {
      cancelled = true;
    };
  }, [form.doctor, apptDate, isIPD]);

  const [confirmPatient, setConfirmPatient] = useState<null | {
    summary: string;
    patient: any;
    key: string;
  }>(null);
  const [focusAfterConfirm, setFocusAfterConfirm] = useState<
    null | "phone" | "name"
  >(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const skipLookupKeyRef = useRef<string | null>(null);
  const lastPromptKeyRef = useRef<string | null>(null);
  const [phoneMatches, setPhoneMatches] = useState<any[]>([]);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneHL, setPhoneHL] = useState(-1);
  const [toast, setToast] = useState<null | {
    type: "success" | "error";
    message: string;
  }>(null);
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 2500);
  };

  async function onMrnKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const mr = (form.mrNumber || "").trim();
    if (!mr) return;
    try {
      const r: any = await hospitalApi.searchPatients({ mrn: mr, limit: 5 });
      const list: any[] = Array.isArray(r?.patients) ? r.patients : [];
      // Prefer exact MRN match (case-insensitive), else take first
      const p =
        list.find(
          (x) =>
            String(x.mrn || "")
              .trim()
              .toLowerCase() === mr.toLowerCase(),
        ) || list[0];
      if (!p) {
        showToast("error", "No patient found for this MR number");
        return;
      }
      setForm((prev) => ({
        ...prev,
        patientName: p.fullName || prev.patientName,
        guardianName: p.fatherName || prev.guardianName,
        guardianRel: p.guardianRel || prev.guardianRel,
        address: p.address || prev.address,
        gender: p.gender || prev.gender,
        age: p.age || prev.age,
        mrNumber: p.mrn || mr,
        phone: p.phoneNormalized || prev.phone,
        cnic: p.cnicNormalized || p.cnic || prev.cnic,
      }));
      showToast("success", "Patient found and autofilled");
    } catch {
      showToast("error", "No patient found for this MR number");
    }
  }

  // Phone lookup and confirm

  async function lookupExistingByPhoneAndName(
    source: "phone" | "name" = "phone",
  ) {
    const digits = (form.phone || "").replace(/\D+/g, "");
    const nameEntered = (form.patientName || "").trim();
    if (!digits || !nameEntered) return;
    try {
      const norm = (s: string) =>
        String(s || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      const key = `${digits}|${norm(nameEntered)}`;
      if (skipLookupKeyRef.current === key || lastPromptKeyRef.current === key)
        return;
      const r: any = await hospitalApi.searchPatients({
        phone: digits,
        limit: 10,
      });
      const list: any[] = Array.isArray(r?.patients) ? r.patients : [];
      if (!list.length) return;
      const p = list.find((x) => norm(x.fullName) === norm(nameEntered));
      if (!p) return;
      const summary = [
        `Found existing patient. Apply details?`,
        `MRN: ${p.mrn || "-"}`,
        `Name: ${p.fullName || "-"}`,
        `Phone: ${p.phoneNormalized || digits}`,
        `Age: ${p.age ?? (form.age?.trim() || "-")}`,
        p.gender ? `Gender: ${p.gender}` : null,
        p.address ? `Address: ${p.address}` : null,
        p.fatherName ? `Guardian: ${p.fatherName}` : null,
        `Guardian Relation: ${p.guardianRel || form.guardianRel || "-"}`,
        p.cnicNormalized ? `CNIC: ${p.cnicNormalized}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      setTimeout(() => {
        setFocusAfterConfirm(source);
        lastPromptKeyRef.current = key;
        setConfirmPatient({ summary, patient: p, key });
      }, 0);
    } catch {}
  }

  async function onPhoneBlur() {
    const phone = form.phone?.trim();
    if (!phone) return;
    if ((form.patientName || "").trim()) {
      await lookupExistingByPhoneAndName("phone");
    }
  }

  function selectPhoneSuggestion(p: any) {
    try {
      setForm((prev) => ({
        ...prev,
        patientName: p.fullName || prev.patientName,
        guardianName: p.fatherName || prev.guardianName,
        guardianRel: p.guardianRel || prev.guardianRel,
        address: p.address || prev.address,
        gender: p.gender || prev.gender,
        age: p.age || prev.age,
        mrNumber: p.mrn || prev.mrNumber,
        phone: p.phoneNormalized || prev.phone,
        cnic: p.cnicNormalized || prev.cnic,
      }));
      const digits = String(p.phoneNormalized || "").replace(/\D+/g, "");
      const nm = String(p.fullName || "").trim().toLowerCase().replace(/\s+/g, " ");
      skipLookupKeyRef.current = `${digits}|${nm}`;
    } finally {
      setPhoneOpen(false);
      setPhoneMatches([]);
      setPhoneHL(-1);
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }

  function onPhoneBlurWrapped() {
    onPhoneBlur();
    setTimeout(() => setPhoneOpen(false), 100);
  }

  useEffect(() => {
    const digits = (form.phone || "").replace(/\D+/g, "");
    if (digits.length >= 6) {
      setPhoneOpen(true);
      const t = setTimeout(async () => {
        try {
          const r: any = await hospitalApi.searchPatients({ phone: digits, limit: 7 });
          setPhoneMatches(Array.isArray(r?.patients) ? r.patients : []);
        } catch {
          setPhoneMatches([]);
        }
      }, 200);
      return () => clearTimeout(t);
    } else {
      setPhoneMatches([]);
      setPhoneOpen(false);
      setPhoneHL(-1);
    }
  }, [form.phone]);

  const generateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    const selDoc = doctors.find((d) => String(d.id) === String(form.doctor));
    const selDept = departments.find(
      (d) => String(d.id) === String(form.departmentId),
    );
    if (!form.departmentId) {
      alert("Please select a department before generating a token");
      return;
    }

    const digitsOnly = (s: string) => (s || "").replace(/\D+/g, "");
    const phoneDigits = digitsOnly(form.phone);
    if (phoneDigits && phoneDigits.length !== 11) {
      alert("Phone number must be 11 digits (e.g. 03XXXXXXXXX)");
      return;
    }
    // CNIC can be any length/format; no strict 13-digit validation
    try {
      // Inline IPD admit flow: if department is IPD, require bed and admit immediately
      if (isIPD) {
        if (!ipdBedId) {
          alert("Please select a bed for IPD admission");
          return;
        }
        const payload: any = {
          departmentId: form.departmentId,
          doctorId: form.doctor || undefined,
          discount: Number(form.discount) || 0,
          billingType: form.billingType || "Cash",
          paymentRef: undefined,
        };

        // Patient demographics for saving/updating patient
        payload.patientName = form.patientName || undefined;
        payload.phone = form.phone || undefined;
        payload.gender = form.gender || undefined;
        payload.guardianRel = form.guardianRel || undefined;
        payload.guardianName = form.guardianName || undefined;
        payload.cnic = form.cnic || undefined;
        payload.address = form.address || undefined;
        payload.age = form.age || undefined;
        if (form.mrNumber) payload.mrn = form.mrNumber;
        else if (form.patientName) payload.patientName = form.patientName;
        const rawDeposit = String(ipdDeposit || "").trim();
        const cleanedDeposit = rawDeposit.replace(/[^0-9.]/g, "");
        const depAmt = cleanedDeposit ? parseFloat(cleanedDeposit) : NaN;
        const res = (await hospitalApi.createOpdToken({
          ...payload,
          overrideFee: isNaN(depAmt) ? undefined : depAmt,
        })) as any;
        const tokenId = String(res?.token?._id || "");
        if (!tokenId) throw new Error("Failed to create token for admission");
        await hospitalApi.admitFromOpdToken({
          tokenId,
          bedId: ipdBedId,
          deposit: isNaN(depAmt) ? undefined : depAmt,
        });
        logAudit("token_generate", `ipd_admit dept=IPD, bed=${ipdBedId}`);
        // Show print slip with full details
        const slipMrn =
          res?.token?.patientId?.mrn || res?.token?.mrn || form.mrNumber || "";
        const slip: TokenSlipData = {
          tokenNo: res?.token?.tokenNo || "N/A",
          departmentName:
            departments.find((d) => String(d.id) === String(form.departmentId))
              ?.name || "-",
          doctorName:
            doctors.find((d) => String(d.id) === String(form.doctor))?.name ||
            "-",
          patientName: res?.token?.patientName || form.patientName || "-",
          phone: form.phone || "",
          mrn: slipMrn,
          age: form.age || "",
          gender: form.gender || "",
          guardianRel: form.guardianRel || "",
          guardianName: form.guardianName || "",
          cnic: form.cnic || "",
          address: form.address || "",
          amount: isNaN(depAmt) ? 0 : depAmt,
          discount: 0,
          payable: isNaN(depAmt) ? 0 : depAmt,
          createdAt: res?.token?.createdAt,
        };
        setSlipData(slip);
        try {
          setSlipFbr(res?.fbr || null);
        } catch {
          setSlipFbr(null);
        }
        setShowSlip(true);
        reset();
        setIpdBedId("");
        setIpdDeposit("");
        return;
      }
      const payload: any = {
        departmentId: form.departmentId,
        doctorId: form.doctor || undefined,
        discount: Number(form.discount) || 0,
        billingType: form.billingType || "Cash",
        paymentRef: undefined,
      };

      // Patient demographics for saving/updating patient
      payload.patientName = form.patientName || undefined;
      payload.phone = form.phone || undefined;
      payload.gender = form.gender || undefined;
      payload.guardianRel = form.guardianRel || undefined;
      payload.guardianName = form.guardianName || undefined;
      payload.cnic = form.cnic || undefined;
      payload.address = form.address || undefined;
      payload.age = form.age || undefined;
      // Attach scheduleId to auto-assign next free slot
      if (!isIPD && scheduleId) (payload as any).scheduleId = scheduleId;
      if (form.mrNumber) payload.mrn = form.mrNumber;
      else if (form.patientName) payload.patientName = form.patientName;

      const res = (await hospitalApi.createOpdToken(payload)) as any;
      const tokenNo = res?.token?.tokenNo || "N/A";
      const slipMrn =
        res?.token?.patientId?.mrn || res?.token?.mrn || form.mrNumber || "";
      // Prepare slip and show (OPD)
      const slip: TokenSlipData = {
        tokenNo,
        departmentName: selDept?.name || "-",
        doctorName: selDoc?.name || "-",
        patientName: res?.token?.patientName || form.patientName || "-",
        phone: form.phone || "",
        mrn: slipMrn,
        age: form.age || "",
        gender: form.gender || "",
        guardianRel: form.guardianRel || "",
        guardianName: form.guardianName || "",
        cnic: form.cnic || "",
        address: form.address || "",
        amount: Number(
          (res?.pricing?.feeResolved ?? res?.fee ?? form.consultationFee) || 0,
        ),
        discount: Number(res?.pricing?.discount ?? 0),
        payable: Number(res?.pricing?.finalFee ?? finalFee),
        createdAt: res?.token?.createdAt,
      };
      setSlipData(slip);
      try {
        setSlipFbr(res?.fbr || null);
      } catch {
        setSlipFbr(null);
      }
      setShowSlip(true);
      logAudit(
        "token_generate",
        `patient=${form.patientName || "N/A"}, dept=${form.departmentId}, doctor=${selDoc?.name || "N/A"}, fee=${res?.pricing?.finalFee ?? finalFee}`,
      );
    } catch (err: any) {
      alert(err?.message || "Failed to generate token");
    }
    reset();
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-800">Token Generator</h2>
      <form onSubmit={generateToken} className="mt-6 space-y-8">
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Patient Information
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Phone
                </label>
                <div className="relative">
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="Enter 11-digit phone"
                  value={form.phone}
                  onChange={(e) => {
                    update("phone", e.target.value);
                    skipLookupKeyRef.current = null;
                    lastPromptKeyRef.current = null;
                    const d = e.target.value.replace(/\D+/g, "");
                    if (d.length < 6) {
                      setPhoneOpen(false);
                      setPhoneMatches([]);
                      setPhoneHL(-1);
                    }
                  }}
                  onBlur={onPhoneBlurWrapped}
                  onKeyDown={(e) => {
                    if (!phoneOpen || !phoneMatches.length) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setPhoneHL((i) => Math.min(phoneMatches.length - 1, i + 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setPhoneHL((i) => Math.max(-1, i - 1));
                    } else if (e.key === "Enter") {
                      if (phoneHL >= 0 && phoneHL < phoneMatches.length) {
                        e.preventDefault();
                        selectPhoneSuggestion(phoneMatches[phoneHL]);
                      }
                    } else if (e.key === "Escape") {
                      setPhoneOpen(false);
                    }
                  }}
                  ref={phoneRef}
                />
                {phoneOpen && phoneMatches.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow">
                    {phoneMatches.map((p, idx) => (
                      <div
                        key={p._id || idx}
                        className={`cursor-pointer px-3 py-2 text-sm ${idx === phoneHL ? "bg-violet-50" : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectPhoneSuggestion(p);
                        }}
                        onMouseEnter={() => setPhoneHL(idx)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 truncate font-medium text-slate-800">{p.fullName || "-"}</div>
                          <div className="shrink-0 text-xs text-slate-500">{p.mrn || "-"}</div>
                        </div>
                        <div className="text-xs text-slate-500">
                          {(p.phoneNormalized || "")} {p.address ? `• ${p.address}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Patient Name
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="Full Name"
                  value={form.patientName}
                  onChange={(e) => {
                    update("patientName", e.target.value);
                    skipLookupKeyRef.current = null;
                    lastPromptKeyRef.current = null;
                  }}
                  onBlur={() => lookupExistingByPhoneAndName("name")}
                  ref={nameRef}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Search by MR Number
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="Enter MR# (e.g., MR-15)"
                  value={form.mrNumber}
                  onChange={(e) => update("mrNumber", e.target.value)}
                  onKeyDown={onMrnKeyDown}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Age
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="e.g., 25"
                  value={form.age}
                  onChange={(e) => update("age", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Gender
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  value={form.gender}
                  onChange={(e) => update("gender", e.target.value)}
                >
                  <option value="">Select gender</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Guardian
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  value={form.guardianRel}
                  onChange={(e) => update("guardianRel", e.target.value)}
                >
                  <option value="">S/O or D/O</option>
                  <option value="S/O">S/O</option>
                  <option value="D/O">D/O</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Guardian Name
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="Father/Guardian Name"
                  value={form.guardianName}
                  onChange={(e) => update("guardianName", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  CNIC
                </label>
                <input
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  placeholder="CNIC"
                  value={form.cnic}
                  onChange={(e) => update("cnic", e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Address
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  rows={3}
                  placeholder="Residential Address"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Visit & Billing
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Doctor
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  value={form.doctor}
                  onChange={(e) => update("doctor", e.target.value)}
                >
                  <option value="">Select doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Doctor selection is optional for IPD.
                </p>
              </div>
              {!isIPD && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Appointment Date
                    </label>
                    <input
                      type="date"
                      value={apptDate}
                      onChange={(e) => setApptDate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Doctor Schedule
                    </label>
                    <select
                      value={scheduleId}
                      onChange={(e) => setScheduleId(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                    >
                      <option value="">
                        {schedules.length
                          ? "Select schedule"
                          : "No schedules found"}
                      </option>
                      {schedules.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.startTime} - {s.endTime} • {s.slotMinutes} min
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">
                      Auto-assigns next free slot in selected schedule.
                    </p>
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Department
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  value={form.departmentId}
                  onChange={(e) => update("departmentId", e.target.value)}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Billing Type
                </label>
                <select
                  className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                  value={form.billingType}
                  onChange={(e) => update("billingType", e.target.value)}
                >
                  <option>Cash</option>
                  <option>Card</option>
                </select>
              </div>

              {isIPD && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Select Bed
                    </label>
                    <select
                      value={ipdBedId}
                      onChange={(e) => {
                        setIpdBedId(e.target.value);
                        const opt = (e.target as HTMLSelectElement)
                          .selectedOptions?.[0] as any;
                        const chargesAttr = opt?.getAttribute?.("data-charges");
                        if (chargesAttr !== null && chargesAttr !== undefined)
                          setIpdDeposit(chargesAttr);
                      }}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                    >
                      <option value="">Available beds</option>
                      {ipdBeds.map((b) => (
                        <option
                          key={b._id}
                          value={String(b._id)}
                          data-charges={b.charges ?? ""}
                        >
                          {b.label}
                          {b.charges != null ? ` - (Rs. ${b.charges})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Bed Charges
                    </label>
                    <input
                      value={ipdDeposit}
                      onChange={(e) => setIpdDeposit(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                      placeholder="e.g., Rs. 1000"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Fee Details
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Consultation Fee
              </label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                placeholder="Fee"
                value={form.consultationFee}
                onChange={(e) => update("consultationFee", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Discount
              </label>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                placeholder="0"
                value={form.discount}
                onChange={(e) => update("discount", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Final Fee
              </label>
              <div className="flex h-10 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">
                Rs.{" "}
                {isIPD
                  ? (Number(ipdDeposit || "0") || 0).toFixed(2)
                  : finalFee.toFixed(2)}
              </div>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset Form
          </button>
          <button
            type="submit"
            className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800"
          >
            Generate Token
          </button>
        </div>
      </form>
      {showSlip && slipData && (
        <Hospital_TokenSlip
          open={showSlip}
          onClose={() => setShowSlip(false)}
          data={slipData}
          fbr={slipFbr || undefined}
          autoPrint={false}
        />
      )}

      {confirmPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">
              Confirm Patient
            </div>
            <div className="px-5 py-4 text-sm whitespace-pre-wrap text-slate-700">
              {confirmPatient.summary}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={() => {
                  if (confirmPatient)
                    skipLookupKeyRef.current = confirmPatient.key;
                  setConfirmPatient(null);
                  setTimeout(() => {
                    if (focusAfterConfirm === "phone")
                      phoneRef.current?.focus();
                    else if (focusAfterConfirm === "name")
                      nameRef.current?.focus();
                    setFocusAfterConfirm(null);
                  }, 0);
                }}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const p = confirmPatient.patient;
                  try {
                    setForm((prev) => ({
                      ...prev,
                      patientName: p.fullName || prev.patientName,
                      guardianName: p.fatherName || prev.guardianName,
                      guardianRel: p.guardianRel || prev.guardianRel,
                      address: p.address || prev.address,
                      gender: p.gender || prev.gender,
                      age: p.age || prev.age,
                      mrNumber: p.mrn || prev.mrNumber,
                      phone: p.phoneNormalized || prev.phone,
                      cnic: p.cnicNormalized || prev.cnic,
                    }));
                  } finally {
                    if (confirmPatient)
                      skipLookupKeyRef.current = confirmPatient.key;
                    setConfirmPatient(null);
                  }
                }}
                className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 z-50 rounded-md px-4 py-2 text-sm shadow-lg ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
