'use client';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  FileText, FileSpreadsheet, Presentation, ImageIcon, Globe, Book, Download, Edit, Trash2, MoreVertical, Eye
} from 'lucide-react';
import type { DisplayFile } from './my-files-client';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const FILE_ICONS: Record<string, { icon: React.FC<any>; bg: string }> = {
  pdf: { icon: FileText, bg: 'bg-red-500' },
  xlsx: { icon: FileSpreadsheet, bg: 'bg-green-600' },
  pptx: { icon: Presentation, bg: 'bg-orange-500' },
  png: { icon: ImageIcon, bg: 'bg-blue-500' },
  jpg: { icon: ImageIcon, bg: 'bg-blue-500' },
  jpeg: { icon: ImageIcon, bg: 'bg-blue-500' },
  html: { icon: Globe, bg: 'bg-purple-500' },
  docx: { icon: Book, bg: 'bg-teal-600' },
  profile: { icon: ImageIcon, bg: 'bg-indigo-500' },
  gallery: { icon: ImageIcon, bg: 'bg-pink-500' },
  presentation: { icon: Presentation, bg: 'bg-violet-500' },
  general: { icon: ImageIcon, bg: 'bg-cyan-500' },
};

interface FileCardProps {
  file: DisplayFile;
  onDelete: () => void;
}

export function FileCard({ file, onDelete }: FileCardProps) {
  const Icon = FILE_ICONS[file.type]?.icon || FileText;
  const isPhoto = ['profile', 'gallery', 'general', 'png', 'jpg', 'jpeg'].includes(file.type);
  const canDelete = file.storagePath !== '' && file.type !== 'profile';
  const canEdit = file.type === 'presentation';

  const renderDescription = () => {
    let details = [];
    if (file.size > 0) details.push(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    details.push(`נוצר: ${format(file.createdAt, 'dd/MM/yy')}`);
    if (file.updatedAt && file.updatedAt.getTime() !== file.createdAt.getTime()) {
      details.push(`עודכן: ${format(file.updatedAt, 'dd/MM/yy')}`);
    }
    return <p className="text-xs text-muted-foreground truncate">{details.join(' · ')}</p>;
  }

  return (
    <Card className="flex flex-col transition-all duration-300 ease-in-out bg-card rounded-xl border shadow-sm hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
      <div className="relative h-40 bg-muted/30">
        {isPhoto ? (
          <Image
            src={file.url}
            alt={file.name}
            layout="fill"
            objectFit="cover"
            className="transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Icon className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
      </div>

      <CardHeader className="p-3 space-y-1">
        <div className="flex justify-between items-start gap-2">
            <CardTitle className="text-sm font-semibold leading-tight hover:text-primary transition-colors flex-1 text-right">
              <Link href={file.url} target="_blank" rel="noopener noreferrer" className="stretched-link">
                {file.name}
              </Link>
            </CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 -mt-1 -mr-1">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit ? (
                  <DropdownMenuItem asChild>
                    <Link href={file.url}><Edit className="ml-2 h-4 w-4" />ערוך</Link>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem asChild>
                    <a href={file.url} target="_blank" rel="noopener noreferrer"><Eye className="ml-2 h-4 w-4"/>הצג</a>
                  </DropdownMenuItem>
                )}
                 <DropdownMenuItem asChild>
                   <a href={file.url} download={file.name}><Download className="ml-2 h-4 w-4"/>הורד</a>
                 </DropdownMenuItem>
                 {canDelete && (
                   <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                      <Trash2 className="ml-2 h-4 w-4"/>מחק
                    </DropdownMenuItem>
                   </>
                 )}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
        <CardDescription className="text-right">{renderDescription()}</CardDescription>
      </CardHeader>

      <CardFooter className="p-3 pt-0 text-xs text-muted-foreground text-right">
        {file.treeName && <p>עץ: {file.treeName}</p>}
        {file.personName && <p>אדם: {file.personName}</p>}
      </CardFooter>
    </Card>
  );
}
