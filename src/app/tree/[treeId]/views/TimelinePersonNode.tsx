'use client';
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

  // Small colored gender icon — no text badge
  const getGenderIcon = () => {
    if (gender === 'male') {
      return <span style={{ fontSize: '0.9rem', color: '#3b82f6', lineHeight: 1 }} title="זכר">♂</span>;
    }
    if (gender === 'female') {
      return <span style={{ fontSize: '0.9rem', color: '#ec4899', lineHeight: 1 }} title="נקבה">♀</span>;
    }
    return null;
  };

  const getStatusIcon = () => {
    if (status === 'alive') return <Heart className="h-3 w-3 text-green-500 fill-green-500" />;
    return null;
  };

  const getReligionIcon = () => {
    const style: React.CSSProperties = { fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1 };
    switch (religion) {
      case 'jewish': return <span style={style} title="יהדות">✡</span>;
      case 'christian': return <span style={style} title="נצרות">✝</span>;
      case 'muslim': return <span style={style} title="אסלאם">☪</span>;
      case 'buddhist': return <span style={style} title="בודהיזם">☸</span>;
      default: return null;
    }
  };

  // type="source" on all handles — same as PersonNode in free canvas
  const handleStyle: React.CSSProperties = { width: 10, height: 10, background: 'hsl(var(--primary))' };

  const descendantCounts = [
    { count: childrenCount, label: 'ילדים', icon: Baby },
    { count: siblingsCount, label: 'אחים', icon: Users },
    { count: grandchildrenCount, label: 'נכדים', icon: Users },
    { count: greatGrandchildrenCount, label: 'נינים', icon: Users },
    { count: gen4Count, label: 'דור 5', icon: Users },
    { count: gen5Count, label: 'דור 6', icon: Users },
  ].filter(item => (item.count || 0) > 0);

  return (
    <Card
      className={cn(
        'w-[160px] transition-all duration-200 relative overflow-visible',
        'shadow-md hover:shadow-lg',
        selected && 'ring-2 ring-primary ring-offset-2',
      )}
    >
      {/* All four handles — type="source", matching free canvas PersonNode */}
      <Handle type="source" position={Position.Top} id="top" style={handleStyle} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={handleStyle} />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ ...handleStyle, top: '50%', transform: 'translateY(-50%)' }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ ...handleStyle, top: '50%', transform: 'translateY(-50%)' }}
      />

      {/* Vertical layout: photo → name → dates → icons → counts */}
      <div className="flex flex-col items-center gap-1.5 px-2 pt-3 pb-2 text-center">
        {/* Profile photo centered at top */}
        <Avatar className="h-14 w-14 border-2 border-border shadow-sm flex-shrink-0">
          <AvatarImage src={photoURL || undefined} />
          <AvatarFallback>
            <img src={getPlaceholderImage(gender)} alt={displayName} />
          </AvatarFallback>
        </Avatar>

        {/* Full name */}
        <h3 className="font-bold text-xs leading-tight w-full line-clamp-2">
          {displayName}
        </h3>

        {/* Dates */}
        {lifeYears && (
          <p className="text-[9px] text-muted-foreground leading-tight w-full">
            {lifeYears}
          </p>
        )}

        {/* Gender icon + status icon + religion icon */}
        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          {getGenderIcon()}
          {getStatusIcon()}
          {getReligionIcon()}
        </div>

        {/* Descendant counts at bottom */}
        {descendantCounts.length > 0 && (
          <div className="w-full mt-1 pt-1 border-t border-border/40 space-y-0.5">
            {descendantCounts.map(({ count, label, icon: Icon }) => (
              <div key={label} className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground">
                <Icon className="h-2.5 w-2.5 flex-shrink-0" />
                <span>{count} {label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
});

TimelinePersonNode.displayName = 'TimelinePersonNode';