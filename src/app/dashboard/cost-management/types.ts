
export interface CostEntryData {
  fournisseur: string;
  ht: number;
  tva: number;
  avoir: number;
  day1: number | ""; day2: number | ""; day3: number | ""; day4: number | ""; day5: number | "";
  day6: number | ""; day7: number | ""; day8: number | ""; day9: number | ""; day10: number | "";
  day11: number | ""; day12: number | ""; day13: number | ""; day14: number | ""; day15: number | "";
  day16: number | ""; day17: number | ""; day18: number | ""; day19: number | ""; day20: number | "";
  day21: number | ""; day22: number | ""; day23: number | ""; day24: number | ""; day25: number | "";
  day26: number | ""; day27: number | ""; day28: number | ""; day29: number | ""; day30: number | "";
  day31: number | "";
  imp: number;
  saj: number;
  ime: number;
  esat: number;
  repasPlus: number;
  nous: number;
  pn: number;
  pnEsat: number;
}

export interface CostEntry extends CostEntryData {
  id: string;
}

export const months = [
  { value: "0", label: "Janvier" }, { value: "1", label: "Février" }, { value: "2", label: "Mars" },
  { value: "3", label: "Avril" }, { value: "4", label: "Mai" }, { value: "5", label: "Juin" },
  { value: "6", label: "Juillet" }, { value: "7", label: "Août" }, { value: "8", label: "Septembre" },
  { value: "9", label: "Octobre" }, { value: "10", label: "Novembre" }, { value: "11", label: "Décembre" }
];

export const currentYear = new Date().getFullYear();
export const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

export type DayKey = `day${number}`;

export const calculateRowTotal = (entry: CostEntryData): number => {
  return (entry.imp || 0) + (entry.saj || 0) + (entry.ime || 0) + (entry.esat || 0) + (entry.repasPlus || 0) + (entry.nous || 0);
};

export const calculateRowEffectif = (entry: CostEntryData, rowTotal: number): number => {
  return rowTotal + (entry.pn || 0) + (entry.pnEsat || 0);
};
