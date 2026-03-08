import Link from 'next/link';
import type { FamilyTree, PublicTree, SharedTree } from '@/lib/types';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type CardTree = FamilyTree | (SharedTree & { ownerUsername?: string }) | PublicTree;

type TreeCardProps = {
  tree: CardTree;
  type: 'owned' | 'shared' | 'public';
  onDelete?: () => void;
  onDuplicate?: () => void;
  onShare?: () => void;
  onSetPublic?: () => void;
  onCreateShareLink?: () => void;
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
  onSetPublic,
  onCreateShareLink,
}: TreeCardProps) {
  
  const creationDate = tree.createdAt?.toDate
    ? format(tree.createdAt.toDate(), 'd MMM, yyyy', { locale: he })
    : 'לא זמין';

  const treeId = type === 'shared' ? (tree as SharedTree).treeId : tree.id;
  const linkHref = `/tree/${treeId}`;

  return (
    <Card className="flex flex-col transition-all hover:shadow-xl hover:-translate-y-1 duration-300 ease-in-out">
      <CardHeader className="flex-row items-start gap-4 space-y-0 pb-2">
        <div className="flex-1 space-y-1">
          <CardTitle className="hover:text-primary transition-colors text-lg">
            <Link href={linkHref} className="stretched-link">
              {tree.treeName}
            </Link>
          </CardTitle>
          <CardDescription>
            <div className="flex items-center text-xs text-muted-foreground">
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
                    : 'ownerUsername' in tree
                    ? tree.ownerUsername
                    : 'Unknown'}
                </>
              )}
            </div>
          </CardDescription>
        </div>
        {type === 'owned' && (
          <div className="relative z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                 <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="ml-2 h-4 w-4" /> שכפל עץ
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={onShare}>
                    <Share2 className="ml-2 h-4 w-4" /> שתף עם משתמש
                 </DropdownMenuItem>
                 <DropdownMenuSeparator/>
                 <DropdownMenuItem onClick={onCreateShareLink}>
                    <LinkIcon className="ml-2 h-4 w-4" /> צור קישור שיתוף
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={onSetPublic}>
                    <Globe className="ml-2 h-4 w-4" /> הגדר כציבורי
                 </DropdownMenuItem>
                 <DropdownMenuSeparator/>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                  <Trash2 className="ml-2 h-4 w-4" /> מחק
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-grow space-y-2">
         {type === 'owned' && <PrivacyBadge privacy={(tree as FamilyTree).privacy} />}
        <div className="space-y-1 text-sm text-muted-foreground pt-2">
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
      <CardFooter>
        <Button asChild variant="secondary" className="w-full">
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
