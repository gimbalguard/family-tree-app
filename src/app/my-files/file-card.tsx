'use client';
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText, FileSpreadsheet, Presentation, ImageIcon, Globe, Book, Eye, Download, Edit, Trash2, User, Home, Calendar, GitBranch, FileArchive
} from 'lucide-react';
import type { DisplayFile } from './my-files-client';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import Link from 'next/link';

const FILE_ICONS: Record<string, { icon: React.FC<any>; bg: string }> = {
  pdf: { icon: FileText, bg: 'bg-red-500' },
  xlsx: { icon: FileSpreadsheet, bg: 'bg-green-600' },
  pptx: { icon: Presentation, bg: 'bg-orange-500' },
  png: { icon: ImageIcon, bg: 'bg-blue-500' },
  jpg: { icon: ImageIcon, bg: 'bg-blue-500' },
  html: { icon: Globe, bg: 'bg-purple-500' },
  docx: { icon: Book, bg: 'bg-teal-600' },
  profile: { icon: User, bg: 'bg-indigo-500' },
  gallery: { icon: ImageIcon, bg: 'bg-pink-500' },
  presentation: { icon: Presentation, bg: 'bg-violet-500' },
  general: { icon: ImageIcon, bg: 'bg-cyan-500' },
};

interface FileCardProps {
  file: DisplayFile;
  onDelete: () => void;
}

export function FileCard({ file, onDelete }: FileCardProps) {
  const Icon = FILE_ICONS[file.type]?.icon || FileArchive;
  const iconBg = FILE_ICONS[file.type]?.bg || 'bg-muted';

  const renderDescription = () => {
    let details = [];
    if(file.size > 0) details.push(`${(file.size / (1024*1024)).toFixed(2)} MB`);
    details.push(format(file.createdAt, 'dd/MM/yy'));
    if(file.updatedAt && file.updatedAt.getTime() !== file.createdAt.getTime()) {
      details.push(`עודכן: ${format(file.updatedAt, 'dd/MM/yy')}`);
    }
    return <p className="text-xs text-muted-foreground">{details.join(' · ')}</p>;
  }

  const renderContext = () => {
    if(file.treeName) {
      return <p className="flex items-center gap-1 text-xs text-muted-foreground"><Home className="h-3 w-3"/>{file.treeName}</p>;
    }
    if(file.personName) {
      return <p className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3"/>{file.personName}</p>;
    }
    return null;
  }
  
  const canDelete = file.storagePath !== '';
  const canEdit = file.type === 'presentation';

  return (
    <Card className="flex flex-col transition-all duration-300 ease-in-out bg-card rounded-xl border shadow-sm hover:shadow-lg hover:-translate-y-0.5">
      <CardHeader className="p-4 flex-row items-start gap-4">
        <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${iconBg}`}>
            <Icon className="w-6 h-6 text-white"/>
        </div>
        <div className="flex-1 space-y-1 text-right">
          <CardTitle className="text-sm font-semibold leading-tight hover:text-primary transition-colors">
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="stretched-link">{file.name}</a>
          </CardTitle>
          {renderDescription()}
        </div>
      </CardHeader>
      <CardContent className="flex-grow p-4 pt-0">
          {renderContext()}
      </CardContent>
      <CardFooter className="p-2 border-t flex justify-end gap-1">
        {canEdit ? (
           <Link href={file.url} passHref>
            <Button variant="ghost" size="sm" asChild><a><Edit className="ml-2 h-4 w-4" />ערוך</a></Button>
           </Link>
        ) : (
           <a href={file.url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="sm"><Eye className="ml-2 h-4 w-4"/>הצג</Button>
           </a>
        )}
        <a href={file.url} download={file.name}>
         <Button variant="ghost" size="sm"><Download className="ml-2 h-4 w-4"/>הורד</Button>
        </a>
        {canDelete && (
         <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="ml-2 h-4 w-4"/>מחק
        </Button>
        )}
      </CardFooter>
    </Card>
  );
}
