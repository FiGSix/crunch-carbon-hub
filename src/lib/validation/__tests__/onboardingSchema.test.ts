import { describe, it, expect } from "vitest";
import { 
  validateField, 
  validateInverterDetail, 
  validatePanelArrayDetail 
} from "../onboardingSchema";

describe("onboardingSchema - validateField", () => {
  describe("system_address validation", () => {
    it("should return error for empty address", () => {
      expect(validateField("system_address", "")).toBe("Address must be at least 5 characters");
      expect(validateField("system_address", null)).toBe("Address must be at least 5 characters");
      expect(validateField("system_address", undefined)).toBe("Address must be at least 5 characters");
    });

    it("should return error for address shorter than 5 characters", () => {
      expect(validateField("system_address", "123")).toBe("Address must be at least 5 characters");
      expect(validateField("system_address", "ab")).toBe("Address must be at least 5 characters");
    });

    it("should return null for valid address", () => {
      expect(validateField("system_address", "123 Main Street")).toBeNull();
      expect(validateField("system_address", "12345")).toBeNull();
    });
  });

  describe("commissioning_date validation", () => {
    it("should return error for empty date", () => {
      expect(validateField("commissioning_date", "")).toBe("Commissioning date is required");
      expect(validateField("commissioning_date", null)).toBe("Commissioning date is required");
    });

    it("should return error for date before Sept 15, 2022", () => {
      expect(validateField("commissioning_date", "2022-01-01")).toBe("Date must be after Sept 15, 2022");
      expect(validateField("commissioning_date", "2022-09-14")).toBe("Date must be after Sept 15, 2022");
    });

    it("should return error for future date", () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);
      expect(validateField("commissioning_date", futureDate.toISOString().split('T')[0])).toBe("Date cannot be in the future");
    });

    it("should return null for valid date", () => {
      expect(validateField("commissioning_date", "2023-06-15")).toBeNull();
      expect(validateField("commissioning_date", "2022-09-15")).toBeNull();
    });
  });

  describe("installer_email validation", () => {
    it("should return null for empty email (optional field)", () => {
      expect(validateField("installer_email", "")).toBeNull();
      expect(validateField("installer_email", null)).toBeNull();
    });

    it("should return error for invalid email format containing @", () => {
      expect(validateField("installer_email", "test@")).toBe("Invalid email format");
      expect(validateField("installer_email", "@test.com")).toBe("Invalid email format");
    });

    it("should return null for placeholder text without @", () => {
      expect(validateField("installer_email", "To be confirmed")).toBeNull();
      expect(validateField("installer_email", "TBC")).toBeNull();
      expect(validateField("installer_email", "N/A")).toBeNull();
    });

    it("should return null for valid email", () => {
      expect(validateField("installer_email", "test@example.com")).toBeNull();
      expect(validateField("installer_email", "user.name@company.co.za")).toBeNull();
    });
  });

  describe("system_gps_lat validation", () => {
    it("should return error for empty value (required)", () => {
      expect(validateField("system_gps_lat", "")).toBe("GPS latitude is required");
      expect(validateField("system_gps_lat", null)).toBe("GPS latitude is required");
    });

    it("should return error for invalid latitude", () => {
      expect(validateField("system_gps_lat", -91)).toBe("Latitude must be between -90 and 90");
      expect(validateField("system_gps_lat", 91)).toBe("Latitude must be between -90 and 90");
    });

    it("should return null for valid latitude", () => {
      expect(validateField("system_gps_lat", -26.2041)).toBeNull();
      expect(validateField("system_gps_lat", 0)).toBeNull();
      expect(validateField("system_gps_lat", 90)).toBeNull();
      expect(validateField("system_gps_lat", -90)).toBeNull();
    });
  });

  describe("inverter_quantity validation", () => {
    it("should return error for empty value", () => {
      expect(validateField("inverter_quantity", null)).toBe("Number of inverters is required");
      expect(validateField("inverter_quantity", "")).toBe("Number of inverters is required");
    });

    it("should return error for less than 1", () => {
      expect(validateField("inverter_quantity", 0)).toBe("At least 1 inverter required");
      expect(validateField("inverter_quantity", -1)).toBe("At least 1 inverter required");
    });

    it("should return error for more than 100", () => {
      expect(validateField("inverter_quantity", 101)).toBe("Maximum 100 inverters");
    });

    it("should return null for valid quantity", () => {
      expect(validateField("inverter_quantity", 1)).toBeNull();
      expect(validateField("inverter_quantity", 10)).toBeNull();
      expect(validateField("inverter_quantity", 20)).toBeNull();
      expect(validateField("inverter_quantity", 100)).toBeNull();
    });
  });

  describe("battery fields conditional validation", () => {
    it("should return null when has_battery is false", () => {
      expect(validateField("battery_brand", "", { has_battery: false })).toBeNull();
      expect(validateField("battery_capacity_kwh", null, { has_battery: false })).toBeNull();
    });

    it("should return error when has_battery is true and fields are empty", () => {
      expect(validateField("battery_brand", "", { has_battery: true })).toBe("Battery brand is required");
      expect(validateField("battery_capacity_kwh", null, { has_battery: true })).toBe("Battery capacity is required");
      expect(validateField("battery_cost", null, { has_battery: true })).toBe("Battery cost is required");
    });

    it("should return null when has_battery is true and fields are valid", () => {
      expect(validateField("battery_brand", "LG", { has_battery: true })).toBeNull();
      expect(validateField("battery_capacity_kwh", 10, { has_battery: true })).toBeNull();
      expect(validateField("battery_cost", 50000, { has_battery: true })).toBeNull();
    });
  });

  describe("total_capex validation", () => {
    it("should return error for empty or zero value", () => {
      expect(validateField("total_capex", null)).toBe("Total CAPEX must be positive");
      expect(validateField("total_capex", 0)).toBe("Total CAPEX must be positive");
    });

    it("should return null for positive value", () => {
      expect(validateField("total_capex", 100000)).toBeNull();
    });
  });
});

