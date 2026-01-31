import { labApi } from './api'
import QRCode from 'qrcode'

export type LabSlipOrderInput = {
  tokenNo: string
  createdAt?: string
  patient: { fullName: string; phone?: string; age?: string; gender?: string }
  tests: Array<{ name: string; price: number }>
  subtotal: number
  discount: number
  net: number
  printedBy?: string
  fbr?: { fbrInvoiceNo: string; status?: string; qrCode?: string; mode?: string }
}

function esc(s: string) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function printLabTokenSlip(order: LabSlipOrderInput) {
  const settings = await labApi.getSettings().catch(() => ({})) as any
  const labName = settings?.labName || 'Laboratory'
  const address = settings?.address || ''
  const phone = settings?.phone || ''
  const email = settings?.email || ''
  const footer = settings?.reportFooter || 'Powered by Hospital MIS'
  const logo = settings?.logoDataUrl || ''
  const nowIso = order.createdAt || new Date().toISOString()
  const dt = new Date(nowIso)
  const dateStr = dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString()

  // Generate QR code if FBR data exists
  let qrCodeDataUrl = ''
  if (order.fbr?.fbrInvoiceNo) {
    try {
      const qrData = order.fbr.fbrInvoiceNo
      qrCodeDataUrl = await QRCode.toDataURL(qrData, { width: 96, margin: 1 })
    } catch (e) {
      console.error('QR code generation failed:', e)
    }
  }

  const rowsHtml = order.tests.map((t, i) => `<tr>
    <td style="padding:6px 8px;border-bottom:1px dashed #cbd5e1">${i + 1}</td>
    <td style="padding:6px 8px;border-bottom:1px dashed #cbd5e1">${esc(t.name)}</td>
    <td style="padding:6px 8px;border-bottom:1px dashed #cbd5e1;text-align:right">${t.price.toFixed(2)}</td>
  </tr>`).join('')
  // Build overlay modal inside the app
  const overlayId = 'lab-slip-overlay'
  const old = document.getElementById(overlayId)
  if (old) old.remove()
  const overlay = document.createElement('div')
  overlay.id = overlayId
  overlay.style.position = 'fixed'
  overlay.style.inset = '0'
  overlay.style.background = 'rgba(15,23,42,0.5)'
  overlay.style.zIndex = '9999'
  overlay.style.display = 'flex'
  overlay.style.alignItems = 'center'
  overlay.style.justifyContent = 'center'
  overlay.style.padding = '16px'

  const html = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
    .slip-card{width:384px;max-width:100%;background:#fff;border-radius:12px;box-shadow:0 10px 25px rgba(2,6,23,0.2);overflow:hidden}
    .toolbar{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#f8fafc}
    .toolbar-title{font-weight:700;color:#0f172a}
    .btn{border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;font-size:12px;color:#334155;background:#fff}
    .container{padding:16px 20px;font-family:'Poppins',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#0f172a}
    .title{font-size:22px;font-weight:800;text-align:center;margin:8px 0}
    .muted{color:#64748b;font-size:12px;text-align:center}
    .section-title{font-weight:700;text-align:center;margin:10px 0; text-decoration:underline}
    .kv{display:grid;grid-template-columns:120px 1fr;gap:6px 8px;font-size:14px;margin:8px 0}
    .token{border:2px solid #0f172a;border-radius:4px;font-size:24px;font-weight:700;text-align:center;padding:10px;margin:10px 0}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}
    th{background:#f8fafc;color:#475569;font-weight:600}
    th,td{padding:6px 8px}
    .frow{display:flex;justify-content:space-between;margin-top:8px;font-size:14px}
    .total{font-weight:700}
    .footer{margin-top:12px;text-align:center;color:#64748b;font-size:12px}
    /* Print only the slip and use thermal width */
    @media print{
      @page{ size: 58mm auto; margin:0 }
      html, body{ -webkit-print-color-adjust:exact; print-color-adjust:exact; color:#000 !important }
      body *{ visibility:hidden !important }
      /* Print ONLY the slip element to avoid blank first page */
      #lab-slip-printable, #lab-slip-printable *{ visibility:visible !important }
      /* Collapse the overlay container so it doesn't reserve a full-page height */
      #lab-slip-overlay{ position: static !important; width:auto !important; height:0 !important; padding:0 !important; margin:0 !important }
      /* Place the slip at the very top to remove any leading blank */
      #lab-slip-printable{ position:absolute !important; left:0; right:0; top:0; margin:0 auto !important; width:384px !important; box-shadow:none !important }
      .toolbar{ display:none !important }
      /* Force crisp black text for all content in the slip */
      #lab-slip-printable .container, #lab-slip-printable .container * { color:#000 !important }
      #lab-slip-printable .muted { color:#000 !important }
      #lab-slip-printable .footer { color:#000 !important }
      #lab-slip-printable table th{ background:transparent !important; color:#000 !important; border-bottom:1px dashed #000 !important }
      #lab-slip-printable table td{ border-bottom:1px dashed #000 !important }
    }
  </style>
  <div class="slip-card print-area" id="lab-slip-printable">
    <div class="toolbar">
      <div class="toolbar-title">Lab Slip Preview</div>
      <div>
        <button class="btn" id="lab-slip-print">Print (Ctrl+P)</button>
        <button class="btn" id="lab-slip-close" style="margin-left:8px">Close (Ctrl+D)</button>
      </div>
    </div>
    <div class="container">
      <div style="text-align:center;margin-top:8px">
        ${logo ? `<img src="${esc(logo)}" alt="logo" style="height:64px;width:auto;object-fit:contain;display:block;margin:0 auto 6px"/>` : ''}
        <div class="title">${esc(labName)}</div>
        <div class="muted">${esc(address)}</div>
        <div class="muted">Mobile #: ${esc(phone)} ${email ? ' • Email: ' + esc(email) : ''}</div>
      </div>
      <div class="section-title">Lab Investigation Token</div>
      <div class="kv">
        <div>User:</div><div>${esc(order.printedBy || '—')}</div>
        <div>Date/Time:</div><div>${esc(dateStr)}</div>
        <div>Patient Name:</div><div>${esc(order.patient.fullName)}</div>
        <div>Mobile #:</div><div>${esc(order.patient.phone || '-')}</div>
        <div>Age:</div><div>${esc(order.patient.age || '-')}</div>
        <div>Sex:</div><div>${esc(order.patient.gender || '-')}</div>
      </div>
      <div class="token">${esc(order.tokenNo)}</div>
      <table>
        <thead><tr><th style="text-align:left">Sr</th><th style="text-align:left">Test Name</th><th style="text-align:right">Charges</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="frow"><div>Total Amount:</div><div>${order.subtotal.toFixed(2)}</div></div>
      <div class="frow"><div>Discount:</div><div>${order.discount.toFixed(2)}</div></div>
      <div class="frow total"><div>Payable Amount:</div><div>${order.net.toFixed(2)}</div></div>
      ${order.fbr?.fbrInvoiceNo ? `
        <div style="margin-top:8px; text-align:center; color:#334155; font-size:12px">
          <div><span style="font-weight:700">FBR Invoice:</span> ${order.fbr.fbrInvoiceNo} ${order.fbr.status ? `(${order.fbr.status})` : ''}</div>
          ${qrCodeDataUrl ? `<div style="margin-top:6px"><img src="${qrCodeDataUrl}" alt="FBR QR" style="height:96px;width:96px;object-fit:contain;display:inline-block;border:1px solid #e5e7eb;padding:4px;border-radius:4px" /></div>` : ''}
          ${qrCodeDataUrl ? `<div style="margin-top:4px; font-size:11px; color:#64748b">Scan to verify FBR invoice</div>` : ''}
          ${String(order.fbr.mode || '').toUpperCase() === 'SANDBOX' ? `<div style="margin-top:4px; font-size:11px; color:#b45309">⚠ Sandbox mode</div>` : ''}
          ${String(order.fbr.status || '').toUpperCase() === 'FAILED' ? `<div style="margin-top:4px; font-weight:700; color:#dc2626; font-size:11px">FBR invoice submission failed</div>` : ''}
        </div>
      ` : ''}
      <div class="footer">${esc(footer || 'Powered by Hospital MIS')}</div>
    </div>
  </div>`

  overlay.innerHTML = html
  document.body.appendChild(overlay)
  const onClose = () => { try { document.removeEventListener('keydown', onKey); overlay.remove() } catch { } }
  const onPrint = () => {
    // Always open the OS print dialog (match Pharmacy behavior)
    try { window.print() } catch { }
  }
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); onClose() }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) { /* allow print */ }
    if (e.key === 'Escape') onClose()
  }
  document.getElementById('lab-slip-close')?.addEventListener('click', onClose)
  document.getElementById('lab-slip-print')?.addEventListener('click', onPrint)
  document.addEventListener('keydown', onKey)
}
