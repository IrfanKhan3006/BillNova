import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Tenants allowed to read the platform-wide, read-only views.
 *
 * These endpoints return every business's data, so the allowlist is enforced
 * here on the server — hiding the section in the UI is not a control. Set
 * PLATFORM_VIEWER_TENANT_IDS (comma-separated) to override the default.
 */
export const DEFAULT_PLATFORM_VIEWER_TENANT_IDS = [
  // Bill Crafts India Private Limited (slug: irfan-trading-co)
  '7b563149-3c0f-48ff-b09c-5866688e0270',
];

export function platformViewerTenantIds(): string[] {
  const configured = process.env.PLATFORM_VIEWER_TENANT_IDS;
  if (!configured) return DEFAULT_PLATFORM_VIEWER_TENANT_IDS;
  return configured
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

@Injectable()
export class PlatformViewerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Access denied. No authenticated user found.');
    }

    // The business's own ADMIN only — never a team USER. A SUPER_ADMIN has the
    // real /admin endpoints and does not need these.
    const allowed =
      user.role === 'ADMIN' && platformViewerTenantIds().includes(user.tenantId);

    if (!allowed) {
      throw new ForbiddenException('Access denied. Insufficient permissions.');
    }

    return true;
  }
}
