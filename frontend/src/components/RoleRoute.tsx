import { Navigate } from 'react-router-dom';
import LoadingIndicator from '@/components/LoadingIndicator';
import { resolveRouteAccess, type AppRole } from '@/lib/roleAccess';
import { useAuth } from '@/App';

interface RoleRouteProps {
  /** Roles permitted to view the route. */
  allowedRoles: AppRole[];
  children: React.ReactNode;
  /** Where to send an authenticated user who lacks an allowed role. */
  fallbackPath?: string;
}

/**
 * Role-based route guard. Handles the unauthenticated redirect itself, so it is
 * used standalone rather than nested inside `ProtectedRoute` — nesting would
 * double the loading indicator and duplicate the `/login` redirect.
 *
 * Roles come from `AuthUser.groups`, populated from the database via
 * `GET /student/me`.
 */
function RoleRoute({ allowedRoles, children, fallbackPath = '/student' }: RoleRouteProps) {
  const { user, loading } = useAuth();

  const decision = resolveRouteAccess({
    loading,
    roles: user?.groups ?? null,
    allowedRoles,
    fallbackPath,
  });

  if (decision.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingIndicator size="lg" message="Loading..." />
      </div>
    );
  }

  if (decision.kind === 'redirect') {
    return <Navigate to={decision.to} replace />;
  }

  return <>{children}</>;
}

export default RoleRoute;
