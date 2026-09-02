import { IBusiness } from '../models/master/Business';

export const getBusinessAccessError = (business?: IBusiness | null): string | null => {
  if (!business) {
    return 'No business associated with user';
  }

  if (business.status !== 'active') {
    return 'Business account is disabled';
  }

  if (business.subscriptionEndsAt && new Date(business.subscriptionEndsAt).getTime() < Date.now()) {
    return 'Business subscription has expired';
  }

  return null;
};

export const toPublicBusiness = (business: IBusiness) => {
  const value = typeof business.toObject === 'function' ? business.toObject() : { ...business };
  delete value.connectionString;
  return value;
};
