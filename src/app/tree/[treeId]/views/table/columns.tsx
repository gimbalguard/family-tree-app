'use client';
import { useState, useEffect, useRef } from 'react';
import { ColumnDef, CellContext } from '@tanstack/react-table';
import type { Person } from '@/lib/types';
import { DataTableColumnHeader } from './data-table-column-header';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { differenceInYears, format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// Generic Editable Cell Component
const EditableCell = <T,>({
  getValue,
  row: { original },
  column: { id },
  table,
}: CellContext<Person, T>) => {
  const initialValue = getValue() as string | undefined;
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const meta = table.options.meta as any;
  const isOwner = meta?.isOwner ?? false;

  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);
  
  const onSave = async () => {
    if (value !== initialValue) {
        setIsLoading(true);
        const success = await meta?.updatePersonData(original.id, id, value);
        setIsLoading(false);
        if (!success) {
            setValue(initialValue); // Revert on failure
        }
    }
    setIsEditing(false);
  };
  
  const onBlur = () => {
    onSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        onSave();
    } else if (e.key === 'Escape') {
        setValue(initialValue);
        setIsEditing(false);
    }
  };

  if (!isOwner) {
    return <div className="px-2 py-1">{value || '–'}</div>;
  }

  if (isEditing) {
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          value={value || ''}
          onChange={(e) => setValue(e.target.value)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className="h-8"
        />
        {isLoading && <Loader2 className="absolute top-1/2 right-2 -translate-y-1/2 h-4 w-4 animate-spin" />}
      </div>
    );
  }
  
  return (
    <div className="px-2 py-1 min-h-[32px] cursor-pointer whitespace-nowrap" onClick={() => setIsEditing(true)}>
      {value || '–'}
    </div>
  );
};

// Generic Editable Select Cell
const EditableSelectCell = <T,>({
  getValue,
  row: { original },
  column: { id },
  table,
  options,
}: CellContext<Person, T> & { options: { value: string; label: string }[] }) => {
  const initialValue = getValue() as string | undefined;
  const meta = table.options.meta as any;
  const isOwner = meta?.isOwner ?? false;
  
  const onSelect = async (newValue: string) => {
    const valueToSave = newValue === '--clear--' ? '' : newValue;
    if (valueToSave !== initialValue) {
        await meta?.updatePersonData(original.id, id, valueToSave);
    }
  };

  if (!isOwner) {
     const displayLabel = options.find(o => o.value === initialValue)?.label;
     if (!initialValue) return <div className="px-2 py-1 whitespace-nowrap">{'–'}</div>;
     return <div className="px-2 py-1 whitespace-nowrap">{displayLabel || initialValue}</div>;
  }
  
  const selectValue = initialValue === '' ? '--clear--' : initialValue;

  return (
    <Select value={selectValue} onValueChange={onSelect} dir='rtl'>
        <SelectTrigger className="h-8 border-none bg-transparent focus:ring-0 focus:ring-offset-0 whitespace-nowrap">
            <SelectValue placeholder="בחר..." />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="--clear--">ללא</SelectItem>
            {options.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
        </SelectContent>
    </Select>
  );
};

const EditableDateCell = <T,>({
  getValue,
  row: { original },
  column: { id },
  table,
}: CellContext<Person, T>) => {
  const initialValue = getValue() as string | undefined;
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const meta = table.options.meta as any;
  const isOwner = meta?.isOwner ?? false;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);
  
  const onSave = async () => {
    setIsEditing(false);
    if (value !== initialValue) {
       await meta?.updatePersonData(original.id, id, value);
    }
  };
  
  if (!isOwner) {
    const date = initialValue ? new Date(initialValue) : null;
    const displayValue = date && !isNaN(date.getTime()) ? format(date, 'dd/MM/yyyy') : '–';
    return <div className="px-2 py-1 whitespace-nowrap">{displayValue}</div>;
  }
  
  if (isEditing) {
    return <Input type="date" ref={inputRef} value={value || ''} onChange={e => setValue(e.target.value)} onBlur={onSave} className="h-8"/>;
  }

  const date = initialValue ? new Date(initialValue) : null;
  const displayValue = date && !isNaN(date.getTime()) ? format(date, 'dd/MM/yyyy') : '–';

  return (
    <div className="px-2 py-1 min-h-[32px] cursor-pointer whitespace-nowrap" onClick={() => setIsEditing(true)}>
      {displayValue}
    </div>
  );
};

