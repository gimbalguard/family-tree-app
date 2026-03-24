'use client';
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Person } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Heart, Baby, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInYears } from 'date-fns';

export const TimelinePersonNode = memo(({ data, selected }: NodeProps<Person>) => {
  const {
    firstName, lastName, birthDate, deathDate, gender, photoURL, status, religion,
    nickname, childrenCount, siblingsCount, grandchildrenCount,
    greatGrandchildrenCount, gen4Count, gen5Count,
  } = data;

  const nameParts = [firstName];
  if (nickname) nameParts.push(`(${nickname})`);
  nameParts.push(lastName);
  if (status === 'deceased') nameParts.push('(ז"ל)');
  const displayName = nameParts.join(' ');

  const getLifeYearsDisplay = () => {
    try {
      const hasBirthDate = birthDate && !isNaN(new Date(birthDate).getTime());
      const hasDeathDate = deathDate && !isNaN(new Date(deathDate).getTime());
      if (hasBirthDate && !hasDeathDate && status === 'alive') {
        const age = differenceInYears(new Date(), new Date(birthDate!));
        return `${format(new Date(birthDate!), 'dd/MM/yyyy')} (גיל ${age})`;
      }
      if (hasBirthDate && hasDeathDate) {
        return `${format(new Date(birthDate!), 'dd/MM/yyyy')} – ${format(new Date(deathDate!), 'dd/MM/yyyy')}`;
      }
      if (hasBirthDate) return `${format(new Date(birthDate!), 'dd/MM/yyyy')} – ?`;
      if (hasDeathDate) return `? – ${format(new Date(deathDate!), 'dd/MM/yyyy')}`;
    } catch (e) {}
    return '';
  };

  const lifeYears = getLifeYearsDisplay();

  const getGenderBadge = () => {
    switch (gender) {
      case 'male': return <Badge variant="outline" className="border-blue-500 text-blue-500 text-[10px] px-1 py-0">זכר</Badge>;
      case 'female': return <Badge variant="outline" className="border-pink-500 text-pink-500 text-[10px] px-1 py-0">נקבה</Badge>;
      default: return <Badge variant="secondary" className="text-[10px] px-1 py-0">אחר</Badge>;
    }
  };

  const getStatusIcon = () => {
    if (status === 'alive') return <Heart className="h-3 w-3 text-green-500 fill-green-500" />;
    return null;
  };

  const getReligionIcon = () => {
    const style: React.CSSProperties = { fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' };
    switch (religion) {
      case 'jewish': return <span style={style} title="יהדות">✡</span>;
      case 'christian': return <span style={style} title="נצרות">✝</span>;
      case 'muslim': return <span style={style} title="אסלאם">☪</span>;
      case 'buddhist': return <span style={style} title="בודהיזם">☸</span>;
      default: return null;
    }
  };

  const handleStyle = { width: 10, height: 10, background: 'hsl(var(--primary))' };

  const descendantCounts = [
    { count: childrenCount, label: 'ילדים', icon: Baby, opacity: 'opacity-100' },
    { count: siblingsCount, label: 'אחים', icon: Users, opacity: 'opacity-100' },
    { count: grandchildrenCount, label: 'נכדים', icon: Users, opacity: 'opacity-80' },
    { count: greatGrandchildrenCount, label: 'נינים', icon: Users, opacity: 'opacity-70' },
    { count: gen4Count, label: 'חִמֵּשׁ', icon: Users, opacity: 'opacity-60' },
    { count: gen5Count, label: 'שִׁשַּׁשׁ', icon: Users, opacity: 'opacity-50' },
  ].filter(item => (item.count || 0) > 0);
  
  const design = data.cardDesign || 'default';
  const applyCreatorStyles = data.isOwner || (data as any).isTwin;

  const cardStyle: React.CSSProperties = {};
  
  if (design === 'default') {
    cardStyle.backgroundColor = data.cardBackgroundColor;
    cardStyle.borderColor = data.cardBorderColor;
    cardStyle.borderWidth = data.cardBorderWidth ? `${data.cardBorderWidth}px` : undefined;
  }
  
  if (applyCreatorStyles) {
    if (data.creatorCardSize) {
      cardStyle.transform = `scale(${data.creatorCardSize / 100})`;
    }
    if (!data.creatorCardBacklightDisabled && data.creatorCardBacklightIntensity) {
      const intensity = data.creatorCardBacklightIntensity / 100;
      const shadowColor = `rgba(255, 193, 7, ${intensity * 0.7})`;
      cardStyle.boxShadow = `0 0 ${8 * intensity}px ${shadowColor}, 0 0 ${20 * intensity}px ${shadowColor}, 0 0 ${45 * intensity}px ${shadowColor}`;
      cardStyle.transform = `${cardStyle.transform || ''} translateY(-2px)`;
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
        'w-[220px] transition-all duration-200 relative',
        'shadow-md hover:shadow-lg',
        selected && 'ring-2 ring-primary ring-offset-2',
        designClasses
      )}
    >
      <Handle type="source" position={Position.Top} id="top" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ ...handleStyle, top: '50%' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ ...handleStyle, top: '50%' }}
      />
      <CardHeader className="p-3">
        <div className="flex flex-row-reverse items-center gap-3">
          <Avatar className="h-12 w-12 border flex-shrink-0">
            <AvatarImage src={photoURL || undefined} />
            <AvatarFallback>
              <img src={getPlaceholderImage(gender)} alt={displayName} />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-0.5 text-right min-w-0">
            <h3 className="font-bold text-sm leading-tight truncate">{displayName}</h3>
            {lifeYears && <p className="text-[10px] text-muted-foreground leading-tight">{lifeYears}</p>}
            <div className="flex items-center justify-end gap-1 pt-0.5">
              {getGenderBadge()}
              {getStatusIcon()}
              {getReligionIcon()}
            </div>
            {descendantCounts.length > 0 && (
              <div className="pt-1 space-y-0">
                {descendantCounts.map(({ count, label, icon: Icon, opacity }) => (
                  <div key={label} className={cn('flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground', opacity)}>
                    <Icon className="h-2.5 w-2.5 flex-shrink-0" />
                    <span>{count} {label}</span>
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

TimelinePersonNode.displayName = 'TimelinePersonNode';