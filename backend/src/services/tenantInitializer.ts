import { Connection, Model } from 'mongoose';
import { IBusiness } from '../models/master/Business';
import { registerTenantModels } from '../models/tenant/register';
import { getCategoryModel } from '../models/tenant/Category';
import { getSettingsModel } from '../models/tenant/Settings';
import { getBusinessUnitModel } from '../models/tenant/BusinessUnit';

const ensuredTenants = new Set<string>();

const listCollectionNames = async (connection: Connection): Promise<Set<string>> => {
  const db = connection.db;
  if (!db) return new Set();
  const collections = await db.listCollections().toArray();
  return new Set(collections.map((row) => row.name));
};

/** Create any missing tenant collections + indexes for registered models. */
export const ensureTenantCollections = async (connection: Connection, tenantId?: string): Promise<void> => {
  registerTenantModels(connection);

  const models = Object.values(connection.models) as Model<any>[];
  if (!models.length) return;

  const existing = await listCollectionNames(connection);

  for (const model of models) {
    const name = model.collection.name;
    if (!existing.has(name)) {
      try {
        await model.createCollection();
        existing.add(name);
        console.log(`Created tenant collection: ${name}${tenantId ? ` (${tenantId})` : ''}`);
      } catch (error: any) {
        // Already exists (race) or unsupported — continue
        if (error?.code !== 48 && !/already exists/i.test(String(error?.message || ''))) {
          console.warn(`Could not create collection ${name}:`, error?.message || error);
        }
      }
    }

    try {
      await model.syncIndexes();
    } catch (error: any) {
      console.warn(`Could not sync indexes for ${name}:`, error?.message || error);
    }
  }
};

const seedDefaults = async (connection: Connection, business: IBusiness): Promise<void> => {
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

  const Settings = getSettingsModel(connection);
  const existingSettings = await Settings.findOne();
  if (!existingSettings) {
    await Settings.create({
      businessName: business.businessName,
      phone: business.phone,
      email: business.email
    });
  }
};

export const initializeTenantDatabase = async (connection: Connection, business: IBusiness): Promise<void> => {
  const tenantId = String(business.tenantId || business._id || '');
  console.log(`Initializing tenant database for ${tenantId}...`);

  try {
    await ensureTenantCollections(connection, tenantId);
    await seedDefaults(connection, business);
    if (tenantId) ensuredTenants.add(tenantId);
    console.log(`Tenant database initialized for ${tenantId}`);
  } catch (error) {
    console.error(`Error initializing tenant database for ${tenantId}:`, error);
    throw error;
  }
};

/** Idempotent: create missing collections on first login / first request for a tenant. */
export const ensureTenantReady = async (connection: Connection, business: IBusiness): Promise<void> => {
  const tenantId = String(business.tenantId || business._id || '');
  if (tenantId && ensuredTenants.has(tenantId)) {
    registerTenantModels(connection);
    return;
  }

  await ensureTenantCollections(connection, tenantId);
  await seedDefaults(connection, business);
  if (tenantId) ensuredTenants.add(tenantId);
};
