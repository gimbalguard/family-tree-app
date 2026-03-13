
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  RootsProject, Person, Relationship, ExportedFile,
  DesignPage, DesignTemplate, DesignElement, ShapeType, TextAlign, CanvasAspectRatio
} from '@/lib/types';
import { parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import {
  ArrowLeft, ArrowRight, Type, MousePointer2,
  Smile, Trash2, User, Image as ImageIcon,
  Copy, AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown,
  Scissors, Clipboard, RefreshCw, Maximize2, Square, Upload, Layers,
  CropIcon,
  Baby, Users,
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
// DESIGN TEMPLATES — with font per template
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
// PAGE GENERATOR — comprehensive (12+ pages)
// ============================================================
function generatePagesFromProject(
  project: RootsProject, people: Person[], relationships: Relationship[], templateId: string
): DesignPage[] {
  const pages: DesignPage[] = [];
  let pageNumber = 1;
  const student = people.find(p => p.id === project.studentPersonId);
  const tmpl = DESIGN_TEMPLATES.find(t => t.id === templateId) || DESIGN_TEMPLATES[0];
  const P = tmpl.primaryColor;
  const accent = tmpl.accentColor;

  const mk = (type: DesignElement['type'], extra: Partial<DesignElement> & { x: number; y: number; width: number; height: number }): DesignElement =>
    ({ id: uuidv4(), type, zIndex: 1, ...extra } as DesignElement);

  const header = (title: string, emoji?: string): DesignElement[] => [
    mk('shape', { x: 0, y: 0, width: 100, height: 13, zIndex: 0, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.15 } }),
    mk('text', { x: 5, y: 1.5, width: 85, height: 11, content: `${emoji ? emoji + ' ' : ''}${title}`, style: { fontSize: 34, fontWeight: 'extrabold', textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.titleFont } }),
    mk('shape', { x: 0, y: 12.5, width: 100, height: 0.4, zIndex: 2, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.3 } }),
  ];

  const pill = (x: number, y: number, w: number, h: number, text: string, icon: string, colorP: string): DesignElement[] => [
    mk('shape', { x, y, width: w, height: h, zIndex: 1, style: { shapeType: 'rounded_rectangle', backgroundColor: colorP, opacity: 0.25 } }),
    mk('text', { x, y, width: w, height: h, content: `${icon} ${text}`, style: { fontSize: 13, fontWeight: 'bold', textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.titleFont } }),
  ];

  const photoPlaceholder = (x: number, y: number, w: number, h: number, label = '📷 הוסף תמונה'): DesignElement[] => [
    mk('photo_placeholder', { x, y, width: w, height: h, zIndex: 5, content: label,
      style: { borderColor: P, borderWidth: 2, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.04)', opacity: 0.85 } }),
  ];

  // ─── 1. COVER ───────────────────────────────────────────────
  const coverEls: DesignElement[] = [
    mk('shape', { x: -15, y: -20, width: 55, height: 80, zIndex: 0, style: { shapeType: 'circle', backgroundColor: P, opacity: 0.07 } }),
    mk('shape', { x: 65, y: 50, width: 45, height: 65, zIndex: 0, style: { shapeType: 'circle', backgroundColor: accent, opacity: 0.06 } }),
    mk('shape', { x: 10, y: 47, width: 80, height: 0.4, zIndex: 1, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.4 } }),
    mk('text', { x: 5, y: 16, width: 90, height: 17, content: `משפחת ${student?.lastName || ''}`, style: { fontSize: 58, fontWeight: 'extrabold', textAlign: 'center', color: tmpl.textColor, fontFamily: tmpl.titleFont } }),
    mk('text', { x: 5, y: 50, width: 90, height: 9, content: student ? `${student.firstName} ${student.lastName}` : 'עבודת שורשים', style: { fontSize: 22, fontWeight: 'normal', textAlign: 'center', color: tmpl.textColor, fontFamily: tmpl.bodyFont, opacity: 0.75 } }),
    mk('text', { x: 30, y: 61, width: 40, height: 7, content: `שנת ${new Date().getFullYear()}`, style: { fontSize: 15, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont } }),
  ];
  if (student?.photoURL) {
    coverEls.push(mk('image', { content: student.photoURL, x: 36, y: 70, width: 28, height: 25, zIndex: 5, style: { borderRadius: 50, opacity: 1, borderColor: P, borderWidth: 3 } }));
  } else {
    coverEls.push(...photoPlaceholder(36, 70, 28, 24, '📷 תמונת התלמיד/ה'));
  }
  pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'cover', title: 'שער', templateId, elements: coverEls });

  // ─── 2. TABLE OF CONTENTS ──────────────────────────────────
  const tocEls: DesignElement[] = [
    ...header('תוכן עניינים', '📋'),
    mk('text', { x: 5, y: 16, width: 90, height: 75, content:
      '1. שער\n2. אני — הזהות האישית\n3. השם שלי\n4. המשפחה הגרעינית\n5. הסיפור שלי\n6. שורשים מצד אבא\n7. שורשים מצד אמא\n8. אילן יוחסין\n9. מורשת משפחתית\n10. ציר זמן היסטורי\n11. מפת מסע המשפחה\n12. סיכום ורפלקציה',
      style: { fontSize: 15, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 2 } }),
  ];
  pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'custom', title: 'תוכן עניינים', templateId, elements: tocEls });

  // ─── 3. NAME PAGE ──────────────────────────────────────────
  const nm = project.projectData?.personalStory?.nameMeaning;
  const nameEls: DesignElement[] = [
    mk('shape', { x: 0, y: 0, width: 7, height: 100, zIndex: 0, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.45 } }),
    mk('text', { x: 11, y: 4, width: 84, height: 13, content: 'השם שלי', style: { fontSize: 46, fontWeight: 'extrabold', textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.titleFont } }),
    mk('text', { x: 11, y: 20, width: 84, height: 60, content: nm || 'כאן יופיע הסבר על משמעות השם שלי, מי בחר אותו ולמה, ומה הקשר שלו להיסטוריה המשפחתית.', style: { fontSize: 16, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.7 } }),
    mk('text', { x: 72, y: 16, width: 20, height: 16, content: '❝', style: { fontSize: 60, textAlign: 'right', color: P, opacity: 0.15, fontFamily: 'serif' } }),
  ];
  if (student?.photoURL) {
    nameEls.push(mk('image', { content: student.photoURL, x: 66, y: 55, width: 30, height: 38, zIndex: 5, style: { borderRadius: 10, opacity: 0.9 } }));
  } else {
    nameEls.push(...photoPlaceholder(66, 55, 30, 38));
  }
  pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'name', title: 'השם שלי', templateId, elements: nameEls });

  // ─── 4. PERSONAL IDENTITY ──────────────────────────────────
  const ps = project.projectData?.personalStory;
  const identityEls: DesignElement[] = [
    ...header('אני — הזהות האישית', '🪪'),
    ...pill(68, 15, 28, 6.5, 'פרטים אישיים', '👤', P),
    mk('text', { x: 5, y: 15, width: 62, height: 35, content: [
      student ? `שם מלא: ${student.firstName} ${student.lastName}` : '',
      student?.birthDate ? `תאריך לידה: ${student.birthDate.slice(0,10)}` : '',
      student?.birthPlace ? `מקום לידה: ${student.birthPlace}` : '',
      ps?.nameMeaning ? '' : '',
    ].filter(Boolean).join('\n') || 'פרטים אישיים יופיעו כאן', style: { fontSize: 14, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.8 } }),
    ...pill(5, 53, 45, 6.5, 'תחביבים ואישיות', '🎯', accent),
    mk('text', { x: 5, y: 61, width: 90, height: 28, content: ps?.personalVision || 'כאן יופיע מידע על תחביבים, תכונות אופי ו"אני מאמין" שלי.', style: { fontSize: 14, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.7 } }),
  ];
  identityEls.push(...photoPlaceholder(55, 15, 38, 35, '📷 תמונה אישית'));
  pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'personal', title: 'אני — הזהות האישית', templateId, elements: identityEls });

  // ─── 5. PERSONAL STORY ─────────────────────────────────────
  if (ps?.birthStory || ps?.personalVision) {
    const storyEls: DesignElement[] = [
      ...header('הסיפור שלי', '📖'),
    ];
    let y = 15;
    if (ps.birthStory) {
      storyEls.push(...pill(68, y, 28, 6.5, 'סיפור הלידה', '🍼', P));
      storyEls.push(mk('text', { x: 5, y: y + 7.5, width: 90, height: 28, content: ps.birthStory, style: { fontSize: 13, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.6 } }));
      storyEls.push(...photoPlaceholder(63, y + 7.5, 34, 28));
      y += 38;
    }
    if (ps.personalVision && y < 85) {
      storyEls.push(...pill(65, y, 31, 6.5, 'החזון שלי', '🌟', accent));
      storyEls.push(mk('text', { x: 5, y: y + 7.5, width: 90, height: 84 - y - 8, content: ps.personalVision, style: { fontSize: 13, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.6 } }));
    }
    pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'personal', title: 'הסיפור שלי', templateId, elements: storyEls });
  }

  // ─── 6. NUCLEAR FAMILY ─────────────────────────────────────
  const parentRels = relationships.filter(r => r.personBId === project.studentPersonId && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType));
  const parents = parentRels.map(r => people.find(p => p.id === r.personAId)).filter(Boolean) as Person[];
  const sibRels = relationships.filter(r => (r.personAId === project.studentPersonId || r.personBId === project.studentPersonId) && r.relationshipType === 'sibling');
  const siblings = sibRels.map(r => people.find(p => p.id === (r.personAId === project.studentPersonId ? r.personBId : r.personAId))).filter(Boolean).slice(0, 6) as Person[];

  if (parents.length || student) {
    const totalMembers = parents.length + (student ? 1 : 0) + siblings.length;
    // Calculate smart card dimensions based on total members
    const cardW = totalMembers > 6 ? 18 : totalMembers > 4 ? 22 : 26;
    const cardH = totalMembers > 6 ? 28 : totalMembers > 4 ? 32 : 36;

    const nucEls: DesignElement[] = [...header('המשפחה הגרעינית', '👨‍👩‍👧')];
    const studentCardId = uuidv4();

    // Parents row — centered
    const parentTotal = parents.length;
    const parentRowW = parentTotal * cardW + (parentTotal - 1) * 4;
    let parentStartX = (100 - parentRowW) / 2;
    const parentCardIds: string[] = [];
    parents.forEach((parent, idx) => {
      const parentCardId = uuidv4();
      parentCardIds.push(parentCardId);
      nucEls.push(mk('person_card', { id: parentCardId, personId: parent.id, x: parentStartX + idx * (cardW + 4), y: 15, width: cardW, height: cardH, zIndex: 10 }));
    });

    // Student card — center
    if (student) {
      nucEls.push({ ...mk('person_card', { personId: student.id, x: (100 - cardW) / 2, y: 55, width: cardW, height: cardH, zIndex: 10 }), id: studentCardId });
      parentCardIds.forEach(pid => {
        nucEls.push(mk('connection_line', { fromElementId: pid, toElementId: studentCardId, x: 0, y: 0, width: 0, height: 0, zIndex: 1, style: { color: P, borderWidth: 2 } }));
      });
    }

    // Siblings row
    if (siblings.length > 0) {
      const sibTotalW = siblings.length * cardW + (siblings.length - 1) * 3;
      const sibStartX = (100 + cardW + 4) / 2;
      siblings.forEach((sib, idx) => {
        if (sibStartX + idx * (cardW + 3) + cardW <= 100) {
          nucEls.push(mk('person_card', { personId: sib.id, x: Math.min(sibStartX + idx * (cardW + 3), 100 - cardW), y: 55, width: cardW, height: cardH, zIndex: 9 }));
        }
      });
    }
    pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'nuclear_family', title: 'המשפחה הגרעינית', templateId, elements: nucEls });
  }

  // ─── 7+8. ROOTS PAGES (paternal / maternal) ────────────────
  const rootSides: Array<{ key: 'paternalGrandfather' | 'paternalGrandmother' | 'maternalGrandfather' | 'maternalGrandmother'; title: string; emoji: string; pageType: DesignPage['pageType'] }[]> = [
    [
      { key: 'paternalGrandfather', title: 'סבא מצד אבא', emoji: '👴', pageType: 'roots_paternal' },
      { key: 'paternalGrandmother', title: 'סבתא מצד אבא', emoji: '👵', pageType: 'roots_paternal' },
    ],
    [
      { key: 'maternalGrandfather', title: 'סבא מצד אמא', emoji: '👴', pageType: 'roots_maternal' },
      { key: 'maternalGrandmother', title: 'סבתא מצד אמא', emoji: '👵', pageType: 'roots_maternal' },
    ],
  ];
  const rootTitles = ['שורשים מצד אבא', 'שורשים מצד אמא'];

  rootSides.forEach((side, sIdx) => {
    const hasAny = side.some(s => {
      const d = (project.projectData?.familyRoots as any)?.[s.key];
      return d?.personId || d?.story;
    });
    if (!hasAny) return;
    const rootEls: DesignElement[] = [...header(rootTitles[sIdx], sIdx === 0 ? '👨' : '👩')];
    side.forEach((s, sRowIdx) => {
      const data = (project.projectData?.familyRoots as any)?.[s.key];
      if (!data) return;
      const rowY = 15 + sRowIdx * 42;
      rootEls.push(...pill(55, rowY, 41, 6.5, s.title, s.emoji, sRowIdx === 0 ? P : accent));
      if (data.personId) {
        rootEls.push(mk('person_card', { personId: data.personId, x: 5, y: rowY, width: 24, height: 36, zIndex: 10 }));
      } else {
        rootEls.push(...photoPlaceholder(5, rowY, 24, 36, `📷 ${s.title}`));
      }
      if (data.story) {
        rootEls.push(mk('text', { x: 31, y: rowY + 7.5, width: 65, height: 30, content: data.story, style: { fontSize: 12, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.55 } }));
      } else {
        rootEls.push(mk('text', { x: 31, y: rowY + 7.5, width: 65, height: 8, content: 'הוסף כאן סיפור על הסב/ה', style: { fontSize: 12, textAlign: 'right', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont, opacity: 0.45 } }));
      }
    });
    pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: side[0].pageType, title: rootTitles[sIdx], templateId, elements: rootEls });
  });

  // ─── FAMILY TREE CHART PAGE ─────────────────────────────────
  const treeEls: DesignElement[] = [
      ...header('אילן יוחסין', '🌳'),
      mk('text', { x: 5, y: 16, width: 90, height: 12, content: 'תרשים אילן היוחסין המשפחתי — לפחות 3-4 דורות', style: { fontSize: 14, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont } }),
  ];
  const cardElementsMap = new Map<string, string>(); // personId -> elementId

  // Auto-place person cards in tree layout and create connection lines
  const findParents = (personId?: string): Person[] => {
    if (!personId) return [];
    const parentRels = relationships.filter(r => r.personBId === personId && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType));
    return parentRels.map(r => people.find(p => p.id === r.personAId)).filter(Boolean) as Person[];
  };

  const studentParents = findParents(student?.id);
  const paternalGrandparents = findParents(studentParents.find(p => p.gender === 'male')?.id);
  const maternalGrandparents = findParents(studentParents.find(p => p.gender === 'female')?.id);

  const placePerson = (person: Person, x: number, y: number, w: number, h: number) => {
    const elId = uuidv4();
    cardElementsMap.set(person.id, elId);
    treeEls.push(mk('person_card', { id: elId, personId: person.id, x, y, width: w, height: h, zIndex: 10, style: { scale: 1 } }));
  };

  // Place generations
  if (paternalGrandparents.length > 0) paternalGrandparents.forEach((p, i) => placePerson(p, 5 + i * 23, 30, 20, 26));
  if (maternalGrandparents.length > 0) maternalGrandparents.forEach((p, i) => placePerson(p, 52 + i * 23, 30, 20, 26));
  if (studentParents.length > 0) studentParents.forEach((p, i) => placePerson(p, 16 + i * 48, 60, 22, 28));
  if (student) placePerson(student, 39, 86, 22, 12);
  
  // Create connection lines
  relationships.forEach(rel => {
    if (['parent', 'adoptive_parent', 'step_parent'].includes(rel.relationshipType)) {
      const parentCardId = cardElementsMap.get(rel.personAId);
      const childCardId = cardElementsMap.get(rel.personBId);
      if (parentCardId && childCardId) {
        treeEls.push(mk('connection_line', { 
          fromElementId: parentCardId, 
          toElementId: childCardId, 
          x: 0, y: 0, width: 0, height: 0, 
          zIndex: 1, 
          style: { color: P, borderWidth: 1.5, lineType: 'pcb' } 
        }));
      }
    }
  });


  if (cardElementsMap.size === 0) { // Fallback if no hierarchy found
    treeEls.push(...photoPlaceholder(5, 30, 90, 55, '🌳 הוסף כאן תרשים אילן יוחסין — גרור כרטיסי אנשים'));
  }
  pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'roots_great', title: 'אילן יוחסין', templateId, elements: treeEls });


  // ─── HERITAGE PAGE ──────────────────────────────────────────
  const h = project.projectData?.heritage;
  if (h?.inheritedObject || h?.familyRecipe || h?.familyNameOrigin) {
    const herEls: DesignElement[] = [
      ...header('מורשת משפחתית', '🏺'),
    ];
    let y2 = 15;
    const sections = [
      { exists: !!h.inheritedObject, icon: '💎', label: 'חפץ עובר בירושה', content: h.inheritedObject, needsPhoto: true },
      { exists: !!h.familyRecipe, icon: '🍽️', label: 'מתכון משפחתי', content: h.familyRecipe, needsPhoto: false },
      { exists: !!h.familyNameOrigin, icon: '📜', label: 'מקור שם המשפחה', content: h.familyNameOrigin, needsPhoto: false },
    ];
    sections.filter(s => s.exists).forEach((sec, i) => {
      const colW = sec.needsPhoto ? 55 : 90;
      herEls.push(...pill(5, y2, colW, 6.5, sec.label, sec.icon, i % 2 === 0 ? P : accent));
      herEls.push(mk('text', { x: 5, y: y2 + 7.5, width: colW, height: 15, content: sec.content!, style: { fontSize: 12, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.6 } }));
      if (sec.needsPhoto) herEls.push(...photoPlaceholder(62, y2, 34, 24, '📷 תמונת החפץ'));
      y2 += 28;
    });
    pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'heritage', title: 'מורשת משפחתית', templateId, elements: herEls });
  }

  // ─── TIMELINE PAGE ──────────────────────────────────────────
  const timelineEls: DesignElement[] = [
    ...header('ציר זמן היסטורי', '🕰️'),
    mk('shape', { x: 48, y: 15, width: 4, height: 80, zIndex: 1, style: { shapeType: 'rectangle', backgroundColor: P, opacity: 0.3 } }),
    mk('text', { x: 5, y: 15, width: 42, height: 8, content: '1948 — הקמת מדינת ישראל', style: { fontSize: 12, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont } }),
    mk('shape', { x: 46, y: 17, width: 8, height: 4, zIndex: 3, style: { shapeType: 'circle', backgroundColor: P, opacity: 0.9 } }),
    mk('text', { x: 54, y: 25, width: 42, height: 8, content: '1967 — מלחמת ששת הימים', style: { fontSize: 12, textAlign: 'left', color: tmpl.textColor, fontFamily: tmpl.bodyFont } }),
    mk('shape', { x: 46, y: 27, width: 8, height: 4, zIndex: 3, style: { shapeType: 'circle', backgroundColor: accent, opacity: 0.9 } }),
    mk('text', { x: 5, y: 35, width: 42, height: 8, content: '1973 — מלחמת יום כיפור', style: { fontSize: 12, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont } }),
    mk('shape', { x: 46, y: 37, width: 8, height: 4, zIndex: 3, style: { shapeType: 'circle', backgroundColor: P, opacity: 0.9 } }),
    mk('text', { x: 5, y: 15, width: 42, height: 8, content: 'ערוך את הציר עם אירועים מחיי המשפחה ←', style: { fontSize: 11, textAlign: 'right', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont, opacity: 0.6 } }),
    mk('text', { x: 5, y: 50, width: 90, height: 40, content: 'הוסף כאן אירועים מהיסטוריית המשפחה ואירועים לאומיים מקבילים — ציר זמן משולב המחבר את הסיפור המשפחתי לתולדות עם ישראל.', style: { fontSize: 13, textAlign: 'right', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont, lineHeight: 1.6, opacity: 0.7 } }),
  ];
  pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'national_history', title: 'ציר זמן היסטורי', templateId, elements: timelineEls });

  // ─── MIGRATION MAP PAGE ─────────────────────────────────────
  const mapEls: DesignElement[] = [
    ...header('מפת מסע המשפחה', '🗺️'),
    mk('text', { x: 5, y: 16, width: 90, height: 10, content: 'הוסף מפה של מסלול נדידת המשפחה ממדינות המוצא לישראל', style: { fontSize: 14, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont } }),
    ...photoPlaceholder(5, 28, 90, 60, '🗺️ הוסף כאן מפת נדידה — מדינות המוצא → ישראל'),
    mk('shape', { x: 30, y: 25, width: 3, height: 3, zIndex: 3, style: { shapeType: 'circle', backgroundColor: P, opacity: 0.9 } }),
    mk('text', { x: 5, y: 90, width: 90, height: 8, content: 'ציין מדינות מוצא: ________________________ | נקודת יעד: ישראל', style: { fontSize: 12, textAlign: 'center', color: tmpl.textColor, fontFamily: tmpl.bodyFont, opacity: 0.8 } }),
  ];
  pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'custom', title: 'מפת מסע המשפחה', templateId, elements: mapEls });

  // ─── CONCLUSION PAGE ─────────────────────────────────────────
  const conclusionEls: DesignElement[] = [
    ...header('סיכום ורפלקציה', '💭'),
    ...pill(55, 15, 41, 6.5, 'מה למדתי?', '🔍', P),
    mk('text', { x: 5, y: 23, width: 90, height: 28, content: ps?.personalVision || 'כאן אכתוב מה למדתי על עצמי ועל משפחתי, מה הפתיע אותי, ומה גיליתי בתהליך העבודה.', style: { fontSize: 13, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.7 } }),
    ...pill(55, 54, 41, 6.5, 'ביבליוגרפיה', '📚', accent),
    mk('text', { x: 5, y: 62, width: 90, height: 28, content: 'מקורות:\n• ראיונות עם סבא וסבתא\n• תמונות ומסמכים משפחתיים\n• ___________________________\n• ___________________________', style: { fontSize: 12, textAlign: 'right', color: tmpl.textColor, fontFamily: tmpl.bodyFont, lineHeight: 1.8 } }),
    mk('text', { x: 5, y: 90, width: 90, height: 8, content: `נכתב בשנת ${new Date().getFullYear()} | ${student ? student.firstName + ' ' + student.lastName : ''}`, style: { fontSize: 11, textAlign: 'center', color: tmpl.mutedTextColor, fontFamily: tmpl.bodyFont, opacity: 0.6 } }),
  ];
  pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'custom', title: 'סיכום', templateId, elements: conclusionEls });

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
  if (pat === 'border') return (
    <div className="absolute inset-2 pointer-events-none rounded-lg" style={{ border: `1.5px solid ${P}`, opacity: 0.2 }} />
  );
  if (pat === 'dots') return (
    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, ${P}22 1px, transparent 1px)`, backgroundSize: '28px 28px', opacity: 0.4 }} />
  );
  if (pat === 'lines') return (
    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(0deg, ${P}12 0px, ${P}12 1px, transparent 1px, transparent 28px)`, opacity: 0.3 }} />
  );
  if (pat === 'diagonal') return (
    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `repeating-linear-gradient(45deg, ${P}0a 0px, ${P}0a 1px, transparent 1px, transparent 20px)`, opacity: 0.5 }} />
  );
  return null;
}

