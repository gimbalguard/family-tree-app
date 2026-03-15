
import Link from 'next/link';
import type { FamilyTree, PublicTree, SharedTree } from '@/lib/types';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Users,
  GitCommit,
  Calendar,
  Trash2,
  Share2,
  Copy,
  Globe,
  Link as LinkIcon,
  User,
  Lock,
  Upload,
  Image as ImageIcon,
  Edit,
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type CardTree = FamilyTree | (SharedTree & { ownerUsername?: string }) | PublicTree;

type TreeCardProps = {
  tree: CardTree;
  type: 'owned' | 'shared' | 'public';
  onDelete?: () => void;
  onDuplicate?: () => void;
  onShare?: () => void;
  onRename?: () => void;
  onSetPublic?: () => void;
  onSetPrivate?: () => void;
  onUploadCover?: () => void;
  onCreateShareLink?: () => void;
  sharedWith?: string[];
};

const PrivacyBadge = ({ privacy }: { privacy?: FamilyTree['privacy'] }) => {
  switch (privacy) {
    case 'public':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
          <Globe className="h-3 w-3 ml-1" />
          ציבורי
        </Badge>
      );
    case 'link':
      return (
        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">
          <LinkIcon className="h-3 w-3 ml-1" />
          קישור בלבד
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Lock className="h-3 w-3 ml-1" />
          פרטי
        </Badge>
      );
  }
};

export function TreeCard({
  tree,
  type,
  onDelete,
  onDuplicate,
  onShare,
  onRename,
  onSetPublic,
  onSetPrivate,
  onUploadCover,
  onCreateShareLink,
  sharedWith,
}: TreeCardProps) {
  
  const creationDate = tree.createdAt?.toDate
    ? format(tree.createdAt.toDate(), 'd MMM, yyyy', { locale: he })
    : 'לא זמין';

  const treeId = 'treeId' in tree ? tree.treeId : tree.id;
  const linkHref = type === 'public' ? `/view/${treeId}` : `/tree/${treeId}`;
  const coverPhotoURL = (tree as FamilyTree).coverPhotoURL;

  return (
    <Card className="flex flex-col transition-all duration-300 ease-in-out bg-card rounded-xl border shadow-md hover:shadow-xl hover:-translate-y-1 overflow-hidden">
      <div className="relative h-28 bg-muted">
        <Link href={linkHref} className="block w-full h-full">
          {coverPhotoURL ? (
            <Image
              src={coverPhotoURL}
              alt={tree.treeName}
              layout="fill"
              objectFit="cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </Link>
      </div>

      <CardHeader className="flex-row items-start gap-4 space-y-0 pb-2 p-4 relative -mt-10 z-10">
        <div className="flex-1 space-y-1">
          <CardTitle className="hover:text-primary transition-colors text-lg text-white [text-shadow:_0_1px_3px_var(--tw-shadow-color)]">
            <Link href={linkHref} className="relative z-10">
              {tree.treeName}
            </Link>
          </CardTitle>
          <CardDescription>
            <div className="flex items-center text-xs text-slate-300 [text-shadow:_0_1px_2px_var(--tw-shadow-color)]">
              {type === 'owned' ? (
                <>
                  <Calendar className="ml-1 h-3 w-3" />
                  נוצר ב-{creationDate}
                </>
              ) : (
                <>
                  <User className="ml-1 h-3 w-3" />
                  בעלים:{' '}
                  {'ownerName' in tree
                    ? tree.ownerName
                    : 'Unknown'}
                </>
              )}
            </div>
          </CardDescription>
        </div>
        {type === 'owned' && (
          <div className="relative z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2 text-white hover:bg-white/20 hover:text-white">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                 <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="ml-2 h-4 w-4" /> שכפל עץ
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={onRename}>
                    <Edit className="ml-2 h-4 w-4" /> שנה שם
                 </DropdownMenuItem>
                  <DropdownMenuItem onClick={onShare}>
                      <Share2 className="ml-2 h-4 w-4" /> שתף עם משתמש
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onUploadCover}>
                      <Upload className="ml-2 h-4 w-4" /> העלאת תמונת נושא
                  </DropdownMenuItem>
                  <DropdownMenuSeparator/>
                  <DropdownMenuItem onClick={onCreateShareLink}>
                      <LinkIcon className="ml-2 h-4 w-4" /> צור קישור שיתוף
                  </DropdownMenuItem>

                  {(tree as FamilyTree).privacy === 'public' ? (
                    <DropdownMenuItem onClick={onSetPrivate}>
                        <Lock className="ml-2 h-4 w-4" /> הגדר כפרטי
                    </DropdownMenuItem>
                    ) : (
                    <DropdownMenuItem onClick={onSetPublic}>
                        <Globe className="ml-2 h-4 w-4" /> הגדר כציבורי
                    </DropdownMenuItem>
                  )}
                 <DropdownMenuSeparator/>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <Trash2 className="ml-2 h-4 w-4" /> מחק
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-grow space-y-2 p-3">
         {type === 'owned' && 'privacy' in tree && <PrivacyBadge privacy={(tree as FamilyTree).privacy} />}
        
        {sharedWith && sharedWith.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-600 mb-2">שותף עם:</p>
            <TooltipProvider>
              <div className="flex items-center space-x-2 space-x-reverse">
                {sharedWith.slice(0, 5).map((email, index) => (
                  <Tooltip key={index}>
                    <TooltipTrigger>
                      <Avatar className="h-6 w-6 border-2 border-white">
                        <AvatarFallback>{email.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{email}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {sharedWith.length > 5 && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Avatar className="h-6 w-6 border-2 border-white">
                        <AvatarFallback>+{sharedWith.length - 5}</AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>ועוד {sharedWith.length - 5}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          </div>
        )}

        <div className="space-y-1 text-sm text-slate-600 pt-2">
          <div className="flex items-center">
            <Users className="ml-2 h-4 w-4" />
            <span>{tree.personCount ?? 0} אנשים</span>
          </div>
          <div className="flex items-center">
            <GitCommit className="ml-2 h-4 w-4" />
            <span>{tree.relationshipCount ?? 0} קשרים</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-3">
        <Button asChild variant="default" className="w-full">
          <Link href={linkHref}>פתח עץ</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function TreeCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent className="flex-grow space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}
