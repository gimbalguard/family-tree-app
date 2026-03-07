'use client';

import { useStore } from 'reactflow';
import { memo } from 'react';

type TimelineAxisProps = {
  minYear: number;
  maxYear: number;
  pixelsPerYear: number;
};

// Use a memoized component to avoid re-rendering on every pan/zoom
export const TimelineAxis = memo(({ minYear, maxYear, pixelsPerYear }: TimelineAxisProps) => {
  // We use useStore to subscribe to viewport changes without causing the whole component to re-render.
  // This is more performant than useViewport.
  const transform = useStore(s => s.transform);
  const [viewportY, viewportZoom] = [transform[1], transform[2]];

  const years: number[] = [];
  for (let year = minYear; year <= maxYear + 1; year++) {
    years.push(year);
  }
  
  // Calculate which labels to show based on zoom
  const showDecadeLabels = viewportZoom > 0.1;
  const showYearLabels = viewportZoom > 0.5;
  const showMonthTicks = viewportZoom > 2;

  return (
    <div className="absolute left-0 top-0 h-full w-20 bg-muted/20 z-10 select-none overflow-hidden">
      <div className="relative h-full w-full" style={{ transform: `translateY(${viewportY}px)` }}>
        {/* The main vertical line */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-border" />
        
        {years.map(year => {
          const yPos = (year - minYear) * pixelsPerYear * viewportZoom;
          const isDecade = year % 10 === 0;

          return (
            <div key={year} style={{ top: `${yPos}px` }} className="absolute right-0 w-full">
              {/* Year tick */}
              <div className={`absolute right-0 h-px ${isDecade ? 'w-4' : 'w-2'} bg-border`} />
              
              {/* Horizontal grid line */}
              <div className="absolute left-full w-screen h-px bg-border/10" />

              {/* Year Label */}
              {((isDecade && showDecadeLabels) || showYearLabels) && (
                <span
                  className={`absolute right-5 -translate-y-1/2 text-xs text-muted-foreground ${isDecade ? 'font-bold' : ''}`}
                >
                  {year}
                </span>
              )}
              
              {/* Month Ticks */}
              {showMonthTicks && Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} style={{ top: `${((i + 1) / 12) * pixelsPerYear * viewportZoom}px` }} className="absolute right-0 w-1 h-px bg-border/50" />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
});

TimelineAxis.displayName = 'TimelineAxis';
