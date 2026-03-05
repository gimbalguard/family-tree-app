'use client';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type CanvasToolbarProps = {
  onAddPerson: () => void;
};

export function CanvasToolbar({ onAddPerson }: CanvasToolbarProps) {
  return (
    <aside className="flex flex-col items-center gap-4 border-l bg-card p-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>חזרה ללוח הבקרה</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={onAddPerson}
            className="h-12 w-12 rounded-lg"
          >
            <UserPlus className="h-6 w-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>הוסף אדם חדש</p>
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}
