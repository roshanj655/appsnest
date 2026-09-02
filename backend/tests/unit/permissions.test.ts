import { describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, resolvePermissions, ROLE_PERMISSIONS, type Permission } from '../../src/constants/permissions';

describe('resolvePermissions', () => {
  it('returns all permissions for admin users', () => {
    const permissions = resolvePermissions({ role: 'admin' });

    expect(permissions).toHaveLength(ALL_PERMISSIONS.length);
    expect(new Set(permissions)).toEqual(new Set(ALL_PERMISSIONS));
  });

  it('merges role permissions with custom allowed permissions', () => {
    const customPermission: Permission = 'settings.update';

    const permissions = resolvePermissions({
      role: 'staff',
      permissions: [customPermission]
    });

    expect(permissions).toEqual(
      expect.arrayContaining([...ROLE_PERMISSIONS.staff, customPermission])
    );
  });

  it('removes denied permissions even when granted by role or override', () => {
    const permissions = resolvePermissions({
      role: 'manager',
      permissions: ['products.delete'],
      deniedPermissions: ['products.create', 'products.delete']
    });

    expect(permissions).not.toContain('products.create');
    expect(permissions).not.toContain('products.delete');
    expect(permissions).toContain('products.read');
  });

  it('treats superadmin as a distinct platform role with the full permission set', () => {
    const permissions = resolvePermissions({ role: 'superadmin' });

    expect(new Set(permissions)).toEqual(new Set(ALL_PERMISSIONS));
  });
});
