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
  updatePersonData: (personId: string, field: keyof Person, value: any) => Promise<boolean>;
  onAddPerson: () => void;
  onEditPerson: (personId: string) => void;
};

export function TableView({ data, isOwner, updatePersonData, onAddPerson, onEditPerson }: TableViewProps) {
  
  const tableData = useMemo(() => data, [data]);

  const meta = useMemo(() => ({
    isOwner,
    updatePersonData,
    onEditPerson,
  }), [isOwner, updatePersonData, onEditPerson]);

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 lg:p-8 gap-4 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className='w-full overflow-x-auto'>
            <DataTable columns={columns} data={tableData} meta={meta} />
        </div>
      </div>
      <div className="flex-shrink-0 flex justify-start pt-4 border-t">
        <Button onClick={onAddPerson} disabled={!isOwner}>
          <PlusCircle className="ml-2 h-4 w-4" />
          הוסף אדם
        </Button>
      </div>
    </div>
  );
}
