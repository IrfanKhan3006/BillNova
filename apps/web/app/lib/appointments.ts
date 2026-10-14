/**
 * Appointments are a salon-style feature, so the section follows the tenant's
 * business type rather than a separate toggle: the Super Admin turns it on by
 * setting the business type to SALOON.
 */
export const APPOINTMENTS_BUSINESS_TYPES = ['SALOON'];

export function hasAppointments(user?: {
  role?: string;
  tenant?: { businessType?: string | null } | null;
} | null): boolean {
  const type = user?.tenant?.businessType;
  if (!type) return false;
  return APPOINTMENTS_BUSINESS_TYPES.includes(type);
}
