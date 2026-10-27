import mongoose, { Connection } from 'mongoose';
import { IBusiness } from '../models/master/Business';
import { registerTenantModels } from '../models/tenant/register';

const tenantConnections = new Map<string, Connection>();
const tenantConnecting = new Map<string, Promise<Connection>>();

const maskUri = (uri: string) => String(uri || '').replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

const tenantDbName = (business: IBusiness) => {
  if (business.databaseName) return String(business.databaseName).trim();
  try {
    const pathname = new URL(business.connectionString).pathname || '';
    return pathname.replace(/^\//, '').split('?')[0] || '';
  } catch {
    return '';
  }
};

const sameClusterAsMaster = (business: IBusiness) => {
  const masterUri = process.env.MASTER_DATABASE_URI;
  if (!masterUri || !business.connectionString) return false;
  try {
    return new URL(masterUri).host === new URL(business.connectionString).host;
  } catch {
    return false;
  }
};

const isUsable = (connection?: Connection | null) => Boolean(connection && connection.readyState === 1);

const dropCached = (connectionKey: string) => {
  tenantConnections.delete(connectionKey);
  tenantConnecting.delete(connectionKey);
};

export const getTenantConnection = async (business: IBusiness): Promise<Connection> => {
  if (!business?.connectionString && !business?.databaseName) {
    throw Object.assign(new Error('Business is missing a tenant database configuration.'), { status: 500 });
  }

  const connectionKey = String(business.tenantId || business._id || business.databaseName);
  const existingConnection = tenantConnections.get(connectionKey);

  if (isUsable(existingConnection)) {
    registerTenantModels(existingConnection!);
    return existingConnection!;
  }

  if (existingConnection) {
    dropCached(connectionKey);
    try {
      // Only close dedicated createConnection sockets; useDb shares the master client.
      if (!(existingConnection as any)._hasSharedMasterClient) {
        await existingConnection.close();
      }
    } catch {
      // ignore close errors on dead sockets
    }
  }

  const pending = tenantConnecting.get(connectionKey);
  if (pending) {
    return pending;
  }

  const connectPromise = (async () => {
    const dbName = tenantDbName(business);
    if (!dbName) {
      throw Object.assign(new Error('Business databaseName is missing.'), { status: 500 });
    }

    let connection: Connection;

    // Same Atlas/cluster as master: reuse the live client. Avoids IP/reconnect failures
    // that happen when a second createConnection is opened after the first drops.
    if (sameClusterAsMaster(business) && mongoose.connection.readyState === 1) {
      connection = mongoose.connection.useDb(dbName, { useCache: true });
      (connection as any)._hasSharedMasterClient = true;
    } else {
      if (!business.connectionString) {
        throw Object.assign(new Error('Business connectionString is missing.'), { status: 500 });
      }
      connection = mongoose.createConnection(business.connectionString, {
        serverSelectionTimeoutMS: 15000,
        maxPoolSize: 10
      });
      await connection.asPromise();
      connection.on('error', (err) => {
        console.error(`Tenant DB connection error: ${connectionKey}`, err?.message || err);
        dropCached(connectionKey);
      });
      connection.on('disconnected', () => {
        console.log(`Tenant DB disconnected: ${connectionKey}`);
        dropCached(connectionKey);
      });
    }

    registerTenantModels(connection);
    tenantConnections.set(connectionKey, connection);
    console.log(
      `Tenant DB ready: ${dbName} (Tenant ID: ${connectionKey}) via ${
        (connection as any)._hasSharedMasterClient ? 'shared master client' : maskUri(business.connectionString || '')
      }`
    );
    return connection;
  })();

  tenantConnecting.set(connectionKey, connectPromise);
  try {
    return await connectPromise;
  } catch (error: any) {
    dropCached(connectionKey);
    const message = String(error?.message || error || 'Unknown tenant DB error');
    const atlasHint = /whitelist|IP|ReplicaSetNoPrimary|ServerSelection/i.test(message)
      ? ' Check MongoDB Atlas Network Access (add your current IP) and that the cluster is not paused.'
      : '';
    throw Object.assign(
      new Error(`Unable to connect to tenant database.${atlasHint} ${message}`),
      { status: 500, cause: error }
    );
  } finally {
    tenantConnecting.delete(connectionKey);
  }
};

export const closeTenantConnection = async (tenantId: string): Promise<void> => {
  if (!tenantConnections.has(tenantId)) return;
  const connection = tenantConnections.get(tenantId)!;
  dropCached(tenantId);
  if (!(connection as any)._hasSharedMasterClient) {
    await connection.close();
  }
  console.log(`Tenant DB connection closed: ${tenantId}`);
};

export const getActiveTenantCount = (): number => tenantConnections.size;
