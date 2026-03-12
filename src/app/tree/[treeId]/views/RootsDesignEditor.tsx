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
  ArrowLeft, Type, LayoutPanelTop, MousePointer2,
  Redo, Smile, Square, Trash2, Undo, User, Image as ImageIcon,
  Copy, AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown,
  Scissors, Clipboard, RefreshCw, Maximize2,
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
// TEMPLATES
// ============================================================
export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'template_cosmic', name: 'Cosmic', nameHebrew: 'קוסמי',
    primaryColor: '#818cf8', secondaryColor: '#6366f1', accentColor: '#14b8a6',
    backgroundColor: '#0a0015', cardBackground: 'rgba(99,102,241,0.15)',
    textColor: '#f8fafc', mutedTextColor: '#94a3b8',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'cosmic',
    backgroundGradient: 'radial-gradient(ellipse at 20% 50%, #1e0a3c 0%, #0a0015 40%, #000d1a 100%)',
    layoutStyle: 'cosmic_dark', decorativePattern: 'dots', cardStyle: 'glass', titleStyle: 'gradient',
  },
  {
    id: 'template_desert', name: 'Desert Sand', nameHebrew: 'חול המדבר',
    primaryColor: '#f59e0b', secondaryColor: '#d97706', accentColor: '#fde68a',
    backgroundColor: '#1c1008', cardBackground: 'rgba(245,158,11,0.12)',
    textColor: '#fef3c7', mutedTextColor: '#d97706',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(160deg, #2d1b00 0%, #1c1008 50%, #0f0800 100%)',
    layoutStyle: 'heritage', decorativePattern: 'border', cardStyle: 'solid', titleStyle: 'bold_caps',
  },
  {
    id: 'template_forest', name: 'Forest', nameHebrew: 'יער',
    primaryColor: '#4ade80', secondaryColor: '#16a34a', accentColor: '#86efac',
    backgroundColor: '#0a1f0a', cardBackground: 'rgba(74,222,128,0.1)',
    textColor: '#f0fdf4', mutedTextColor: '#86efac',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #0a1f0a 0%, #052e16 60%, #0a1f0a 100%)',
    layoutStyle: 'nature', decorativePattern: 'corners', cardStyle: 'shadow', titleStyle: 'italic_serif',
  },
  {
    id: 'template_ocean', name: 'Ocean', nameHebrew: 'ים',
    primaryColor: '#38bdf8', secondaryColor: '#0284c7', accentColor: '#7dd3fc',
    backgroundColor: '#0a1628', cardBackground: 'rgba(56,189,248,0.1)',
    textColor: '#f0f9ff', mutedTextColor: '#7dd3fc',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient',
    backgroundGradient: 'radial-gradient(ellipse at 50% 100%, #0369a1 0%, #0a1628 50%, #001e3c 100%)',
    layoutStyle: 'minimal', decorativePattern: 'lines', cardStyle: 'glass', titleStyle: 'gradient',
  },
  {
    id: 'template_rose', name: 'Rose Gold', nameHebrew: 'זהב ורוד',
    primaryColor: '#fb7185', secondaryColor: '#e11d48', accentColor: '#fda4af',
    backgroundColor: '#1a0a0f', cardBackground: 'rgba(251,113,133,0.1)',
    textColor: '#fff1f2', mutedTextColor: '#fda4af',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #2d0a1a 0%, #1a0a0f 50%, #0f0510 100%)',
    layoutStyle: 'elegant', decorativePattern: 'corners', cardStyle: 'solid', titleStyle: 'italic_serif',
  },
  {
    id: 'template_parchment', name: 'Parchment', nameHebrew: 'קלף עתיק',
    primaryColor: '#92400e', secondaryColor: '#78350f', accentColor: '#d97706',
    backgroundColor: '#fef3c7', cardBackground: 'rgba(146,64,14,0.1)',
    textColor: '#1c1917', mutedTextColor: '#78350f',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'paper',
    backgroundGradient: 'radial-gradient(ellipse at 30% 30%, #fde68a 0%, #fef3c7 50%, #fde68a 100%)',
    layoutStyle: 'classic', decorativePattern: 'border', cardStyle: 'outline', titleStyle: 'italic_serif',
  },
  {
    id: 'template_midnight', name: 'Midnight Blue', nameHebrew: 'חצות כחול',
    primaryColor: '#818cf8', secondaryColor: '#4f46e5', accentColor: '#c7d2fe',
    backgroundColor: '#030712', cardBackground: 'rgba(79,70,229,0.15)',
    textColor: '#eef2ff', mutedTextColor: '#a5b4fc',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'cosmic',
    backgroundGradient: 'radial-gradient(ellipse at 80% 20%, #1e1b4b 0%, #030712 60%)',
    layoutStyle: 'bold', decorativePattern: 'none', cardStyle: 'colorful', titleStyle: 'outlined',
  },
  {
    id: 'template_spring', name: 'Spring', nameHebrew: 'אביב',
    primaryColor: '#0891b2', secondaryColor: '#0e7490', accentColor: '#67e8f9',
    backgroundColor: '#f0fdff', cardBackground: 'rgba(8,145,178,0.08)',
    textColor: '#164e63', mutedTextColor: '#0e7490',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'paper',
    backgroundGradient: 'linear-gradient(160deg, #e0f2fe 0%, #f0fdff 50%, #ecfeff 100%)',
    layoutStyle: 'bright', decorativePattern: 'dots', cardStyle: 'shadow', titleStyle: 'handwritten',
  },
  {
    id: 'template_sunset', name: 'Sunset', nameHebrew: 'שקיעה',
    primaryColor: '#fb923c', secondaryColor: '#ea580c', accentColor: '#fed7aa',
    backgroundColor: '#1a0a00', cardBackground: 'rgba(251,146,60,0.12)',
    textColor: '#fff7ed', mutedTextColor: '#fed7aa',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(160deg, #431407 0%, #1a0a00 40%, #2c0f00 100%)',
    layoutStyle: 'playful', decorativePattern: 'diagonal', cardStyle: 'colorful', titleStyle: 'bold_caps',
  },
  {
    id: 'template_silver', name: 'Silver', nameHebrew: 'כסף',
    primaryColor: '#64748b', secondaryColor: '#475569', accentColor: '#94a3b8',
    backgroundColor: '#f8fafc', cardBackground: 'rgba(71,85,105,0.08)',
    textColor: '#0f172a', mutedTextColor: '#475569',
    titleFont: 'Assistant', bodyFont: 'Assistant', backgroundStyle: 'paper',
    backgroundGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 60%, #f1f5f9 100%)',
    layoutStyle: 'minimal', decorativePattern: 'lines', cardStyle: 'outline', titleStyle: 'solid',
  },
];

// ============================================================
// PAGE GENERATOR
// ============================================================
function generatePagesFromProject(
  project: RootsProject, people: Person[], relationships: Relationship[], templateId: string
): DesignPage[] {
  const pages: DesignPage[] = [];
  let pageNumber = 1;
  const student = people.find(p => p.id === project.studentPersonId);

  // 1. Cover Page
  pages.push({
    id: uuidv4(), pageNumber: pageNumber++, pageType: 'cover', title: 'שער', templateId,
    elements: [
      { id: uuidv4(), type: 'text', content: project.projectData?.projectName || 'עבודת שורשים', x: 10, y: 28, width: 80, height: 18, style: { fontSize: 52, fontWeight: 'extrabold', textAlign: 'center' } },
      { id: uuidv4(), type: 'text', content: student ? `${student.firstName} ${student.lastName}` : '', x: 10, y: 52, width: 80, height: 10, style: { fontSize: 26, textAlign: 'center' } },
      { id: uuidv4(), type: 'text', content: new Date().getFullYear().toString(), x: 35, y: 68, width: 30, height: 8, style: { fontSize: 16, textAlign: 'center', opacity: 0.6 } as any },
    ],
  });

  // 2. Name Page
  if (project.projectData?.personalStory?.nameMeaning) {
    pages.push({
      id: uuidv4(), pageNumber: pageNumber++, pageType: 'name', title: 'השם שלי', templateId,
      elements: [
        { id: uuidv4(), type: 'text', content: 'השם שלי ✍️', x: 5, y: 6, width: 90, height: 10, style: { fontSize: 38, fontWeight: 'extrabold', textAlign: 'right' } },
        { id: uuidv4(), type: 'shape', x: 5, y: 18, width: 90, height: 1, style: { shapeType: 'rectangle', backgroundColor: 'currentColor', opacity: 0.2 } },
        { id: uuidv4(), type: 'text', content: project.projectData.personalStory.nameMeaning, x: 5, y: 22, width: 90, height: 65, style: { fontSize: 17, textAlign: 'right' } },
      ],
    });
  }

  // 3. Nuclear Family
  const parentRels = relationships.filter(r => r.personBId === project.studentPersonId && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType));
  const parents = parentRels.map(r => people.find(p => p.id === r.personAId)).filter(Boolean) as Person[];
  const nuclearElements: DesignElement[] = [];
  const studentCardId = uuidv4();
  nuclearElements.push({ id: uuidv4(), type: 'text', content: 'המשפחה הגרעינית 👨‍👩‍👧‍👦', x: 5, y: 3, width: 90, height: 9, style: { fontSize: 32, fontWeight: 'extrabold', textAlign: 'right' } });
  if (student) {
    nuclearElements.push({ id: studentCardId, type: 'person_card', personId: student.id, x: 35, y: 60, width: 30, height: 32, zIndex: 10 });
  }
  parents.forEach((parent, pIndex) => {
    const parentCardId = uuidv4();
    const totalParents = parents.length;
    const spacing = totalParents === 1 ? 35 : 60 / (totalParents - 1);
    const startX = totalParents === 1 ? 35 : 10;
    nuclearElements.push({ id: parentCardId, type: 'person_card', personId: parent.id, x: startX + pIndex * spacing, y: 18, width: 30, height: 32, zIndex: 10 });
    if (student) nuclearElements.push({ id: uuidv4(), type: 'connection_line', fromElementId: parentCardId, toElementId: studentCardId, x: 0, y: 0, width: 0, height: 0, zIndex: 1 });
  });
  if (nuclearElements.length > 1) {
    pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'nuclear_family', title: 'המשפחה הגרעינית', templateId, elements: nuclearElements });
  }

  // 4. Personal Story
  if (project.projectData?.personalStory?.birthStory) {
    const storyElements: DesignElement[] = [
      { id: uuidv4(), type: 'text', content: 'הסיפור שלי 📖', x: 5, y: 3, width: 90, height: 10, style: { fontSize: 34, fontWeight: 'extrabold', textAlign: 'right' } },
      { id: uuidv4(), type: 'text', content: '🍼 סיפור הלידה', x: 5, y: 15, width: 90, height: 6, style: { fontSize: 15, fontWeight: 'bold', textAlign: 'right' } },
      { id: uuidv4(), type: 'text', content: project.projectData.personalStory.birthStory, x: 5, y: 22, width: 90, height: 30, style: { fontSize: 13, textAlign: 'right' } },
    ];
    if (project.projectData.personalStory.personalVision) {
      storyElements.push(
        { id: uuidv4(), type: 'text', content: '🌟 החזון שלי', x: 5, y: 54, width: 90, height: 6, style: { fontSize: 15, fontWeight: 'bold', textAlign: 'right' } },
        { id: uuidv4(), type: 'text', content: project.projectData.personalStory.personalVision, x: 5, y: 61, width: 90, height: 30, style: { fontSize: 13, textAlign: 'right' } },
      );
    }
    pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'personal', title: 'הסיפור שלי', templateId, elements: storyElements });
  }

  // 5. Paternal Roots
  const pgf = project.projectData?.familyRoots?.paternalGrandfather;
  const pgm = project.projectData?.familyRoots?.paternalGrandmother;
  if (pgf || pgm) {
    const els: DesignElement[] = [{ id: uuidv4(), type: 'text', content: 'שורשים מצד אבא 👴', x: 5, y: 3, width: 90, height: 9, style: { fontSize: 32, fontWeight: 'extrabold', textAlign: 'right' } }];
    if (pgf?.personId) els.push({ id: uuidv4(), type: 'person_card', personId: pgf.personId, x: 5, y: 14, width: 26, height: 35, zIndex: 10 });
    if (pgf?.story) els.push({ id: uuidv4(), type: 'text', content: pgf.story, x: 33, y: 14, width: 62, height: 35, style: { fontSize: 12, textAlign: 'right' } });
    if (pgm?.personId) els.push({ id: uuidv4(), type: 'person_card', personId: pgm.personId, x: 5, y: 52, width: 26, height: 35, zIndex: 10 });
    if (pgm?.story) els.push({ id: uuidv4(), type: 'text', content: pgm.story, x: 33, y: 52, width: 62, height: 35, style: { fontSize: 12, textAlign: 'right' } });
    pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'roots_paternal', title: 'שורשים מצד אבא', templateId, elements: els });
  }

  // 6. Maternal Roots
  const mgf = project.projectData?.familyRoots?.maternalGrandfather;
  const mgm = project.projectData?.familyRoots?.maternalGrandmother;
  if (mgf || mgm) {
    const els: DesignElement[] = [{ id: uuidv4(), type: 'text', content: 'שורשים מצד אמא 👵', x: 5, y: 3, width: 90, height: 9, style: { fontSize: 32, fontWeight: 'extrabold', textAlign: 'right' } }];
    if (mgf?.personId) els.push({ id: uuidv4(), type: 'person_card', personId: mgf.personId, x: 5, y: 14, width: 26, height: 35, zIndex: 10 });
    if (mgf?.story) els.push({ id: uuidv4(), type: 'text', content: mgf.story, x: 33, y: 14, width: 62, height: 35, style: { fontSize: 12, textAlign: 'right' } });
    if (mgm?.personId) els.push({ id: uuidv4(), type: 'person_card', personId: mgm.personId, x: 5, y: 52, width: 26, height: 35, zIndex: 10 });
    if (mgm?.story) els.push({ id: uuidv4(), type: 'text', content: mgm.story, x: 33, y: 52, width: 62, height: 35, style: { fontSize: 12, textAlign: 'right' } });
    pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'roots_maternal', title: 'שורשים מצד אמא', templateId, elements: els });
  }

  // 7. Heritage
  const h = project.projectData?.heritage;
  if (h?.inheritedObject || h?.familyRecipe || h?.familyNameOrigin) {
    const els: DesignElement[] = [{ id: uuidv4(), type: 'text', content: 'מורשת משפחתית 🏺', x: 5, y: 3, width: 90, height: 9, style: { fontSize: 32, fontWeight: 'extrabold', textAlign: 'right' } }];
    let yPos = 15;
    if (h.inheritedObject) {
      els.push({ id: uuidv4(), type: 'text', content: '💎 חפץ עובר בירושה', x: 5, y: yPos, width: 90, height: 6, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } });
      els.push({ id: uuidv4(), type: 'text', content: h.inheritedObject, x: 5, y: yPos + 7, width: 90, height: 14, style: { fontSize: 12, textAlign: 'right' } });
      yPos += 24;
    }
    if (h.familyRecipe) {
      els.push({ id: uuidv4(), type: 'text', content: '🍽️ מתכון משפחתי', x: 5, y: yPos, width: 90, height: 6, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } });
      els.push({ id: uuidv4(), type: 'text', content: h.familyRecipe, x: 5, y: yPos + 7, width: 90, height: 14, style: { fontSize: 12, textAlign: 'right' } });
      yPos += 24;
    }
    if (h.familyNameOrigin) {
      els.push({ id: uuidv4(), type: 'text', content: '📜 מקור שם המשפחה', x: 5, y: yPos, width: 90, height: 6, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } });
      els.push({ id: uuidv4(), type: 'text', content: h.familyNameOrigin, x: 5, y: yPos + 7, width: 90, height: 14, style: { fontSize: 12, textAlign: 'right' } });
    }
    pages.push({ id: uuidv4(), pageNumber: pageNumber++, pageType: 'heritage', title: 'מורשת משפחתית', templateId, elements: els });
  }

  return pages;
}

