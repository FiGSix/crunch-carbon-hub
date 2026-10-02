
import { ReactNode, useMemo } from "react";
import { 
  SidebarProvider, 
  SidebarTrigger,
  SidebarInset
} from "@/components/ui/sidebar";
import { DashboardSidebar } from "./DashboardSidebar";
import { cn } from "@/lib/utils";
import { Footer } from "./footer";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/auth"; 
import { Navigate, useNavigate } from "react-router-dom";
import { PageLoading } from '@/components/ui/loading-states';
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { componentLogger } from '@/lib/logger';
import { roleLandingPath } from '@/lib/auth/roleLanding';
import { SandboxBar } from '@/components/sandbox/SandboxBar';

interface DashboardLayoutProps {
  children: ReactNode;
  requiredRole?: 'client' | 'agent' | 'admin' | 'super_partner';
}

export function DashboardLayout({ 
  children, 
  requiredRole 
}: DashboardLayoutProps) {
  const { userRole, isLoading, isInitialized, profile, user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Performance optimization: Memoize computed values with redirect protection
  const { hasAccess, shouldRedirect, dashboardTitle, userInitials } = useMemo(() => {
    // Defense-in-depth: a suspended Super Partner cannot enter SP-gated routes.
    const isSuspendedSP = profile?.super_partner_status === 'suspended';
    const blockedAsSuspendedSP = requiredRole === 'super_partner' && isSuspendedSP && userRole !== 'admin';
    const hasRequiredRole = !blockedAsSuspendedSP && (!requiredRole || userRole === 'admin' || userRole === requiredRole);
    
    let title = 'DASHBOARD';
    if (userRole === 'client') title = isMobile ? 'CLIENT' : 'CLIENT DASHBOARD';
    else if (userRole === 'agent') title = isMobile ? 'AGENT' : 'AGENT DASHBOARD';
    else if (userRole === 'admin') title = isMobile ? 'ADMIN' : 'ADMIN DASHBOARD';
    else if (userRole === 'super_partner') title = isMobile ? 'PARTNER' : 'SUPER PARTNER';

    const initials = profile?.first_name?.[0]?.toUpperCase() || userRole?.[0]?.toUpperCase() || '?';

    // Only redirect if both user and role are missing (not just loading)
    const shouldRedirectToLogin = !isInitialized || (!user && !isLoading);

    return {
      hasAccess: hasRequiredRole,
      shouldRedirect: shouldRedirectToLogin,
      dashboardTitle: title,
      userInitials: initials
    };
  }, [userRole, requiredRole, isMobile, profile, user, isInitialized, isLoading]);

  componentLogger.debug('DashboardLayout render', { 
    userRole, 
    isLoading, 
    isInitialized, 
    hasProfile: !!profile,
    hasUser: !!user,
    requiredRole,
    hasAccess
  });

  // Show loading state while authentication is initializing
  if (!isInitialized || isLoading) {
    return (
      <PageLoading 
        title="Loading dashboard..."
        description="Setting up your workspace"
      />
    );
  }

  // Redirect to login if not authenticated
  if (shouldRedirect) {
    componentLogger.info('User not authenticated in dashboard, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  // Check role-based access
  if (!hasAccess) {
    // A suspended Super Partner is blocked from SP routes, so send them to the
    // generic dashboard instead of looping back onto their own landing page.
    const fallback = requiredRole === 'super_partner' ? '/dashboard' : roleLandingPath(userRole);
    componentLogger.warn('Insufficient role for dashboard access, redirecting', { to: fallback });
    return <Navigate to={fallback} replace />;
  }


  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <DashboardSidebar />
        
        <SidebarInset className="flex-1">
          <SandboxBar />
          <motion.header 
            className={cn(
              "h-14 md:h-16 border-b border-gray-200 flex items-center px-3 md:px-4 bg-white shadow-sm",
              "sticky top-0 z-30"
            )}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }} // Reduced from 0.3s for snappier feel
          >
            <SidebarTrigger className="hover:bg-blue-50 rounded-lg p-2 transition-colors duration-200 touch-manipulation" />
            <div className={cn(
              "ml-2 md:ml-4 font-bold uppercase tracking-wide text-gray-900",
              isMobile ? "text-sm" : "text-lg"
            )}>
              {dashboardTitle}
            </div>
            <div className="ml-auto flex items-center gap-2 md:gap-4">
              <NotificationBell />
              <Button 
                variant="ghost" 
                size="sm"
                className="rounded-full p-0 h-8 w-8 md:h-9 md:w-9 flex items-center justify-center hover:bg-blue-50 touch-manipulation"
                onClick={() => navigate('/profile')}
              >
                <Avatar className="h-7 w-7 md:h-8 md:w-8">
                  {profile?.avatar_url && (
                    <AvatarImage 
                      src={profile.avatar_url} 
                      alt={profile?.first_name || 'Profile'} 
                    />
                  )}
                  <AvatarFallback className="bg-blue-100 text-blue-700 font-medium text-xs md:text-sm">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </div>
          </motion.header>
          
          <motion.main 
            className={cn(
              "flex-1 bg-gray-50 overflow-visible",
              isMobile ? "p-3" : "p-4 md:p-6 lg:p-8"
            )}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, delay: 0.05 }} // Faster animations
          >
            {children}
          </motion.main>
          
          <Footer />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
