import { Request, Response } from "express";
import { z } from "zod";
import { FinanceJournal } from "../models/FinanceJournal";
import { HospitalExpense } from "../models/Expense";
import {
  createDoctorPayout,
  manualDoctorEarning,
  computeDoctorBalance,
  reverseJournalById,
} from "./finance_ledger";

const manualDoctorEarningSchema = z.object({
  doctorId: z.string().min(1),
  departmentId: z.string().optional(),
  amount: z.number().positive(),
  revenueAccount: z
    .enum(["OPD_REVENUE", "PROCEDURE_REVENUE", "IPD_REVENUE"])
    .optional(),
  paidMethod: z.enum(["Cash", "Bank", "AR"]).optional(),
  memo: z.string().optional(),
  sharePercent: z.number().min(0).max(100).optional(),
  patientName: z.string().optional(),
  mrn: z.string().optional(),
});

const doctorPayoutSchema = z.object({
  doctorId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["Cash", "Bank"]).default("Cash"),
  memo: z.string().optional(),
});

export async function postManualDoctorEarning(req: Request, res: Response) {
  const data = manualDoctorEarningSchema.parse(req.body);
  const j = await manualDoctorEarning(data);
  res.status(201).json({ journal: j });
}

export async function reverseJournal(req: Request, res: Response) {
  const id = String(req.params.id);
  const memo = String((req.body as any)?.memo || "");
  const r = await reverseJournalById(id, memo);
  if (!r) return res.status(404).json({ error: "Journal not found" });
  res.json({ reversed: r });
}

