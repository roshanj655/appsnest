import User from '../models/master/User';

export const ensureSuperAdmin = async (): Promise<void> => {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const name = process.env.SUPER_ADMIN_NAME?.trim() || 'Super Admin';

  if (!email || !password) {
    console.warn('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD is not set; skipping super admin seed');
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'superadmin') {
      existing.role = 'superadmin';
      existing.businessId = undefined;
      await existing.save();
      console.log(`Updated existing user to super admin: ${email}`);
    }
    return;
  }

  await User.create({
    name,
    email,
    password,
    role: 'superadmin'
  });

  console.log(`Super admin created: ${email}`);
};
