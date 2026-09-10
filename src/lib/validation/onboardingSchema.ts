import { z } from "zod";

// Inverter detail schema
export const inverterDetailSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  capacity_kw: z.number({ required_error: "Capacity is required" }).positive("Capacity must be positive"),
  serial: z.string().min(3, "Serial must be at least 3 characters"),
});

export type InverterDetailValidation = z.infer<typeof inverterDetailSchema>;

// Panel array detail schema
export const panelArrayDetailSchema = z.object({
  brand: z.string().min(1, "Brand is required"),
  size_wp: z.number({ required_error: "Size is required" }).min(50, "Size must be at least 50 Wp").max(1000, "Size must be at most 1000 Wp"),
  quantity: z.number({ required_error: "Quantity is required" }).min(1, "At least 1 panel required").max(10000, "Maximum 10000 panels"),
  total_kwp: z.number().nullable().optional(),
});

export type PanelArrayDetailValidation = z.infer<typeof panelArrayDetailSchema>;

// System details section schema
export const systemDetailsSchema = z.object({
  system_name: z.string().max(100, "System name must be less than 100 characters").optional().nullable(),
  system_address: z.string().min(5, "Address must be at least 5 characters"),
  commissioning_date: z.string().min(1, "Commissioning date is required").refine(
    (date) => {
      if (!date) return false;
      const d = new Date(date);
      const minDate = new Date("2022-09-15");
      const today = new Date();
      return d >= minDate && d <= today;
    },
    { message: "Date must be between Sept 15, 2022 and today" }
  ),
  installer_email: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
  system_gps_lat: z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90").optional().nullable(),
  system_gps_lng: z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180").optional().nullable(),
  ownership_type: z.string().optional().nullable(),
  connection_type: z.string().optional().nullable(),
  alternative_power_source: z.string().optional().nullable(),
  meter_type: z.string().optional().nullable(),
  installer_company_name: z.string().optional().nullable(),
});

// Inverter section schema
export const inverterSectionSchema = z.object({
  inverter_quantity: z.number().min(1, "At least 1 inverter required").max(100, "Maximum 100 inverters"),
  inverter_cost: z.number().positive("Cost must be positive").optional().nullable(),
  data_collector_present: z.string().optional().nullable(),
  data_collector_serial: z.string().optional().nullable(),
});

// Battery section schema (conditional)
export const batteryDetailsSchema = z.object({
  has_battery: z.boolean().nullable(),
  battery_brand: z.string().optional().nullable(),
  battery_capacity_kwh: z.number().positive("Capacity must be positive").max(50000, "Maximum 50,000 kWh").optional().nullable(),
  battery_cost: z.number().positive("Cost must be positive").optional().nullable(),
}).refine(
  (data) => {
    if (data.has_battery === true) {
      return !!data.battery_brand && !!data.battery_capacity_kwh && !!data.battery_cost;
    }
    return true;
  },
  { message: "Battery details are required when battery is installed", path: ["battery_brand"] }
);

// Panel section schema
export const panelSectionSchema = z.object({
  panel_quantity: z.number().min(1, "At least 1 panel required").optional().nullable(),
  panel_total_kwp: z.number().positive("Total kWp must be positive").optional().nullable(),
  panel_cost: z.number().positive("Cost must be positive").optional().nullable(),
});

// Financial section schema
export const financialSectionSchema = z.object({
  total_capex: z.number().positive("Total CAPEX must be positive"),
});

// Maintenance section schema (conditional)
export const maintenanceSectionSchema = z.object({
  has_maintenance_agreement: z.boolean().nullable(),
  maintenance_agreement_term_years: z.number().min(1, "Term must be at least 1 year").max(30, "Maximum 30 years").optional().nullable(),
  maintenance_cost_annual: z.number().positive("Annual cost must be positive").optional().nullable(),
}).refine(
  (data) => {
    if (data.has_maintenance_agreement === true) {
      return !!data.maintenance_agreement_term_years && !!data.maintenance_cost_annual;
    }
    return true;
  },
  { message: "Maintenance details are required when agreement exists", path: ["maintenance_agreement_term_years"] }
);

