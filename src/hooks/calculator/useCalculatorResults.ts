import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseEdgeFunctionError } from "@/lib/errors/edgeFunctionErrors";

interface SendCalculatorResultsParams {
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyName?: string;
  systemSizeKwp: number;
  commissioningDate: string;
  referralCode?: string;
  address?: string;
  addressLat?: number;
  addressLng?: number;
  province?: string;
  segment?: string;
  sendEmail?: boolean;
}

export interface CalculatorResultsResponse {
  success: true;
  proposalId: string;
  token: string;
  message: string;
  emailDelivered: boolean;
}

export const useSendCalculatorResults = () => {
  return useMutation({
    mutationFn: async (params: SendCalculatorResultsParams) => {
      const { data, error } = await supabase.functions.invoke("send-calculator-results", {
        body: {
          email: params.email,
          name: params.name,
          firstName: params.firstName,
          lastName: params.lastName,
          phone: params.phone,
          companyName: params.companyName,
          systemSizeKwp: params.systemSizeKwp,
          commissioningDate: params.commissioningDate,
          referralCode: params.referralCode,
          address: params.address,
          addressLat: params.addressLat,
          addressLng: params.addressLng,
          province: params.province,
          segment: params.segment,
          sendEmail: params.sendEmail,
          ipAddress: null,
          userAgent: navigator.userAgent,
        },
      });

      if (error) {
        const message = await parseEdgeFunctionError(error, "Could not send your proposal. Please try again.");
        throw new Error(message);
      }
      const response = data as Partial<CalculatorResultsResponse> | null;
      if (!response?.success || !response.proposalId || !response.token) {
        throw new Error("Your proposal was not completed. Please try again.");
      }
      return response as CalculatorResultsResponse;
    },
  });
};
