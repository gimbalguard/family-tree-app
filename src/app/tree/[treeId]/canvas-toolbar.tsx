'use client';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  UserPlus,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';
import Link from 'next/link';

type CanvasToolbarProps = {
  onAddPerson: () => void;
};

export function CanvasToolbar({
  onAddPerson,
}: CanvasToolbarProps) {
  return (
    <aside className="flex flex-col items-center gap-4 border-r bg-card p-4">
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

      <Button
        variant="outline"
        onClick={onAddPerson}
        className="h-auto w-full flex-col p-3"
      >
        <UserPlus className="h-6 w-6 mb-1" />
        <span className="text-xs">הוסף אדם חדש</span>
      </Button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" disabled>
            {' '}
            {/* Disabled for now */}
            <MessageSquare className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>עריכה עם AI (בקרוב)</p>
        </TooltipContent>
      </Tooltip>

      <div className="flex-grow" />

    </aside>
  );
}
