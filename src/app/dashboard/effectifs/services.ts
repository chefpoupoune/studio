'use client';
import { firestore } from "@/lib/firebase";
import { collection, addDoc, query, where, getDocs, updateDoc, doc, DocumentData, getDoc, deleteDoc } from "firebase/firestore";
import { Effectif } from "../types";

const effectifsCollection = collection(firestore, "effectifs");

export const getEffectifsForMonth = async (date: Date): Promise<Effectif[]> => {
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    const startYear = startDate.getFullYear();
    const startMonth = String(startDate.getMonth() + 1).padStart(2, '0');
    const startDateStr = `${startYear}-${startMonth}-01`;

    const endYear = endDate.getFullYear();
    const endMonth = String(endDate.getMonth() + 1).padStart(2, '0');
    const endDateStr = `${endYear}-${endMonth}-01`;

    const q = query(effectifsCollection, 
        where("date", ">=", startDateStr), 
        where("date", "<", endDateStr)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Effectif));
};

export const saveEffectif = async (data: Omit<Effectif, 'id'>) => {
    try {
        const q = query(effectifsCollection, where("date", "==", data.date));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docRef = querySnapshot.docs[0].ref;
            await updateDoc(docRef, data);
            const updatedDoc = await getDoc(docRef);
            return { id: updatedDoc.id, ...updatedDoc.data() } as Effectif;
        } else {
            const docRef = await addDoc(effectifsCollection, data);
            const newDoc = await getDoc(docRef);
            return { id: newDoc.id, ...newDoc.data() } as Effectif;
        }
    } catch (error) {
        console.error("Could not save effectif", error);
        throw new Error("Could not save effectif");
    }
};

export const deleteEffectif = async (id: string): Promise<void> => {
    try {
        const docRef = doc(firestore, "effectifs", id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Could not delete effectif", error);
        throw new Error("Could not delete effectif");
    }
};
