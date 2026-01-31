import app from './app'
import { connectDB } from './config/db'
import { env } from './config/env'
import bcrypt from 'bcryptjs'
import { PharmacyUser } from './modules/pharmacy/models/User'
import { Dispense } from './modules/pharmacy/models/Dispense'
import { FbrSettings } from './modules/hospital/models/FbrSettings'
import { encryptText } from './common/utils/crypto'

async function main() {
  await connectDB()
  await Dispense.init()
  try {
    // Ensure the sales collection exists
    await Dispense.createCollection()
  } catch { }

  // Seed FBR settings (locked defaults for production)
  try {
    // Initialize FBR settings only if they don't exist
    const settingsExist = await FbrSettings.exists({ hospitalId: '', branchCode: '' })
    if (!settingsExist) {
      await FbrSettings.create({
        hospitalId: '',
        branchCode: '',
        isEnabled: env.FBR_ENABLED || false,
        environment: env.FBR_ENVIRONMENT || 'sandbox',
        ntn: env.FBR_NTN || '',
        businessName: 'HOSPITAL',
        invoicePrefix: env.FBR_USIN_PREFIX || 'HSP',
        posId: env.FBR_POS_ID || '',
        applyModules: ['OPD', 'PHARMACY', 'LAB', 'IPD'],
      })
    }
  } catch (e) {
    console.warn('FBR settings initialization skipped/failed:', e)
  }

  const admin = await PharmacyUser.findOne({ username: 'admin' }).lean()
  if (!admin) {
    const passwordHash = await bcrypt.hash('123', 10)
    await PharmacyUser.create({ username: 'admin', role: 'admin', passwordHash })
  }

  app.listen(env.PORT, () => {
    console.log(`Backend listening on http://localhost:${env.PORT}`)
  })
}

main().catch(err => {
  console.error('Failed to start server', err)
  process.exit(1)
})
