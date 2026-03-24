
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
  collection, query, where, getDocs, deleteDoc, doc, addDoc, serverTimestamp, collectionGroup,
} from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Loader2, Search, UploadCloud, FileArchive
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FileCard } from './file-card';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type FileType = 'exported' | 'profile' | 'gallery' | 'presentation' | 'general';
type ExportFileType = 'pdf' | 'xlsx' | 'pptx' | 'png' | 'html' | 'docx' | 'jpg' | 'jpeg';

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
  exportType?: ExportFileType;
}

const toDateSafe = (timestamp: any): Date => {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (typeof timestamp === 'string' || timestamp instanceof Date) {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) return date;
  }
  return new Date();
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

    const files: DisplayFile[] = [];

    // Fetch all trees once to create lookup map, as it's needed by others
    const treeNameMap = new Map<string, string>();
    try {
        const treesQuery = query(collection(db, 'users', user.uid, 'familyTrees'));
        const treesSnap = await getDocs(treesQuery);
        treesSnap.docs.forEach(doc => treeNameMap.set(doc.id, (doc.data() as FamilyTree).treeName));
    } catch (error) {
        console.error("Error fetching trees:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת העצים" });
    }

    // 1. Exported Files
    try {
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
                exportType: data.fileType,
            });
            }
        });
    } catch (error) {
        console.error("Error fetching exported files:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת קבצים שיוצאו" });
    }
      
    // Fetch people to create personMap and get profile photos
    const personMap = new Map<string, {name: string, treeId: string}>();
    try {
        const peopleQuery = query(collectionGroup(db, 'people'), where('userId', '==', user.uid));
        const peopleSnap = await getDocs(peopleQuery);
        
        peopleSnap.docs.forEach(doc => {
            const person = doc.data() as Person;
            personMap.set(doc.id, { name: `${person.firstName} ${person.lastName}`, treeId: person.treeId });

            if (person.photoURL) {
                files.push({
                    id: `profile-${doc.id}`,
                    type: 'profile',
                    name: `פרופיל - ${person.firstName} ${person.lastName}`,
                    url: person.photoURL,
                    size: 0,
                    createdAt: toDateSafe(person.createdAt),
                    updatedAt: toDateSafe(person.updatedAt),
                    personName: `${person.firstName} ${person.lastName}`,
                    treeName: treeNameMap.get(person.treeId) || 'עץ לא ידוע',
                    storagePath: '',
                });
            }
        });
    } catch (error) {
        console.error("Error fetching people / profile photos:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת תמונות פרופיל" });
    }


    // 3. Gallery Photos using a collectionGroup query
    try {
        const galleryQuery = query(collectionGroup(db, 'gallery'), where('userId', '==', user.uid));
        const gallerySnap = await getDocs(galleryQuery);
        
        gallerySnap.forEach((photoDoc) => {
            const photo = photoDoc.data() as GalleryPhoto;
            const personInfo = personMap.get(photo.personId);

            files.push({
              id: photoDoc.id,
              type: 'gallery',
              name: personInfo ? `תמונה מהגלריה` : 'תמונה (ללא שיוך)',
              url: photo.url,
              size: 0,
              createdAt: toDateSafe(photo.createdAt),
              personName: personInfo?.name || 'לא משויך',
              treeName: treeNameMap.get(photo.treeId) || 'עץ לא ידוע',
              storagePath: photo.storagePath,
            });
        });
    } catch (error) {
        console.error("Error fetching gallery photos:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת תמונות גלריה" });
    }
      
    // 4. Roots Projects as "presentation" files
    try {
        const rootsQuery = query(collectionGroup(db, 'rootsProjects'), where('userId', '==', user.uid));
        const rootsSnap = await getDocs(rootsQuery);
        rootsSnap.forEach(doc => {
            const project = doc.data() as RootsProject;
            files.push({
                id: `presentation-${project.treeId}-${project.id}`,
                type: 'presentation',
                name: project.projectName || 'עבודת שורשים',
                url: `/tree/${project.treeId}?view=roots`,
                size: 0,
                createdAt: toDateSafe(project.createdAt),
                updatedAt: toDateSafe(project.updatedAt),
                treeName: treeNameMap.get(project.treeId) || 'עץ לא ידוע',
                storagePath: '',
            });
        });
    } catch (error) {
        console.error("Error fetching roots projects:", error);
        toast({ variant: "destructive", title: "שגיאה בטעינת מצגות שורשים" });
    }

    setAllFiles(files.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
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
            // Need to figure out the full path for deletion
            const pathSegments = fileToDelete.storagePath.split('/');
            // Expected path: users/{userId}/trees/{treeId}/people/{personId}/gallery/{fileName}
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

        // This is a temporary solution for client-side display only.
        // A proper implementation would save this to a 'general_gallery' collection.
        const newFileEntry: DisplayFile = {
            id: uuidv4(),
            type: 'general',
            name: file.name,
            url: downloadURL,
            size: file.size,
            createdAt: new Date(),
            storagePath: storagePath,
        };
        
        setAllFiles(prev => [...prev, newFileEntry].sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime()));
        
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

  const sections = useMemo(() => {
    const exportedFiles = filteredFiles.filter(f => f.type === 'exported');
    const exportTypes = [...new Set(exportedFiles.map(f => f.exportType))];

    return {
      exported: { files: exportedFiles, types: exportTypes },
      profile: filteredFiles.filter(f => f.type === 'profile'),
      gallery: filteredFiles.filter(f => f.type === 'gallery'),
      presentations: filteredFiles.filter(f => f.type === 'presentation'),
      general: filteredFiles.filter(f => f.type === 'general'),
    };
  }, [filteredFiles]);
  
  const totalFiles = useMemo(() => allFiles.length, [allFiles]);

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
            
            <section>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-4">קבצים שיוצאו</h3>
              <Tabs defaultValue={sections.exported.types[0] || 'all'} className="w-full">
                <TabsList>
                  {sections.exported.types.map(type => type && <TabsTrigger key={type} value={type}>{type.toUpperCase()}</TabsTrigger>)}
                </TabsList>
                {sections.exported.types.map(type => type && (
                  <TabsContent key={type} value={type} className="mt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {sections.exported.files.filter(f => f.exportType === type).map(file => (
                        <FileCard key={file.id} file={file} onDelete={() => file.storagePath && setFileToDelete(file)} />
                      ))}
                    </div>
                  </TabsContent>
                ))}
                {sections.exported.files.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center bg-muted/30 rounded-xl mt-4">
                      <FileArchive className="h-12 w-12 mx-auto opacity-50" />
                      <p className="mt-4 text-sm">אין קבצים שיוצאו.</p>
                  </div>
                )}
              </Tabs>
            </section>
            
            <section>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-4">תמונות</h3>
              <Tabs defaultValue="profile" className="w-full">
                  <TabsList>
                      <TabsTrigger value="profile">תמונות פרופיל</TabsTrigger>
                      <TabsTrigger value="gallery">גלריית בני המשפחה</TabsTrigger>
                  </TabsList>
                  <TabsContent value="profile" className="mt-6">
                      {sections.profile.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                           {sections.profile.map(file => <FileCard key={file.id} file={file} onDelete={() => {}} />)}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-xl"><p>אין תמונות פרופיל.</p></div>
                      )}
                  </TabsContent>
                  <TabsContent value="gallery" className="mt-6">
                     {sections.gallery.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                           {sections.gallery.map(file => <FileCard key={file.id} file={file} onDelete={() => file.storagePath && setFileToDelete(file)} />)}
                        </div>
                      ) : (
                        <div className="text-center py-10 text-muted-foreground bg-muted/30 rounded-xl"><p>אין תמונות בגלריות.</p></div>
                      )}
                  </TabsContent>
              </Tabs>
            </section>
            
            <section>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 mb-4">מצגות עבודות שורשים</h3>
              {sections.presentations.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {sections.presentations.map(file => (
                    <FileCard key={file.id} file={file} onDelete={() => {}} />
                  ))}
                </div>
              ) : (
                 <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center bg-muted/30 rounded-xl">
                    <FileArchive className="h-12 w-12 mx-auto opacity-50" />
                    <p className="mt-4 text-sm">אין מצגות שמורות.</p>
                </div>
              )}
            </section>
            
            <section>
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold tracking-tight text-slate-900">גלריה כללית</h3>
                  <input type="file" ref={generalFileInputRef} onChange={handleGeneralImageUpload} className="hidden" accept="image/*" disabled={isUploading}/>
                  <Button onClick={() => generalFileInputRef.current?.click()} disabled={isUploading}>
                      {isUploading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <UploadCloud className="ml-2 h-4 w-4" />}
                      העלה לגלריה
                  </Button>
              </div>
              {sections.general.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {sections.general.map(file => (
                    <FileCard key={file.id} file={file} onDelete={() => file.storagePath && setFileToDelete(file)} />
                  ))}
                </div>
              ) : (
                 <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center bg-muted/30 rounded-xl">
                    <FileArchive className="h-12 w-12 mx-auto opacity-50" />
                    <p className="mt-4 text-sm">אין תמונות בגלריה הכללית.</p>
                </div>
              )}
            </section>

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
