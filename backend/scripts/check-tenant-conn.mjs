import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const mask = (uri) => String(uri || '').replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');

try {
  await mongoose.connect(process.env.MASTER_DATABASE_URI, { serverSelectionTimeoutMS: 15000 });
  const b = await mongoose.connection.collection('businesses').findOne(
    {},
    { projection: { businessName: 1, tenantId: 1, databaseName: 1, connectionString: 1, status: 1 } }
  );
  console.log({
    name: b?.businessName,
    tenantId: b?.tenantId,
    db: b?.databaseName,
    status: b?.status,
    conn: mask(b?.connectionString).slice(0, 200)
  });

  if (!b?.connectionString) {
    throw new Error('Business has no connectionString');
  }

  const conn = mongoose.createConnection(b.connectionString, {
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 5
  });
  await conn.asPromise();
  console.log('readyState after connect', conn.readyState);
  await new Promise((r) => setTimeout(r, 4000));
  console.log('readyState after 4s', conn.readyState);
  await conn.close();
  await mongoose.disconnect();
  console.log('ok');
} catch (error) {
  console.error('FAIL', error?.message || error);
  process.exit(1);
}
