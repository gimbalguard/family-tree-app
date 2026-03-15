'use client';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type {
  RootsProject, Person, Relationship, ExportedFile,
  DesignPage, DesignTemplate, DesignElement, ShapeType, TextAlign, CanvasAspectRatio
} from '@/lib/types';
import { parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import {
  ArrowLeft, Type, MousePointer2,
  Smile, Trash2, User, Image as ImageIcon,
  Copy, AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown,
  Scissors, Clipboard, RefreshCw, Maximize2, Square, Upload, Layers,
  CropIcon,
  ArrowUp,
  ArrowDown as ArrowDownIcon,
  FilePlus,
  CopyPlus,
  Undo2,
  Redo2,
  Spline,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { v4 as uuidv4 } from 'uuid';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';


// ============================================================
// FONT CATALOG
// ============================================================
export const FONT_CATALOG: Array<{ name: string; label: string; category: string; hebrewSupport: boolean }> = [
  { name: 'Assistant', label: 'Assistant', category: 'עברית', hebrewSupport: true },
  { name: 'Heebo', label: 'Heebo', category: 'עברית', hebrewSupport: true },
  { name: 'Rubik', label: 'Rubik', category: 'עברית', hebrewSupport: true },
  { name: 'Frank Ruhl Libre', label: 'Frank Ruhl Libre', category: 'עברית', hebrewSupport: true },
  { name: 'Alef', label: 'Alef', category: 'עברית', hebrewSupport: true },
  { name: 'Secular One', label: 'Secular One', category: 'עברית', hebrewSupport: true },
  { name: 'Suez One', label: 'Suez One', category: 'עברית', hebrewSupport: true },
  { name: 'Noto Sans Hebrew', label: 'Noto Sans Hebrew', category: 'עברית', hebrewSupport: true },
  { name: 'David Libre', label: 'David Libre', category: 'עברית', hebrewSupport: true },
  { name: 'Miriam Libre', label: 'Miriam Libre', category: 'עברית', hebrewSupport: true },
  { name: 'Varela Round', label: 'Varela Round', category: 'עברית', hebrewSupport: true },
  { name: 'Playfair Display', label: 'Playfair Display', category: 'קלאסי', hebrewSupport: false },
  { name: 'Cormorant Garamond', label: 'Cormorant Garamond', category: 'קלאסי', hebrewSupport: false },
  { name: 'EB Garamond', label: 'EB Garamond', category: 'קלאסי', hebrewSupport: false },
  { name: 'Cinzel', label: 'Cinzel', category: 'קלאסי', hebrewSupport: false },
  { name: 'Josefin Sans', label: 'Josefin Sans', category: 'מודרני', hebrewSupport: false },
  { name: 'Raleway', label: 'Raleway', category: 'מודרני', hebrewSupport: false },
  { name: 'Montserrat', label: 'Montserrat', category: 'מודרני', hebrewSupport: false },
  { name: 'Poppins', label: 'Poppins', category: 'מודרני', hebrewSupport: false },
  { name: 'Lato', label: 'Lato', category: 'מודרני', hebrewSupport: false },
  { name: 'Dancing Script', label: 'Dancing Script', category: 'כתב יד', hebrewSupport: false },
  { name: 'Pacifico', label: 'Pacifico', category: 'כתב יד', hebrewSupport: false },
  { name: 'Caveat', label: 'Caveat', category: 'כתב יד', hebrewSupport: false },
];

const loadedFonts = new Set<string>();
function ensureFontLoaded(fontName: string) {
  if (!fontName || loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;700;900&display=swap`;
  document.head.appendChild(link);
}

// ============================================================
// SHAPES
// ============================================================
export const SHAPE_GALLERY: Array<{ id: string; label: string; emoji: string }> = [
  { id: 'rectangle', label: 'מלבן', emoji: '▬' },
  { id: 'rounded_rectangle', label: 'מלבן מעוגל', emoji: '▢' },
  { id: 'circle', label: 'עיגול', emoji: '●' },
  { id: 'ellipse', label: 'אליפסה', emoji: '⬭' },
  { id: 'triangle', label: 'משולש', emoji: '▲' },
  { id: 'star', label: 'כוכב', emoji: '★' },
  { id: 'star6', label: 'מגן דוד', emoji: '✡' },
  { id: 'diamond', label: 'יהלום', emoji: '◆' },
  { id: 'pentagon', label: 'מחומש', emoji: '⬠' },
  { id: 'hexagon', label: 'משושה', emoji: '⬡' },
  { id: 'octagon', label: 'מונגון', emoji: '⬡' },
  { id: 'heart', label: 'לב', emoji: '❤' },
  { id: 'arrow_right', label: 'חץ ימין', emoji: '→' },
  { id: 'arrow_left', label: 'חץ שמאל', emoji: '←' },
  { id: 'speech_bubble', label: 'בועת דיבור', emoji: '💬' },
  { id: 'banner', label: 'באנר', emoji: '🎏' },
  { id: 'cross', label: 'צלב', emoji: '✚' },
  { id: 'parallelogram', label: 'מקבילית', emoji: '▱' },
  { id: 'trapezoid', label: 'טרפז', emoji: '⏢' },
  { id: 'line_h', label: 'קו אופקי', emoji: '─' },
];

function getShapeStyle(shapeType: string, color: string, opacity = 1): React.CSSProperties {
  const base: React.CSSProperties = { backgroundColor: color, opacity, width: '100%', height: '100%' };
  switch (shapeType) {
    case 'circle': return { ...base, borderRadius: '50%' };
    case 'ellipse': return { ...base, borderRadius: '50%' };
    case 'rounded_rectangle': return { ...base, borderRadius: '18%' };
    case 'triangle': return { width: '100%', height: '100%', clipPath: 'polygon(50% 0%,100% 100%,0% 100%)', backgroundColor: color, opacity };
    case 'star': return { width: '100%', height: '100%', clipPath: 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)', backgroundColor: color, opacity };
    case 'star6': return { width: '100%', height: '100%', clipPath: 'polygon(50% 0%,60% 35%,93% 25%,75% 50%,93% 75%,60% 65%,50% 100%,40% 65%,7% 75%,25% 50%,7% 25%,40% 35%)', backgroundColor: color, opacity };
    case 'diamond': return { width: '100%', height: '100%', clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)', backgroundColor: color, opacity };
    case 'pentagon': return { width: '100%', height: '100%', clipPath: 'polygon(50% 0%,100% 38%,82% 100%,18% 100%,0% 38%)', backgroundColor: color, opacity };
    case 'hexagon': return { width: '100%', height: '100%', clipPath: 'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)', backgroundColor: color, opacity };
    case 'octagon': return { width: '100%', height: '100%', clipPath: 'polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)', backgroundColor: color, opacity };
    case 'heart': return { width: '100%', height: '100%', clipPath: 'polygon(50% 30%,80% 5%,100% 20%,100% 45%,50% 100%,0% 45%,0% 20%,20% 5%)', backgroundColor: color, opacity };
    case 'arrow_right': return { width: '100%', height: '100%', clipPath: 'polygon(0% 25%,60% 25%,60% 0%,100% 50%,60% 100%,60% 75%,0% 75%)', backgroundColor: color, opacity };
    case 'arrow_left': return { width: '100%', height: '100%', clipPath: 'polygon(100% 25%,40% 25%,40% 0%,0% 50%,40% 100%,40% 75%,100% 75%)', backgroundColor: color, opacity };
    case 'speech_bubble': return { ...base, borderRadius: '16% 16% 16% 40% / 16% 16% 10% 40%' };
    case 'banner': return { ...base, borderRadius: '4px', clipPath: 'polygon(0% 0%,100% 0%,100% 75%,87% 100%,75% 75%,0% 75%)' };
    case 'cross': return { width: '100%', height: '100%', clipPath: 'polygon(35% 0%,65% 0%,65% 35%,100% 35%,100% 65%,65% 65%,65% 100%,35% 100%,35% 65%,0% 65%,0% 35%,35% 35%)', backgroundColor: color, opacity };
    case 'parallelogram': return { width: '100%', height: '100%', clipPath: 'polygon(20% 0%,100% 0%,80% 100%,0% 100%)', backgroundColor: color, opacity };
    case 'trapezoid': return { width: '100%', height: '100%', clipPath: 'polygon(20% 0%,80% 0%,100% 100%,0% 100%)', backgroundColor: color, opacity };
    case 'line_h': return { ...base, height: '4px', borderRadius: 4, marginTop: '45%' };
    default: return base;
  }
}

// ============================================================
// DESIGN TEMPLATES
// ============================================================
export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'template_cosmic', name: 'Cosmic', nameHebrew: 'קוסמי',
    primaryColor: '#818cf8', secondaryColor: '#6366f1', accentColor: '#c7d2fe',
    backgroundColor: '#0a0015', cardBackground: 'rgba(99,102,241,0.15)',
    textColor: '#f8fafc', mutedTextColor: '#94a3b8',
    titleFont: 'Heebo', bodyFont: 'Assistant', backgroundStyle: 'cosmic',
    backgroundGradient: 'radial-gradient(ellipse at 20% 50%, #1e0a3c 0%, #0a0015 40%, #000d1a 100%)',
    layoutStyle: 'cosmic_dark', decorativePattern: 'dots', cardStyle: 'glass', titleStyle: 'gradient',
  },
  {
    id: 'template_desert', name: 'Desert Sand', nameHebrew: 'חול המדבר',
    primaryColor: '#f59e0b', secondaryColor: '#d97706', accentColor: '#fde68a',
    backgroundColor: '#1c1008', cardBackground: 'rgba(245,158,11,0.14)',
    textColor: '#fef3c7', mutedTextColor: '#d97706',
    titleFont: 'Frank Ruhl Libre', bodyFont: 'Alef', backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(160deg, #2d1b00 0%, #1c1008 50%, #0f0800 100%)',
    layoutStyle: 'heritage', decorativePattern: 'border', cardStyle: 'solid', titleStyle: 'bold_caps',
  },
  {
    id: 'template_forest', name: 'Forest', nameHebrew: 'יער',
    primaryColor: '#4ade80', secondaryColor: '#16a34a', accentColor: '#86efac',
    backgroundColor: '#0a1f0a', cardBackground: 'rgba(74,222,128,0.12)',
    textColor: '#f0fdf4', mutedTextColor: '#86efac',
    titleFont: 'Secular One', bodyFont: 'Heebo', backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #0a1f0a 0%, #052e16 60%, #0a1f0a 100%)',
    layoutStyle: 'nature', decorativePattern: 'corners', cardStyle: 'shadow', titleStyle: 'italic_serif',
  },
  {
    id: 'template_ocean', name: 'Ocean', nameHebrew: 'ים',
    primaryColor: '#38bdf8', secondaryColor: '#0284c7', accentColor: '#7dd3fc',
    backgroundColor: '#0a1628', cardBackground: 'rgba(56,189,248,0.12)',
    textColor: '#f0f9ff', mutedTextColor: '#7dd3fc',
    titleFont: 'Rubik', bodyFont: 'Assistant', backgroundStyle: 'gradient',
    backgroundGradient: 'radial-gradient(ellipse at 50% 100%, #0369a1 0%, #0a1628 50%, #001e3c 100%)',
    layoutStyle: 'minimal', decorativePattern: 'lines', cardStyle: 'glass', titleStyle: 'gradient',
  },
  {
    id: 'template_rose', name: 'Rose Gold', nameHebrew: 'זהב ורוד',
    primaryColor: '#fb7185', secondaryColor: '#e11d48', accentColor: '#fda4af',
    backgroundColor: '#1a0a0f', cardBackground: 'rgba(251,113,133,0.12)',
    textColor: '#fff1f2', mutedTextColor: '#fda4af',
    titleFont: 'Frank Ruhl Libre', bodyFont: 'Heebo', backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #2d0a1a 0%, #1a0a0f 50%, #0f0510 100%)',
    layoutStyle: 'elegant', decorativePattern: 'corners', cardStyle: 'solid', titleStyle: 'italic_serif',
  },
  {
    id: 'template_parchment', name: 'Parchment', nameHebrew: 'קלף עתיק',
    primaryColor: '#92400e', secondaryColor: '#78350f', accentColor: '#d97706',
    backgroundColor: '#fef3c7', cardBackground: 'rgba(146,64,14,0.09)',
    textColor: '#1c1917', mutedTextColor: '#78350f',
    titleFont: 'David Libre', bodyFont: 'Frank Ruhl Libre', backgroundStyle: 'paper',
    backgroundGradient: 'radial-gradient(ellipse at 30% 30%, #fde68a 0%, #fef3c7 50%, #fde68a 100%)',
    layoutStyle: 'classic', decorativePattern: 'border', cardStyle: 'outline', titleStyle: 'italic_serif',
  },
  {
    id: 'template_midnight', name: 'Midnight Blue', nameHebrew: 'חצות כחול',
    primaryColor: '#818cf8', secondaryColor: '#4f46e5', accentColor: '#c7d2fe',
    backgroundColor: '#030712', cardBackground: 'rgba(79,70,229,0.15)',
    textColor: '#eef2ff', mutedTextColor: '#a5b4fc',
    titleFont: 'Heebo', bodyFont: 'Rubik', backgroundStyle: 'cosmic',
    backgroundGradient: 'radial-gradient(ellipse at 80% 20%, #1e1b4b 0%, #030712 60%)',
    layoutStyle: 'bold', decorativePattern: 'none', cardStyle: 'colorful', titleStyle: 'outlined',
  },
  {
    id: 'template_spring', name: 'Spring', nameHebrew: 'אביב',
    primaryColor: '#0891b2', secondaryColor: '#0e7490', accentColor: '#67e8f9',
    backgroundColor: '#f0fdff', cardBackground: 'rgba(8,145,178,0.08)',
    textColor: '#164e63', mutedTextColor: '#0e7490',
    titleFont: 'Varela Round', bodyFont: 'Assistant', backgroundStyle: 'paper',
    backgroundGradient: 'linear-gradient(160deg, #e0f2fe 0%, #f0fdff 50%, #ecfeff 100%)',
    layoutStyle: 'bright', decorativePattern: 'dots', cardStyle: 'shadow', titleStyle: 'handwritten',
  },
  {
    id: 'template_sunset', name: 'Sunset', nameHebrew: 'שקיעה',
    primaryColor: '#fb923c', secondaryColor: '#ea580c', accentColor: '#fed7aa',
    backgroundColor: '#1a0a00', cardBackground: 'rgba(251,146,60,0.14)',
    textColor: '#fff7ed', mutedTextColor: '#fed7aa',
    titleFont: 'Secular One', bodyFont: 'Heebo', backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(160deg, #431407 0%, #1a0a00 40%, #2c0f00 100%)',
    layoutStyle: 'playful', decorativePattern: 'diagonal', cardStyle: 'colorful', titleStyle: 'bold_caps',
  },
  {
    id: 'template_silver', name: 'Silver', nameHebrew: 'כסף',
    primaryColor: '#64748b', secondaryColor: '#475569', accentColor: '#94a3b8',
    backgroundColor: '#f8fafc', cardBackground: 'rgba(71,85,105,0.08)',
    textColor: '#0f172a', mutedTextColor: '#475569',
    titleFont: 'Rubik', bodyFont: 'Heebo', backgroundStyle: 'paper',
    backgroundGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 60%, #f1f5f9 100%)',
    layoutStyle: 'minimal', decorativePattern: 'lines', cardStyle: 'outline', titleStyle: 'solid',
  },
];

// ============================================================
// LINE TYPES
// ============================================================
const LINE_TYPES = [
  { id: 'straight', label: 'ישר', stroke: '' },
  { id: 'dashed', label: 'מקווקו', stroke: '8 4' },
  { id: 'dotted', label: 'נקוד', stroke: '2 6' },
  { id: 'pcb', label: 'PCB', stroke: '' },
  { id: 'wavy', label: 'גלי', stroke: '' },
];

// ============================================================
// PAGE GENERATOR — comprehensive
// ============================================================

/**
 * Regenerates the TOC elements for a given set of pages.
 * Called both during initial generation and whenever pages change.
 */
function buildTocElements(
  pages: DesignPage[],
  tmpl: DesignTemplate,
  studentName: string,
  schoolYear: string,
  hebrewYear: string,
  tocPageNumber: number,
): DesignElement[] {
  const P = tmpl.primaryColor;
  const mk = (type: DesignElement['type'], extra: Partial<DesignElement> & { x: number; y: number; width: number; height: number }): DesignElement =>
    ({ id: uuidv4(), type, zIndex: 1, ...extra } as DesignElement);

  // Filter out the TOC page itself when listing
  const listedPages = pages.filter(p => p.pageType !== 'custom' || p.title !== 'תוכן עניינים');
  const tocLines = listedPages.map((pg, i) => `${pg.pageNumber}.  ${pg.title}`);
  const half = Math.ceil(tocLines.length / 2);
  const col1 = tocLines.slice(0, half).join('\n');
  const col2 = tocLines.slice(half).join('\n');

  const header: DesignElement[] = [
    mk('shape', { x: 0, y: 0, width: 100, height: 13, zIndex: 0, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.18 } }),
    mk('text', { x: 5, y: 1, width: 85, height: 12, content: '📋 תוכן עניינים', style: { fontSize: 30, fontWeight: 'extrabold', textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.titleFont } }),
    mk('shape', { x: 0, y: 12.5, width: 100, height: 0.4, zIndex: 2, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.35 } }),
  ];
  const footer: DesignElement[] = [
    mk('text', { x: 8, y: 94, width: 84, height: 10, content: `${studentName} | ${schoolYear} | ${hebrewYear}`, style: { fontSize: 11, textAlign: 'center', color: tmpl.mutedTextColor, opacity: 0.75, fontFamily: tmpl.bodyFont } }),
    mk('text', { x: 2, y: 94, width: 5, height: 10, content: String(tocPageNumber), style: { fontSize: 11, textAlign: 'left', color: tmpl.mutedTextColor, opacity: 0.75, fontFamily: tmpl.bodyFont } }),
  ];

  return [
    ...header,
    mk('text', { x: 52, y: 15, width: 44, height: 78, content: col1, style: { fontSize: 13, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.85 } }),
    mk('text', { x: 5, y: 15, width: 44, height: 78, content: col2, style: { fontSize: 13, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.85 } }),
    ...footer,
  ];
}

function generatePagesFromProject(
  project: RootsProject, people: Person[], relationships: Relationship[], templateId: string
): DesignPage[] {
  const pages: DesignPage[] = [];
  let pageNumber = 1;
  const student = people.find(p => p.id === project.studentPersonId);
  const tmpl = DESIGN_TEMPLATES.find(t => t.id === templateId) || DESIGN_TEMPLATES[0];
  const P = tmpl.primaryColor;
  const accent = tmpl.accentColor;
  const pd = project.projectData || {};

  const mk = (type: DesignElement['type'], extra: Partial<DesignElement> & { x: number; y: number; width: number; height: number }): DesignElement =>
    ({ id: uuidv4(), type, zIndex: 1, ...extra } as DesignElement);

  const header = (title: string, emoji?: string, chapterLabel?: string): DesignElement[] => {
    const els: DesignElement[] = [
      mk('shape', { x: 0, y: 0, width: 100, height: 13, zIndex: 0, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.18 } }),
      mk('text', { x: 5, y: 1, width: 85, height: 12, content: `${emoji ? emoji + ' ' : ''}${title}`, style: { fontSize: 30, fontWeight: 'extrabold', textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.titleFont } }),
      mk('shape', { x: 0, y: 12.5, width: 100, height: 0.4, zIndex: 2, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.35 } }),
    ];
    if (chapterLabel) {
      els.push(mk('text', { x: 5, y: 1, width: 90, height: 6, content: chapterLabel, style: { fontSize: 11, textAlign: 'left', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont, opacity: 0.7 } }));
    }
    return els;
  };

  const footer = (pageNum: number, studentName?: string, schoolYear?: string, hebrewYear?: string): DesignElement[] => [
    mk('text', { x: 8, y: 94, width: 84, height: 10, content: `${studentName || ''} | ${schoolYear || ''} | ${hebrewYear || ''}`, style: { fontSize: 11, textAlign: 'center', color: tmpl.mutedTextColor, opacity: 0.75, fontFamily: tmpl.bodyFont } }),
    mk('text', { x: 2, y: 94, width: 5, height: 10, content: String(pageNum), style: { fontSize: 11, textAlign: 'left', color: tmpl.mutedTextColor, opacity: 0.75, fontFamily: tmpl.bodyFont } }),
  ];

  const pill = (x: number, y: number, w: number, h: number, text: string, icon: string, colorP: string): DesignElement[] => [
    mk('shape', { x, y, width: w, height: h, zIndex: 1, style: { shapeType: 'rounded_rectangle', backgroundColor: colorP, opacity: 0.22 } }),
    mk('text', { x: x + 0.5, y: y + 0.5, width: w - 1, height: h - 1, content: `${icon} ${text}`, style: { fontSize: 13, fontWeight: 'bold', textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.titleFont } }),
  ];

  const photoPlaceholder = (x: number, y: number, w: number, h: number, label = '📷 הוסף תמונה'): DesignElement[] => [
    mk('photo_placeholder', { x, y, width: w, height: h, zIndex: 5, content: label,
      style: { borderColor: P, borderWidth: 2, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', opacity: 0.85 } }),
  ];

  const textBlock = (x: number, y: number, w: number, h: number, content: string | undefined, placeholder: string, fs = 16): DesignElement[] => [
    mk('text', { x, y, width: w, height: h, content: content || placeholder,
      style: { fontSize: fs, textAlign: 'right', color: content ? tmpl.textColor : tmpl.mutedTextColor, fontFamily: tmpl.bodyFont, lineHeight: 1.65, opacity: content ? 1 : 0.55 } }),
  ];

  const cp = pd.coverPage || {};
  const studentName = student ? `${student.firstName} ${student.lastName}` : cp.studentName || 'התלמיד/ה';
  const schoolYear = cp.grade || new Date().getFullYear().toString();
  const hebrewYear = cp.hebrewYear || '';

  const addPage = (title: string, type: DesignPage['pageType'], elements: DesignElement[]) => {
    const pageNum = pageNumber++;
    const pageElements = [
        ...elements,
        ...footer(pageNum, studentName, schoolYear, hebrewYear),
    ];
    pages.push({ id: uuidv4(), pageNumber: pageNum, pageType: type, title, templateId, elements: pageElements });
  };

  // ─── 1. COVER ───────────────────────────────────────────────
  const coverEls: DesignElement[] = [
    mk('shape', { x: -15, y: -20, width: 55, height: 80, zIndex: 0, style: { shapeType: 'circle', backgroundColor: P, opacity: 0.07 } }),
    mk('shape', { x: 65, y: 50, width: 45, height: 65, zIndex: 0, style: { shapeType: 'circle', backgroundColor: accent, opacity: 0.06 } }),
    mk('shape', { x: 8, y: 43, width: 84, height: 0.5, zIndex: 1, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.45 } }),
    mk('text', { x: 5, y: 12, width: 90, height: 16, content: `משפחת ${student?.lastName || studentName.split(' ').pop() || ''}`, style: { fontSize: 56, fontWeight: 'extrabold', textAlign: 'center', color: tmpl.textColor, fontFamily: tmpl.titleFont } }),
    mk('text', { x: 5, y: 29, width: 90, height: 8, content: 'עבודת שורשים', style: { fontSize: 24, fontWeight: 'normal', textAlign: 'center', color: tmpl.textColor, fontFamily: tmpl.bodyFont, opacity: 0.7 } }),
    mk('text', { x: 5, y: 47, width: 90, height: 8, content: studentName, style: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: tmpl.textColor, fontFamily: tmpl.bodyFont } }),
    mk('text', { x: 5, y: 55, width: 90, height: 6, content: [cp.schoolName, cp.grade, cp.teacherName].filter(Boolean).join(' | '), style: { fontSize: 18, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont, opacity: 0.75 } }),
    mk('text', { x: 5, y: 62, width: 90, height: 6, content: cp.submissionDate || cp.hebrewYear || `שנת ${new Date().getFullYear()}`, style: { fontSize: 18, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont } }),
  ];
  if (student?.photoURL) {
    coverEls.push(mk('image', { content: student.photoURL, x: 36, y: 70, width: 28, height: 25, zIndex: 5, style: { borderRadius: 60, opacity: 1, borderColor: P, borderWidth: 3 } }));
  } else {
    coverEls.push(...photoPlaceholder(36, 70, 28, 24, '📷 תמונת התלמיד/ה'));
  }
  addPage('שער', 'cover', coverEls);

  // ─── 2. WORK ID CARD ────────────────────────────────────────
  const idEls: DesignElement[] = [
    ...header('תעודת זהות של העבודה', '🪪'),
    ...pill(5, 15, 90, 7, 'פרטים טכניים', '📋', P),
    mk('text', { x: 5, y: 24, width: 90, height: 65, content: [
      `שם התלמיד/ה: ${studentName}`,
      `בית ספר: ${cp.schoolName || '_______________'}`,
      `כיתה: ${cp.grade || '_______________'}`,
      `מורה מלווה: ${cp.teacherName || '_______________'}`,
      `מנהל/ת: ${cp.principalName || '_______________'}`,
      `עיר: ${cp.city || '_______________'}`,
      `תאריך הגשה: ${cp.submissionDate || '_______________'}`,
      `שנה עברית: ${cp.hebrewYear || '_______________'}`,
    ].join('\n'), style: { fontSize: 20, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 2.1 } }),
  ];
  addPage('תעודת זהות של העבודה', 'cover', idEls);

  // ─── 3. TABLE OF CONTENTS (placeholder — rebuilt after all pages known) ──
  const tocPageIdx = pages.length;
  addPage('תוכן עניינים', 'custom', [
    mk('text', { x: 5, y: 15, width: 90, height: 78, content: '...', style: { fontSize: 20, textAlign: 'right', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont } }),
  ]);

  // ─── 4. PERSONAL INTRO ──────────────────────────────────────
  const intro = pd.introduction || {};
  const introEls: DesignElement[] = [
    ...header('מבוא אישי', '✍️'),
    ...pill(55, 15, 41, 6.5, 'מבוא', '📝', P),
    ...textBlock(5, 23, 90, 48, intro.personalIntro, 'כתוב כאן את המבוא האישי שלך — למה חשובה לך עבודה זו, מה אתה מקווה לגלות, ומה הציפיות שלך מהתהליך.', 20),
  ];
  introEls.push(...photoPlaceholder(62, 72, 33, 22, '📷 תמונה אישית'));
  addPage('מבוא אישי', 'personal', introEls);

  // ─── 5. DEDICATION ──────────────────────────────────────────
  if (intro.dedication) {
    const dedicationEls: DesignElement[] = [
      mk('shape', { x: 0, y: 0, width: 100, height: 100, zIndex: 0, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.04 } }),
      mk('text', { x: 10, y: 10, width: 80, height: 12, content: '❝', style: { fontSize: 80, textAlign: 'center', color: P, opacity: 0.12, fontFamily: 'serif' } }),
      mk('text', { x: 10, y: 25, width: 80, height: 50, content: intro.dedication, style: { fontSize: 24, textAlign: 'center', color: tmpl.textColor, fontFamily: tmpl.titleFont, lineHeight: 1.9, fontWeight: 'bold' } }),
      mk('text', { x: 10, y: 78, width: 80, height: 8, content: '— הקדשה', style: { fontSize: 18, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont } }),
    ];
    addPage('הקדשה', 'custom', dedicationEls);
  }

  // ─── PERSONAL IDENTITY ─────────────────────────────────────
  const personalIdEls: DesignElement[] = [
    ...header('תעודת זהות אישית', '👤', 'חלק 2: אני — הזהות האישית'),
    ...pill(55, 15, 41, 6.5, 'פרטים אישיים', '📋', P),
    mk('text', { x: 5, y: 23, width: 48, height: 55, content: [
      `שם מלא: ${student ? `${student.firstName} ${student.lastName}` : '_______________'}`,
      student?.nickname ? `כינוי: ${student.nickname}` : '',
      `תאריך לידה: ${student?.birthDate?.slice(0,10) || '_______________'}`,
      `מקום לידה: ${student?.birthPlace || '_______________'}`,
      student?.countryOfResidence ? `מדינה: ${student.countryOfResidence}` : '',
      student?.cityOfResidence ? `עיר: ${student.cityOfResidence}` : '',
      student?.religion ? `דת: ${student.religion}` : '',
    ].filter(Boolean).join('\n'), style: { fontSize: 20, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 2 } }),
    ...photoPlaceholder(55, 23, 40, 52),
  ];
  addPage('תעודת זהות אישית', 'personal', personalIdEls);

  // ─── NAME STORY ─────────────────────────────────────────────
  const ps = pd.personalStory || {};
  const nameEls: DesignElement[] = [
    ...header('סיפור השם שלי', '✍️', 'חלק 2: אני'),
    mk('shape', { x: 0, y: 0, width: 6, height: 100, zIndex: 0, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.45 } }),
    mk('text', { x: 72, y: 14, width: 22, height: 18, content: '❝', style: { fontSize: 70, textAlign: 'right', color: P, opacity: 0.12, fontFamily: 'serif' } }),
    ...textBlock(8, 15, 88, 40, ps.nameMeaning, 'כאן יופיע סיפור השם שלי — מה המשמעות, מי בחר אותו ולמה, ומה הקשר שלו להיסטוריה המשפחתית.', 20),
    ...(ps.nameChoiceStory ? [...pill(55, 58, 41, 6.5, 'סיפור הבחירה', '💬', accent), ...textBlock(8, 66, 88, 25, ps.nameChoiceStory, '', 18)] : []),
  ];
  if (student?.photoURL) nameEls.push(mk('image', { content: student.photoURL, x: 66, y: 75, width: 28, height: 22, zIndex: 5, style: { borderRadius: 12 } }));
  else nameEls.push(...photoPlaceholder(66, 75, 28, 20));
  addPage('סיפור השם שלי', 'name', nameEls);

  // ─── DAY I WAS BORN ─────────────────────────────────────────
  if (ps.dayIWasBorn) {
    addPage('ביום שנולדתי', 'personal', [
      ...header('ביום שנולדתי', '🗓️', 'חלק 2: אני'),
      ...pill(55, 15, 41, 6.5, student?.birthDate?.slice(0,10) || '', '🎂', P),
      ...textBlock(5, 23, 90, 65, ps.dayIWasBorn, '', 20),
      ...photoPlaceholder(55, 70, 40, 24, '📰 כותרות עיתון מיום הלידה'),
    ]);
  }

  // ─── EARLY CHILDHOOD ────────────────────────────────────────
  addPage('זיכרונות ילדות מוקדמים', 'personal', [
    ...header('זיכרונות ילדות מוקדמים', '🧸', 'חלק 2: אני'),
    ...textBlock(5, 15, 58, 75, ps.earlyChildhood, 'כאן יופיעו זיכרונות מהילדות המוקדמת — גיל 0 עד 5, סיפורים וחוויות שנחרטו בזיכרון.', 18),
    ...photoPlaceholder(65, 15, 30, 40, '📷 תמונה מהילדות'),
    ...photoPlaceholder(65, 57, 30, 33, '📷 עוד תמונה'),
  ]);

  // ─── ELEMENTARY SCHOOL ──────────────────────────────────────
  addPage('היסודי שלי', 'personal', [
    ...header('היסודי שלי', '🏫', 'חלק 2: אני'),
    ...textBlock(5, 15, 58, 75, ps.elementarySchool, 'כאן יופיע סיפור על שנות בית הספר היסודי — מורים, חברים, חוויות בלתי נשכחות ורגעים מיוחדים.', 18),
    ...photoPlaceholder(65, 15, 30, 35, '📷 תמונה מבית הספר'),
    ...photoPlaceholder(65, 52, 30, 38, '📷 עם חברים'),
  ]);

  // ─── HOBBIES ────────────────────────────────────────────────
  addPage('התחביבים שלי', 'personal', [
    ...header('התחביבים שלי', '🎯', 'חלק 2: אני'),
    ...textBlock(5, 15, 90, 40, ps.hobbies, 'כאן יופיעו התחביבים ותחומי העניין שלי — מה אני עושה בשעות הפנאי, מה מרגש אותי ומשמח אותי.', 20),
    ...photoPlaceholder(5, 57, 28, 35, '📷 תחביב 1'),
    ...photoPlaceholder(35, 57, 28, 35, '📷 תחביב 2'),
    ...photoPlaceholder(65, 57, 30, 35, '📷 תחביב 3'),
  ]);

  if (ps.talents) {
    addPage('הכישרונות שלי', 'personal', [
      ...header('הכישרונות שלי', '⭐', 'חלק 2: אני'),
      ...textBlock(5, 15, 90, 55, ps.talents, '', 20),
      ...photoPlaceholder(5, 72, 43, 22, '📷 הכישרון שלי בפעולה'),
      ...photoPlaceholder(52, 72, 43, 22, '📷 עוד דוגמה'),
    ]);
  }

  addPage('אני מאמין', 'personal', [
    ...header('אני מאמין', '💡', 'חלק 2: אני'),
    mk('text', { x: 8, y: 13, width: 15, height: 22, content: '❝', style: { fontSize: 80, textAlign: 'right', color: P, opacity: 0.12, fontFamily: 'serif' } }),
    ...textBlock(5, 15, 90, 55, ps.myBeliefs, 'כאן יופיעו הערכים וההשקפה שלי על החיים — מה חשוב לי, מה אני מאמין בו, ומה המוטו שלי לחיים.', 20),
    ...(ps.futureLetter ? [...pill(55, 72, 41, 6.5, 'מכתב לעתיד', '📮', accent), ...textBlock(5, 72, 48, 22, ps.futureLetter, '', 18)] : [...photoPlaceholder(5, 72, 90, 22, '📷 גלריה אישית')]),
  ]);

  // Gallery
  const galleryPhotos: string[] = Array.isArray(ps.gallery) ? ps.gallery.filter(Boolean) : [];
  const galEls: DesignElement[] = [
    ...header('גלריית "אני"', '🖼️', 'חלק 2: אני'),
    mk('text', { x: 5, y: 14, width: 90, height: 6, content: 'קולאז׳ תמונות מתחנות שונות בחיי', style: { fontSize: 18, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont } }),
  ];
  [[5,22,28,35],[35,22,28,35],[65,22,30,35],[5,59,28,35],[35,59,28,35],[65,59,30,35]].forEach(([x, y, w, h], i) => {
    const url = galleryPhotos[i];
    if (url) galEls.push(mk('image', { content: url, x, y, width: w, height: h, zIndex: 5, style: { borderRadius: 8, opacity: 1 } }));
    else galEls.push(...photoPlaceholder(x, y, w, h, `📷 תמונה ${i + 1}`));
  });
  addPage('גלריית "אני"', 'personal', galEls);

  // ═══════════════════════════════════════════════════════════
  // PART 3 — NUCLEAR FAMILY (FIXED)
  // ═══════════════════════════════════════════════════════════
  const nf = pd.nuclearFamily || {};

  // Correctly identify parents using relationships
  const parentRels = relationships.filter(r =>
    r.personBId === project.studentPersonId &&
    ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType)
  );
  
  // Correctly identify siblings
  const sibRels = relationships.filter(r =>
    (r.personAId === project.studentPersonId || r.personBId === project.studentPersonId) &&
    r.relationshipType === 'sibling'
  );
  const siblingIds = [...new Set(sibRels.map(r =>
    r.personAId === project.studentPersonId ? r.personBId : r.personAId
  ))];
  
  // Also find children of same parents who are not the student
  const parentIds = parentRels.map(r => r.personAId);
  const sharedSiblingIds = relationships
    .filter(r =>
      parentIds.includes(r.personAId) &&
      ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType) &&
      r.personBId !== project.studentPersonId
    )
    .map(r => r.personBId);

  const allSiblingIds = [...new Set([...siblingIds, ...sharedSiblingIds])];
  const siblings = allSiblingIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];

  const parents = parentIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
  
  // ─── OUR HOME ───────────────────────────────────────────────
  addPage('הבית שלנו', 'nuclear_family', [
    ...header('הבית שלנו', '🏡', 'חלק 3: המשפחה הגרעינית'),
    ...textBlock(5, 15, 58, 75, nf.ourHome, 'תאר את הבית הפיזי, השכונה, האווירה בבית — מה מיוחד בבית שלכם, איך הוא נראה ומרגיש.', 18),
    ...photoPlaceholder(65, 15, 30, 35, '📷 הבית שלנו'),
    ...photoPlaceholder(65, 52, 30, 38, '📷 השכונה'),
  ]);

  // ─── NUCLEAR FAMILY DIAGRAM (FIXED) ─────────────────────────
  const nucEls: DesignElement[] = [...header('המשפחה הגרעינית', '👨‍👩‍👧', 'חלק 3: המשפחה הגרעינית')];

  const cardW = 20;
  const cardH = 32;

  // Place parents in row 1, centered
  const totalParents = parents.length;
  const parentRowW = totalParents * cardW + Math.max(0, totalParents - 1) * 5;
  const parentStartX = (100 - parentRowW) / 2;
  const parentCardIds: string[] = [];

  parents.forEach((parent, idx) => {
    const cardId = uuidv4();
    parentCardIds.push(cardId);
    nucEls.push({
      ...mk('person_card', { personId: parent.id, x: parentStartX + idx * (cardW + 5), y: 16, width: cardW, height: cardH, zIndex: 10 }),
      id: cardId,
    });
  });

  // Place student in row 2 center
  const studentCardId = uuidv4();
  if (student) {
    nucEls.push({
      ...mk('person_card', { personId: student.id, x: (100 - cardW) / 2, y: 58, width: cardW, height: cardH, zIndex: 10 }),
      id: studentCardId,
    });
  }

  // Place siblings: spread to the right and left of student
  const sibW = 17;
  const sibH = 28;
  const studentCenterX = (100 - cardW) / 2 + cardW / 2;
  const sibSpacing = 22;
  
  const siblingCardIds: string[] = [];
  siblings.slice(0, 6).forEach((sib, idx) => {
    const side = idx % 2 === 0 ? 1 : -1;
    const offset = Math.ceil((idx + 1) / 2) * sibSpacing;
    const sibX = Math.max(1, Math.min(100 - sibW - 1, studentCenterX + side * offset - sibW / 2));
    const sibCardId = uuidv4();
    siblingCardIds.push(sibCardId);
    nucEls.push({
      ...mk('person_card', { personId: sib.id, x: sibX, y: 58, width: sibW, height: sibH, zIndex: 9 }),
      id: sibCardId,
    });
  });

  // Connection lines
  const childCardIds = student ? [studentCardId, ...siblingCardIds] : siblingCardIds;
  parentCardIds.forEach(parentId => {
      childCardIds.forEach(childId => {
          nucEls.push(mk('connection_line', {
              fromElementId: parentId,
              toElementId: childId,
              x: 0, y: 0, width: 0, height: 0, zIndex: 2,
              style: { color: P, borderWidth: 2, lineType: 'straight' } as any,
          }));
      });
  });

  addPage('המשפחה הגרעינית', 'nuclear_family', nucEls);

  // ─── PARENT PAGES ──────────────────────────────────────────
  const parentBios: Array<{ personId?: string; bio?: string; militaryService?: string; profession?: string }> = (nf.parents as any[]) || [];
  parents.forEach((parent) => {
    const bio = parentBios.find(b => b.personId === parent.id) || {};
    const role = parent.gender === 'female' ? 'אמא' : 'אבא';
    const parentEls: DesignElement[] = [
      ...header(`${role} — ${parent.firstName} ${parent.lastName}`, parent.gender === 'female' ? '👩' : '👨', 'חלק 3: המשפחה הגרעינית'),
      mk('person_card', { personId: parent.id, x: 66, y: 15, width: 29, height: 40, zIndex: 10 }),
    ];
    let y = 15;
    if (bio.bio) { parentEls.push(...pill(5, y, 59, 6.5, 'סיפור חיים', '📖', P)); y += 7.5; parentEls.push(...textBlock(5, y, 59, 22, bio.bio, '', 18)); y += 24; }
    if (bio.militaryService) { parentEls.push(...pill(5, y, 59, 6.5, 'שירות צבאי', '🎖️', accent)); y += 7.5; parentEls.push(...textBlock(5, y, 59, 15, bio.militaryService, '', 18)); y += 17; }
    if (bio.profession) { parentEls.push(...pill(5, y, 59, 6.5, 'עיסוק ומקצוע', '💼', P)); y += 7.5; parentEls.push(...textBlock(5, y, 59, 15, bio.profession, '', 18)); }
    if (!bio.bio && !bio.militaryService && !bio.profession) {
      parentEls.push(...textBlock(5, 15, 59, 78, undefined, `כאן יופיע סיפורו של ${parent.firstName} — ילדות, שירות צבאי, מקצוע ועוד.`, 18));
    }
    parentEls.push(...photoPlaceholder(66, 57, 29, 36, `📷 תמונות של ${parent.firstName}`));
    addPage(`${role} — ${parent.firstName}`, 'nuclear_family', parentEls);
  });

  // ─── PARENTS MEETING ──────────────────────────────────────
  addPage('סיפור ההיכרות של ההורים', 'nuclear_family', [
    ...header('סיפור ההיכרות', '💑', 'חלק 3: המשפחה הגרעינית'),
    ...textBlock(5, 15, 90, 55, nf.parentsMeetingStory, 'כאן יופיע סיפור היכרות ההורים — איך הם נפגשו, מה קרה, וסיפור החתונה.', 20),
    ...photoPlaceholder(5, 72, 43, 22, '📷 תמונת חתונה'),
    ...photoPlaceholder(52, 72, 43, 22, '📷 תמונה נוספת'),
  ]);

  // ─── SIBLING PAGES ──────────────────────────────────────────
  const sibBios: Array<{ personId?: string; relationshipDescription?: string }> = (nf.siblings as any[]) || [];
  siblings.forEach((sib) => {
    const sibBio = sibBios.find(b => b.personId === sib.id) || {};
    addPage(`${sib.firstName} — אח/ות`, 'nuclear_family', [
      ...header(`${sib.firstName} ${sib.lastName}`, sib.gender === 'female' ? '👧' : '👦', 'חלק 3: אחים ואחיות'),
      mk('person_card', { personId: sib.id, x: 66, y: 15, width: 29, height: 40, zIndex: 10 }),
      ...pill(5, 15, 59, 6.5, 'אח/ות שלי', '💙', P),
      ...textBlock(5, 23, 59, 55, sibBio.relationshipDescription, `כאן יופיע סיפור על ${sib.firstName} — הקשר שלנו, חוויות משותפות, ומה מיוחד בהם.`, 18),
      ...photoPlaceholder(66, 57, 29, 36, `📷 תמונות של ${sib.firstName}`),
    ]);
  });

  // ─── FAMILY LIFE ─────────────────────────────────────────────
  addPage('הווי משפחתי וחגים', 'nuclear_family', [
    ...header('הווי משפחתי', '🎉', 'חלק 3: המשפחה הגרעינית'),
    ...textBlock(5, 15, 58, 40, nf.familyLife, 'תאר את הבילויים, הטיולים, הפעילויות המשותפות של המשפחה.', 18),
    ...photoPlaceholder(65, 15, 30, 40, '📷 ביחד'),
    ...pill(5, 57, 90, 7, 'חגים ומנהגים', '🕍', accent),
    ...textBlock(5, 66, 90, 28, nf.holidaysAndCustoms, 'כאן יופיעו מסורות המשפחה בחגים.', 18),
  ]);

  if (nf.ourPets) {
    addPage('חיות המחמד שלנו', 'nuclear_family', [
      ...header('חיות המחמד שלנו', '🐾', 'חלק 3: המשפחה הגרעינית'),
      ...textBlock(5, 15, 90, 55, nf.ourPets, '', 20),
      ...photoPlaceholder(5, 72, 43, 22, '📷 חיות המחמד שלנו'),
      ...photoPlaceholder(52, 72, 43, 22, '📷 עוד תמונה'),
    ]);
  }

  // ═══════════════════════════════════════════════════════════
  // PART 4+5 — GRANDPARENTS
  // ═══════════════════════════════════════════════════════════
  const fr = pd.familyRoots || {} as any;

  const grandparentGroups = [
    {
      label: 'מצד אבא', chapterLabel: 'חלק 4: שורשים — דור הסבים מצד אבא',
      pageType: 'roots_paternal' as const,
      grandfather: { key: 'paternalGrandfather', title: 'סבא מצד אבא', emoji: '👴' },
      grandmother: { key: 'paternalGrandmother', title: 'סבתא מצד אבא', emoji: '👵' },
      meetingKey: 'paternalGrandparentsMeetingStory',
    },
    {
      label: 'מצד אמא', chapterLabel: 'חלק 5: שורשים — דור הסבים מצד אמא',
      pageType: 'roots_maternal' as const,
      grandfather: { key: 'maternalGrandfather', title: 'סבא מצד אמא', emoji: '👴' },
      grandmother: { key: 'maternalGrandmother', title: 'סבתא מצד אמא', emoji: '👵' },
      meetingKey: 'maternalGrandparentsMeetingStory',
    },
  ];

  grandparentGroups.forEach(group => {
    [group.grandfather, group.grandmother].forEach(gp => {
      const data: any = (fr as any)[gp.key] || {};
      const gPerson = data.personId ? people.find(p => p.id === data.personId) : null;
      const gpName = gPerson ? `${gPerson.firstName} ${gPerson.lastName}` : gp.title;

      addPage(`${gp.title} — פרטים`, group.pageType, [
        ...header(`${gp.title} — תעודת זהות`, gp.emoji, group.chapterLabel),
        ...(gPerson ? [mk('person_card', { personId: gPerson.id, x: 66, y: 15, width: 29, height: 44, zIndex: 10 })] : [...photoPlaceholder(66, 15, 29, 44, `📷 ${gp.title}`)]),
        ...pill(5, 15, 59, 6.5, 'פרטים בסיסיים', '📋', P),
        ...textBlock(5, 23, 59, 45, data.idCardStory,
          gPerson ? [`שם: ${gPerson.firstName} ${gPerson.lastName}`, gPerson.birthDate ? `נולד/ה: ${gPerson.birthDate.slice(0,10)}` : '', gPerson.birthPlace ? `מקום לידה: ${gPerson.birthPlace}` : ''].filter(Boolean).join('\n') : 'פרטים אישיים יופיעו כאן', 18),
      ]);

      addPage(`${gp.title} — עלייה`, group.pageType, [
        ...header(`${gp.title} — עלייה וקליטה`, '✈️', group.chapterLabel),
        ...textBlock(5, 15, 90, 55, data.aliyahStory, `כאן יופיע סיפור העלייה וההגעה לישראל של ${gpName}.`, 18),
        ...photoPlaceholder(5, 72, 43, 22, '📷 תמונה מתקופת העלייה'),
        ...photoPlaceholder(52, 72, 43, 22, '📷 תעודות / מסמכים'),
      ]);

      addPage(`${gp.title} — בגרות`, group.pageType, [
        ...header(`${gp.title} — בגרות וקריירה`, '🌱', group.chapterLabel),
        ...textBlock(5, 15, 58, 75, data.adulthoodStory || data.story, `כאן יופיע סיפור הבגרות של ${gpName}.`, 18),
        ...photoPlaceholder(65, 15, 30, 35, '📷 תמונות בגרות'),
        ...photoPlaceholder(65, 52, 30, 38, '📷 משפחה'),
      ]);
    });

    const meetingStory: string | undefined = (fr as any)[group.meetingKey];
    if (meetingStory) {
      addPage(`ההיכרות — ${group.label}`, group.pageType, [
        ...header(`סיפור ההיכרות — ${group.label}`, '💕', group.chapterLabel),
        ...textBlock(5, 15, 90, 65, meetingStory, '', 20),
        ...photoPlaceholder(5, 82, 43, 13, '📷 תמונה'),
        ...photoPlaceholder(52, 82, 43, 13, '📷 חתונה'),
      ]);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // PART 6 — RESEARCH
  // ═══════════════════════════════════════════════════════════
  const researchData = pd.research || {} as any;
  const finalizationData = pd.finalPresentation || {};

  // Family tree graphic
  const treeEls: DesignElement[] = [
    ...header('אילן יוחסין גרפי', '🌳', 'חלק 6: נתונים ומחקר'),
    mk('text', { x: 5, y: 14, width: 90, height: 6, content: 'תרשים 3-4 דורות', style: { fontSize: 18, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont } }),
  ];
  if (researchData.familyTreeGraphic) {
    treeEls.push(mk('image', { content: researchData.familyTreeGraphic, x: 5, y: 22, width: 90, height: 72, zIndex: 5, style: { borderRadius: 4 } }));
  } else {
    const gpKeys = ['paternalGrandfather', 'paternalGrandmother', 'maternalGrandfather', 'maternalGrandmother'];
    const gpIds = gpKeys.map(k => (fr as any)[k]?.personId).filter(Boolean);
    gpIds.forEach((pid: string, i: number) => {
      treeEls.push(mk('person_card', { personId: pid, x: 3 + i * 24, y: 22, width: 21, height: 28, zIndex: 10 }));
    });
    if (student) treeEls.push(mk('person_card', { personId: student.id, x: 40, y: 83, width: 20, height: 13, zIndex: 10 }));
    if (gpIds.length === 0) treeEls.push(...photoPlaceholder(5, 22, 90, 72, '🌳 הוסף כאן תרשים אילן יוחסין'));
  }
  addPage('אילן יוחסין', 'roots_great', treeEls);

  // Migration map
  const mapEls: DesignElement[] = [...header('מפת נדודים משפחתית', '🗺️', 'חלק 6: נתונים ומחקר')];
  if (pd.finalPresentation?.mapScreenshotUrl) {
    mapEls.push(mk('image', { content: pd.finalPresentation?.mapScreenshotUrl, x: 5, y: 15, width: 90, height: 65, zIndex: 5, style: { borderRadius: 4 } }));
  } else {
    mapEls.push(...photoPlaceholder(5, 15, 90, 65, '🗺️ הוסף מפת נדודים'));
  }
  mapEls.push(mk('text', { x: 5, y: 82, width: 90, height: 12, content: 'מדינות מוצא המשפחה: ________________________\nמסלול ההגירה: ________________________ ← ישראל', style: { fontSize: 18, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.8 } }));
  addPage('מפת נדודים', 'custom', mapEls);

  const selectedEvents = pd.finalPresentation?.selectedEvents || [];
  if (selectedEvents.length > 0) {
    const calEls: DesignElement[] = [
      ...header('תאריכים מיוחדים', '📅', 'חלק 6: נתונים ומחקר'),
    ];
    const eventText = selectedEvents
      .map((ev: any) => `• ${ev.title} — ${ev.date}`)
      .join('\n');
    calEls.push(mk('text', {
      x: 5, y: 15, width: 90, height: 78,
      content: eventText,
      style: { fontSize: 16, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 2 }
    }));
    addPage('תאריכים מיוחדים', 'custom', calEls);
  }

  const h = pd.heritage || {} as any;
  if (h.familyNameOrigin) {
    addPage('מקור שם המשפחה', 'custom', [
      ...header('מקור שם המשפחה', '📜', 'חלק 6: נתונים ומחקר'),
      ...textBlock(5, 15, 90, 60, h.familyNameOrigin, '', 20),
      ...photoPlaceholder(5, 77, 90, 17, '📜 מסמך או תמונה הקשורה לשם המשפחה'),
    ]);
  }

  if (researchData.cityOriginStory) {
    addPage('גלגולה של עיר', 'custom', [
      ...header('גלגולה של עיר', '🏙️', 'חלק 6: נתונים ומחקר'),
      ...textBlock(5, 15, 90, 60, researchData.cityOriginStory, '', 20),
      ...photoPlaceholder(5, 77, 43, 17, '📷 תמונת העיר'),
      ...photoPlaceholder(52, 77, 43, 17, '🗺️ מפה'),
    ]);
  }

  const selectedStats = pd.finalPresentation?.selectedStats || [];
  const statsEls: DesignElement[] = [
    ...header('סטטיסטיקה משפחתית', '📊', 'חלק 6: נתונים ומחקר'),
  ];
  if (selectedStats.length === 0) {
    statsEls.push(mk('text', { x: 5, y: 15, width: 90, height: 80, content: 'גרפים סטטיסטיים יופיעו כאן לאחר בחירה בשלב 13 של האשף.', style: { fontSize: 16, color: tmpl.mutedTextColor, textAlign: 'center' } }));
  } else {
    statsEls.push(mk('text', { x: 5, y: 15, width: 90, height: 8, content: `גרפים שנבחרו: ${selectedStats.map((s: any) => s.title).join(' | ')}`, style: { fontSize: 14, color: tmpl.textColor, textAlign: 'right', fontFamily: tmpl.bodyFont } }));
    // Place stat chart placeholders in a grid
    const cols = selectedStats.length <= 2 ? selectedStats.length : 2;
    selectedStats.slice(0, 4).forEach((stat: any, i: number) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 5 + col * 47;
      const y = 25 + row * 38;
      statsEls.push(...photoPlaceholder(x, y, 44, 35, `📊 ${stat.title}`));
    });
  }
  addPage('סטטיסטיקה משפחתית', 'custom', statsEls);

  // ═══════════════════════════════════════════════════════════
  // PART 7 — HERITAGE
  // ═══════════════════════════════════════════════════════════
  if (h.inheritedObject) {
    addPage('חפץ עובר בירושה', 'heritage', [
      ...header('חפץ עובר בירושה', '💎', 'חלק 7: מורשת'),
      ...textBlock(5, 15, 58, 55, h.inheritedObject, '', 20),
      ...photoPlaceholder(65, 15, 30, 55, '📷 תמונת החפץ'),
      ...photoPlaceholder(5, 72, 90, 22, '📷 החפץ בהקשרו'),
    ]);
  }

  if (h.familyRecipe) {
    addPage('הטעם של פעם — מתכון', 'heritage', [
      ...header('הטעם של פעם', '🍽️', 'חלק 7: מורשת'),
      ...pill(55, 15, 41, 6.5, 'מתכון משפחתי מסורתי', '👩‍🍳', P),
      ...textBlock(5, 23, 90, 60, h.familyRecipe, '', 18),
      ...photoPlaceholder(5, 85, 43, 11, '📷 התבשיל המוכן'),
      ...photoPlaceholder(52, 85, 43, 11, '📷 המבשלת/ת'),
    ]);
  }

  addPage('המשפחה שלי וההיסטוריה', 'national_history', [
    ...header('המשפחה שלי וההיסטוריה', '🇮🇱', 'חלק 7: מורשת'),
    ...textBlock(5, 15, 90, 55, h.familyAndHistory, 'כאן יופיע הקשר בין הסיפור המשפחתי לאירועים לאומיים ומלחמות ישראל.', 18),
    mk('shape', { x: 48, y: 72, width: 4, height: 24, zIndex: 1, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.3 } }),
    mk('text', { x: 5, y: 72, width: 41, height: 8, content: '1948 — הקמת המדינה', style: { fontSize: 16, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont } }),
    mk('shape', { x: 46, y: 74, width: 8, height: 3, zIndex: 3, style: { shapeType: 'circle', backgroundColor: P, opacity: 0.9 } }),
    mk('text', { x: 54, y: 80, width: 41, height: 8, content: '1967 — ששת הימים', style: { fontSize: 16, textAlign: 'left', color: tmpl.textColor, fontFamily: tmpl.bodyFont } }),
    mk('shape', { x: 46, y: 82, width: 8, height: 3, zIndex: 3, style: { shapeType: 'circle', backgroundColor: accent, opacity: 0.9 } }),
    mk('text', { x: 5, y: 88, width: 41, height: 8, content: '1973 — יום כיפור', style: { fontSize: 16, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont } }),
  ]);

  if (h.roleModels) {
    addPage('דמויות מופת', 'heritage', [
      ...header('דמויות מופת במשפחה', '⭐', 'חלק 7: מורשת'),
      ...textBlock(5, 15, 90, 60, h.roleModels, '', 20),
      ...photoPlaceholder(5, 77, 43, 18, '📷 תמונת הדמות'),
      ...photoPlaceholder(52, 77, 43, 18, '📷 עוד תמונה'),
    ]);
  }

  if (h.parentsLetter) {
    addPage('מכתב מההורים', 'heritage', [
      ...header('מכתב אישי מההורים', '💌', 'חלק 7: מורשת'),
      mk('text', { x: 8, y: 13, width: 16, height: 20, content: '❝', style: { fontSize: 80, textAlign: 'right', color: accent, opacity: 0.15, fontFamily: 'serif' } }),
      ...textBlock(5, 15, 90, 70, h.parentsLetter, '', 20),
      mk('text', { x: 5, y: 87, width: 90, height: 8, content: '— אמא ואבא, באהבה', style: { fontSize: 18, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.titleFont, fontWeight: 'bold' } }),
    ]);
  }

  // Documentation
  const docPhotos: string[] = Array.isArray(h.documentationPage) ? h.documentationPage.filter(Boolean) : [];
  const docEls: DesignElement[] = [
    ...header('עמוד התיעוד', '📜', 'חלק 7: מורשת'),
    mk('text', { x: 5, y: 14, width: 90, height: 6, content: 'מסמכים מקוריים, תעודות לידה, דרכונים ישנים ותמונות נדירות', style: { fontSize: 18, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont } }),
  ];
  [[5,22,43,35],[52,22,43,35],[5,59,43,35],[52,59,43,35]].forEach(([x, y, w, hh], i) => {
    const url = docPhotos[i];
    if (url) docEls.push(mk('image', { content: url, x, y, width: w, height: hh, zIndex: 5, style: { borderRadius: 4 } }));
    else docEls.push(...photoPlaceholder(x, y, w, hh, `📜 מסמך ${i + 1}`));
  });
  addPage('עמוד התיעוד', 'heritage', docEls);

  // ═══════════════════════════════════════════════════════════
  // PART 8 — CONCLUSION
  // ═══════════════════════════════════════════════════════════
  const conc = pd.conclusion || {} as any;

  addPage('רפלקציה אישית', 'custom', [
    ...header('רפלקציה אישית', '💭', 'חלק 8: סיכום'),
    mk('text', { x: 8, y: 13, width: 16, height: 20, content: '💭', style: { fontSize: 60, textAlign: 'right', fontFamily: tmpl.bodyFont } }),
    ...textBlock(5, 15, 90, 68, conc.personalReflection, 'כאן אכתוב מה למדתי על עצמי ועל המשפחה שלי, מה הפתיע אותי, ומה גיליתי שלא ידעתי.', 20),
    ...photoPlaceholder(5, 85, 90, 10, '📷 תמונה מסכמת'),
  ]);

  addPage('תודות', 'custom', [
    ...header('תודות', '🙏', 'חלק 8: סיכום'),
    ...textBlock(5, 15, 90, 70, conc.thanks, 'תודה מיוחדת לכל מי שעזר לי בכתיבת עבודה זו:\n• סבא וסבתא על הסיפורים והזמן\n• אמא ואבא על הסיוע\n• המורה _______________ על ההנחיה', 20),
    mk('text', { x: 5, y: 87, width: 90, height: 8, content: '❤️', style: { fontSize: 30, textAlign: 'center', fontFamily: tmpl.bodyFont } }),
  ]);

  addPage('ביבליוגרפיה', 'custom', [
    ...header('ביבליוגרפיה', '📚', 'חלק 8: סיכום'),
    ...textBlock(5, 15, 90, 75, conc.bibliography,
      'מקורות המידע שהשתמשתי בהם:\n\n• ראיונות אישיים:\n  — סבא/ה _______________ (ראיון אישי, תאריך ___)\n\n• מסמכים:\n  — תמונות משפחתיות\n\n• אתרים:\n  — _______________', 18),
    mk('text', { x: 5, y: 91, width: 90, height: 7, content: `${student ? student.firstName + ' ' + student.lastName : ''} | שנת ${new Date().getFullYear()}`, style: { fontSize: 16, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont, opacity: 0.65 } }),
  ]);

  // ═══════════════════════════════════════════════════════════
  // UPDATE TABLE OF CONTENTS with real page list
  // ═══════════════════════════════════════════════════════════
  const tocPage = pages[tocPageIdx];
  if (tocPage) {
    tocPage.elements = buildTocElements(pages, tmpl, studentName, schoolYear, hebrewYear, tocPage.pageNumber);
  }

  return pages;
}

// ============================================================
// TEMPLATE DECORATIONS
// ============================================================
function TemplateDecorations({ template }: { template: DesignTemplate }) {
  const P = template.primaryColor;
  const accent = template.accentColor;
  const pat = template.decorativePattern;
  if (pat === 'none') return null;
  if (pat === 'corners') return (
    <>
      <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none" style={{ borderTop: `3px solid ${P}`, borderRight: `3px solid ${P}`, opacity: 0.35 }} />
      <div className="absolute bottom-0 left-0 w-16 h-16 pointer-events-none" style={{ borderBottom: `3px solid ${accent}`, borderLeft: `3px solid ${accent}`, opacity: 0.35 }} />
    </>
  );
  if (pat === 'border') return <div className="absolute inset-2 pointer-events-none rounded-lg" style={{ border: `1.5px solid ${P}`, opacity: 0.2 }} />;
  if (pat === 'dots') return <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, ${P}22 1px, transparent 1px)`, backgroundSize: '28px 28px', opacity: 0.4 }} />;
  if (pat === 'lines') return <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(0deg, ${P}12 0px, ${P}12 1px, transparent 1px, transparent 28px)`, opacity: 0.3 }} />;
  if (pat === 'diagonal') return <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${P}0a 0px, ${P}0a 1px, transparent 1px, transparent 20px)`, opacity: 0.5 }} />;
  return null;
}

