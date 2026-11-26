/**
 * The read-only "Manage Business" section is enabled for one business only.
 *
 * It is gated by tenant id on purpose: it mirrors figures the platform admin
 * sees, so it is opt-in per business rather than something every tenant gets.
 * To enable it for another business, add that tenant's id here and redeploy.
 */
export const MANAGE_BUSINESS_TENANT_IDS = [
  // Bill Craft India Pvt. Ltd (slug: irfan-trading-co)
  '7b563149-3c0f-48ff-b09c-5866688e0270',
];

export function canManageBusiness(user?: {
  role?: string;
  tenant?: { id?: string } | null;
} | null): boolean {
  if (!user?.tenant?.id) return false;
  // Only the business's own ADMIN — team users never see it, and the platform
  // Super Admin already has the full /admin section.
  if (user.role !== 'ADMIN') return false;
  return MANAGE_BUSINESS_TENANT_IDS.includes(user.tenant.id);
}
