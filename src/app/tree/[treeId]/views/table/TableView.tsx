'use client';

import type { Person } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { columns } from './columns';
import { DataTable } from './data-table';
import { useMemo } from 'react';

type TableViewProps = {
  data: Person[];
  isOwner: boolean;
  treeId: string;
  updatePersonData: (personId: string, field: keyof Person, value: any) => Promise<boolean>;
  onAddPerson: () => void;
  onEditPerson: (personId: string) => void;
};

export function TableView({ data, isOwner, treeId, updatePersonData, onAddPerson, onEditPerson }: TableViewProps) {
  
  const tableData = useMemo(() => data, [data]);

  const meta = useMemo(() => ({
    isOwner,
    treeId,
    updatePersonData,
    onEditPerson,
  }), [isOwner, treeId, updatePersonData, onEditPerson]);

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 gap-4">
        <DataTable columns={columns} data={tableData} meta={meta} />
    </div>
  );
}
