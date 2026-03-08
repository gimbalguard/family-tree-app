'use client';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { useUser, useFirestore, useStorage } from '@/firebase';
import type { ExportedFile, FamilyTree } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import {
  Loader2,
  Search,
  FileArchive,
  FileDown,
  Trash2,
  Filter,
  Calendar,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Presentation,
  ImageIcon,
  Globe,
  Book,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import Link from 'next/link';

type SortOption = 'newest' | 'oldest' | 'largest' | 'az';

const FILE_ICONS: Record<ExportedFile['fileType'], { icon: React.FC<any>; color: string }> = {
  pdf: { icon: FileText, color: 'text-red-500' },
  xlsx: { icon: FileSpreadsheet, color: 'text-green-600' },
  pptx: { icon: Presentation, color: 'text-orange-500' },
  png: { icon: ImageIcon, color: 'text-blue-500' },
  html: { icon: Globe, color: 'text-purple-500' },
  docx: { icon: Book, color: 'text-teal-600' },
};

export function MyFilesClient() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [files, setFiles] = useState<ExportedFile[]>([]);
  const [trees, setTrees] = useState<FamilyTree[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterTree, setFilterTree] = useState('all');
  const [sort, setSort] = useState<SortOption>('newest');
  
  const [fileToDelete, setFileToDelete] = useState<ExportedFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || !db) return;
    setIsLoading(true);
    try {
      const filesQuery = query(collection(db, 'exportedFiles'), where('userId', '==', user.uid));
      const treesQuery = query(collection(db, 'users', user.uid, 'familyTrees'));
      
      const [filesSnapshot, treesSnapshot] = await Promise.all([getDocs(filesQuery), getDocs(treesQuery)]);

      const userFiles = filesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ExportedFile));
      const userTrees = treesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as FamilyTree));

      setFiles(userFiles);
      setTrees(userTrees);

    } catch (error) {
      console.error('Error fetching files:', error);
      toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה לטעון את הקבצים שלך.' });
    }
    setIsLoading(false);
  }, [user, db, toast]);

  useEffect(() => {
    if (!isUserLoading && user) {
      fetchData();
    } else if (!isUserLoading && !user) {
      setIsLoading(false);
    }
  }, [isUserLoading, user, fetchData]);
  
  const filteredAndSortedFiles = useMemo(() => {
    return files
      .filter(file => search ? file.fileName.toLowerCase().includes(search.toLowerCase()) : true)
      .filter(file => filterType === 'all' ? true : file.fileType === filterType)
      .filter(file => filterTree === 'all' ? true : file.treeId === filterTree)
      .sort((a, b) => {
        switch (sort) {
          case 'oldest': return a.createdAt.toMillis() - b.createdAt.toMillis();
          case 'largest': return b.fileSizeBytes - a.fileSizeBytes;
          case 'az': return a.fileName.localeCompare(b.fileName);
          case 'newest':
          default:
            return b.createdAt.toMillis() - a.createdAt.toMillis();
        }
      });
  }, [files, search, filterType, filterTree, sort]);
  
  const storageUsedBytes = useMemo(() => files.reduce((acc, file) => acc + file.fileSizeBytes, 0), [files]);
  const storageLimitBytes = 500 * 1024 * 1024; // 500 MB
  const storageUsedPercent = Math.min(100, (storageUsedBytes / storageLimitBytes) * 100);

  const handleDeleteClick = (file: ExportedFile) => {
    setFileToDelete(file);
  };
  
  const handleConfirmDelete = async () => {
    if (!fileToDelete || !storage || !db) return;
    setIsDeleting(true);
    try {
        const fileRef = ref(storage, fileToDelete.storagePath);
        await deleteObject(fileRef);

        const docRef = doc(db, 'exportedFiles', fileToDelete.id);
        await deleteDoc(docRef);

        toast({ title: 'הקובץ נמחק' });
        setFiles(prev => prev.filter(f => f.id !== fileToDelete.id));
    } catch (error) {
        console.error('Error deleting file:', error);
        toast({ variant: 'destructive', title: 'שגיאה', description: 'לא ניתן היה למחוק את הקובץ.' });
    }
    setIsDeleting(false);
    setFileToDelete(null);
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-12 w-12 animate-spin" />
          <p className="mt-4">טוען קבצים...</p>
        </div>
      );
    }
    if (files.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground text-center">
            <FileArchive className="h-20 w-20 mx-auto" />
            <h3 className="mt-6 text-xl font-semibold">עדיין לא ייצאת קבצים</h3>
            <p className="mt-2 text-sm max-w-sm">
                כל קובץ שתייצא מעץ משפחה (PDF, Excel, וכו') יישמר כאן אוטומטית לגישה נוחה.
            </p>
            <Button asChild className="mt-6">
                <Link href="/dashboard">עבור לעצים שלי →</Link>
            </Button>
        </div>
      );
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredAndSortedFiles.map(file => {
                const Icon = FILE_ICONS[file.fileType]?.icon || FileArchive;
                const iconColor = FILE_ICONS[file.fileType]?.color || 'text-muted-foreground';
                return (
                    <div key={file.id} className="bg-card border rounded-lg shadow-sm flex flex-col transition-all hover:shadow-md">
                        <div className="p-4 flex-grow flex flex-col">
                            <div className="flex justify-center mb-4">
                                <Icon className={`h-12 w-12 ${iconColor}`} />
                            </div>
                            <h3 className="font-bold text-sm text-center truncate" title={file.fileName}>{file.fileName}</h3>
                            <p className="text-xs text-muted-foreground text-center mt-1">עץ: {file.treeName}</p>
                             <p className="text-xs text-muted-foreground text-center mt-2">
                                {format(file.createdAt.toDate(), 'dd/MM/yyyy')} &bull; {(file.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                            </p>
                        </div>
                        <div className="flex border-t">
                            <a href={file.downloadURL} target="_blank" rel="noopener noreferrer" className="flex-1">
                                <Button variant="ghost" className="w-full rounded-none rounded-br-md">
                                    <FileDown className="ml-2 h-4 w-4" />
                                    הורד
                                </Button>
                            </a>
                            <div className="border-l h-full my-auto h-6 self-center"/>
                             <Button variant="ghost" className="flex-1 rounded-none rounded-bl-md" onClick={() => handleDeleteClick(file)}>
                                <Trash2 className="ml-2 h-4 w-4 text-destructive" />
                                מחק
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold tracking-tight">הקבצים שלי</h1>
        <div className="flex items-center gap-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="חיפוש לפי שם קובץ..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="shrink-0">
                        <Filter className="ml-2 h-4 w-4" />
                        סנן לפי סוג
                        {filterType !== 'all' && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">{filterType}</span>}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                     <DropdownMenuRadioGroup value={filterType} onValueChange={setFilterType}>
                        <DropdownMenuRadioItem value="all">הכל</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="pdf">PDF</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="xlsx">Excel</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="pptx">PowerPoint</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="shrink-0">
                        <Filter className="ml-2 h-4 w-4" />
                        סנן לפי עץ
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                     <DropdownMenuRadioGroup value={filterTree} onValueChange={setFilterTree}>
                        <DropdownMenuRadioItem value="all">כל העצים</DropdownMenuRadioItem>
                        {trees.map(tree => (
                            <DropdownMenuRadioItem key={tree.id} value={tree.id}>{tree.treeName}</DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="shrink-0">
                        <Calendar className="ml-2 h-4 w-4" />
                        מיין לפי
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                     <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                        <DropdownMenuRadioItem value="newest">החדש ביותר</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="oldest">הישן ביותר</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="largest">הגדול ביותר</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="az">א-ת</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>
      
       <div className="mb-8 p-4 border rounded-lg bg-card">
            <h3 className="font-semibold text-sm">שטח אחסון בשימוש</h3>
            <div className="flex items-center gap-4 mt-2">
                <div className="flex-1">
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-primary transition-all" style={{ width: `${storageUsedPercent}%`}}/>
                    </div>
                </div>
                <div className="text-xs text-muted-foreground">
                    <span className="font-bold text-foreground">{(storageUsedBytes / (1024*1024)).toFixed(2)} MB</span> / 500 MB
                    ({storageUsedPercent.toFixed(1)}%)
                </div>
            </div>
        </div>

      {renderContent()}

      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את הקובץ <strong className='text-foreground'>{fileToDelete?.fileName}</strong>.
              לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ביטול</AlertDialogCancel>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : 'מחק'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