export async function listDoctorEarnings(req: Request, res: Response) {
  const doctorId = (req.query as any)?.doctorId
    ? String((req.query as any).doctorId)
    : undefined;
  const from = String((req.query as any)?.from || "");
  const to = String((req.query as any)?.to || "");
  const M = require("mongoose");
  const matchDate = from && to ? { dateIso: { $gte: from, $lte: to } } : {};
  const matchDoctor = doctorId
    ? { "lines.tags.doctorId": new M.Types.ObjectId(doctorId) }
    : {};
  const rows = await FinanceJournal.aggregate([
    {
      $match: {
        ...matchDate,
        refType: { $in: ["opd_token", "manual_doctor_earning"] },
      },
    },
    { $addFields: { allLines: "$lines" } },
    { $unwind: "$lines" },
    {
      $match: {
        "lines.account": "DOCTOR_PAYABLE",
        ...(doctorId ? matchDoctor : {}),
      },
    },
    {
      $lookup: {
        from: "hospital_finance_journals",
        let: { origId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$refId", { $toString: "$$origId" }] } } },
        ],
        as: "reversals",
      },
    },
    { $addFields: { _revCount: { $size: "$reversals" } } },
    { $match: { _revCount: { $eq: 0 } } },
    { $addFields: { _tidStr: { $toString: "$lines.tags.tokenId" } } },
    {
      $lookup: {
        from: "hospital_tokens",
        let: { tidStr: "$_tidStr" },
        pipeline: [
          { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$tidStr"] } } },
          { $project: { patientName: 1, mrn: 1, tokenNo: 1 } },
        ],
        as: "tok",
      },
    },
    { $addFields: { token: { $arrayElemAt: ["$tok", 0] } } },
    {
      $addFields: {
        revenueLine: {
          $arrayElemAt: [
            {
              $filter: {
                input: "$allLines",
                as: "l",
                cond: {
                  $in: [
                    "$$l.account",
                    ["OPD_REVENUE", "IPD_REVENUE", "PROCEDURE_REVENUE"],
                  ],
                },
              },
            },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        dateIso: 1,
        refType: 1,
        refId: 1,
        memo: 1,
        line: "$lines",
        revenueAccount: "$revenueLine.account",
        patientName: {
          $ifNull: ["$token.patientName", "$lines.tags.patientName"],
        },
        mrn: { $ifNull: ["$token.mrn", "$lines.tags.mrn"] },
        tokenNo: "$token.tokenNo",
      },
    },
    { $sort: { dateIso: -1, _id: -1 } },
    { $limit: 500 },
  ]);
  const items = rows.map((r: any) => ({
    id: String(r._id),
    dateIso: r.dateIso,
    doctorId: r.line?.tags?.doctorId ? String(r.line.tags.doctorId) : undefined,
    departmentId: r.line?.tags?.departmentId
      ? String(r.line.tags.departmentId)
      : undefined,
    tokenId: r.line?.tags?.tokenId ? String(r.line.tags.tokenId) : undefined,
    type:
      r.refType === "opd_token"
        ? "OPD"
        : r.revenueAccount === "PROCEDURE_REVENUE"
          ? "Procedure"
          : r.revenueAccount === "IPD_REVENUE"
            ? "IPD"
            : "OPD",
    amount: Number(r.line.credit || 0),
    memo: r.memo,
    patientName: r.patientName,
    mrn: r.mrn,
    tokenNo: r.tokenNo,
  }));
  res.json({ earnings: items });
}

export async function postDoctorPayout(req: Request, res: Response) {
  const data = doctorPayoutSchema.parse(req.body);
  const j = await createDoctorPayout(
    data.doctorId,
    data.amount,
    data.method,
    data.memo,
  );
  res.status(201).json({ journal: j });
}

export async function getDoctorBalance(req: Request, res: Response) {
  const id = String(req.params.id);
  const balance = await computeDoctorBalance(id);
  res.json({ doctorId: id, payable: balance });
}

export async function listDoctorPayouts(req: Request, res: Response) {
  const id = String(req.params.id);
  const limit = Math.min(
    parseInt(String((req.query as any)?.limit || "20")) || 20,
    100,
  );
  const rows = await FinanceJournal.find({
    refType: "doctor_payout",
    refId: id,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const items = rows.map((j: any) => {
    const cash = (j.lines || [])
      .filter((l: any) => l.account === "CASH" || l.account === "BANK")
      .reduce((s: number, l: any) => s + (l.credit || 0), 0);
    const amount =
      cash ||
      (j.lines || [])
        .filter((l: any) => l.account === "DOCTOR_PAYABLE")
        .reduce((s: number, l: any) => s + (l.debit || 0), 0);
    return {
      id: String(j._id),
      refId: j.refId,
      dateIso: j.dateIso,
      memo: j.memo,
      amount,
    };
  });
  res.json({ payouts: items });
}

export async function doctorAccruals(req: Request, res: Response) {
  const id = String(req.params.id);
  const from = String((req.query as any)?.from || "");
  const to = String((req.query as any)?.to || "");
  if (!from || !to)
    return res.status(400).json({ error: "from and to (YYYY-MM-DD) required" });
  const rows = await FinanceJournal.aggregate([
    { $match: { dateIso: { $gte: from, $lte: to } } },
    { $unwind: "$lines" },
    {
      $match: {
        "lines.account": "DOCTOR_PAYABLE",
        "lines.tags.doctorId": { $exists: true },
      },
    },
    {
      $group: {
        _id: "$lines.tags.doctorId",
        accruals: { $sum: { $ifNull: ["$lines.credit", 0] } },
        debits: { $sum: { $ifNull: ["$lines.debit", 0] } },
      },
    },
    { $project: { _id: 0, accruals: 1, debits: 1 } },
  ]);
  const accruals = Number(rows?.[0]?.accruals || 0);
  const debits = Number(rows?.[0]?.debits || 0);
  const suggested = Math.max(accruals - debits, 0);
  res.json({ doctorId: id, from, to, accruals, debits, suggested });
}

const ledgerQuerySchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

function dateRange(from: string, to: string) {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const out: string[] = [];
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return out;
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function weekStartIso(dateIso: string) {
  const d = new Date(dateIso);
  if (isNaN(d.getTime())) return dateIso;
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // to Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function ledgerDaily(req: Request, res: Response) {
  const q = ledgerQuerySchema.safeParse(req.query);
  if (!q.success)
    return res.status(400).json({ error: "from and to (YYYY-MM-DD) required" });
  const { from, to } = q.data;

  const accounts = [
    "OPD_REVENUE",
    "IPD_REVENUE",
    "PROCEDURE_REVENUE",
    "CASH",
    "BANK",
  ];
  const journalAgg = await FinanceJournal.aggregate([
    { $match: { dateIso: { $gte: from, $lte: to } } },
    { $unwind: "$lines" },
    { $match: { "lines.account": { $in: accounts } } },
    {
      $group: {
        _id: { dateIso: "$dateIso", account: "$lines.account" },
        debit: { $sum: { $ifNull: ["$lines.debit", 0] } },
        credit: { $sum: { $ifNull: ["$lines.credit", 0] } },
      },
    },
  ]);

  const payoutAgg = await FinanceJournal.aggregate([
    { $match: { dateIso: { $gte: from, $lte: to }, refType: "doctor_payout" } },
    { $unwind: "$lines" },
    { $match: { "lines.account": "DOCTOR_PAYABLE" } },
    {
      $group: {
        _id: "$dateIso",
        amount: { $sum: { $ifNull: ["$lines.debit", 0] } },
      },
    },
  ]);

  const expenseAgg = await HospitalExpense.aggregate([
    { $match: { dateIso: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: "$dateIso",
        amount: { $sum: { $ifNull: ["$amount", 0] } },
      },
    },
  ]);

  const byDate: Record<string, any> = {};
  for (const di of dateRange(from, to)) {
    byDate[di] = {
      dateIso: di,
      opdRevenue: 0,
      ipdRevenue: 0,
      procedureRevenue: 0,
      cashIn: 0,
      cashOut: 0,
      bankIn: 0,
      bankOut: 0,
      doctorPayouts: 0,
      expenses: 0,
    };
  }

  for (const r of journalAgg as any[]) {
    const di = String(r?._id?.dateIso || "");
    const acc = String(r?._id?.account || "");
    if (!byDate[di]) continue;
    if (acc === "OPD_REVENUE") byDate[di].opdRevenue = Number(r.credit || 0);
    else if (acc === "IPD_REVENUE")
      byDate[di].ipdRevenue = Number(r.credit || 0);
    else if (acc === "PROCEDURE_REVENUE")
      byDate[di].procedureRevenue = Number(r.credit || 0);
    else if (acc === "CASH") {
      byDate[di].cashIn = Number(r.debit || 0);
      byDate[di].cashOut = Number(r.credit || 0);
    } else if (acc === "BANK") {
      byDate[di].bankIn = Number(r.debit || 0);
      byDate[di].bankOut = Number(r.credit || 0);
    }
  }

  for (const r of payoutAgg as any[]) {
    const di = String(r?._id || "");
    if (!byDate[di]) continue;
    byDate[di].doctorPayouts = Number(r.amount || 0);
  }

  for (const r of expenseAgg as any[]) {
    const di = String(r?._id || "");
    if (!byDate[di]) continue;
    byDate[di].expenses = Number(r.amount || 0);
  }

  const rows = Object.values(byDate).map((d: any) => {
    const totalRevenue =
      Number(d.opdRevenue || 0) +
      Number(d.ipdRevenue || 0) +
      Number(d.procedureRevenue || 0);
    const netCash =
      Number(d.cashIn || 0) -
      Number(d.cashOut || 0) +
      (Number(d.bankIn || 0) - Number(d.bankOut || 0));
    return { ...d, totalRevenue, netCash };
  });
  const totals = rows.reduce(
    (s: any, r: any) => {
      s.totalRevenue += Number(r.totalRevenue || 0);
      s.expenses += Number(r.expenses || 0);
      s.doctorPayouts += Number(r.doctorPayouts || 0);
      s.cashIn += Number(r.cashIn || 0);
      s.cashOut += Number(r.cashOut || 0);
      s.bankIn += Number(r.bankIn || 0);
      s.bankOut += Number(r.bankOut || 0);
      s.netCash += Number(r.netCash || 0);
      return s;
    },
    {
      totalRevenue: 0,
      expenses: 0,
      doctorPayouts: 0,
      cashIn: 0,
      cashOut: 0,
      bankIn: 0,
      bankOut: 0,
      netCash: 0,
    },
  );

  res.json({ from, to, rows, totals });
}

export async function ledgerWeekly(req: Request, res: Response) {
  const q = ledgerQuerySchema.safeParse(req.query);
  if (!q.success)
    return res.status(400).json({ error: "from and to (YYYY-MM-DD) required" });
  const { from, to } = q.data;

  // Build weekly view from daily data for consistent numbers
  const mockReq: any = { query: { from, to } };
  const daily = await new Promise<any>((resolve, reject) => {
    const mockRes: any = {
      json: (x: any) => resolve(x),
      status: (_: any) => mockRes,
    };
    ledgerDaily(mockReq as Request, mockRes as Response).catch(reject);
  });
  const weeks: Record<string, any> = {};
  for (const r of (daily?.rows || []) as any[]) {
    const wk = weekStartIso(String(r.dateIso || ""));
    if (!weeks[wk])
      weeks[wk] = {
        weekStart: wk,
        opdRevenue: 0,
        ipdRevenue: 0,
        procedureRevenue: 0,
        totalRevenue: 0,
        expenses: 0,
        doctorPayouts: 0,
        cashIn: 0,
        cashOut: 0,
        bankIn: 0,
        bankOut: 0,
        netCash: 0,
      };
    const w = weeks[wk];
    w.opdRevenue += Number(r.opdRevenue || 0);
    w.ipdRevenue += Number(r.ipdRevenue || 0);
    w.procedureRevenue += Number(r.procedureRevenue || 0);
    w.totalRevenue += Number(r.totalRevenue || 0);
    w.expenses += Number(r.expenses || 0);
    w.doctorPayouts += Number(r.doctorPayouts || 0);
    w.cashIn += Number(r.cashIn || 0);
    w.cashOut += Number(r.cashOut || 0);
    w.bankIn += Number(r.bankIn || 0);
    w.bankOut += Number(r.bankOut || 0);
    w.netCash += Number(r.netCash || 0);
  }
  const rows = Object.values(weeks).sort((a: any, b: any) =>
    String(a.weekStart).localeCompare(String(b.weekStart)),
  );
  const totals = rows.reduce(
    (s: any, r: any) => {
      s.totalRevenue += Number(r.totalRevenue || 0);
      s.expenses += Number(r.expenses || 0);
      s.doctorPayouts += Number(r.doctorPayouts || 0);
      s.cashIn += Number(r.cashIn || 0);
      s.cashOut += Number(r.cashOut || 0);
      s.bankIn += Number(r.bankIn || 0);
      s.bankOut += Number(r.bankOut || 0);
      s.netCash += Number(r.netCash || 0);
      return s;
    },
    {
      totalRevenue: 0,
      expenses: 0,
      doctorPayouts: 0,
      cashIn: 0,
      cashOut: 0,
      bankIn: 0,
      bankOut: 0,
      netCash: 0,
    },
  );
  res.json({ from, to, rows, totals });
}