// ============================================================
// PERSON CARD ELEMENT — tight layout, scales with element size
// ============================================================
const PersonCardElement = ({
  element, people, relationships
}: {
  element: DesignElement; people: Person[]; relationships: Relationship[];
}) => {
  const person = people.find(p => p.id === element.personId);
  if (!person) return (
    <div className="w-full h-full rounded-xl flex items-center justify-center bg-white/5 border border-white/20 gap-1">
      <User className="w-5 h-5 opacity-30" />
      <span className="text-xs opacity-30">אדם לא נמצא</span>
    </div>
  );

  const childRels = relationships.filter(r => r.personAId === person.id && r.relationshipType === 'parent');
  const siblingRels = relationships.filter(r => (r.personAId === person.id || r.personBId === person.id) && r.relationshipType === 'sibling');
  const spouseRel = relationships.find(r => (r.personAId === person.id || r.personBId === person.id) && r.relationshipType === 'spouse');
  const spousePerson = spouseRel ? people.find(p => p.id === (spouseRel.personAId === person.id ? spouseRel.personBId : spouseRel.personAId)) : null;

  const p = person as any;
  const birthYear = person.birthDate && isValid(parseISO(person.birthDate)) ? new Date(person.birthDate).getFullYear() : null;
  const deathYear = person.deathDate && isValid(parseISO(String(person.deathDate))) ? new Date(String(person.deathDate)).getFullYear() : null;
  const age = birthYear ? (deathYear ? deathYear - birthYear : new Date().getFullYear() - birthYear) : null;
  const displayName = [person.firstName, person.nickname ? `"${person.nickname}"` : null, person.lastName].filter(Boolean).join(' ');

  const bgColor = element.style?.backgroundColor || 'rgba(255,255,255,0.08)';
  const textColor = element.style?.color || '#ffffff';
  const opacity = element.style?.opacity ?? 1;

  // cardTextScale: stored in element.style as (element as any)._cardTextScale, defaults to 1
  const cardTextScale = (element as any)._cardTextScale ?? 1;
  // hiddenFields: array of field keys to hide
  const hiddenFields: string[] = (element as any)._hiddenFields ?? [];

  const widthScale = Math.max(0.4, Math.min(2.5, (element.width || 0) / 20));
  const fs = (base: number) => Math.round(base * widthScale * cardTextScale);

  const allInfoRows: Array<{ key: string; icon: string; value: string }> = [];
  if (person.birthDate) allInfoRows.push({ key: 'birthDate', icon: '🎂', value: person.birthDate.slice(0, 10) });
  if (person.birthPlace) allInfoRows.push({ key: 'birthPlace', icon: '📍', value: person.birthPlace });
  if (deathYear) allInfoRows.push({ key: 'deathYear', icon: '✝', value: String(deathYear) });
  if (person.countryOfResidence) allInfoRows.push({ key: 'country', icon: '🌍', value: person.countryOfResidence });
  if (p.religion) allInfoRows.push({ key: 'religion', icon: '✡️', value: p.religion });
  if (person.profession) allInfoRows.push({ key: 'profession', icon: '💼', value: person.profession });
  if (spousePerson) allInfoRows.push({ key: 'spouse', icon: '💍', value: `${spousePerson.firstName} ${spousePerson.lastName}` });
  if (childRels.length) allInfoRows.push({ key: 'children', icon: '👶', value: `${childRels.length} ילדים` });
  if (siblingRels.length) allInfoRows.push({ key: 'siblings', icon: '👥', value: `${person.gender === 'female' ? 'אחיות/אחים' : 'אחים'}: ${siblingRels.length}` });

  const visibleRows = allInfoRows.filter(r => !hiddenFields.includes(r.key));
  const maxRows = Math.max(1, Math.floor(widthScale * 5));

  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden border border-white/15 backdrop-blur-sm shadow-lg"
      style={{
        backgroundColor: bgColor, opacity, color: textColor,
        padding: `${Math.max(3, Math.round(5 * widthScale))}px`,
        boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
        gap: `${Math.max(1, Math.round(2 * widthScale))}px`,
      }}
      dir="rtl"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: Math.max(2, Math.round(4 * widthScale)), flexShrink: 0 }}>
        <div style={{ width: Math.max(16, Math.round(32 * widthScale)), height: Math.max(16, Math.round(32 * widthScale)), borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.25)' }}>
          <img src={person.photoURL || getPlaceholderImage(person.gender)} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <div style={{ fontWeight: 700, lineHeight: 1.15, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: fs(11), color: textColor }}>{displayName}</div>
          {birthYear && !hiddenFields.includes('birthDate') && <div style={{ opacity: 0.65, fontSize: fs(8.5), lineHeight: 1.1 }}>{birthYear}{deathYear ? `–${deathYear}` : ''}{age ? ` · גיל ${age}` : ''}</div>}
          {person.gender && !hiddenFields.includes('gender') && <div style={{ opacity: 0.45, fontSize: fs(7.5), lineHeight: 1.1 }}>{person.gender === 'male' ? '♂ זכר' : person.gender === 'female' ? '♀ נקבה' : ''}{(p.status || p.lifeStatus) ? ` · ${p.status || p.lifeStatus}` : ''}</div>}
        </div>
      </div>
      {visibleRows.slice(0, maxRows).map((row, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: fs(7.5), lineHeight: 1 }}>{row.icon}</span>
          <span style={{ opacity: 0.65, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1, textAlign: 'right', fontSize: fs(8.5), color: textColor }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// CARD FIELD PANEL — double-click person card to open
// ============================================================
const CARD_FIELDS = [
  { key: 'birthDate', label: 'תאריך לידה' },
  { key: 'birthPlace', label: 'מקום לידה' },
  { key: 'deathYear', label: 'שנת פטירה' },
  { key: 'country', label: 'מדינה' },
  { key: 'religion', label: 'דת' },
  { key: 'profession', label: 'מקצוע' },
  { key: 'spouse', label: 'בן/בת זוג' },
  { key: 'children', label: 'ילדים' },
  { key: 'siblings', label: 'אחים/אחיות' },
  { key: 'gender', label: 'מין' },
];

function CardFieldPanel({ element, person, onUpdate, onClose }: {
  element: DesignElement;
  person: Person;
  onUpdate: (updates: Partial<DesignElement>) => void;
  onClose: () => void;
}) {
  const hiddenFields: string[] = (element as any)._hiddenFields ?? [];
  const cardTextScale: number = (element as any)._cardTextScale ?? 1;

  const toggleField = (key: string) => {
    const next = hiddenFields.includes(key)
      ? hiddenFields.filter(k => k !== key)
      : [...hiddenFields, key];
    onUpdate({ _hiddenFields: next } as any);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl w-72 border border-white/15 shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between p-3 border-b border-white/10">
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          <div className="flex items-center gap-2">
            <img src={person.photoURL || getPlaceholderImage(person.gender)} alt="" className="w-6 h-6 rounded-full object-cover opacity-70" />
            <span className="text-sm font-bold">{person.firstName} {person.lastName}</span>
          </div>
        </div>
        <div className="p-3 space-y-1.5">
          <div className="text-[10px] text-slate-400 uppercase font-bold mb-2">שדות מוצגים</div>
          {CARD_FIELDS.map(field => (
            <label key={field.key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
              <div className={cn('w-8 h-4 rounded-full relative transition-colors', !hiddenFields.includes(field.key) ? 'bg-indigo-500' : 'bg-slate-600')}
                onClick={() => toggleField(field.key)}>
                <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', !hiddenFields.includes(field.key) ? 'right-0.5' : 'left-0.5')} />
              </div>
              <span className="text-xs flex-1 text-right">{field.label}</span>
            </label>
          ))}
          <div className="border-t border-white/10 mt-3 pt-3">
            <div className="text-[10px] text-slate-400 uppercase font-bold mb-2">גודל טקסט בכרטיס</div>
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] text-slate-400">A</span>
              <input type="range" min={0.6} max={2.0} step={0.1} className="flex-1"
                value={cardTextScale}
                onChange={e => onUpdate({ _cardTextScale: Number(e.target.value) } as any)} />
              <span className="text-[10px] text-slate-400">A</span>
              <span className="text-xs text-white w-8 text-center">{Math.round(cardTextScale * 100)}%</span>
            </div>
          </div>
          <div className="border-t border-white/10 mt-3 pt-3">
            <button className="w-full text-xs py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 flex items-center justify-center gap-2"
              onClick={() => { onUpdate({ _syncVersion: Date.now() } as any); onClose(); }}>
              🔄 סנכרן מידע עדכני מהכרטיס
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PHOTO PLACEHOLDER ELEMENT
// ============================================================
function PhotoPlaceholderElement({ element, onOpenImagePicker }: { element: DesignElement; onOpenImagePicker: () => void; }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1 cursor-pointer select-none transition-all hover:bg-white/10"
      style={{
        borderRadius: element.style?.borderRadius ? `${element.style.borderRadius}px` : 8,
        border: `${element.style?.borderWidth || 2}px dashed ${element.style?.borderColor || '#818cf8'}`,
        backgroundColor: element.style?.backgroundColor || 'rgba(255,255,255,0.03)',
        opacity: element.style?.opacity ?? 0.85,
      }}
      onClick={e => { e.stopPropagation(); onOpenImagePicker(); }}
      title="לחץ להוספת תמונה"
    >
      <div className="text-xl">📷</div>
      <div className="text-[10px] text-center px-2 opacity-70 leading-tight">{element.content || 'הוסף תמונה'}</div>
      <div className="text-[9px] opacity-40">לחץ לבחירה</div>
    </div>
  );
}

// ============================================================
// MY FILES IMAGE GRID
// ============================================================
function MyFilesImageGrid({ treeId, onSelectImage }: { treeId: string; onSelectImage: (url: string) => void }) {
  const [files, setFiles] = useState<Array<{ name: string; url: string; key: string }>>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const db = useFirestore();
  useEffect(() => {
    (async () => {
      if (!user || !db) { setLoading(false); return; }
      try {
        const snap = await getDocs(query(collection(db, 'exportedFiles'), where('userId', '==', user.uid)));
        const mapped = snap.docs.map((d, idx) => {
          const f = d.data() as ExportedFile;
          return { name: f.fileName, url: f.downloadURL!, key: `${d.id}-${idx}` };
        }).filter(f => f.url && ['png', 'jpg', 'jpeg'].some(ext => f.name?.toLowerCase().endsWith(ext)));
        setFiles(mapped);
      } catch { setFiles([]); } finally { setLoading(false); }
    })();
  }, [user, db, treeId]);
  if (loading) return <div className="text-xs text-slate-500 text-center py-4">טוען...</div>;
  if (!files.length) return <div className="text-xs text-slate-500 text-center py-4 px-2"><p>אין תמונות</p><p className="opacity-60 mt-1">העלה קבצים דרך "הקבצים שלי"</p></div>;
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {files.map(f => (
        <button key={f.key} onClick={() => onSelectImage(f.url)} className="aspect-square rounded overflow-hidden border border-white/10 hover:border-indigo-400 transition-colors">
          <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}

// ============================================================
// CLIPBOARD & CONTEXT MENU
// ============================================================
let _clipboard: DesignElement | null = null;
interface CtxMenu { x: number; y: number; elementId: string | null; }

// ============================================================
// FONT PICKER MODAL (compact)
// ============================================================
function FontPickerModal({ current, onSelect, onClose }: { current?: string; onSelect: (f: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const categories = [...new Set(FONT_CATALOG.map(f => f.category))];
  const filtered = FONT_CATALOG.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.label.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => { filtered.forEach(f => ensureFontLoaded(f.name)); }, [search]);
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl w-[400px] max-h-[70vh] border border-white/10 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="p-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          <h2 className="font-bold text-sm">בחר גופן</h2>
        </div>
        <div className="p-2.5 border-b border-white/10 flex-shrink-0">
          <input className="w-full px-3 py-1.5 bg-slate-700 rounded-lg text-xs placeholder:text-slate-500 border border-white/10 focus:outline-none" placeholder="חפש גופן..." value={search} onChange={e => setSearch(e.target.value)} dir="rtl" />
        </div>
        <div className="flex-1 overflow-y-auto p-2.5">
          {categories.map(cat => {
            const catFonts = filtered.filter(f => f.category === cat);
            if (!catFonts.length) return null;
            return (
              <div key={cat} className="mb-3">
                <div className="text-[9px] font-bold text-slate-400 mb-1 uppercase">{cat}</div>
                <div className="space-y-0.5">
                  {catFonts.map(f => (
                    <button key={f.name} onClick={() => { onSelect(f.name); ensureFontLoaded(f.name); onClose(); }}
                      className={cn('w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-colors', current === f.name ? 'border-indigo-500 bg-indigo-500/15' : 'border-transparent hover:bg-white/8 hover:border-white/15')}>
                      <span className="text-slate-400 text-[9px]">{f.hebrewSupport ? '✓ עברית' : ''}</span>
                      <span style={{ fontFamily: f.name, fontSize: 14 }}>שלום Hello {f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHAPE PICKER MODAL
// ============================================================
function ShapePickerModal({ onSelect, onClose }: { onSelect: (s: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl w-[420px] max-h-[70vh] border border-white/10 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          <h2 className="font-bold text-base">בחר צורה</h2>
        </div>
        <div className="p-4 overflow-y-auto grid grid-cols-4 gap-3">
          {SHAPE_GALLERY.map(s => (
            <button key={s.id} title={s.label} onClick={() => { onSelect(s.id); onClose(); }}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/20 transition-colors group">
              <div className="w-10 h-10 flex items-center justify-center">
                <div style={{ ...getShapeStyle(s.id, '#818cf8', 0.85), width: 34, height: 34 }} />
              </div>
              <span className="text-[10px] text-slate-400 group-hover:text-white text-center">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LAYERS PANEL
// ============================================================
function LayersPanel({ page, selectedIds, onSelect, onDelete, onClose }: {
  page: DesignPage | undefined; selectedIds: string[]; onSelect: (id: string) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const typeLabel = (el: DesignElement) => {
    switch (el.type) {
      case 'text': return `✏️ ${(el.content || '').slice(0, 18)}`;
      case 'person_card': return `👤 כרטיס אדם`;
      case 'image': return `🖼 תמונה`;
      case 'shape': return `◼ צורה — ${el.style?.shapeType || 'rectangle'}`;
      case 'icon': return `😊 ${el.content || 'סמל'}`;
      case 'connection_line': return `↔ קו חיבור`;
      case 'photo_placeholder': return `📷 תמונה`;
      default: return el.type;
    }
  };
  const els = page ? [...page.elements].reverse() : [];
  return (
    <div className="absolute top-10 left-2 w-56 bg-slate-800 border border-white/15 rounded-xl shadow-2xl z-50 flex flex-col max-h-96 overflow-hidden" dir="rtl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 flex-shrink-0">
        <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">✕</button>
        <span className="text-xs font-bold">שכבות עמוד ({els.length})</span>
      </div>
      <div className="overflow-y-auto flex-1">
        {els.length === 0 && <div className="text-xs text-slate-500 text-center py-4">אין אלמנטים</div>}
        {els.map(el => (
          <div key={el.id} className={cn('flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-white/8 border-b border-white/5', selectedIds.includes(el.id) ? 'bg-indigo-500/20' : '')} onClick={() => onSelect(el.id)}>
            <button className="text-[10px] text-slate-400 hover:text-red-400 flex-shrink-0" onClick={e => { e.stopPropagation(); onDelete(el.id); }}>✕</button>
            <span className="text-[10px] truncate flex-1 text-right">{typeLabel(el)}</span>
            <span className="text-[9px] text-slate-500 flex-shrink-0">z:{el.zIndex || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// IMAGE PICKER MODAL
// ============================================================
function ImagePickerModal({ treeId, onSelect, onClose }: { treeId: string; onSelect: (url: string) => void; onClose: () => void; }) {
  const [tab, setTab] = useState<'upload' | 'files'>('upload');
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl w-80 max-h-[70vh] border border-white/10 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between p-3 border-b border-white/10 flex-shrink-0">
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          <h3 className="font-bold text-sm">הוסף תמונה</h3>
        </div>
        <div className="flex border-b border-white/10 flex-shrink-0">
          <button onClick={() => setTab('upload')} className={cn('flex-1 text-xs py-2', tab === 'upload' ? 'text-white border-b-2 border-indigo-400' : 'text-slate-400')}>העלה מהמכשיר</button>
          <button onClick={() => setTab('files')} className={cn('flex-1 text-xs py-2', tab === 'files' ? 'text-white border-b-2 border-indigo-400' : 'text-slate-400')}>תמונות המשפחה</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {tab === 'upload' && (
            <label className="cursor-pointer flex flex-col items-center gap-2 p-6 border-2 border-dashed border-white/20 rounded-xl hover:border-indigo-400 transition-colors">
              <ImageIcon className="w-8 h-8 text-slate-400" />
              <span className="text-xs text-slate-400 text-center">לחץ לבחירת קובץ תמונה</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => { onSelect(ev.target?.result as string); onClose(); };
                reader.readAsDataURL(file);
              }} />
            </label>
          )}
          {tab === 'files' && <MyFilesImageGrid treeId={treeId} onSelectImage={url => { onSelect(url); onClose(); }} />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RESIZE HANDLES — corners (aspect-ratio) + sides (crop)
// ============================================================
const HANDLES = [
  { id: 'nw', cursor: 'nw-resize', style: { top: -5, right: -5 }, isCorner: true },
  { id: 'ne', cursor: 'ne-resize', style: { top: -5, left: -5 }, isCorner: true },
  { id: 'sw', cursor: 'sw-resize', style: { bottom: -5, right: -5 }, isCorner: true },
  { id: 'se', cursor: 'se-resize', style: { bottom: -5, left: -5 }, isCorner: true },
  { id: 'n', cursor: 'n-resize', style: { top: -5, left: '50%', transform: 'translateX(-50%)' }, isCorner: false },
  { id: 's', cursor: 's-resize', style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' }, isCorner: false },
  { id: 'e', cursor: 'e-resize', style: { right: -5, top: '50%', transform: 'translateY(-50%)' }, isCorner: false },
  { id: 'w', cursor: 'w-resize', style: { left: -5, top: '50%', transform: 'translateY(-50%)' }, isCorner: false },
];

// ============================================================
// THUMBNAIL CONTEXT MENU
// ============================================================
const ThumbnailContextMenu = ({ menu, onClose, onMove, onDuplicate, onAdd, onDelete }: {
  menu: { x: number; y: number; index: number }; onClose: () => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onDuplicate: (index: number) => void;
  onAdd: (index: number, position: 'before' | 'after') => void;
  onDelete: (index: number) => void;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const items = [
    { label: 'הזז למעלה', icon: <ArrowUp className="w-3.5 h-3.5" />, action: () => onMove(menu.index, 'up') },
    { label: 'הזז למטה', icon: <ArrowDownIcon className="w-3.5 h-3.5" />, action: () => onMove(menu.index, 'down') },
    { separator: true },
    { label: 'שכפל עמוד', icon: <CopyPlus className="w-3.5 h-3.5" />, action: () => onDuplicate(menu.index) },
    { label: 'הוסף עמוד לפני', icon: <FilePlus className="w-3.5 h-3.5" />, action: () => onAdd(menu.index, 'before') },
    { label: 'הוסף עמוד אחרי', icon: <FilePlus className="w-3.5 h-3.5" />, action: () => onAdd(menu.index, 'after') },
    { separator: true },
    { label: 'מחק עמוד', icon: <Trash2 className="w-3.5 h-3.5 text-red-400" />, action: () => onDelete(menu.index), className: 'text-red-400' },
  ];

  return (
    <div ref={menuRef} className="fixed bg-slate-800 border border-white/15 rounded-xl shadow-2xl py-1 z-[2000] min-w-[190px]"
      style={{ top: Math.min(menu.y, window.innerHeight - 180), left: menu.x }} dir="rtl" onClick={e => e.stopPropagation()}>
      {items.map((item, idx) => (
        item.separator ? <div key={idx} className="my-1 border-t border-white/10" /> : (
          <button key={idx} className={cn("w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2", (item as any).className)}
            onClick={() => { item.action!(); onClose(); }}>
            {item.icon} {item.label}
          </button>
        )
      ))}
    </div>
  );
};

// ============================================================
// UNDO/REDO HISTORY HOOK
// ============================================================
function useHistory<T>(initial: T) {
  const [history, setHistory] = useState<T[]>([initial]);
  const [index, setIndex] = useState(0);
  const current = history[index];

  const push = useCallback((newState: T) => {
    setHistory(h => {
      const truncated = h.slice(0, index + 1);
      const next = [...truncated, newState];
      // Cap at 50 states
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });
    setIndex(i => Math.min(i + 1, 49));
  }, [index]);

  const undo = useCallback(() => {
    setIndex(i => Math.max(0, i - 1));
  }, []);

  const redo = useCallback(() => {
    setIndex(i => Math.min(history.length - 1, i + 1));
  }, [history.length]);

  const canUndo = index > 0;
  const canRedo = index < history.length - 1;

  return { current, push, undo, redo, canUndo, canRedo };
}

// ============================================================
// MAIN EDITOR
// ============================================================
export function RootsDesignEditor({
  project, people, relationships, onBack, onUpdateProject, onCurrentPageChange,
}: {
  project: RootsProject; people: Person[]; relationships: Relationship[];
  onBack: () => void; onUpdateProject: (updater: (p: RootsProject) => RootsProject) => void;
  onCurrentPageChange?: (page: DesignPage) => void;
}) {
  const initialPages = project.projectData?.designData?.pages || [];
  const { current: pages, push: pushHistory, undo, redo, canUndo, canRedo } = useHistory<DesignPage[]>(initialPages);
  const [localPages, setLocalPages] = useState<DesignPage[]>(initialPages);
  const [isGenerating, setIsGenerating] = useState(!project.projectData?.designData?.pages?.length);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'shape' | 'person' | 'image' | 'icon' | 'line'>('select');
  const [selectedTemplateId, setSelectedTemplateId] = useState(project.projectData?.designData?.templateId || 'template_cosmic');
  const [globalTextSizeOffset, setGlobalTextSizeOffset] = useState(0); // +/- offset from template defaults
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [canvasAspectRatio, setCanvasAspectRatio] = useState<CanvasAspectRatio>('a4-landscape');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imagePlaceholderTarget, setImagePlaceholderTarget] = useState<string | null>(null);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiInput, setEmojiInput] = useState('');
  const [applyTemplateToAll, setApplyTemplateToAll] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [cardFieldPanel, setCardFieldPanel] = useState<{ elementId: string; personId: string } | null>(null);
  const [gradientFrom, setGradientFrom] = useState('#0a0015');
  const [gradientTo, setGradientTo] = useState('#000d1a');
  const [bgMode, setBgMode] = useState<'solid' | 'gradient'>('gradient');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [activeShapeType, setActiveShapeType] = useState<string>('rectangle');
  const [showLayers, setShowLayers] = useState(false);
  const [pageToDeleteIndex, setPageToDeleteIndex] = useState<number | null>(null);
  const [thumbnailCtxMenu, setThumbnailCtxMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  // Line drawing state
  const [lineDrawing, setLineDrawing] = useState<{ fromElementId: string } | null>(null);
  // Line style for new connections
  const [activeLineType, setActiveLineType] = useState<string>('straight');
  // TOC outdated indicator
  const [tocOutdated, setTocOutdated] = useState(false);

  useEffect(() => { DESIGN_TEMPLATES.forEach(t => ensureFontLoaded(t.titleFont)); }, []);

  const { toast } = useToast();
  const isDragging = useRef(false);
  const dragIds = useRef<string[]>([]);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, elements: [] as Array<{ id: string; x: number; y: number }> });
  const canvasRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeHandle = useRef<string | null>(null);
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, elX: 0, elY: 0, elW: 0, elH: 0, aspectRatio: 1, isCorner: false });
  const pagesRef = useRef<DesignPage[]>(localPages);
  const hasGeneratedRef = useRef(false);
  useEffect(() => { pagesRef.current = localPages; }, [localPages]);

  // Sync history current → localPages
  useEffect(() => { setLocalPages(pages); }, [pages]);
  
  const currentPage = localPages[currentPageIndex];

  useEffect(() => {
    if (currentPage && onCurrentPageChange) {
      onCurrentPageChange(currentPage);
    }
  }, [currentPage, onCurrentPageChange]);

  // ── Init ──
  useEffect(() => {
    const existing = project.projectData?.designData?.pages;
    if (!existing || existing.length === 0) {
      hasGeneratedRef.current = true;
      const generated = generatePagesFromProject(project, people, relationships, 'template_cosmic');
      setLocalPages(generated);
      setIsGenerating(false);
      onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { pages: generated } } }));
    } else { setIsGenerating(false); }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (hasGeneratedRef.current) return;
    setLocalPages(project.projectData?.designData?.pages || []);
  }, [project.projectData?.designData?.pages]);

  // ── Keyboard ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const isInput = document.activeElement && ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement).tagName);
      if (isInput && editingElementId) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length && !editingElementId) {
        e.preventDefault(); selectedIds.forEach(id => deleteElementById(id)); setSelectedIds([]);
      }
      if (e.key === 'Escape') { setSelectedIds([]); setEditingElementId(null); setActiveTool('select'); setCtxMenu(null); setLineDrawing(null); }
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); }
      if (((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey)) || ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey)) { e.preventDefault(); redo(); }
      if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey) && selectedIds.length === 1) {
        const el = pagesRef.current[currentPageIndex]?.elements.find(e2 => e2.id === selectedIds[0]);
        if (el) { _clipboard = el; toast({ title: 'הועתק ✓' }); }
      }
      if ((e.key === 'x' || e.key === 'X') && (e.ctrlKey || e.metaKey) && selectedIds.length === 1) {
        const el = pagesRef.current[currentPageIndex]?.elements.find(e2 => e2.id === selectedIds[0]);
        if (el) { _clipboard = el; deleteElementById(el.id); setSelectedIds([]); toast({ title: 'נגזר ✓' }); }
      }
      if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey) && _clipboard) {
        e.preventDefault();
        const { id: _id, ...rest } = _clipboard;
        addElementDirect({ ...rest, id: uuidv4(), x: Math.min((_clipboard.x || 0) + 3, 70), y: Math.min((_clipboard.y || 0) + 3, 70) });
        toast({ title: 'הודבק ✓' });
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedIds.length) { e.preventDefault(); selectedIds.forEach(id => duplicateElementById(id)); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [selectedIds, editingElementId, currentPageIndex, undo, redo]); // eslint-disable-line

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-ctx-menu]')) setCtxMenu(null); };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  // ── Derived ──
  const template = DESIGN_TEMPLATES.find(t => t.id === (currentPage?.templateId || selectedTemplateId)) || DESIGN_TEMPLATES[0];
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedElement = selectedId ? currentPage?.elements.find(el => el.id === selectedId) : undefined;

  // ── Mutations — always commit to history ──
  const commitPages = useCallback((newPages: DesignPage[]) => {
    const clean = JSON.parse(JSON.stringify(newPages, (_, v) => v === undefined ? null : v));
    setLocalPages(clean);
    pushHistory(clean);
    onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { ...proj.projectData?.designData, pages: clean } } }));
  }, [pushHistory, onUpdateProject]);

  // Local-only update (during drag/resize — don't spam history)
  const updateLocalOnly = useCallback((updater: (ps: DesignPage[]) => DesignPage[]) => {
    setLocalPages(ps => {
      const result = updater(ps);
      pagesRef.current = result;
      return result;
    });
  }, []);

  // Commit at end of drag/resize
  const commitLocalToHistory = useCallback(() => {
    const clean = JSON.parse(JSON.stringify(pagesRef.current, (_, v) => v === undefined ? null : v));
    pushHistory(clean);
    onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { ...proj.projectData?.designData, pages: clean } } }));
  }, [pushHistory, onUpdateProject]);

  const updatePages = useCallback((updater: (p: DesignPage[]) => DesignPage[]) => {
    commitPages(updater(pagesRef.current));
  }, [commitPages]);

  const updateCurrentPage = useCallback((updater: (p: DesignPage) => DesignPage) => {
    updatePages(ps => { const np = [...ps]; if (np[currentPageIndex]) np[currentPageIndex] = updater(np[currentPageIndex]); return np; });
  }, [updatePages, currentPageIndex]);

  const updateElementLocal = useCallback((id: string, updates: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) => {
    updateLocalOnly(ps => {
      const np = [...ps];
      if (!np[currentPageIndex]) return ps;
      np[currentPageIndex] = { ...np[currentPageIndex], elements: np[currentPageIndex].elements.map(el => { if (el.id !== id) return el; const u = typeof updates === 'function' ? updates(el) : updates; return { ...el, ...u }; }) };
      return np;
    });
  }, [updateLocalOnly, currentPageIndex]);

  const updateElement = useCallback((id: string, updates: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) => {
    updatePages(ps => {
      const np = [...ps];
      if (!np[currentPageIndex]) return ps;
      np[currentPageIndex] = { ...np[currentPageIndex], elements: np[currentPageIndex].elements.map(el => { if (el.id !== id) return el; const u = typeof updates === 'function' ? updates(el) : updates; return { ...el, ...u }; }) };
      return np;
    });
  }, [updatePages, currentPageIndex]);

  const updateMultipleElements = useCallback((ids: string[], updater: (el: DesignElement) => Partial<DesignElement>) => {
    updatePages(ps => {
      const np = [...ps];
      if (!np[currentPageIndex]) return ps;
      np[currentPageIndex] = { ...np[currentPageIndex], elements: np[currentPageIndex].elements.map(el => !ids.includes(el.id) ? el : { ...el, ...updater(el) }) };
      return np;
    });
  }, [updatePages, currentPageIndex]);

  const addElementDirect = useCallback((newEl: DesignElement) => {
    updatePages(ps => { const np = [...ps]; if (np[currentPageIndex]) np[currentPageIndex] = { ...np[currentPageIndex], elements: [...np[currentPageIndex].elements, newEl] }; return np; });
    setSelectedIds([newEl.id]);
  }, [updatePages, currentPageIndex]);

  const addElement = useCallback((element: Omit<DesignElement, 'id'>) => { addElementDirect({ ...element, id: uuidv4() }); }, [addElementDirect]);

  const deleteElementById = useCallback((id: string) => {
    updatePages(ps => { const np = [...ps]; if (np[currentPageIndex]) np[currentPageIndex] = { ...np[currentPageIndex], elements: np[currentPageIndex].elements.filter(el => el.id !== id) }; return np; });
  }, [updatePages, currentPageIndex]);

  const duplicateElementById = useCallback((id: string) => {
    const el = pagesRef.current[currentPageIndex]?.elements.find(e => e.id === id);
    if (!el) return;
    const { id: _id, ...rest } = el;
    addElement({ ...rest, x: Math.min(el.x + 3, 70), y: Math.min(el.y + 3, 70) });
  }, [addElement, currentPageIndex]);

  // ── TOC auto-regeneration ──
  // Whenever pages change (add/delete/reorder), rebuild the TOC
  const rebuildToc = useCallback((ps: DesignPage[]) => {
    const tocIdx = ps.findIndex(p => p.title === 'תוכן עניינים' && p.pageType === 'custom');
    if (tocIdx === -1) return ps;
    const cp2 = project.projectData?.coverPage || {};
    const student2 = people.find(p2 => p2.id === project.studentPersonId);
    const sName = student2 ? `${student2.firstName} ${student2.lastName}` : cp2.studentName || '';
    const sYear = cp2.grade || new Date().getFullYear().toString();
    const sHebrew = cp2.hebrewYear || '';
    const tmpl2 = DESIGN_TEMPLATES.find(t => t.id === (ps[tocIdx]?.templateId || selectedTemplateId)) || DESIGN_TEMPLATES[0];
    const newTocEls = buildTocElements(ps, tmpl2, sName, sYear, sHebrew, ps[tocIdx].pageNumber);
    const updated = [...ps];
    updated[tocIdx] = { ...updated[tocIdx], elements: newTocEls };
    return updated;
  }, [project, people, selectedTemplateId]);

  const handleSyncToc = useCallback(() => {
    // Step 1: renumber all pages sequentially
    const renumbered = pagesRef.current.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    // Step 2: rebuild TOC with correct numbers
    const synced = rebuildToc(renumbered);
    commitPages(synced);
    setTocOutdated(false);
    toast({ title: '✓ תוכן העניינים עודכן ומוספרו מחדש' });
  }, [rebuildToc, commitPages, toast]);

  const handleMovePage = useCallback((index: number, direction: 'up' | 'down') => {
    const newPages = [...pagesRef.current];
    if (direction === 'up' && index > 0) {
      [newPages[index], newPages[index - 1]] = [newPages[index - 1], newPages[index]];
      setCurrentPageIndex(index - 1);
    } else if (direction === 'down' && index < newPages.length - 1) {
      [newPages[index], newPages[index + 1]] = [newPages[index + 1], newPages[index]];
      setCurrentPageIndex(index + 1);
    }
    const renumbered = newPages.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    commitPages(rebuildToc(renumbered));
    setTocOutdated(true);
  }, [commitPages, rebuildToc]);

  const handleDuplicatePage = useCallback((index: number) => {
    const pageToDuplicate = pagesRef.current[index];
    const newPage: DesignPage = { ...JSON.parse(JSON.stringify(pageToDuplicate)), id: uuidv4() };
    const newPages = [...pagesRef.current.slice(0, index + 1), newPage, ...pagesRef.current.slice(index + 1)];
    const renumbered = newPages.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    commitPages(rebuildToc(renumbered));
    setCurrentPageIndex(index + 1);
    setTocOutdated(true);
    toast({ title: 'עמוד שוכפל' });
  }, [commitPages, rebuildToc, toast]);

  const handleAddNewPage = useCallback((index: number, position: 'before' | 'after') => {
    const newPage: DesignPage = {
      id: uuidv4(), pageNumber: 0, pageType: 'custom', title: 'עמוד חדש',
      elements: [], templateId: currentPage?.templateId || selectedTemplateId,
    };
    const newIndex = position === 'before' ? index : index + 1;
    const newPages = [...pagesRef.current.slice(0, newIndex), newPage, ...pagesRef.current.slice(newIndex)];
    const renumbered = newPages.map((p, i) => ({ ...p, pageNumber: i + 1 }));
    commitPages(rebuildToc(renumbered));
    setCurrentPageIndex(newIndex);
    setTocOutdated(true);
  }, [commitPages, rebuildToc, currentPage, selectedTemplateId]);

  const handleDeletePageRequest = useCallback((index: number) => { setPageToDeleteIndex(index); }, []);

  const confirmDeletePage = useCallback(() => {
    if (pageToDeleteIndex === null) return;
    const newPages = pagesRef.current.filter((_, i) => i !== pageToDeleteIndex).map((p, i) => ({ ...p, pageNumber: i + 1 }));
    commitPages(rebuildToc(newPages));
    setCurrentPageIndex(prev => Math.max(0, Math.min(prev, newPages.length - 1)));
    setSelectedIds([]);
    setPageToDeleteIndex(null);
    setTocOutdated(true);
    toast({ title: 'העמוד נמחק' });
  }, [pageToDeleteIndex, commitPages, rebuildToc, toast]);

  const handleResetPages = useCallback(() => {
    hasGeneratedRef.current = true;
    const generated = generatePagesFromProject(project, people, relationships, selectedTemplateId);
    commitPages(generated);
    setCurrentPageIndex(0); setSelectedIds([]);
    setShowResetConfirm(false);
    toast({ title: `✨ ההצגה נוצרה מחדש — ${generated.length} עמודים` });
  }, [project, people, relationships, selectedTemplateId, commitPages, toast]);

  // ── Apply global text size offset to all pages ──
  const applyGlobalTextSize = useCallback((offset: number) => {
    const newPages = pagesRef.current.map(pg => ({
      ...pg,
      elements: pg.elements.map(el => {
        if (el.type !== 'text' || !el.style?.fontSize) return el;
        // Store original if not already stored, then apply offset
        const originalSize = (el as any)._originalFontSize || el.style.fontSize;
        const newSize = Math.max(8, Math.min(120, originalSize + offset));
        return { ...el, _originalFontSize: originalSize, style: { ...el.style, fontSize: newSize } };
      }),
    }));
    commitPages(newPages);
  }, [commitPages]);

  // ── Drag ──
  const handleMouseDown = (e: React.MouseEvent, el: DesignElement) => {
    if (editingElementId || activeTool !== 'select' || !canvasRef.current) return;
    e.stopPropagation();

    // Line drawing mode: clicking a card sets it as connection target
    if (activeTool === 'line' as any) {
      if (lineDrawing) {
        if (el.id !== lineDrawing.fromElementId) {
          addElement({
            type: 'connection_line',
            fromElementId: lineDrawing.fromElementId,
            toElementId: el.id,
            x: 0, y: 0, width: 0, height: 0, zIndex: 2,
            style: { color: template.primaryColor, borderWidth: 2, lineType: activeLineType } as any,
          });
          setLineDrawing(null);
          setActiveTool('select');
        }
      } else {
        setLineDrawing({ fromElementId: el.id });
        toast({ title: `מ: ${el.type === 'person_card' ? 'כרטיס' : el.id.slice(0,6)} — לחץ על רכיב יעד` });
      }
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      const toggled = selectedIds.includes(el.id) ? selectedIds.filter(id => id !== el.id) : [...selectedIds, el.id];
      setSelectedIds(toggled);
      isDragging.current = true;
      dragIds.current = toggled.length ? toggled : [el.id];
      dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, elements: dragIds.current.map(id => { const f = pagesRef.current[currentPageIndex]?.elements.find(e2 => e2.id === id); return { id, x: f?.x ?? 0, y: f?.y ?? 0 }; }) };
      return;
    }
    const dragSet = (selectedIds.includes(el.id) && selectedIds.length > 1) ? selectedIds : [el.id];
    if (!selectedIds.includes(el.id)) setSelectedIds([el.id]);
    isDragging.current = true;
    dragIds.current = dragSet;
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, elements: dragSet.map(id => { const f = pagesRef.current[currentPageIndex]?.elements.find(e2 => e2.id === id); return { id, x: f?.x ?? 0, y: f?.y ?? 0 }; }) };
  };

  const handleResizeMouseDown = (e: React.MouseEvent, el: DesignElement, handle: string) => {
    e.stopPropagation(); e.preventDefault();
    const isCorner = handle.length === 2;
    isResizing.current = true;
    resizeHandle.current = handle;
    resizeStart.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      elX: el.x, elY: el.y, elW: el.width, elH: el.height,
      aspectRatio: el.width / Math.max(1, el.height),
      isCorner,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (isResizing.current && resizeHandle.current && selectedId) {
      const dx = ((e.clientX - resizeStart.current.mouseX) / rect.width) * 100;
      const dy = ((e.clientY - resizeStart.current.mouseY) / rect.height) * 100;
      const h = resizeHandle.current;
      const { isCorner, elX, elY, elW, elH, aspectRatio } = resizeStart.current;

      updateElementLocal(selectedId, () => {
        let nx = elX, ny = elY, nw = elW, nh = elH;

        if (isCorner) {
          // Corner: scale proportionally (lock aspect ratio)
          if (h === 'se') { nw = Math.max(5, elW + dx); nh = nw / aspectRatio; }
          else if (h === 'sw') { nw = Math.max(5, elW - dx); nh = nw / aspectRatio; nx = elX + (elW - nw); }
          else if (h === 'ne') { nw = Math.max(5, elW + dx); nh = nw / aspectRatio; ny = elY + (elH - nh); }
          else if (h === 'nw') { nw = Math.max(5, elW - dx); nh = nw / aspectRatio; nx = elX + (elW - nw); ny = elY + (elH - nh); }
        } else {
          // Side: crop only, no aspect ratio change
          if (h === 'e') nw = Math.max(5, elW + dx);
          else if (h === 's') nh = Math.max(3, elH + dy);
          else if (h === 'w') { nw = Math.max(5, elW - dx); nx = elX + dx; }
          else if (h === 'n') { nh = Math.max(3, elH - dy); ny = elY + dy; }
        }

        return {
          x: Math.max(0, nx),
          y: Math.max(0, ny),
          width: Math.min(nw, 100 - Math.max(0, nx)),
          height: Math.min(nh, 100 - Math.max(0, ny)),
        };
      });
      return;
    }

    if (!isDragging.current || !dragIds.current.length) return;
    const dx = ((e.clientX - dragStart.current.mouseX) / rect.width) * 100;
    const dy = ((e.clientY - dragStart.current.mouseY) / rect.height) * 100;
    dragStart.current.elements.forEach(({ id, x, y }) => {
      const el = pagesRef.current[currentPageIndex]?.elements.find(e2 => e2.id === id);
      if (!el) return;
      updateElementLocal(id, () => ({ x: Math.max(0, Math.min(100 - el.width, x + dx)), y: Math.max(0, Math.min(100 - el.height, y + dy)) }));
    });
  };

  const handleMouseUp = () => {
    const wasActive = isDragging.current || isResizing.current;
    isDragging.current = false; dragIds.current = [];
    isResizing.current = false; resizeHandle.current = null;
    if (wasActive) commitLocalToHistory();
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id !== 'canvas-container') return;
    if (activeTool === 'text') {
      addElement({ type: 'text', content: 'טקסט חדש', x: (e.nativeEvent.offsetX / target.offsetWidth) * 100, y: (e.nativeEvent.offsetY / target.offsetHeight) * 100, width: 20, height: 6, style: { fontSize: 20, color: template.textColor, fontFamily: template.bodyFont } });
      setActiveTool('select');
    } else if (activeTool === 'shape') {
      addElement({ type: 'shape', x: (e.nativeEvent.offsetX / target.offsetWidth) * 100 - 10, y: (e.nativeEvent.offsetY / target.offsetHeight) * 100 - 10, width: 20, height: 20, style: { shapeType: activeShapeType as ShapeType, backgroundColor: template.primaryColor, opacity: 0.85 } });
      setActiveTool('select');
    } else if (activeTool === 'line') {
      toast({ title: 'בחר רכיב להתחלת הקו' });
    } else {
      setSelectedIds([]); setEditingElementId(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, elementId: string | null) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, elementId });
    if (elementId && !selectedIds.includes(elementId)) setSelectedIds([elementId]);
  };

  const getCanvasStyle = (): React.CSSProperties => {
    const ratios: Record<string, number> = { 'a4-landscape': 1.414, 'a4-portrait': 1 / 1.414, '16:9-landscape': 16 / 9, '9/16': 9 / 16, '1:1': 1, 'free': 1.414 };
    const r = ratios[canvasAspectRatio] ?? 1.414;
    return r >= 1 ? { width: '100%', maxWidth: '100%', aspectRatio: `${r}`, height: 'auto', maxHeight: '100%' } : { height: '100%', maxHeight: '100%', aspectRatio: `${r}`, width: 'auto', maxWidth: '100%' };
  };

  const getPageBackground = (page: DesignPage | undefined, tmpl: DesignTemplate) => {
    if (!page) return { background: tmpl.backgroundGradient };
    const pp = page as any;
    if (pp.backgroundImage) return { backgroundImage: `url(${pp.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    if (page.backgroundColor) return { backgroundColor: page.backgroundColor };
    return { background: page.backgroundGradient || tmpl.backgroundGradient };
  };

  const copyElement = (id: string) => { const el = currentPage?.elements.find(e => e.id === id); if (el) { _clipboard = el; toast({ title: 'הועתק ✓' }); } };
  const cutElement = (id: string) => { const el = currentPage?.elements.find(e => e.id === id); if (el) { _clipboard = el; deleteElementById(id); setSelectedIds([]); toast({ title: 'נגזר ✓' }); } };
  const pasteElement = () => { if (!_clipboard) return; const { id: _id, ...rest } = _clipboard; addElementDirect({ ...rest, id: uuidv4(), x: Math.min((_clipboard.x || 0) + 3, 70), y: Math.min((_clipboard.y || 0) + 3, 70) }); toast({ title: 'הודבק ✓' }); };
  const resetSize = (id: string) => { updateElement(id, { width: 30, height: 30 }); toast({ title: 'גודל אופס' }); };

  const openImagePickerForPlaceholder = (elementId: string) => {
    setImagePlaceholderTarget(elementId);
    setShowImagePicker(true);
  };

  const handleImageSelected = (url: string) => {
    if (imagePlaceholderTarget) {
      const el = currentPage?.elements.find(e => e.id === imagePlaceholderTarget);
      if (el) updateElement(imagePlaceholderTarget, { type: 'image', content: url, style: { ...el.style, borderRadius: el.style?.borderRadius || 8 } });
      setImagePlaceholderTarget(null);
    } else {
      addElement({ type: 'image', content: url, x: 10, y: 10, width: 40, height: 30, zIndex: 5, style: { borderRadius: 0, opacity: 1 } });
    }
    setShowImagePicker(false);
    setActiveTool('select');
  };

  // ── SVG Connection Line Renderer ──
  const renderConnectionLine = (el: DesignElement, from: DesignElement, to: DesignElement, isSel: boolean) => {
    const x1p = from.x + from.width / 2;
    const y1p = from.y + from.height;
    const x2p = to.x + to.width / 2;
    const y2p = to.y;
    // Use element's own lineType style, falling back to 'straight'
    const lineType = (el.style as any)?.lineType || 'straight';
    const color = isSel ? '#60a5fa' : (el.style?.color || template.primaryColor);
    const sw = isSel ? (el.style?.borderWidth || 2) + 1 : (el.style?.borderWidth || 2);

    let dashArray: string | undefined;
    if (lineType === 'dashed') dashArray = '8 4';
    else if (lineType === 'dotted') dashArray = '2 6';

    const clickProps = {
      onClick: (e2: React.MouseEvent) => { e2.stopPropagation(); setSelectedIds([el.id]); },
      onContextMenu: (e2: React.MouseEvent) => handleContextMenu(e2, el.id),
      style: { cursor: 'pointer', pointerEvents: 'stroke' as any },
    };

    if (lineType === 'pcb') {
      const midY = (y1p + y2p) / 2;
      const d = `M ${x1p}% ${y1p}% L ${x1p}% ${midY}% L ${x2p}% ${midY}% L ${x2p}% ${y2p}%`;
      return (
        <g key={el.id}>
          <path d={d} stroke="transparent" strokeWidth="12" fill="none" {...clickProps} />
          <path d={d} stroke={color} strokeWidth={sw} fill="none" markerEnd="url(#arrow)" />
        </g>
      );
    }

    if (lineType === 'wavy') {
      // Cubic bezier for smooth wave
      const cx1 = x1p;
      const cy1 = (y1p + y2p) / 2;
      const cx2 = x2p;
      const cy2 = (y1p + y2p) / 2;
      const d = `M ${x1p}% ${y1p}% C ${cx1}% ${cy1}% ${cx2}% ${cy2}% ${x2p}% ${y2p}%`;
      return (
        <g key={el.id}>
          <path d={d} stroke="transparent" strokeWidth="12" fill="none" {...clickProps} />
          <path d={d} stroke={color} strokeWidth={sw} fill="none" markerEnd="url(#arrow)" />
        </g>
      );
    }

    // Straight / dashed / dotted
    return (
      <g key={el.id}>
        <line x1={`${x1p}%`} y1={`${y1p}%`} x2={`${x2p}%`} y2={`${y2p}%`} stroke="transparent" strokeWidth="12" {...clickProps} />
        <line x1={`${x1p}%`} y1={`${y1p}%`} x2={`${x2p}%`} y2={`${y2p}%`} stroke={color} strokeWidth={sw} strokeDasharray={dashArray} markerEnd="url(#arrow)" />
      </g>
    );
  };

  if (isGenerating) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6" style={{ background: DESIGN_TEMPLATES[0].backgroundGradient }}>
      <div className="text-6xl animate-bounce">✨</div>
      <h2 className="text-2xl font-extrabold text-white">בונה את עבודת השורשים שלך...</h2>
      <p className="text-slate-400">מנתח את כל המידע שאספת</p>
    </div>
  );

  if (localPages.length === 0) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6" style={{ background: DESIGN_TEMPLATES[0].backgroundGradient }}>
      <div className="text-6xl">📄</div>
      <h2 className="text-2xl font-extrabold text-white">אין עמודים</h2>
      <div className="flex gap-3">
        <button className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm" onClick={handleResetPages}>✨ צור עמודים אוטומטית</button>
        <button className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm" onClick={() => handleAddNewPage(localPages.length, 'after')}>+ עמוד ריק</button>
        <button className="px-6 py-3 rounded-xl bg-transparent border border-white/20 text-white text-sm" onClick={onBack}>← חזור</button>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={500}>
      <div className="flex flex-col w-full h-full bg-slate-900 text-white select-none overflow-hidden" dir="rtl">

        {/* ══ HEADER ══ */}
        <header className="h-11 border-b border-white/10 bg-slate-900/95 backdrop-blur flex items-center justify-between px-3 gap-2 flex-shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>חזור לאשף עבודת השורשים</p></TooltipContent></Tooltip>
            <span className="text-sm font-bold truncate hidden sm:block">עורך העיצוב</span>
          </div>

          {/* Aspect ratio */}
          <div className="flex items-center flex-shrink-0">
            <DropdownMenu>
              <Tooltip><TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-transparent border-white/20 flex-shrink-0">
                    {canvasAspectRatio === 'a4-landscape' ? 'A4 ←→' : canvasAspectRatio === 'a4-portrait' ? 'A4 ↕' : canvasAspectRatio === '16:9-landscape' ? '16:9' : canvasAspectRatio === '9/16' ? '9:16' : '1:1'}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger><TooltipContent side="bottom"><p>שנה יחס מידות הדף</p></TooltipContent></Tooltip>
              <DropdownMenuContent>
                <DropdownMenuRadioGroup value={canvasAspectRatio} onValueChange={v => setCanvasAspectRatio(v as CanvasAspectRatio)}>
                  <DropdownMenuRadioItem value="a4-landscape">A4 לרוחב ←→</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="a4-portrait">A4 לגובה ↕</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="16:9-landscape">16:9 מצגת</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="9/16">9:16 סטורי</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="1:1">ריבוע 1:1</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {tocOutdated && <button onClick={handleSyncToc} className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full h-5 px-2 animate-pulse hover:animate-none hover:bg-yellow-500/30">סנכרן תוכן עניינים</button>}
          </div>

          {/* Center tools */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-transparent border-white/20" onClick={() => setShowTemplatePicker(true)}>🎨 תבנית</Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>בחר תבנית עיצוב</p></TooltipContent></Tooltip>
            <div className="h-4 w-px bg-white/10 mx-1" />
            {([
              ['select', <MousePointer2 key="s" className="h-3.5 w-3.5" />, 'כלי בחירה'],
              ['text', <Type key="t" className="h-3.5 w-3.5" />, 'הוסף תיבת טקסט'],
              ['shape', <Square key="sh" className="h-3.5 w-3.5" />, 'הוסף צורה גיאומטרית'],
              ['person', <User key="p" className="h-3.5 w-3.5" />, 'הוסף כרטיס אדם'],
              ['image', <ImageIcon key="i" className="h-3.5 w-3.5" />, 'הוסף תמונה'],
              ['icon', <Smile key="ic" className="h-3.5 w-3.5" />, 'הוסף אמוג׳י'],
              ['line', <Spline key="ln" className="h-3.5 w-3.5" />, 'צייר קו חיבור בין רכיבים'],
            ] as const).map(([tool, icon, tip]) => (
              <Tooltip key={tool}><TooltipTrigger asChild>
                <Button
                  variant={activeTool === tool ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7"
                  onClick={() => {
                    if (tool === 'shape') { setShowShapePicker(true); setActiveTool('shape'); }
                    else if (tool === 'person') { setActiveTool('person'); setShowPersonPicker(true); }
                    else if (tool === 'image') { setActiveTool('image'); setImagePlaceholderTarget(null); setShowImagePicker(true); }
                    else if (tool === 'icon') { setActiveTool('icon'); setShowEmojiPicker(true); }
                    else if (tool === 'line') { setActiveTool('line'); setLineDrawing(null); toast({ title: 'כלי קו — לחץ על רכיב מקור, ואז על רכיב יעד' }); }
                    else setActiveTool(tool as any);
                  }}>
                  {icon}
                </Button>
              </TooltipTrigger><TooltipContent side="bottom"><p>{tip}</p></TooltipContent></Tooltip>
            ))}
            <div className="h-4 w-px bg-white/10 mx-1" />
            {/* Line style for line tool */}
            {activeTool === 'line' && (
              <div className="flex gap-0.5 flex-shrink-0">
                {LINE_TYPES.map(lt => (
                  <Tooltip key={lt.id}>
                    <TooltipTrigger asChild>
                      <button className={cn('text-[9px] px-1.5 py-1 rounded border flex-shrink-0', activeLineType === lt.id ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}
                        onClick={() => setActiveLineType(lt.id)}>
                        {lt.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top"><p>סוג קו: {lt.label}</p></TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
            {/* Layers button */}
            <Tooltip><TooltipTrigger asChild>
              <Button variant={showLayers ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" onClick={() => setShowLayers(!showLayers)}>
                <Layers className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>לוח שכבות</p></TooltipContent></Tooltip>
            {/* Undo/Redo */}
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={undo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5" /></Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>בטל (Ctrl+Z)</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={redo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5" /></Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>בצע שוב (Ctrl+Y)</p></TooltipContent></Tooltip>
          </div>

          {/* Left */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-transparent border-white/20 text-slate-300 hover:text-white" onClick={() => setShowResetConfirm(true)}>
                <RefreshCw className="h-3 w-3 ml-1" />צור מחדש
              </Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>מחק הכל ויצור מחדש מהנתונים שלך</p></TooltipContent></Tooltip>
            <DropdownMenu>
              <Tooltip><TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-500">ייצא ▾</Button>
                </DropdownMenuTrigger>
              </TooltipTrigger><TooltipContent side="bottom"><p>ייצא את ההצגה לקובץ</p></TooltipContent></Tooltip>
              <DropdownMenuContent>
                <DropdownMenuItem className="opacity-50" onClick={() => toast({ title: 'ייצוא PDF בקרוב! 🚀' })}>📄 PDF — בקרוב</DropdownMenuItem>
                <DropdownMenuItem className="opacity-50" onClick={() => toast({ title: 'ייצוא Word בקרוב! 🚀' })}>📝 Word — בקרוב</DropdownMenuItem>
                <DropdownMenuItem className="opacity-50" onClick={() => toast({ title: 'ייצוא PowerPoint בקרוב! 🚀' })}>📊 PowerPoint — בקרוב</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ══ MAIN ══ */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* Thumbnails */}
          <aside className="w-[120px] flex-shrink-0 border-r border-white/8 bg-slate-900/60 flex flex-col overflow-hidden" style={{ order: 1 }}>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
              {localPages.map((page, index) => {
                const pt = DESIGN_TEMPLATES.find(t => t.id === page.templateId) || template;
                return (
                  <div key={page.id}
                    className={cn('relative w-full rounded cursor-pointer border-2 group overflow-hidden transition-all', currentPageIndex === index ? 'border-indigo-500' : 'border-transparent hover:border-white/20')}
                    style={{ aspectRatio: canvasAspectRatio === 'a4-portrait' ? '1/1.414' : canvasAspectRatio === '9/16' ? '9/16' : canvasAspectRatio === '1:1' ? '1/1' : '1.414/1' }}
                    onClick={() => setCurrentPageIndex(index)}
                    onContextMenu={e => { e.preventDefault(); setThumbnailCtxMenu({ x: e.clientX, y: e.clientY, index }); }}>
                    <div className="absolute inset-0" style={getPageBackground(page, pt)} />
                    {page.elements.filter(el => el.type === 'text').slice(0, 3).map((el, i) => (
                      <div key={`t-${page.id}-${el.id}-${i}`} className="absolute overflow-hidden"
                        style={{ top: `${el.y}%`, left: `${el.x}%`, width: `${el.width}%`, fontSize: 3, color: pt.textColor, fontWeight: el.style?.fontWeight === 'extrabold' ? 800 : 400, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                        {(el.content || '').slice(0, 20)}
                      </div>
                    ))}
                    {page.elements.filter(el => ['person_card', 'shape', 'image'].includes(el.type)).map((el, i) => (
                      <div key={`e-${page.id}-${el.id}-${i}`} className="absolute rounded-sm"
                        style={{ top: `${el.y}%`, left: `${el.x}%`, width: `${el.width}%`, height: `${el.height}%`, backgroundColor: el.type === 'shape' ? (el.style?.backgroundColor || pt.primaryColor) : 'rgba(255,255,255,0.2)', backgroundImage: el.type === 'image' && el.content ? `url(${el.content})` : undefined, backgroundSize: 'cover', opacity: 0.8 }} />
                    ))}
                    <span className="absolute bottom-0.5 left-0.5 text-white/50 font-bold" style={{ fontSize: 5 }}>{page.pageNumber}</span>
                    <button className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 hover:bg-red-600"
                      style={{ fontSize: 8 }}
                      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                      onClick={e => { e.stopPropagation(); handleDeletePageRequest(index); }}>✕</button>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/8 p-1.5 space-y-1.5">
              <input className="w-full text-[10px] bg-slate-800 border border-white/10 rounded px-1.5 py-1 text-center text-white focus:outline-none focus:border-indigo-400"
                value={currentPage?.title || ''} onChange={e => updateCurrentPage(p => ({ ...p, title: e.target.value }))} dir="rtl" placeholder="שם עמוד" />
              <button onClick={() => handleAddNewPage(localPages.length, 'after')} className="w-full text-[10px] py-1 rounded border border-dashed border-white/20 text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors">+ עמוד חדש</button>
            </div>
          </aside>

          {/* Canvas */}
          <main className="flex-1 flex items-center justify-center bg-[#13131f] overflow-hidden relative"
            style={{ order: 0, cursor: activeTool === 'line' ? 'crosshair' : 'default' }}
            onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onContextMenu={e => handleContextMenu(e, null)}>

            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg,#333 25%,transparent 25%),linear-gradient(-45deg,#333 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#333 75%),linear-gradient(-45deg,transparent 75%,#333 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0' }} />

            {activeTool === 'line' && lineDrawing && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[11px] text-yellow-300 pointer-events-none z-10 bg-black/50 px-3 py-1 rounded-full">
                ✓ מקור נבחר — עכשיו לחץ על רכיב היעד. ESC לביטול.
              </div>
            )}
            {activeTool === 'line' && !lineDrawing && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[11px] text-indigo-300 pointer-events-none z-10 bg-black/50 px-3 py-1 rounded-full">
                לחץ על רכיב מקור לצייר קו חיבור
              </div>
            )}

            {/* Layers panel */}
            {showLayers && (
              <LayersPanel page={currentPage} selectedIds={selectedIds}
                onSelect={id => setSelectedIds([id])}
                onDelete={id => { deleteElementById(id); setSelectedIds(s => s.filter(x => x !== id)); }}
                onClose={() => setShowLayers(false)} />
            )}

            <div className="relative shadow-2xl" style={{ ...getCanvasStyle(), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div id="canvas-container" ref={canvasRef} className="w-full h-full relative overflow-hidden"
                style={getPageBackground(currentPage, template)} onClick={handleCanvasClick} onContextMenu={e => handleContextMenu(e, null)}>

                <TemplateDecorations template={template} />

                {/* SVG connection lines */}
                <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 2, pointerEvents: 'none' }}>
                  <defs>
                    <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <polygon points="0 0,8 3,0 6" fill={template.primaryColor} />
                    </marker>
                  </defs>
                  <g style={{ pointerEvents: 'all' }}>
                    {currentPage?.elements.filter(el => el.type === 'connection_line').map(el => {
                      const from = currentPage.elements.find(e => e.id === el.fromElementId);
                      const to = currentPage.elements.find(e => e.id === el.toElementId);
                      if (!from || !to) return null;
                      return renderConnectionLine(el, from, to, selectedIds.includes(el.id));
                    })}
                  </g>
                </svg>

                {/* Elements */}
                {currentPage?.elements.filter(el => el.type !== 'connection_line').map((el) => {
                  const isSel = selectedIds.includes(el.id);
                  return (
                    <div key={`el-${currentPageIndex}-${el.id}`}
                      className={cn('absolute', isSel ? 'outline outline-2 outline-blue-400 outline-offset-1' : '', activeTool === 'select' && !editingElementId ? 'cursor-grab active:cursor-grabbing' : '', activeTool === 'line' ? 'cursor-crosshair' : '')}
                      style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, height: `${el.height}%`, zIndex: (el.zIndex || 1) + 3 }}
                      onMouseDown={e => handleMouseDown(e, el)}
                      onContextMenu={e => handleContextMenu(e, el.id)}>

                      {/* Resize handles — corner vs side styled differently */}
                      {isSel && activeTool === 'select' && selectedIds.length === 1 && HANDLES.map(h => (
                        <div key={h.id} onMouseDown={ev => handleResizeMouseDown(ev, el, h.id)}
                          className={cn(
                            'absolute z-50 hover:scale-125 transition-transform',
                            h.isCorner
                              ? 'w-[10px] h-[10px] bg-white border-2 border-blue-500 rounded-sm'
                              : 'w-[8px] h-[8px] bg-blue-300 border border-blue-600 rounded-full'
                          )}
                          style={{ ...h.style, cursor: h.cursor, position: 'absolute' }} />
                      ))}
                      {isSel && selectedIds.length > 1 && (
                        <div className="absolute inset-0 border-2 border-blue-300 border-dashed pointer-events-none rounded" />
                      )}

                      {el.type === 'text' && (
                        editingElementId === el.id ? (
                          <textarea autoFocus className="w-full h-full bg-transparent resize-none outline-none border-none p-0.5"
                            style={{ color: el.style?.color || template.textColor, fontSize: el.style?.fontSize, fontWeight: el.style?.fontWeight, textAlign: el.style?.textAlign || 'right', direction: 'rtl', lineHeight: el.style?.lineHeight || 1.4, fontFamily: el.style?.fontFamily || template.bodyFont }}
                            value={el.content || ''} onChange={e2 => updateElement(el.id, { content: e2.target.value })}
                            onBlur={() => setEditingElementId(null)} onClick={e2 => e2.stopPropagation()} onMouseDown={e2 => e2.stopPropagation()} />
                        ) : (
                          <div className="w-full h-full p-0.5 overflow-hidden select-none"
                            style={{ color: el.style?.color || template.textColor, fontSize: el.style?.fontSize, fontWeight: el.style?.fontWeight === 'extrabold' ? 800 : el.style?.fontWeight === 'bold' ? 700 : 400, textAlign: el.style?.textAlign || 'right', direction: 'rtl', whiteSpace: 'pre-wrap', lineHeight: el.style?.lineHeight || 1.4, opacity: el.style?.opacity, backgroundColor: el.style?.backgroundColor, fontFamily: el.style?.fontFamily || template.bodyFont }}
                            onDoubleClick={e2 => { e2.stopPropagation(); setEditingElementId(el.id); setSelectedIds([el.id]); }}>
                            {el.content}
                          </div>
                        )
                      )}

                      {el.type === 'person_card' && <PersonCardElement element={el} people={people} relationships={relationships} />}

                      {el.type === 'image' && el.content && (
                        <div className="w-full h-full overflow-hidden" style={{ borderRadius: el.style?.borderRadius ? `${el.style.borderRadius}px` : 0, border: el.style?.borderWidth ? `${el.style.borderWidth}px solid ${el.style.borderColor || '#fff'}` : undefined }}>
                          <img src={el.content} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: el.style?.opacity ?? 1, display: 'block' }} />
                        </div>
                      )}

                      {el.type === 'shape' && (
                        <div className="w-full h-full" style={getShapeStyle(el.style?.shapeType || 'rectangle', el.style?.backgroundColor || template.primaryColor, el.style?.opacity)} />
                      )}

                      {el.type === 'icon' && (
                        <div className="w-full h-full flex items-center justify-center select-none" style={{ fontSize: el.style?.fontSize || 32 }}>{el.content}</div>
                      )}

                      {el.type === 'photo_placeholder' && (
                        <PhotoPlaceholderElement element={el} onOpenImagePicker={() => openImagePickerForPlaceholder(el.id)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Person picker */}
            {showPersonPicker && (
              <div className="absolute top-0 left-0 h-full w-60 bg-slate-800 border-r border-white/10 z-40 flex flex-col shadow-2xl" dir="rtl">
                <div className="p-2.5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-bold text-xs">הוסף כרטיס אדם</h3>
                  <button onClick={() => { setShowPersonPicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
                </div>
                <input className="m-2 px-2.5 py-1.5 bg-slate-700 rounded-lg text-xs text-right placeholder:text-slate-500 border border-white/10 focus:outline-none" placeholder="חפש שם..." value={personSearch} onChange={e => setPersonSearch(e.target.value)} dir="rtl" />
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {people.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(personSearch.toLowerCase())).map(person => (
                    <button key={person.id} onClick={() => { addElement({ type: 'person_card', personId: person.id, x: 20, y: 20, width: 28, height: 36, zIndex: 10 }); setShowPersonPicker(false); setActiveTool('select'); }}
                      className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-white/10 text-right">
                      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                        <img src={person.photoURL || getPlaceholderImage(person.gender)} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs font-medium truncate">{person.firstName} {person.lastName}</p>
                        {person.birthDate && <p className="text-[10px] text-slate-400">{person.birthDate.slice(0, 4)}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showImagePicker && (
              <ImagePickerModal treeId={project.treeId} onSelect={handleImageSelected} onClose={() => { setShowImagePicker(false); setImagePlaceholderTarget(null); setActiveTool('select'); }} />
            )}

            {showEmojiPicker && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => { setShowEmojiPicker(false); setActiveTool('select'); }}>
                <div className="bg-slate-800 rounded-2xl p-4 w-72 shadow-2xl border border-white/10" onClick={e => e.stopPropagation()} dir="rtl">
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => { setShowEmojiPicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white">✕</button>
                    <h3 className="font-bold text-sm">הוסף אמוג׳י</h3>
                  </div>
                  <input className="w-full px-3 py-1.5 bg-slate-700 rounded-lg text-sm text-center placeholder:text-slate-500 border border-white/10 focus:outline-none mb-3" placeholder="הקלד אמוג׳י..." value={emojiInput} onChange={e => setEmojiInput(e.target.value)} />
                  <div className="grid grid-cols-8 gap-1">
                    {['❤️','⭐','🌟','✨','🔥','💫','🎯','🌈','🌺','🌸','🍀','🌿','🕊️','🦋','🌙','☀️','🏡','👨‍👩‍👧‍👦','👪','🤝','💝','🎗️','📖','✡️','🕍','🇮🇱','🗺️','📍','📜','🏺','💎','🎵','🌍','🕰️','🌾','🫒'].map(emoji => (
                      <button key={emoji} className="text-lg p-1 hover:bg-white/10 rounded transition-colors"
                        onClick={() => { addElement({ type: 'icon', content: emojiInput || emoji, x: 40, y: 40, width: 10, height: 10, style: { fontSize: 32, textAlign: 'center' }, zIndex: 15 }); setShowEmojiPicker(false); setActiveTool('select'); }}>{emoji}</button>
                    ))}
                  </div>
                  {emojiInput && (
                    <button className="w-full mt-2 p-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-bold"
                      onClick={() => { addElement({ type: 'icon', content: emojiInput, x: 40, y: 40, width: 10, height: 10, style: { fontSize: 32 }, zIndex: 15 }); setShowEmojiPicker(false); setActiveTool('select'); }}>
                      הוסף: {emojiInput}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Context menu */}
            {ctxMenu && (
              <div data-ctx-menu="true" className="fixed bg-slate-800 border border-white/15 rounded-xl shadow-2xl py-1 z-[100] min-w-[190px]"
                style={{ top: Math.min(ctxMenu.y, window.innerHeight - 300), left: Math.min(ctxMenu.x, window.innerWidth - 210) }} dir="rtl" onClick={e => e.stopPropagation()}>
                {ctxMenu.elementId ? (
                  <>
                    {currentPage?.elements.find(e => e.id === ctxMenu.elementId)?.type === 'person_card' && (<>
                      <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2 text-indigo-300"
                        onClick={() => {
                          const el = currentPage?.elements.find(e => e.id === ctxMenu.elementId!);
                          const person = people.find(p => p.id === el?.personId);
                          if (el && person) setCardFieldPanel({ elementId: ctxMenu.elementId!, personId: person.id });
                          setCtxMenu(null);
                        }}>
                        <User className="w-3.5 h-3.5" />עריכת שדות הכרטיס
                      </button>
                      <div className="my-1 border-t border-white/10" />
                    </>)}
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { cutElement(ctxMenu.elementId!); setCtxMenu(null); }}><Scissors className="w-3.5 h-3.5" />גזור (Ctrl+X)</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { copyElement(ctxMenu.elementId!); setCtxMenu(null); }}><Copy className="w-3.5 h-3.5" />העתק (Ctrl+C)</button>
                    {_clipboard && <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { pasteElement(); setCtxMenu(null); }}><Clipboard className="w-3.5 h-3.5" />הדבק (Ctrl+V)</button>}
                    <div className="my-1 border-t border-white/10" />
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { duplicateElementById(ctxMenu.elementId!); setCtxMenu(null); }}><Copy className="w-3.5 h-3.5" />שכפל</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { updateElement(ctxMenu.elementId!, el => ({ zIndex: (el.zIndex || 0) + 1 })); setCtxMenu(null); }}><ChevronUp className="w-3.5 h-3.5" />הבא קדימה</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { updateElement(ctxMenu.elementId!, el => ({ zIndex: Math.max(0, (el.zIndex || 0) - 1) })); setCtxMenu(null); }}><ChevronDown className="w-3.5 h-3.5" />שלח אחורה</button>
                    <div className="my-1 border-t border-white/10" />
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { resetSize(ctxMenu.elementId!); setCtxMenu(null); }}><RefreshCw className="w-3.5 h-3.5" />אפס גודל</button>
                    <div className="my-1 border-t border-white/10" />
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-red-500/20 text-red-400 flex items-center gap-2" onClick={() => { deleteElementById(ctxMenu.elementId!); setSelectedIds([]); setCtxMenu(null); }}><Trash2 className="w-3.5 h-3.5" />מחק</button>
                  </>
                ) : (
                  <>
                    {_clipboard && <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { pasteElement(); setCtxMenu(null); }}><Clipboard className="w-3.5 h-3.5" />הדבק</button>}
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { handleAddNewPage(currentPageIndex, 'after'); setCtxMenu(null); }}>+ הוסף עמוד</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { setShowTemplatePicker(true); setCtxMenu(null); }}>🎨 שנה תבנית</button>
                    <div className="my-1 border-t border-white/10" />
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-red-500/20 text-red-400 flex items-center gap-2" onClick={() => { handleDeletePageRequest(currentPageIndex); setCtxMenu(null); }}><Trash2 className="w-3.5 h-3.5" />מחק עמוד זה</button>
                  </>
                )}
              </div>
            )}
            
            {cardFieldPanel && (() => {
                const el = currentPage?.elements.find(e => e.id === cardFieldPanel.elementId);
                const person = people.find(p => p.id === cardFieldPanel.personId);
                if (!el || !person) return null;
                return <CardFieldPanel
                    element={el}
                    person={person}
                    onUpdate={(updates) => updateElement(el.id, updates)}
                    onClose={() => setCardFieldPanel(null)}
                />;
            })()}

            {thumbnailCtxMenu && (
              <ThumbnailContextMenu menu={thumbnailCtxMenu} onClose={() => setThumbnailCtxMenu(null)}
                onMove={handleMovePage} onDuplicate={handleDuplicatePage}
                onAdd={handleAddNewPage} onDelete={handleDeletePageRequest} />
            )}
          </main>
        </div>

        {/* ══ BOTTOM BAR ══ */}
        <div className="h-10 border-t border-white/10 bg-slate-900/90 backdrop-blur flex-shrink-0 flex items-center gap-1.5 px-3 overflow-x-auto overflow-y-hidden" style={{ minWidth: 0 }}>

          <span className="text-[10px] text-slate-500 whitespace-nowrap flex-shrink-0 w-14 text-right">
            {selectedElement ? (selectedElement.type === 'text' ? '✏️ טקסט' : selectedElement.type === 'person_card' ? '👤 כרטיס' : selectedElement.type === 'shape' ? '◼ צורה' : selectedElement.type === 'image' ? '🖼 תמונה' : selectedElement.type === 'icon' ? '😊 סמל' : selectedElement.type === 'connection_line' ? '↔ קו' : '📷') : selectedIds.length > 1 ? `${selectedIds.length} נבחרו` : '📄 עמוד'}
          </span>
          <div className="w-px h-6 bg-white/10 flex-shrink-0" />

          {/* PAGE controls */}
          {!selectedElement && selectedIds.length === 0 && currentPage && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">רקע:</span>
              <div className="flex border border-white/10 rounded overflow-hidden">
                <button onClick={() => setBgMode('solid')} className={cn('text-[10px] px-1.5 py-0.5', bgMode === 'solid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5')}>אחיד</button>
                <button onClick={() => setBgMode('gradient')} className={cn('text-[10px] px-1.5 py-0.5', bgMode === 'gradient' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5')}>גרדיאנט</button>
              </div>
            </div>
            {bgMode === 'solid' ? (
              <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent flex-shrink-0"
                value={(currentPage as any).backgroundColor || template.backgroundColor}
                onChange={e => updateCurrentPage(p => ({ ...p, backgroundColor: e.target.value, backgroundGradient: undefined as any }))} />
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" value={gradientFrom}
                  onChange={e => { setGradientFrom(e.target.value); updateCurrentPage(p => ({ ...p, backgroundGradient: `linear-gradient(135deg, ${e.target.value} 0%, ${gradientTo} 100%)`, backgroundColor: undefined as any })); }} />
                <span className="text-[10px] text-slate-500">→</span>
                <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" value={gradientTo}
                  onChange={e => { setGradientTo(e.target.value); updateCurrentPage(p => ({ ...p, backgroundGradient: `linear-gradient(135deg, ${gradientFrom} 0%, ${e.target.value} 100%)`, backgroundColor: undefined as any })); }} />
              </div>
            )}
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <label className="cursor-pointer flex items-center gap-1 px-2 py-1 border border-dashed border-white/20 rounded text-[10px] text-slate-400 hover:border-indigo-400 flex-shrink-0">
              <ImageIcon className="w-3 h-3" />רקע תמונה
              <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => updateCurrentPage(p => ({ ...p, backgroundImage: ev.target?.result as string } as any)); reader.readAsDataURL(file); }} />
            </label>
            {(currentPage as any).backgroundImage && (
              <button className="text-[10px] text-red-400 hover:text-red-300 flex-shrink-0" onClick={() => updateCurrentPage(p => ({ ...p, backgroundImage: undefined } as any))}>✕ הסר</button>
            )}
          </>)}

          {/* MULTI-SELECT controls */}
          {selectedIds.length > 1 && (<>
            <button className="text-[10px] px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-red-500 text-red-300 flex-shrink-0"
              onClick={() => { selectedIds.forEach(id => deleteElementById(id)); setSelectedIds([]); }}>
              🗑 מחק ({selectedIds.length})
            </button>
            <button className="text-[10px] px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0" onClick={() => selectedIds.forEach(id => duplicateElementById(id))}>⎘ שכפל</button>
            {[
              { l: '⊣', t: 'יישר לשמאל', a: () => updateMultipleElements(selectedIds, () => ({ x: 0 })) },
              { l: '⊢', t: 'יישר לימין', a: () => updateMultipleElements(selectedIds, el => ({ x: 100 - (el.width || 0) })) },
              { l: '⊕H', t: 'מרכז אופקי', a: () => updateMultipleElements(selectedIds, el => ({ x: 50 - (el.width || 0) / 2 })) },
              { l: '⊤', t: 'יישר לעליון', a: () => updateMultipleElements(selectedIds, () => ({ y: 0 })) },
              { l: '⊥', t: 'יישר לתחתון', a: () => updateMultipleElements(selectedIds, el => ({ y: 100 - (el.height || 0) })) },
              { l: '⊕V', t: 'מרכז אנכי', a: () => updateMultipleElements(selectedIds, el => ({ y: 50 - (el.height || 0) / 2 })) },
            ].map(({ l, t, a }) => (
              <Tooltip key={t}><TooltipTrigger asChild>
                <button title={t} onClick={a} className="w-7 h-7 flex items-center justify-center text-[10px] rounded bg-slate-700 border border-slate-600 hover:border-indigo-400 flex-shrink-0">{l}</button>
              </TooltipTrigger><TooltipContent side="top"><p>{t}</p></TooltipContent></Tooltip>
            ))}
          </>)}

          {/* TEXT controls */}
          {selectedElement?.type === 'text' && (<>
            <button className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded border border-white/15 bg-slate-800 hover:border-indigo-400 text-xs max-w-[130px] truncate" onClick={() => setShowFontPicker(true)}>
              <Type className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="truncate" style={{ fontFamily: selectedElement.style?.fontFamily || template.bodyFont }}>
                {selectedElement.style?.fontFamily || template.bodyFont || 'Assistant'}
              </span>
            </button>
            <input type="number" min={6} max={120} className="w-12 text-[10px] bg-slate-800 border border-white/10 rounded px-1 py-1 text-center text-white focus:outline-none flex-shrink-0"
              value={selectedElement.style?.fontSize || 20}
              onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, fontSize: Number(e.target.value) } })} />
            <div className="flex gap-0.5 flex-shrink-0">
              {(['normal','bold','extrabold'] as const).map((w, i) => (
                <button key={w} onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, fontWeight: w } })}
                  className={cn('text-[10px] w-7 h-7 rounded border font-bold', selectedElement.style?.fontWeight === w ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}
                  style={{ fontWeight: w === 'extrabold' ? 900 : w === 'bold' ? 700 : 400 }}>
                  {['R','B','BB'][i]}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 flex-shrink-0">
              {([['right', <AlignRight key="r" className="w-3 h-3" />], ['center', <AlignCenter key="c" className="w-3 h-3" />], ['left', <AlignLeft key="l" className="w-3 h-3" />]] as const).map(([a, icon]) => (
                <button key={a as string} onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, textAlign: a as TextAlign } })}
                  className={cn('w-7 h-7 flex items-center justify-center rounded border', selectedElement.style?.textAlign === a ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}>{icon}</button>
              ))}
            </div>
            <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
              value={selectedElement.style?.color || '#ffffff'}
              onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, color: e.target.value } })} />
            <div className="flex gap-0.5 flex-shrink-0">
              {['#ffffff','#000000','#818cf8','#14b8a6','#f59e0b','#ef4444'].map(c => (
                <button key={c} className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform flex-shrink-0" style={{ backgroundColor: c }}
                  onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, color: c } })} />
              ))}
            </div>
          </>)}

          {/* PERSON CARD controls */}
          {selectedElement?.type === 'person_card' && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">שקיפות:</span>
              <input type="range" min={0} max={1} step={0.05} className="w-16" value={selectedElement.style?.opacity ?? 1}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) } })} />
              <span className="text-[10px] text-slate-500">{Math.round((selectedElement.style?.opacity ?? 1) * 100)}%</span>
            </div>
            <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
              value={selectedElement.style?.backgroundColor?.startsWith('#') ? selectedElement.style.backgroundColor : '#1e293b'}
              onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, backgroundColor: e.target.value } })} />
            <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
              value={selectedElement.style?.color || '#ffffff'}
              onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, color: e.target.value } })} />
          </>)}

          {/* SHAPE controls */}
          {selectedElement?.type === 'shape' && (<>
            <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
              value={selectedElement.style?.backgroundColor || template.primaryColor}
              onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, backgroundColor: e.target.value } })} />
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">שקיפות:</span>
              <input type="range" min={0} max={1} step={0.05} className="w-16" value={selectedElement.style?.opacity ?? 1}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) } })} />
            </div>
            <button className="text-[10px] px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0" onClick={() => setShowShapePicker(true)}>שנה צורה</button>
          </>)}

          {/* IMAGE controls */}
          {(selectedElement?.type === 'image' || selectedElement?.type === 'photo_placeholder') && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">שקיפות:</span>
              <input type="range" min={0} max={1} step={0.05} className="w-14" value={selectedElement.style?.opacity ?? 1}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) } })} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">פינות:</span>
              <input type="range" min={0} max={200} step={4} className="w-14" value={selectedElement.style?.borderRadius ?? 0}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderRadius: Number(e.target.value) } })} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">מסגרת:</span>
              <input type="range" min={0} max={12} step={1} className="w-12" value={selectedElement.style?.borderWidth ?? 0}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderWidth: Number(e.target.value) } })} />
              <input type="color" className="w-6 h-6 rounded cursor-pointer border border-white/10"
                value={selectedElement.style?.borderColor || '#ffffff'}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderColor: e.target.value } })} />
            </div>
            <button className="text-[10px] px-2 py-1 border border-dashed border-white/20 rounded text-slate-400 hover:border-indigo-400 flex-shrink-0"
              onClick={() => { setImagePlaceholderTarget(selectedId!); setShowImagePicker(true); }}>🔄 החלף</button>
          </>)}

          {/* CONNECTION LINE controls */}
          {selectedElement?.type === 'connection_line' && (<>
            <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
              value={selectedElement.style?.color || template.primaryColor}
              onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, color: e.target.value } })} />
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">עובי:</span>
              <input type="range" min={1} max={8} step={1} className="w-12" value={selectedElement.style?.borderWidth || 2}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderWidth: Number(e.target.value) } })} />
            </div>
            {/* Line type — affects the SVG rendering directly via element.style.lineType */}
            <div className="flex gap-0.5 flex-shrink-0">
              {LINE_TYPES.map(lt => (
                <Tooltip key={lt.id}>
                  <TooltipTrigger asChild>
                    <button className={cn('text-[9px] px-1.5 py-1 rounded border flex-shrink-0', (selectedElement.style as any)?.lineType === lt.id ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}
                      onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, lineType: lt.id } as any })}>
                      {lt.label}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>סוג קו: {lt.label}</p></TooltipContent>
                </Tooltip>
              ))}
            </div>
          </>)}

          {/* SHARED single-element align + z-order + duplicate + delete */}
          {selectedElement && selectedElement.type !== 'connection_line' && (<>
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            {[
              { l: '⊣', t: 'יישר לשמאל', a: () => updateElement(selectedId!, { x: 0 }) },
              { l: '⊢', t: 'יישר לימין', a: () => updateElement(selectedId!, el => ({ x: 100 - (el.width || 0) })) },
              { l: '⊕H', t: 'מרכז אופקי', a: () => updateElement(selectedId!, el => ({ x: 50 - (el.width || 0) / 2 })) },
              { l: '⊤', t: 'יישר לעליון', a: () => updateElement(selectedId!, { y: 0 }) },
              { l: '⊥', t: 'יישר לתחתון', a: () => updateElement(selectedId!, el => ({ y: 100 - (el.height || 0) })) },
              { l: '⊕V', t: 'מרכז אנכי', a: () => updateElement(selectedId!, el => ({ y: 50 - (el.height || 0) / 2 })) },
            ].map(({ l, t, a }) => (
              <Tooltip key={t}><TooltipTrigger asChild>
                <button title={t} onClick={a} className="w-7 h-7 flex items-center justify-center text-[10px] rounded bg-slate-700 border border-slate-600 hover:border-indigo-400 flex-shrink-0">{l}</button>
              </TooltipTrigger><TooltipContent side="top"><p>{t}</p></TooltipContent></Tooltip>
            ))}
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <button onClick={() => updateElement(selectedId!, el => ({ zIndex: (el.zIndex || 0) + 1 }))} className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0"><ChevronUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => updateElement(selectedId!, el => ({ zIndex: Math.max(0, (el.zIndex || 0) - 1) }))} className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0"><ChevronDown className="w-3.5 h-3.5" /></button>
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <button onClick={() => duplicateElementById(selectedId!)} className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0"><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={() => { deleteElementById(selectedId!); setSelectedIds([]); }} className="w-7 h-7 flex items-center justify-center rounded bg-red-900/60 border border-red-700/40 hover:bg-red-800/60 text-red-300 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
          </>)}
        </div>

        {/* ══ TEMPLATE PICKER (compact font selector + global text size) ══ */}
        {showTemplatePicker && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplatePicker(false)}>
            <div className="bg-slate-800 rounded-2xl p-4 w-[660px] max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
                <h2 className="text-base font-bold">בחר תבנית עיצוב</h2>
              </div>

              {/* Compact font + text size row */}
              <div className="flex items-center gap-2 mb-3 p-2.5 bg-slate-700/50 rounded-xl border border-white/10">
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <span className="text-[9px] text-slate-400 uppercase">גודל טקסט</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { const next = globalTextSizeOffset - 2; setGlobalTextSizeOffset(next); applyGlobalTextSize(next); }}
                      className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-xs flex items-center justify-center">−</button>
                    <span className="text-xs text-white w-6 text-center">{globalTextSizeOffset > 0 ? '+' : ''}{globalTextSizeOffset}</span>
                    <button onClick={() => { const next = globalTextSizeOffset + 2; setGlobalTextSizeOffset(next); applyGlobalTextSize(next); }}
                      className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-xs flex items-center justify-center">+</button>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10 flex-shrink-0" />
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-[9px] text-slate-400 uppercase">גופן לכל העמודים</span>
                  <select className="text-xs bg-slate-800 border border-white/15 rounded-lg px-2 py-1 text-white w-full"
                    defaultValue=""
                    onChange={e => {
                      const fontName = e.target.value;
                      if (!fontName) return;
                      ensureFontLoaded(fontName);
                      updatePages(ps => ps.map(pg => ({ ...pg, elements: pg.elements.map(el => el.type === 'text' ? { ...el, style: { ...el.style, fontFamily: fontName } } : el) })));
                    }}>
                    <option value="">— בחר גופן גלובלי —</option>
                    {FONT_CATALOG.filter(f => f.hebrewSupport).map(f => (
                      <option key={f.name} value={f.name}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <span className="text-[9px] text-slate-400 uppercase">החל על</span>
                  <button onClick={() => setApplyTemplateToAll(!applyTemplateToAll)}
                    className={cn('rounded-full relative transition-colors flex-shrink-0', applyTemplateToAll ? 'bg-indigo-500' : 'bg-slate-600')} style={{ width: 32, height: 16 }}>
                    <div className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all', applyTemplateToAll ? 'right-0.5' : 'left-0.5')} />
                  </button>
                  <span className="text-[8px] text-slate-400 text-center">{applyTemplateToAll ? 'כולם' : 'עמוד'}</span>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2.5">
                {DESIGN_TEMPLATES.map(t => (
                  <button key={t.id}
                    onClick={() => {
                      setSelectedTemplateId(t.id);
                      if (applyTemplateToAll) updatePages(ps => ps.map(pg => ({ ...pg, templateId: t.id })));
                      else updateCurrentPage(pg => ({ ...pg, templateId: t.id }));
                      setShowTemplatePicker(false);
                    }}
                    className={cn('rounded-xl overflow-hidden border-2 transition-all', selectedTemplateId === t.id ? 'border-indigo-400 scale-105' : 'border-transparent hover:border-white/30')}>
                    <div className="h-16 relative" style={{ background: t.backgroundGradient }}>
                      <div className="absolute inset-0 flex flex-col justify-center items-center gap-1 px-2">
                        <span style={{ fontFamily: t.titleFont, fontSize: 13, color: t.textColor, fontWeight: 700, textAlign: 'center' }}>שלום</span>
                        <div className="h-0.5 rounded-full w-6" style={{ background: t.primaryColor }} />
                      </div>
                    </div>
                    <div className="py-1 px-1 text-center" style={{ backgroundColor: t.backgroundColor }}>
                      <p className="text-[9px] font-bold leading-tight" style={{ color: t.textColor }}>{t.nameHebrew}</p>
                      <p className="text-[7px] opacity-60" style={{ color: t.textColor, fontFamily: t.titleFont }}>{t.titleFont}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ RESET CONFIRM ══ */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setShowResetConfirm(false)}>
            <div className="bg-slate-800 rounded-2xl p-6 w-80 border border-white/10 shadow-2xl text-center" onClick={e => e.stopPropagation()} dir="rtl">
              <div className="text-4xl mb-3">🔄</div>
              <h2 className="text-lg font-bold mb-2">יצירה מחדש של ההצגה</h2>
              <p className="text-sm text-slate-400 mb-4">פעולה זו תמחק את כל העמודים הנוכחיים ותיצור מחדש מהנתונים שלך. לא ניתן לבטל.</p>
              <div className="flex gap-2 justify-center">
                <button className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm" onClick={() => setShowResetConfirm(false)}>ביטול</button>
                <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold" onClick={handleResetPages}>✨ צור מחדש</button>
              </div>
            </div>
          </div>
        )}

        {showFontPicker && (
          <FontPickerModal current={selectedElement?.style?.fontFamily} onSelect={fontName => { if (selectedId) updateElement(selectedId, { style: { ...selectedElement?.style, fontFamily: fontName } }); }} onClose={() => setShowFontPicker(false)} />
        )}

        {showShapePicker && (
          <ShapePickerModal onSelect={shapeId => { setActiveShapeType(shapeId); if (selectedElement?.type === 'shape' && selectedId) updateElement(selectedId, { style: { ...selectedElement.style, shapeType: shapeId as ShapeType } }); }} onClose={() => setShowShapePicker(false)} />
        )}

        <AlertDialog open={pageToDeleteIndex !== null} onOpenChange={open => !open && setPageToDeleteIndex(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>אישור מחיקת עמוד</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך למחוק את העמוד "{localPages[pageToDeleteIndex!]?.title}"? לא ניתן לבטל פעולה זו.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeletePage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">מחק לצמיתות</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </TooltipProvider>
  );
}
