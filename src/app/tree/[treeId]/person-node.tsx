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
  const { 
    firstName, lastName, birthDate, deathDate, gender, photoURL, status, religion, 
    isOwner, isLocked, childrenCount, siblingsCount, grandchildrenCount, 
    greatGrandchildrenCount, gen4Count, gen5Count,
    // Creator settings
    creatorCardBacklightIntensity,
    creatorCardBacklightDisabled,
    creatorCardSize,
    creatorCardDesign,
    // Global styles
    cardBackgroundColor,
    cardBorderColor,
    cardBorderWidth,
  } = data;

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
  
  const design = isOwner ? creatorCardDesign : 'default';

  const cardStyle: React.CSSProperties = {
    backgroundColor: cardBackgroundColor,
    borderColor: cardBorderColor,
    borderWidth: cardBorderWidth ? `${cardBorderWidth}px` : undefined,
  };
  
  if (isOwner) {
    if (creatorCardSize) {
      cardStyle.transform = `scale(${creatorCardSize / 100})`;
    }

    if (!creatorCardBacklightDisabled) {
      const intensity = (creatorCardBacklightIntensity ?? 50) / 100;
      const glowColor1 = `rgba(255, 193, 7, ${intensity * 0.7})`; // Amber
      const glowColor2 = `rgba(255, 87, 34, ${intensity * 0.5})`; // Orange/Red
      cardStyle.boxShadow = `0 0 ${15 * intensity}px ${glowColor1}, 0 0 ${45 * intensity}px ${glowColor2}`;
      
      const existingTransform = cardStyle.transform || '';
      cardStyle.transform = `${existingTransform} translateY(-2px)`;
    }
  }

  const designClasses =
    design === 'tech' ? 'card-design-tech' :
    design === 'natural' ? 'card-design-natural' :
    design === 'elegant' ? 'card-design-elegant' : '';


  return (
    <Card 
      style={cardStyle}
      className={cn(
        "w-64 transition-all duration-200 relative", 
        selected && 'ring-2 ring-primary ring-offset-2',
        isOwner && designClasses
      )}
    >
      {isLocked && (
        <div className="absolute -top-1 -right-1 bg-background text-muted-foreground rounded-full p-0.5 z-10 border shadow">
          <Lock className="h-2 w-2" />
        </div>
      )}
      
      {/* Handles */}
      <Handle type="source" position={Position.Top} id="top" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="upper-left-source" style={{ ...handleStyle, top: '33%' }} />
      <Handle type="source" position={Position.Right} id="upper-right-source" style={{ ...handleStyle, top: '33%' }} />
      <Handle type="source" position={Position.Left} id="lower-left-source" style={{ ...handleStyle, top: '66%' }} />
      <Handle type="source" position={Position.Right} id="lower-right-source" style={{ ...handleStyle, top: '66%' }} />
      
      <CardHeader className="p-4">
        <div className="flex items-center gap-4">
          <div className={cn('avatar-frame rounded-full')}>
            <Avatar className="h-16 w-16 border">
              <AvatarImage src={photoURL || ''} data-ai-hint="person photo" />
              <AvatarFallback>
                  <img src={getPlaceholderImage(gender)} alt={`${firstName} ${lastName}`} />
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 space-y-1">
            <h3 className={cn("font-bold text-lg leading-tight text-main")}>{`${firstName} ${lastName}`}</h3>
            {lifeYears && <p className={cn("text-sm text-muted-foreground text-sub")}>{lifeYears}</p>}
            <div className='flex items-center gap-2 pt-1'>
                {getGenderBadge()}
                {getStatusIcon()}
                {getReligionIcon()}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5 text-sub">
                {(childrenCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs" title={`${childrenCount} ילדים`}>
                        <Baby className="h-4 w-4" />
                        <span className="font-medium">{childrenCount}</span>
                    </div>
                )}
                {(siblingsCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs" title={`${siblingsCount} אחים`}>
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{siblingsCount}</span>
                    </div>
                )}
                {(grandchildrenCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs opacity-80" title={`${grandchildrenCount} נכדים`}>
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{grandchildrenCount}</span>
                    </div>
                )}
                {(greatGrandchildrenCount || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs opacity-70" title={`${greatGrandchildrenCount} נינים`}>
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{greatGrandchildrenCount}</span>
                    </div>
                )}
                {(gen4Count || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs opacity-60" title={`${gen4Count} חִמֵּשׁ`}>
                        <Users className="h-4 w-4" />
                        <span className="font-medium">{gen4Count}</span>
                    </div>
                )}
                {(gen5Count || 0) > 0 && (
                    <div className="flex items-center gap-1 text-xs opacity-50" title={`${gen5Count} שִׁשַּׁשׁ`}>
                        <Users className="h-4 w-4" />
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
