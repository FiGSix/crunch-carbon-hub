
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth";
import { AuthNavigationHandler } from "@/components/auth/AuthNavigationHandler";
import { AuthErrorBoundary } from "@/components/auth/AuthErrorBoundary";
import { PrivateRoute } from "@/components/auth/PrivateRoute";
import { AgentApprovalGuard } from "@/components/auth/AgentApprovalGuard";
import { AuthStatusMonitor } from "@/components/auth/AuthStatusMonitor";
import { InactivityMonitor } from "@/components/auth/InactivityMonitor";
import { FloatingShareButton } from "@/components/referral/FloatingShareButton";
import { ErrorBoundary } from "@/components/error/ErrorBoundary";
import { PageErrorBoundary } from "@/components/error/PageErrorBoundary";
import { Suspense, lazy, useEffect } from "react";
import { createOptimizedLazyComponent, withOptimizedRouteLoading } from "@/lib/performance/OptimizedLoader";
// Only import diagnostics in development
const DisplayDiagnostics = import.meta.env.DEV 
  ? lazy(() => import("@/components/diagnostics/DisplayDiagnostics").then(m => ({ default: m.DisplayDiagnostics })))
  : null;
import { logger } from '@/lib/logger';

// Immediate load for critical public pages only
import NotFound from "./pages/NotFound";
// Eager-load homepage so the hero renders without a chunk fetch round-trip
import Index from "./pages/Index";

// Lazy load auth pages to reduce initial bundle (not needed on homepage)
const Login = createOptimizedLazyComponent(() => import("./pages/Login"), "Login");
const Register = createOptimizedLazyComponent(() => import("./pages/Register"), "Register");
const ForgotPassword = createOptimizedLazyComponent(() => import("./pages/ForgotPassword"), "ForgotPassword");
const AuthCallback = createOptimizedLazyComponent(() => import("./pages/AuthCallback"), "AuthCallback");


// Optimized lazy loading with error handling and performance tracking
const ResetPassword = createOptimizedLazyComponent(() => import("./pages/ResetPassword"), "ResetPassword");
const About = createOptimizedLazyComponent(() => import("./pages/About"), "About");
const Contact = createOptimizedLazyComponent(() => import("./pages/Contact"), "Contact");
const Calculator = createOptimizedLazyComponent(() => import("./pages/Calculator"), "Calculator");
const QuickCalc = createOptimizedLazyComponent(() => import("./pages/QuickCalc"), "QuickCalc");
const SolarRewards = createOptimizedLazyComponent(() => import("./pages/SolarRewards"), "SolarRewards");
const Agents = createOptimizedLazyComponent(() => import("./pages/Agents"), "Agents");
const Business = createOptimizedLazyComponent(() => import("./pages/Business"), "Business");
const Marketplace = createOptimizedLazyComponent(() => import("./pages/Marketplace"), "Marketplace");
const VerifyEmail = createOptimizedLazyComponent(() => import("./pages/VerifyEmail"), "VerifyEmail");
const ForceLogout = createOptimizedLazyComponent(() => import("./pages/ForceLogout"), "ForceLogout");

const SystemDiagnostics = createOptimizedLazyComponent(() => import("./pages/SystemDiagnostics"), "SystemDiagnostics");

