"use client";
import { Button } from '@/components/ui/button';

export default function ReviewSave() {
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">Review baseline quality and export artifacts.</div>
      <div className="flex items-center gap-2">
        <Button variant="outline">Needs re-record</Button>
        <Button>Finalize & Export</Button>
      </div>
    </div>
  );
}


