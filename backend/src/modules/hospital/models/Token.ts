import { Schema, model, models } from 'mongoose'

const TokenSchema = new Schema({
  dateIso: { type: String, index: true },
  tokenNo: { type: String, index: true },
  patientId: { type: Schema.Types.ObjectId, ref: 'Lab_Patient', index: true },
  mrn: { type: String },
  patientName: { type: String },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Hospital_Department', required: true },
  doctorId: { type: Schema.Types.ObjectId, ref: 'Hospital_Doctor' },
  encounterId: { type: Schema.Types.ObjectId, ref: 'Hospital_Encounter' },
  corporateId: { type: Schema.Types.ObjectId, ref: 'Corporate_Company' },
  baseFee: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  fee: { type: Number },
  status: { type: String, enum: ['queued','in-progress','completed','returned','cancelled'], default: 'queued', index: true },
  // Scheduling fields (optional)
  scheduleId: { type: Schema.Types.ObjectId, ref: 'Hospital_DoctorSchedule', index: true },
  slotNo: { type: Number },
  slotStart: { type: String }, // HH:mm
  slotEnd: { type: String },   // HH:mm
}, { timestamps: true })

export type HospitalTokenDoc = {
  _id: string
  dateIso: string
  tokenNo: string
  patientId?: string
  mrn?: string
  patientName?: string
  departmentId: string
  doctorId?: string
  encounterId?: string
  corporateId?: string
  baseFee?: number
  discount?: number
  fee?: number
  status: 'queued'|'in-progress'|'completed'|'returned'|'cancelled'
  scheduleId?: string
  slotNo?: number
  slotStart?: string
  slotEnd?: string
}

export const HospitalToken = models.Hospital_Token || model('Hospital_Token', TokenSchema)
