"use client";

import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, Timestamp, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import AbsenceForm from './AbsenceForm';

interface AbsenceRequest {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  reason: string;
  type: 'absence';
  status: 'pending' | 'approved' | 'rejected';
}

const UpcomingAbsences = () => {
  const [upcomingAbsences, setUpcomingAbsences] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const fetchUpcomingAbsences = () => {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to the beginning of the day

    const requestsRef = collection(firestore, 'requests');
    const q = query(
      requestsRef,
      where('type', '==', 'absence'),
      where('status', '==', 'approved'),
      where('endDate', '>=', Timestamp.fromDate(today)) // Fetch absences that are not yet finished
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const absences: AbsenceRequest[] = [];
      querySnapshot.forEach((doc) => {
        absences.push({ id: doc.id, ...doc.data() } as AbsenceRequest);
      });

      // Sort absences by start date
      absences.sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());

      setUpcomingAbsences(absences);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching upcoming absences: ", error);
      setLoading(false);
    });

    return unsubscribe; // Return the unsubscribe function to be called on cleanup
  };

  useEffect(() => {
    const unsubscribe = fetchUpcomingAbsences();
    return () => unsubscribe(); // Cleanup subscription on component unmount
  }, []);

  const handleAbsenceAdded = () => {
    // The list will update automatically due to the real-time listener
    setIsDialogOpen(false);
  };

  const handleDeleteAbsence = async (absenceId: string) => {
    try {
      await deleteDoc(doc(firestore, 'requests', absenceId));
      // The list will update automatically due to the real-time listener
    } catch (error) {
      console.error("Error deleting absence: ", error);
    }
  };

  if (loading) {
    return null; 
  }

  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3">
      <CardHeader>
        <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5 text-yellow-500" />
                Absences à venir
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" /> Ajouter
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ajouter une absence</DialogTitle>
                    </DialogHeader>
                    <AbsenceForm onAbsenceAdded={handleAbsenceAdded} />
                </DialogContent>
            </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {upcomingAbsences.length === 0 ? (
          <p className="text-muted-foreground">Aucune absence à venir.</p>
        ) : (
          <div className="space-y-3">
            {upcomingAbsences.map((absence) => (
              <div key={absence.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={absence.userImage} alt={absence.userName} />
                    <AvatarFallback>{getInitials(absence.userName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm">{absence.userName}</p>
                    <p className="text-xs text-muted-foreground">{absence.reason}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                   <p className="text-sm font-medium text-right">
                      {`${absence.startDate.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${absence.endDate.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                   </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible et supprimera l'absence définitivement.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteAbsence(absence.id)}>
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingAbsences;
