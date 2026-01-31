import http from 'http'
import { FbrSettings } from '../models/FbrSettings'
import { MockFbrLog } from '../models/MockFbrLog'
import { env } from '../../../config/env'

function extractErrorMessages(input: any): string {
  try {
    const visited = new WeakSet<object>()
    const out: string[] = []

    const push = (v: any) => {
      const s = String(v ?? '').trim()
      if (!s) return
      if (out.includes(s)) return
      out.push(s)
    }

    const walk = (v: any, keyHint?: string) => {
      if (v == null) return

      if (typeof v === 'string') {
        if (!keyHint || /error|message|detail|description|reason|remarks/i.test(keyHint)) {
          push(v)
        }
        return
      }

      if (typeof v === 'number' || typeof v === 'boolean') return

      if (Array.isArray(v)) {
        for (const item of v) walk(item, keyHint)
        return
      }

      if (typeof v === 'object') {
        if (visited.has(v)) return
        visited.add(v)

        for (const [k, val] of Object.entries(v)) {
          if (/error|errors|message|messages|detail|details|description|reason|remarks|validation/i.test(k)) {
            walk(val, k)
          } else if (typeof val === 'object') {
            walk(val, k)
          }
        }
      }
    }

    walk(input)
    return out.slice(0, 8).join(' | ')
  } catch {
    return ''
  }
}

type InvoiceType = 'OPD' | 'PHARMACY' | 'LAB' | 'IPD'
type PostArgs = { module: string; invoiceType: InvoiceType; refId: string; amount: number; payload?: any }
type PostResult = { fbrInvoiceNo: string; status: 'SUCCESS' | 'FAILED'; qrCode?: string; mode: 'SANDBOX' | 'PRODUCTION' | 'MOCK'; error?: string; rawResponse?: string }

