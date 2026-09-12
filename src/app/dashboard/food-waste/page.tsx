'use client';

import { useState, useEffect } from "react";
import { DailyWaste, WasteData, EffectifData } from "./types";
import { firestore } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getWeekId } from "@/lib/time-utils";
import { Trash2, Download, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateFoodWastePdf } from "./utils/foodWastePdfGenerator";
import { startOfWeek, addDays, format as formatDateFns, getYear, getMonth } from 'date-fns';

// Input component for numbers, supporting French decimal format
const NumberInput = ({ value, onChange, placeholder }: { value: number | null, onChange: (v: number | null) => void, placeholder?: string }) => {
    const [displayValue, setDisplayValue] = useState<string>("");

    useEffect(() => {
        const parentValue = value;
        const localValue = parseFloat(displayValue.replace(',', '.'));

        if (parentValue === localValue) return;
        if ((parentValue === null || parentValue === undefined) && (displayValue === '' || isNaN(localValue))) return;

        setDisplayValue(parentValue === null || parentValue === undefined ? "" : String(parentValue).replace('.', ','));
    }, [value, displayValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        const regex = /^[0-9]*[.,]?[0-9]*$/;

        if (!regex.test(rawValue)) {
            return;
        }

        const display = rawValue.replace('.', ',');
        setDisplayValue(display);

        const numericValue = parseFloat(display.replace(',', '.'));
        
        if (isNaN(numericValue)) {
            onChange(null);
        } else {
            onChange(numericValue);
        }
    };

    return <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        className="w-full bg-transparent placeholder-transparent text-right"
        placeholder={placeholder || "0"}
    />;
};

const FoodWastePage = () => {
    const [dailyWastes, setDailyWastes] = useState<DailyWaste[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        const fetchMenuAndWaste = async () => {
            setLoading(true);
            const today = new Date();
            const weekId = getWeekId(today);
            const wasteDocRef = doc(firestore, "foodWaste", weekId);

            try {
                const wasteDocSnap = await getDoc(wasteDocRef);
                const wasteData = wasteDocSnap.exists() ? wasteDocSnap.data() : {};

                const monday = startOfWeek(today, { weekStartsOn: 1 });
                const weekDates = Array.from({ length: 5 }).map((_, i) => addDays(monday, i));

                const docIdsToFetch = new Set<string>();
                weekDates.forEach(date => {
                    const year = getYear(date);
                    const month = getMonth(date);
                    docIdsToFetch.add(`menu_${year}_${month}`);
                });

                const menuPromises = Array.from(docIdsToFetch).map(docId => {
                    const docRef = doc(firestore, "menuPlanning", docId);
                    return getDoc(docRef);
                });
                const menuPlanningDocs = await Promise.all(menuPromises);

                let allAvailableMenus: any[] = [];
                menuPlanningDocs.forEach(docSnap => {
                    if (docSnap.exists()) {
                        allAvailableMenus = allAvailableMenus.concat(docSnap.data().menus);
                    }
                });

                const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
                const weekData: DailyWaste[] = days.map((day, index) => {
                    const dateStringForDay = formatDateFns(weekDates[index], 'yyyy-MM-dd');
                    const dayMenuData = allAvailableMenus.find(m => m.date === dateStringForDay);
                    
                    const dayData = wasteData[day] || {};
                    const defaultWaste: WasteData = { marmouset: null, saj: null, ime: null, esat1: null, esat2: null, esat3: null, autre: null, autre2: null };
                    const defaultEffectifs: EffectifData = { marmouset: null, saj: null, ime: null, esat1: null, esat2: null, esat3: null, autre: null, autre2: null };

                    const savedWasteForDay: WasteData = { ...defaultWaste, ...(dayData.waste || {}) };
                    const savedEffectifsForDay: EffectifData = { ...defaultEffectifs, ...(dayData.effectifs || {}) };
                    const savedAutreLabel = dayData.autre_label || '';
                    const savedAutre2Label = dayData.autre2_label || '';

                    let menuString = "Aucun menu planifié pour ce jour";
                    if (dayMenuData) {
                        const getItemName = (item: any) => (item && typeof item === 'object' && item.name) ? item.name : (item || null);
                        const platComplet = [getItemName(dayMenuData.plat), getItemName(dayMenuData.feculent), getItemName(dayMenuData.legume), getItemName(dayMenuData.sauce)].filter(Boolean).join(' / ');
                        const menuParts = [];
                        const entree = getItemName(dayMenuData.entree);
                        const dessert = getItemName(dayMenuData.dessert);

                        if (entree) menuParts.push(`Entrée : ${entree}`);
                        if (platComplet) menuParts.push(`Plat : ${platComplet}`);
                        if (dessert) menuParts.push(`Dessert : ${dessert}`);
                        if (menuParts.length > 0) menuString = menuParts.join('\n');
                    }

                    return {
                        day: day,
                        menu: menuString,
                        waste: savedWasteForDay,
                        effectifs: savedEffectifsForDay,
                        autre_label: savedAutreLabel,
                        autre2_label: savedAutre2Label,
                    };
                });

                setDailyWastes(weekData);
            } catch (error) {
                console.error("Erreur lors de la récupération des données:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchMenuAndWaste();
    }, []);

    const handleWasteChange = (day: string, type: keyof WasteData, value: number | null) => {
        setDailyWastes(p => p.map(dw => dw.day === day ? { ...dw, waste: { ...dw.waste, [type]: value } } : dw));
    };

    const handleEffectifChange = (day: string, type: keyof EffectifData, value: number | null) => {
        setDailyWastes(p => p.map(dw => dw.day === day ? { ...dw, effectifs: { ...dw.effectifs, [type]: value } } : dw));
    };

    const handleAutreLabelChange = (day: string, label: string) => {
        setDailyWastes(p => p.map(dw => dw.day === day ? { ...dw, autre_label: label } : dw));
    };

    const handleAutre2LabelChange = (day: string, label: string) => {
        setDailyWastes(p => p.map(dw => dw.day === day ? { ...dw, autre2_label: label } : dw));
    };

    const { totalWaste, totalEffectifs, avgWastePerPerson } = dailyWastes.reduce((acc, dailyWaste) => {
        (Object.keys(dailyWaste.waste) as Array<keyof WasteData>).forEach(k => {
            acc.totalWaste[k] = (acc.totalWaste[k] || 0) + (dailyWaste.waste[k] || 0);
        });
        (Object.keys(dailyWaste.effectifs) as Array<keyof EffectifData>).forEach(k => {
            acc.totalEffectifs[k] = (acc.totalEffectifs[k] || 0) + (dailyWaste.effectifs[k] || 0);
        });
        return acc;
    }, { 
        totalWaste: { marmouset: 0, saj: 0, ime: 0, esat1: 0, esat2: 0, esat3: 0, autre: 0, autre2: 0 } as { [K in keyof WasteData]: number }, 
        totalEffectifs: { marmouset: 0, saj: 0, ime: 0, esat1: 0, esat2: 0, esat3: 0, autre: 0, autre2: 0 } as { [K in keyof EffectifData]: number },
        avgWastePerPerson: {} as { [K in keyof EffectifData]: number }
    });

    (Object.keys(totalEffectifs) as Array<keyof EffectifData>).forEach(k => {
        if (totalEffectifs[k] > 0) {
            avgWastePerPerson[k] = (totalWaste[k] || 0) / totalEffectifs[k];
        }
    });

    const grandTotalWaste = Object.values(totalWaste).reduce((s, c) => s + c, 0);
    const grandTotalEffectifs = Object.values(totalEffectifs).reduce((s, c) => s + c, 0);
    
    const grandTotalWasteForAvg = (Object.keys(totalWaste) as Array<keyof WasteData>).reduce((acc, key) => {
        const effectifKey = key as keyof EffectifData;
        if (totalEffectifs[effectifKey] && totalEffectifs[effectifKey]! > 0) {
            return acc + (totalWaste[key] || 0);
        }
        return acc;
    }, 0);
    
    const grandTotalAvg = grandTotalEffectifs > 0 ? grandTotalWasteForAvg / grandTotalEffectifs : 0;

    const handleSave = async () => {
        setIsSaving(true);
        const weekId = getWeekId(new Date());
        const wasteDocRef = doc(firestore, "foodWaste", weekId);
        const dataToSave = dailyWastes.reduce((acc, dw) => {
            acc[dw.day] = { waste: dw.waste, effectifs: dw.effectifs, autre_label: dw.autre_label, autre2_label: dw.autre2_label };
            return acc;
        }, {} as any);

        try {
            await setDoc(wasteDocRef, dataToSave, { merge: true });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
        } catch (error) {
            console.error("Erreur lors de la sauvegarde : ", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        await generateFoodWastePdf(dailyWastes, totalWaste, totalEffectifs, avgWastePerPerson);
        setIsGeneratingPdf(false);
    };

    const TitleComponent = () => (
        <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
                <Trash2 className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-serif font-bold text-primary">Gestion du gaspillage alimentaire</h1>
            </div>
            <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={isSaving || saveSuccess} variant="secondary">
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Sauvegarde...' : saveSuccess ? 'Sauvegardé !' : 'Sauvegarder'}
                </Button>
                <Button onClick={handleGeneratePdf} disabled={isGeneratingPdf}>
                    <Download className="mr-2 h-4 w-4" />
                    {isGeneratingPdf ? 'Génération...' : 'Télécharger en PDF'}
                </Button>
            </div>
        </div>
    );

    if (loading) {
        return <div className="container mx-auto p-4"><TitleComponent /><p>Chargement des données...</p></div>;
    }

    const summaryKeys: Array<keyof EffectifData> = ['marmouset', 'saj', 'ime', 'esat1', 'esat2', 'esat3', 'autre', 'autre2'];

    return (
        <div className="container mx-auto p-4">
            <TitleComponent />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {dailyWastes.map(dw => (
                    <FoodWasteTable key={dw.day} dailyWaste={dw} onWasteChange={handleWasteChange} onEffectifChange={handleEffectifChange} onAutreLabelChange={handleAutreLabelChange} onAutre2LabelChange={handleAutre2LabelChange} />
                ))}
            </div>
            <div className="mt-8">
                <h2 className="text-xl font-bold">Bilan de la semaine</h2>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="border p-2">Client</th>
                            <th className="border p-2 text-right">Gaspillage Total (KG)</th>
                            <th className="border p-2 text-right">Effectif Cumulé</th>
                            <th className="border p-2 text-right">Gaspillage Moyen / Personne (KG)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summaryKeys.map(key => {
                             const waste = totalWaste[key] || 0;
                             const effectif = totalEffectifs[key] || 0;
                             const avg = effectif > 0 ? (waste / effectif).toFixed(3).replace('.', ',') : '-';
                             let label = key.charAt(0).toUpperCase() + key.slice(1);
                             if (key === 'autre') label = 'Autre';
                             if (key === 'autre2') label = 'Autre 2';
 
                             return (
                                 <tr key={key}>
                                     <td className="border p-2 font-bold">{label}</td>
                                     <td className="border p-2 text-right">{waste.toFixed(2).replace('.', ',')}</td>
                                     <td className="border p-2 text-right">{effectif > 0 ? effectif : ''}</td>
                                     <td className="border p-2 text-right">{avg}</td>
                                 </tr>
                             );
                        })}
                    </tbody>
                    <tfoot className="bg-primary text-primary-foreground">
                        <tr>
                            <td className="border p-2 font-bold">Total Global</td>
                            <td className="border p-2 text-right font-bold">{grandTotalWaste.toFixed(2).replace('.', ',')} KG</td>
                            <td className="border p-2 text-right font-bold">{grandTotalEffectifs}</td>
                            <td className="border p-2 text-right font-bold">{grandTotalAvg.toFixed(3).replace('.', ',')} KG</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

interface FoodWasteTableProps {
    dailyWaste: DailyWaste;
    onWasteChange: (day: string, type: keyof WasteData, value: number | null) => void;
    onEffectifChange: (day: string, type: keyof EffectifData, value: number | null) => void;
    onAutreLabelChange: (day: string, label: string) => void;
    onAutre2LabelChange: (day: string, label: string) => void;
}

const FoodWasteTable: React.FC<FoodWasteTableProps> = ({ dailyWaste, onWasteChange, onEffectifChange, onAutreLabelChange, onAutre2LabelChange }) => {
    const dailyTotal = Object.values(dailyWaste.waste).reduce((s, c) => s + (c || 0), 0);

    const renderWasteInput = (type: keyof WasteData) => <NumberInput value={dailyWaste.waste[type]} onChange={v => onWasteChange(dailyWaste.day, type, v)} />;
    const renderEffectifInput = (type: keyof EffectifData) => <NumberInput value={dailyWaste.effectifs[type]} onChange={v => onEffectifChange(dailyWaste.day, type, v)} placeholder="Nb." />;
    
    const clients: Array<keyof EffectifData> = ['marmouset', 'saj', 'ime', 'esat1', 'esat2', 'esat3'];

    return (
        <div className="border rounded-lg p-4 flex flex-col">
            <h3 className="text-lg font-bold">{dailyWaste.day}</h3>
            <p className="mb-2 min-h-[60px] whitespace-pre-line">{dailyWaste.menu}</p>
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr>
                        <th className="border p-2">Type</th>
                        <th className="border p-2 text-center"><Users size={16} className="inline-block"/></th>
                        <th className="border p-2 text-center"><Trash2 size={16} className="inline-block"/> (KG)</th>
                        <th className="border p-2 text-center">Moy / Pers (KG)</th>
                    </tr>
                </thead>
                <tbody>
                    {clients.map(client => {
                        const waste = dailyWaste.waste[client] || 0;
                        const effectif = dailyWaste.effectifs[client] || 0;
                        const avg = effectif > 0 ? (waste / effectif).toFixed(3).replace('.', ',') : '-';
                        return (
                            <tr key={client}>
                                <td className="border p-2">{client.charAt(0).toUpperCase() + client.slice(1)}</td>
                                <td className="border p-2">{renderEffectifInput(client)}</td>
                                <td className="border p-2">{renderWasteInput(client)}</td>
                                <td className="border p-2 text-right">{avg}</td>
                           </tr>
                        );
                    })}
                    <tr>
                        <td className="border p-2">
                            <input type="text" value={dailyWaste.autre_label} onChange={e => onAutreLabelChange(dailyWaste.day, e.target.value)} placeholder="Autre (ex: Pain)" className="w-full bg-transparent placeholder-gray-400" />
                        </td>
                        <td className="border p-2">{renderEffectifInput('autre')}</td>
                        <td className="border p-2">{renderWasteInput('autre')}</td>
                        <td className="border p-2 text-right">
                            {dailyWaste.effectifs.autre && dailyWaste.effectifs.autre > 0 ? ((dailyWaste.waste.autre || 0) / dailyWaste.effectifs.autre).toFixed(3).replace('.', ',') : '-'}
                        </td>
                    </tr>
                    <tr>
                        <td className="border p-2">
                            <input type="text" value={dailyWaste.autre2_label} onChange={e => onAutre2LabelChange(dailyWaste.day, e.target.value)} placeholder="Autre 2" className="w-full bg-transparent placeholder-gray-400" />
                        </td>
                        <td className="border p-2">{renderEffectifInput('autre2')}</td>
                        <td className="border p-2">{renderWasteInput('autre2')}</td>
                        <td className="border p-2 text-right">
                            {dailyWaste.effectifs.autre2 && dailyWaste.effectifs.autre2 > 0 ? ((dailyWaste.waste.autre2 || 0) / dailyWaste.effectifs.autre2).toFixed(3).replace('.', ',') : '-'}
                        </td>
                    </tr>
                </tbody>
                <tfoot className="bg-primary text-primary-foreground">
                    <tr>
                        <td className="border p-2 font-bold">Total du jour</td>
                        <td colSpan={3} className="border p-2 font-bold text-right">{dailyTotal.toFixed(2).replace('.', ',')} KG</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

export default FoodWastePage;
