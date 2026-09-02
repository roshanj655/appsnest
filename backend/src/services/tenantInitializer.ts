import { Connection } from 'mongoose';
import { IBusiness } from '../models/master/Business';
import { getCategoryModel } from '../models/tenant/Category';
import { getSettingsModel } from '../models/tenant/Settings';
import { getBusinessUnitModel } from '../models/tenant/BusinessUnit';

export const initializeTenantDatabase = async (connection: Connection, business: IBusiness): Promise<void> => {
  console.log(`Initializing tenant database for ${business.tenantId}...`);

  try {
    // Initialize Category model and create default categories
    const Category = getCategoryModel(connection);
    const defaultCategories: Array<{ name: string; status: 'active' | 'inactive' }> = [
      { name: 'Electronics', status: 'active' },
      { name: 'Clothing', status: 'active' },
      { name: 'Food & Beverages', status: 'active' },
      { name: 'Furniture', status: 'active' },
      { name: 'Office Supplies', status: 'active' }
    ];
    for (const categoryData of defaultCategories) {
      const existingCategory = await Category.findOne({ name: categoryData.name });
      if (!existingCategory) {
        await Category.create(categoryData);
      }
    }

    const BusinessUnit = getBusinessUnitModel(connection);
    const defaultUnits = [
      { name: 'Disposable', code: 'DISP', notes: 'Disposable products division', status: 'active' as const },
      { name: 'Puja Samagri', code: 'PUJA', notes: 'Puja and ritual supplies', status: 'active' as const },
      { name: 'General Store', code: 'STORE', notes: 'General retail', status: 'active' as const }
    ];
    for (const unit of defaultUnits) {
      const existing = await BusinessUnit.findOne({ code: unit.code });
      if (!existing) {
        await BusinessUnit.create(unit);
      }
    }

    // Initialize Settings model and create default settings
    const Settings = getSettingsModel(connection);
    const existingSettings = await Settings.findOne();
    if (!existingSettings) {
      await Settings.create({
        businessName: business.businessName,
        phone: business.phone,
        email: business.email
      });
    }

    console.log(`✅ Tenant database initialized for ${business.tenantId}`);
  } catch (error) {
    console.error(`❌ Error initializing tenant database for ${business.tenantId}:`, error);
    throw error;
  }
};
