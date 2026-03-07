'use client';

import { Table } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTableViewOptions } from './data-table-view-options';
import { DataTableFacetedFilter } from './data-table-faceted-filter';
import { X } from 'lucide-react';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

const genderOptions = [
  { value: 'male', label: 'זכר' },
  { value: 'female', label: 'נקבה' },
  { value: 'other', label: 'אחר' },
];

const statusOptions = [
  { value: 'alive', label: 'חי' },
  { value: 'deceased', label: 'נפטר' },
  { value: 'unknown', label: 'לא ידוע' },
];

const religionOptions = [
    {value: 'jewish', label: 'יהדות'},
    {value: 'christian', label: 'נצרות'},
    {value: 'muslim', label: 'אסלאם'},
    {value: 'buddhist', label: 'בודהיזם'},
    {value: 'other', label: 'אחר'}
]

export function DataTableToolbar<TData>({ table }: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2 space-x-reverse">
        <Input
          placeholder="חיפוש בכל השדות..."
          value={(table.getState().globalFilter as string) ?? ''}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {table.getColumn('gender') && (
          <DataTableFacetedFilter
            column={table.getColumn('gender')}
            title="מין"
            options={genderOptions}
          />
        )}
        {table.getColumn('status') && (
          <DataTableFacetedFilter
            column={table.getColumn('status')}
            title="סטטוס"
            options={statusOptions}
          />
        )}
        {table.getColumn('religion') && (
            <DataTableFacetedFilter
                column={table.getColumn('religion')}
                title="דת"
                options={religionOptions}
            />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 lg:px-3"
          >
            נקה הכל
            <X className="mr-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
