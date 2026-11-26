/**
 * The product name shown to users. The live site ships as "BillCraft" and sets
 * NEXT_PUBLIC_BRAND_NAME at build time; the repo's own default stays BillNova.
 * NEXT_PUBLIC_* values are baked in when the bundle is built, so changing this
 * on the server without a rebuild does nothing.
 */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'BillNova';

export const BRAND_TAGLINE = 'Billing & Business Management';

export const BRAND_DESCRIPTION =
  'Invoicing, inventory, customers, payments and reports for your business — on any device.';

/** Brand green, used for the installed app's status bar and splash screen. */
export const BRAND_THEME_COLOR = '#10b981';
