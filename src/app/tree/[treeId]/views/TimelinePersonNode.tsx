'use client';
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Person } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { differenceInYears } from 'date-fns';
import { Baby, Users } from 'lucide-react';

function getPlaceholderImage(gender: Person['gender']) {
    switch(gender) {
        case 'male': return PlaceHolderImages.find(img => img.id === 'male-avatar')?.imageUrl;
        case 'female': return PlaceHolderImages.find(img => img.id === 'female-avatar')?.imageUrl;
        default: return PlaceHolderImages.find(img => img.id === 'other-avatar')?.imageUrl;
    }
}

export const TimelinePersonNode = memo(({ data, selected }: NodeProps<Person>) => {
  const { firstName, lastName, birthDate, deathDate, gender, photoURL, status, childrenCount, siblingsCount } = data;

  const getLifeYearsDisplay = () => {
    try {
      const birthYear = birthDate ? new Date(birthDate).getFullYear() : null;
      const deathYear = deathDate ? new Date(deathDate).getFullYear() : null;

      if (birthYear && !deathYear && status === 'alive') {
        const age = differenceInYears(new Date(), new Date(birthDate!));
        return `(גיל ${age})`;
      }
      if (birthYear && deathYear) {
        return `${birthYear}–${deathYear}`;
      }
      if (birthYear) {
         return `${birthYear}–`;
      }
       if (deathYear) {
        return `–${deathYear}`;
      }
    } catch(e) {
      // ignore
    }
    return '';
  };

  const lifeYears = getLifeYearsDisplay();

  return (
    <div className={cn(
        "flex items-center gap-2 rounded-lg p-2 bg-card border-2 shadow-md transition-colors duration-200 w-64", 
        selected ? 'border-primary' : 'border-transparent',
    )}>
      {/* Handles for relationships */}
      <Handle type="source" position={Position.Right} id="source" className="!w-2 !h-2" />
      <Handle type="target" position={Position.Left} id="target" className="!w-2 !h-2" />
      
      <Avatar className="h-9 w-9 border">
        <AvatarImage src={photoURL || ''} data-ai-hint="person photo" />
        <AvatarFallback>
            <img src={getPlaceholderImage(gender)} alt={`${firstName} ${lastName}`} />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-0.5 leading-tight">
        <h3 className="font-semibold text-sm">{`${firstName} ${lastName}`}</h3>
        <p className="text-xs text-muted-foreground">
            {lifeYears || <>&nbsp;</>}
        </p>
         {(childrenCount || 0) > 0 || (siblingsCount || 0) > 0 ? (
            <div className="flex items-center gap-3 pt-1">
                {(childrenCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`${childrenCount} ילדים`}>
                        <Baby className="h-3.5 w-3.5" />
                        <span>{childrenCount}</span>
                    </div>
                )}
                {(siblingsCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`${siblingsCount} אחים`}>
                        <Users className="h-3.5 w-3.5" />
                        <span>{siblingsCount}</span>
                    </div>
                )}
            </div>
        ) : null}
      </div>
    </div>
  );
});

TimelinePersonNode.displayName = 'TimelinePersonNode';