// ============================================================
// TEMPLATE DECORATIONS
// ============================================================
const TemplateDecorations = ({ template }: { template: DesignTemplate }) => {
  const p = template.decorativePattern || 'none';
  if (p === 'corners') return (
    <>
      <div className="absolute top-3 right-3 w-10 h-10 border-t-2 border-r-2 opacity-30 pointer-events-none" style={{ borderColor: template.primaryColor }} />
      <div className="absolute top-3 left-3 w-10 h-10 border-t-2 border-l-2 opacity-30 pointer-events-none" style={{ borderColor: template.primaryColor }} />
      <div className="absolute bottom-3 right-3 w-10 h-10 border-b-2 border-r-2 opacity-30 pointer-events-none" style={{ borderColor: template.primaryColor }} />
      <div className="absolute bottom-3 left-3 w-10 h-10 border-b-2 border-l-2 opacity-30 pointer-events-none" style={{ borderColor: template.primaryColor }} />
    </>
  );
  if (p === 'border') return <div className="absolute inset-4 border-2 opacity-15 pointer-events-none rounded" style={{ borderColor: template.primaryColor }} />;
  if (p === 'dots') return <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{ backgroundImage: `radial-gradient(circle, ${template.primaryColor} 1px, transparent 1px)`, backgroundSize: '28px 28px' }} />;
  if (p === 'lines') return <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: `repeating-linear-gradient(0deg, ${template.primaryColor}, ${template.primaryColor} 1px, transparent 1px, transparent 44px)` }} />;
  if (p === 'diagonal') return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-15">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full" style={{ background: template.primaryColor, filter: 'blur(80px)' }} />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full" style={{ background: template.accentColor, filter: 'blur(60px)' }} />
    </div>
  );
  return null;
};

