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
    nickname,
    isOwner, isLocked, childrenCount, siblingsCount, grandchildrenCount, 
    greatGrandchildrenCount, gen4Count, gen5Count,
    isGroupSelected,
    // Creator settings
    creatorCardBacklightIntensity,
    creatorCardBacklightDisabled,
    creatorCardSize,
    // Card styles
    cardDesign,
    cardBackgroundColor,
    cardBorderColor,
    cardBorderWidth,
  } = data;

  const nameParts = [firstName];
  if (nickname) {
    nameParts.push(`(${nickname})`);
  }
  nameParts.push(lastName);
  if (status === 'deceased') {
    nameParts.push('(ז"ל)');
  }
  const displayName = nameParts.join(' ');

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
  
  const design = cardDesign || 'default';
  const applyCreatorStyles = creatorCardSize !== undefined || creatorCardBacklightIntensity !== undefined;

  const cardStyle: React.CSSProperties = {};

  if (design === 'default') {
    cardStyle.backgroundColor = cardBackgroundColor;
    cardStyle.borderColor = cardBorderColor;
    cardStyle.borderWidth = cardBorderWidth ? `${cardBorderWidth}px` : undefined;
  }
  
  if (applyCreatorStyles) {
    if (creatorCardSize) {
      cardStyle.transform = `scale(${creatorCardSize / 100})`;
    }

    if (!creatorCardBacklightDisabled && creatorCardBacklightIntensity) {
      const intensity = creatorCardBacklightIntensity / 100;
      const shadowColor = `rgba(255, 193, 7, ${intensity * 0.7})`; // Amber
      cardStyle.boxShadow = `0 0 ${8 * intensity}px ${shadowColor}, 0 0 ${20 * intensity}px ${shadowColor}, 0 0 ${45 * intensity}px ${shadowColor}`;
      const existingTransform = cardStyle.transform || '';
      cardStyle.transform = `${existingTransform} translateY(-2px)`;
    }
  }

  const designClasses =
    design === 'tech' ? 'card-design-tech' :
    design === 'natural' ? 'card-design-natural' :
    design === 'elegant' ? 'card-design-elegant' : '';

  const descendantCounts = [
    { count: childrenCount, label: 'ילדים', icon: Baby, opacityClass: 'opacity-100' },
    { count: siblingsCount, label: 'אחים', icon: Users, opacityClass: 'opacity-100' },
    { count: grandchildrenCount, label: 'נכדים', icon: Users, opacityClass: 'opacity-80' },
    { count: greatGrandchildrenCount, label: 'נינים', icon: Users, opacityClass: 'opacity-70' },
    { count: gen4Count, label: 'חִמֵּשׁ', icon: Users, opacityClass: 'opacity-60' },
    { count: gen5Count, label: 'שִׁשַּׁשׁ', icon: Users, opacityClass: 'opacity-50' }
  ].filter(item => (item.count || 0) > 0);


  return (
    <Card 
      style={cardStyle}
      className={cn(
        "w-64 transition-all duration-200 relative", 
        selected && 'ring-2 ring-primary ring-offset-2',
        isGroupSelected && !selected && 'ring-2 ring-dashed ring-accent',
        designClasses
      )}
    >
      {isLocked && (
        <div className="absolute -top-1 -left-1 bg-background text-muted-foreground rounded-full p-0.5 z-10 border shadow">
          <Lock className="h-2 w-2" />
        </div>
      )}
      
      {/* Handles */}
      <Handle type="source" position={Position.Top} id="top" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />
      <Handle type="source" position={Position.Left} id="left" style={{ ...handleStyle, top: '50%' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...handleStyle, top: '50%' }} />
      
      <CardHeader className="p-4">
        <div className="flex flex-row-reverse items-center gap-4">
          <div className={cn('avatar-frame rounded-full')}>
            <Avatar className="h-16 w-16 border">
              <AvatarImage src={photoURL || ''} data-ai-hint="person photo" />
              <AvatarFallback>
                  <img src={getPlaceholderImage(gender)} alt={`${firstName} ${lastName}`} />
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 space-y-1 text-right">
            <h3 className={cn("font-bold text-lg leading-tight text-main")}>{displayName}</h3>
            {lifeYears && <p className={cn("text-sm text-muted-foreground text-sub")}>{lifeYears}</p>}
            <div className='flex items-center justify-end gap-2 pt-1'>
                {getGenderBadge()}
                {getStatusIcon()}
                {getReligionIcon()}
            </div>
            {descendantCounts.length > 0 && (
              <div className="pt-2 space-y-0.5 text-sub">
                {descendantCounts.map(({ count, label, icon: Icon, opacityClass }) => (
                  <div key={label} className={cn("flex items-center justify-end gap-2 text-xs", opacityClass)} title={`${count} ${label}`}>
                    <span className="font-medium">{count} {label}</span>
                    <Icon className="h-3 w-3" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
});

PersonNode.displayName = 'PersonNode';
