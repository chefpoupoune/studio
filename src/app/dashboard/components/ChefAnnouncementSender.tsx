'use client';

import { useState } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Adjust path as necessary
import { firestore } from '@/lib/firebase'; // Adjust path as necessary
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

const ChefAnnouncementSender = () => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = async () => {
    if (message.trim() === '') {
      toast({
        title: 'Error',
        description: 'Message cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    try {
      await addDoc(collection(firestore, 'announcements'), {
        sender: 'Chef', // Replace with actual user ID if available
        content: message,
        timestamp: Timestamp.now(),
      });
      setMessage('');
      toast({
        title: 'Success',
        description: 'Annonce apparue !',
      });
    } catch (error) {
      console.error('Error sending announcement:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while sending the announcement.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-8 p-4 border rounded-md shadow-sm bg-900 text-white">
      <h2 className="text-xl font-semibold mb-4">Annonce !</h2>
      <Textarea
        placeholder="Que se passe t-il !"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        disabled={isSending}
        className="w-full mb-4 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <Button
        onClick={handleSendMessage}
        className="w-full py-2 px-4 bg-mt-7 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        disabled={isSending}
      >
        {isSending ? 'Envoie...' : 'Envoyer Annonce !'}
      </Button>
    </div>
  );
};

export default ChefAnnouncementSender;