describe("onboardingSchema - validateInverterDetail", () => {
  it("should return errors for empty inverter detail", () => {
    const errors = validateInverterDetail({ brand: "", model: "", capacity_kw: null, serial: "" }, 0);
    expect(errors["inverter_0_brand"]).toBe("Brand is required");
    expect(errors["inverter_0_model"]).toBe("Model is required");
    expect(errors["inverter_0_capacity_kw"]).toBe("Capacity is required");
    expect(errors["inverter_0_serial"]).toBe("Serial must be at least 3 characters");
  });

  it("should return error for short serial", () => {
    const errors = validateInverterDetail({ brand: "Huawei", model: "SUN2000", capacity_kw: 10, serial: "AB" }, 0);
    expect(errors["inverter_0_serial"]).toBe("Serial must be at least 3 characters");
  });

  it("should return error for negative capacity", () => {
    const errors = validateInverterDetail({ brand: "Huawei", model: "SUN2000", capacity_kw: -5, serial: "ABC123" }, 0);
    expect(errors["inverter_0_capacity_kw"]).toBe("Capacity must be positive");
  });

  it("should return empty object for valid inverter detail", () => {
    const errors = validateInverterDetail({ brand: "Huawei", model: "SUN2000", capacity_kw: 10, serial: "ABC123" }, 0);
    expect(Object.keys(errors).length).toBe(0);
  });

  it("should use correct index in error keys", () => {
    const errors = validateInverterDetail({ brand: "", model: "", capacity_kw: null, serial: "" }, 2);
    expect(errors["inverter_2_brand"]).toBe("Brand is required");
    expect(errors["inverter_2_model"]).toBe("Model is required");
  });
});

describe("onboardingSchema - validatePanelArrayDetail", () => {
  it("should return errors for empty panel detail", () => {
    const errors = validatePanelArrayDetail({ brand: "", size_wp: null, quantity: null, total_kwp: null }, 0);
    expect(errors["panel_0_brand"]).toBe("Brand is required");
    expect(errors["panel_0_size_wp"]).toBe("Size is required");
    expect(errors["panel_0_quantity"]).toBe("Quantity is required");
  });

  it("should return error for invalid size range", () => {
    const errors1 = validatePanelArrayDetail({ brand: "JA Solar", size_wp: 40, quantity: 10, total_kwp: null }, 0);
    expect(errors1["panel_0_size_wp"]).toBe("Size must be between 50 and 1000 Wp");

    const errors2 = validatePanelArrayDetail({ brand: "JA Solar", size_wp: 1100, quantity: 10, total_kwp: null }, 0);
    expect(errors2["panel_0_size_wp"]).toBe("Size must be between 50 and 1000 Wp");
  });

  it("should return error for invalid quantity", () => {
    const errors = validatePanelArrayDetail({ brand: "JA Solar", size_wp: 550, quantity: 0, total_kwp: null }, 0);
    expect(errors["panel_0_quantity"]).toBe("At least 1 panel required");
  });

  it("should return empty object for valid panel detail", () => {
    const errors = validatePanelArrayDetail({ brand: "JA Solar", size_wp: 550, quantity: 100, total_kwp: 55 }, 0);
    expect(Object.keys(errors).length).toBe(0);
  });
});
