export interface WasteData {
    marmouset: number | null;
    saj: number | null;
    ime: number | null;
    esat1: number | null;
    esat2: number | null;
    esat3: number | null;
    autre: number | null;
    autre2: number | null;
}

export interface EffectifData {
    marmouset: number | null;
    saj: number | null;
    ime: number | null;
    esat1: number | null;
    esat2: number | null;
    esat3: number | null;
    autre: number | null;
    autre2: number | null;
}

export interface DailyWaste {
    day: string;
    menu: string;
    waste: WasteData;
    effectifs: EffectifData;
    autre_label: string;
    autre2_label: string;

}
