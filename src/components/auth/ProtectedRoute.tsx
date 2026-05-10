import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/admin/AuthContext";
import { LoadingScreen } from "@/components/shared/LoadingScreen";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: "super_admin" | "admin_branch" | "employee" | "web_admin";
  /** Allow multiple roles */
  allowRoles?: Array<"super_admin" | "admin_branch" | "employee" | "web_admin">;
}

export function ProtectedRoute({ children, requireRole, allowRoles }: ProtectedRouteProps) {
  const { user, status, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (status === "pending" || (!role && status !== "active")) {
    return <Navigate to="/admin/waiting-approval" replace />;
  }

  if (status === "suspended" || status === "rejected") {
    return <Navigate to="/admin/login" state={{ blocked: true, status }} replace />;
  }

  // Role-based access
  if (requireRole && role !== requireRole && role !== "super_admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (allowRoles && allowRoles.length > 0) {
    if (role !== "super_admin" && (!role || !allowRoles.includes(role as any))) {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
