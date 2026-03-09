
'use client';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableToolbar } from './data-table-toolbar';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';


interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  meta: any;
  onAddPerson: () => void;
}

const getInitialVisibility = (treeId: string): VisibilityState => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(`table-visibility-${treeId}`);
    return saved ? JSON.parse(saved) : { 'age': false, 'description': false };
  } catch (e) {
    console.error('Failed to parse table visibility from localStorage', e);
    return { 'age': false, 'description': false };
  }
};

export function DataTable<TData, TValue>({
  columns,
  data,
  meta,
  onAddPerson,
}: DataTableProps<TData, TValue>) {
  const treeId = meta?.treeId || '';
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => getInitialVisibility(treeId));
  const [globalFilter, setGlobalFilter] = useState('');
  
  useEffect(() => {
    if (typeof window !== 'undefined' && treeId) {
      localStorage.setItem(`table-visibility-${treeId}`, JSON.stringify(columnVisibility));
    }
  }, [columnVisibility, treeId]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      columnFilters,
    },
    meta,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    columnResizeMode: 'onChange',
  });

  return (
    <div className="space-y-4 h-full flex flex-col">
      <DataTableToolbar table={table} />
      <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 overflow-auto">
             <Table className="min-w-max">
              <TableHeader className="sticky top-0 bg-muted/50 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} style={{ width: header.getSize() }}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className="even:bg-muted/30 h-12"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="p-1">
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      לא נמצאו תוצאות.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
      </div>
       <div className="flex-shrink-0 flex justify-between items-center text-sm text-muted-foreground pt-2 border-t">
        <div>
            מציג {table.getRowModel().rows.length} מתוך {data.length}
        </div>
        <Button onClick={onAddPerson} disabled={!meta.isOwner}>
            <PlusCircle className="ml-2 h-4 w-4" />
            הוסף אדם
        </Button>
      </div>
    </div>
  );
}
