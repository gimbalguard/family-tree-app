'use client';
import { useEffect, useMemo, useRef } from 'react';
import type { Node } from 'reactflow';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Lock, Unlock, Users, MinusSquare, BoxSelect } from 'lucide-react';
import type { Person } from '@/lib/types';

type MenuProps = {
  x: number;
  y: number;
  nodes: Node<Person>[];
  onClose: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onLock: () => void;
  onUnlock: () => void;
};

export function NodeContextMenu({
  x,
  y,
  nodes,
  onClose,
  onGroup,
  onUngroup,
  onLock,
  onUnlock,
}: MenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const menuState = useMemo(() => {
    if (nodes.length === 0) return null;

    const isAnyLocked = nodes.some((n) => n.data.isLocked);
    const isAnyUnlocked = nodes.some((n) => !n.data.isLocked);
    const canGroup = nodes.length > 1;
    const canUngroup = nodes.some(n => (n.data.groupIds || []).length > 0);
    
    return {
      canGroup,
      canUngroup,
      canLock: isAnyUnlocked,
      canUnlock: isAnyLocked,
    };
  }, [nodes]);

  if (!menuState) return null;

  return (
    <Card
      ref={menuRef}
      className="absolute z-50 w-48 p-1 shadow-xl"
      style={{ top: y, left: x }}
      dir="rtl"
    >
      {menuState.canGroup && (
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            onGroup();
            onClose();
          }}
        >
          <Users className="ml-2" />
          קבץ
        </Button>
      )}
      {menuState.canUngroup && (
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            onUngroup();
            onClose();
          }}
        >
          <MinusSquare className="ml-2" />
          פרק קבוצה
        </Button>
      )}
      {(menuState.canGroup || menuState.canUngroup) &&
        (menuState.canLock || menuState.canUnlock) && <Separator className="my-1" />}
      {menuState.canLock && (
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            onLock();
            onClose();
          }}
        >
          <Lock className="ml-2" />
          נעל מיקום
        </Button>
      )}
      {menuState.canUnlock && (
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            onUnlock();
            onClose();
          }}
        >
          <Unlock className="ml-2" />
          שחרר נעילה
        </Button>
      )}
    </Card>
  );
}
