import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  UserPlus, 
  Bell,
  Settings,
  LogOut,
  User,
  UserCog,
  FileSignature,
  ClipboardCheck,
  Shield,
  UserCheck,
  Database,
  Mail,
  Scale,
  Calculator,
  Code2,
  BookOpen,
  ShieldOff,
  Megaphone,
  TrendingUp,
  BarChart3,
  SearchCheck

} from "lucide-react";
import { useAuth } from "@/contexts/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function DashboardSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const navItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["admin", "agent", "client"]
    },
    {
      name: "Dashboard",
      href: "/super-partner/dashboard",
      icon: LayoutDashboard,
      roles: ["super_partner"]
    },
    {
      name: "Profile",
      href: "/profile",
      icon: User,
      roles: ["admin", "agent", "client", "super_partner"]
    },
    {
      name: "Team",
      href: "/team",
      icon: UserCheck,
      roles: ["admin", "agent", "super_partner"]
    },
    {
      name: "Quick Calc",
      href: "/quick-calc",
      icon: Calculator,
      roles: ["admin", "agent", "super_partner"]
    },
    {
      name: "Knowledge Hub",
      href: "/knowledge-hub",
      icon: BookOpen,
      roles: ["admin", "agent", "super_partner"]
    },
    {
      name: "Proposals",
      href: "/proposals",
      icon: FileText,
      roles: ["admin", "agent", "client", "super_partner"]
    },
    {
      name: "Create Proposal",
      href: "/create-proposal",
      icon: FileText,
      roles: ["admin", "agent"]
    },
    {
      name: "Create Proposal",
      href: "/create-proposal",
      icon: FileText,
      roles: ["super_partner"],
      gate: (p: any) => p?.can_create_proposals === true,
    },
    {
      name: "Project Onboarding",
      href: "/onboarding",
      icon: ClipboardCheck,
      roles: ["admin", "agent", "client", "super_partner"]
    },
    {
      name: "Submit a Project",
      href: "/submit-project",
      icon: FileText,
      roles: ["client"]
    },
    {
      name: "Vintage & Revenue",
      href: "/vintage-revenue",
      icon: TrendingUp,
      roles: ["admin", "agent", "client", "super_partner"]
    },
    {
      name: "Pipeline Analytics",
      href: "/admin/analytics",
      icon: BarChart3,
      roles: ["admin"]
    },
    {
      name: "Audit Status",
      href: "/admin/audit-status",
      icon: ClipboardCheck,
      roles: ["admin"]
    },
    {
      name: "Duplicate Reviews",
      href: "/admin/duplicate-reviews",
      icon: SearchCheck,
      roles: ["admin"]
    },
    {
      name: "My Clients",
      href: "/my-clients",
      icon: Users,
      roles: ["admin", "agent"]
    },
    {
      name: "My Clients",
      href: "/my-clients",
      icon: Users,
      roles: ["super_partner"],
      gate: (p: any) => p?.can_create_proposals === true,
    },
    {
      name: "My Companies",
      href: "/super-partner/my-companies",
      icon: Users,
      roles: ["super_partner"]
    },
    {
      name: "Commission",
      href: "/super-partner/commission",
      icon: FileText,
      roles: ["super_partner"]
    },
    {
      name: "Notifications",
      href: "/notifications",
      icon: Bell,
      roles: ["admin", "agent", "client", "super_partner"]
    },
    {
      name: "Team",
      href: "/client-team",
      icon: UserCheck,
      roles: ["client"]
    },
    {
      name: "Refer a Friend",
      href: "/referral",
      icon: UserPlus,
      roles: ["client"]
    },
    {
      name: "Partner Management",
      href: "/admin/agents",
      icon: UserCog,
      roles: ["admin"]
    },
    {
      name: "Super Partners",
      href: "/admin/super-partners",
      icon: Shield,
      roles: ["admin"]
    },
    {
      name: "User Management",
      href: "/admin/users",
      icon: Shield,
      roles: ["admin"]
    },
    {
      name: "Digital Signatures",
      href: "/admin/signatures",
      icon: FileSignature,
      roles: ["admin"]
    },
    {
      // Temporary: remove together with /admin/agreement-recovery once the
      // missing-agreement backlog is cleared.
      name: "Agreement Recovery",
      href: "/admin/agreement-recovery",
      icon: FileSignature,
      roles: ["admin"]
    },
    {
      name: "Email Automation",
      href: "/admin/email-automation",
      icon: Mail,
      roles: ["admin"]
    },
    {
      name: "Broadcasts",
      href: "/admin/broadcasts",
      icon: Megaphone,
      roles: ["admin"]
    },
    {
      name: "Blocked Emails",
      href: "/admin/blocked-emails",
      icon: ShieldOff,
      roles: ["admin"]
    },
    {
      name: "Legal Documents",
      href: "/admin/legal-documents",
      icon: Scale,
      roles: ["admin"]
    },
    {
      name: "Partner API",
      href: "/admin/partners",
      icon: Code2,
      roles: ["admin"]
    },
    {
      name: "Knowledge Hub Mgmt",
      href: "/admin/knowledge-hub",
      icon: BookOpen,
      roles: ["admin"]
    },
    {
      name: "System Settings",
      href: "/system-settings",
      icon: Settings,
      roles: ["admin"]
    },
    {
      name: "System Diagnostics",
      href: "/system-diagnostics",
      icon: Settings,
      roles: ["admin"]
    },
    {
      name: "Data Diagnostics",
      href: "/admin/data-diagnostics",
      icon: Database,
      roles: ["admin"]
    }
  ];

  // Filter nav items based on user role and optional per-item gate.
  // Defense-in-depth: a suspended Super Partner should never see SP-only items
  // even if their role somehow still reads as 'super_partner'.
  const isSuspendedSP = profile?.super_partner_status === 'suspended';
  const filteredNavItems = navItems.filter((item: any) => {
    if (!profile?.role || !item.roles.includes(profile.role)) return false;
    if (isSuspendedSP && item.roles.length === 1 && item.roles[0] === 'super_partner') return false;
    return !item.gate || item.gate(profile);
  });

  return (
    <Sidebar className="border-r border-gray-200 bg-white">
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive(item.href)}
                      className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-gray-100 ${
                        isActive(item.href)
                          ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                          : "text-gray-700 hover:text-gray-900"
                      }`}
                    >
                      <Link to={item.href} className="flex items-center w-full">
                        <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              
              {/* Separator */}
              <li className="my-2">
                <hr className="border-gray-200" />
              </li>
              
              {/* Sign Out Button */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleSignOut}
                  className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
