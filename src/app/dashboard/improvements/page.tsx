'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, ChevronDown } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { firestore } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

interface Improvement {
  id: string;
  text: string;
  details?: string;
  completed: boolean;
}

const IMPROVEMENTS_COLLECTION = "improvements";

export default function ImprovementsPage() {
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [newImprovement, setNewImprovement] = useState('');
  const [newImprovementDetails, setNewImprovementDetails] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchImprovements = async () => {
      try {
        const querySnapshot = await getDocs(collection(firestore, IMPROVEMENTS_COLLECTION));
        const improvementsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Improvement));
        setImprovements(improvementsList);
      } catch (error) {
        console.error("Error fetching improvements: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchImprovements();
  }, []);

  const addImprovement = async () => {
    if (newImprovement.trim() === '') return;

    try {
      const docRef = await addDoc(collection(firestore, IMPROVEMENTS_COLLECTION), {
        text: newImprovement,
        details: newImprovementDetails,
        completed: false,
      });
      setImprovements([...improvements, { id: docRef.id, text: newImprovement, details: newImprovementDetails, completed: false }]);
      setNewImprovement('');
      setNewImprovementDetails('');
    } catch (error) {
      console.error("Error adding improvement: ", error);
    }
  };

  const toggleImprovement = async (id: string) => {
    const improvement = improvements.find(item => item.id === id);
    if (!improvement) return;

    const updatedImprovement = { ...improvement, completed: !improvement.completed };
    const improvementRef = doc(firestore, IMPROVEMENTS_COLLECTION, id);

    try {
      await updateDoc(improvementRef, { completed: updatedImprovement.completed });
      setImprovements(improvements.map(item => item.id === id ? updatedImprovement : item));
    } catch (error) {
      console.error("Error updating improvement: ", error);
    }
  };

  const deleteImprovement = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, IMPROVEMENTS_COLLECTION, id));
      setImprovements(improvements.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting improvement: ", error);
    }
  };

  const deleteCompletedImprovements = async () => {
    const batch = writeBatch(firestore);
    const completedImprovements = improvements.filter(item => item.completed);

    completedImprovements.forEach(improvement => {
      const improvementRef = doc(firestore, IMPROVEMENTS_COLLECTION, improvement.id);
      batch.delete(improvementRef);
    });

    try {
      await batch.commit();
      setImprovements(improvements.filter(item => !item.completed));
    } catch (error) {
      console.error("Error deleting completed improvements: ", error);
    }
  };

  if (loading) {
    return <p>Chargement des améliorations...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Liste des améliorations futures</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 mb-4">
          <Input
            value={newImprovement}
            onChange={(e) => setNewImprovement(e.target.value)}
            placeholder="Ajouter une nouvelle amélioration"
            onKeyDown={(e) => e.key === 'Enter' && addImprovement()}
          />
          <Textarea
             value={newImprovementDetails}
             onChange={(e) => setNewImprovementDetails(e.target.value)}
             placeholder="Détails (facultatif)"
           />
          <Button onClick={addImprovement}>Ajouter</Button>
        </div>

        <div className="space-y-2">
          {improvements.map(item => (
            <div key={item.id} className="border rounded-md p-2">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={item.id}
                        checked={item.completed}
                        onCheckedChange={() => toggleImprovement(item.id)}
                    />
                    <label
                        htmlFor={item.id}
                        className={`flex-1 ${item.completed ? 'line-through text-muted-foreground' : ''}`}
                    >
                        {item.text}
                    </label>
                    {item.details && (
                        <Button variant="ghost" size="icon" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                            <ChevronDown className={`h-4 w-4 transition-transform ${expanded === item.id ? 'rotate-180' : ''}`} />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => deleteImprovement(item.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                {expanded === item.id && item.details && (
                    <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                        {item.details}
                    </div>
                )}
            </div>
          ))}
        </div>

        {improvements.some(i => i.completed) && (
            <div className="mt-4">
            <Button
                variant="destructive"
                onClick={deleteCompletedImprovements}
            >
                Supprimer les mises à jour terminées
            </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
