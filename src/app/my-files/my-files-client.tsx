'use client';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { useUser, useFirestore, useStorage } from '@/firebase';
import type { ExportedFile, FamilyTree, Person, GalleryPhoto, RootsProject } from '@/lib/types';
import { Button } from '@/components/ui/button';
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
  collection, query, where, getDocs, deleteDoc, doc, collectionGroup, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Loader2, Search, FileArchive, UploadCloud,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FileCard } from './file-card';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';

type FileType = 'exported' | 'profile' | 'gallery' | 'presentation' | 'general';

export interface DisplayFile {
  id: string;
  type: FileType;
  name: string;
  url: string;
  size: number;
  createdAt: Date;
  updatedAt?: Date;
  treeName?: string;
  personName?: string;
  storagePath: string;
  version?: number;
}

// Helper to safely convert Firestore timestamps or JS Dates
const toDateSafe = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp.toDate) return timestamp.toDate();
    return new Date(timestamp);
};


export function MyFilesClient() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [allFiles, setAllFiles] = useState<DisplayFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [fileToDelete, setFileToDelete] = useState<DisplayFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const generalFileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!user || !db) return;
    setIsLoading(true);

    try {
      const files: DisplayFile[] = [];

      // 1. Exported Files
      const exportsQuery = query(collection(db, 'exportedFiles'), where('userId', '==', user.uid));
      const exportsSnap = await getDocs(exportsQuery);
      exportsSnap.forEach(doc => {
        const data = doc.data() as ExportedFile;
        if (data.downloadURL && data.storagePath) {
          files.push({
            id: doc.id,
            type: 'exported',
            name: data.fileName,
            url: data.downloadURL,
            size: data.fileSizeBytes,
            createdAt: toDateSafe(data.createdAt),
            treeName: data.treeName,
            storagePath: data.storagePath,
          });
        }
      });

      // 2. Tree/Profile/Gallery Photos
      const treesQuery = query(collection(db, 'users', user.uid, 'familyTrees'));
      const treesSnap = await getDocs(treesQuery);
      
      const treePromises = treesSnap.docs.map(async (treeDoc) => {
        const treeData = treeDoc.data() as FamilyTree;
        const peopleRef = collection(treeDoc.ref, 'people');
        const peopleSnap = await getDocs(peopleRef);
        const treeFiles: DisplayFile[] = [];

        const personPromises = peopleSnap.docs.map(async (personDoc) => {
          const person = personDoc.data() as Person;

          // Profile Photos
          if (person.photoURL) {
             treeFiles.push({
              id: `profile-${personDoc.id}`,
              type: 'profile',
              name: `תמונת פרופיל - ${person.firstName} ${person.lastName}`,
              url: person.photoURL,
              size: 0,
              createdAt: toDateSafe(person.createdAt),
              updatedAt: toDateSafe(person.updatedAt),
              personName: `${person.firstName} ${person.lastName}`,
              treeName: treeData.treeName,
              storagePath: '', // Cannot be deleted from here
            });
          }
          
          // Gallery Photos
          const galleryRef = collection(personDoc.ref, 'gallery');
          const gallerySnap = await getDocs(galleryRef);
          gallerySnap.forEach((photoDoc) => {
            const photo = photoDoc.data() as GalleryPhoto;
            treeFiles.push({
              id: photoDoc.id,
              type: 'gallery',
              name: 'תמונה מהגלריה',
              url: photo.url,
              size: 0,
              createdAt: toDateSafe(photo.createdAt),
              personName: `${person.firstName} ${person.lastName}`,
              treeName: treeData.treeName,
              storagePath: photo.storagePath,
            });
          });
        });
        await Promise.all(personPromises);

         // Presentations (Roots Works)
        const rootsQuery = query(collection(treeDoc.ref, 'rootsProjects'));
        const rootsSnap = await getDocs(rootsQuery);
        rootsSnap.forEach(doc => {
            const project = doc.data() as RootsProject;
            treeFiles.push({
                id: doc.id,
                type: 'presentation',
                name: project.projectName || 'עבודת שורשים',
                url: `/tree/${project.treeId}/?view=roots`,
                size: 0, // Size is not applicable here
                createdAt: toDateSafe(project.createdAt),
                updatedAt: toDateSafe(project.updatedAt),
                treeName: treeData.treeName,
                storagePath: '', // No direct file to delete
            });
        });

        return treeFiles;
      });

      const allTreeFiles = (await Promise.all(treePromises)).flat();
      files.push(...allTreeFiles);

      setAllFiles(files.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error("Error fetching files:", error);
      toast({ variant: "destructive", title: "שגיאה בטעינת הקבצים" });
    }
    setIsLoading(false);
  }, [user, db, toast]);
  
  useEffect(() => {
    if (user && !isUserLoading) fetchData();
  }, [user, isUserLoading, fetchData]);

  const handleDeleteFile = async () => {
    if (!fileToDelete || !db || !storage || !user) return;
    setIsDeleting(true);
    try {
        if (fileToDelete.storagePath) {
            const fileRef = ref(storage, fileToDelete.storagePath);
            await deleteObject(fileRef);
        }

        let docRef;
        if(fileToDelete.type === 'exported') {
            docRef = doc(db, 'exportedFiles', fileToDelete.id);
        } else if (fileToDelete.type === 'gallery') {
            const pathSegments = fileToDelete.storagePath.split('/');
            // users/{uid}/trees/{tid}/people/{pid}/gallery/{fid}
             if(pathSegments.length >= 7) {
                const treeId = pathSegments[3];
                const personId = pathSegments[5];
                docRef = doc(db, 'users', user.uid, 'familyTrees', treeId, 'people', personId, 'gallery', fileToDelete.id);
            }
        }
        
        if (docRef) {
          await deleteDoc(docRef);
        }

        toast({ title: "הקובץ נמחק בהצלחה" });
        setAllFiles(prev => prev.filter(f => f.id !== fileToDelete.id));

    } catch (error) {
        console.error("Error deleting file:", error);
        toast({ variant: "destructive", title: "שגיאה במחיקת הקובץ" });
    }
    setFileToDelete(null);
    setIsDeleting(false);
  };

  const handleGeneralImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !storage || !db) return;

    setIsUploading(true);
    toast({ title: "מעלה תמונה..." });

    try {
        const storagePath = `users/${user.uid}/general_gallery/${uuidv4()}-${file.name}`;
        const fileRef = ref(storage, storagePath);
        const snapshot = await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        const newFileEntry: Omit<DisplayFile, 'id'> = {
            type: 'general',
            name: file.name,
            url: downloadURL,
            size: file.size,
            createdAt: new Date(),
            storagePath: storagePath,
        };
        
        // This is a temporary solution. For a real app, you'd save this metadata to Firestore.
        setAllFiles(prev => [...prev, { ...newFileEntry, id: uuidv4() }].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
        
        toast({ title: "התמונה הועלתה לגלריה הכללית" });

    } catch (error) {
        console.error("General image upload error:", error);
        toast({ variant: 'destructive', title: 'שגיאה בהעלאת התמונה' });
    } finally {
        setIsUploading(false);
        if (generalFileInputRef.current) generalFileInputRef.current.value = "";
    }
  };

  const filteredFiles = useMemo(() => {
    const lowercasedSearch = search.toLowerCase();
    return allFiles.filter(file => 
      (file.name?.toLowerCase().includes(lowercasedSearch)) ||
      (file.treeName?.toLowerCase().includes(lowercasedSearch)) ||
      (file.personName?.toLowerCase().includes(lowercasedSearch))
    );
  }, [allFiles, search]);

  const sections = useMemo<{ title: string; type: FileType; files: DisplayFile[], gridClass: string }[]>(() => [
    { title: 'קבצים שיוצאו', type: 'exported', files: filteredFiles.filter(f => f.type === 'exported'), gridClass: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' },
    { title: 'תמונות פרופיל', type: 'profile', files: filteredFiles.filter(f => f.type === 'profile'), gridClass: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' },
    { title: 'גלריית בני המשפחה', type: 'gallery', files: filteredFiles.filter(f => f.type === 'gallery'), gridClass: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' },
    { title: 'מצגות עבודות שורשים', type: 'presentation', files: filteredFiles.filter(f => f.type === 'presentation'), gridClass: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' },
    { title: 'גלריה כללית', type: 'general', files: filteredFiles.filter(f => f.type === 'general'), gridClass: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' },
  ], [filteredFiles]);
  
  const totalFiles = useMemo(() => allFiles.length, [allFiles]);

  const renderSection = (section: typeof sections[0]) => (
     <section key={section.type}>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold tracking-tight text-slate-900">{section.title}</h3>
            {section.type === 'general' && (
                <>
                 <input type="file" ref={generalFileInputRef} onChange={handleGeneralImageUpload} className="hidden" accept="image/*" disabled={isUploading}/>
                <Button onClick={() => generalFileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <UploadCloud className="ml-2 h-4 w-4" />}
                    העלה לגלריה
                </Button>
                </>
            )}
        </div>
        {section.files.length > 0 ? (
            <div className={cn("grid gap-6", section.gridClass)}>
                {section.files.map(file => (
                    <FileCard key={file.id} file={file} onDelete={() => file.storagePath && setFileToDelete(file)} />
                ))}
            </div>
        ) : (
             <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center bg-muted/30 rounded-xl">
                <FileArchive className="h-12 w-12 mx-auto opacity-50" />
                <p className="mt-4 text-sm">אין קבצים להצגה בסעיף זה.</p>
            </div>
        )}
    </section>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin" />
        <p className="mt-4">טוען קבצים...</p>
      </div>
    );
  }

  return (
    <>
       <div className="relative isolate overflow-hidden bg-slate-900">
        <div className="container mx-auto px-4 py-16 sm:py-24 lg:py-32 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                הקבצים שלי
            </h1>
            <p className="mt-6 text-lg max-w-2xl mx-auto text-slate-300">
                נהל את כל הקבצים, התמונות והמצגות המשפחתיות שלך במקום אחד.
            </p>
        </div>
        <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
          <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#16a34a] to-[#26a69a] opacity-30 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" style={{clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'}}></div>
        </div>
      </div>

      <main className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8 gap-4">
            <h2 className="text-2xl font-bold">סייר הקבצים ({totalFiles})</h2>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="חיפוש קבצים..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
        </div>

        <div className="space-y-12">
            {sections.map(renderSection)}
        </div>
      </main>

      <AlertDialog open={!!fileToDelete} onOpenChange={(open) => !open && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את הקובץ <strong className='text-foreground'>{fileToDelete?.name}</strong>.
              לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>ביטול</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteFile} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : 'מחק'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
