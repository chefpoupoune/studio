"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Loader2, X, CheckCircle, XCircle } from 'lucide-react';
import type { AppNotification } from '@/app/dashboard/declaration-heure/types';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';


interface UserNotificationAlertsProps {
  brigadeMemberId: string | null | undefined;
}

export default function UserNotificationAlerts({ brigadeMemberId }: UserNotificationAlertsProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!isClient || !brigadeMemberId) {
      setIsLoading(false);
      setNotifications([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const q = query(
        collection(firestore, 'notifications'),
        where('userId', '==', brigadeMemberId),
        where('isRead', '==', false)
      );
      const querySnapshot = await getDocs(q);
      const fetchedNotifications = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: (docSnap.data().createdAt as any).toDate().toISOString(),
      } as AppNotification));

      // Sort client-side to avoid complex index requirement
      fetchedNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setNotifications(fetchedNotifications);
      console.log(`[UserNotificationAlerts] Fetched ${fetchedNotifications.length} unread notifications for user ${brigadeMemberId}`);
    } catch (e) {
      console.error("Error loading user notifications from Firestore:", e);
      setNotifications([]);
      toast({ title: "Erreur de chargement des notifications", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [isClient, brigadeMemberId, toast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const notifDocRef = doc(firestore, 'notifications', notificationId);
      await updateDoc(notifDocRef, { isRead: true });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      toast({ title: "Notification marquée comme lue", variant: 'default' });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      toast({ title: "Erreur", description: "Impossible de marquer la notification comme lue.", variant: "destructive"});
    }
  };

  if (!isClient || isLoading) {
    return (
      <Alert className="mb-6 bg-muted/30 border-muted-foreground/20 animate-pulse">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <AlertTitle className="font-semibold text-muted-foreground">Mes Notifications</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground flex items-center">
          <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" /> Chargement...
        </AlertDescription>
      </Alert>
    );
  }

  if (notifications.length === 0) {
    return null; // Don't show anything if there are no notifications
  }

  return (
    <div className="mb-6 space-y-3">
        {notifications.map(notif => {
            const isAccepted = notif.message.includes('acceptée');
            const Icon = isAccepted ? CheckCircle : XCircle;
            const variant = isAccepted ? 'default' : 'destructive';
            const iconColor = isAccepted ? 'text-green-500' : 'text-destructive';

            return (
                <Alert key={notif.id} variant={variant} className="relative pr-10">
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                    <AlertTitle className="font-semibold">{notif.title}</AlertTitle>
                    <AlertDescription>
                      <p>{notif.message}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(notif.createdAt), 'dd MMMM yyyy HH:mm', { locale: fr })}
                      </div>
                      {notif.link && (
                          <Button asChild variant="link" size="sm" className="p-0 h-auto mt-1 text-xs">
                              <Link href={notif.link}>Voir la demande</Link>
                          </Button>
                      )}
                    </AlertDescription>
                     <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => handleMarkAsRead(notif.id)}
                        title="Marquer comme lu"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                </Alert>
            );
        })}
    </div>
  );
}
