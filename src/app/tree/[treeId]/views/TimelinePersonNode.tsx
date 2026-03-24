'use client';
import { memo } from 'react';
import type { NodeProps } from 'reactflow';
import { Handle, Position } from 'reactflow';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Person } from '@/lib/types';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, differenceInYears } from 'date-fns';

export const TimelinePersonNode = memo(({ data, selected }: NodeProps<Person>) => {
  const {
    firstName, lastName, birthDate, deathDate, gender, photoURL, status, religion,
    nickname,
  } = data;

  const nameParts = [firstName];
  if (nickname) nameParts.push(`(${nickname})`);
  nameParts.push(lastName);
  if (status === 'deceased') nameParts.push('(ז"ל)');
  const displayName = nameParts.join(' ');

  const getLifeYearsDisplay = () => {
    try {
      const hasBirth = birthDate && !isNaN(new Date(birthDate).getTime());
      const hasDeath = deathDate && !isNaN(new Date(deathDate).getTime());
      if (hasBirth && !hasDeath && status === 'alive') {
        const age = differenceInYears(new Date(), new Date(birthDate!));
        return `${format(new Date(birthDate!), 'dd/MM/yyyy')} (גיל ${age})`;
      }
      if (hasBirth && hasDeath)
        return `${format(new Date(birthDate!), 'dd/MM/yyyy')} – ${format(new Date(deathDate!), 'dd/MM/yyyy')}`;
      if (hasBirth) return `${format(new Date(birthDate!), 'dd/MM/yyyy')} – ?`;
      if (hasDeath) return `? – ${format(new Date(deathDate!), 'dd/MM/yyyy')}`;
    } catch (e) {}
    return '';
  };

  const lifeYears = getLifeYearsDisplay();

  const getGenderIcon = () => {
    if (gender === 'male')   return <span style={{ fontSize: '0.9rem', color: '#3b82f6', lineHeight: 1 }}>♂</span>;
    if (gender === 'female') return <span style={{ fontSize: '0.9rem', color: '#ec4899', lineHeight: 1 }}>♀</span>;
    return null;
  };

  const getStatusIcon = () =>
    status === 'alive' ? <Heart className="h-3 w-3 text-green-500 fill-green-500" /> : null;

  const getReligionIcon = () => {
    const s: React.CSSProperties = { fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1 };
    switch (religion) {
      case 'jewish':    return <span style={s}>✡</span>;
      case 'christian': return <span style={s}>✝</span>;
      case 'muslim':    return <span style={s}>☪</span>;
      case 'buddhist':  return <span style={s}>☸</span>;
      default: return null;
    }
  };

  // ── Handles ───────────────────────────────────────────────────────────────
  // All type="source" — this matches the main canvas PersonNode.
  // ReactFlow renders edges between two source handles fine when handle IDs
  // are explicitly specified on the edge (sourceHandle / targetHandle).
  const hs: React.CSSProperties = { width: 10, height: 10, background: 'hsl(var(--primary))' };

  return (
    <Card
      className={cn(
        'w-[160px] transition-all duration-200 relative overflow-visible',
        'shadow-md hover:shadow-lg',
        selected && 'ring-2 ring-primary ring-offset-2',
      )}
    >
      <Handle type="source" position={Position.Top}    id="top"    style={hs} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={hs} />
      <Handle type="source" position={Position.Left}   id="left"   style={{ ...hs, top: '50%', transform: 'translateY(-50%)' }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ ...hs, top: '50%', transform: 'translateY(-50%)' }} />

      <div className="flex flex-col items-center gap-1.5 px-2 pt-3 pb-2 text-center">
        <Avatar className="h-14 w-14 border-2 border-border shadow-sm flex-shrink-0">
          <AvatarImage src={photoURL || undefined} />
          <AvatarFallback>
            <img src={getPlaceholderImage(gender)} alt={displayName} />
          </AvatarFallback>
        </Avatar>

        <h3 className="font-bold text-xs leading-tight w-full line-clamp-2">{displayName}</h3>

        {lifeYears && (
          <p className="text-[9px] text-muted-foreground leading-tight w-full">{lifeYears}</p>
        )}

        <div className="flex items-center justify-center gap-1.5 mt-0.5">
          {getGenderIcon()}
          {getStatusIcon()}
          {getReligionIcon()}
        </div>
      </div>
    </Card>
  );
});

TimelinePersonNode.displayName = 'TimelinePersonNode';