// ============================================================
// PERSON CARD — full rich display
// ============================================================
const PersonCardElement = ({
  element, people, relationships, scaleFactor = 1
}: {
  element: DesignElement, people: Person[], relationships: Relationship[], scaleFactor?: number
}) => {
  const person = people.find(p => p.id === element.personId);
  if (!person) return (
    <div className="w-full h-full rounded-xl flex items-center justify-center bg-white/5 border border-white/20">
      <User className="w-6 h-6 opacity-30" />
      <span className="text-xs opacity-30 mr-1">אדם לא נמצא</span>
    </div>
  );

  const childRels = relationships.filter(r => r.personAId === person.id && r.relationshipType === 'parent');
  const siblingRels = relationships.filter(r => (r.personAId === person.id || r.personBId === person.id) && r.relationshipType === 'sibling');
  const spouseRel = relationships.find(r => (r.personAId === person.id || r.personBId === person.id) && r.relationshipType === 'spouse');
  const spousePerson = spouseRel ? people.find(p => p.id === (spouseRel.personAId === person.id ? spouseRel.personBId : spouseRel.personAId)) : null;

  const p = person as any; // for extra fields
  const birthYear = person.birthDate && isValid(parseISO(person.birthDate)) ? new Date(person.birthDate).getFullYear() : null;
  const deathYear = person.deathDate && isValid(parseISO(String(person.deathDate))) ? new Date(String(person.deathDate)).getFullYear() : null;
  const age = birthYear ? (deathYear ? deathYear - birthYear : new Date().getFullYear() - birthYear) : null;
  const displayName = [person.firstName, person.nickname ? `"${person.nickname}"` : null, person.lastName].filter(Boolean).join(' ');

  const bgColor = element.style?.backgroundColor || 'rgba(255,255,255,0.08)';
  const textColor = element.style?.color || '#ffffff';
  const opacity = element.style?.opacity ?? 1;
  const fs = (base: number) => Math.max(6, Math.round(base * Math.max(0.45, scaleFactor)));
  const pad = Math.max(4, Math.round(8 * Math.max(0.5, scaleFactor)));
  const avatarSize = Math.max(28, Math.round(48 * Math.max(0.5, scaleFactor)));

  // collect photos: primary + gallery
  const galleryPhotos: string[] = (p.photoGallery || []).filter(Boolean).slice(0, 3);

  const infoRows: Array<{ icon: string; label: string; value: string }> = [];
  if (person.birthDate) infoRows.push({ icon: '🎂', label: 'תאריך לידה', value: person.birthDate.slice(0, 10) });
  if (person.birthPlace) infoRows.push({ icon: '📍', label: 'מקום לידה', value: person.birthPlace });
  if (deathYear) infoRows.push({ icon: '✝', label: 'פטירה', value: String(deathYear) });
  if (p.originCountry || p.countryOfOrigin) infoRows.push({ icon: '🌍', label: 'ארץ מוצא', value: p.originCountry || p.countryOfOrigin });
  if (p.nationality) infoRows.push({ icon: '🏳️', label: 'לאום', value: p.nationality });
  if (p.religion) infoRows.push({ icon: '✡️', label: 'דת', value: p.religion });
  if (person.occupation) infoRows.push({ icon: '💼', label: 'מקצוע', value: person.occupation });
  if (p.education) infoRows.push({ icon: '🎓', label: 'השכלה', value: p.education });
  if (p.hobby || p.hobbies) infoRows.push({ icon: '🎯', label: 'תחביב', value: p.hobby || (Array.isArray(p.hobbies) ? p.hobbies.join(', ') : p.hobbies) });
  if (spousePerson) infoRows.push({ icon: '💍', label: 'בן/בת זוג', value: `${spousePerson.firstName} ${spousePerson.lastName}` });
  if (childRels.length) infoRows.push({ icon: '👶', label: 'ילדים', value: String(childRels.length) });
  if (siblingRels.length) infoRows.push({ icon: '👥', label: 'אחים', value: String(siblingRels.length) });

  return (
    <div
      className="w-full h-full rounded-2xl flex flex-col overflow-hidden border border-white/15 backdrop-blur-xl shadow-xl"
      style={{ backgroundColor: bgColor, opacity, color: textColor, padding: `${pad}px` }}
      dir="rtl"
    >
      {/* Header: avatar + name */}
      <div className="flex items-center gap-2 flex-shrink-0 mb-1">
        <div className="rounded-full border-2 border-white/30 overflow-hidden flex-shrink-0"
          style={{ width: avatarSize, height: avatarSize }}>
          <img src={person.photoURL || getPlaceholderImage(person.gender)} alt={displayName} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="font-bold leading-tight truncate" style={{ color: textColor, fontSize: fs(13) }}>{displayName}</p>
          {birthYear && (
            <p className="opacity-70 leading-tight" style={{ color: textColor, fontSize: fs(10) }}>
              {birthYear}{deathYear ? `–${deathYear}` : ''}{age ? ` · גיל ${age}` : ''}
            </p>
          )}
          {(person.gender) && (
            <p className="opacity-50 leading-tight" style={{ color: textColor, fontSize: fs(9) }}>
              {person.gender === 'male' ? '♂ זכר' : person.gender === 'female' ? '♀ נקבה' : person.gender}
              {(p.status || p.lifeStatus) ? ` · ${p.status || p.lifeStatus}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Info rows */}
      <div className="flex-1 overflow-hidden flex flex-col gap-px">
        {infoRows.map((row, i) => (
          <div key={i} className="flex items-center gap-1 min-w-0" style={{ fontSize: fs(10) }}>
            <span className="flex-shrink-0" style={{ fontSize: fs(9) }}>{row.icon}</span>
            <span className="opacity-50 flex-shrink-0 text-right" style={{ color: textColor, fontSize: fs(9) }}>{row.label}:</span>
            <span className="opacity-75 truncate flex-1 text-right" style={{ color: textColor }}>{row.value}</span>
          </div>
        ))}

        {/* Biography snippet */}
        {p.biography && (
          <p className="opacity-50 leading-tight mt-1 line-clamp-2 text-right" style={{ color: textColor, fontSize: fs(9) }}>{p.biography}</p>
        )}
      </div>

      {/* Gallery strip */}
      {galleryPhotos.length > 0 && (
        <div className="flex gap-1 mt-1 flex-shrink-0">
          {galleryPhotos.map((url: string, i: number) => (
            <div key={i} className="rounded overflow-hidden border border-white/10 flex-1" style={{ height: avatarSize * 0.6 }}>
              <img src={url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// MY FILES IMAGE GRID
// ============================================================
function MyFilesImageGrid({ treeId, onSelectImage }: { treeId: string; onSelectImage: (url: string) => void }) {
  const [files, setFiles] = useState<Array<{ name: string; url: string }>>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useUser();
  const db = useFirestore();

  useEffect(() => {
    (async () => {
      if (!user || !db) { setLoading(false); return; }
      try {
        const snap = await getDocs(query(collection(db, 'exportedFiles'), where('userId', '==', user.uid)));
        setFiles(
          snap.docs.map(d => d.data() as ExportedFile)
            .filter(f => f.downloadURL && ['png', 'jpg', 'jpeg'].includes(f.fileType))
            .map(f => ({ name: f.fileName, url: f.downloadURL! }))
        );
      } catch { setFiles([]); }
      finally { setLoading(false); }
    })();
  }, [user, db, treeId]);

  if (loading) return <div className="text-xs text-slate-500 text-center py-4">טוען...</div>;
  if (!files.length) return <div className="text-xs text-slate-500 text-center py-4"><p>אין תמונות</p><p className="opacity-60 mt-1">העלה קבצים דרך "הקבצים שלי"</p></div>;
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {files.map(f => (
        <button key={f.name} onClick={() => onSelectImage(f.url)} className="aspect-square rounded overflow-hidden border border-white/10 hover:border-indigo-400 transition-colors">
          <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}

// ============================================================
// CLIPBOARD STATE (module level — survives re-renders)
// ============================================================
let _clipboard: DesignElement | null = null;

// ============================================================
// CONTEXT MENU TYPE
// ============================================================
interface CtxMenu { x: number; y: number; elementId: string | null; }

// ============================================================
// MAIN EDITOR
// ============================================================
export function RootsDesignEditor({
  project, people, relationships, onBack, onUpdateProject,
}: {
  project: RootsProject;
  people: Person[];
  relationships: Relationship[];
  onBack: () => void;
  onUpdateProject: (updater: (p: RootsProject) => RootsProject) => void;
}) {
  // ---- state ----
  const [pages, setPages] = useState<DesignPage[]>(project.projectData?.designData?.pages || []);
  const [isGenerating, setIsGenerating] = useState(!project.projectData?.designData?.pages?.length);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'shape' | 'person' | 'image' | 'icon'>('select');
  const [selectedTemplateId, setSelectedTemplateId] = useState(project.projectData?.designData?.templateId || 'template_cosmic');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [personSearch, setPersonSearch] = useState('');
  const [canvasAspectRatio, setCanvasAspectRatio] = useState<CanvasAspectRatio>('a4-landscape');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [editingElementId, setEditingElementId] = useState<string | null>(null);
  const [activeShapeType, setActiveShapeType] = useState<ShapeType>('rectangle');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiInput, setEmojiInput] = useState('');
  const [applyTemplateToAll, setApplyTemplateToAll] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [gradientFrom, setGradientFrom] = useState('#0a0015');
  const [gradientTo, setGradientTo] = useState('#000d1a');
  const [bgMode, setBgMode] = useState<'solid' | 'gradient'>('gradient');
  const [clipboardEl, setClipboardEl] = useState<DesignElement | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { toast } = useToast();

  // ---- refs ----
  const isDragging = useRef(false);
  const dragIds = useRef<string[]>([]);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, elements: [] as Array<{ id: string; x: number; y: number }> });
  const canvasRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeHandle = useRef<string | null>(null);
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, elX: 0, elY: 0, elW: 0, elH: 0, aspectRatio: 1 });
  const pagesRef = useRef<DesignPage[]>(pages);
  const hasGeneratedRef = useRef(false);

  useEffect(() => { pagesRef.current = pages; }, [pages]);

  // ---- init / generate ----
  useEffect(() => {
    const existing = project.projectData?.designData?.pages;
    if (!existing || existing.length === 0) {
      hasGeneratedRef.current = true;
      const generated = generatePagesFromProject(project, people, relationships, 'template_cosmic');
      setPages(generated);
      setIsGenerating(false);
      onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { pages: generated } } }));
    } else {
      setIsGenerating(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (hasGeneratedRef.current) return;
    setPages(project.projectData?.designData?.pages || []);
  }, [project.projectData?.designData?.pages]);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      if (isInput && editingElementId) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length && !editingElementId) {
        e.preventDefault();
        selectedIds.forEach(id => deleteElementById(id));
        setSelectedIds([]);
      }
      if (e.key === 'Escape') { setSelectedIds([]); setEditingElementId(null); setActiveTool('select'); setCtxMenu(null); }
      if ((e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey) && selectedIds.length === 1) {
        const el = pagesRef.current[currentPageIndex]?.elements.find(e2 => e2.id === selectedIds[0]);
        if (el) { _clipboard = el; setClipboardEl(el); toast({ title: 'הועתק ✓' }); }
      }
      if ((e.key === 'x' || e.key === 'X') && (e.ctrlKey || e.metaKey) && selectedIds.length === 1) {
        const el = pagesRef.current[currentPageIndex]?.elements.find(e2 => e2.id === selectedIds[0]);
        if (el) { _clipboard = el; setClipboardEl(el); deleteElementById(el.id); setSelectedIds([]); toast({ title: 'נגזר ✓' }); }
      }
      if ((e.key === 'v' || e.key === 'V') && (e.ctrlKey || e.metaKey) && _clipboard) {
        e.preventDefault();
        const { id: _id, ...rest } = _clipboard;
        const newEl = { ...rest, id: uuidv4(), x: Math.min((_clipboard.x || 0) + 3, 70), y: Math.min((_clipboard.y || 0) + 3, 70) };
        addElementDirect(newEl);
        toast({ title: 'הודבק ✓' });
      }
      if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedIds.length) { e.preventDefault(); selectedIds.forEach(id => duplicateElementById(id)); }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [selectedIds, editingElementId, currentPageIndex]); // eslint-disable-line

  // close ctx menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-ctx-menu]')) setCtxMenu(null);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  // ---- derived ----
  const currentPage = pages[currentPageIndex];
  const template = DESIGN_TEMPLATES.find(t => t.id === (currentPage?.templateId || selectedTemplateId)) || DESIGN_TEMPLATES[0];
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;
  const selectedElement = selectedId ? currentPage?.elements.find(el => el.id === selectedId) : undefined;

  const getScaleFactor = (el: DesignElement) => Math.max(0.4, el.width / 28);

  // ---- mutation helpers ----
  const updatePages = useCallback((updater: (p: DesignPage[]) => DesignPage[]) => {
    const newPages = updater(pagesRef.current);
    setPages(newPages);
    onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { ...proj.projectData?.designData, pages: newPages } } }));
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

  const addElementDirect = useCallback((newEl: DesignElement) => {
    updatePages(ps => { const np = [...ps]; if (np[currentPageIndex]) np[currentPageIndex] = { ...np[currentPageIndex], elements: [...np[currentPageIndex].elements, newEl] }; return np; });
    setSelectedIds([newEl.id]);
  }, [updatePages, currentPageIndex]);

  const addElement = useCallback((element: Omit<DesignElement, 'id'>) => {
    addElementDirect({ ...element, id: uuidv4() });
  }, [addElementDirect]);

  const deleteElementById = useCallback((id: string) => {
    updatePages(ps => { const np = [...ps]; if (np[currentPageIndex]) np[currentPageIndex] = { ...np[currentPageIndex], elements: np[currentPageIndex].elements.filter(el => el.id !== id) }; return np; });
  }, [updatePages, currentPageIndex]);

  const duplicateElementById = useCallback((id: string) => {
    const el = pagesRef.current[currentPageIndex]?.elements.find(e => e.id === id);
    if (!el) return;
    const { id: _id, ...rest } = el;
    addElement({ ...rest, x: Math.min(el.x + 3, 70), y: Math.min(el.y + 3, 70) });
  }, [addElement, currentPageIndex]);

  const addPage = () => {
    const newPage: DesignPage = { id: uuidv4(), pageNumber: pages.length + 1, pageType: 'custom', title: 'עמוד חדש', elements: [], templateId: selectedTemplateId };
    updatePages(ps => [...ps, newPage]);
    setCurrentPageIndex(pages.length);
  };

  // Allow deleting last page — it lets user regenerate from scratch
  const deletePage = (index: number) => {
    updatePages(ps => ps.filter((_, i) => i !== index).map((p, i) => ({ ...p, pageNumber: i + 1 })));
    setCurrentPageIndex(prev => Math.max(0, Math.min(prev, pages.length - 2)));
    setSelectedIds([]);
  };

  // Reset all pages — regenerate from project data
  const handleResetPages = () => {
    hasGeneratedRef.current = true;
    const generated = generatePagesFromProject(project, people, relationships, selectedTemplateId);
    setPages(generated);
    setCurrentPageIndex(0);
    setSelectedIds([]);
    onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { pages: generated } } }));
    setShowResetConfirm(false);
    toast({ title: '✨ הצגה נוצרה מחדש!', description: `${generated.length} עמודים נוצרו` });
  };

  // ---- drag ----
  const handleMouseDown = (e: React.MouseEvent, el: DesignElement) => {
    if (editingElementId) return;
    if (activeTool !== 'select') return;
    if (!canvasRef.current) return;
    e.stopPropagation();

    if (e.ctrlKey || e.metaKey) {
      // toggle multi-select
      setSelectedIds(prev => prev.includes(el.id) ? prev.filter(id => id !== el.id) : [...prev, el.id]);
      // start drag for all selected
      const newSelected = selectedIds.includes(el.id) ? selectedIds.filter(id => id !== el.id) : [...selectedIds, el.id];
      isDragging.current = true;
      dragIds.current = newSelected.includes(el.id) ? newSelected : [el.id];
      dragStart.current = {
        mouseX: e.clientX, mouseY: e.clientY,
        elements: dragIds.current.map(id => { const found = currentPage?.elements.find(e2 => e2.id === id); return { id, x: found?.x ?? 0, y: found?.y ?? 0 }; }),
      };
      return;
    }

    // If clicking an already-selected element in multi-select, keep selection for dragging
    if (!selectedIds.includes(el.id)) setSelectedIds([el.id]);
    const dragSet = selectedIds.includes(el.id) && selectedIds.length > 1 ? selectedIds : [el.id];

    isDragging.current = true;
    dragIds.current = dragSet;
    dragStart.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      elements: dragSet.map(id => { const found = currentPage?.elements.find(e2 => e2.id === id); return { id, x: found?.x ?? 0, y: found?.y ?? 0 }; }),
    };
  };

  const handleResizeMouseDown = (e: React.MouseEvent, el: DesignElement, handle: string) => {
    e.stopPropagation(); e.preventDefault();
    isResizing.current = true;
    resizeHandle.current = handle;
    resizeStart.current = { mouseX: e.clientX, mouseY: e.clientY, elX: el.x, elY: el.y, elW: el.width, elH: el.height, aspectRatio: el.width / Math.max(1, el.height) };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (isResizing.current && resizeHandle.current && selectedId) {
      const dx = ((e.clientX - resizeStart.current.mouseX) / rect.width) * 100;
      const dy = ((e.clientY - resizeStart.current.mouseY) / rect.height) * 100;
      const h = resizeHandle.current;
      const isCorner = h.length === 2;
      updateElementLocal(selectedId, () => {
        let { elX: nx, elY: ny, elW: nw, elH: nh } = resizeStart.current;
        const ar = resizeStart.current.aspectRatio;
        if (isCorner) {
          if (h === 'se') { nw = Math.max(5, resizeStart.current.elW + dx); nh = nw / ar; }
          else if (h === 'sw') { nw = Math.max(5, resizeStart.current.elW - dx); nh = nw / ar; nx = resizeStart.current.elX + (resizeStart.current.elW - nw); }
          else if (h === 'ne') { nw = Math.max(5, resizeStart.current.elW + dx); nh = nw / ar; ny = resizeStart.current.elY + (resizeStart.current.elH - nh); }
          else if (h === 'nw') { nw = Math.max(5, resizeStart.current.elW - dx); nh = nw / ar; nx = resizeStart.current.elX + (resizeStart.current.elW - nw); ny = resizeStart.current.elY + (resizeStart.current.elH - nh); }
        } else {
          if (h === 'e') nw = Math.max(5, resizeStart.current.elW + dx);
          if (h === 's') nh = Math.max(3, resizeStart.current.elH + dy);
          if (h === 'w') { nw = Math.max(5, resizeStart.current.elW - dx); nx = resizeStart.current.elX + dx; }
          if (h === 'n') { nh = Math.max(3, resizeStart.current.elH - dy); ny = resizeStart.current.elY + dy; }
        }
        return { x: Math.max(0, nx), y: Math.max(0, ny), width: Math.min(nw, 100 - Math.max(0, nx)), height: Math.min(nh, 100 - Math.max(0, ny)) };
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
    const wasDragging = isDragging.current || isResizing.current;
    isDragging.current = false; dragIds.current = []; isResizing.current = false; resizeHandle.current = null;
    if (wasDragging) {
      onUpdateProject(proj => ({ ...proj, projectData: { ...proj.projectData, designData: { ...proj.projectData?.designData, pages: pagesRef.current } } }));
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id !== 'canvas-container') return;
    if (activeTool === 'text') {
      addElement({ type: 'text', content: 'טקסט חדש', x: (e.nativeEvent.offsetX / target.offsetWidth) * 100, y: (e.nativeEvent.offsetY / target.offsetHeight) * 100, width: 30, height: 10, style: { fontSize: 18, color: template.textColor } });
      setActiveTool('select');
    } else if (activeTool === 'shape') {
      addElement({ type: 'shape', x: (e.nativeEvent.offsetX / target.offsetWidth) * 100 - 10, y: (e.nativeEvent.offsetY / target.offsetHeight) * 100 - 10, width: 20, height: 20, style: { shapeType: activeShapeType, backgroundColor: template.primaryColor, opacity: 0.85 } });
      setActiveTool('select');
    } else {
      setSelectedIds([]); setEditingElementId(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, elementId: string | null) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, elementId });
    if (elementId && !selectedIds.includes(elementId)) setSelectedIds([elementId]);
  };

  // ---- canvas style ----
  const getCanvasStyle = (): React.CSSProperties => {
    const ratios: Record<string, number> = { 'a4-landscape': 1.414, 'a4-portrait': 1 / 1.414, '16:9-landscape': 16 / 9, '9/16': 9 / 16, '1:1': 1, 'free': 1.414 };
    const r = ratios[canvasAspectRatio] ?? 1.414;
    return r >= 1
      ? { width: '100%', maxWidth: '100%', aspectRatio: `${r}`, height: 'auto', maxHeight: '100%' }
      : { height: '100%', maxHeight: '100%', aspectRatio: `${r}`, width: 'auto', maxWidth: '100%' };
  };

  const getPageBackground = (page: DesignPage | undefined, tmpl: DesignTemplate) => {
    if (!page) return { background: tmpl.backgroundGradient };
    const p = page as any;
    if (p.backgroundImage) return { backgroundImage: `url(${p.backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    if (page.backgroundColor) return { backgroundColor: page.backgroundColor };
    return { background: page.backgroundGradient || tmpl.backgroundGradient };
  };

  // cut/copy/paste helpers for context menu
  const copyElement = (id: string) => {
    const el = currentPage?.elements.find(e => e.id === id);
    if (el) { _clipboard = el; setClipboardEl(el); toast({ title: 'הועתק ✓' }); }
  };
  const cutElement = (id: string) => {
    const el = currentPage?.elements.find(e => e.id === id);
    if (el) { _clipboard = el; setClipboardEl(el); deleteElementById(id); setSelectedIds([]); toast({ title: 'נגזר ✓' }); }
  };
  const pasteElement = () => {
    if (!_clipboard) return;
    const { id: _id, ...rest } = _clipboard;
    const newEl = { ...rest, id: uuidv4(), x: Math.min((_clipboard.x || 0) + 3, 70), y: Math.min((_clipboard.y || 0) + 3, 70) };
    addElementDirect(newEl);
    toast({ title: 'הודבק ✓' });
  };
  const resetElementSize = (id: string) => {
    updateElement(id, { width: 30, height: 30 });
    toast({ title: 'גודל אופס' });
  };
  const resetElementRatio = (id: string) => {
    const el = currentPage?.elements.find(e => e.id === id);
    if (!el) return;
    // Reset to 4:3 ratio keeping width
    updateElement(id, { height: (el.width * 3) / 4 });
    toast({ title: 'יחס מידות אופס' });
  };

  // ---- loading ----
  if (isGenerating) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-6" style={{ background: DESIGN_TEMPLATES[0].backgroundGradient }}>
        <div className="text-6xl animate-bounce">✨</div>
        <h2 className="text-2xl font-extrabold text-white">בונה את עבודת השורשים שלך...</h2>
        <p className="text-slate-400">מנתח את כל המידע שאספת</p>
      </div>
    );
  }

  // ---- empty pages ----
  if (!pages.length) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-[#0a0015] text-white" dir="rtl">
        <div className="text-6xl">📄</div>
        <h2 className="text-2xl font-extrabold">אין עמודים עדיין</h2>
        <p className="text-slate-400">לחץ על "צור מחדש" כדי לייצר את ההצגה שלך</p>
        <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={() => handleResetPages()}>✨ צור מחדש</Button>
        <Button variant="ghost" onClick={onBack} className="text-slate-400">חזור לאשף</Button>
      </div>
    );
  }

  const HANDLES = [
    { id: 'nw', style: { top: -5, right: 'auto', bottom: 'auto', left: -5 }, cursor: 'nwse-resize', title: 'שינוי גודל (שומר יחס)' },
    { id: 'ne', style: { top: -5, right: -5, bottom: 'auto', left: 'auto' }, cursor: 'nesw-resize', title: 'שינוי גודל (שומר יחס)' },
    { id: 'sw', style: { top: 'auto', right: 'auto', bottom: -5, left: -5 }, cursor: 'nesw-resize', title: 'שינוי גודל (שומר יחס)' },
    { id: 'se', style: { top: 'auto', right: -5, bottom: -5, left: 'auto' }, cursor: 'nwse-resize', title: 'שינוי גודל (שומר יחס)' },
    { id: 'n', style: { top: -5, right: 'auto', bottom: 'auto', left: 'calc(50% - 5px)' }, cursor: 'ns-resize', title: 'שינוי גובה' },
    { id: 's', style: { top: 'auto', right: 'auto', bottom: -5, left: 'calc(50% - 5px)' }, cursor: 'ns-resize', title: 'שינוי גובה' },
    { id: 'e', style: { top: 'calc(50% - 5px)', right: -5, bottom: 'auto', left: 'auto' }, cursor: 'ew-resize', title: 'שינוי רוחב' },
    { id: 'w', style: { top: 'calc(50% - 5px)', right: 'auto', bottom: 'auto', left: -5 }, cursor: 'ew-resize', title: 'שינוי רוחב' },
  ] as const;

  return (
    <TooltipProvider delayDuration={400}>
      <div className="h-screen w-screen flex flex-col bg-[#1a1a2e] text-white overflow-hidden" dir="rtl">

        {/* ===== HEADER ===== */}
        <header className="h-11 border-b border-white/10 px-3 flex items-center justify-between flex-shrink-0 bg-slate-900/80 backdrop-blur z-20 gap-2">

          {/* Right group (in RTL this appears on the right = "back" side) */}
          <div className="flex items-center gap-2 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2 text-xs flex-shrink-0" aria-label="חזור לאשף השורשים">
                  <ArrowLeft className="h-3.5 w-3.5 ml-1" />חזור
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>חזור לאשף השורשים</p></TooltipContent>
            </Tooltip>
            <div className="h-4 w-px bg-white/10 flex-shrink-0" />
            <span className="font-semibold text-xs truncate max-w-[140px] opacity-80">{project.projectData.projectName}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" aria-label="שנה יחס מידות הדף">
                      <LayoutPanelTop className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuRadioGroup value={canvasAspectRatio} onValueChange={v => setCanvasAspectRatio(v as CanvasAspectRatio)}>
                      <DropdownMenuRadioItem value="a4-landscape">A4 לרוחב ↔</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="a4-portrait">A4 לגובה ↕</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="16:9-landscape">16:9 מצגת</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="9/16">9:16 סטורי</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="1:1">ריבוע 1:1</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>שנה יחס מידות הדף</p></TooltipContent>
            </Tooltip>
          </div>

          {/* Center tools */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-transparent border-white/20 flex-shrink-0" aria-label="בחר תבנית עיצוב" onClick={() => setShowTemplatePicker(true)}>
                  🎨 תבנית
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>בחר תבנית עיצוב לעמוד</p></TooltipContent>
            </Tooltip>
            <div className="h-4 w-px bg-white/10 mx-1 flex-shrink-0" />

            {[
              { tool: 'select' as const, icon: <MousePointer2 className="h-3.5 w-3.5" />, label: 'בחר ו-גרור אלמנטים (Ctrl+לחיצה לבחירה מרובה)' },
              { tool: 'text' as const, icon: <Type className="h-3.5 w-3.5" />, label: 'הוסף תיבת טקסט — לחץ על הדף' },
            ].map(({ tool, icon, label }) => (
              <Tooltip key={tool}>
                <TooltipTrigger asChild>
                  <Button variant={activeTool === tool ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" aria-label={label} onClick={() => setActiveTool(tool)}>{icon}</Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>{label}</p></TooltipContent>
              </Tooltip>
            ))}

            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant={activeTool === 'shape' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" aria-label="הוסף צורה גיאומטרית">
                      <Square className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {[['rectangle','▭ מלבן'],['rounded_rectangle','▢ מלבן מעוגל'],['circle','● עיגול'],['star','★ כוכב'],['diamond','◆ יהלום']].map(([v, l]) => (
                      <DropdownMenuItem key={v} onClick={() => { setActiveShapeType(v as ShapeType); setActiveTool('shape'); }}>{l}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>הוסף צורה גיאומטרית לדף</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={activeTool === 'person' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" aria-label="הוסף כרטיס אדם" onClick={() => { setActiveTool('person'); setShowPersonPicker(true); }}>
                  <User className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>הוסף כרטיס פרטי אדם מהמשפחה</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={activeTool === 'image' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" aria-label="הוסף תמונה" onClick={() => { setActiveTool('image'); setShowImagePicker(true); }}>
                  <ImageIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>הוסף תמונה מהמכשיר או הקבצים שלי</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={activeTool === 'icon' ? 'secondary' : 'ghost'} size="icon" className="h-7 w-7" aria-label="הוסף אמוג׳י או סמל" onClick={() => { setActiveTool('icon'); setShowEmojiPicker(true); }}>
                  <Smile className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>הוסף אמוג׳י או סמל דקורטיבי</p></TooltipContent>
            </Tooltip>
          </div>

          {/* Left group */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-40 cursor-not-allowed" aria-label="בטל פעולה אחרונה (בקרוב)" disabled>
                  <Undo className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>בטל פעולה אחרונה — יהיה זמין בקרוב</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-40 cursor-not-allowed" aria-label="בצע שוב פעולה (בקרוב)" disabled>
                  <Redo className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>בצע שוב פעולה — יהיה זמין בקרוב</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs bg-transparent border-white/20 text-slate-300 hover:text-white" aria-label="אפס ויצר מחדש את כל ההצגה" onClick={() => setShowResetConfirm(true)}>
                  <RefreshCw className="h-3 w-3 ml-1" />צור מחדש
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>מחק הכל ויצור מחדש את ההצגה מהנתונים שלך</p></TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm" className="h-7 px-3 text-xs bg-indigo-600 hover:bg-indigo-500" aria-label="ייצא את ההצגה">
                      ייצא ▾
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p>ייצא את ההצגה לקובץ</p></TooltipContent>
              </Tooltip>
              <DropdownMenuContent>
                <DropdownMenuItem className="opacity-50 cursor-not-allowed" onClick={() => toast({ title: 'ייצוא PDF בקרוב! 🚀' })}>📄 PDF — בקרוב</DropdownMenuItem>
                <DropdownMenuItem className="opacity-50 cursor-not-allowed" onClick={() => toast({ title: 'ייצוא Word בקרוב! 🚀' })}>📝 Word — בקרוב</DropdownMenuItem>
                <DropdownMenuItem className="opacity-50 cursor-not-allowed" onClick={() => toast({ title: 'ייצוא PowerPoint בקרוב! 🚀' })}>📊 PowerPoint — בקרוב</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* ===== MAIN AREA ===== */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ===== THUMBNAILS PANEL ===== */}
          <aside className="w-[120px] flex-shrink-0 border-l border-white/8 bg-slate-900/60 flex flex-col">
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
              {pages.map((page, index) => {
                const pt = DESIGN_TEMPLATES.find(t => t.id === page.templateId) || template;
                return (
                  <div
                    key={page.id}
                    title={`עמוד ${index + 1}: ${page.title}`}
                    className={cn('relative w-full rounded cursor-pointer border-2 group overflow-hidden transition-all', currentPageIndex === index ? 'border-indigo-500' : 'border-transparent hover:border-white/20')}
                    style={{ aspectRatio: canvasAspectRatio === 'a4-portrait' ? '1/1.414' : canvasAspectRatio === '9/16' ? '9/16' : canvasAspectRatio === '1:1' ? '1/1' : '1.414/1' }}
                    onClick={() => setCurrentPageIndex(index)}
                  >
                    <div className="absolute inset-0" style={getPageBackground(page, pt)} />
                    {page.elements.filter(el => el.type === 'text').slice(0, 3).map((el, i) => (
                      <div key={`t-${index}-${i}-${el.id}`} className="absolute overflow-hidden"
                        style={{ top: `${el.y}%`, left: `${el.x}%`, width: `${el.width}%`, fontSize: 3, color: pt.textColor, fontWeight: el.style?.fontWeight === 'extrabold' ? 800 : el.style?.fontWeight === 'bold' ? 700 : 400, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                        {(el.content || '').slice(0, 18)}
                      </div>
                    ))}
                    {page.elements.filter(el => el.type === 'person_card' || el.type === 'shape' || el.type === 'image').map((el, i) => (
                      <div key={`e-${index}-${i}-${el.id}`} className="absolute rounded-sm"
                        style={{ top: `${el.y}%`, left: `${el.x}%`, width: `${el.width}%`, height: `${el.height}%`, backgroundColor: el.type === 'person_card' ? (el.style?.backgroundColor || pt.cardBackground || 'rgba(255,255,255,0.15)') : el.type === 'shape' ? (el.style?.backgroundColor || pt.primaryColor) : 'rgba(255,255,255,0.2)', backgroundImage: el.type === 'image' && el.content ? `url(${el.content})` : undefined, backgroundSize: 'cover', opacity: 0.8 }} />
                    ))}
                    <span className="absolute bottom-0.5 left-0.5 text-white/50 font-bold leading-none" style={{ fontSize: 5 }}>{page.pageNumber}</span>
                    <button
                      title={`מחק עמוד "${page.title}"`}
                      aria-label={`מחק עמוד ${index + 1}: ${page.title}`}
                      className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 hover:bg-red-600"
                      style={{ fontSize: 8, lineHeight: 1 }}
                      onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
                      onClick={e => { e.stopPropagation(); e.preventDefault(); deletePage(index); }}
                    >✕</button>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-white/8 p-1.5 space-y-1.5">
              <input
                className="w-full text-[10px] bg-slate-800 border border-white/10 rounded px-1.5 py-1 text-center text-white focus:outline-none focus:border-indigo-400"
                value={currentPage?.title || ''}
                onChange={e => updateCurrentPage(p => ({ ...p, title: e.target.value }))}
                dir="rtl" placeholder="שם עמוד" title="שנה שם לעמוד הנוכחי"
              />
              <button
                title="הוסף עמוד ריק חדש"
                aria-label="הוסף עמוד ריק חדש בסוף ההצגה"
                onClick={addPage}
                className="w-full text-[10px] py-1 rounded border border-dashed border-white/20 text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors">
                + עמוד חדש
              </button>
            </div>
          </aside>

          {/* ===== CANVAS AREA ===== */}
          <main
            className="flex-1 flex items-center justify-center bg-[#13131f] overflow-hidden relative"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={e => handleContextMenu(e, null)}
          >
            {/* Checkerboard */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg,#333 25%,transparent 25%),linear-gradient(-45deg,#333 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#333 75%),linear-gradient(-45deg,transparent 75%,#333 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,0 8px,8px -8px,-8px 0px' }} />

            {/* Multi-select hint */}
            {activeTool === 'select' && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 pointer-events-none select-none z-10">
                Ctrl+לחיצה לבחירה מרובה · גרור להזזה · לחץ פעמיים לעריכת טקסט
              </div>
            )}

            <div className="relative shadow-2xl mx-auto" style={getCanvasStyle()}>
              <div
                id="canvas-container"
                ref={canvasRef}
                className="w-full h-full relative overflow-hidden"
                style={getPageBackground(currentPage, template)}
                onClick={handleCanvasClick}
                onContextMenu={e => handleContextMenu(e, null)}
              >
                <TemplateDecorations template={template} />

                {/* SVG connection lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 2 }}>
                  <defs>
                    <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill={template.primaryColor} />
                    </marker>
                  </defs>
                  {currentPage?.elements.filter(el => el.type === 'connection_line').map((el, li) => {
                    const from = currentPage.elements.find(e => e.id === el.fromElementId);
                    const to = currentPage.elements.find(e => e.id === el.toElementId);
                    if (!from || !to) return null;
                    const x1 = from.x + from.width / 2, y1 = from.y + from.height;
                    const x2 = to.x + to.width / 2, y2 = to.y;
                    const isSelected = selectedIds.includes(el.id);
                    return (
                      <g key={`line-${li}-${el.id}`} style={{ pointerEvents: 'stroke' }}
                        onClick={e2 => { e2.stopPropagation(); setSelectedIds([el.id]); }}
                        onContextMenu={e2 => handleContextMenu(e2, el.id)}>
                        <line x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="transparent" strokeWidth="12" style={{ cursor: 'pointer' }} />
                        <line x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                          stroke={isSelected ? '#60a5fa' : (el.style?.color || template.primaryColor)}
                          strokeWidth={isSelected ? (el.style?.borderWidth || 2) + 1 : (el.style?.borderWidth || 2)}
                          markerEnd="url(#arrow)" style={{ cursor: 'pointer' }} />
                      </g>
                    );
                  })}
                </svg>

                {/* Elements */}
                {currentPage?.elements.filter(el => el.type !== 'connection_line').map((el, elIndex) => {
                  const isSelected = selectedIds.includes(el.id);
                  return (
                    <div
                      key={`el-${currentPageIndex}-${elIndex}-${el.id}`}
                      title={el.type === 'text' ? (el.content || '').slice(0, 40) : el.type === 'person_card' ? `כרטיס: ${people.find(p => p.id === el.personId)?.firstName || 'אדם'}` : el.type}
                      className={cn('absolute', isSelected ? 'outline outline-2 outline-blue-400 outline-offset-1' : '', activeTool === 'select' && !editingElementId ? 'cursor-grab active:cursor-grabbing' : '')}
                      style={{ left: `${el.x}%`, top: `${el.y}%`, width: `${el.width}%`, height: `${el.height}%`, zIndex: (el.zIndex || 1) + 3 }}
                      onMouseDown={e => handleMouseDown(e, el)}
                      onContextMenu={e => handleContextMenu(e, el.id)}
                    >
                      {/* Resize handles */}
                      {isSelected && activeTool === 'select' && selectedIds.length === 1 && HANDLES.map(h => (
                        <div key={h.id} title={h.title} aria-label={h.title}
                          onMouseDown={ev => handleResizeMouseDown(ev, el, h.id)}
                          className="absolute w-[10px] h-[10px] bg-white border-2 border-blue-500 rounded-sm z-50 hover:bg-blue-100"
                          style={{ ...h.style, cursor: h.cursor, position: 'absolute' }} />
                      ))}

                      {/* Multi-select highlight (no resize handles) */}
                      {isSelected && selectedIds.length > 1 && (
                        <div className="absolute inset-0 border-2 border-blue-300 border-dashed pointer-events-none rounded" />
                      )}

                      {/* TEXT */}
                      {el.type === 'text' && (
                        editingElementId === el.id ? (
                          <textarea autoFocus
                            className="w-full h-full bg-transparent resize-none outline-none border-none p-1"
                            style={{ color: el.style?.color || template.textColor, fontSize: el.style?.fontSize, fontWeight: el.style?.fontWeight, textAlign: el.style?.textAlign || 'right', direction: 'rtl', lineHeight: el.style?.lineHeight || 1.4 }}
                            value={el.content || ''}
                            onChange={e2 => updateElement(el.id, { content: e2.target.value })}
                            onBlur={() => setEditingElementId(null)}
                            onClick={e2 => e2.stopPropagation()}
                            onMouseDown={e2 => e2.stopPropagation()}
                          />
                        ) : (
                          <div className="w-full h-full p-1 overflow-hidden select-none"
                            style={{ color: el.style?.color || template.textColor, fontSize: el.style?.fontSize, fontWeight: el.style?.fontWeight === 'extrabold' ? 800 : el.style?.fontWeight === 'bold' ? 700 : 400, textAlign: el.style?.textAlign || 'right', direction: 'rtl', whiteSpace: 'pre-wrap', lineHeight: el.style?.lineHeight || 1.4, opacity: el.style?.opacity, backgroundColor: el.style?.backgroundColor }}
                            onDoubleClick={e2 => { e2.stopPropagation(); setEditingElementId(el.id); setSelectedIds([el.id]); }}
                          >{el.content}</div>
                        )
                      )}

                      {/* PERSON CARD */}
                      {el.type === 'person_card' && (
                        <PersonCardElement element={el} people={people} relationships={relationships} scaleFactor={getScaleFactor(el)} />
                      )}

                      {/* IMAGE */}
                      {el.type === 'image' && el.content && (
                        <img src={el.content} alt="" className="w-full h-full"
                          style={{ objectFit: 'cover', opacity: el.style?.opacity, borderRadius: el.style?.borderRadius ? `${el.style.borderRadius}px` : 4 }} />
                      )}

                      {/* SHAPE */}
                      {el.type === 'shape' && (
                        <div className="w-full h-full" style={{
                          backgroundColor: el.style?.backgroundColor || template.primaryColor,
                          borderRadius: el.style?.shapeType === 'circle' ? '50%' : el.style?.shapeType === 'rounded_rectangle' ? '14px' : el.style?.shapeType === 'diamond' ? 0 : (el.style?.borderRadius || 0),
                          transform: el.style?.shapeType === 'diamond' ? 'rotate(45deg)' : undefined,
                          clipPath: el.style?.shapeType === 'star' ? 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)' : undefined,
                          border: el.style?.borderColor ? `${el.style.borderWidth || 2}px solid ${el.style.borderColor}` : undefined,
                          opacity: el.style?.opacity,
                        }} />
                      )}

                      {/* ICON */}
                      {el.type === 'icon' && (
                        <div className="w-full h-full flex items-center justify-center select-none" style={{ fontSize: el.style?.fontSize || 32 }}>{el.content}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ===== PERSON PICKER — anchored to right side, full height ===== */}
            {showPersonPicker && (
              <div className="absolute top-0 right-0 h-full w-60 bg-slate-800 border-l border-white/10 z-40 flex flex-col shadow-2xl" dir="rtl">
                <div className="p-2.5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-bold text-xs">הוסף כרטיס אדם</h3>
                  <button aria-label="סגור חלונית כרטיסי אנשים" onClick={() => { setShowPersonPicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
                </div>
                <input className="m-2 px-2.5 py-1.5 bg-slate-700 rounded-lg text-xs text-right placeholder:text-slate-500 border border-white/10 focus:outline-none focus:border-indigo-400" placeholder="חפש שם..." value={personSearch} onChange={e => setPersonSearch(e.target.value)} dir="rtl" aria-label="חפש אדם לפי שם" />
                <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                  {people.filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(personSearch.toLowerCase())).map(person => (
                    <button key={person.id} title={`הוסף כרטיס של ${person.firstName} ${person.lastName}`}
                      onClick={() => { addElement({ type: 'person_card', personId: person.id, x: 20, y: 20, width: 28, height: 36, zIndex: 10 }); setShowPersonPicker(false); setActiveTool('select'); }}
                      className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-white/10 text-right">
                      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                        <img src={person.photoURL || getPlaceholderImage(person.gender)} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-right flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{person.firstName} {person.lastName}</p>
                        {person.birthDate && <p className="text-[10px] text-slate-400">{new Date(person.birthDate).getFullYear()}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ===== IMAGE PICKER — anchored to right ===== */}
            {showImagePicker && (
              <div className="absolute top-0 right-0 h-full w-64 bg-slate-800 border-l border-white/10 z-40 flex flex-col shadow-2xl" dir="rtl">
                <div className="p-2.5 border-b border-white/10 flex items-center justify-between">
                  <h3 className="font-bold text-xs">הוסף תמונה</h3>
                  <button aria-label="סגור חלונית תמונות" onClick={() => { setShowImagePicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
                </div>
                <div className="p-2.5 border-b border-white/10">
                  <label className="cursor-pointer flex flex-col items-center gap-1.5 p-3 border-2 border-dashed border-white/20 rounded-xl hover:border-indigo-400 transition-colors" title="בחר תמונה מהמכשיר שלך">
                    <ImageIcon className="w-6 h-6 text-slate-400" />
                    <span className="text-xs text-slate-400 text-center">העלה מהמכשיר</span>
                    <input type="file" accept="image/*" className="hidden" aria-label="העלה תמונה מהמכשיר" onChange={e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const reader = new FileReader();
                      reader.onload = ev => { addElement({ type: 'image', content: ev.target?.result as string, x: 10, y: 10, width: 40, height: 30, zIndex: 5 }); setShowImagePicker(false); setActiveTool('select'); };
                      reader.readAsDataURL(file);
                    }} />
                  </label>
                </div>
                <div className="p-2.5 flex-1 overflow-y-auto">
                  <p className="text-[10px] font-bold text-slate-300 text-right mb-1.5">הקבצים שלי</p>
                  <MyFilesImageGrid treeId={project.treeId} onSelectImage={url => { addElement({ type: 'image', content: url, x: 10, y: 10, width: 40, height: 30, zIndex: 5 }); setShowImagePicker(false); setActiveTool('select'); }} />
                </div>
              </div>
            )}

            {/* ===== EMOJI PICKER MODAL ===== */}
            {showEmojiPicker && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => { setShowEmojiPicker(false); setActiveTool('select'); }}>
                <div className="bg-slate-800 rounded-2xl p-4 w-72 shadow-2xl border border-white/10" onClick={e => e.stopPropagation()} dir="rtl">
                  <div className="flex items-center justify-between mb-3">
                    <button aria-label="סגור בורר אמוג׳י" onClick={() => { setShowEmojiPicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white">✕</button>
                    <h3 className="font-bold text-sm">הוסף אמוג׳י</h3>
                  </div>
                  <input className="w-full px-3 py-1.5 bg-slate-700 rounded-lg text-sm text-center placeholder:text-slate-500 border border-white/10 focus:outline-none mb-3" placeholder="הקלד אמוג׳י..." value={emojiInput} onChange={e => setEmojiInput(e.target.value)} aria-label="הקלד אמוג׳י ידנית" />
                  <div className="grid grid-cols-8 gap-1">
                    {['❤️','⭐','🌟','✨','🔥','💫','🎯','🌈','🌺','🌸','🍀','🌿','🕊️','🦋','🌙','☀️','🏡','👨‍👩‍👧‍👦','👨‍👩‍👦','👪','🤝','💝','🎗️','📖','✡️','🕍','🇮🇱','🗺️','📍','📜','🏺','💎','🎵','🌍','🕰️','🌾'].map(emoji => (
                      <button key={emoji} title={`הוסף ${emoji}`} className="text-lg p-1 hover:bg-white/10 rounded transition-colors"
                        onClick={() => { addElement({ type: 'icon', content: emojiInput || emoji, x: 40, y: 40, width: 10, height: 10, style: { fontSize: 32, textAlign: 'center' }, zIndex: 15 }); setShowEmojiPicker(false); setActiveTool('select'); }}>{emoji}</button>
                    ))}
                  </div>
                  {emojiInput && (
                    <button className="w-full mt-2 p-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-bold" aria-label={`הוסף אמוג׳י מותאם: ${emojiInput}`}
                      onClick={() => { addElement({ type: 'icon', content: emojiInput, x: 40, y: 40, width: 10, height: 10, style: { fontSize: 32, textAlign: 'center' }, zIndex: 15 }); setShowEmojiPicker(false); setActiveTool('select'); }}>
                      הוסף: {emojiInput}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ===== CONTEXT MENU ===== */}
            {ctxMenu && (
              <div
                data-ctx-menu="true"
                className="fixed bg-slate-800 border border-white/15 rounded-xl shadow-2xl py-1 z-[100] min-w-[180px]"
                style={{
                  // Clamp to viewport so it never goes off-screen
                  top: Math.min(ctxMenu.y, window.innerHeight - 260),
                  left: Math.min(ctxMenu.x, window.innerWidth - 200),
                }}
                dir="rtl"
                onClick={e => e.stopPropagation()}
              >
                {ctxMenu.elementId ? (
                  <>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" title="גזור אלמנט" onClick={() => { cutElement(ctxMenu.elementId!); setCtxMenu(null); }}><Scissors className="w-3.5 h-3.5" />גזור (Ctrl+X)</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" title="העתק אלמנט" onClick={() => { copyElement(ctxMenu.elementId!); setCtxMenu(null); }}><Copy className="w-3.5 h-3.5" />העתק (Ctrl+C)</button>
                    {_clipboard && <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" title="הדבק אלמנט מהלוח" onClick={() => { pasteElement(); setCtxMenu(null); }}><Clipboard className="w-3.5 h-3.5" />הדבק (Ctrl+V)</button>}
                    <div className="my-1 border-t border-white/10" />
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" title="שכפל אלמנט" onClick={() => { duplicateElementById(ctxMenu.elementId!); setCtxMenu(null); }}><Copy className="w-3.5 h-3.5" />שכפל</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" title="הבא אלמנט לשכבה קדימה" onClick={() => { updateElement(ctxMenu.elementId!, el => ({ zIndex: (el.zIndex || 0) + 1 })); setCtxMenu(null); }}><ChevronUp className="w-3.5 h-3.5" />הבא קדימה</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" title="שלח אלמנט לשכבה אחורה" onClick={() => { updateElement(ctxMenu.elementId!, el => ({ zIndex: Math.max(0, (el.zIndex || 0) - 1) })); setCtxMenu(null); }}><ChevronDown className="w-3.5 h-3.5" />שלח אחורה</button>
                    <div className="my-1 border-t border-white/10" />
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" title="אפס לגודל ברירת מחדל" onClick={() => { resetElementSize(ctxMenu.elementId!); setCtxMenu(null); }}><RefreshCw className="w-3.5 h-3.5" />אפס גודל</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" title="אפס יחס מידות (4:3)" onClick={() => { resetElementRatio(ctxMenu.elementId!); setCtxMenu(null); }}><Maximize2 className="w-3.5 h-3.5" />אפס יחס מידות</button>
                    <div className="my-1 border-t border-white/10" />
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-red-500/20 text-red-400 flex items-center gap-2" title="מחק אלמנט זה מהדף" onClick={() => { deleteElementById(ctxMenu.elementId!); setSelectedIds([]); setCtxMenu(null); }}><Trash2 className="w-3.5 h-3.5" />מחק</button>
                  </>
                ) : (
                  <>
                    {_clipboard && <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" title="הדבק מהלוח" onClick={() => { pasteElement(); setCtxMenu(null); }}><Clipboard className="w-3.5 h-3.5" />הדבק (Ctrl+V)</button>}
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { addPage(); setCtxMenu(null); }}>+ הוסף עמוד</button>
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-white/10 flex items-center gap-2" onClick={() => { setShowTemplatePicker(true); setCtxMenu(null); }}>🎨 שנה תבנית</button>
                    <div className="my-1 border-t border-white/10" />
                    <button className="w-full text-right px-3 py-1.5 text-xs hover:bg-red-500/20 text-red-400 flex items-center gap-2" title="מחק עמוד זה" onClick={() => { deletePage(currentPageIndex); setCtxMenu(null); }}><Trash2 className="w-3.5 h-3.5" />מחק עמוד זה</button>
                  </>
                )}
              </div>
            )}
          </main>
        </div>

        {/* ===== BOTTOM CONTEXT BAR ===== */}
        <div className="h-10 border-t border-white/10 bg-slate-900/90 backdrop-blur flex-shrink-0 flex items-center gap-2 px-3 overflow-x-auto overflow-y-hidden" style={{ minWidth: 0 }}>

          {/* Element type label */}
          <span className="text-[10px] text-slate-500 whitespace-nowrap flex-shrink-0 w-[52px] text-right">
            {selectedElement
              ? selectedElement.type === 'text' ? '✏️ טקסט' : selectedElement.type === 'person_card' ? '👤 כרטיס' : selectedElement.type === 'shape' ? '◼ צורה' : selectedElement.type === 'image' ? '🖼 תמונה' : selectedElement.type === 'icon' ? '😊 סמל' : selectedElement.type === 'connection_line' ? '↔ קו' : '?'
              : selectedIds.length > 1 ? `${selectedIds.length} נבחרו` : '📄 עמוד'}
          </span>
          <div className="w-px h-6 bg-white/10 flex-shrink-0" />

          {/* ── PAGE controls ── */}
          {!selectedElement && selectedIds.length === 0 && currentPage && (<>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">רקע:</span>
              <div className="flex border border-white/10 rounded overflow-hidden">
                <button title="צבע רקע אחיד" onClick={() => setBgMode('solid')} className={cn('text-[10px] px-1.5 py-0.5 transition-colors', bgMode === 'solid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5')}>אחיד</button>
                <button title="רקע גרדיאנט (שני צבעים)" onClick={() => setBgMode('gradient')} className={cn('text-[10px] px-1.5 py-0.5 transition-colors', bgMode === 'gradient' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5')}>גרדיאנט</button>
              </div>
            </div>
            {bgMode === 'solid' ? (
              <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent flex-shrink-0"
                title="בחר צבע רקע לדף" aria-label="בחר צבע רקע אחיד לדף"
                value={(currentPage as any).backgroundColor || template.backgroundColor}
                onChange={e => updateCurrentPage(p => ({ ...p, backgroundColor: e.target.value, backgroundGradient: undefined }))} />
            ) : (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" title="צבע התחלה לגרדיאנט" aria-label="צבע התחלה של גרדיאנט הרקע"
                  value={gradientFrom}
                  onChange={e => { setGradientFrom(e.target.value); updateCurrentPage(p => ({ ...p, backgroundGradient: `linear-gradient(135deg, ${e.target.value} 0%, ${gradientTo} 100%)`, backgroundColor: undefined })); }} />
                <span className="text-[10px] text-slate-500">→</span>
                <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent" title="צבע סיום לגרדיאנט" aria-label="צבע סיום של גרדיאנט הרקע"
                  value={gradientTo}
                  onChange={e => { setGradientTo(e.target.value); updateCurrentPage(p => ({ ...p, backgroundGradient: `linear-gradient(135deg, ${gradientFrom} 0%, ${e.target.value} 100%)`, backgroundColor: undefined })); }} />
                <select className="text-[10px] bg-slate-800 border border-white/10 rounded px-1 py-0.5 text-slate-300" title="כיוון הגרדיאנט" aria-label="בחר כיוון לגרדיאנט הרקע"
                  onChange={e => updateCurrentPage(p => ({ ...p, backgroundGradient: e.target.value.replace('FROM', gradientFrom).replace('TO', gradientTo), backgroundColor: undefined }))}>
                  <option value="linear-gradient(135deg, FROM 0%, TO 100%)">↘ אלכסוני</option>
                  <option value="linear-gradient(to bottom, FROM 0%, TO 100%)">↓ למטה</option>
                  <option value="radial-gradient(ellipse at center, FROM 0%, TO 100%)">○ עיגולי</option>
                  <option value="linear-gradient(to left, FROM 0%, TO 100%)">← שמאלה</option>
                </select>
              </div>
            )}
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <label className="cursor-pointer flex items-center gap-1 px-2 py-1 border border-dashed border-white/20 rounded text-[10px] text-slate-400 hover:border-indigo-400 flex-shrink-0 whitespace-nowrap" title="הוסף תמונת רקע לדף">
              <ImageIcon className="w-3 h-3" />תמונת רקע
              <input type="file" accept="image/*" className="hidden" aria-label="העלה תמונת רקע לדף" onChange={e => {
                const file = e.target.files?.[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => updateCurrentPage(p => ({ ...p, backgroundImage: ev.target?.result as string } as any));
                reader.readAsDataURL(file);
              }} />
            </label>
            {(currentPage as any).backgroundImage && (
              <button className="text-[10px] text-red-400 hover:text-red-300 flex-shrink-0 whitespace-nowrap" title="הסר תמונת רקע" aria-label="הסר את תמונת הרקע מהדף" onClick={() => updateCurrentPage(p => ({ ...p, backgroundImage: undefined } as any))}>✕ הסר רקע</button>
            )}
          </>)}

          {/* ── Multi-select controls ── */}
          {selectedIds.length > 1 && (<>
            <button title={`מחק ${selectedIds.length} אלמנטים נבחרים`} aria-label={`מחק ${selectedIds.length} אלמנטים נבחרים`} className="text-[10px] px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-red-500 text-red-300 flex-shrink-0 whitespace-nowrap" onClick={() => { selectedIds.forEach(id => deleteElementById(id)); setSelectedIds([]); }}>🗑 מחק הכל ({selectedIds.length})</button>
            <button title={`שכפל ${selectedIds.length} אלמנטים נבחרים`} aria-label={`שכפל את כל האלמנטים הנבחרים`} className="text-[10px] px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex-shrink-0 whitespace-nowrap" onClick={() => selectedIds.forEach(id => duplicateElementById(id))}>⎘ שכפל הכל</button>
            <div className="flex gap-0.5 flex-shrink-0">
              {[
                { l: '⊢', t: 'ישר לימין', a: () => selectedIds.forEach(id => updateElement(id, el => ({ x: 100 - el.width }))) },
                { l: '⊕H', t: 'מרכז אופקי', a: () => selectedIds.forEach(id => updateElement(id, el => ({ x: 50 - el.width / 2 }))) },
                { l: '⊣', t: 'ישר לשמאל', a: () => selectedIds.forEach(id => updateElement(id, { x: 0 })) },
                { l: '⊤', t: 'ישר לעליון', a: () => selectedIds.forEach(id => updateElement(id, { y: 0 })) },
                { l: '⊕V', t: 'מרכז אנכי', a: () => selectedIds.forEach(id => updateElement(id, el => ({ y: 50 - el.height / 2 }))) },
                { l: '⊥', t: 'ישר לתחתון', a: () => selectedIds.forEach(id => updateElement(id, el => ({ y: 100 - el.height }))) },
              ].map(({ l, t, a }) => (
                <Tooltip key={t}>
                  <TooltipTrigger asChild>
                    <button title={t} aria-label={t} onClick={a} className="text-[10px] px-1.5 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 whitespace-nowrap">{l}</button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>{t}</p></TooltipContent>
                </Tooltip>
              ))}
            </div>
          </>)}

          {/* ── TEXT controls ── */}
          {selectedElement?.type === 'text' && (<>
            <input type="number" min={6} max={120} className="w-12 text-[10px] bg-slate-800 border border-white/10 rounded px-1 py-1 text-center text-white focus:outline-none flex-shrink-0"
              title="גודל גופן בפיקסלים" aria-label="גודל גופן"
              value={selectedElement.style?.fontSize || 16}
              onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, fontSize: Number(e.target.value) } })} />
            <div className="flex gap-0.5 flex-shrink-0">
              {([['normal','R','רגיל'],['bold','B','מודגש'],['extrabold','BB','מודגש מאוד']] as const).map(([w, l, t]) => (
                <Tooltip key={w}>
                  <TooltipTrigger asChild>
                    <button title={t} aria-label={t} onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, fontWeight: w } })}
                      className={cn('text-[10px] px-1.5 py-1 rounded border whitespace-nowrap', selectedElement.style?.fontWeight === w ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}>
                      {l}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>{t}</p></TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="flex gap-0.5 flex-shrink-0">
              {([['right', <AlignRight key="r" className="w-3 h-3" />, 'יישור לימין'],['center', <AlignCenter key="c" className="w-3 h-3" />, 'מרכז'],['left', <AlignLeft key="l" className="w-3 h-3" />, 'יישור לשמאל']] as const).map(([a, icon, t]) => (
                <Tooltip key={a as string}>
                  <TooltipTrigger asChild>
                    <button title={t} aria-label={t} onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, textAlign: a as TextAlign } })}
                      className={cn('px-1.5 py-1 rounded border', selectedElement.style?.textAlign === a ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}>
                      {icon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>{t}</p></TooltipContent>
                </Tooltip>
              ))}
            </div>
            <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent flex-shrink-0"
              title="בחר צבע טקסט" aria-label="בחר צבע לטקסט"
              value={selectedElement.style?.color || '#ffffff'}
              onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, color: e.target.value } })} />
            <div className="flex gap-0.5 flex-shrink-0">
              {['#ffffff','#000000','#818cf8','#14b8a6','#f59e0b','#ef4444'].map(c => (
                <button key={c} title={`צבע טקסט: ${c}`} aria-label={`צבע טקסט ${c}`} className="w-4 h-4 rounded-full border border-white/20 hover:scale-125 transition-transform flex-shrink-0" style={{ backgroundColor: c }}
                  onClick={() => updateElement(selectedId!, { style: { ...selectedElement.style, color: c } })} />
              ))}
            </div>
          </>)}

          {/* ── PERSON CARD controls ── */}
          {selectedElement?.type === 'person_card' && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">שקיפות:</span>
              <input type="range" min={0} max={1} step={0.05} className="w-20" title="שקיפות הכרטיס (0=שקוף, 1=מלא)" aria-label="שקיפות כרטיס האדם"
                value={selectedElement.style?.opacity ?? 1}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) } })} />
              <span className="text-[10px] text-slate-500">{Math.round((selectedElement.style?.opacity ?? 1) * 100)}%</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent flex-shrink-0"
                  aria-label="צבע רקע כרטיס האדם"
                  value={selectedElement.style?.backgroundColor?.startsWith('#') ? selectedElement.style.backgroundColor : '#1e293b'}
                  onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, backgroundColor: e.target.value } })} />
              </TooltipTrigger>
              <TooltipContent side="top"><p>צבע רקע הכרטיס</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent flex-shrink-0"
                  aria-label="צבע טקסט בכרטיס האדם"
                  value={selectedElement.style?.color || '#ffffff'}
                  onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, color: e.target.value } })} />
              </TooltipTrigger>
              <TooltipContent side="top"><p>צבע טקסט הכרטיס</p></TooltipContent>
            </Tooltip>
          </>)}

          {/* ── SHAPE controls ── */}
          {selectedElement?.type === 'shape' && (<>
            <Tooltip>
              <TooltipTrigger asChild>
                <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent flex-shrink-0" aria-label="צבע הצורה"
                  value={selectedElement.style?.backgroundColor || template.primaryColor}
                  onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, backgroundColor: e.target.value } })} />
              </TooltipTrigger>
              <TooltipContent side="top"><p>צבע הצורה</p></TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">שקיפות:</span>
              <input type="range" min={0} max={1} step={0.05} className="w-20" aria-label="שקיפות הצורה"
                value={selectedElement.style?.opacity ?? 1}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) } })} />
            </div>
          </>)}

          {/* ── IMAGE controls ── */}
          {selectedElement?.type === 'image' && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">שקיפות:</span>
              <input type="range" min={0} max={1} step={0.05} className="w-20" aria-label="שקיפות התמונה"
                value={selectedElement.style?.opacity ?? 1}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) } })} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">פינות:</span>
              <input type="range" min={0} max={50} step={1} className="w-20" aria-label="עיגול פינות התמונה"
                value={selectedElement.style?.borderRadius ?? 0}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderRadius: Number(e.target.value) } })} />
            </div>
            <label className="cursor-pointer flex items-center gap-1 px-1.5 py-0.5 border border-dashed border-white/20 rounded text-[10px] text-slate-400 hover:border-indigo-400 flex-shrink-0 whitespace-nowrap" title="החלף את התמונה בתמונה אחרת">
              <ImageIcon className="w-3 h-3" />החלף
              <input type="file" accept="image/*" className="hidden" aria-label="החלף תמונה" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => updateElement(selectedId!, { content: ev.target?.result as string }); reader.readAsDataURL(file); }} />
            </label>
          </>)}

          {/* ── CONNECTION LINE controls ── */}
          {selectedElement?.type === 'connection_line' && (<>
            <Tooltip>
              <TooltipTrigger asChild>
                <input type="color" className="w-7 h-7 rounded cursor-pointer border border-white/10 bg-transparent flex-shrink-0" aria-label="צבע קו הקישור"
                  value={selectedElement.style?.color || template.primaryColor}
                  onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, color: e.target.value } })} />
              </TooltipTrigger>
              <TooltipContent side="top"><p>צבע הקו</p></TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">עובי:</span>
              <input type="range" min={1} max={8} step={1} className="w-16" aria-label="עובי קו הקישור"
                value={selectedElement.style?.borderWidth || 2}
                onChange={e => updateElement(selectedId!, { style: { ...selectedElement.style, borderWidth: Number(e.target.value) } })} />
            </div>
            <button title="מחק קו קישור" aria-label="מחק קו קישור זה" onClick={() => { deleteElementById(selectedId!); setSelectedIds([]); }} className="text-[10px] px-2 py-1 rounded bg-red-900/60 border border-red-700/40 hover:bg-red-800/60 text-red-300 flex items-center gap-1 flex-shrink-0 whitespace-nowrap mr-auto"><Trash2 className="w-3 h-3" />מחק קו</button>
          </>)}

          {/* ── SHARED controls (non-line single-selected) ── */}
          {selectedElement && selectedElement.type !== 'connection_line' && (<>
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <div className="flex gap-0.5 flex-shrink-0">
              {[
                { l: '⊢', t: 'ישר לימין', a: () => updateElement(selectedId!, el => ({ x: 100 - el.width })) },
                { l: '⊕H', t: 'מרכז אופקי', a: () => updateElement(selectedId!, el => ({ x: 50 - el.width / 2 })) },
                { l: '⊣', t: 'ישר לשמאל', a: () => updateElement(selectedId!, { x: 0 }) },
                { l: '⊤', t: 'ישר לעליון', a: () => updateElement(selectedId!, { y: 0 }) },
                { l: '⊕V', t: 'מרכז אנכי', a: () => updateElement(selectedId!, el => ({ y: 50 - el.height / 2 })) },
                { l: '⊥', t: 'ישר לתחתון', a: () => updateElement(selectedId!, el => ({ y: 100 - el.height })) },
              ].map(({ l, t, a }) => (
                <Tooltip key={t}>
                  <TooltipTrigger asChild>
                    <button title={t} aria-label={t} onClick={a} className="text-[10px] px-1.5 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 whitespace-nowrap">{l}</button>
                  </TooltipTrigger>
                  <TooltipContent side="top"><p>{t}</p></TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button title="הבא לשכבה קדימה" aria-label="הבא אלמנט לשכבה קדימה" onClick={() => updateElement(selectedId!, el => ({ zIndex: (el.zIndex || 0) + 1 }))} className="text-[10px] px-1.5 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex items-center gap-0.5 flex-shrink-0"><ChevronUp className="w-3 h-3" />קדימה</button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>הבא אלמנט לשכבה קדימה</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button title="שלח לשכבה אחורה" aria-label="שלח אלמנט לשכבה אחורה" onClick={() => updateElement(selectedId!, el => ({ zIndex: Math.max(0, (el.zIndex || 0) - 1) }))} className="text-[10px] px-1.5 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex items-center gap-0.5 flex-shrink-0"><ChevronDown className="w-3 h-3" />אחורה</button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>שלח אלמנט לשכבה אחורה</p></TooltipContent>
            </Tooltip>
            <div className="w-px h-6 bg-white/10 flex-shrink-0" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button title="שכפל אלמנט" aria-label="שכפל אלמנט נבחר" onClick={() => duplicateElementById(selectedId!)} className="text-[10px] px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 flex items-center gap-1 flex-shrink-0"><Copy className="w-3 h-3" />שכפל</button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>שכפל אלמנט זה</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button title="מחק אלמנט" aria-label="מחק אלמנט נבחר" onClick={() => { deleteElementById(selectedId!); setSelectedIds([]); }} className="text-[10px] px-2 py-1 rounded bg-red-900/60 border border-red-700/40 hover:bg-red-800/60 text-red-300 flex items-center gap-1 flex-shrink-0"><Trash2 className="w-3 h-3" />מחק</button>
              </TooltipTrigger>
              <TooltipContent side="top"><p>מחק אלמנט נבחר מהדף</p></TooltipContent>
            </Tooltip>
          </>)}
        </div>

        {/* ===== TEMPLATE PICKER MODAL ===== */}
        {showTemplatePicker && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplatePicker(false)}>
            <div className="bg-slate-800 rounded-2xl p-5 w-[640px] max-h-[85vh] overflow-y-auto border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl">
              <div className="flex items-center justify-between mb-4">
                <button aria-label="סגור בחירת תבנית" onClick={() => setShowTemplatePicker(false)} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
                <h2 className="text-lg font-bold">בחר תבנית עיצוב</h2>
              </div>
              <div className="flex items-center gap-2 mb-4 justify-end">
                <label className="text-xs text-slate-300">החל על כל העמודים</label>
                <button aria-label={applyTemplateToAll ? 'בטל החלה על כל העמודים' : 'החל תבנית על כל העמודים'} onClick={() => setApplyTemplateToAll(!applyTemplateToAll)}
                  className={cn('rounded-full transition-colors relative flex-shrink-0', applyTemplateToAll ? 'bg-indigo-500' : 'bg-slate-600')} style={{ width: 36, height: 18 }}>
                  <div className={cn('absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all', applyTemplateToAll ? 'right-0.5' : 'left-0.5')} />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {DESIGN_TEMPLATES.map(t => (
                  <button key={t.id} title={`${t.nameHebrew} — לחץ לבחור תבנית זו`} aria-label={`תבנית: ${t.nameHebrew}`}
                    onClick={() => {
                      setSelectedTemplateId(t.id);
                      if (applyTemplateToAll) updatePages(ps => ps.map(pg => ({ ...pg, templateId: t.id })));
                      else updateCurrentPage(pg => ({ ...pg, templateId: t.id }));
                      setShowTemplatePicker(false);
                    }}
                    className={cn('rounded-xl overflow-hidden border-2 transition-all', selectedTemplateId === t.id ? 'border-indigo-400 scale-105' : 'border-transparent hover:border-white/30')}>
                    <div className="h-20 relative overflow-hidden" style={{ background: t.backgroundGradient }}>
                      <div className="absolute top-2 left-0 right-0 flex justify-center">
                        <div className="h-1.5 rounded-full w-12" style={{ background: t.titleStyle === 'gradient' ? `linear-gradient(90deg, ${t.primaryColor}, ${t.accentColor})` : t.primaryColor }} />
                      </div>
                      <div className="absolute top-5 left-2 right-2 space-y-1">
                        <div className="h-1 rounded-full opacity-50" style={{ backgroundColor: t.textColor, width: '75%' }} />
                        <div className="h-1 rounded-full opacity-30" style={{ backgroundColor: t.textColor, width: '55%' }} />
                      </div>
                      <div className="absolute bottom-2 right-2 w-7 h-7 rounded-lg" style={{ backgroundColor: t.cardBackground, border: `1px solid rgba(255,255,255,0.2)` }} />
                      {t.decorativePattern === 'corners' && <>
                        <div className="absolute top-1 right-1 w-3 h-3 border-t border-r opacity-40" style={{ borderColor: t.primaryColor }} />
                        <div className="absolute bottom-1 left-1 w-3 h-3 border-b border-l opacity-40" style={{ borderColor: t.primaryColor }} />
                      </>}
                      {t.decorativePattern === 'border' && <div className="absolute inset-1 border opacity-20 rounded" style={{ borderColor: t.primaryColor }} />}
                      {t.decorativePattern === 'dots' && <div className="absolute inset-0 opacity-15" style={{ backgroundImage: `radial-gradient(circle, ${t.primaryColor} 1px, transparent 1px)`, backgroundSize: '8px 8px' }} />}
                    </div>
                    <div className="py-1 text-center" style={{ backgroundColor: t.backgroundColor }}>
                      <p className="text-[10px] font-bold" style={{ color: t.textColor }}>{t.nameHebrew}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== RESET CONFIRM MODAL ===== */}
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setShowResetConfirm(false)}>
            <div className="bg-slate-800 rounded-2xl p-6 w-80 border border-white/10 shadow-2xl text-center" onClick={e => e.stopPropagation()} dir="rtl">
              <div className="text-4xl mb-3">🔄</div>
              <h2 className="text-lg font-bold mb-2">יצירה מחדש של ההצגה</h2>
              <p className="text-sm text-slate-400 mb-4">פעולה זו תמחק את כל העמודים הנוכחיים ותיצור מחדש את ההצגה מהנתונים שלך. לא ניתן לבטל פעולה זו.</p>
              <div className="flex gap-2 justify-center">
                <button className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm" onClick={() => setShowResetConfirm(false)}>ביטול</button>
                <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold" onClick={handleResetPages}>✨ צור מחדש</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}