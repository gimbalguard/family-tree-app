'use client';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootsProject, Person, Relationship } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    ArrowLeft, ChevronDown, Circle, Diamond, GitMerge, Image as ImageIcon, LayoutPanelTop, MousePointer2, Pilcrow, Plus, Redo, RotateCcw, Smile, Square, Star, Trash2, Undo, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// TYPES
// ============================================================

export type ElementType =
  | 'text'
  | 'person_card'      // Family tree person card — same design as canvas
  | 'connection_line'  // Line connecting two elements
  | 'shape'            // Rectangle, circle, star, etc.
  | 'image'            // Uploaded photo
  | 'icon'             // Emoji or lucide icon
  | 'photo_placeholder'; // Auto-generated placeholder for student photo

export type ShapeType = 'rectangle' | 'rounded_rectangle' | 'circle' | 'star' | 'triangle' | 'diamond';

export type TextAlign = 'right' | 'left' | 'center';

export interface ElementStyle {
  // Text
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | 'extrabold';
  color?: string;
  textAlign?: TextAlign;
  fontFamily?: string;
  lineHeight?: number;
  // Background / Border
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  // Shape specific
  shapeType?: ShapeType;
  // Shadow
  shadow?: boolean;
}

export interface DesignElement {
  id: string;
  type: ElementType;
  // Position and size as percentages of page (0-100)
  x: number;
  y: number;
  width: number;
  height: number;
  // Content
  content?: string;           // text content or image URL
  personId?: string;          // for person_card type
  fromElementId?: string;     // for connection_line: source element id
  toElementId?: string;       // for connection_line: target element id
  iconName?: string;          // for icon type
  style?: ElementStyle;
  locked?: boolean;           // locked elements cannot be moved/deleted
  zIndex?: number;
}

export type PageType =
  | 'cover'
  | 'personal'
  | 'name'
  | 'nuclear_family'
  | 'roots_paternal'
  | 'roots_maternal'
  | 'roots_great'
  | 'heritage'
  | 'national_history'
  | 'custom';

export interface DesignPage {
  id: string;
  pageNumber: number;
  pageType: PageType;
  title: string;
  elements: DesignElement[];
  templateId: string;
  backgroundColor?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
}

export interface DesignTemplate {
  id: string;
  name: string;
  nameHebrew: string;
  thumbnail?: string;
  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardBackground: string;
  textColor: string;
  mutedTextColor: string;
  // Fonts
  titleFont: string;
  bodyFont: string;
  // Background style
  backgroundStyle: 'solid' | 'gradient' | 'cosmic' | 'paper' | 'geometric';
  backgroundGradient?: string;
  // New fields
  layoutStyle: 'modern' | 'classic' | 'minimal' | 'bold' | 'elegant' | 'playful' | 'heritage' | 'nature' | 'cosmic_dark' | 'bright';
  decorativePattern?: 'none' | 'dots' | 'lines' | 'corners' | 'border' | 'diagonal';
  cardStyle: 'glass' | 'solid' | 'outline' | 'shadow' | 'colorful';
  titleStyle: 'gradient' | 'outlined' | 'solid' | 'italic_serif' | 'bold_caps' | 'handwritten';
}

export type CanvasAspectRatio = 'free' | 'a4-landscape' | 'a4-portrait' | '16:9-landscape' | '9/16' | '1:1';

