
import { useRegisterForm } from "@/hooks/useRegisterForm";
import { RegisterRoleSelect } from "./RegisterRoleSelect";
import { RegisterPersonalInfo } from "./RegisterPersonalInfo";
import { RegisterCredentials } from "./RegisterCredentials";
import { RegisterTerms } from "./RegisterTerms";
import { RegisterSubmitButton } from "./RegisterSubmitButton";
import { FormErrorBoundary } from '@/components/error/FormErrorBoundary';

interface RegisterFormProps {
  initialRole: "client" | "agent";
  /** When set, the role picker is hidden and role is forced to this value (e.g. SP recruit links). */
  lockedRole?: "agent";
  invitationToken?: string;
  prefilledEmail?: string;
}

export const RegisterForm = ({ initialRole, lockedRole, invitationToken, prefilledEmail }: RegisterFormProps) => {
  const effectiveInitialRole = lockedRole ?? initialRole;
  const {
    formData,
    termsAccepted,
    termsDialogOpen,
    privacyDialogOpen,
    isLoading,
    setTermsAccepted,
    setTermsDialogOpen,
    setPrivacyDialogOpen,
    handleChange,
    handleRoleChange,
    handleSubmit,
    handleTermsAccept,
    invitedEmail,
    cooldownSeconds
  } = useRegisterForm(effectiveInitialRole, invitationToken, prefilledEmail);

  return (
    <FormErrorBoundary formName="Registration Form">
      <form onSubmit={handleSubmit}>
      <div className="space-y-6">
        {lockedRole ? (
          <div className="rounded-md border border-carbon-green-200 bg-carbon-green-50 px-4 py-3 text-sm text-carbon-green-900">
            You're joining as a <span className="font-semibold">Partner</span> via a referral link.
          </div>
        ) : (
          <RegisterRoleSelect
            role={formData.role}
            onRoleChange={handleRoleChange}
            disabled={isLoading}
          />
        )}

        <RegisterPersonalInfo 
          firstName={formData.firstName}
          lastName={formData.lastName}
          companyName={formData.companyName}
          showCompanyField={formData.role === "agent"}
          onChange={handleChange}
          disabled={isLoading}
        />
        
        <RegisterCredentials 
          email={formData.email}
          password={formData.password}
          confirmPassword={formData.confirmPassword}
          onChange={handleChange}
          disabled={isLoading}
          emailReadOnly={invitedEmail !== null}
        />
        
        <RegisterTerms 
          showAgentTerms={formData.role === "agent"}
          termsAccepted={termsAccepted}
          setTermsAccepted={setTermsAccepted}
          termsDialogOpen={termsDialogOpen}
          setTermsDialogOpen={setTermsDialogOpen}
          privacyDialogOpen={privacyDialogOpen}
          setPrivacyDialogOpen={setPrivacyDialogOpen}
          onTermsAccept={(docId, version) => handleTermsAccept(docId, version)}
          isLoading={isLoading}
        />
        
        <RegisterSubmitButton isLoading={isLoading} />
      </div>
      </form>
    </FormErrorBoundary>
  );
};