// Field-level validation functions
export const validateField = (fieldName: string, value: any, formData?: any): string | null => {
  try {
    switch (fieldName) {
      case "system_name":
        if (!value || (typeof value === "string" && value.trim().length === 0)) {
          return "System name is required";
        }
        if (typeof value === "string" && value.length > 100) {
          return "System name must be less than 100 characters";
        }
        break;
      
      case "system_address":
        if (!value || (typeof value === "string" && value.trim().length < 5)) {
          return "Address must be at least 5 characters";
        }
        break;
      
      case "ownership_type":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          return "Ownership type is required";
        }
        break;
      
      case "connection_type":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          return "Connection type is required";
        }
        break;
      
      case "alternative_power_source":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          return "Select an alternative power source (or 'None / Not applicable')";
        }
        break;
      
      case "meter_type":
        if (!value || (typeof value === "string" && value.trim() === "")) {
          return "Meter type is required";
        }
        break;
      
      case "commissioning_date":
        if (!value) return "Commissioning date is required";
        const date = new Date(value);
        const minDate = new Date("2022-09-15");
        const today = new Date();
        if (date < minDate) return "Date must be after Sept 15, 2022";
        if (date > today) return "Date cannot be in the future";
        break;
      
      case "installer_email":
        if (value && typeof value === "string" && value.trim() !== "" && value.includes("@")) {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailPattern.test(value)) return "Invalid email format";
        }
        break;
      
      case "system_gps_lat": {
        if (value === null || value === undefined || value === "") return "GPS latitude is required";
        const lat = Number(value);
        if (isNaN(lat) || lat < -90 || lat > 90) return "Latitude must be between -90 and 90";
        break;
      }
      
      case "system_gps_lng": {
        if (value === null || value === undefined || value === "") return "GPS longitude is required";
        const lng = Number(value);
        if (isNaN(lng) || lng < -180 || lng > 180) return "Longitude must be between -180 and 180";
        break;
      }

      
      case "inverter_quantity":
        if (value === null || value === undefined || value === "") return "Number of inverters is required";
        const qty = Number(value);
        if (isNaN(qty) || qty < 1) return "At least 1 inverter required";
        if (qty > 100) return "Maximum 100 inverters";
        break;
      
      case "inverter_cost":
        if (value !== null && value !== undefined && value !== "") {
          const cost = Number(value);
          if (isNaN(cost) || cost < 0) return "Cost must be a positive number";
        }
        break;
      
      case "battery_brand":
        if (formData?.has_battery === true && !value) {
          return "Battery brand is required";
        }
        break;
      
      case "battery_capacity_kwh":
        if (formData?.has_battery === true) {
          if (!value) return "Battery capacity is required";
          const capacity = Number(value);
          if (isNaN(capacity) || capacity <= 0) return "Capacity must be positive";
          if (capacity > 50000) return "Maximum 50,000 kWh";
        }
        break;
      
      case "battery_cost":
        if (formData?.has_battery === true) {
          if (!value) return "Battery cost is required";
          const cost = Number(value);
          if (isNaN(cost) || cost <= 0) return "Cost must be positive";
        }
        break;
      
      case "panel_cost":
        if (value !== null && value !== undefined && value !== "") {
          const cost = Number(value);
          if (isNaN(cost) || cost < 0) return "Cost must be a positive number";
        }
        break;
      
      case "total_capex":
        if (!value || Number(value) <= 0) return "Total CAPEX must be positive";
        break;
      
      case "maintenance_agreement_term_years":
        if (formData?.has_maintenance_agreement === true) {
          if (!value) return "Agreement term is required";
          const term = Number(value);
          if (isNaN(term) || term < 1) return "Term must be at least 1 year";
          if (term > 30) return "Maximum 30 years";
        }
        break;
      
      case "maintenance_cost_annual":
        if (formData?.has_maintenance_agreement === true) {
          if (!value) return "Annual cost is required";
          const cost = Number(value);
          if (isNaN(cost) || cost <= 0) return "Cost must be positive";
        }
        break;
    }
    return null;
  } catch {
    return null;
  }
};

// Validate inverter detail row
export const validateInverterDetail = (inverter: any, index: number): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  if (!inverter.brand) errors[`inverter_${index}_brand`] = "Brand is required";
  if (!inverter.model) errors[`inverter_${index}_model`] = "Model is required";
  if (inverter.capacity_kw === null || inverter.capacity_kw === undefined) {
    errors[`inverter_${index}_capacity_kw`] = "Capacity is required";
  } else if (inverter.capacity_kw <= 0) {
    errors[`inverter_${index}_capacity_kw`] = "Capacity must be positive";
  }
  if (!inverter.serial || inverter.serial.trim().length < 3) {
    errors[`inverter_${index}_serial`] = "Serial must be at least 3 characters";
  }
  
  return errors;
};

// Validate panel array detail row
export const validatePanelArrayDetail = (panel: any, index: number): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  if (!panel.brand) errors[`panel_${index}_brand`] = "Brand is required";
  if (panel.size_wp === null || panel.size_wp === undefined) {
    errors[`panel_${index}_size_wp`] = "Size is required";
  } else if (panel.size_wp < 50 || panel.size_wp > 1000) {
    errors[`panel_${index}_size_wp`] = "Size must be between 50 and 1000 Wp";
  }
  if (panel.quantity === null || panel.quantity === undefined) {
    errors[`panel_${index}_quantity`] = "Quantity is required";
  } else if (panel.quantity < 1) {
    errors[`panel_${index}_quantity`] = "At least 1 panel required";
  }
  
  return errors;
};
