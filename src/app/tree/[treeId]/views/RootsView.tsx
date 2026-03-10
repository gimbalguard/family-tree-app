'use client';

import React from 'react';
import type { Person, FamilyTree } from '@/lib/types';

type RootsViewProps = {
  treeId: string;
  people: Person[];
  tree: FamilyTree | null;
};

export function RootsView({ treeId, people, tree }: RootsViewProps) {
  return (
    <div
      className="w-full h-full flex items-center justify-center bg-muted/20"
      dir="rtl"
    >
      <div className="text-center text-muted-foreground">
        <h2 className="text-2xl font-bold">עבודת שורשים</h2>
        <p>בקרוב...</p>
      </div>
    </div>
  );
}
