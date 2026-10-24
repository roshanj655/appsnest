import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import masterDBConnection from './config/database';
import authRoutes from './routes/authRoutes';
import productRoutes from './routes/productRoutes';
import categoryRoutes from './routes/categoryRoutes';
import customerRoutes from './routes/customerRoutes';
import supplierRoutes from './routes/supplierRoutes';
import saleRoutes from './routes/saleRoutes';
import purchaseRoutes from './routes/purchaseRoutes';
import settingsRoutes from './routes/settingsRoutes';
import reportsRoutes from './routes/reportsRoutes';
import auditLogRoutes from './routes/auditLogRoutes';
import businessRoutes from './routes/businessRoutes';
import stockAdjustmentRoutes from './routes/stockAdjustmentRoutes';
import expenseRoutes from './routes/expenseRoutes';
import loanRoutes from './routes/loanRoutes';
import inventoryTransactionRoutes from './routes/inventoryTransactionRoutes';
import inventoryRoutes from './routes/inventoryRoutes';
import businessUnitRoutes from './routes/businessUnitRoutes';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/stock-adjustments', stockAdjustmentRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/inventory-transactions', inventoryTransactionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/business-units', businessUnitRoutes);

const clientDir = [
  path.join(__dirname, '../public'),
  path.join(__dirname, '../../frontend/dist')
].find((dir) => fs.existsSync(path.join(dir, 'index.html')));

if (clientDir) {
  app.use(express.static(clientDir));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const start = async () => {
  await masterDBConnection();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start();
