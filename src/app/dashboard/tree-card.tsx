import Link from 'next/link';
import type { FamilyTree } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Users,
  GitCommit,
  Calendar,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

type TreeCardProps = {
  tree: FamilyTree;
  onDelete: () => void;
};

export function TreeCard({ tree, onDelete }: TreeCardProps) {
  const creationDate = tree.createdAt?.toDate
    ? format(tree.createdAt.toDate(), 'd MMM, yyyy', { locale: he })
    : 'לא זמין';

  return (
    <Card className="flex flex-col transition-all hover:shadow-lg">
      <CardHeader className="flex-row items-start gap-4 space-y-0">
        <div className="flex-1 space-y-1">
          <CardTitle className="hover:text-primary">
            <Link href={`/tree/${tree.id}`} className="stretched-link">
              {tree.treeName}
            </Link>
          </CardTitle>
          <CardDescription>
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="ml-1 h-3 w-3" />
              נוצר ב-{creationDate}
            </div>
          </CardDescription>
        </div>
        <div className="relative z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onDelete} className="text-destructive justify-end">
                <Trash2 className="ml-2 h-4 w-4" />
                מחק
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-2 text-sm text-muted-foreground">
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
          <Link href={`/tree/${tree.id}`}>פתח עץ</Link>
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
