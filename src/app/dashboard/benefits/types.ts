
export const BENEFIT_STATUS_CODES = ["X", "ABS", "R", "M", "F", "CP", ""] as const;
export type BenefitDailyStatusCode = typeof BENEFIT_STATUS_CODES[number];

export const BENEFIT_STATUS_LEGEND: { code: BenefitDailyStatusCode | string; label: string }[] = [
  { code: "X", label: "Présent" },
  { code: "ABS", label: "Absent" },
  { code: "R", label: "Repos" },
  { code: "M", label: "Maladie" },
  { code: "F", label: "Fermeture" },
  { code: "CP", label: "Congé Payé" },
];

export interface BenefitEmployee {
  id: string;
  name: string;
}

export interface DailyBenefitEntry {
  planning: BenefitDailyStatusCode;
  repasPris: BenefitDailyStatusCode;
}

// Key: YYYY-MM-DD
export type MonthlyBenefitDataForEmployee = Record<string, DailyBenefitEntry>;

// Key: employeeId
export type FullMonthlyBenefitData = Record<string, MonthlyBenefitDataForEmployee>;

export const frenchShortDays = ["D", "L", "M", "M", "J", "V", "S"];
    