
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] p-4">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
      <p className="text-xl text-muted-foreground">Chargement des paramètres...</p>
    </div>
  );
}