export const columns: ColumnDef<Person>[] = [
    {
        id: 'photoURL',
        header: 'תמונה',
        cell: ({ row, table }) => {
            const { photoURL, firstName, lastName, gender, id } = row.original;
            const meta = table.options.meta as any;
            return (
                <Avatar className="h-9 w-9 cursor-pointer" onClick={() => meta.onEditPerson(id)}>
                    <AvatarImage src={photoURL || undefined} alt={`${firstName} ${lastName}`} />
                    <AvatarFallback><img src={getPlaceholderImage(gender)} alt="placeholder" /></AvatarFallback>
                </Avatar>
            );
        },
        enableSorting: false,
        enableHiding: false,
        size: 70,
    },
    {
        accessorKey: 'firstName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="שם פרטי" />,
        cell: (props) => {
            const { table, row: { original: { id } } } = props;
            const meta = table.options.meta as any;
            return <Button variant="link" className="p-0 h-auto whitespace-nowrap" onClick={() => meta.onEditPerson(id)}>{props.getValue() as string}</Button>
        },
        size: 150,
    },
    {
        accessorKey: 'lastName',
        header: ({ column }) => <DataTableColumnHeader column={column} title="שם משפחה" />,
        cell: props => <EditableCell {...props} />,
        size: 150,
    },
    {
        accessorKey: 'gender',
        header: ({ column }) => <DataTableColumnHeader column={column} title="מין" />,
        cell: props => <EditableSelectCell {...props} options={[{value: 'male', label: 'זכר'}, {value: 'female', label: 'נקבה'}, {value: 'other', label: 'אחר'}]} />,
        filterFn: 'arrIncludes',
        size: 120,
    },
    {
        accessorKey: 'birthDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="תאריך לידה" />,
        cell: props => <EditableDateCell {...props} />,
        sortingFn: 'datetime',
        size: 150,
    },
     {
        id: 'age',
        header: ({ column }) => <DataTableColumnHeader column={column} title="גיל" />,
        accessorFn: (row) => {
            if (!row.birthDate) return null;
            const birthDate = new Date(row.birthDate);
            if (isNaN(birthDate.getTime())) return null;
            const end = row.deathDate ? new Date(row.deathDate) : new Date();
            if (isNaN(end.getTime())) return differenceInYears(new Date(), birthDate);
            return differenceInYears(end, birthDate);
        },
        cell: ({ getValue }) => {
            const age = getValue() as number | null;
            return age !== null ? <div className='whitespace-nowrap px-2 py-1'>{age}</div> : '–';
        },
        size: 80,
    },
    {
        accessorKey: 'birthPlace',
        header: ({ column }) => <DataTableColumnHeader column={column} title="מקום לידה" />,
        cell: props => <EditableCell {...props} />,
        size: 180,
    },
    {
        accessorKey: 'deathDate',
        header: ({ column }) => <DataTableColumnHeader column={column} title="תאריך פטירה" />,
        cell: props => <EditableDateCell {...props} />,
        sortingFn: 'datetime',
        size: 150,
    },
    {
        accessorKey: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} title="סטטוס" />,
        cell: props => <EditableSelectCell {...props} options={[{value: 'alive', label: 'חי'}, {value: 'deceased', label: 'נפטר'}, {value: 'unknown', label: 'לא ידוע'}]} />,
        filterFn: 'arrIncludes',
        size: 120,
    },
    {
        accessorKey: 'countryOfResidence',
        header: ({ column }) => <DataTableColumnHeader column={column} title="ארץ מגורים" />,
        cell: props => <EditableCell {...props} />,
        size: 180,
    },
    {
        accessorKey: 'religion',
        header: ({ column }) => <DataTableColumnHeader column={column} title="דת" />,
        cell: props => <EditableSelectCell {...props} options={[{value: 'jewish', label: 'יהדות'}, {value: 'christian', label: 'נצרות'}, {value: 'muslim', label: 'אסלאם'}, {value: 'buddhist', label: 'בודהיזם'}, {value: 'other', label: 'אחר'}]} />,
        filterFn: 'arrIncludes',
        size: 120,
    },
    {
        accessorKey: 'description',
        header: ({ column }) => <DataTableColumnHeader column={column} title="הערות" />,
        cell: props => <EditableCell {...props} />,
        size: 300,
    },
];