// Optimized lazy load protected pages
const Dashboard = createOptimizedLazyComponent(() => import("./pages/Dashboard"), "Dashboard");
const CreateProposal = createOptimizedLazyComponent(() => import("./pages/CreateProposal"), "CreateProposal");
const ProposalsOptimized = createOptimizedLazyComponent(() => import("./pages/ProposalsOptimized"), "ProposalsOptimized");
const WhyChooseUs = createOptimizedLazyComponent(() => import("./pages/WhyChooseUs"), "WhyChooseUs");
const Profile = createOptimizedLazyComponent(() => import("./pages/Profile"), "Profile");
const MyClients = createOptimizedLazyComponent(() => import("./pages/MyClients2"), "MyClients");
const SystemSettings = createOptimizedLazyComponent(() => import("./pages/SystemSettings"), "SystemSettings");
const Notifications = createOptimizedLazyComponent(() => import("./pages/Notifications"), "Notifications");
const AdminAgentManagement = createOptimizedLazyComponent(() => import("./pages/AdminAgentManagement"), "AdminAgentManagement");
const AdminUserManagement = createOptimizedLazyComponent(() => import("./pages/AdminUserManagement"), "AdminUserManagement");
const AdminCompanyDetail = createOptimizedLazyComponent(() => import("./pages/AdminCompanyDetail"), "AdminCompanyDetail");
const ViewProposalPage = createOptimizedLazyComponent(() => import("./pages/ViewProposal/ViewProposalPage"), "ViewProposalPage");
const ProposalAcceptance = createOptimizedLazyComponent(() => import("./pages/ProposalAcceptance/index"), "ProposalAcceptance");
const ProposalDecline = createOptimizedLazyComponent(() => import("./pages/ProposalDecline"), "ProposalDecline");
const AdminSignatures = createOptimizedLazyComponent(() => import("./pages/AdminSignatures"), "AdminSignatures");
const AdminAgreementRecovery = createOptimizedLazyComponent(() => import("./pages/AdminAgreementRecovery"), "AdminAgreementRecovery");
const DataDiagnostics = createOptimizedLazyComponent(() => import("./pages/admin/DataDiagnostics"), "DataDiagnostics");
const EmailAutomation = createOptimizedLazyComponent(() => import("./pages/admin/EmailAutomation"), "EmailAutomation");
const ProjectOnboardingList = createOptimizedLazyComponent(() => import("./pages/ProjectOnboardingList"), "ProjectOnboardingList");
const ProjectOnboardingDetail = createOptimizedLazyComponent(() => import("./pages/ProjectOnboardingDetail"), "ProjectOnboardingDetail");
const TeamManagement = createOptimizedLazyComponent(() => import("./pages/TeamManagement"), "TeamManagement");
const ClientTeamManagement = createOptimizedLazyComponent(() => import("./pages/ClientTeamManagement"), "ClientTeamManagement");
const Referral = createOptimizedLazyComponent(() => import("./pages/Referral"), "Referral");
const LegalDocuments = createOptimizedLazyComponent(() => import("./pages/Admin/LegalDocuments"), "LegalDocuments");
const AuditStatus = createOptimizedLazyComponent(() => import("./pages/admin/AuditStatus"), "AuditStatus");
const PartnerManagement = createOptimizedLazyComponent(() => import("./pages/admin/PartnerManagement"), "PartnerManagement");

const SubmitProject = createOptimizedLazyComponent(() => import("./pages/SubmitProject"), "SubmitProject");
const KnowledgeHub = createOptimizedLazyComponent(() => import("./pages/KnowledgeHub"), "KnowledgeHub");
const KnowledgeHubAdmin = createOptimizedLazyComponent(() => import("./pages/admin/KnowledgeHubAdmin"), "KnowledgeHubAdmin");
const BlockedEmails = createOptimizedLazyComponent(() => import("./pages/admin/BlockedEmails"), "BlockedEmails");
const Broadcasts = createOptimizedLazyComponent(() => import("./pages/admin/Broadcasts"), "Broadcasts");
const ProposalDuplicateReviews = createOptimizedLazyComponent(() => import("./pages/admin/ProposalDuplicateReviews"), "ProposalDuplicateReviews");
const AdminSuperPartnerManagement = createOptimizedLazyComponent(() => import("./pages/AdminSuperPartnerManagement"), "AdminSuperPartnerManagement");
const SuperPartnerDashboard = createOptimizedLazyComponent(() => import("./pages/SuperPartnerDashboard"), "SuperPartnerDashboard");
const SuperPartnerMyCompanies = createOptimizedLazyComponent(() => import("./pages/SuperPartnerMyCompanies"), "SuperPartnerMyCompanies");
const PartnerReferralLandingPage = createOptimizedLazyComponent(() => import("./pages/PartnerReferralLandingPage"), "PartnerReferralLandingPage");
const AdminReferralLinks = createOptimizedLazyComponent(() => import("./pages/admin/AdminReferralLinks"), "AdminReferralLinks");
const SuperPartnerCommission = createOptimizedLazyComponent(() => import("./pages/SuperPartnerCommission"), "SuperPartnerCommission");
const PipelineAnalytics = createOptimizedLazyComponent(() => import("./pages/admin/PipelineAnalytics"), "PipelineAnalytics");
const VintageInsights = createOptimizedLazyComponent(() => import("./pages/VintageInsights"), "VintageInsights");

// Import the standardized loading component
import { PageLoading } from '@/components/ui/loading-states';

// Standardized page loader component
const PageLoader = () => <PageLoading minimal />;

import { createQueryClient } from "@/lib/queryClient";

// Create optimized query client
const queryClient = createQueryClient();

