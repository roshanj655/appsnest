import { describe, expect, it } from 'vitest';
import { getBusinessAccessError } from '../../src/utils/businessAccess';
import type { IBusiness } from '../../src/models/master/Business';

const business = (overrides: Partial<IBusiness> = {}) =>
  ({
    status: 'active',
    ...overrides
  }) as IBusiness;

describe('getBusinessAccessError', () => {
  it('blocks missing businesses', () => {
    expect(getBusinessAccessError(null)).toBe('No business associated with user');
  });

  it('blocks disabled businesses', () => {
    expect(getBusinessAccessError(business({ status: 'inactive' }))).toBe('Business account is disabled');
  });

  it('blocks expired subscriptions', () => {
    expect(
      getBusinessAccessError(business({ subscriptionEndsAt: new Date('2020-01-01') }))
    ).toBe('Business subscription has expired');
  });

  it('allows active businesses without an end date', () => {
    expect(getBusinessAccessError(business())).toBeNull();
  });
});
