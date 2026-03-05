'use client';
import { Button } from '@/components/ui/button';
import { PersonEditor } from './person-editor';
import { ArrowRight, UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { Person } from '@/lib/types';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ToolbarProps = {
  treeName: string;
  treeId: string;
  onCreatePerson: (personData: Omit<Person, 'id' | 'createdAt' | 'updatedAt'>) => void;
};

export function Toolbar({ treeName, treeId, onCreatePerson }: ToolbarProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  return (
    <>
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard">
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>חזרה ללוח הבקרה</p>
          </TooltipContent>
        </Tooltip>

        <div className="rounded-lg border bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm">
          <h1 className="text-lg font-semibold">{treeName}</h1>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={() => setIsEditorOpen(true)}>
              <UserPlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>הוסף אדם חדש</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <PersonEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        treeId={treeId}
        onSave={onCreatePerson}
      />
    </>
  );
}
