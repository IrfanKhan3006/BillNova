/**
 * Tenant feature flags used to gate modules in the sidebar and on the page.
 *
 * Most flags are opt-OUT: they default to true on the tenant, so an undefined
 * value (an older cached login, say) must read as enabled.
 *
 * The order-document modules are the opposite — opt-IN, default false — so for
 * those an undefined value must read as *disabled*, otherwise a stale cached
 * user sees a module their tenant has not been given.
 */
export type FeatureKey =
  | 'billingEnabled'
  | 'productsEnabled'
  | 'paymentsEnabled'
  | 'reportsEnabled'
  | 'purchasesEnabled'
  | 'quotationsEnabled'
  | 'salesOrdersEnabled'
  | 'purchaseOrdersEnabled';

const OPT_IN_FEATURES: FeatureKey[] = [
  'quotationsEnabled',
  'salesOrdersEnabled',
  'purchaseOrdersEnabled',
];

export function isFeatureEnabled(
  tenant: Partial<Record<FeatureKey, boolean | undefined>> | null | undefined,
  key: FeatureKey,
): boolean {
  const value = tenant?.[key];
  return OPT_IN_FEATURES.includes(key) ? value === true : value !== false;
}
