'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase'; // Adjust path as necessary
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Announcement {
  id: string;
  sender: string;
  content: string;
  timestamp: Timestamp;
}

const ChefAnnouncementManager = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const q = query(collection(firestore, 'announcements'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const announcementsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      setAnnouncements(announcementsList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching announcements:', error);
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue lors du chargement des annonces.',
        variant: 'destructive',
      });
      setLoading(false);
    });

    // Clean up the listener on component unmount
    return () => unsubscribe();
  }, [toast]);

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, 'announcements', id));
      toast({
        title: 'Succès',
        description: 'Annonce supprimée avec succès.',
      });
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast({
        title: 'Erreur',
        description: 'Une erreur est survenue lors de la suppression de l\'annonce.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Gérer les annonces</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && <p>Chargement des annonces...</p>}
        {!loading && announcements.length === 0 && <p>Aucune annonce à gérer.</p>}
        {!loading && announcements.length > 0 && (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="border-b pb-4">
                <p className="text-sm text-gray-500">
                  De: {announcement.sender} - Le: {announcement.timestamp?.toDate().toLocaleString()}
                </p>
                <p className="mt-1">{announcement.content}</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="mt-2">
                      Supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action ne peut pas être annulée. Cela supprimera définitivement cette annonce.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteAnnouncement(announcement.id)}>Supprimer</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChefAnnouncementManager;