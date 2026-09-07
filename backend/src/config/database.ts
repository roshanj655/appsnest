import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ensureSuperAdmin } from '../services/superAdminSeed';

dotenv.config();

const masterDBConnection = async () => {
  try {
    const uri = process.env.MASTER_DATABASE_URI;
    if (!uri) {
      throw new Error('MASTER_DATABASE_URI is not set');
    }
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log(`Master MongoDB connected: ${conn.connection.host}`);
    await ensureSuperAdmin();
    return conn;
  } catch (error) {
    console.error('Error connecting to master DB:', error);
    console.error(
      'Atlas could not be reached. In MongoDB Atlas: Network Access → Add Current IP Address (or 0.0.0.0/0 for local dev), confirm the cluster is not paused, then restart the backend.'
    );
    process.exit(1);
  }
};

export default masterDBConnection;
