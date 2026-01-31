import { Router } from 'express'
import { exportAll, purgeAll, restoreAll } from '../backup.controller'
import { adminGuard } from '../../../common/middleware/admin_guard'
import * as fbrController from '../fbr.controller'

const r = Router()

r.get('/backup/export', adminGuard, exportAll)
r.post('/backup/restore', adminGuard, restoreAll)
r.post('/backup/purge', adminGuard, purgeAll)

// FBR routes
r.get('/fbr/config', adminGuard, fbrController.getConfig)
r.put('/fbr/config', adminGuard, fbrController.updateConfig)
r.get('/fbr/service-status', adminGuard, fbrController.checkServiceStatus)
r.get('/fbr/invoices', adminGuard, fbrController.getInvoices)
r.get('/fbr/invoices/:id', adminGuard, fbrController.getInvoiceById)
r.post('/fbr/invoices/:id/retry', adminGuard, fbrController.retryInvoice)
r.post('/fbr/bulk-retry', adminGuard, fbrController.bulkRetry)
r.get('/fbr/statistics', adminGuard, fbrController.getStatistics)

export default r

