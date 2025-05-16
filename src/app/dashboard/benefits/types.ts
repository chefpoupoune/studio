
export const BENEFIT_STATUS_CODES = ["X", "ABS", "R", "M", "F", "CP", ""] as const;
export type BenefitDailyStatusCode = typeof BENEFIT_STATUS_CODES[number];

export const BENEFIT_STATUS_LEGEND: { code: BenefitDailyStatusCode | string; label: string; displayClass: string; }[] = [
  { code: "X", label: "Présent", displayClass: "bg-green-100 dark:bg-green-800/30 text-green-700 dark:text-green-200" },
  { code: "ABS", label: "Absent", displayClass: "bg-orange-100 dark:bg-orange-800/30 text-orange-700 dark:text-orange-200" },
  { code: "R", label: "Repos", displayClass: "bg-blue-100 dark:bg-blue-800/30 text-blue-700 dark:text-blue-200" },
  { code: "M", label: "Maladie", displayClass: "bg-yellow-100 dark:bg-yellow-800/30 text-yellow-700 dark:text-yellow-200" },
  { code: "F", label: "Fermeture", displayClass: "bg-gray-200 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300" },
  { code: "CP", label: "Congé Payé", displayClass: "bg-purple-100 dark:bg-purple-800/30 text-purple-700 dark:text-purple-200" },
  { code: "", label: "Non Renseigné", displayClass: "border border-muted-foreground/50 text-muted-foreground" } 
];

export interface BenefitEmployee {
  id: string;
  name: string;
  // Add other employee-specific fields if needed in the future, e.g., role, contract type
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
    