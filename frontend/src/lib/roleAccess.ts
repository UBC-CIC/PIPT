// Pure role-based route access resolution.
// Kept free of React and router imports so the decision logic is testable
// without a DOM renderer. Roles come from the database via GET /student/me
// (AuthUser.groups) — never from JWT claims.

export type AppRole = 'student' | 'instructor' | 'admin';

/** Decision returned by {@link resolveRouteAccess}. */
export type RouteAccess =
  | { kind: 'loading' }
  | { kind: 'allow' }
  | { kind: 'redirect'; to: string };

export interface ResolveRouteAccessInput {
  /** True while the auth state (and therefore roles) is still resolving. */
  loading: boolean;
  /** Roles for the current user, or `null` when unauthenticated. */
  roles: string[] | null;
  /** Roles permitted to view the route. */
  allowedRoles: AppRole[];
  /** Where to send an authenticated user who lacks an allowed role. */
  fallbackPath: string;
}

/**
 * Resolve whether a route may render, in this precedence order:
 *
 * 1. `loading` → `{ kind: 'loading' }` — a still-resolving role never produces
 *    a spurious deny or redirect.
 * 2. `roles === null` (unauthenticated) → redirect to `/login`.
 * 3. `roles` and `allowedRoles` share at least one element → `allow`.
 * 4. Otherwise → redirect to `fallbackPath`.
 */
export function resolveRouteAccess({
  loading,
  roles,
  allowedRoles,
  fallbackPath,
}: ResolveRouteAccessInput): RouteAccess {
  if (loading) {
    return { kind: 'loading' };
  }

  if (roles === null) {
    return { kind: 'redirect', to: '/login' };
  }

  const hasAllowedRole = roles.some((role) => (allowedRoles as string[]).includes(role));
  if (hasAllowedRole) {
    return { kind: 'allow' };
  }

  return { kind: 'redirect', to: fallbackPath };
}
