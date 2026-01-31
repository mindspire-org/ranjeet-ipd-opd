import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PrescriptionPdfData } from '../../prescriptionPdf'

export async function buildRxDefault(data: PrescriptionPdfData){
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  let y = 14

  // Doctor (left)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text(`Dr. ${data.doctor?.name || '-'}`, 14, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  if (data.doctor?.qualification) { y += 5; pdf.text(`Qualification: ${data.doctor.qualification}`, 14, y) }
  if (data.doctor?.departmentName) { y += 5; pdf.text(`Department: ${data.doctor.departmentName}`, 14, y) }
  if (data.doctor?.phone) { y += 5; pdf.text(`Phone: ${data.doctor.phone}`, 14, y) }

  // Hospital (right)
  const rx = pageWidth - 14
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text(String(data.settings?.name || 'Hospital'), rx, 14, { align: 'right' })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  if (data.settings?.address) pdf.text(String(data.settings.address), rx, 19, { align: 'right' })
  if (data.settings?.phone) pdf.text(`Mobile #: ${data.settings.phone}`, rx, 24, { align: 'right' })

  let logo = data.settings?.logoDataUrl
  if (logo) {
    try {
      if (!logo.startsWith('data:')) {
        try {
          const u = logo.startsWith('http') ? logo : `${location.origin}${logo.startsWith('/')?'':'/'}${logo}`
          const resp = await fetch(u)
          const blob = await resp.blob()
          logo = await new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result||'')); fr.readAsDataURL(blob) })
        } catch {}
      }
      // Always rasterize to a small JPEG to keep file size small
      logo = await new Promise<string>((resolve) => {
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const S = 96
            canvas.width = S; canvas.height = S
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.clearRect(0,0,S,S)
              ctx.drawImage(img, 0, 0, S, S)
            }
            resolve(canvas.toDataURL('image/jpeg', 0.7))
          } catch { resolve(logo!) }
        }
        img.onerror = () => resolve(logo!)
        img.src = logo!
      })
      const imgW = 16, imgH = 16
      pdf.addImage(logo, 'JPEG', (pageWidth/2)-(imgW/2), 8, imgW, imgH)
    } catch {}
  }

  // Divider
  y = Math.max(y, 26)
  pdf.line(14, y+2, pageWidth-14, y+2)
  y += 8

  // Patient block
  const createdAt = data.createdAt ? new Date(data.createdAt) : new Date()
  pdf.setFontSize(9)
  pdf.text(`Patient: ${data.patient?.name || '-'}`, 14, y)
  pdf.text(`MR: ${data.patient?.mrn || '-'}`, pageWidth/2, y)
  pdf.text(`Gender: ${data.patient?.gender || '-'}`, pageWidth-14, y, { align: 'right' })
  y += 5
  pdf.text(`Father Name: ${data.patient?.fatherName || '-'}`, 14, y)
  pdf.text(`Age: ${data.patient?.age || '-'}`, pageWidth/2, y)
  pdf.text(`Phone: ${data.patient?.phone || '-'}`, pageWidth-14, y, { align: 'right' })
  y += 5
  pdf.text(`Address: ${data.patient?.address || '-'}`, 14, y)
  y += 5
  pdf.text(`Date: ${createdAt.toLocaleString()}`, 14, y)
  y += 6
  // Sections in simple blocks matching target layout
  const section = (label: string, value?: string) => {
    const v = String(value || '').trim()
    if (!v) return
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text(label, 14, y)
    y += 4
    pdf.setFont('helvetica', 'normal')
    const lines = pdf.splitTextToSize(v, pageWidth - 28)
    pdf.text(lines, 14, y)
    y += Math.max(6, lines.length * 4 + 2)
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Prescription', 14, y)
  y += 6

  // Vitals (table) above Medical History
  try {
    const v = data.vitals
    const hasVitals = v && Object.values(v).some(x => x != null && !(typeof x === 'number' && isNaN(x as any)))
    if (hasVitals){
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('Vitals', 14, y)
      y += 4
      const labels: string[] = []
      const values: string[] = []
      const add = (label: string, present: boolean, value: string) => { if (present) { labels.push(label); values.push(value) } }
      add('Pulse', v?.pulse != null, `${v?.pulse}`)
      add('Temp (°C)', v?.temperatureC != null, `${v?.temperatureC}`)
      add('BP (mmHg)', (v?.bloodPressureSys != null || v?.bloodPressureDia != null), `${v?.bloodPressureSys ?? '-'} / ${v?.bloodPressureDia ?? '-'}`)
      add('RR (/min)', v?.respiratoryRate != null, `${v?.respiratoryRate}`)
      add('SpO2 (%)', v?.spo2 != null, `${v?.spo2}`)
      add('Sugar (mg/dL)', v?.bloodSugar != null, `${v?.bloodSugar}`)
      add('Weight (kg)', v?.weightKg != null, `${v?.weightKg}`)
      add('Height (cm)', v?.heightCm != null, `${v?.heightCm}`)
      add('BMI', v?.bmi != null, `${v?.bmi}`)
      add('BSA (m2)', v?.bsa != null, `${v?.bsa}`)
      if (labels.length){
        autoTable(pdf, {
          startY: y,
          margin: { left: 14, right: 14 },
          head: [ labels ],
          body: [ values ],
          styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
          headStyles: { fillColor: [248,250,252], textColor: [15,23,42], fontStyle: 'bold' },
        })
        try { y = Math.max(y, ((pdf as any).lastAutoTable?.finalY || y) + 6) } catch {}
      }
    }
  } catch {}

  section('Medical History', data.history)
  section('Complaint', data.primaryComplaint)
  section('Examination', data.examFindings)
  section('Clinical Notes', data.primaryComplaintHistory || data.treatmentHistory)
  section('Advice', data.advice)

  // Medication table
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('Medication', 14, y)
  y += 4

  const freqText = (s?: string) => {
    const raw = String(s || '').trim()
    if (!raw) return '-'
    if (raw.includes('/')) {
      const cnt = raw.split('/').map(t => t.trim()).filter(Boolean).length
      if (cnt === 1) return 'Once a day'
      if (cnt === 2) return 'Twice a day'
      if (cnt === 3) return 'Thrice a day'
      if (cnt >= 4) return 'Four times a day'
    }
    return raw
  }
  const durText = (s?: string) => {
    const d = String(s || '').trim()
    if (!d) return '-'
    return d
  }
  const bodyRows = (data.items || []).map((m: any, idx: number) => {
    const notes = String(m?.notes || '').trim()
    const instrDirect = String(m?.instruction || '').trim()
    const routeDirect = String(m?.route || '').trim()
    let instr = instrDirect
    let route = routeDirect
    if (!instr) {
      try { const mi = notes.match(/Instruction:\s*([^;]+)/i); if (mi && mi[1]) instr = mi[1].trim() } catch {}
    }
    if (!route) {
      try { const mr = notes.match(/Route:\s*([^;]+)/i); if (mr && mr[1]) route = mr[1].trim() } catch {}
    }
    return [
      String(idx + 1),
      String(m.name || '-'),
      freqText(m.frequency),
      String(m.dose || '-'),
      durText(m.duration),
      String(instr || '-'),
      String(route || '-')
    ]
  })

  autoTable(pdf, {
    startY: y,
    margin: { left: 14, right: 14, bottom: 10 },
    head: [[ 'Sr.', 'Drug', 'Frequency', 'Dosage', 'Duration', 'Instruction', 'Route' ]],
    body: bodyRows,
    styles: { fontSize: 9, cellPadding: 2, valign: 'top' },
    headStyles: { fillColor: [0,0,0], textColor: [255,255,255], fontStyle: 'bold' },
  })

  return pdf
}