function todayKey() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${mm}${dd}`
}

async function logMock(args: PostArgs, mode: 'SANDBOX' | 'MOCK' | 'PRODUCTION', status: 'SUCCESS' | 'FAILED', extra?: Partial<PostResult>) {
  const fbrInvoiceNo = extra?.fbrInvoiceNo || `${args.invoiceType}-${todayKey()}-${Math.floor(Math.random() * 900000 + 100000)}`
  const doc: any = await (MockFbrLog as any).create({
    module: args.module,
    refId: args.refId,
    dateKey: todayKey(),
    fbrInvoiceNo,
    status,
    qrCode: extra?.qrCode || fbrInvoiceNo,
    fbrStatus: status,
    fbrMode: mode,
    invoiceType: args.invoiceType,
    amount: Number(args.amount || 0),
    error: extra?.error || '',
    rawResponse: extra?.rawResponse || '',
    payload: args.payload || {},
  })
  return { fbrInvoiceNo: doc.fbrInvoiceNo, status: doc.status, qrCode: doc.qrCode, mode, error: doc.error } as PostResult
}

export async function postFbrInvoice(args: PostArgs): Promise<PostResult | null> {
  const s: any = await FbrSettings.findOne({ hospitalId: '', branchCode: '' }).lean() || {}
  // DB setting takes precedence over ENV
  const isEnabled = s.isEnabled !== undefined ? s.isEnabled : (env.FBR_ENABLED || false)
  if (!isEnabled) return null
  const mode = s.environment === 'production' || env.FBR_ENVIRONMENT === 'production' ? 'MOCK' : 'SANDBOX'
  // If explicitly production in DB, respect that mode for mock logging
  if (s.environment === 'production') return await logMock(args, 'MOCK', 'SUCCESS')

  return await logMock(args, mode, 'SUCCESS')
}

function httpPost(url: string, body: any, headers?: Record<string, string>): Promise<{ statusCode: number; text: string }> {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url)
      const data = typeof body === 'string' ? body : JSON.stringify(body || {})
      const req = http.request({
        hostname: u.hostname,
        port: Number(u.port || 80),
        path: u.pathname + (u.search || ''),
        method: 'POST',
        timeout: 30000, // Increased to 30s for production latency
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...(headers || {}) },
      }, (res) => {
        let chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))))
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, text: Buffer.concat(chunks).toString('utf8') }))
      })
      req.on('timeout', () => { try { req.destroy(new Error('timeout')) } catch { } })
      req.on('error', reject)
      req.write(data)
      req.end()
    } catch (e) { reject(e) }
  })
}

function parsePossibleResponse(t: string) {
  try { const j = JSON.parse(t); return j } catch { }
  const mInv = t.match(/<\s*(InvoiceNumber|InvoiceNo)\s*>\s*([^<]+)\s*<\s*\/\1\s*>/i)
  const mQr = t.match(/<\s*(QRCode|QR|QrCode|qrCode)\s*>\s*([^<]+)\s*<\s*\/\1\s*>/i)
  const mMsg = t.match(/<\s*(Message|message|Detail|detail)\s*>\s*([^<]+)\s*<\s*\/\1\s*>/)
  const out: any = {}
  if (mInv) out.invoiceNumber = mInv[2].trim()
  if (mQr) out.qrCode = mQr[2].trim()
  if (mMsg) out.message = mMsg[2].trim()
  return out
}

export async function postFbrInvoiceViaSDC(args: PostArgs): Promise<PostResult | null> {
  const s: any = await FbrSettings.findOne({ hospitalId: '', branchCode: '' }).lean() || {}

  // Use centralized env config, prioritizing DB settings
  const isEnabled = s.isEnabled !== undefined ? s.isEnabled : (env.FBR_ENABLED || false)
  // Environment: DB has priority over ENV. If DB says 'production', it is production.
  const envMode = s.environment || env.FBR_ENVIRONMENT || 'sandbox'

  if (!isEnabled) return null

  if (envMode !== 'production') {
    return await logMock(args, 'SANDBOX', 'SUCCESS')
  }

  const posId = env.FBR_POS_ID || s.productionPosId || s.posId || ''
  const code = env.FBR_CODE || s.productionCode || ''
  if (!posId) {
    return await logMock(args, 'PRODUCTION', 'FAILED', { error: 'Missing POS credentials (POS ID)' })
  }

  const payload = args.payload || {}
  const invoiceNo = `${env.FBR_USIN_PREFIX || s.invoicePrefix || 'HSP'}-${todayKey()}-${Math.floor(Math.random() * 900000 + 100000)}`

  // FBR Type Mappings
  const INVOICE_TYPE_INT = 1; // 1=Standard Invoice
  const PAYMENT_MODE_CASH = 1; // 1=Cash

  const net = Number(payload.net ?? args.amount ?? 0);
  const subtotal = Number(payload.subtotal ?? args.amount ?? 0);
  const discount = Number(payload.discount ?? payload.discountPct ?? 0);
  const totalQty = Array.isArray(payload.lines) && payload.lines.length > 0
    ? payload.lines.reduce((acc: number, l: any) => acc + Number(l.qty || l.quantity || 1), 0)
    : 1;

  // Final FBR Payload (Standard PascalCase)
  const body: any = {
    posId: Number(posId),
    code: String(code),
    USIN: invoiceNo,
    DateTime: new Date().toISOString(),
    InvoiceType: INVOICE_TYPE_INT,

    // Totals
    TotalBillAmount: net,
    TotalSaleValue: subtotal,
    TotalTaxCharged: 0,
    Discount: discount,
    TotalQuantity: totalQty,
    FurtherTax: 0,
    PaymentMode: PAYMENT_MODE_CASH,

    // Items List
    Items: (Array.isArray(payload.lines) && payload.lines.length > 0) ? payload.lines.map((l: any) => ({
      ItemCode: String(l.itemCode || l.code || '000000'),
      ItemName: String(l.name || l.title || 'Item'),
      Quantity: Number(l.qty || l.quantity || 1),
      PCTCode: String(l.pctCode || '12345678'),
      TaxRate: Number(l.taxRate || 0),
      SaleValue: Number(l.unitPrice || l.price || 0) * Number(l.qty || l.quantity || 1),
      TotalAmount: Number(l.net || (Number(l.unitPrice || l.price || 0) * Number(l.qty || l.quantity || 1))),
      TaxCharged: 0,
      Discount: 0,
      FurtherTax: 0,
      InvoiceType: INVOICE_TYPE_INT,
      RefUSIN: ''
    })) : [{
      ItemCode: '000000',
      ItemName: 'Service/Consultation',
      Quantity: 1,
      PCTCode: '12345678',
      TaxRate: 0,
      SaleValue: net,
      TotalAmount: net,
      TaxCharged: 0,
      Discount: 0,
      FurtherTax: 0,
      InvoiceType: INVOICE_TYPE_INT,
      RefUSIN: ''
    }],

    // Buyer Info
    BuyerName: payload.patientName || payload.patient?.name || 'Walk-in Customer',
    BuyerNTN: '',
    BuyerCNIC: payload.cnic || payload.patient?.cnic || '99999-9999999-9',
    BuyerPhoneNumber: payload.phone || payload.patient?.phone || '',
  }

  const url = `${env.FBR_IMS_URL || 'http://localhost:8524'}/api/IMSFiscal/GetInvoiceNumberByModel`
  console.log(`[FBR] Attempting production sync: ${url}`, { posId, USIN: invoiceNo })

  try {
    const r = await httpPost(url, body, {
      'X-POS-ID': String(posId),
      'X-POS-CODE': String(code),
      'POSID': String(posId),    // Secondary common bridge headers
      'POSCODE': String(code)
    })
    console.log(`[FBR] IMS Response (${r.statusCode}):`, r.text)

    if (r.statusCode >= 200 && r.statusCode < 300) {
      let invNo = invoiceNo
      let qr = ''
      try {
        const parsed = parsePossibleResponse(r.text)
        invNo = String(parsed?.InvoiceNumber || parsed?.invoiceNumber || parsed?.fbrInvoiceNo || invNo)
        qr = String(parsed?.QRCode || parsed?.qrCode || parsed?.qr || '')
      } catch { }
      return await logMock(args, 'PRODUCTION', 'SUCCESS', { fbrInvoiceNo: invNo, qrCode: qr, rawResponse: r.text })
    } else {
      const msg = extractErrorMessages(r.text) || r.text || `HTTP ${r.statusCode}`
      console.error(`[FBR] Fiscalization failed:`, msg)
      return await logMock(args, 'PRODUCTION', 'FAILED', { error: msg, rawResponse: r.text })
    }
  } catch (e: any) {
    console.error(`[FBR] IMS Connection Error:`, e.message)
    return await logMock(args, 'PRODUCTION', 'FAILED', { error: String(e?.message || e) || 'IMS unreachable' })
  }
}