// ============================================================
// PERSON CARD ELEMENT
// ============================================================
const PersonCardElement = ({ element, people, relationships }: {
  element: DesignElement; people: Person[]; relationships: Relationship[];
}) => {
  const person = people.find(p => p.id === element.personId);
  if (!person) return (
    <div className="w-full h-full rounded-xl flex items-center justify-center bg-white/5 border border-white/20 gap-1">
      <User className="w-5 h-5 opacity-30" />
      <span className="text-xs opacity-30">אדם לא נמצא</span>
    </div>
  );

  const getLifeYearsDisplay = () => {
    const birthYear = person.birthDate && isValid(parseISO(person.birthDate)) ? new Date(person.birthDate).getFullYear() : null;
    const deathYear = person.deathDate && isValid(parseISO(String(person.deathDate))) ? new Date(String(person.deathDate)).getFullYear() : null;
    if(birthYear && deathYear) return `${birthYear}–${deathYear}`;
    if(birthYear) return `${birthYear}–`;
    return '';
  };
  
  const displayName = [person.firstName, person.nickname ? `(${person.nickname})` : null, person.lastName, person.status === 'deceased' ? '(ז"ל)' : null].filter(Boolean).join(' ');

  const childRels = relationships.filter(r => r.personAId === person.id && ['parent', 'adoptive_parent'].includes(r.relationshipType));
  const siblingRels = relationships.filter(r => (r.personAId === person.id || r.personBId === person.id) && ['sibling', 'twin'].includes(r.relationshipType));
  
  const descendantCounts = [
    { count: childRels.length, label: 'ילדים', icon: Baby },
    { count: siblingRels.length, label: 'אחים', icon: Users },
  ].filter(item => (item.count || 0) > 0);

  const bgColor = element.style?.backgroundColor || 'rgba(255,255,255,0.08)';
  const textColor = element.style?.color || '#ffffff';
  const opacity = element.style?.opacity ?? 1;
  const scale = element.style?.scale ?? 1;
  
  const fs = (base: number) => Math.max(6, base * scale);
  const pad = Math.max(2, 6 * scale);
  const avatarSize = Math.max(16, 40 * scale);

  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden border border-white/15 backdrop-blur-sm shadow-lg flex flex-col"
      style={{ backgroundColor: bgColor, opacity, color: textColor, padding: 0, boxSizing: 'border-box' }}
      dir="rtl"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: pad / 2, flexShrink: 0, padding: pad }}>
        <div style={{ width: avatarSize, height: avatarSize, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.25)' }}>
          <img src={person.photoURL || getPlaceholderImage(person.gender)} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
          <div style={{ fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: fs(13), color: textColor }}>{displayName}</div>
          <div style={{ opacity: 0.65, fontSize: fs(10), lineHeight: 1.2 }}>{getLifeYearsDisplay()}</div>
        </div>
      </div>
      {descendantCounts.length > 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5" style={{ paddingLeft: pad, paddingRight: pad, paddingBottom: pad }}>
             {descendantCounts.map(({ count, label, icon: Icon }) => (
                  <div key={label} className="flex items-center justify-end gap-1.5" style={{ fontSize: fs(10), opacity: 0.8 }}>
                    <span>{count} {label}</span>
                    <Icon style={{ width: fs(12), height: fs(12) }} />
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};


// ============================================================
// PHOTO PLACEHOLDER ELEMENT
// ============================================================
function PhotoPlaceholderElement({
  element, onOpenImagePicker,
}: {
  element: DesignElement;
  onOpenImagePicker: () => void;
}) {
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
// MY FILES IMAGE GRID — fixed unique key
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
// CLIPBOARD
// ============================================================
let _clipboard: DesignElement | null = null;
interface CtxMenu { x: number; y: number; elementId: string | null; }

// ============================================================
// FONT PICKER MODAL
// ============================================================
function FontPickerModal({ current, onSelect, onClose }: { current?: string; onSelect: (f: string) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const categories = [...new Set(FONT_CATALOG.map(f => f.category))];
  const filtered = FONT_CATALOG.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.label.toLowerCase().includes(search.toLowerCase()));
  useEffect(() => { filtered.forEach(f => ensureFontLoaded(f.name)); }, [search]);
  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl w-[480px] max-h-[75vh] border border-white/10 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          <h2 className="font-bold text-base">בחר גופן</h2>
        </div>
        <div className="p-3 border-b border-white/10 flex-shrink-0">
          <input className="w-full px-3 py-1.5 bg-slate-700 rounded-lg text-sm placeholder:text-slate-500 border border-white/10 focus:outline-none" placeholder="חפש גופן..." value={search} onChange={e => setSearch(e.target.value)} dir="rtl" />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {categories.map(cat => {
            const catFonts = filtered.filter(f => f.category === cat);
            if (!catFonts.length) return null;
            return (
              <div key={cat} className="mb-4">
                <div className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase">{cat}</div>
                <div className="space-y-1">
                  {catFonts.map(f => (
                    <button key={f.name} onClick={() => { onSelect(f.name); ensureFontLoaded(f.name); onClose(); }}
                      className={cn('w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors', current === f.name ? 'border-indigo-500 bg-indigo-500/15' : 'border-transparent hover:bg-white/8 hover:border-white/15')}>
                      <span className="text-slate-400 text-[10px]">{f.hebrewSupport ? '✓ עברית' : ''}</span>
                      <span style={{ fontFamily: f.name, fontSize: 16 }}>שלום Hello {f.label}</span>
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
function LayersPanel({ page, selectedIds, onSelect, onDelete, onToggleVisibility, onClose }: {
  page: DesignPage | undefined;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onClose: () => void;
}) {
  const typeLabel = (el: DesignElement) => {
    switch (el.type) {
      case 'text': return `✏️ ${(el.content || '').slice(0, 18)}`;
      case 'person_card': return `👤 כרטיס אדם`;
      case 'image': return `🖼 תמונה`;
      case 'shape': return `◼ צורה — ${el.style?.shapeType || 'rectangle'}`;
      case 'icon': return `😊 ${el.content || 'סמל'}`;
      case 'connection_line': return `↔ קו חיבור`;
      case 'photo_placeholder': return `📷 מקום לתמונה`;
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
          <div key={el.id} className={cn('flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:bg-white/8 border-b border-white/5', selectedIds.includes(el.id) ? 'bg-indigo-500/20' : '')}
            onClick={() => onSelect(el.id)}>
            <button className="text-[10px] text-slate-400 hover:text-red-400 flex-shrink-0" title="מחק" onClick={e => { e.stopPropagation(); onDelete(el.id); }}>✕</button>
            <span className="text-[10px] truncate flex-1 text-right">{typeLabel(el)}</span>
            <span className="text-[9px] text-slate-500 flex-shrink-0">z:{el.zIndex || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// IMAGE PICKER MODAL — with family photos tab
// ============================================================
function ImagePickerModal({ treeId, onSelect, onClose }: {
  treeId: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
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
// RESIZE HANDLES
// ============================================================
const HANDLES = [
  { id: 'nw', cursor: 'nw-resize', style: { top: -5, right: -5 }, title: 'שנה גודל — פינה שמאל-עליון' },
  { id: 'ne', cursor: 'ne-resize', style: { top: -5, left: -5 }, title: 'שנה גודל — פינה ימין-עליון' },
  { id: 'sw', cursor: 'sw-resize', style: { bottom: -5, right: -5 }, title: 'שנה גודל — פינה שמאל-תחתון' },
  { id: 'se', cursor: 'se-resize', style: { bottom: -5, left: -5 }, title: 'שנה גודל — פינה ימין-תחתון' },
  { id: 'n', cursor: 'n-resize', style: { top: -5, left: '50%', transform: 'translateX(-50%)' }, title: 'שנה גובה מלמעלה' },
  { id: 's', cursor: 's-resize', style: { bottom: -5, left: '50%', transform: 'translateX(-50%)' }, title: 'שנה גובה מלמטה' },
  { id: 'e', cursor: 'e-resize', style: { right: -5, top: '50%', transform: 'translateY(-50%)' }, title: 'שנה רוחב ימין' },
  { id: 'w', cursor: 'w-resize', style: { left: -5, top: '50%', transform: 'translateY(-50%)' }, title: 'שנה רוחב שמאל' },
];

// ============================================================
// LINE TYPE OPTIONS
// ============================================================
const LINE_TYPES = [
  { id: 'straight', label: 'ישר', stroke: '' },
  { id: 'dashed', label: 'מקווקו', stroke: '8 4' },
  { id: 'dotted', label: 'נקוד', stroke: '2 6' },
  { id: 'pcb', label: 'PCB', stroke: '' }, // rendered specially
  { id: 'wavy', label: 'גלי', stroke: '' }, // rendered as SVG path
];

// ============================================================
// MAIN EDITOR
// ============================================================
export function RootsDesignEditor({
  project, people, relationships, onBack, onUpdateProject,
}: {
  project: RootsProject; people: Person[]; relationships: Relationship[];
  onBack: () => void; onUpdateProject: (updater: (p: RootsProject) => RootsProject) => void;
}) {
  const [pages, setPages] = useState<DesignPage[]>(project.projectData?.designData?.pages || []);
  const [isGenerating, setIsGenerating] = useState(!project.projectData?.designData?.pages?.length);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'shape' | 'person' | 'image' | 'icon'>('select');
  const [selectedTemplateId, setSelectedTemplateId] = useState(project.projectData?.designData?.templateId || 'template_cosmic');
  const [templateFont, setTemplateFont] = useState<string>(''); // per-template font override
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [canvasAspectRatio, setCanvasAspectRatio] = useState<CanvasAspectRatio>('a4-landscape');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imagePlaceholderTarget, setImagePlaceholderTarget] = useState<string | null>(null); // element id
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiInput, setEmojiInput] = useState('');
  const [applyTemplateToAll, setApplyTemplateToAll] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [gradientFrom, setGradientFrom] = useState('#0a0015');
  const [gradientTo, setGradientTo] = useState('#000d1a');
  const [bgMode, setBgMode] = useState<'solid' | 'gradient'>('gradient');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showShapePicker, setShowShapePicker] = useState(false);
  const [activeShapeType, setActiveShapeType] = useState<string>('rectangle');
  const [showLayers, setShowLayers] = useState(false);

  // Preload all template fonts on mount
  useEffect(() => { DESIGN_TEMPLATES.forEach(t => ensureFontLoaded(t.titleFont)); }, []);

  const { toast } = useToast();
  const isDragging = useRef(false);
  const dragIds = useRef<string[]>([]);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, elements: [] as Array<{ id: string; x: number; y: number }> });
  const canvasRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeHandle = useRef<string | null>(null);
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, elX: 0, elY: 0, elW: 0, elH: 0, elScale: 1 });
  const pagesRef = useRef<DesignPage[]>(pages);
  const hasGeneratedRef = useRef(false);
  useEffect(() => { pagesRef.current = pages; }, [pages]);

  // ── Mutations ──
  const updatePages = useCallback((updater: (p: DesignPage[]) => DesignPage[]) => {
    const newPages = updater(pagesRef.current);
    setPages(newPages);
    const clean = JSON.parse(JSON.stringify(newPages, (_, v) => v === undefined ? null : v));
    onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { ...proj.projectData?.designData, pages: clean } } }));
  }, [onUpdateProject]);

  const updateCurrentPage = useCallback((updater: (p: DesignPage) => DesignPage) => {
    updatePages(ps => { const np = [...ps]; if (np[currentPageIndex]) np[currentPageIndex] = updater(np[currentPageIndex]); return np; });
  }, [updatePages, currentPageIndex]);

  const updateElementLocal = useCallback((id: string, updates: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) => {
    setPages(ps => {
      const np = [...ps];
      if (!np[currentPageIndex]) return ps;
      np[currentPageIndex] = { ...np[currentPageIndex], elements: np[currentPageIndex].elements.map(el => { if (el.id !== id) return el; const u = typeof updates === 'function' ? updates(el) : updates; return { ...el, ...u }; }) };
      return np;
    });
  }, [currentPageIndex]);

  const updateElement = useCallback((id: string, updates: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) => {
    updatePages(ps => {
      const np = [...ps];
      if (!np[currentPageIndex]) return ps;
      np[currentPageIndex] = { ...np[currentPageIndex], elements: np[currentPageIndex].elements.map(el => { if (el.id !== id) return el; const u = typeof updates === 'function' ? updates(el) : updates; return { ...el, ...u }; }) };
      return np;
    });
  }, [updatePages, currentPageIndex]);

  // Multi-update — batch updates all selected elements in one pass
  const updateMultipleElements = useCallback((ids: string[], updater: (el: DesignElement) => Partial<DesignElement>) => {
    updatePages(ps => {
      const np = [...ps];
      if (!np[currentPageIndex]) return ps;
      np[currentPageIndex] = {
        ...np[currentPageIndex],
        elements: np[currentPageIndex].elements.map(el => {
          if (!ids.includes(el.id)) return el;
          return { ...el, ...updater(el) };
        }),
      };
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

  // ── Init ──
  useEffect(() => {
    const existing = project.projectData?.designData?.pages;
    if (!existing || existing.length === 0) {
      hasGeneratedRef.current = true;
      const generated = generatePagesFromProject(project, people, relationships, 'template_cosmic');
      setPages(generated);
      setIsGenerating(false);
      onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { pages: generated } } }));
    } else { setIsGenerating(false); }
  }, []); // eslint-disable-line
  useEffect(() => { if (hasGeneratedRef.current) return; setPages(project.projectData?.designData?.pages || []); }, [project.projectData?.designData?.pages]);

  // ── Keyboard ──
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const isInput = document.activeElement && ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement).tagName);
      if (isInput && editingElementId) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length && !editingElementId) {
        e.preventDefault(); selectedIds.forEach(id => deleteElementById(id)); setSelectedIds([]);
      }
      if (e.key === 'Escape') { setSelectedIds([]); setEditingElementId(null); setActiveTool('select'); setCtxMenu(null); }
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
  }, [selectedIds, editingElementId, currentPageIndex, deleteElementById, duplicateElementById, addElementDirect]); // eslint-disable-line

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-ctx-menu]')) setCtxMenu(null); };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  // ── Derived ──
  const currentPage = pages[currentPageIndex];
  const template = DESIGN_TEMPLATES.find(t => t.id === (currentPage?.templateId || selectedTemplateId)) || DESIGN_TEMPLATES[0];
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedElement = selectedId ? currentPage?.elements.find(el => el.id === selectedId) : undefined;
  
  const addPage = () => {
    const newPage: DesignPage = { id: uuidv4(), pageNumber: pages.length + 1, pageType: 'custom', title: 'עמוד חדש', elements: [], templateId: selectedTemplateId };
    updatePages(ps => [...ps, newPage]);
    setCurrentPageIndex(pages.length);
  };

  const deletePage = (index: number) => {
    updatePages(ps => ps.filter((_, i) => i !== index).map((p, i) => ({ ...p, pageNumber: i + 1 })));
    setCurrentPageIndex(prev => Math.max(0, Math.min(prev, pages.length - 2)));
    setSelectedIds([]);
  };

  const handleResetPages = () => {
    hasGeneratedRef.current = true;
    const generated = generatePagesFromProject(project, people, relationships, selectedTemplateId);
    setPages(generated); setCurrentPageIndex(0); setSelectedIds([]);
    onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { pages: generated } } }));
    setShowResetConfirm(false);
    toast({ title: `✨ ההצגה נוצרה מחדש — ${generated.length} עמודים` });
  };

  // ── Drag ──
  const handleMouseDown = (e: React.MouseEvent, el: DesignElement) => {
    if (editingElementId || activeTool !== 'select' || !canvasRef.current) return;
    e.stopPropagation();
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
    isResizing.current = true; resizeHandle.current = handle;
    resizeStart.current = { 
        mouseX: e.clientX, 
        mouseY: e.clientY, 
        elX: el.x, elY: el.y, elW: el.width, elH: el.height,
        elScale: el.style?.scale || 1
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    if (isResizing.current && resizeHandle.current && selectedId) {
      const dx = ((e.clientX - resizeStart.current.mouseX) / rect.width) * 100;
      const dy = ((e.clientY - resizeStart.current.mouseY) / rect.height) * 100;
      const h = resizeHandle.current;
      
      updateElementLocal(selectedId, (el) => {
        let { elX: nx, elY: ny, elW: nw, elH: nh, elScale: ns } = resizeStart.current;
        const isCorner = h.length === 2;

        if (isCorner) {
            // Proportional scaling for corners.
            let newWidth;
            if (h === 'se' || h === 'ne') {
                newWidth = Math.max(5, resizeStart.current.elW + dx);
            } else { // sw, nw
                newWidth = Math.max(5, resizeStart.current.elW - dx);
            }
            
            const newScale = (newWidth / resizeStart.current.elW) * resizeStart.current.elScale;
            const newHeight = newWidth / (resizeStart.current.elW / resizeStart.current.elH);

            if (h === 'sw' || h === 'nw') nx = resizeStart.current.elX + (resizeStart.current.elW - newWidth);
            if (h === 'ne' || h === 'nw') ny = resizeStart.current.elY + (resizeStart.current.elH - newHeight);

            return { x: nx, y: ny, width: newWidth, height: newHeight, style: { ...el.style, scale: newScale }};
        } else {
            // Freeform scaling for sides. Does NOT change scale.
            if (h === 'e') nw = Math.max(5, nw + dx);
            if (h === 's') nh = Math.max(3, nh + dy);
            if (h === 'w') { nw = Math.max(5, nw - dx); nx = nx + dx; }
            if (h === 'n') { nh = Math.max(3, nh - dy); ny = ny + dy; }
            
            return { x: nx, y: ny, width: nw, height: nh };
        }
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
    const was = isDragging.current || isResizing.current;
    isDragging.current = false; dragIds.current = []; isResizing.current = false; resizeHandle.current = null;
    if (was) {
      const clean = JSON.parse(JSON.stringify(pagesRef.current, (_, v) => v === undefined ? null : v));
      onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { ...proj.projectData?.designData, pages: clean } } }));
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id !== 'canvas-container') return;
    if (activeTool === 'text') {
      addElement({ type: 'text', content: 'טקסט חדש', x: (e.nativeEvent.offsetX / target.offsetWidth) * 100, y: (e.nativeEvent.offsetY / target.offsetHeight) * 100, width: 20, height: 6, style: { fontSize: 18, color: template.textColor, fontFamily: template.bodyFont } });
      setActiveTool('select');
    } else if (activeTool === 'shape') {
      addElement({ type: 'shape', x: (e.nativeEvent.offsetX / target.offsetWidth) * 100 - 10, y: (e.nativeEvent.offsetY / target.offsetHeight) * 100 - 10, width: 20, height: 20, style: { shapeType: activeShapeType as ShapeType, backgroundColor: template.primaryColor, opacity: 0.85 } });
      setActiveTool('select');
    } else { setSelectedIds([]); setEditingElementId(null); }
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

  // ctx menu helpers
  const copyElement = (id: string) => { const el = currentPage?.elements.find(e => e.id === id); if (el) { _clipboard = el; toast({ title: 'הועתק ✓' }); } };
  const cutElement = (id: string) => { const el = currentPage?.elements.find(e => e.id === id); if (el) { _clipboard = el; deleteElementById(id); setSelectedIds([]); toast({ title: 'נגזר ✓' }); } };
  const pasteElement = () => { if (!_clipboard) return; const { id: _id, ...rest } = _clipboard; addElementDirect({ ...rest, id: uuidv4(), x: Math.min((_clipboard.x || 0) + 3, 70), y: Math.min((_clipboard.y || 0) + 3, 70) }); toast({ title: 'הודבק ✓' }); };
  const resetSize = (id: string) => { updateElement(id, { width: 30, height: 30, style: { ...(pages.find(p => p.elements.some(e => e.id === id))?.elements.find(e => e.id === id)?.style || {}), scale: 1 } }); toast({ title: 'גודל אופס' }); };

  // Open image picker for placeholder element
  const openImagePickerForPlaceholder = (elementId: string) => {
    setImagePlaceholderTarget(elementId);
    setShowImagePicker(true);
  };

  const handleImageSelected = (url: string) => {
    if (imagePlaceholderTarget) {
      // Replace placeholder with real image
      const el = currentPage?.elements.find(e => e.id === imagePlaceholderTarget);
      if (el) {
        updateElement(imagePlaceholderTarget, { type: 'image', content: url, style: { ...el.style, borderRadius: el.style?.borderRadius || 8 } });
      }
      setImagePlaceholderTarget(null);
    } else {
      addElement({ type: 'image', content: url, x: 10, y: 10, width: 40, height: 30, zIndex: 5, style: { borderRadius: 0, opacity: 1 } });
    }
    setShowImagePicker(false);
    setActiveTool('select');
  };

  // SVG connection line rendering
  const renderConnectionLine = (el: DesignElement, from: DesignElement, to: DesignElement, isSel: boolean) => {
    const x1p = from.x + from.width / 2;
    const y1p = from.y + from.height;
    const x2p = to.x + to.width / 2;
    const y2p = to.y;
    const lineType = (el.style as any)?.lineType || 'straight';
    const color = isSel ? '#60a5fa' : (el.style?.color || template.primaryColor);
    const sw = isSel ? (el.style?.borderWidth || 2) + 1 : (el.style?.borderWidth || 2);
    const dashArray = lineType === 'dashed' ? '8 4' : lineType === 'dotted' ? '2 6' : undefined;

    if (lineType === 'pcb') {
      // Right-angle PCB-style path
      const midY = (y1p + y2p) / 2;
      const d = `M ${x1p}% ${y1p}% L ${x1p}% ${midY}% L ${x2p}% ${midY}% L ${x2p}% ${y2p}%`;
      return (
        <g key={el.id} style={{ pointerEvents: 'stroke' }} onClick={e2 => { e2.stopPropagation(); setSelectedIds([el.id]); }} onContextMenu={e2 => handleContextMenu(e2, el.id)}>
          <path d={d} stroke="transparent" strokeWidth="12" fill="none" style={{ cursor: 'pointer' }} />
          <path d={d} stroke={color} strokeWidth={sw} fill="none" markerEnd="url(#arrow)" />
        </g>
      );
    }
    if (lineType === 'wavy') {
      const cx = (x1p + x2p) / 2;
      const d = `M ${x1p}% ${y1p}% Q ${cx - 8}% ${(y1p + y2p) / 2}% ${cx}% ${(y1p + y2p) / 2}% Q ${cx + 8}% ${(y1p + y2p) / 2}% ${x2p}% ${y2p}%`;
      return (
        <g key={el.id} style={{ pointerEvents: 'stroke' }} onClick={e2 => { e2.stopPropagation(); setSelectedIds([el.id]); }} onContextMenu={e2 => handleContextMenu(e2, el.id)}>
          <path d={d} stroke="transparent" strokeWidth="12" fill="none" style={{ cursor: 'pointer' }} />
          <path d={d} stroke={color} strokeWidth={sw} fill="none" markerEnd="url(#arrow)" />
        </g>
      );
    }
    return (
      <g key={el.id} style={{ pointerEvents: 'stroke' }} onClick={e2 => { e2.stopPropagation(); setSelectedIds([el.id]); }} onContextMenu={e2 => handleContextMenu(e2, el.id)}>
        <line x1={`${x1p}%`} y1={`${y1p}%`} x2={`${x2p}%`} y2={`${y2p}%`} stroke="transparent" strokeWidth="12" style={{ cursor: 'pointer' }} />
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

  if (pages.length === 0) return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6" style={{ background: DESIGN_TEMPLATES[0].backgroundGradient }}>
      <div className="text-6xl">📄</div>
      <h2 className="text-2xl font-extrabold text-white">אין עמודים</h2>
      <div className="flex gap-3">
        <button className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm" onClick={handleResetPages}>✨ צור עמודים אוטומטית</button>
        <button className="px-6 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm" onClick={addPage}>+ עמוד ריק</button>
        <button className="px-6 py-3 rounded-xl bg-transparent border border-white/20 text-white text-sm" onClick={onBack}>← חזור</button>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={500}>
      <div className="flex flex-col w-full h-full bg-slate-900 text-white select-none overflow-hidden" dir="rtl">

        {/* ══ HEADER ══ */}
        <header className="h-11 border-b border-white/10 bg-slate-900/95 backdrop-blur flex items-center justify-between px-3 gap-2 flex-shrink-0 z-20">
          {/* Right: back + title */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" aria-label="חזור לאשף" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>חזור לאשף עבודת השורשים</p></TooltipContent></Tooltip>
            <span className="text-sm font-bold truncate hidden sm:block">עורך העיצוב</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast({ title: 'ביטול פעולה יהיה זמין בקרוב!' })} disabled={true}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>בטל (Ctrl+Z)</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toast({ title: 'ביצוע מחדש יהיה זמין בקרוב!' })} disabled={true}>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>חזור (Ctrl+Y)</p></TooltipContent></Tooltip>
          </div>

          {/* Aspect ratio */}
          <div className="flex items-center flex-shrink-0">
            <DropdownMenu>
              <Tooltip><TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-transparent border-white/20 flex-shrink-0" aria-label="שנה יחס מידות הדף">
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
          </div>

          {/* Center tools */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-transparent border-white/20" aria-label="בחר תבנית עיצוב" onClick={() => setShowTemplatePicker(true)}>🎨 תבנית</Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>בחר תבנית עיצוב</p></TooltipContent></Tooltip>
            <div className="h-4 w-px bg-white/10 mx-1" />
            {([
              ['select', <MousePointer2 key="s" className="h-3.5 w-3.5" />, 'כלי בחירה — Ctrl+לחיצה לבחירה מרובה'],
              ['text', <Type key="t" className="h-3.5 w-3.5" />, 'הוסף תיבת טקסט — לחץ על הדף'],
              ['shape', <Square key="sh" className="h-3.5 w-3.5" />, 'הוסף צורה גיאומטרית'],
              ['person', <User key="p" className="h-3.5 w-3.5" />, 'הוסף כרטיס אדם מהמשפחה'],
              ['image', <ImageIcon key="i" className="h-3.5 w-3.5" />, 'הוסף תמונה'],
              ['icon', <Smile key="ic" className="h-3.5 w-3.5" />, 'הוסף אמוג׳י'],
            ] as const).map(([tool, icon, tip]) => (
              <Tooltip key={tool}><TooltipTrigger asChild>
                <Button variant={activeTool === tool ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" aria-label={tip}
                  onClick={() => {
                    if (tool === 'shape') { setShowShapePicker(true); setActiveTool('shape'); }
                    else if (tool === 'person') { setActiveTool('person'); setShowPersonPicker(true); }
                    else if (tool === 'image') { setActiveTool('image'); setImagePlaceholderTarget(null); setShowImagePicker(true); }
                    else if (tool === 'icon') { setActiveTool('icon'); setShowEmojiPicker(true); }
                    else setActiveTool(tool as any);
                  }}>
                  {icon}
                </Button>
              </TooltipTrigger><TooltipContent side="bottom"><p>{tip}</p></TooltipContent></Tooltip>
            ))}
            <div className="h-4 w-px bg-white/10 mx-1" />
            {/* Layers button */}
            <Tooltip><TooltipTrigger asChild>
              <Button variant={showLayers ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" aria-label="הצג שכבות" onClick={() => setShowLayers(!showLayers)}>
                <Layers className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>לוח שכבות — כל האלמנטים בעמוד</p></TooltipContent></Tooltip>
          </div>

          {/* Left */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-transparent border-white/20 text-slate-300 hover:text-white" aria-label="צור מחדש את כל ההצגה" onClick={() => setShowResetConfirm(true)}>
                <RefreshCw className="h-3 w-3 ml-1" />צור מחדש
              </Button>
            </TooltipTrigger><TooltipContent side="bottom"><p>מחק הכל ויצור מחדש מהנתונים שלך</p></TooltipContent></Tooltip>
            <DropdownMenu>
              <Tooltip><TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="default" size="sm" className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-500" aria-label="ייצא את ההצגה">ייצא ▾</Button>
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

          {/* Thumbnails — LEFT side (RTL: visually right in page, but DOM left so canvas isn't cut off) */}
          <aside className="w-[120px] flex-shrink-0 border-r border-white/8 bg-slate-900/60 flex flex-col overflow-hidden" style={{ order: 1 }}>
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
              {pages.map((page, index) => {
                const pt = DESIGN_TEMPLATES.find(t => t.id === page.templateId) || template;
                return (
                  <div key={`thumb-${index}-${page.id}`} title={`עמוד ${index + 1}: ${page.title}`}
                    className={cn('relative w-full rounded cursor-pointer border-2 group overflow-hidden transition-all', currentPageIndex === index ? 'border-indigo-500' : 'border-transparent hover:border-white/20')}
                    style={{ aspectRatio: canvasAspectRatio === 'a4-portrait' ? '1/1.414' : canvasAspectRatio === '9/16' ? '9/16' : canvasAspectRatio === '1:1' ? '1/1' : '1.414/1' }}
                    onClick={() => setCurrentPageIndex(index)}>
                    <div className="absolute inset-0" style={getPageBackground(page, pt)} />
                    {page.elements.filter(el => el.type === 'text').slice(0, 3).map((el, i) => (
                      <div key={`thumb-${index}-text-${el.id}-${i}`} className="absolute overflow-hidden"
                        style={{ top: `${el.y}%`, left: `${el.x}%`, width: `${el.width}%`, fontSize: 3, color: pt.textColor, fontWeight: el.style?.fontWeight === 'extrabold' ? 800 : el.style?.fontWeight === 'bold' ? 700 : 400, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                        {(el.content || '').slice(0, 20)}
                      </div>
                    ))}
                    {page.elements.filter(el => ['person_card', 'shape', 'image'].includes(el.type)).map((el, i) => (
                      <div key={`thumb-${index}-el-${el.id}-${i}`} className="absolute rounded-sm"
                        style={{ top: `${el.y}%`, left: `${el.x}%`, width: `${el.width}%`, height: `${el.height}%`, backgroundColor: el.type === 'person_card' ? (el.style?.backgroundColor || pt.cardBackground) : el.type === 'shape' ? (el.style?.backgroundColor || pt.primaryColor) : 'rgba(255,255,255,0.2)', backgroundImage: el.type === 'image' && el.content ? `url(${el.content})` : undefined, backgroundSize: 'cover', opacity: 0.8 }} />
                    ))}
                    <span className="absolute bottom-0.5 left-0.5 text-white/50 font-bold" style={{ fontSize: 5 }}>{page.pageNumber}</span>
                    <button title={`מחק עמוד "${page.title}"`} aria-label={`מחק עמוד ${index + 1}`}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 hover:bg-red-600"
                      style={{ fontSize: 8, pointerEvents: 'all' }}
                      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                      onClick={e => { e.stopPropagation(); e.preventDefault(); deletePage(index); }}>✕</button>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/8 p-1.5 space-y-1.5">
              <input className="w-full text-[10px] bg-slate-800 border border-white/10 rounded px-1.5 py-1 text-center text-white focus:outline-none focus:border-indigo-400" value={currentPage?.title || ''} onChange={e => updateCurrentPage(p => ({ ...p, title: e.target.value }))} dir="rtl" placeholder="שם עמוד" title="שנה שם לעמוד" />
              <button title="הוסף עמוד ריק חדש" aria-label="הוסף עמוד חדש" onClick={addPage} className="w-full text-[10px] py-1 rounded border border-dashed border-white/20 text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors">+ עמוד חדש</button>
            </div>
          </aside>

          {/* Canvas */}
          <main className="flex-1 flex items-center justify-center bg-[#13131f] overflow-hidden relative max-w-full mx-auto"
            style={{ order: 0 }}
            onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onContextMenu={e => handleContextMenu(e, null)}>

            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg,#333 25%,transparent 25%),linear-gradient(-45deg,#333 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#333 75%),linear-gradient(-45deg,transparent 75%,#333 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0' }} />

            {activeTool === 'select' && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 pointer-events-none select-none z-10 bg-black/30 px-2 py-0.5 rounded-full">
                Ctrl+לחיצה לבחירה מרובה · לחץ פעמיים לעריכת טקסט
              </div>
            )}

            {/* Layers panel */}
            {showLayers && (
              <LayersPanel
                page={currentPage}
                selectedIds={selectedIds}
                onSelect={id => setSelectedIds([id])}
                onDelete={id => { deleteElementById(id); setSelectedIds(s => s.filter(x => x !== id)); }}
                onToggleVisibility={() => {}}
                onClose={() => setShowLayers(false)}
              />
            )}

            <div className="relative shadow-2xl max-w-full mx-auto" style={{ ...getCanvasStyle(), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div id="canvas-container" ref={canvasRef} className="w-full h-full relative overflow-hidden"
                style={getPageBackground(currentPage, template)} onClick={handleCanvasClick} onContextMenu={e => handleContextMenu(e, null)}>

                <TemplateDecorations template={template} />

                {/* SVG lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 2 }}>
                  <defs>
                    <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <polygon points="0 0,8 3,0 6" fill={template.primaryColor} />
                    </marker>
                  </defs>
                  {currentPage?.elements.filter(el => el.type === 'connection_line').map((el) => {
                    const from = currentPage.elements.find(e => e.id === el.fromElementId);
                    const to = currentPage.elements.find(e => e.id === el.toElementId);
                    if (!from || !to) return null;
                    return renderConnectionLine(el, from, to, selectedIds.includes(el.id));
                  })}
                </svg>

                {/* Elements */}
                {currentPage?.elements.filter(el => el.type !== 'connection_line').map((el) => {
                  const isSel = selectedIds.includes(el.id);
                  return (
                    <div key={`el-${currentPageIndex}-${el.id}`}
                      title={el.type === 'text' ? (el.content || '').slice(0, 40) : el.type === 'person_card' ? `כרטיס: ${people.find(p => p.id === el.personId)?.firstName || 'אדם'}` : el.type}
                      className={cn('absolute', isSel ? 'outline outline-2 outline-blue-400 outline-offset-1' : '', activeTool === 'select' && !editingElementId ? 'cursor-grab active:cursor-grabbing' : '')}
                      style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, height: `${el.height}%`, zIndex: (el.zIndex || 1) + 3 }}
                      onMouseDown={e => handleMouseDown(e, el)}
                      onContextMenu={e => handleContextMenu(e, el.id)}>

                      {isSel && activeTool === 'select' && selectedIds.length === 1 && HANDLES.map(h => (
                        <div key={h.id} title={h.title} aria-label={h.title} onMouseDown={ev => handleResizeMouseDown(ev, el, h.id)}
                          className="absolute w-[10px] h-[10px] bg-white border-2 border-blue-500 rounded-sm z-50 hover:bg-blue-100"
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
                  <button aria-label="סגור" onClick={() => { setShowPersonPicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
                </div>
                <input className="m-2 px-2.5 py-1.5 bg-slate-700 rounded-lg text-xs text-right placeholder:text-slate-500 border border-white/10 focus:outline-none" placeholder="חפש שם..." value={personSearch} onChange={e => setPersonSearch(e.target.value)} dir="rtl" />
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {people.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(personSearch.toLowerCase())).map(person => (
                    <button key={person.id} title={`הוסף כרטיס של ${person.firstName} ${person.lastName}`}
                      onClick={() => { addElement({ type: 'person_card', personId: person.id, x: 20, y: 20, width: 28, height: 36, zIndex: 10, style: { scale: 1 } }); setShowPersonPicker(false); setActiveTool('select'); }}
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

            {/* Image picker */}
            {showImagePicker && (
              <ImagePickerModal treeId={project.treeId} onSelect={handleImageSelected} onClose={() => { setShowImagePicker(false); setImagePlaceholderTarget(null); setActiveTool('select'); }} />
            )}

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => { setShowEmojiPicker(false); setActiveTool('select'); }}>
                <div className="bg-slate-800 rounded-2xl p-4 w-72 shadow-2xl border border-white/10" onClick={e => e.stopPropagation()} dir="rtl">
                  <div className="flex items-center justify-between mb-3">
                    <button aria-label="סגור" onClick={() => { setShowEmojiPicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white">✕</button>
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
                    <button className="w-full mt-2 p-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-bold" onClick={() => { addElement({ type: 'icon', content: emojiInput, x: 40, y: 40, width: 10, height: 10, style: { fontSize: 32 }, zIndex: 15 }); setShowEmojiPicker(false); setActiveTool('select'); }}>
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
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { addPage(); setCtxMenu(null); }}>+ הוסף עמוד</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { setShowTemplatePicker(true); setCtxMenu(null); }}>🎨 שנה תבנית</button>
                    <div className="my-1 border-t border-white/10" />
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-red-500/20 text-red-400 flex items-center gap-2" onClick={() => { deletePage(currentPageIndex); setCtxMenu(null); }}><Trash2 className="w-3.5 h-3.5" />מחק עמוד זה</button>
                  </>
                )}
              </div>
            )}
          </main>
        </div>

        {/* ══ BOTTOM BAR ══ */}
        <div className="h-10 border-t border-white/10 bg-slate-900/90 backdrop-blur flex-shrink-0 flex items-center gap-1.5 px-3 overflow-x-auto overflow-y-hidden" style={{ minWidth: 0 }}>

          <span className="text-[10px] text-slate-500 whitespace-nowrap flex-shrink-0 w-14 text-right">
            {selectedElement ? (selectedElement.type === 'text' ? '✏️ טקסט' : selectedElement.type === 'person_card' ? '👤 כרטיס' : selectedElement.type === 'shape' ? '◼ צורה' : selectedElement.type === 'image' ? '🖼 תמונה' : selectedElement.type === 'icon' ? '😊 סמל' : selectedElement.type === 'connection_line' ? '↔ קו' : selectedElement.type === 'photo_placeholder' ? '📷 תמונה' : '?') : selectedIds.length > 1 ? `${selectedIds.length} נבחרו` : '📄 עמוד'}
          </span>
          <div className="w-px h-6 bg-white/10 flex-shrink-0" />

          {/* PAGE controls */}
          {!selectedElement && selectedIds.length === 0 && currentPage && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">רקע:</span>
              <div className="flex border border-white/10 rounded overflow-hidden">
                <button title="צבע רקע אחיד" onClick={() => setBgMode('solid')} className={cn('text-[10px] px-1.5 py-0.5', bgMode === 'solid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5')}>אחיד</button>
                <button title="רקע גרדיאנט" onClick={() => setBgMode('gradient')} className={cn('text-[10px] px-1.5 py-0.5', bgMode === 'gradient' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5')}>גרדיאנט</button>
              </div>
            </div>
            {bgMode === 'solid' ? (
              <Tooltip><TooltipTrigger asChild>
                <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent flex-shrink-0"
                  value={(currentPage as any).backgroundColor || template.backgroundColor}
                  onChange={e => updateCurrentPage(p => ({ ...p, backgroundColor: e.target.value, backgroundGradient: undefined as any }))} />
              </TooltipTrigger><TooltipContent side="top"><p>צבע רקע אחיד</p></TooltipContent></Tooltip>
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <Tooltip><TooltipTrigger asChild>
                  <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" value={gradientFrom}
                    onChange={e => { setGradientFrom(e.target.value); updateCurrentPage(p => ({ ...p, backgroundGradient: `linear-gradient(135deg, ${e.target.value} 0%, ${gradientTo} 100%)`, backgroundColor: undefined as any })); }} />
                </TooltipTrigger><TooltipContent side="top"><p>צבע התחלה</p></TooltipContent></Tooltip>
                <span className="text-[10px] text-slate-500">→</span>
                <Tooltip><TooltipTrigger asChild>
                  <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" value={gradientTo}
                    onChange={e => { setGradientTo(e.target.value); updateCurrentPage(p => ({ ...p, backgroundGradient: `linear-gradient(135deg, ${gradientFrom} 0%, ${e.target.value} 100%)`, backgroundColor: undefined as any })); }} />
                </TooltipTrigger><TooltipContent side="top"><p>צבע סיום</p></TooltipContent></Tooltip>
              </div>
            )}
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <Tooltip><TooltipTrigger asChild>
              <label className="cursor-pointer flex items-center gap-1 px-2 py-1 border border-dashed border-white/20 rounded text-[10px] text-slate-400 hover:border-indigo-400 flex-shrink-0">
                <ImageIcon className="w-3 h-3" />רקע תמונה
                <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => updateCurrentPage(p => ({ ...p, backgroundImage: ev.target?.result as string } as any)); reader.readAsDataURL(file); }} />
              </label>
            </TooltipTrigger><TooltipContent side="top"><p>תמונת רקע לעמוד</p></TooltipContent></Tooltip>
            {(currentPage as any).backgroundImage && (
              <button className="text-[10px] text-red-400 hover:text-red-300 flex-shrink-0" onClick={() => updateCurrentPage(p => ({ ...p, backgroundImage: undefined } as any))}>✕ הסר</button>
            )}
          </>)}

          {/* MULTI-SELECT controls — uses updateMultipleElements for correct batch alignment */}
          {selectedIds.length > 1 && (<>
            <Tooltip><TooltipTrigger asChild>
              <button className="text-[10px] px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-red-500 text-red-300 flex-shrink-0"
                onClick={() => { selectedIds.forEach(id => deleteElementById(id)); setSelectedIds([]); }}>
                🗑 מחק ({selectedIds.length})
              </button>
            </TooltipTrigger><TooltipContent side="top"><p>מחק כל האלמנטים הנבחרים</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button className="text-[10px] px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0" onClick={() => selectedIds.forEach(id => duplicateElementById(id))}>⎘ שכפל</button>
            </TooltipTrigger><TooltipContent side="top"><p>שכפל כל האלמנטים הנבחרים</p></TooltipContent></Tooltip>

            {/* Alignment — all use updateMultipleElements to batch-update ALL selected */}
            {[
              { l: '⊣', t: 'יישר לשמאל', a: () => updateMultipleElements(selectedIds, () => ({ x: 0 })) },
              { l: '⊢', t: 'יישר לימין', a: () => updateMultipleElements(selectedIds, el => ({ x: 100 - el.width })) },
              { l: '⊕H', t: 'מרכז אופקי', a: () => updateMultipleElements(selectedIds, el => ({ x: 50 - el.width / 2 })) },
              { l: '⊤', t: 'יישר לעליון', a: () => updateMultipleElements(selectedIds, () => ({ y: 0 })) },
              { l: '⊥', t: 'יישר לתחתון', a: () => updateMultipleElements(selectedIds, el => ({ y: 100 - el.height })) },
              { l: '⊕V', t: 'מרכז אנכי', a: () => updateMultipleElements(selectedIds, el => ({ y: 50 - el.height / 2 })) },
            ].map(({ l, t, a }) => (
              <Tooltip key={t}><TooltipTrigger asChild>
                <button title={t} aria-label={t} onClick={a} className="text-[10px] w-7 h-7 flex items-center justify-center rounded bg-slate-700 border border-slate-600 hover:border-indigo-400 flex-shrink-0">{l}</button>
              </TooltipTrigger><TooltipContent side="top"><p>{t}</p></TooltipContent></Tooltip>
            ))}
          </>)}

          {/* TEXT controls */}
          {selectedElement?.type === 'text' && (<>
            <Tooltip><TooltipTrigger asChild>
              <button className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded border border-white/15 bg-slate-800 hover:border-indigo-400 text-xs max-w-[130px] truncate" onClick={() => setShowFontPicker(true)}>
                <Type className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span className="truncate" style={{ fontFamily: selectedElement.style?.fontFamily || template.bodyFont }}>
                  {selectedElement.style?.fontFamily || template.bodyFont || 'Assistant'}
                </span>
              </button>
            </TooltipTrigger><TooltipContent side="top"><p>בחר גופן לטקסט</p></TooltipContent></Tooltip>

            <Tooltip><TooltipTrigger asChild>
              <input type="number" min={6} max={120} className="w-12 text-[10px] bg-slate-800 border border-white/10 rounded px-1 py-1 text-center text-white focus:outline-none flex-shrink-0"
                value={selectedElement.style?.fontSize || 16}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, fontSize: Number(e.target.value) } })} />
            </TooltipTrigger><TooltipContent side="top"><p>גודל גופן</p></TooltipContent></Tooltip>

            <div className="flex gap-0.5 flex-shrink-0">
              {(['normal','bold','extrabold'] as const).map((w, i) => (
                <Tooltip key={w}><TooltipTrigger asChild>
                  <button onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, fontWeight: w } })}
                    className={cn('text-[10px] w-7 h-7 rounded border font-bold', selectedElement.style?.fontWeight === w ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}
                    style={{ fontWeight: w === 'extrabold' ? 900 : w === 'bold' ? 700 : 400 }}>
                    {['R','B','BB'][i]}
                  </button>
                </TooltipTrigger><TooltipContent side="top"><p>{['רגיל','מודגש','מודגש מאוד'][i]}</p></TooltipContent></Tooltip>
              ))}
            </div>

            <div className="flex gap-0.5 flex-shrink-0">
              {([['right', <AlignRight key="r" className="w-3 h-3" />], ['center', <AlignCenter key="c" className="w-3 h-3" />], ['left', <AlignLeft key="l" className="w-3 h-3" />]] as const).map(([a, icon]) => (
                <Tooltip key={a as string}><TooltipTrigger asChild>
                  <button onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, textAlign: a as TextAlign } })}
                    className={cn('w-7 h-7 flex items-center justify-center rounded border', selectedElement.style?.textAlign === a ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}>{icon}</button>
                </TooltipTrigger><TooltipContent side="top"><p>יישור {a === 'right' ? 'ימין' : a === 'center' ? 'מרכז' : 'שמאל'}</p></TooltipContent></Tooltip>
              ))}
            </div>

            <Tooltip><TooltipTrigger asChild>
              <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
                value={selectedElement.style?.color || '#ffffff'}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, color: e.target.value } })} />
            </TooltipTrigger><TooltipContent side="top"><p>צבע טקסט</p></TooltipContent></Tooltip>

            <div className="flex gap-0.5 flex-shrink-0">
              {['#ffffff','#000000','#818cf8','#14b8a6','#f59e0b','#ef4444'].map(c => (
                <Tooltip key={c}><TooltipTrigger asChild>
                  <button className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform flex-shrink-0" style={{ backgroundColor: c }}
                    onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, color: c } })} />
                </TooltipTrigger><TooltipContent side="top"><p>{c}</p></TooltipContent></Tooltip>
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
            <Tooltip><TooltipTrigger asChild>
              <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
                value={selectedElement.style?.backgroundColor?.startsWith('#') ? selectedElement.style.backgroundColor : '#1e293b'}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, backgroundColor: e.target.value } })} />
            </TooltipTrigger><TooltipContent side="top"><p>צבע רקע כרטיס</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
                value={selectedElement.style?.color || '#ffffff'}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, color: e.target.value } })} />
            </TooltipTrigger><TooltipContent side="top"><p>צבע טקסט כרטיס</p></TooltipContent></Tooltip>
          </>)}

          {/* SHAPE controls */}
          {selectedElement?.type === 'shape' && (<>
            <Tooltip><TooltipTrigger asChild>
              <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
                value={selectedElement.style?.backgroundColor || template.primaryColor}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, backgroundColor: e.target.value } })} />
            </TooltipTrigger><TooltipContent side="top"><p>צבע הצורה</p></TooltipContent></Tooltip>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">שקיפות:</span>
              <input type="range" min={0} max={1} step={0.05} className="w-16"
                value={selectedElement.style?.opacity ?? 1}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) } })} />
            </div>
            <Tooltip><TooltipTrigger asChild>
              <button className="text-[10px] px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0" onClick={() => setShowShapePicker(true)}>שנה צורה</button>
            </TooltipTrigger><TooltipContent side="top"><p>שנה לצורה אחרת</p></TooltipContent></Tooltip>
          </>)}

          {/* IMAGE controls */}
          {(selectedElement?.type === 'image' || selectedElement?.type === 'photo_placeholder') && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">שקיפות:</span>
              <input type="range" min={0} max={1} step={0.05} className="w-14"
                value={selectedElement.style?.opacity ?? 1}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) } })} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">פינות:</span>
              <input type="range" min={0} max={200} step={4} className="w-14"
                value={selectedElement.style?.borderRadius ?? 0}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderRadius: Number(e.target.value) } })} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">מסגרת:</span>
              <input type="range" min={0} max={12} step={1} className="w-12"
                value={selectedElement.style?.borderWidth ?? 0}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderWidth: Number(e.target.value) } })} />
              <Tooltip><TooltipTrigger asChild>
                <input type="color" className="w-6 h-6 rounded cursor-pointer border border-white/10"
                  value={selectedElement.style?.borderColor || '#ffffff'}
                  onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderColor: e.target.value } })} />
              </TooltipTrigger><TooltipContent side="top"><p>צבע מסגרת</p></TooltipContent></Tooltip>
            </div>
            <Tooltip><TooltipTrigger asChild>
              <button className="text-[10px] px-2 py-1 border border-dashed border-white/20 rounded text-slate-400 hover:border-indigo-400 flex-shrink-0"
                onClick={() => { setImagePlaceholderTarget(selectedId!); setShowImagePicker(true); }}>
                🔄 החלף
              </button>
            </TooltipTrigger><TooltipContent side="top"><p>החלף תמונה</p></TooltipContent></Tooltip>
          </>)}

          {/* CONNECTION LINE controls */}
          {selectedElement?.type === 'connection_line' && (<>
            <Tooltip><TooltipTrigger asChild>
              <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 flex-shrink-0"
                value={selectedElement.style?.color || template.primaryColor}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, color: e.target.value } })} />
            </TooltipTrigger><TooltipContent side="top"><p>צבע קו</p></TooltipContent></Tooltip>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400">עובי:</span>
              <input type="range" min={1} max={8} step={1} className="w-12"
                value={selectedElement.style?.borderWidth || 2}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderWidth: Number(e.target.value) } })} />
            </div>
            {/* Line type picker */}
            <div className="flex gap-0.5 flex-shrink-0">
              {LINE_TYPES.map(lt => (
                <Tooltip key={lt.id}><TooltipTrigger asChild>
                  <button className={cn('text-[9px] px-1.5 py-1 rounded border flex-shrink-0', (selectedElement.style as any)?.lineType === lt.id ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}
                    onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, lineType: lt.id } as any })}>
                    {lt.label}
                  </button>
                </TooltipTrigger><TooltipContent side="top"><p>סוג קו: {lt.label}</p></TooltipContent></Tooltip>
              ))}
            </div>
          </>)}

          {/* SHARED single-element align + z-order + duplicate + delete */}
          {selectedElement && selectedElement.type !== 'connection_line' && (<>
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            {[
              { l: '⊣', t: 'יישר לשמאל', a: () => updateElement(selectedId!, { x: 0 }) },
              { l: '⊢', t: 'יישר לימין', a: () => updateElement(selectedId!, el => ({ x: 100 - el.width })) },
              { l: '⊕H', t: 'מרכז אופקי', a: () => updateElement(selectedId!, el => ({ x: 50 - el.width / 2 })) },
              { l: '⊤', t: 'יישר לעליון', a: () => updateElement(selectedId!, { y: 0 }) },
              { l: '⊥', t: 'יישר לתחתון', a: () => updateElement(selectedId!, el => ({ y: 100 - el.height })) },
              { l: '⊕V', t: 'מרכז אנכי', a: () => updateElement(selectedId!, el => ({ y: 50 - el.height / 2 })) },
            ].map(({ l, t, a }) => (
              <Tooltip key={t}><TooltipTrigger asChild>
                <button title={t} aria-label={t} onClick={a} className="w-7 h-7 flex items-center justify-center text-[10px] rounded bg-slate-700 border border-slate-600 hover:border-indigo-400 flex-shrink-0">{l}</button>
              </TooltipTrigger><TooltipContent side="top"><p>{t}</p></TooltipContent></Tooltip>
            ))}
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <Tooltip><TooltipTrigger asChild>
              <button onClick={() => updateElement(selectedId!, el => ({ zIndex: (el.zIndex || 0) + 1 }))} className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0"><ChevronUp className="w-3.5 h-3.5" /></button>
            </TooltipTrigger><TooltipContent side="top"><p>הבא קדימה</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button onClick={() => updateElement(selectedId!, el => ({ zIndex: Math.max(0, (el.zIndex || 0) - 1) }))} className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0"><ChevronDown className="w-3.5 h-3.5" /></button>
            </TooltipTrigger><TooltipContent side="top"><p>שלח אחורה</p></TooltipContent></Tooltip>
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <Tooltip><TooltipTrigger asChild>
              <button onClick={() => duplicateElementById(selectedId!)} className="w-7 h-7 flex items-center justify-center rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0"><Copy className="w-3.5 h-3.5" /></button>
            </TooltipTrigger><TooltipContent side="top"><p>שכפל אלמנט</p></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <button onClick={() => { deleteElementById(selectedId!); setSelectedIds([]); }} className="w-7 h-7 flex items-center justify-center rounded bg-red-900/60 border border-red-700/40 hover:bg-red-800/60 text-red-300 flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </TooltipTrigger><TooltipContent side="top"><p>מחק אלמנט</p></TooltipContent></Tooltip>
          </>)}
        </div>

        {/* ══ TEMPLATE PICKER (with font selector) ══ */}
        {showTemplatePicker && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplatePicker(false)}>
            <div className="bg-slate-800 rounded-2xl p-5 w-[680px] max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
                <h2 className="text-lg font-bold">בחר תבנית עיצוב</h2>
              </div>

              {/* Font override for whole template */}
              <div className="flex items-center gap-3 mb-4 p-3 bg-slate-700/50 rounded-xl border border-white/10">
                <span className="text-xs text-slate-300">גופן תבנית:</span>
                <select className="flex-1 text-xs bg-slate-800 border border-white/15 rounded-lg px-2 py-1.5 text-white"
                  value={templateFont || (DESIGN_TEMPLATES.find(t => t.id === selectedTemplateId)?.titleFont || '')}
                  onChange={e => {
                    setTemplateFont(e.target.value);
                    ensureFontLoaded(e.target.value);
                    // Apply font to all text elements in all pages
                    if (e.target.value) {
                      updatePages(ps => ps.map(pg => ({ ...pg, elements: pg.elements.map(el => el.type === 'text' ? { ...el, style: { ...el.style, fontFamily: e.target.value } } : el) })));
                    }
                  }}>
                  {FONT_CATALOG.filter(f => f.hebrewSupport).map(f => (
                    <option key={f.name} value={f.name} style={{ fontFamily: f.name }}>{f.label}</option>
                  ))}
                </select>
                <div className="text-xs text-slate-400" style={{ fontFamily: templateFont || template.titleFont }}>שלום</div>
              </div>

              <div className="flex items-center gap-2 mb-4 justify-end">
                <label className="text-xs text-slate-300">החל על כל העמודים</label>
                <button onClick={() => setApplyTemplateToAll(!applyTemplateToAll)}
                  className={cn('rounded-full relative flex-shrink-0 transition-colors', applyTemplateToAll ? 'bg-indigo-500' : 'bg-slate-600')} style={{ width: 36, height: 18 }}>
                  <div className={cn('absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all', applyTemplateToAll ? 'right-0.5' : 'left-0.5')} />
                </button>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {DESIGN_TEMPLATES.map(t => (
                    <button key={t.id} title={`תבנית: ${t.nameHebrew}`}
                      onClick={() => { setSelectedTemplateId(t.id); if (applyTemplateToAll) updatePages(ps => ps.map(pg => ({ ...pg, templateId: t.id }))); else updateCurrentPage(pg => ({ ...pg, templateId: t.id })); setShowTemplatePicker(false); }}
                      className={cn('rounded-xl overflow-hidden border-2 transition-all', selectedTemplateId === t.id ? 'border-indigo-400 scale-105' : 'border-transparent hover:border-white/30')}>
                      <div className="h-20 relative" style={{ background: t.backgroundGradient }}>
                        <div className="absolute inset-0 flex flex-col justify-center items-center gap-1.5 px-2">
                          <span style={{ fontFamily: t.titleFont, fontSize: 15, color: t.textColor, fontWeight: 700, direction: 'rtl', textAlign: 'center', lineHeight: 1.2 }}>שלום</span>
                          <div className="h-1 rounded-full w-8" style={{ background: t.primaryColor }} />
                          <div className="h-0.5 rounded-full w-5 opacity-50" style={{ backgroundColor: t.textColor }} />
                        </div>
                      </div>
                      <div className="py-1.5 px-1 text-center" style={{ backgroundColor: t.backgroundColor }}>
                        <p className="text-[10px] font-bold leading-tight" style={{ color: t.textColor }}>{t.nameHebrew}</p>
                        <p className="text-[8px] opacity-60" style={{ color: t.textColor, fontFamily: t.titleFont }}>{t.titleFont}</p>
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
              <p className="text-sm text-slate-400 mb-4">פעולה זו תמחק את כל העמודים הנוכחיים ותיצור מחדש. לא ניתן לבטל.</p>
              <div className="flex gap-2 justify-center">
                <button className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm" onClick={() => setShowResetConfirm(false)}>ביטול</button>
                <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold" onClick={handleResetPages}>✨ צור מחדש</button>
              </div>
            </div>
          </div>
        )}

        {/* ══ FONT PICKER MODAL ══ */}
        {showFontPicker && (
          <FontPickerModal
            current={selectedElement?.style?.fontFamily}
            onSelect={fontName => { if (selectedId) updateElement(selectedId, { style: { ...selectedElement?.style, fontFamily: fontName } }); }}
            onClose={() => setShowFontPicker(false)}
          />
        )}

        {/* ══ SHAPE PICKER MODAL ══ */}
        {showShapePicker && (
          <ShapePickerModal
            onSelect={shapeId => {
              setActiveShapeType(shapeId);
              if (selectedElement?.type === 'shape' && selectedId) {
                updateElement(selectedId, { style: { ...selectedElement.style, shapeType: shapeId as ShapeType } });
              }
            }}
            onClose={() => setShowShapePicker(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
