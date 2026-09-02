import mongoose, { Connection } from 'mongoose';
import { IBusiness } from '../models/master/Business';
import { registerTenantModels } from '../models/tenant/register';

const tenantConnections = new Map<string, Connection>();
const tenantConnecting = new Map<string, Promise<Connection>>();

export const getTenantConnection = async (business: IBusiness): Promise<Connection> => {
  const connectionKey = business.tenantId;
  const existingConnection = tenantConnections.get(connectionKey);

  if (existingConnection?.readyState === 1) {
    registerTenantModels(existingConnection);
    return existingConnection;
  }

  const pending = tenantConnecting.get(connectionKey);
  if (pending) {
    return pending;
  }

  const connectPromise = (async () => {
    if (existingConnection) {
      tenantConnections.delete(connectionKey);
    }

    const connection = mongoose.createConnection(business.connectionString);
    await connection.asPromise();
    registerTenantModels(connection);

    connection.on('error', (err) => {
      console.error(`Tenant DB connection error: ${business.tenantId}`, err);
      tenantConnections.delete(connectionKey);
    });

    connection.on('disconnected', () => {
      console.log(`Tenant DB disconnected: ${business.tenantId}`);
    });

    tenantConnections.set(connectionKey, connection);
    console.log(`Tenant DB connected: ${business.databaseName} (Tenant ID: ${business.tenantId})`);
    return connection;
  })();

  tenantConnecting.set(connectionKey, connectPromise);
  try {
    return await connectPromise;
  } finally {
    tenantConnecting.delete(connectionKey);
  }
};

export const closeTenantConnection = async (tenantId: string): Promise<void> => {
  if (tenantConnections.has(tenantId)) {
    const connection = tenantConnections.get(tenantId)!;
    await connection.close();
    tenantConnections.delete(tenantId);
    console.log(`Tenant DB connection closed: ${tenantId}`);
  }
};

export const getActiveTenantCount = (): number => {
  return tenantConnections.size;
};
