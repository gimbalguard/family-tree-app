'use client';

import type { RootsProject, Person, FamilyTree, Relationship } from '@/lib/types';

export interface RootsProjectData {
  [key: string]: any;
}

type RootsViewProps = {
    project: RootsProject | null;
    people: Person[];
    relationships: Relationship[];
    tree: FamilyTree | null;
    onProjectChange: (path: (string|number)[], value: any) => void;
    onStepChange: (step: number) => void;
};

export function RootsView({ project, people, relationships, tree, onProjectChange, onStepChange }: RootsViewProps) {
  // The wizard content has been removed as requested.
  return null;
}
