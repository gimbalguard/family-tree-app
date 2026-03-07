'use client';
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Person } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { differenceInYears } from 'date-fns';

function getPlaceholderImage(gender: Person['gender']) {
    switch(gender) {
        case 'male': return PlaceHolderImages.find(img => img.id === 'male-avatar')?.imageUrl;
        case 'female': return PlaceHolderImages.find(img => img.id === 'female-avatar')?.imageUrl;
        default: return PlaceHolderImages.find(img => img.id === 'other-avatar')?.imageUrl;
    }
}

export const TimelinePersonNode = memo(({ data, selected }: NodeProps<Person>) => {
  const { firstName, lastName, birthDate, deathDate, gender, photoURL, status } = data;

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
        "flex items-center gap-2 rounded-lg p-2 bg-card border-2 shadow-md transition-colors duration-200 w-56", 
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
      <div className="flex-1 space-y-0 leading-tight">
        <h3 className="font-semibold text-sm">{`${firstName} ${lastName}`}</h3>
        {lifeYears && <p className="text-xs text-muted-foreground">{lifeYears}</p>}
      </div>
    </div>
  );
});

TimelinePersonNode.displayName = 'TimelinePersonNode';
