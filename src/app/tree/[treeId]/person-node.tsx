'use client';
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import {
  Card,
  CardHeader,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Person } from '@/lib/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Heart, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';

function getPlaceholderImage(gender: Person['gender']) {
    switch(gender) {
        case 'male': return PlaceHolderImages.find(img => img.id === 'male-avatar')?.imageUrl;
        case 'female': return PlaceHolderImages.find(img => img.id === 'female-avatar')?.imageUrl;
        default: return PlaceHolderImages.find(img => img.id === 'other-avatar')?.imageUrl;
    }
}


export const PersonNode = memo(({ data, selected }: NodeProps<Person>) => {
  const { firstName, lastName, birthDate, deathDate, gender, photoURL, status } = data;
  const lifeYears = `${birthDate ? new Date(birthDate).getFullYear() : '?'} – ${deathDate ? new Date(deathDate).getFullYear() : (status === 'deceased' ? '?' : '')}`;

  const getGenderBadge = () => {
    switch (gender) {
      case 'male': return <Badge variant="outline" className="border-blue-500 text-blue-500">זכר</Badge>;
      case 'female': return <Badge variant="outline" className="border-pink-500 text-pink-500">נקבה</Badge>;
      default: return <Badge variant="secondary">אחר</Badge>;
    }
  };
  
  const getStatusIcon = () => {
    switch (status) {
        case 'alive': return <Heart className="h-4 w-4 text-green-500 fill-green-500" />;
        case 'deceased': return <Skull className="h-4 w-4 text-muted-foreground" />;
        default: return null;
    }
  }

  const handleStyle = {
    width: 10,
    height: 10,
    background: 'hsl(var(--primary))',
  };

  return (
    <Card className={cn("w-64 shadow-lg border-2 transition-colors duration-200", selected ? 'border-primary shadow-primary/20' : 'border-transparent')}>
      {/* Parent handle */}
      <Handle type="target" position={Position.Top} id="top" style={handleStyle} />
      
      {/* Child handle */}
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />

      {/* Spouse/Partner handles */}
      <Handle type="source" position={Position.Left} id="left-upper" style={{ ...handleStyle, top: '33%' }} />
      <Handle type="target" position={Position.Left} id="left-upper" style={{ ...handleStyle, top: '33%' }} />
      <Handle type="source" position={Position.Right} id="right-upper" style={{ ...handleStyle, top: '33%' }} />
      <Handle type="target" position={Position.Right} id="right-upper" style={{ ...handleStyle, top: '33%' }} />

      {/* Sibling handles */}
      <Handle type="source" position={Position.Left} id="left-lower" style={{ ...handleStyle, top: '66%' }} />
      <Handle type="target" position={Position.Left} id="left-lower" style={{ ...handleStyle, top: '66%' }} />
      <Handle type="source" position={Position.Right} id="right-lower" style={{ ...handleStyle, top: '66%' }} />
      <Handle type="target" position={Position.Right} id="right-lower" style={{ ...handleStyle, top: '66%' }} />
      
      <CardHeader className="p-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border">
            <AvatarImage src={photoURL || ''} data-ai-hint="person photo" />
            <AvatarFallback>
                <img src={getPlaceholderImage(gender)} alt={`${firstName} ${lastName}`} />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <h3 className="font-bold text-lg leading-tight">{`${firstName} ${lastName}`}</h3>
            <p className="text-sm text-muted-foreground">{lifeYears}</p>
            <div className='flex items-center gap-2 pt-1'>
                {getGenderBadge()}
                {getStatusIcon()}
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
});

PersonNode.displayName = 'PersonNode';
