import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ensureSuperAdmin } from '../services/superAdminSeed';

dotenv.config();

const masterDBConnection = async () => {
  try {
    const conn = await mongoose.connect(process.env.MASTER_DATABASE_URI as string);
    console.log(`Master MongoDB connected: ${conn.connection.host}`);
    await ensureSuperAdmin();
    return conn;
  } catch (error) {
    console.error('Error connecting to master DB:', error);
    process.exit(1);
  }
};

export default masterDBConnection;
