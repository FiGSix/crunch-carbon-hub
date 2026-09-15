import { formatSystemSizeForDisplay } from "@/lib/calculations/carbon/normalization";
import type { ProjectInformation } from "@/types/proposals";

/**
 * Stored project information must hold the system size as a plain number.
 *
 * Users type values such as "10.8 kWp" or "1 MWp" into the size field. Storing
 * that raw text made every downstream reader (duplicate detection, reporting)
 * parse display strings. We store the resolved kWp value instead and keep the
 * human wording in a separate display field.
 */
export function normalizeProjectInfoForStorage<T extends ProjectInformation>(
  projectInfo: T,
  systemSizeKWp: number,
): T & { size_display: string } {
  const numericSize = Number.isFinite(systemSizeKWp) ? systemSizeKWp : 0;

  return {
    ...projectInfo,
    size: String(numericSize),
    size_display: formatSystemSizeForDisplay(numericSize),
  };
}