/**
 * Recovery Redirect Shim - Ensures password reset links always land on /reset-password
 * Supabase may redirect to Site URL (/) with recovery hash, this catches and fixes it
 */
function RecoveryRedirectShim() {
  const location = useLocation();
  
  useEffect(() => {
    const hash = window.location.hash;
    
    // Redirect to /reset-password if hash contains recovery-related params
    if (location.pathname !== '/reset-password' && hash && (
      hash.includes('access_token=') ||
      hash.includes('type=recovery') ||
      hash.includes('error=') ||
      hash.includes('error_code=')
    )) {
      window.location.replace(`/reset-password${hash}`);
    }
  }, [location.pathname]);
  
  return null;
}

function SignupRedirect() {
  const location = useLocation();
  return <Navigate to={`/register${location.search}`} replace />;
}


function App() {
  // Diagnostic logging in development only
  logger.info("Application initializing");
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthErrorBoundary>
              <AuthProvider>
                <RecoveryRedirectShim />
                <AuthNavigationHandler />
                <TooltipProvider>
                {import.meta.env.DEV && DisplayDiagnostics && (
                  <Suspense fallback={null}>
                    <DisplayDiagnostics />
                  </Suspense>
                )}
                <AuthStatusMonitor />
                <InactivityMonitor />
                <Sonner />
                <FloatingShareButton />
                <Routes>
                  {/* Public routes - wrapped with page error boundaries */}
                  <Route path="/" element={
                    <PageErrorBoundary pageName="Home">
                      <Index />
                    </PageErrorBoundary>
                  } />
                  
                  <Route path="/about" element={
                    <PageErrorBoundary pageName="About">
                      <Suspense fallback={<PageLoader />}><About /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/contact" element={
                    <PageErrorBoundary pageName="Contact">
                      <Suspense fallback={<PageLoader />}><Contact /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/calculator" element={
                    <PageErrorBoundary pageName="Calculator">
                      <Suspense fallback={<PageLoader />}><Calculator /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/ref/:token" element={
                    <PageErrorBoundary pageName="Referral Landing">
                      <Suspense fallback={<PageLoader />}><PartnerReferralLandingPage /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/admin/referral-links" element={
                    <PrivateRoute allowedRoles={["admin"]}>
                      <PageErrorBoundary pageName="Admin Referral Links">
                        <Suspense fallback={<PageLoader />}><AdminReferralLinks /></Suspense>
                      </PageErrorBoundary>
                    </PrivateRoute>
                  } />
                  <Route 
                    path="/quick-calc" 
                    element={
                      <PrivateRoute allowedRoles={['agent', 'admin', 'super_partner']}>
                        <AgentApprovalGuard>
                          <PageErrorBoundary pageName="Quick Calc">
                            <Suspense fallback={<PageLoader />}>
                              <QuickCalc />
                            </Suspense>
                          </PageErrorBoundary>
                        </AgentApprovalGuard>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/knowledge-hub" 
                    element={
                      <PrivateRoute allowedRoles={['agent', 'admin', 'super_partner']}>
                        <AgentApprovalGuard>
                          <PageErrorBoundary pageName="Knowledge Hub">
                            <Suspense fallback={<PageLoader />}>
                              <KnowledgeHub />
                            </Suspense>
                          </PageErrorBoundary>
                        </AgentApprovalGuard>
                      </PrivateRoute>
                    }
                  />
  <Route path="/home-owners" element={
    <PageErrorBoundary pageName="SolarRewards">
      <Suspense fallback={<PageLoader />}><SolarRewards /></Suspense>
    </PageErrorBoundary>
  } />
                  <Route path="/agents" element={
                    <PageErrorBoundary pageName="Agents">
                      <Suspense fallback={<PageLoader />}><Agents /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/business" element={
                    <PageErrorBoundary pageName="Business">
                      <Suspense fallback={<PageLoader />}><Business /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/marketplace" element={
                    <PageErrorBoundary pageName="Marketplace">
                      <Suspense fallback={<PageLoader />}><Marketplace /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/why-choose-us" element={
                    <PageErrorBoundary pageName="Why Choose Us">
                      <Suspense fallback={<PageLoader />}><WhyChooseUs /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/login" element={
                    <PageErrorBoundary pageName="Login">
                      <Suspense fallback={<PageLoader />}><Login /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/signup" element={<SignupRedirect />} />
                  <Route path="/register" element={
                    <PageErrorBoundary pageName="Register">
                      <Suspense fallback={<PageLoader />}><Register /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/forgot-password" element={
                    <PageErrorBoundary pageName="Forgot Password">
                      <Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/reset-password" element={
                    <PageErrorBoundary pageName="Reset Password">
                      <Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/auth/callback" element={
                    <PageErrorBoundary pageName="Auth Callback">
                      <Suspense fallback={<PageLoader />}><AuthCallback /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/verify-email" element={
                    <PageErrorBoundary pageName="Verify Email">
                      <Suspense fallback={<PageLoader />}><VerifyEmail /></Suspense>
                    </PageErrorBoundary>
                  } />
                  <Route path="/force-logout" element={
                    <PageErrorBoundary pageName="Force Logout">
                      <Suspense fallback={<PageLoader />}><ForceLogout /></Suspense>
                    </PageErrorBoundary>
                  } />
                  
                  
                  {/* Proposal viewing - accessible with token */}
                  <Route path="/proposals/:id" element={
                    <PageErrorBoundary pageName="View Proposal">
                      <Suspense fallback={<PageLoader />}><ViewProposalPage /></Suspense>
                    </PageErrorBoundary>
                  } />
                  
                  {/* Proposal acceptance - digital signature flow */}
                  <Route path="/proposals/:id/accept" element={
                    <PageErrorBoundary pageName="Proposal Acceptance">
                      <Suspense fallback={<PageLoader />}>
                        <ProposalAcceptance />
                      </Suspense>
                    </PageErrorBoundary>
                  } />

                  {/* Proposal decline - token-authorised confirmation */}
                  <Route path="/proposals/:id/decline" element={
                    <PageErrorBoundary pageName="Proposal Decline">
                      <Suspense fallback={<PageLoader />}>
                        <ProposalDecline />
                      </Suspense>
                    </PageErrorBoundary>
                  } />
                  
                  
                  {/* Protected routes - wrapped with page error boundaries */}
                  <Route 
                    path="/dashboard" 
                    element={
                      <PrivateRoute>
                        <PageErrorBoundary pageName="Dashboard">
                          <Suspense fallback={<PageLoader />}>
                            <Dashboard />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                />
                  <Route 
                    path="/create-proposal" 
                    element={
                      <PrivateRoute allowedRoles={['agent', 'admin', 'super_partner']}>
                        <AgentApprovalGuard>
                          <PageErrorBoundary pageName="Create Proposal">
                            <Suspense fallback={<PageLoader />}>
                              <CreateProposal />
                            </Suspense>
                          </PageErrorBoundary>
                        </AgentApprovalGuard>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/proposals" 
                    element={
                      <PrivateRoute>
                        <PageErrorBoundary pageName="Proposals">
                          <Suspense fallback={<PageLoader />}>
                            <ProposalsOptimized />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route
                    path="/admin/analytics"
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Pipeline Analytics">
                          <Suspense fallback={<PageLoader />}>
                            <PipelineAnalytics />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/vintage-revenue"
                    element={
                      <PrivateRoute>
                        <PageErrorBoundary pageName="Vintage and Revenue">
                          <Suspense fallback={<PageLoader />}>
                            <VintageInsights />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />

                  <Route 
                    path="/profile" 
                    element={
                      <PrivateRoute>
                        <PageErrorBoundary pageName="Profile">
                          <Suspense fallback={<PageLoader />}>
                            <Profile />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/my-clients" 
                    element={
                      <PrivateRoute allowedRoles={['agent', 'admin', 'super_partner']}>
                        <AgentApprovalGuard>
                          <PageErrorBoundary pageName="My Clients">
                            <Suspense fallback={<PageLoader />}>
                              <MyClients />
                            </Suspense>
                          </PageErrorBoundary>
                        </AgentApprovalGuard>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/team" 
                    element={
                      <PrivateRoute allowedRoles={['agent', 'admin', 'super_partner']}>
                        <AgentApprovalGuard>
                          <PageErrorBoundary pageName="Team Management">
                            <Suspense fallback={<PageLoader />}>
                              <TeamManagement />
                            </Suspense>
                          </PageErrorBoundary>
                        </AgentApprovalGuard>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/system-settings" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="System Settings">
                          <Suspense fallback={<PageLoader />}>
                            <SystemSettings />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  {/* Admin-only system diagnostics */}
                  <Route 
                    path="/system-diagnostics" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="System Diagnostics">
                          <Suspense fallback={<PageLoader />}>
                            <SystemDiagnostics />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/admin/agents" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Agent Management">
                          <Suspense fallback={<PageLoader />}>
                            <AdminAgentManagement />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/admin/legal-documents" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Legal Documents">
                          <Suspense fallback={<PageLoader />}>
                            <LegalDocuments />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/admin/knowledge-hub" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Knowledge Hub Admin">
                          <Suspense fallback={<PageLoader />}>
                            <KnowledgeHubAdmin />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />
                  <Route 
                    path="/admin/partners" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Partner Management">
                          <Suspense fallback={<PageLoader />}>
                            <PartnerManagement />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/admin/users" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="User Management">
                          <Suspense fallback={<PageLoader />}>
                            <AdminUserManagement />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route
                    path="/admin/companies/:companyId"
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Company Detail">
                          <Suspense fallback={<PageLoader />}>
                            <AdminCompanyDetail />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />
                  <Route 
                    path="/admin/signatures" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Digital Signatures">
                          <Suspense fallback={<PageLoader />}>
                            <AdminSignatures />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/admin/data-diagnostics" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Data Diagnostics">
                          <Suspense fallback={<PageLoader />}>
                            <DataDiagnostics />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/admin/email-automation" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Email Automation">
                          <Suspense fallback={<PageLoader />}>
                            <EmailAutomation />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route
                    path="/admin/broadcasts"
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Broadcasts">
                          <Suspense fallback={<PageLoader />}>
                            <Broadcasts />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/admin/duplicate-reviews"
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Duplicate Project Reviews">
                          <Suspense fallback={<PageLoader />}>
                            <ProposalDuplicateReviews />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/admin/blocked-emails"
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Blocked Emails">
                          <Suspense fallback={<PageLoader />}>
                            <BlockedEmails />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />
                  <Route 
                    path="/admin/audit-status" 
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Audit Status">
                          <Suspense fallback={<PageLoader />}>
                            <AuditStatus />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route
                    path="/notifications"
                    element={
                      <PrivateRoute>
                        <PageErrorBoundary pageName="Notifications">
                          <Suspense fallback={<PageLoader />}>
                            <Notifications />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/referral" 
                    element={
                      <PrivateRoute allowedRoles={['client']}>
                        <PageErrorBoundary pageName="Referral">
                          <Suspense fallback={<PageLoader />}>
                            <Referral />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/submit-project" 
                    element={
                      <PrivateRoute allowedRoles={['client']}>
                        <PageErrorBoundary pageName="Submit Project">
                          <Suspense fallback={<PageLoader />}>
                            <SubmitProject />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/client-team" 
                    element={
                      <PrivateRoute allowedRoles={['client']}>
                        <PageErrorBoundary pageName="Client Team Management">
                          <Suspense fallback={<PageLoader />}>
                            <ClientTeamManagement />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/onboarding"
                    element={
                      <PrivateRoute>
                        <PageErrorBoundary pageName="Project Onboarding">
                          <Suspense fallback={<PageLoader />}>
                            <ProjectOnboardingList />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route 
                    path="/onboarding/:projectId" 
                    element={
                      <PrivateRoute>
                        <PageErrorBoundary pageName="Project Detail">
                          <Suspense fallback={<PageLoader />}>
                            <ProjectOnboardingDetail />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    } 
                  />
                  <Route
                    path="/admin/super-partners"
                    element={
                      <PrivateRoute allowedRoles={['admin']}>
                        <PageErrorBoundary pageName="Super Partner Management">
                          <Suspense fallback={<PageLoader />}>
                            <AdminSuperPartnerManagement />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/super-partner/dashboard"
                    element={
                      <PrivateRoute allowedRoles={['super_partner', 'admin']}>
                        <PageErrorBoundary pageName="Super Partner Dashboard">
                          <Suspense fallback={<PageLoader />}>
                            <SuperPartnerDashboard />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/super-partner/my-companies"
                    element={
                      <PrivateRoute allowedRoles={['super_partner', 'admin']}>
                        <PageErrorBoundary pageName="Super Partner Companies">
                          <Suspense fallback={<PageLoader />}>
                            <SuperPartnerMyCompanies />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />
                  <Route
                    path="/super-partner/commission"
                    element={
                      <PrivateRoute allowedRoles={['super_partner', 'admin']}>
                        <PageErrorBoundary pageName="Super Partner Commission">
                          <Suspense fallback={<PageLoader />}>
                            <SuperPartnerCommission />
                          </Suspense>
                        </PageErrorBoundary>
                      </PrivateRoute>
                    }
                  />

                {/* Catch all route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
            </AuthProvider>
          </AuthErrorBoundary>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
