import { Response } from 'express';
import { TenantRequest } from '../middleware/tenant';
import { getSettingsModel } from '../models/tenant/Settings';
import { logAuditEvent } from '../utils/auditLogger';

export const getSettings = async (req: TenantRequest, res: Response) => {
  try {
    const Settings = getSettingsModel(req.tenantDB!);
    let settings = await Settings.findOne();

    if (!settings) {
      // If no settings exist (for existing tenants), create defaults
      const business = req.business;
      if (business) {
        settings = await Settings.create({
          businessName: business.businessName,
          phone: business.phone,
          email: business.email
        });
      }
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Error fetching settings' });
  }
};

export const updateSettings = async (req: TenantRequest, res: Response) => {
  try {
    const Settings = getSettingsModel(req.tenantDB!);
    let settings = await Settings.findOne();
    const isNew = !settings;

    if (!settings) {
      settings = await Settings.create(req.body);
    } else {
      settings = await Settings.findByIdAndUpdate(settings._id, req.body, { new: true });
    }

    if (req.user && req.business && settings) {
      await logAuditEvent({
        user: req.user as any,
        business: req.business,
        action: isNew ? 'CREATE' : 'UPDATE',
        entity: 'Settings',
        entityId: settings._id.toString(),
        changes: req.body,
        req
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
};
