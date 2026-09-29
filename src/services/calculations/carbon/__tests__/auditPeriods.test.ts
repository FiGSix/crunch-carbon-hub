import { describe, it, expect } from 'vitest';
import {
  getAuditPeriodStart,
  getEligibleStartDate,
  eligibleFractionOfYear,
} from '../auditPeriods';

describe('audit eligibility periods', () => {
  it('starts untagged projects on 1 July 2026', () => {
    const start = getAuditPeriodStart([]);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(6);
    expect(start.getDate()).toBe(1);
  });

  it('keeps Audit 1 projects on the 2022 period', () => {
    const start = getAuditPeriodStart(['Audit 1', 'Audit 2', 'Audit 3']);
    expect(start.getFullYear()).toBe(2022);
    expect(start.getMonth()).toBe(8);
  });

  it('keeps Audit 2 projects on the 2025 period', () => {
    const start = getAuditPeriodStart(['Audit 2', 'Audit 3']);
    expect(start.getFullYear()).toBe(2025);
    expect(start.getMonth()).toBe(0);
  });

  it('never claims before commissioning', () => {
    const start = getEligibleStartDate('2027-03-01', ['Audit 1']);
    expect(start.getFullYear()).toBe(2027);
  });

  it('credits about half of 2026 for a new proposal commissioned in 2023', () => {
    const start = getEligibleStartDate('2023-05-10', []);
    expect(eligibleFractionOfYear(2025, start)).toBe(0);
    expect(eligibleFractionOfYear(2026, start)).toBeCloseTo(184 / 365, 4);
    expect(eligibleFractionOfYear(2027, start)).toBe(1);
  });

  it('credits the full 2025 and 2026 years for an Audit 2 project', () => {
    const start = getEligibleStartDate('2023-05-10', ['Audit 2']);
    expect(eligibleFractionOfYear(2025, start)).toBe(1);
    expect(eligibleFractionOfYear(2026, start)).toBe(1);
  });
});
