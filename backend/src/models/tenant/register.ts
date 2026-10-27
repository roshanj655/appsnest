import { Connection } from 'mongoose';
import { getBusinessUnitModel } from './BusinessUnit';
import { getCategoryModel } from './Category';
import { getCustomerModel } from './Customer';
import { getExpenseModel } from './Expense';
import { getInventoryTransactionModel } from './InventoryTransaction';
import { getProductModel } from './Product';
import { getPurchaseModel } from './Purchase';
import { getSaleModel } from './Sale';
import { getSettingsModel } from './Settings';
import { getStockAdjustmentModel } from './StockAdjustment';
import { getSupplierModel } from './Supplier';
import { getLoanModel } from './Loan';

export const registerTenantModels = (connection: Connection) => {
  getBusinessUnitModel(connection);
  getCategoryModel(connection);
  getCustomerModel(connection);
  getExpenseModel(connection);
  getInventoryTransactionModel(connection);
  getLoanModel(connection);
  getProductModel(connection);
  getPurchaseModel(connection);
  getSaleModel(connection);
  getSettingsModel(connection);
  getStockAdjustmentModel(connection);
  getSupplierModel(connection);
};
