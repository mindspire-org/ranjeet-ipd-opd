const mongoose = require('mongoose');

const MockFbrLogSchema = new mongoose.Schema({
    module: String,
    refId: String,
    fbrInvoiceNo: String,
    status: String,
    qrCode: String,
    fbrMode: String,
    error: String,
    createdAt: Date
}, { collection: 'mock_fbr_logs' });

const MockFbrLog = mongoose.models.MockFbrLog || mongoose.model('MockFbrLog', MockFbrLogSchema);

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/hospital_dev');
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const logs = await MockFbrLog.find({ createdAt: { $gte: fiveMinAgo } }).sort({ createdAt: -1 }).lean();
    console.log(JSON.stringify(logs, null, 2));
    await mongoose.disconnect();
}

check().catch(console.error);
