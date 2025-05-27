
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-full fixed inset-0 bg-background/80 z-50">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Loading page, please wait...</p>
    </div>
  );
}
