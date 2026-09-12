'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, firestore } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from '@/hooks/use-toast';
import ChefPlanning from "@/app/dashboard/components/ChefPlanning";
import ChefReminders from "@/app/dashboard/components/ChefReminders";

interface AppUser {
  id: string;
  username: string;
}

// Composant pour l'envoi d'e-mail général
const GeneralEmailSender = () => {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUsers = async () => {
      const usersCollection = collection(firestore, 'appUsers');
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      setUsers(usersList);
    };

    fetchUsers();
  }, []);

  const handleSendGeneralEmail = async () => {
    if (!subject || !body) {
      toast({ title: 'Erreur', description: "Veuillez remplir l'objet et le corps du message.", variant: 'destructive' });
      return;
    }
    setLoading(true);
    const sendEmail = httpsCallable(functions, 'sendGeneralEmailToTeam');
    try {
      await sendEmail({ subject, body, recipientIds: selectedUsers });
      toast({ title: 'Succès', description: "L'e-mail a été envoyé !" });
      setSubject('');
      setBody('');
      setSelectedUsers([]);
    } catch (error) {
      console.error("Error sending general email:", error);
      toast({ title: 'Erreur', description: "Échec de l'envoi de l'e-mail général.", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2">Communication à l'équipe</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Rédigez un message ci-dessous et envoyez-le aux membres sélectionnés de la brigade, ou à tous si personne n'est sélectionné.
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Destinataires :</label>
          <div className="flex flex-wrap gap-2">
            {users.map(user => (
              <div key={user.id} className="flex items-center space-x-2">
                <Checkbox
                  id={user.id}
                  checked={selectedUsers.includes(user.id)}
                  onCheckedChange={() => toggleUserSelection(user.id)}
                />
                <label htmlFor={user.id}>{user.username}</label>
              </div>
            ))}
          </div>
        </div>
        <Input 
          placeholder="Objet du message"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea 
          placeholder="Votre message pour l'équipe..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
        />
        <Button onClick={handleSendGeneralEmail} disabled={loading}>
          {loading ? 'Envoi en cours...' : (selectedUsers.length > 0 ? `Envoyer à ${selectedUsers.length} personne(s)` : "Envoyer à toute l'équipe")}
        </Button>
      </div>
    </div>
  );
};

// Composant pour le test d'e-mail
const EmailTest = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSendTestEmail = async () => {
    setLoading(true);
    const sendTestEmail = httpsCallable(functions, 'sendTestEmail');
    try {
      const result = await sendTestEmail();
      toast({ title: 'Succès', description: 'E-mail de test envoyé avec succès !' });
      console.log(result.data);
    } catch (error) {
      console.error("Error sending test email:", error);
      toast({ title: 'Erreur', description: "Échec de l'envoi de l'e-mail.", variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-2">Test d'envoi d'e-mail</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Cliquez sur ce bouton pour vérifier que la configuration d'envoi d'e-mails via votre compte Gmail fonctionne correctement.
        Un e-mail de test sera envoyé à <strong>chef.julien.gestion@gmail.com</strong>.
      </p>
      <Button onClick={handleSendTestEmail} disabled={loading}>
        {loading ? 'Envoi en cours...' : "Envoyer l'e-mail de test"}
      </Button>
    </div>
  );
};

export default function OrganizationPage() {
  return (
    <div>
      <div className='flex justify-between items-center mb-4'>
        <h1 className='text-2xl font-bold'>Organisation & Communication</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChefPlanning />
        <ChefReminders />
      </div>

      {/* Section de communication déplacée en bas */}
      <div className="space-y-6">
        <GeneralEmailSender />
        <EmailTest />
      </div>
    </div>
  );
}
