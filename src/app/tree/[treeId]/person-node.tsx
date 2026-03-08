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
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Heart, Lock, Baby, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInYears } from 'date-fns';

export const PersonNode = memo(({ data, selected }: NodeProps<Person>) => {
  const { firstName, lastName, birthDate, deathDate, gender, photoURL, status, religion, isOwner, isLocked, childrenCount, siblingsCount, grandchildrenCount, greatGrandchildrenCount, gen4Count, gen5Count } = data;

  const getLifeYearsDisplay = () => {
    try {
      const hasBirthDate = birthDate && !isNaN(new Date(birthDate).getTime());
      const hasDeathDate = deathDate && !isNaN(new Date(deathDate).getTime());

      if (hasBirthDate && !hasDeathDate && status === 'alive') {
        const age = differenceInYears(new Date(), new Date(birthDate!));
        return (
          <>
            {format(new Date(birthDate!), 'dd/MM/yyyy')}
            <span className="font-bold"> (גיל {age})</span>
          </>
        );
      }
      if (hasBirthDate && hasDeathDate) {
        return `${format(new Date(birthDate!), 'dd/MM/yyyy')} – ${format(new Date(deathDate!), 'dd/MM/yyyy')}`;
      }
      if (hasBirthDate) {
         return `${format(new Date(birthDate!), 'dd/MM/yyyy')} – ?`;
      }
       if (hasDeathDate) {
        return `? – ${format(new Date(deathDate!), 'dd/MM/yyyy')}`;
      }
    } catch(e) {
      console.error("Date formatting error:", e);
      if (birthDate && deathDate) return `${birthDate} – ${deathDate}`;
      if (birthDate) return birthDate;
    }
    return '';
  };

  const lifeYears = getLifeYearsDisplay();

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
        default: return null;
    }
  }
  
  const getReligionIcon = () => {
    const iconStyle: React.CSSProperties = { fontSize: '1rem', lineHeight: '1', color: 'hsl(var(--muted-foreground))' };
    switch (religion) {
        case 'jewish': return <span style={iconStyle} title="יהדות">✡</span>;
        case 'christian': return <span style={iconStyle} title="נצרות">✝</span>;
        case 'muslim': return <span style={iconStyle} title="אסלאם">☪</span>;
        case 'buddhist': return <span style={iconStyle} title="בודהיזם">☸</span>;
        default: return null;
    }
  }


  const handleStyle = {
    width: 10,
    height: 10,
    background: 'hsl(var(--primary))',
  };

  return (
    <Card className={cn(
        "w-64 shadow-lg border-2 transition-colors duration-200 relative", 
        selected ? 'border-primary shadow-primary/20' : 'border-transparent',
        isOwner ? 'ring-2 ring-primary/50 shadow-xl shadow-primary/20' : '',
        isLocked && 'border-destructive'
    )}>
      {isLocked && (
        <div className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 z-10">
          <Lock className="h-3 w-3" />
        </div>
      )}
      {/* Each handle has a unique ID. Side handles are split into `source` and `target` to be unambiguous. */}
      
      {/* Parent handle (target only) */}
      <Handle type="target" position={Position.Top} id="top" style={handleStyle} />
      
      {/* Child handle (source only) */}
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />

      {/* Spouse/Partner handles (upper) */}
      <Handle type="source" position={Position.Left} id="upper-left-source" style={{ ...handleStyle, top: '33%' }} />
      <Handle type="source" position={Position.Right} id="upper-right-source" style={{ ...handleStyle, top: '33%' }} />

      {/* Sibling handles (lower) */}
      <Handle type="source" position={Position.Left} id="lower-left-source" style={{ ...handleStyle, top: '66%' }} />
      <Handle type="source" position={Position.Right} id="lower-right-source" style={{ ...handleStyle, top: '66%' }} />
      
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
            {lifeYears && <p className="text-sm text-muted-foreground">{lifeYears}</p>}
            <div className='flex items-center gap-2 pt-1'>
                {getGenderBadge()}
                {getStatusIcon()}
                {getReligionIcon()}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
                {(childrenCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`${childrenCount} ילדים`}>
                        <Baby className="h-4 w-4" />
                        <span className="font-medium">{childrenCount}</span>
                    </div>
                )}
                {(siblingsCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`${siblingsCount} אחים`}>
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{siblingsCount}</span>
                    </div>
                )}
                {(grandchildrenCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`${grandchildrenCount} נכדים`}>
                        <Users className="h-4 w-4 opacity-80" />
                        <span className="font-medium">{grandchildrenCount}</span>
                    </div>
                )}
                {(greatGrandchildrenCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`${greatGrandchildrenCount} נינים`}>
                        <Users className="h-4 w-4 opacity-70" />
                        <span className="font-medium">{greatGrandchildrenCount}</span>
                    </div>
                )}
                {(gen4Count || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`${gen4Count} חִמֵּשׁ`}>
                        <Users className="h-4 w-4 opacity-60" />
                        <span className="font-medium">{gen4Count}</span>
                    </div>
                )}
                {(gen5Count || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground" title={`${gen5Count} שִׁשַּׁשׁ`}>
                        <Users className="h-4 w-4 opacity-50" />
                        <span className="font-medium">{gen5Count}</span>
                    </div>
                )}
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
});

PersonNode.displayName = 'PersonNode';
