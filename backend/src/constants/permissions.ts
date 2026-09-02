export const USER_ROLES = ['superadmin', 'admin', 'manager', 'staff'] as const;

export type UserRole = typeof USER_ROLES[number];

export const ALL_PERMISSIONS = [
  'products.read',
  'products.create',
  'products.update',
  'products.delete',
  'categories.read',
  'categories.create',
  'categories.update',
  'categories.delete',
  'customers.read',
  'customers.create',
  'customers.update',
  'customers.delete',
  'suppliers.read',
  'suppliers.create',
  'suppliers.update',
  'suppliers.delete',
  'sales.read',
  'sales.create',
  'sales.update',
  'sales.delete',
  'sales.invoice.download',
  'sales.email.send',
  'sales.attachments.upload',
  'sales.attachments.download',
  'purchases.read',
  'purchases.create',
  'purchases.update',
  'purchases.delete',
  'purchases.invoice.download',
  'purchases.email.send',
  'purchases.attachments.upload',
  'purchases.attachments.download',
  'stockAdjustments.read',
  'stockAdjustments.create',
  'stockAdjustments.update',
  'stockAdjustments.delete',
  'expenses.read',
  'expenses.create',
  'expenses.update',
  'expenses.delete',
  'businessUnits.read',
  'businessUnits.create',
  'businessUnits.update',
  'businessUnits.delete',
  'settings.read',
  'settings.update',
  'reports.dashboard.read',
  'reports.sales.read',
  'reports.purchases.read',
  'reports.inventory.read',
  'reports.lowStock.read',
  'reports.profit.read',
  'auditLogs.read'
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

const managerPermissions: Permission[] = [
  'products.read',
  'products.create',
  'products.update',
  'categories.read',
  'categories.create',
  'categories.update',
  'customers.read',
  'customers.create',
  'customers.update',
  'suppliers.read',
  'suppliers.create',
  'suppliers.update',
  'sales.read',
  'sales.create',
  'sales.update',
  'sales.invoice.download',
  'sales.email.send',
  'sales.attachments.upload',
  'sales.attachments.download',
  'purchases.read',
  'purchases.create',
  'purchases.update',
  'purchases.invoice.download',
  'purchases.email.send',
  'purchases.attachments.upload',
  'purchases.attachments.download',
  'stockAdjustments.read',
  'stockAdjustments.create',
  'stockAdjustments.update',
  'expenses.read',
  'expenses.create',
  'expenses.update',
  'businessUnits.read',
  'businessUnits.create',
  'businessUnits.update',
  'settings.read',
  'reports.dashboard.read',
  'reports.sales.read',
  'reports.purchases.read',
  'reports.inventory.read',
  'reports.lowStock.read',
  'reports.profit.read',
  'auditLogs.read'
];

const staffPermissions: Permission[] = [
  'products.read',
  'categories.read',
  'customers.read',
  'customers.create',
  'suppliers.read',
  'suppliers.create',
  'sales.read',
  'sales.create',
  'sales.invoice.download',
  'sales.attachments.upload',
  'sales.attachments.download',
  'purchases.read',
  'purchases.create',
  'purchases.invoice.download',
  'purchases.attachments.upload',
  'purchases.attachments.download',
  'stockAdjustments.read',
  'stockAdjustments.create',
  'expenses.read',
  'expenses.create',
  'businessUnits.read',
  'reports.dashboard.read'
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  superadmin: [...ALL_PERMISSIONS],
  admin: [...ALL_PERMISSIONS],
  manager: managerPermissions,
  staff: staffPermissions
};

interface PermissionSource {
  role: UserRole;
  permissions?: Permission[];
  deniedPermissions?: Permission[];
}

export const resolvePermissions = (user: PermissionSource): Permission[] => {
  const basePermissions = ROLE_PERMISSIONS[user.role] || [];
  const allowed = new Set<Permission>([...basePermissions, ...(user.permissions || [])]);

  for (const deniedPermission of user.deniedPermissions || []) {
    allowed.delete(deniedPermission);
  }

  return Array.from(allowed);
};
