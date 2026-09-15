import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseEdgeFunctionError } from "@/lib/errors/edgeFunctionErrors";

interface SendCalculatorResultsParams {
  email: string;
  name?: string;
  systemSizeKwp: number;
  commissioningDate: string;
  referralCode?: string;
  address?: string;
  province?: string;
  segment?: string;
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
          systemSizeKwp: params.systemSizeKwp,
          commissioningDate: params.commissioningDate,
          referralCode: params.referralCode,
          address: params.address,
          province: params.province,
          segment: params.segment,
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