// ============================================================
// TEMPLATES & GENERATOR
// ============================================================

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'template_cosmic', name: 'Cosmic', nameHebrew: 'קוסמי',
    primaryColor: '#6366f1', secondaryColor: '#8b5cf6', accentColor: '#14b8a6', backgroundColor: '#0a0015',
    cardBackground: 'rgba(255,255,255,0.05)', textColor: '#f8fafc', mutedTextColor: '#94a3b8',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'cosmic', backgroundGradient: 'linear-gradient(135deg, #0a0015 0%, #000d1a 100%)',
    layoutStyle: 'cosmic_dark', decorativePattern: 'dots', cardStyle: 'glass', titleStyle: 'gradient',
  },
  {
    id: 'template_desert', name: 'Desert Sand', nameHebrew: 'חול המדבר',
    primaryColor: '#d97706', secondaryColor: '#b45309', accentColor: '#f59e0b', backgroundColor: '#1c1008',
    cardBackground: 'rgba(251,191,36,0.08)', textColor: '#fef3c7', mutedTextColor: '#d97706',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient', backgroundGradient: 'linear-gradient(135deg, #1c1008 0%, #2d1b00 100%)',
    layoutStyle: 'heritage', decorativePattern: 'border', cardStyle: 'solid', titleStyle: 'bold_caps',
  },
  {
    id: 'template_forest', name: 'Forest', nameHebrew: 'יער',
    primaryColor: '#16a34a', secondaryColor: '#15803d', accentColor: '#4ade80', backgroundColor: '#0a1f0a',
    cardBackground: 'rgba(74,222,128,0.07)', textColor: '#f0fdf4', mutedTextColor: '#86efac',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient', backgroundGradient: 'linear-gradient(135deg, #0a1f0a 0%, #052e16 100%)',
    layoutStyle: 'nature', decorativePattern: 'corners', cardStyle: 'shadow', titleStyle: 'italic_serif',
  },
  {
    id: 'template_ocean', name: 'Ocean', nameHebrew: 'ים',
    primaryColor: '#0284c7', secondaryColor: '#0369a1', accentColor: '#38bdf8', backgroundColor: '#0a1628',
    cardBackground: 'rgba(56,189,248,0.07)', textColor: '#f0f9ff', mutedTextColor: '#7dd3fc',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient', backgroundGradient: 'linear-gradient(135deg, #0a1628 0%, #001e3c 100%)',
    layoutStyle: 'minimal', decorativePattern: 'lines', cardStyle: 'glass', titleStyle: 'gradient',
  },
  {
    id: 'template_rose', name: 'Rose Gold', nameHebrew: 'זהב ורוד',
    primaryColor: '#e11d48', secondaryColor: '#be185d', accentColor: '#fb7185', backgroundColor: '#1a0a0f',
    cardBackground: 'rgba(251,113,133,0.07)', textColor: '#fff1f2', mutedTextColor: '#fda4af',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient', backgroundGradient: 'linear-gradient(135deg, #1a0a0f 0%, #2d0a1a 100%)',
    layoutStyle: 'elegant', decorativePattern: 'corners', cardStyle: 'solid', titleStyle: 'italic_serif',
  },
  {
    id: 'template_parchment', name: 'Parchment', nameHebrew: 'קלף עתיק',
    primaryColor: '#92400e', secondaryColor: '#78350f', accentColor: '#d97706', backgroundColor: '#fef3c7',
    cardBackground: 'rgba(146,64,14,0.08)', textColor: '#1c1917', mutedTextColor: '#78350f',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'paper', backgroundGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    layoutStyle: 'classic', decorativePattern: 'border', cardStyle: 'outline', titleStyle: 'italic_serif',
  },
  {
    id: 'template_midnight', name: 'Midnight Blue', nameHebrew: 'חצות כחול',
    primaryColor: '#4f46e5', secondaryColor: '#3730a3', accentColor: '#818cf8', backgroundColor: '#030712',
    cardBackground: 'rgba(79,70,229,0.1)', textColor: '#eef2ff', mutedTextColor: '#a5b4fc',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'cosmic', backgroundGradient: 'linear-gradient(135deg, #030712 0%, #0f0a2e 100%)',
    layoutStyle: 'bold', decorativePattern: 'none', cardStyle: 'colorful', titleStyle: 'outlined',
  },
  {
    id: 'template_spring', name: 'Spring', nameHebrew: 'אביב',
    primaryColor: '#0891b2', secondaryColor: '#0e7490', accentColor: '#67e8f9', backgroundColor: '#f0fdff',
    cardBackground: 'rgba(8,145,178,0.08)', textColor: '#164e63', mutedTextColor: '#0e7490',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'paper', backgroundGradient: 'linear-gradient(135deg, #f0fdff 0%, #e0f2fe 100%)',
    layoutStyle: 'bright', decorativePattern: 'dots', cardStyle: 'shadow', titleStyle: 'handwritten',
  },
  {
    id: 'template_sunset', name: 'Sunset', nameHebrew: 'שקיעה',
    primaryColor: '#ea580c', secondaryColor: '#c2410c', accentColor: '#fb923c', backgroundColor: '#1a0a00',
    cardBackground: 'rgba(251,146,60,0.08)', textColor: '#fff7ed', mutedTextColor: '#fed7aa',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient', backgroundGradient: 'linear-gradient(135deg, #1a0a00 0%, #431407 100%)',
    layoutStyle: 'playful', decorativePattern: 'diagonal', cardStyle: 'colorful', titleStyle: 'bold_caps',
  },
  {
    id: 'template_silver', name: 'Silver', nameHebrew: 'כסף',
    primaryColor: '#475569', secondaryColor: '#334155', accentColor: '#94a3b8', backgroundColor: '#f8fafc',
    cardBackground: 'rgba(71,85,105,0.07)', textColor: '#0f172a', mutedTextColor: '#475569',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'paper', backgroundGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    layoutStyle: 'minimal', decorativePattern: 'lines', cardStyle: 'outline', titleStyle: 'solid',
  },
];

function generatePagesFromProject(
  project: RootsProject,
  people: Person[],
  relationships: Relationship[],
  templateId: string
): DesignPage[] {
  const pages: DesignPage[] = [];
  let pageNumber = 1;

  const student = people.find(p => p.id === project.studentPersonId);

  // 1. Cover Page
  pages.push({
    id: 'page_cover',
    pageNumber: pageNumber++,
    pageType: 'cover',
    title: 'שער',
    templateId,
    elements: [
      {
        id: 'page_cover_title',
        type: 'text',
        content: project.projectData?.projectName || 'עבודת שורשים',
        x: 10, y: 30, width: 80, height: 20,
        style: { fontSize: 48, fontWeight: 'extrabold', textAlign: 'center' }
      },
      {
        id: 'page_cover_student_name',
        type: 'text',
        content: student ? `${student.firstName} ${student.lastName}` : '',
        x: 10, y: 50, width: 80, height: 10,
        style: { fontSize: 24, textAlign: 'center' }
      }
    ]
  });

  // 2. Name Page
  if (project.projectData?.personalStory?.nameMeaning) {
    pages.push({
      id: 'page_name',
      pageNumber: pageNumber++,
      pageType: 'name',
      title: 'השם שלי',
      templateId,
      elements: [
        { id: 'page_name_title', type: 'text', content: 'השם שלי', x: 10, y: 10, width: 80, height: 10, style: { fontSize: 36, fontWeight: 'bold', textAlign: 'center' } },
        { id: 'page_name_meaning_text', type: 'text', content: project.projectData.personalStory.nameMeaning, x: 15, y: 25, width: 70, height: 60, style: { fontSize: 16 } },
      ]
    });
  }

  // 3. Nuclear Family
  const parentRels = relationships.filter(r => r.personBId === project.studentPersonId && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType));
  const parents = parentRels.map(r => people.find(p => p.id === r.personAId)).filter(Boolean) as Person[];

  const nuclearFamilyElements: DesignElement[] = [];
  if (student) {
    nuclearFamilyElements.push({
      id: 'page_nuclear_family_student_card',
      type: 'person_card',
      personId: student.id,
      x: 35, y: 60, width: 30, height: 15,
      zIndex: 10
    });
  }
  parents.forEach((parent, index) => {
    nuclearFamilyElements.push({
      id: `page_nuclear_family_parent_${parent.id}_card`,
      type: 'person_card',
      personId: parent.id,
      x: 20 + (index * 40), y: 20, width: 30, height: 15,
      zIndex: 10
    });
    if (student) {
      nuclearFamilyElements.push({
          id: `page_nuclear_family_conn_${parent.id}`,
          type: 'connection_line',
          fromElementId: `page_nuclear_family_parent_${parent.id}_card`,
          toElementId: 'page_nuclear_family_student_card',
          zIndex: 1
      });
    }
  });

  if (nuclearFamilyElements.length > 0) {
    pages.push({
      id: 'page_nuclear_family',
      pageNumber: pageNumber++,
      pageType: 'nuclear_family',
      title: 'המשפחה הגרעינית',
      templateId,
      elements: nuclearFamilyElements
    });
  }

  // Page 4 — My Story (if birthStory exists):
  if (project.projectData?.personalStory?.birthStory) {
    pages.push({
      id: 'page_story',
      pageNumber: pageNumber++,
      pageType: 'personal',
      title: 'הסיפור שלי',
      templateId,
      elements: [
        { id: 'page_story_title', type: 'text', content: 'הסיפור שלי', x: 5, y: 5, width: 90, height: 10, style: { fontSize: 36, fontWeight: 'extrabold', textAlign: 'right' } },
        { id: 'page_story_birth_label', type: 'text', content: 'סיפור הלידה:', x: 5, y: 18, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
        { id: 'page_story_birth', type: 'text', content: project.projectData.personalStory.birthStory, x: 5, y: 24, width: 90, height: 30, style: { fontSize: 13, textAlign: 'right' } },
        ...(project.projectData.personalStory.personalVision ? [
          { id: 'page_story_vision_label', type: 'text', content: 'החזון שלי:', x: 5, y: 57, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
          { id: 'page_story_vision', type: 'text', content: project.projectData.personalStory.personalVision, x: 5, y: 63, width: 90, height: 30, style: { fontSize: 13, textAlign: 'right' } },
        ] as DesignElement[] : []),
      ]
    });
  }

  // Page 5 — Paternal Roots
  const paternalGF = project.projectData?.familyRoots?.paternalGrandfather;
  const paternalGM = project.projectData?.familyRoots?.paternalGrandmother;
  if (paternalGF || paternalGM) {
    const paternalElements: DesignElement[] = [
      { id: 'page_paternal_title', type: 'text', content: 'שורשים מצד אבא', x: 5, y: 3, width: 90, height: 8, style: { fontSize: 30, fontWeight: 'extrabold', textAlign: 'right' } },
    ];
    if (paternalGF?.personId) {
      paternalElements.push({ id: 'page_paternal_gf_card', type: 'person_card', personId: paternalGF.personId, x: 5, y: 14, width: 28, height: 22, zIndex: 10 });
    }
    if (paternalGF?.story) {
      paternalElements.push({ id: 'page_paternal_gf_story', type: 'text', content: paternalGF.story, x: 35, y: 14, width: 60, height: 22, style: { fontSize: 11, textAlign: 'right' } });
    }
    if (paternalGM?.personId) {
      paternalElements.push({ id: 'page_paternal_gm_card', type: 'person_card', personId: paternalGM.personId, x: 5, y: 42, width: 28, height: 22, zIndex: 10 });
    }
    if (paternalGM?.story) {
      paternalElements.push({ id: 'page_paternal_gm_story', type: 'text', content: paternalGM.story, x: 35, y: 42, width: 60, height: 22, style: { fontSize: 11, textAlign: 'right' } });
    }
    pages.push({
      id: 'page_paternal_roots',
      pageNumber: pageNumber++,
      pageType: 'roots_paternal',
      title: 'שורשים מצד אבא',
      templateId,
      elements: paternalElements
    });
  }

  // Page 6 — Maternal Roots
  const maternalGF = project.projectData?.familyRoots?.maternalGrandfather;
  const maternalGM = project.projectData?.familyRoots?.maternalGrandmother;
  if (maternalGF || maternalGM) {
    const maternalElements: DesignElement[] = [
        { id: 'page_maternal_title', type: 'text', content: 'שורשים מצד אמא', x: 5, y: 3, width: 90, height: 8, style: { fontSize: 30, fontWeight: 'extrabold', textAlign: 'right' } },
    ];
    if (maternalGF?.personId) {
        maternalElements.push({ id: 'page_maternal_gf_card', type: 'person_card', personId: maternalGF.personId, x: 5, y: 14, width: 28, height: 22, zIndex: 10 });
    }
    if (maternalGF?.story) {
        maternalElements.push({ id: 'page_maternal_gf_story', type: 'text', content: maternalGF.story, x: 35, y: 14, width: 60, height: 22, style: { fontSize: 11, textAlign: 'right' } });
    }
    if (maternalGM?.personId) {
        maternalElements.push({ id: 'page_maternal_gm_card', type: 'person_card', personId: maternalGM.personId, x: 5, y: 42, width: 28, height: 22, zIndex: 10 });
    }
    if (maternalGM?.story) {
        maternalElements.push({ id: 'page_maternal_gm_story', type: 'text', content: maternalGM.story, x: 35, y: 42, width: 60, height: 22, style: { fontSize: 11, textAlign: 'right' } });
    }
    pages.push({
        id: 'page_maternal_roots',
        pageNumber: pageNumber++,
        pageType: 'roots_maternal',
        title: 'שורשים מצד אמא',
        templateId,
        elements: maternalElements
    });
  }

  // Page 7 — Heritage
  const heritage = project.projectData?.heritage;
  if (heritage?.inheritedObject || heritage?.familyRecipe || heritage?.familyNameOrigin) {
    pages.push({
      id: 'page_heritage',
      pageNumber: pageNumber++,
      pageType: 'heritage',
      title: 'מורשת משפחתית',
      templateId,
      elements: [
        { id: 'page_heritage_title', type: 'text', content: 'מורשת משפחתית', x: 5, y: 3, width: 90, height: 8, style: { fontSize: 30, fontWeight: 'extrabold', textAlign: 'right' } },
        ...(heritage.inheritedObject ? [
          { id: 'page_heritage_obj_label', type: 'text', content: '💎 חפץ עובר בירושה', x: 5, y: 14, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
          { id: 'page_heritage_obj', type: 'text', content: heritage.inheritedObject, x: 5, y: 20, width: 90, height: 15, style: { fontSize: 12, textAlign: 'right' } },
        ] as DesignElement[] : []),
        ...(heritage.familyRecipe ? [
          { id: 'page_heritage_recipe_label', type: 'text', content: '🍽️ מתכון משפחתי', x: 5, y: 38, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
          { id: 'page_heritage_recipe', type: 'text', content: heritage.familyRecipe, x: 5, y: 44, width: 90, height: 15, style: { fontSize: 12, textAlign: 'right' } },
        ] as DesignElement[] : []),
        ...(heritage.familyNameOrigin ? [
          { id: 'page_heritage_name_label', type: 'text', content: 'מקור שם המשפחה', x: 5, y: 62, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
          { id: 'page_heritage_name', type: 'text', content: heritage.familyNameOrigin, x: 5, y: 68, width: 90, height: 15, style: { fontSize: 12, textAlign: 'right' } },
        ] as DesignElement[] : []),
      ]
    });
  }

  return pages;
}

// ============================================================
// EDITOR COMPONENTS
// ============================================================

const PersonCardElement = ({ element, people, relationships }: { element: DesignElement, people: Person[], relationships: Relationship[] }) => {
  const person = people.find(p => p.id === element.personId);
  if (!person) return null;

  const childCount = relationships.filter(r => r.personAId === person.id && r.relationshipType === 'parent').length;
  const siblingCount = relationships.filter(r => (r.personAId === person.id || r.personBId === person.id) && r.relationshipType === 'sibling').length;
  const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
  const deathYear = person.deathDate ? new Date(person.deathDate as string).getFullYear() : null;
  const age = birthYear ? (deathYear ? deathYear - birthYear : new Date().getFullYear() - birthYear) : null;
  
  const displayName = [
    person.firstName,
    person.nickname ? `"${person.nickname}"` : null,
    person.lastName
  ].filter(Boolean).join(' ');

  const bgColor = element.style?.backgroundColor || 'rgba(255,255,255,0.08)';
  const textColor = element.style?.color || '#ffffff';
  const opacity = element.style?.opacity ?? 1;

  return (
    <div 
      className="w-full h-full rounded-2xl p-2 flex flex-col items-center gap-1 shadow-xl overflow-hidden border border-white/15 backdrop-blur-xl"
      style={{ backgroundColor: bgColor, opacity, color: textColor }}
    >
      <div className="w-10 h-10 rounded-full border-2 border-white/30 overflow-hidden flex-shrink-0 mt-1">
        <img src={person.photoURL || getPlaceholderImage(person.gender)} alt="" className="w-full h-full object-cover" />
      </div>
      <p className="font-bold text-xs text-center leading-tight px-1" style={{ color: textColor }}>{displayName}</p>
      {(birthYear || deathYear) && (
        <p className="text-xs text-center opacity-70" style={{ color: textColor }}>
          {person.birthDate ? format(new Date(person.birthDate), 'dd/MM/yyyy') : ''}
          {deathYear ? ` – ${format(new Date(person.deathDate as string), 'dd/MM/yyyy')}` : ''}
          {age ? ` (גיל ${age})` : ''}
        </p>
      )}
      {person.birthPlace && (
        <p className="text-xs text-center opacity-60 truncate w-full px-1" style={{ color: textColor }}>📍 {person.birthPlace}</p>
      )}
      <div className="flex items-center justify-center gap-2 mt-auto pb-1">
        {childCount > 0 && <span className="text-xs opacity-60" style={{ color: textColor }}>👶 {childCount}</span>}
        {siblingCount > 0 && <span className="text-xs opacity-60" style={{ color: textColor }}>👥 {siblingCount}</span>}
      </div>
    </div>
  );
};

const TemplateDecorations = ({ template }: { template: DesignTemplate }) => {
  const pattern = template.decorativePattern || 'none';
  
  if (pattern === 'corners') return (
    <>
      {/* Corner decorations */}
      <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 opacity-40" style={{ borderColor: template.primaryColor }} />
      <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 opacity-40" style={{ borderColor: template.primaryColor }} />
      <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 opacity-40" style={{ borderColor: template.primaryColor }} />
      <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 opacity-40" style={{ borderColor: template.primaryColor }} />
    </>
  );
  
  if (pattern === 'border') return (
    <div className="absolute inset-3 border-2 opacity-20 pointer-events-none rounded-sm" style={{ borderColor: template.primaryColor }} />
  );

  if (pattern === 'dots') return (
    <div className="absolute inset-0 pointer-events-none opacity-10" style={{
      backgroundImage: `radial-gradient(circle, ${template.primaryColor} 1px, transparent 1px)`,
      backgroundSize: '24px 24px'
    }} />
  );

  if (pattern === 'lines') return (
    <div className="absolute inset-0 pointer-events-none opacity-5" style={{
      backgroundImage: `repeating-linear-gradient(0deg, ${template.primaryColor}, ${template.primaryColor} 1px, transparent 1px, transparent 40px)`
    }} />
  );

  if (pattern === 'diagonal') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full" style={{ background: template.primaryColor, filter: 'blur(60px)' }} />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full" style={{ background: template.accentColor, filter: 'blur(60px)' }} />
    </div>
  );

  return null;
};

function MyFilesImageGrid({ treeId, onSelectImage }: { treeId: string, onSelectImage: (url: string) => void }) {
  const [files, setFiles] = useState<Array<{name: string, url: string, type: string}>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch from Firebase Storage — list files in /trees/{treeId}/files/ and /users/{userId}/files/
    // Use the same storage path as the My Files feature
    const fetchFiles = async () => {
      try {
        const { getStorage, ref, listAll, getDownloadURL } = await import('firebase/storage');
        const storage = getStorage();
        
        // Try to list from the tree's files folder
        const folderRef = ref(storage, `trees/${treeId}/files`);
        const result = await listAll(folderRef);
        
        const imageFiles = await Promise.all(
          result.items
            .filter(item => /\.(png|jpg|jpeg|gif|webp)$/i.test(item.name))
            .map(async (item) => ({
              name: item.name,
              url: await getDownloadURL(item),
              type: 'image'
            }))
        );
        setFiles(imageFiles);
      } catch (err) {
        console.error('Could not load files:', err);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [treeId]);

  if (loading) return <div className="text-xs text-slate-500 text-center py-4">טוען קבצים...</div>;
  if (files.length === 0) return (
    <div className="text-xs text-slate-500 text-center py-4">
      <p>אין תמונות בקבצים שלך</p>
      <p className="mt-1 opacity-70">העלה תמונות דרך עמוד "הקבצים שלי"</p>
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {files.map((file) => (
        <button
          key={file.name}
          onClick={() => onSelectImage(file.url)}
          className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-indigo-400 transition-colors"
        >
          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}


export function RootsDesignEditor({ project, people, relationships, onBack, onUpdateProject }: {
  project: RootsProject;
  people: Person[];
  relationships: Relationship[];
  onBack: () => void;
  onUpdateProject: (updater: (p: RootsProject) => RootsProject) => void;
}) {
  const isGenerating = !project.projectData?.designData?.pages;
  
  const [pages, setPages] = useState<DesignPage[]>(project.projectData?.designData?.pages || []);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'shape' | 'person' | 'image' | 'icon' | 'line'>('select');
  const [selectedTemplateId, setSelectedTemplateId] = useState(project.projectData?.designData?.templateId || 'template_cosmic');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [canvasAspectRatio, setCanvasAspectRatio] = useState<CanvasAspectRatio>('a4-landscape');
  const [showImagePicker, setShowImagePicker] = useState(false);
  
  const { toast } = useToast();

  const isDragging = useRef(false);
  const dragElementId = useRef<string | null>(null);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, elX: 0, elY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const currentPage = pages[currentPageIndex];
  const template = DESIGN_TEMPLATES.find(t => t.id === (currentPage?.templateId || selectedTemplateId)) || DESIGN_TEMPLATES[0];

  useEffect(() => {
    const existingPages = project.projectData?.designData?.pages;
    if (!existingPages || existingPages.length === 0) {
      const generated = generatePagesFromProject(project, people, relationships, 'template_cosmic');
      onUpdateProject(proj => ({
        ...proj,
        projectData: {
          ...proj.projectData,
          designData: { pages: generated, templateId: 'template_cosmic' }
        }
      }));
    }
  }, []);
  
  useEffect(() => {
    setPages(project.projectData?.designData?.pages || []);
  }, [project.projectData?.designData?.pages]);


  const updatePages = (updater: (currentPages: DesignPage[]) => DesignPage[]) => {
    const newPages = updater(pages);
    setPages(newPages);
    onUpdateProject(proj => ({
      ...proj,
      projectData: {
        ...proj.projectData,
        designData: { ...proj.projectData?.designData, pages: newPages }
      }
    }));
  };

  const updateCurrentPage = (updater: (page: DesignPage) => DesignPage) => {
    updatePages(currentPages => {
        const newPages = [...currentPages];
        if (newPages[currentPageIndex]) {
            newPages[currentPageIndex] = updater(newPages[currentPageIndex]);
        }
        return newPages;
    });
  };

  const addElement = (element: Omit<DesignElement, 'id'>) => {
    const newElement = { ...element, id: uuidv4() };
    updateCurrentPage(page => ({
      ...page,
      elements: [...page.elements, newElement]
    }));
  };

  const updateElement = (id: string, updates: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) => {
    updateCurrentPage(page => ({
      ...page,
      elements: page.elements.map(el => {
        if (el.id === id) {
            const finalUpdates = typeof updates === 'function' ? updates(el) : updates;
            return { ...el, ...finalUpdates };
        }
        return el;
      })
    }));
  };

  const deleteElement = (id: string) => {
    updateCurrentPage(page => ({
      ...page,
      elements: page.elements.filter(el => el.id !== id)
    }));
    setSelectedElementId(null);
  };
  
  const addPage = () => {
    const newPage: DesignPage = {
      id: `page_custom_${Date.now()}`,
      pageNumber: pages.length + 1,
      pageType: 'custom',
      title: 'עמוד חדש',
      elements: [],
      templateId: selectedTemplateId,
    };
    updatePages(currentPages => [...currentPages, newPage]);
    setCurrentPageIndex(pages.length);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id !== 'canvas-container') return;

    if (activeTool === 'text') {
        addElement({
            type: 'text',
            content: 'טקסט חדש',
            x: (e.nativeEvent.offsetX / target.offsetWidth) * 100,
            y: (e.nativeEvent.offsetY / target.offsetHeight) * 100,
            width: 30, height: 10,
            style: { fontSize: 16, color: template.textColor }
        });
        setActiveTool('select');
    } else {
        setSelectedElementId(null);
    }
  }

  const handleMouseDown = (e: React.MouseEvent, el: DesignElement) => {
    if (activeTool !== 'select' || !canvasRef.current) return;
    e.stopPropagation();
    setSelectedElementId(el.id);
    isDragging.current = true;
    dragElementId.current = el.id;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    dragStart.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        elX: el.x,
        elY: el.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !dragElementId.current || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.current.mouseX) / canvasRect.width) * 100;
    const dy = ((e.clientY - dragStart.current.mouseY) / canvasRect.height) * 100;

    updateElement(dragElementId.current, (el) => {
        const newX = Math.max(0, Math.min(100 - el.width, dragStart.current.elX + dx));
        const newY = Math.max(0, Math.min(100 - el.height, dragStart.current.elY + dy));
        return { x: newX, y: newY };
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    dragElementId.current = null;
  };

  if (isGenerating) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-6"
        style={{ background: template.backgroundGradient }}
      >
        <div className="text-6xl animate-bounce">✨</div>
        <h2 className="text-2xl font-extrabold text-white">בונה את עבודת השורשים שלך...</h2>
        <p className="text-slate-400">מנתח את כל המידע שאספת</p>
      </div>
    );
  }

  const selectedElement = currentPage?.elements.find(el => el.id === selectedElementId);
  
  const aspectClass = {
    'a4-landscape': 'aspect-[1.414/1]',
    'a4-portrait': 'aspect-[1/1.414]',
    '16:9-landscape': 'aspect-video',
    '9/16': 'aspect-[9/16]',
    '1:1': 'aspect-square',
    'free': 'aspect-[1.414/1]',
  }[canvasAspectRatio] || 'aspect-[1.414/1]';

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-white" dir="rtl">
        <header className="h-12 border-b border-white/10 px-4 flex items-center justify-between flex-shrink-0 z-20">
            <div className='flex items-center gap-4'>
                <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="ml-2 h-4 w-4" />חזור לאשף</Button>
                <Separator orientation="vertical" className='h-6 bg-white/10'/>
                <h1 className='font-bold text-sm'>{project.projectData.projectName}</h1>
                 <DropdownMenu>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <LayoutPanelTop className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>יחס תצוגה</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <DropdownMenuContent>
                       {/* ... dropdown items */}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className='flex items-center gap-2'>
                 <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setShowTemplatePicker(true)}>בחר תבנית</Button>
                 <Separator orientation="vertical" className='h-6 bg-white/10'/>
                <TooltipProvider>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'select' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('select')}><MousePointer2 /></Button></TooltipTrigger><TooltipContent><p>בחר</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'text' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('text')}><Pilcrow /></Button></TooltipTrigger><TooltipContent><p>טקסט</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'shape' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('shape')}><Square /></Button></TooltipTrigger><TooltipContent><p>צורה</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'person' ? 'secondary' : 'ghost'} size="icon" onClick={() => {setActiveTool('person'); setShowPersonPicker(true);}}><User /></Button></TooltipTrigger><TooltipContent><p>כרטיס אדם</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'image' ? 'secondary' : 'ghost'} size="icon" onClick={() => { setActiveTool('image'); setShowImagePicker(true); }}><ImageIcon /></Button></TooltipTrigger><TooltipContent><p>הוסף תמונה</p></TooltipContent></Tooltip>
                </TooltipProvider>
            </div>
            <div className='flex items-center gap-2'>
                 <Button variant="ghost" size="icon" onClick={() => selectedElementId && deleteElement(selectedElementId)} disabled={!selectedElementId}><Trash2 className="text-red-400"/></Button>
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="bg-transparent">ייצא ▾</Button></DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => toast({ title: "ייצוא PDF יהיה זמין בקרוב! 🚀" })}>📄 PDF</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast({ title: "ייצוא Word יהיה זמין בקרוב! 🚀" })}>📝 Word</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast({ title: "ייצוא PowerPoint יהיה זמין בקרוב! 🚀" })}>📊 PowerPoint</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>

        <div className="flex-1 flex min-h-0">
            <aside className="w-32 border-l border-white/10 p-2 flex flex-col gap-2">
                <div className='flex-1 overflow-y-auto space-y-2'>
                    {pages.map((page, index) => (
                        <div key={page.id} onClick={() => setCurrentPageIndex(index)} className={cn("w-full bg-slate-800/50 rounded-md p-1 cursor-pointer border-2", currentPageIndex === index ? "border-indigo-500" : "border-transparent", aspectClass)}>
                            <div className='relative w-full h-full bg-slate-900/50 overflow-hidden rounded-sm'>
                                <span className='absolute bottom-1 right-1 text-xs font-bold text-white/50'>{page.pageNumber}</span>
                            </div>
                        </div>
                    ))}
                </div>
                 <Button size="sm" variant="outline" className='bg-transparent w-full mt-2' onClick={addPage}>+ הוסף עמוד</Button>
            </aside>
            
            <main className="flex-1 flex items-center justify-center p-8 bg-black/20 overflow-hidden relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <div 
                    className={cn(
                        "relative",
                        canvasAspectRatio === 'free' ? "w-full h-full" : "shadow-2xl",
                        canvasAspectRatio !== 'free' && {
                            'aspect-[1.414/1] w-full h-auto max-h-full': canvasAspectRatio === 'a4-landscape',
                            'aspect-[1/1.414] h-full w-auto max-w-full': canvasAspectRatio === 'a4-portrait',
                            'aspect-video w-full h-auto max-h-full': canvasAspectRatio === '16:9-landscape',
                            'aspect-[9/16] h-full w-auto max-w-full': canvasAspectRatio === '9/16',
                            'aspect-square h-full w-auto max-w-full': canvasAspectRatio === '1:1',
                        }
                    )}
                >
                    <div id="canvas-container" ref={canvasRef} className="w-full h-full relative" 
                        style={{
                            background: (currentPage as any).backgroundImage ? undefined : (currentPage?.backgroundColor || template.backgroundGradient),
                            backgroundImage: (currentPage as any).backgroundImage ? `url(${(currentPage as any).backgroundImage})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                        onClick={handleCanvasClick}
                    >
                         <TemplateDecorations template={template} />
                        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none', zIndex: 1 }}>
                          <defs>
                            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                              <polygon points="0 0, 10 3.5, 0 7" fill={template.primaryColor} />
                            </marker>
                          </defs>
                          {currentPage?.elements
                            .filter(el => el.type === 'connection_line')
                            .map((el, lineIndex) => {
                              const fromEl = currentPage.elements.find(e => e.id === el.fromElementId);
                              const toEl = currentPage.elements.find(e => e.id === el.toElementId);
                              if (!fromEl || !toEl) return null;
                              const x1 = fromEl.x + fromEl.width / 2;
                              const y1 = fromEl.y + fromEl.height;
                              const x2 = toEl.x + toEl.width / 2;
                              const y2 = toEl.y;
                              return (
                                <line
                                  key={`svg-line-${lineIndex}-${el.id.slice(-8)}`}
                                  x1={`${x1}%`} y1={`${y1}%`}
                                  x2={`${x2}%`} y2={`${y2}%`}
                                  stroke={selectedElementId === el.id ? '#60a5fa' : template.primaryColor}
                                  strokeWidth={selectedElementId === el.id ? 3 : 2}
                                  markerEnd="url(#arrowhead)"
                                  onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                                />
                              );
                            })
                          }
                        </svg>
                        {currentPage?.elements.filter(el => el.type !== 'connection_line').map((el, elIndex) => (
                           <div 
                             key={`el-${elIndex}-${el.id.slice(-8)}`}
                             className={cn('absolute border-2', selectedElementId === el.id ? 'border-dashed border-blue-500' : 'border-transparent', activeTool === 'select' && 'cursor-grab', isDragging.current && dragElementId.current === el.id && 'cursor-grabbing')}
                             style={{
                                 left: `${el.x}%`,
                                 top: `${el.y}%`,
                                 width: `${el.width}%`,
                                 height: `${el.height}%`,
                                 zIndex: el.zIndex,
                                 color: el.style?.color || template.textColor,
                                 backgroundColor: el.type === 'image' ? 'transparent' : el.style?.backgroundColor,
                                 fontSize: el.style?.fontSize,
                                 fontWeight: el.style?.fontWeight,
                                 textAlign: el.style?.textAlign,
                             }}
                             onMouseDown={(e) => handleMouseDown(e, el)}
                           >
                               {el.type === 'text' && <div>{el.content}</div>}
                               {el.type === 'person_card' && <PersonCardElement element={el} people={people} relationships={relationships} />}
                               {el.type === 'image' && el.content && (
                                <img src={el.content} alt="" className="w-full h-full object-cover rounded" />
                               )}
                           </div>
                        ))}
                    </div>
                </div>
                 {showPersonPicker && (
                  <div className="absolute right-0 top-0 h-full w-64 bg-slate-800 border-l border-white/10 z-40 flex flex-col shadow-2xl">
                     {/* Person Picker Content */}
                  </div>
                )}
                 {showImagePicker && (
                    <div className="absolute right-0 top-0 h-full w-72 bg-slate-800 border-l border-white/10 z-40 flex flex-col shadow-2xl">
                        <div className="p-3 border-b border-white/10 flex items-center justify-between">
                        <button onClick={() => { setShowImagePicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white">✕</button>
                        <h3 className="font-bold text-sm">הוסף תמונה</h3>
                        </div>
                        
                        <div className="p-3 border-b border-white/10">
                        <label className="cursor-pointer flex flex-col items-center gap-2 p-4 border-2 border-dashed border-white/20 rounded-xl hover:border-indigo-400 transition-colors">
                            <ImageIcon className="w-8 h-8 text-slate-400" />
                            <span className="text-xs text-slate-400 text-center">העלה תמונה מהמכשיר</span>
                            <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                const dataUrl = ev.target?.result as string;
                                addElement({
                                    type: 'image',
                                    content: dataUrl,
                                    x: 10, y: 10, width: 40, height: 30,
                                    zIndex: 5
                                });
                                setShowImagePicker(false);
                                setActiveTool('select');
                                };
                                reader.readAsDataURL(file);
                            }}
                            />
                        </label>
                        </div>

                        <div className="p-3 flex-1 overflow-y-auto">
                        <p className="text-xs font-bold text-slate-300 text-right mb-2">הקבצים שלי</p>
                        <MyFilesImageGrid 
                            treeId={project.treeId} 
                            onSelectImage={(url) => {
                            addElement({
                                type: 'image',
                                content: url,
                                x: 10, y: 10, width: 40, height: 30,
                                zIndex: 5
                            });
                            setShowImagePicker(false);
                            setActiveTool('select');
                            }} 
                        />
                        </div>
                    </div>
                )}
            </main>

            <aside className="w-60 border-r border-white/10 p-4 space-y-4 overflow-y-auto">
                <h3 className='font-bold text-sm text-center'>{selectedElement ? `עריכת ${selectedElement.type}` : 'עריכת עמוד'}</h3>
                {!selectedElement && currentPage && (
                    <div className='space-y-4'>
                        <div className='space-y-1 text-right'>
                        <label className='text-xs text-slate-400'>צבע רקע</label>
                        <Input type="color" value={currentPage.backgroundColor || template.backgroundColor}
                            onChange={(e) => updateCurrentPage(p => ({...p, backgroundColor: e.target.value}))} />
                        </div>
                        <div className='space-y-1 text-right'>
                        <label className='text-xs text-slate-400'>תמונת רקע</label>
                        <label className="cursor-pointer flex items-center justify-center gap-2 p-2 border border-dashed border-white/20 rounded-lg hover:border-indigo-400 text-xs text-slate-400">
                            <ImageIcon className="w-4 h-4" />
                            <span>בחר תמונה</span>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                updateCurrentPage(p => ({...p, backgroundImage: ev.target?.result as string}));
                            };
                            reader.readAsDataURL(file);
                            }} />
                        </label>
                        {(currentPage as any).backgroundImage && (
                            <button className="text-xs text-red-400 hover:text-red-300 w-full text-right"
                            onClick={() => updateCurrentPage(p => ({...p, backgroundImage: undefined}))}>
                            הסר תמונת רקע ✕
                            </button>
                        )}
                        </div>
                    </div>
                )}
                {selectedElement?.type === 'text' && (
                    <div className='space-y-4'>
                       {/* text controls */}
                    </div>
                )}
                 {selectedElement?.type === 'person_card' && (
                <div className='space-y-4'>
                    <h4 className='text-xs font-bold text-slate-300 text-right'>כרטיס אדם</h4>
                    
                    <div className='space-y-1 text-right'>
                    <label className='text-xs text-slate-400'>שקיפות כרטיס</label>
                    <Slider
                        value={[selectedElement.style?.opacity ?? 1]}
                        onValueChange={([val]) => updateElement(selectedElementId!, { 
                        style: { ...selectedElement.style, opacity: val }
                        })}
                        min={0} max={1} step={0.05}
                    />
                    <span className='text-xs text-slate-500'>{Math.round((selectedElement.style?.opacity ?? 1) * 100)}%</span>
                    </div>

                    <div className='space-y-1 text-right'>
                    <label className='text-xs text-slate-400'>צבע רקע כרטיס</label>
                    <Input 
                        type="color" 
                        value={selectedElement.style?.backgroundColor || '#1e293b'}
                        onChange={(e) => updateElement(selectedElementId!, { 
                        style: { ...selectedElement.style, backgroundColor: e.target.value }
                        })}
                    />
                    </div>

                    <div className='space-y-1 text-right'>
                    <label className='text-xs text-slate-400'>צבע טקסט</label>
                    <Input 
                        type="color" 
                        value={selectedElement.style?.color || '#ffffff'}
                        onChange={(e) => updateElement(selectedElementId!, { 
                        style: { ...selectedElement.style, color: e.target.value }
                        })}
                    />
                    </div>

                    <Button 
                    variant="destructive" size="sm" className="w-full"
                    onClick={() => deleteElement(selectedElementId!)}
                    >
                    מחק כרטיס
                    </Button>
                </div>
                )}
            </aside>
        </div>

        {showTemplatePicker && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowTemplatePicker(false)}>
            <div className="bg-slate-800 rounded-2xl p-6 w-[600px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-right mb-4">בחר תבנית עיצוב</h2>
              <div className="grid grid-cols-5 gap-3">
                {DESIGN_TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTemplateId(t.id);
                      updatePages(currentPages => currentPages.map(p => ({...p, templateId: t.id})));
                      setShowTemplatePicker(false);
                    }}
                    className={cn(
                      "rounded-xl overflow-hidden border-2 transition-all",
                      selectedTemplateId === t.id ? "border-indigo-400 scale-105" : "border-transparent hover:border-white/30"
                    )}
                  >
                    <div className="h-20 w-full" style={{ background: t.backgroundGradient }} />
                    <div className="p-1 text-center" style={{ backgroundColor: t.backgroundColor }}>
                      <p className="text-xs font-bold truncate" style={{ color: t.textColor }}>{t.nameHebrew}</p>
                      <div className="flex justify-center gap-1 mt-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.primaryColor }} />
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.secondaryColor }} />
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.accentColor }} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
