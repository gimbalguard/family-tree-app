'use client';

import { useMemo } from 'react';
import { Table } from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTableViewOptions } from './data-table-view-options';
import { DataTableFacetedFilter } from './data-table-faceted-filter';
import { X } from 'lucide-react';
import type { Person } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

const ageOptions = [
  { value: '0-17', label: '0-17' },
  { value: '18-30', label: '18-30' },
  { value: '31-50', label: '31-50' },
  { value: '51-70', label: '51-70' },
  { value: '71-90', label: '71-90' },
  { value: '90+', label: '90+' },
];

export function DataTableToolbar<TData>({ table }: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  const dynamicOptions = useMemo(() => {
    const rows = table.getPreFilteredRowModel().rows;
    const getUniqueValues = (key: keyof Person) => {
      const values = new Set<string>();
      rows.forEach(row => {
        const value = (row.original as Person)[key];
        if (typeof value === 'string' && value) {
          values.add(value);
        }
      });
      return Array.from(values).map(value => ({ value, label: value }));
    }
    
    return {
      gender: [
        {value: 'male', label: 'זכר'}, 
        {value: 'female', label: 'נקבה'}, 
        {value: 'other', label: 'אחר'}
      ],
      status: [
        {value: 'alive', label: 'חי'}, 
        {value: 'deceased', label: 'נפטר'}, 
        {value: 'unknown', label: 'לא ידוע'}
      ],
      religion: getUniqueValues('religion'),
      cityOfResidence: getUniqueValues('cityOfResidence'),
    }
  }, [table.getPreFilteredRowModel().rows]);

  return (
    <div className="flex flex-col gap-4">
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
              options={dynamicOptions.gender}
            />
          )}
          {table.getColumn('status') && (
            <DataTableFacetedFilter
              column={table.getColumn('status')}
              title="סטטוס"
              options={dynamicOptions.status}
            />
          )}
          {table.getColumn('religion') && dynamicOptions.religion.length > 0 && (
              <DataTableFacetedFilter
                  column={table.getColumn('religion')}
                  title="דת"
                  options={dynamicOptions.religion}
              />
          )}
          {table.getColumn('cityOfResidence') && dynamicOptions.cityOfResidence.length > 0 && (
              <DataTableFacetedFilter
                  column={table.getColumn('cityOfResidence')}
                  title="עיר מגורים"
                  options={dynamicOptions.cityOfResidence}
              />
          )}
          {table.getColumn('age') && (
            <DataTableFacetedFilter
              column={table.getColumn('age')}
              title="גיל"
              options={ageOptions}
            />
          )}
        </div>
        <DataTableViewOptions table={table} />
      </div>
      {isFiltered && (
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">פילטרים פעילים:</span>
            {table.getState().columnFilters.map(filter => {
                const column = table.getColumn(filter.id);
                if (!column) return null;
                const filterValue = filter.value as string[];
                const filterLabel = (column.columnDef.header as any)?.props?.title || filter.id;

                return filterValue.map(value => (
                    <Badge
                        key={value}
                        variant="secondary"
                        className="flex items-center gap-1"
                    >
                        {filterLabel}: {value}
                        <button
                            onClick={() => {
                                const newValues = filterValue.filter(v => v !== value);
                                column.setFilterValue(newValues.length ? newValues : undefined);
                            }}
                            className="mr-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ));
            })}
            <Button
                variant="ghost"
                onClick={() => table.resetColumnFilters()}
                className="h-8 px-2 lg:px-3 text-sm"
            >
                נקה הכל
            </Button>
        </div>
      )}
    </div>
  );
}
