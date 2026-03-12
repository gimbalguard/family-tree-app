
'use client';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootsProject, Person, Relationship, ExportedFile, DesignPage, DesignTemplate, DesignElement, ShapeType, TextAlign, CanvasAspectRatio } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    ArrowLeft, ChevronDown, Circle, Diamond, GitMerge, Image as ImageIcon, LayoutPanelTop, MousePointer2, Pilcrow, Plus, PlusCircle, Redo, RotateCcw, Smile, Square, Star, Trash2, Undo, User,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { v4 as uuidv4 } from 'uuid';
import { useUser, useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';


// ============================================================
// TYPES
// ============================================================

// All types moved to src/lib/types.ts

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
    id: uuidv4(),
    pageNumber: pageNumber++,
    pageType: 'cover',
    title: 'שער',
    templateId,
    elements: [
      {
        id: uuidv4(),
        type: 'text',
        content: project.projectData?.projectName || 'עבודת שורשים',
        x: 10, y: 30, width: 80, height: 20,
        style: { fontSize: 48, fontWeight: 'extrabold', textAlign: 'center' }
      },
      {
        id: uuidv4(),
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
      id: uuidv4(),
      pageNumber: pageNumber++,
      pageType: 'name',
      title: 'השם שלי',
      templateId,
      elements: [
        { id: uuidv4(), type: 'text', content: 'השם שלי', x: 10, y: 10, width: 80, height: 10, style: { fontSize: 36, fontWeight: 'bold', textAlign: 'center' } },
        { id: uuidv4(), type: 'text', content: project.projectData.personalStory.nameMeaning, x: 15, y: 25, width: 70, height: 60, style: { fontSize: 16 } },
      ]
    });
  }

  // 3. Nuclear Family
  const parentRels = relationships.filter(r => r.personBId === project.studentPersonId && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType));
  const parents = parentRels.map(r => people.find(p => p.id === r.personAId)).filter(Boolean) as Person[];

  const nuclearFamilyElements: DesignElement[] = [];
  const studentCardId = uuidv4();
  if (student) {
    nuclearFamilyElements.push({
      id: studentCardId,
      type: 'person_card',
      personId: student.id,
      x: 35, y: 60, width: 30, height: 28,
      zIndex: 10
    });
  }
  parents.forEach((parent, pIndex) => {
    const parentCardId = uuidv4();
    nuclearFamilyElements.push({
      id: parentCardId,
      type: 'person_card',
      personId: parent.id,
      x: 20 + (pIndex * 40), y: 20, width: 30, height: 28,
      zIndex: 10
    });
    if (student) {
      nuclearFamilyElements.push({
        id: uuidv4(),
        type: 'connection_line',
        fromElementId: parentCardId,
        toElementId: studentCardId,
        x: 0, y: 0, width: 0, height: 0,
        zIndex: 1
      });
    }
  });

  if (nuclearFamilyElements.length > 0) {
    pages.push({
      id: uuidv4(),
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
      id: uuidv4(),
      pageNumber: pageNumber++,
      pageType: 'personal',
      title: 'הסיפור שלי',
      templateId,
      elements: [
        { id: uuidv4(), type: 'text', content: 'הסיפור שלי', x: 5, y: 5, width: 90, height: 10, style: { fontSize: 36, fontWeight: 'extrabold', textAlign: 'right' } },
        { id: uuidv4(), type: 'text', content: 'סיפור הלידה:', x: 5, y: 18, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
        { id: uuidv4(), type: 'text', content: project.projectData.personalStory.birthStory, x: 5, y: 24, width: 90, height: 30, style: { fontSize: 13, textAlign: 'right' } },
        ...(project.projectData.personalStory.personalVision ? [
          { id: uuidv4(), type: 'text', content: 'החזון שלי:', x: 5, y: 57, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
          { id: uuidv4(), type: 'text', content: project.projectData.personalStory.personalVision, x: 5, y: 63, width: 90, height: 30, style: { fontSize: 13, textAlign: 'right' } },
        ] as DesignElement[] : []),
      ]
    });
  }

  // Page 5 — Paternal Roots
  const paternalGF = project.projectData?.familyRoots?.paternalGrandfather;
  const paternalGM = project.projectData?.familyRoots?.paternalGrandmother;
  if (paternalGF || paternalGM) {
    const paternalElements: DesignElement[] = [
      { id: uuidv4(), type: 'text', content: 'שורשים מצד אבא', x: 5, y: 3, width: 90, height: 8, style: { fontSize: 30, fontWeight: 'extrabold', textAlign: 'right' } },
    ];
    if (paternalGF?.personId) {
      paternalElements.push({ id: uuidv4(), type: 'person_card', personId: paternalGF.personId, x: 5, y: 14, width: 28, height: 28, zIndex: 10 });
    }
    if (paternalGF?.story) {
      paternalElements.push({ id: uuidv4(), type: 'text', content: paternalGF.story, x: 35, y: 14, width: 60, height: 28, style: { fontSize: 11, textAlign: 'right' } });
    }
    if (paternalGM?.personId) {
      paternalElements.push({ id: uuidv4(), type: 'person_card', personId: paternalGM.personId, x: 5, y: 46, width: 28, height: 28, zIndex: 10 });
    }
    if (paternalGM?.story) {
      paternalElements.push({ id: uuidv4(), type: 'text', content: paternalGM.story, x: 35, y: 46, width: 60, height: 28, style: { fontSize: 11, textAlign: 'right' } });
    }
    pages.push({
      id: uuidv4(),
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
        { id: uuidv4(), type: 'text', content: 'שורשים מצד אמא', x: 5, y: 3, width: 90, height: 8, style: { fontSize: 30, fontWeight: 'extrabold', textAlign: 'right' } },
    ];
    if (maternalGF?.personId) {
        maternalElements.push({ id: uuidv4(), type: 'person_card', personId: maternalGF.personId, x: 5, y: 14, width: 28, height: 28, zIndex: 10 });
    }
    if (maternalGF?.story) {
        maternalElements.push({ id: uuidv4(), type: 'text', content: maternalGF.story, x: 35, y: 14, width: 60, height: 28, style: { fontSize: 11, textAlign: 'right' } });
    }
    if (maternalGM?.personId) {
        maternalElements.push({ id: uuidv4(), type: 'person_card', personId: maternalGM.personId, x: 5, y: 46, width: 28, height: 28, zIndex: 10 });
    }
    if (maternalGM?.story) {
        maternalElements.push({ id: uuidv4(), type: 'text', content: maternalGM.story, x: 35, y: 46, width: 60, height: 28, style: { fontSize: 11, textAlign: 'right' } });
    }
    pages.push({
        id: uuidv4(),
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
      id: uuidv4(),
      pageNumber: pageNumber++,
      pageType: 'heritage',
      title: 'מורשת משפחתית',
      templateId,
      elements: [
        { id: uuidv4(), type: 'text', content: 'מורשת משפחתית', x: 5, y: 3, width: 90, height: 8, style: { fontSize: 30, fontWeight: 'extrabold', textAlign: 'right' } },
        ...(heritage.inheritedObject ? [
          { id: uuidv4(), type: 'text', content: '💎 חפץ עובר בירושה', x: 5, y: 14, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
          { id: uuidv4(), type: 'text', content: heritage.inheritedObject, x: 5, y: 20, width: 90, height: 15, style: { fontSize: 12, textAlign: 'right' } },
        ] as DesignElement[] : []),
        ...(heritage.familyRecipe ? [
          { id: uuidv4(), type: 'text', content: '🍽️ מתכון משפחתי', x: 5, y: 38, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
          { id: uuidv4(), type: 'text', content: heritage.familyRecipe, x: 5, y: 44, width: 90, height: 15, style: { fontSize: 12, textAlign: 'right' } },
        ] as DesignElement[] : []),
        ...(heritage.familyNameOrigin ? [
          { id: uuidv4(), type: 'text', content: 'מקור שם המשפחה', x: 5, y: 62, width: 90, height: 5, style: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' } },
          { id: uuidv4(), type: 'text', content: heritage.familyNameOrigin, x: 5, y: 68, width: 90, height: 15, style: { fontSize: 12, textAlign: 'right' } },
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
  const birthYear = person.birthDate && isValid(parseISO(person.birthDate)) ? new Date(person.birthDate).getFullYear() : null;
  const deathYear = person.deathDate && isValid(parseISO(String(person.deathDate))) ? new Date(String(person.deathDate)).getFullYear() : null;
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
      {birthYear && (
          <p className="text-xs text-center opacity-70" style={{ color: textColor }}>
              {birthYear}{deathYear ? `–${deathYear}` : ''}{age ? ` (גיל ${age})` : ''}
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
  const { user } = useUser();
  const db = useFirestore();

  useEffect(() => {
    const fetchFiles = async () => {
      if (!user || !db) {
          setLoading(false);
          return;
      }
      try {
        const filesQuery = query(
            collection(db, 'exportedFiles'),
            where('userId', '==', user.uid),
        );
        const filesSnapshot = await getDocs(filesQuery);
        const userFiles = filesSnapshot.docs.map(d => d.data() as ExportedFile);

        const imageFiles = userFiles
            .filter(file => file.downloadURL && ['png', 'jpg', 'jpeg'].includes(file.fileType))
            .map(file => ({
                name: file.fileName,
                url: file.downloadURL!,
                type: 'image'
            }));

        setFiles(imageFiles);

      } catch (err) {
        console.error('Could not load files from Firestore:', err);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [user, db, treeId]);

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


export function RootsDesignEditor({ project, people, relationships, onBack, onUpdateProject, history, onHistoryChange }: {
  project: RootsProject;
  people: Person[];
  relationships: Relationship[];
  onBack: () => void;
  onUpdateProject: (updater: (p: RootsProject) => RootsProject) => void;
  history: any;
  onHistoryChange: (history: any) => void;
}) {
  const isGeneratingInitial = !project.projectData?.designData?.pages;

  const [pages, setPages] = useState<DesignPage[]>(project.projectData?.designData?.pages || []);
  const [isGenerating, setIsGenerating] = useState(isGeneratingInitial);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'shape' | 'person' | 'image' | 'icon' | 'line'>('select');
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

  const { toast } = useToast();

  const isDragging = useRef(false);
  const dragElementId = useRef<string | null>(null);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, elX: 0, elY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeHandle = useRef<string | null>(null); // 'se' | 'sw' | 'ne' | 'nw'
  const resizeStart = useRef({ mouseX: 0, mouseY: 0, elX: 0, elY: 0, elW: 0, elH: 0 });
  const pagesRef = useRef<DesignPage[]>(pages);
  const hasGeneratedRef = useRef(false);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const currentPage = pages[currentPageIndex];
  const template = DESIGN_TEMPLATES.find(t => t.id === (currentPage?.templateId || selectedTemplateId)) || DESIGN_TEMPLATES[0];

  useEffect(() => {
    const existingPages = project.projectData?.designData?.pages;
    if (!existingPages || existingPages.length === 0) {
      hasGeneratedRef.current = true;
      const generated = generatePagesFromProject(project, people, relationships, 'template_cosmic');
      setPages(generated);
      setIsGenerating(false);
      onUpdateProject(proj => ({
        ...proj,
        projectData: {
          ...proj.projectData,
          designData: { pages: generated }
        }
      }));
    } else {
      setIsGenerating(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (hasGeneratedRef.current) return;
    setPages(project.projectData?.designData?.pages || []);
  }, [project.projectData?.designData?.pages]);


  const updatePages = (updater: (currentPages: DesignPage[]) => DesignPage[]) => {
    const newPages = updater(pages);
    setPages(newPages);
    onUpdateProject(proj => ({
      ...proj,
      projectData: { ...proj.projectData, designData: { ...proj.projectData?.designData, pages: newPages } }
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

  // Updates local React state only — no Firestore write. Use during drag/resize.
  const updateElementLocal = (id: string, updates: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) => {
    setPages(currentPages => {
      const newPages = [...currentPages];
      if (newPages[currentPageIndex]) {
        newPages[currentPageIndex] = {
          ...newPages[currentPageIndex],
          elements: newPages[currentPageIndex].elements.map(el => {
            if (el.id === id) {
              const finalUpdates = typeof updates === 'function' ? updates(el) : updates;
              return { ...el, ...finalUpdates };
            }
            return el;
          })
        };
      }
      return newPages;
    });
  };

  // Updates local state AND persists to Firestore. Use for deliberate user actions.
  const updateElement = (id: string, updates: Partial<DesignElement> | ((el: DesignElement) => Partial<DesignElement>)) => {
    updatePages(currentPages => {
      const newPages = [...currentPages];
      if (newPages[currentPageIndex]) {
        newPages[currentPageIndex] = {
          ...newPages[currentPageIndex],
          elements: newPages[currentPageIndex].elements.map(el => {
            if (el.id === id) {
              const finalUpdates = typeof updates === 'function' ? updates(el) : updates;
              return { ...el, ...finalUpdates };
            }
            return el;
          })
        };
      }
      return newPages;
    });
  };

  const deleteElement = (id: string) => {
    updateCurrentPage(page => ({
      ...page,
      elements: page.elements.filter(el => el.id !== id)
    }));
    setSelectedElementId(null);
  };
  
  const duplicateElement = (id: string) => {
    const el = currentPage?.elements.find(e => e.id === id);
    if (!el) return;
    const { id: _id, ...rest } = el;
    addElement({ ...rest, x: Math.min(el.x + 3, 70), y: Math.min(el.y + 3, 70) });
  };

  const addPage = () => {
    const newPage: DesignPage = {
      id: uuidv4(),
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
    } else if (activeTool === 'shape') {
      addElement({
        type: 'shape',
        x: (e.nativeEvent.offsetX / target.offsetWidth) * 100 - 10,
        y: (e.nativeEvent.offsetY / target.offsetHeight) * 100 - 10,
        width: 20,
        height: 20,
        style: {
          shapeType: activeShapeType,
          backgroundColor: template.primaryColor,
          opacity: 0.8,
        }
      });
      setActiveTool('select');
    } else {
        setSelectedElementId(null);
        setEditingElementId(null);
    }
  }

  const handleMouseDown = (e: React.MouseEvent, el: DesignElement) => {
    if (editingElementId) return;
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

  const handleResizeMouseDown = (e: React.MouseEvent, el: DesignElement, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    isResizing.current = true;
    resizeHandle.current = handle;
    resizeStart.current = { mouseX: e.clientX, mouseY: e.clientY, elX: el.x, elY: el.y, elW: el.width, elH: el.height };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isResizing.current && resizeHandle.current && selectedElementId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((e.clientX - resizeStart.current.mouseX) / rect.width) * 100;
      const dy = ((e.clientY - resizeStart.current.mouseY) / rect.height) * 100;
      const h = resizeHandle.current;
      updateElementLocal(selectedElementId, (el) => {
        let { elX: nx, elY: ny, elW: nw, elH: nh } = resizeStart.current;
        if (h.includes('e')) nw = Math.max(5, resizeStart.current.elW + dx);
        if (h.includes('s')) nh = Math.max(3, resizeStart.current.elH + dy);
        if (h.includes('w')) { nw = Math.max(5, resizeStart.current.elW - dx); nx = resizeStart.current.elX + dx; }
        if (h.includes('n')) { nh = Math.max(3, resizeStart.current.elH - dy); ny = resizeStart.current.elY + dy; }
        return { x: Math.max(0, nx), y: Math.max(0, ny), width: Math.min(nw, 100 - Math.max(0, nx)), height: Math.min(nh, 100 - Math.max(0, ny)) };
      });
      return;
    }
    if (!isDragging.current || !dragElementId.current || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.current.mouseX) / canvasRect.width) * 100;
    const dy = ((e.clientY - dragStart.current.mouseY) / canvasRect.height) * 100;

    updateElementLocal(dragElementId.current, (el) => {
        const newX = Math.max(0, Math.min(100 - el.width, dragStart.current.elX + dx));
        const newY = Math.max(0, Math.min(100 - el.height, dragStart.current.elY + dy));
        return { x: newX, y: newY };
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    dragElementId.current = null;
    isResizing.current = false;
    resizeHandle.current = null;
    onUpdateProject(proj => ({
      ...proj,
      projectData: {
        ...proj.projectData,
        designData: { ...proj.projectData?.designData, pages: pagesRef.current }
      }
    }));
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
                        <DropdownMenuRadioGroup value={canvasAspectRatio} onValueChange={(value) => setCanvasAspectRatio(value as CanvasAspectRatio)}>
                            <DropdownMenuRadioItem value="a4-landscape">A4 לרוחב (ברירת מחדל)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="a4-portrait">A4 לגובה</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="16:9-landscape">16:9 לרוחב (מצגת)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="9/16">9:16 לגובה (סטורי)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="1:1">1:1 ריבוע</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="free">חופשי</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className='flex items-center gap-2'>
                <Button variant="outline" size="sm" className="bg-transparent border-white/20 text-xs" onClick={() => setShowTemplatePicker(true)}>
                  🎨 תבנית
                </Button>
                <Separator orientation="vertical" className='h-6 bg-white/10'/>
                <TooltipProvider>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'select' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('select')}><MousePointer2 /></Button></TooltipTrigger><TooltipContent><p>בחר</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'text' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('text')}><Pilcrow /></Button></TooltipTrigger><TooltipContent><p>טקסט</p></TooltipContent></Tooltip>
                    <DropdownMenu>
                        <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                            <Button variant={activeTool === 'shape' ? 'secondary' : 'ghost'} size="icon">
                                <Square />
                            </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent><p>צורה</p></TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => { setActiveShapeType('rectangle'); setActiveTool('shape'); }}>▭ מלבן</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActiveShapeType('rounded_rectangle'); setActiveTool('shape'); }}>▢ מלבן מעוגל</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActiveShapeType('circle'); setActiveTool('shape'); }}>● עיגול</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActiveShapeType('star'); setActiveTool('shape'); }}>★ כוכב</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setActiveShapeType('diamond'); setActiveTool('shape'); }}>◆ יהלום</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'person' ? 'secondary' : 'ghost'} size="icon" onClick={() => {setActiveTool('person'); setShowPersonPicker(true);}}><User /></Button></TooltipTrigger><TooltipContent><p>כרטיס אדם</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'image' ? 'secondary' : 'ghost'} size="icon" onClick={() => { setActiveTool('image'); setShowImagePicker(true); }}><ImageIcon /></Button></TooltipTrigger><TooltipContent><p>הוסף תמונה</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'icon' ? 'secondary' : 'ghost'} size="icon" onClick={() => { setActiveTool('icon'); setShowEmojiPicker(true); }}><Smile /></Button></TooltipTrigger><TooltipContent><p>אימוג׳י</p></TooltipContent></Tooltip>
                </TooltipProvider>
            </div>
            <div className='flex items-center gap-2'>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => toast({ title: 'ביטול פעולה יהיה זמין בקרוב!' })} disabled={true}><Undo /></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>בטל</p></TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => toast({ title: 'ביטול פעולה יהיה זמין בקרוב!' })} disabled={true}><Redo /></Button>
                    </TooltipTrigger>
                    <TooltipContent><p>בצע שוב</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
             <aside className="w-32 flex-shrink-0 border-r border-white/10 p-2 flex flex-col gap-2">
              <div className='flex-1 overflow-y-auto space-y-2'>
                {pages.map((page, index) => {
                  const pageTemplate = DESIGN_TEMPLATES.find(t => t.id === page.templateId);
                  const aspectClass = {
                    'a4-landscape': 'aspect-[1.414/1]',
                    'a4-portrait': 'aspect-[1/1.414]',
                    '16:9-landscape': 'aspect-video',
                    '9/16': 'aspect-[9/16]',
                    '1:1': 'aspect-square',
                    'free': 'aspect-[1.414/1]',
                  }[canvasAspectRatio] || 'aspect-[1.414/1]';
                  return (
                    <div
                      key={page.id}
                      title={`${page.pageNumber}. ${page.title}`}
                      onClick={() => setCurrentPageIndex(index)}
                      className={cn(
                        "w-full rounded-md p-1 cursor-pointer border-2 group relative",
                        currentPageIndex === index ? "border-indigo-500" : "border-transparent hover:border-white/20",
                        aspectClass
                      )}
                    >
                      <div
                        className='relative w-full h-full overflow-hidden rounded-sm'
                        style={{
                            backgroundImage: (page as any).backgroundImage
                              ? `url(${(page as any).backgroundImage})`
                              : (page.backgroundColor 
                                  ? undefined 
                                  : DESIGN_TEMPLATES.find(t => t.id === page.templateId)?.backgroundGradient || 'linear-gradient(135deg, #0a0015, #000d1a)'),
                            backgroundColor: page.backgroundColor || undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                      >
                        {page.elements.filter(el => el.type === 'text').slice(0, 2).map((el, i) => (
                          <div key={`thumb-${index}-text-${el.id}`} className="absolute overflow-hidden px-0.5"
                            style={{
                              top: `${el.y}%`, left: `${el.x}%`,
                              width: `${el.width}%`,
                              fontSize: '3px',
                              color: pageTemplate?.textColor || '#fff',
                              fontWeight: el.style?.fontWeight === 'extrabold' ? 800 : el.style?.fontWeight === 'bold' ? 700 : 400,
                              lineHeight: 1.2,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {el.content?.slice(0, 20)}
                          </div>
                        ))}
                        {page.elements.filter(el => el.type === 'person_card' || el.type === 'image' || el.type === 'shape').map((el) => (
                            <div key={`thumb-${index}-el-${el.id}`} className="absolute rounded-sm"
                              style={{
                                top: `${el.y}%`, left: `${el.x}%`,
                                width: `${el.width}%`, height: `${el.height}%`,
                                backgroundColor: el.type === 'person_card'
                                  ? (el.style?.backgroundColor || (pageTemplate?.cardBackground || 'rgba(255,255,255,0.15)'))
                                  : el.type === 'shape'
                                  ? (el.style?.backgroundColor || pageTemplate?.primaryColor || '#6366f1')
                                  : 'rgba(255,255,255,0.2)',
                                backgroundImage: el.type === 'image' && el.content ? `url(${el.content})` : undefined,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                opacity: el.style?.opacity ?? 0.8,
                                border: `0.5px solid ${pageTemplate?.primaryColor || 'rgba(255,255,255,0.2)'}`,
                              }}
                            />
                        ))}
                        <span className='absolute bottom-0.5 left-0.5 font-bold text-white/60' style={{ fontSize: '5px' }}>
                          {page.pageNumber}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (pages.length <= 1) { toast({ title: 'לא ניתן למחוק את העמוד האחרון' }); return; }
                          if (window.confirm(`למחוק את "${page.title}"?`)) {
                            updatePages(ps => {
                              const newPages = ps.filter((_, i) => i !== index).map((p, i) => ({...p, pageNumber: i + 1}));
                              return newPages;
                            });
                            setCurrentPageIndex(prev => Math.min(prev, pages.length - 2));
                            setSelectedElementId(null);
                          }
                        }}
                        className="absolute top-0.5 left-0.5 w-4 h-4 bg-red-500/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
                        style={{ fontSize: '8px', lineHeight: 1 }}
                      >✕</button>
                    </div>
                  );
                })}
              </div>
              <div className='border-t border-white/10 pt-2 mt-1'>
                <p className='text-xs text-slate-400 text-center mb-1'>שם עמוד</p>
                <input
                  className='w-full text-xs bg-slate-700 border border-white/10 rounded px-2 py-1 text-center text-white focus:outline-none focus:border-indigo-400'
                  value={currentPage?.title || ''}
                  onChange={(e) => updateCurrentPage(p => ({ ...p, title: e.target.value }))}
                  dir="rtl"
                />
              </div>
              <Button size="sm" variant="outline" className='bg-transparent w-full mt-2' onClick={addPage}>
                + הוסף עמוד
              </Button>
            </aside>
            <main className="flex-1 flex items-center justify-center p-8 bg-black/20 overflow-hidden relative" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                <div
                    className={cn(
                        "relative overflow-hidden",
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
                    <div id="canvas-container" ref={canvasRef} className="w-full h-full relative overflow-hidden"
                        style={{
                            backgroundImage: (currentPage as any).backgroundImage
                              ? `url(${(currentPage as any).backgroundImage})`
                              : (currentPage?.backgroundGradient || template.backgroundGradient),
                            backgroundColor: currentPage?.backgroundColor || undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                        onClick={handleCanvasClick}
                    >
                         <TemplateDecorations template={template} />
                         <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
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
                                  key={`svg-line-${currentPageIndex}-${lineIndex}-${el.id}`}
                                  x1={`${x1}%`} y1={`${y1}%`}
                                  x2={`${x2}%`} y2={`${y2}%`}
                                  stroke={selectedElementId === el.id ? '#60a5fa' : (el.style?.color || template.primaryColor)}
                                  strokeWidth={selectedElementId === el.id ? (el.style?.borderWidth || 2) + 1 : (el.style?.borderWidth || 2)}
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
                             key={`el-${currentPageIndex}-${elIndex}-${el.id}`}
                             className={cn('absolute border-2', selectedElementId === el.id ? 'border-dashed border-blue-500' : 'border-transparent', activeTool === 'select' && 'cursor-grab', isDragging.current && dragElementId.current === el.id && 'cursor-grabbing')}
                             style={{
                                 left: `${el.x}%`,
                                 top: `${el.y}%`,
                                 width: `${el.width}%`,
                                 height: `${el.height}%`,
                                 zIndex: el.zIndex,
                             }}
                             onMouseDown={(e) => handleMouseDown(e, el)}
                           >
                              {selectedElementId === el.id && activeTool === 'select' && (
                                <>
                                  {(['nw','ne','sw','se','n','s','e','w'] as const).map(handle => (
                                    <div
                                      key={handle}
                                      onMouseDown={(ev) => handleResizeMouseDown(ev, el, handle)}
                                      className="absolute bg-white border-2 border-blue-500 rounded-sm z-50"
                                      style={{
                                        width: handle.length === 1 ? '10px' : '10px',
                                        height: handle.length === 1 ? '10px' : '10px',
                                        top: handle.includes('n') ? '-5px' : handle === 's' || handle === 'e' || handle === 'w' ? 'calc(50% - 5px)' : undefined,
                                        bottom: handle.includes('s') && handle.length > 1 ? '-5px' : undefined,
                                        left: handle.includes('w') ? '-5px' : handle === 'n' || handle === 's' || handle === 'e' ? 'calc(50% - 5px)' : undefined,
                                        right: handle.includes('e') && handle.length > 1 ? '-5px' : undefined,
                                        cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : handle === 'ne' || handle === 'sw' ? 'nesw-resize' : handle === 'n' || handle === 's' ? 'ns-resize' : 'ew-resize',
                                      }}
                                    />
                                  ))}
                                </>
                              )}
                               {el.type === 'text' && (
                                editingElementId === el.id ? (
                                <textarea
                                    autoFocus
                                    className="w-full h-full bg-transparent resize-none outline-none border-none p-1"
                                    style={{
                                        color: el.style?.color || template.textColor,
                                        fontSize: el.style?.fontSize,
                                        fontWeight: el.style?.fontWeight,
                                        textAlign: el.style?.textAlign || 'right',
                                        direction: 'rtl',
                                    }}
                                    value={el.content || ''}
                                    onChange={(e) => updateElement(el.id, { content: e.target.value })}
                                    onBlur={() => setEditingElementId(null)}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                />
                                ) : (
                                <div
                                    className="w-full h-full p-1 overflow-hidden"
                                    style={{
                                    color: el.style?.color || template.textColor,
                                    fontSize: el.style?.fontSize,
                                    fontWeight: el.style?.fontWeight === 'extrabold' ? 800 : el.style?.fontWeight === 'bold' ? 700 : 400,
                                    textAlign: el.style?.textAlign || 'right',
                                    direction: 'rtl',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: el.style?.lineHeight || 1.4,
                                    }}
                                    onDoubleClick={(e) => { e.stopPropagation(); setEditingElementId(el.id); }}
                                >
                                    {el.content}
                                </div>
                                )
                            )}
                               {el.type === 'person_card' && <PersonCardElement element={el} people={people} relationships={relationships} />}
                               {el.type === 'image' && el.content && (
                                <img src={el.content} alt="" className="w-full h-full object-cover"
                                    style={{
                                    opacity: el.style?.opacity,
                                    borderRadius: el.style?.borderRadius ? `${el.style.borderRadius}px` : '4px'
                                    }}
                                />
                               )}
                               {el.type === 'shape' && (
                                <div
                                className="w-full h-full"
                                style={{
                                    backgroundColor: el.style?.backgroundColor || template.primaryColor,
                                    borderRadius: el.style?.shapeType === 'circle' ? '50%' :
                                                    el.style?.shapeType === 'rounded_rectangle' ? '12px' :
                                                    el.style?.shapeType === 'diamond' ? '0' : el.style?.borderRadius || 0,
                                    transform: el.style?.shapeType === 'diamond' ? 'rotate(45deg)' : undefined,
                                    clipPath: el.style?.shapeType === 'star'
                                    ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
                                    : undefined,
                                    border: el.style?.borderColor ? `${el.style.borderWidth || 2}px solid ${el.style.borderColor}` : undefined,
                                    opacity: el.style?.opacity,
                                }}
                                />
                            )}
                            {el.type === 'icon' && (
                                <div className="w-full h-full flex items-center justify-center"
                                style={{ fontSize: el.style?.fontSize || 32 }}>
                                {el.content}
                                </div>
                            )}
                           </div>
                        ))}
                    </div>
                </div>
                 {showPersonPicker && (
                    <div className="absolute right-0 top-0 h-full w-64 bg-slate-800 border-l border-white/10 z-40 flex flex-col shadow-2xl">
                        <div className="p-3 border-b border-white/10 flex items-center justify-between">
                            <button onClick={() => { setShowPersonPicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white">✕</button>
                            <h3 className="font-bold text-sm">הוסף כרטיס אדם</h3>
                        </div>
                        <input
                            className="m-2 px-3 py-1.5 bg-slate-700 rounded-lg text-sm text-right placeholder:text-slate-500 border border-white/10 focus:outline-none"
                            placeholder="חפש שם..."
                            value={personSearch}
                            onChange={e => setPersonSearch(e.target.value)}
                        />
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {people
                            .filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(personSearch.toLowerCase()))
                            .map(person => (
                                <button
                                key={person.id}
                                onClick={() => {
                                    addElement({
                                    type: 'person_card',
                                    personId: person.id,
                                    x: 20, y: 20, width: 30, height: 28,
                                    zIndex: 10
                                    });
                                    setShowPersonPicker(false);
                                    setActiveTool('select');
                                }}
                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 text-right"
                                >
                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                                    <img src={person.photoURL || getPlaceholderImage(person.gender)} alt="" className="w-full h-full object-cover" />
                                </div>
                                <div className="text-right flex-1 min-w-0">
                                    <p className="text-xs font-bold truncate">{person.firstName} {person.lastName}</p>
                                    {person.birthDate && <p className="text-xs text-slate-400">{new Date(person.birthDate).getFullYear()}</p>}
                                </div>
                                </button>
                            ))
                            }
                        </div>
                    </div>
                )}
                 {showImagePicker && (
                    <div className="absolute right-0 top-0 h-full w-72 bg-slate-800 border-l border-white/10 z-40 flex flex-col shadow-2xl">
                        <div className="p-3 border-b border-white/10 flex items-center justify-between">
                        <button onClick={() => { setShowImagePicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white">✕</button>
                        <h3 className="font-bold text-sm">הוסף תמונה</h3>
                        </div>

                        {/* Upload from device */}
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

                        {/* My Files section */}
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
                 {showEmojiPicker && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => { setShowEmojiPicker(false); setActiveTool('select'); }}>
                        <div className="bg-slate-800 rounded-2xl p-4 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <button onClick={() => { setShowEmojiPicker(false); setActiveTool('select'); }} className="text-slate-400 hover:text-white">✕</button>
                            <h3 className="font-bold text-sm">הוסף אמוג׳י</h3>
                        </div>
                        <input
                            className="w-full px-3 py-1.5 bg-slate-700 rounded-lg text-sm text-center placeholder:text-slate-500 border border-white/10 focus:outline-none mb-3"
                            placeholder="הקלד אמוג׳י..."
                            value={emojiInput}
                            onChange={e => setEmojiInput(e.target.value)}
                        />
                        <div className="grid grid-cols-8 gap-1">
                            {['❤️','⭐','🌟','✨','🔥','💫','🎯','🌈','🌺','🌸','🍀','🌿','🕊️','🦋','🌙','☀️','🏡','👨‍👩‍👧‍👦','👨‍👩‍👦','👪','🤝','💝','🎗️','📖','✡️','🕍','🇮🇱','🗺️','📍','📜','🏺','💎','🎵','🌍','🕰️','🌾'].map(emoji => (
                            <button key={emoji} className="text-xl p-1 hover:bg-white/10 rounded-lg transition-colors"
                                onClick={() => {
                                addElement({ type: 'icon', content: emojiInput || emoji, x: 40, y: 40, width: 10, height: 10, style: { fontSize: 32, textAlign: 'center' }, zIndex: 15 });
                                setShowEmojiPicker(false); setActiveTool('select');
                                }}>{emoji}</button>
                            ))}
                        </div>
                        {emojiInput && (
                            <button className="w-full mt-2 p-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm font-bold"
                            onClick={() => {
                                addElement({ type: 'icon', content: emojiInput, x: 40, y: 40, width: 10, height: 10, style: { fontSize: 32, textAlign: 'center' }, zIndex: 15 });
                                setShowEmojiPicker(false); setActiveTool('select');
                            }}>הוסף: {emojiInput}</button>
                        )}
                        </div>
                    </div>
                )}
            </main>
        </div>
        <div className="h-auto border-t border-white/10 bg-slate-800/80 backdrop-blur flex-shrink-0 px-4 py-2 flex items-center gap-4 overflow-x-auto" style={{ minHeight: '56px', maxHeight: '120px' }}>
            {/* Context label */}
            <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
            {selectedElement ? (
                selectedElement.type === 'text' ? '✏️ טקסט' :
                selectedElement.type === 'person_card' ? '👤 כרטיס אדם' :
                selectedElement.type === 'shape' ? '◼ צורה' :
                selectedElement.type === 'image' ? '🖼 תמונה' :
                selectedElement.type === 'icon' ? '😊 אמוג׳י' :
                selectedElement.type === 'connection_line' ? '↔ קו' : ''
            ) : '📄 עמוד'}
            </span>
            <div className="w-px h-8 bg-white/10 flex-shrink-0" />

            {/* PAGE controls — shown when nothing selected */}
            {!selectedElement && currentPage && (<>
            <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs text-slate-400 whitespace-nowrap">צבע רקע</label>
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                value={currentPage.backgroundColor || template.backgroundColor}
                onChange={(e) => updateCurrentPage(p => ({...p, backgroundColor: e.target.value}))} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs text-slate-400 whitespace-nowrap">תמונת רקע</label>
                <label className="cursor-pointer flex items-center gap-1 px-2 py-1 border border-dashed border-white/20 rounded text-xs text-slate-400 hover:border-indigo-400">
                <ImageIcon className="w-3 h-3" />
                <span>בחר</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => updateCurrentPage(p => ({...p, backgroundImage: ev.target?.result as string}));
                    reader.readAsDataURL(file);
                }} />
                </label>
                {(currentPage as any).backgroundImage && (
                <button className="text-xs text-red-400 hover:text-red-300"
                    onClick={() => updateCurrentPage(p => ({...p, backgroundImage: undefined}))}>✕ הסר</button>
                )}
            </div>
            </>)}

            {/* TEXT controls */}
            {selectedElement?.type === 'text' && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
                <label className="text-xs text-slate-400">גודל</label>
                <input type="number" min={8} max={96}
                className="w-14 text-xs bg-slate-700 border border-white/10 rounded px-1 py-1 text-center text-white focus:outline-none"
                value={selectedElement.style?.fontSize || 16}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, fontSize: Number(e.target.value) }})} />
            </div>
            <div className="flex gap-1 flex-shrink-0">
                {(['normal','bold','extrabold'] as const).map(w => (
                <button key={w}
                    onClick={() => updateElement(selectedElementId!, { style: { ...selectedElement.style, fontWeight: w }})}
                    className={cn('text-xs px-2 py-1 rounded border', selectedElement.style?.fontWeight === w ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}
                >{w === 'normal' ? 'R' : w === 'bold' ? 'B' : 'BB'}</button>
                ))}
            </div>
            <div className="flex gap-1 flex-shrink-0">
                {([['right','→'],['center','↔'],['left','←']] as const).map(([a,l]) => (
                <button key={a}
                    onClick={() => updateElement(selectedElementId!, { style: { ...selectedElement.style, textAlign: a as TextAlign }})}
                    className={cn('text-xs px-2 py-1 rounded border', selectedElement.style?.textAlign === a ? 'bg-indigo-500 border-indigo-400' : 'bg-slate-700 border-slate-600 hover:border-slate-400')}
                >{l}</button>
                ))}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <label className="text-xs text-slate-400">צבע</label>
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                value={selectedElement.style?.color || '#ffffff'}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, color: e.target.value }})} />
                <div className="flex gap-1">
                {['#ffffff','#000000','#6366f1','#14b8a6','#f59e0b','#ef4444'].map(c => (
                    <button key={c} className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform flex-shrink-0"
                    style={{ backgroundColor: c }}
                    onClick={() => updateElement(selectedElementId!, { style: { ...selectedElement.style, color: c }})} />
                ))}
                </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <label className="text-xs text-slate-400">רקע</label>
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                value={selectedElement.style?.backgroundColor || '#000000'}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, backgroundColor: e.target.value }})} />
                <button className="text-xs text-slate-500 hover:text-red-400"
                onClick={() => updateElement(selectedElementId!, { style: { ...selectedElement.style, backgroundColor: undefined }})}>✕</button>
            </div>
            </>)}

            {/* PERSON CARD controls */}
            {selectedElement?.type === 'person_card' && (<>
            <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs text-slate-400 whitespace-nowrap">שקיפות: {Math.round((selectedElement.style?.opacity ?? 1) * 100)}%</label>
                <input type="range" min={0} max={1} step={0.05}
                className="w-24"
                value={selectedElement.style?.opacity ?? 1}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) }})} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <label className="text-xs text-slate-400">רקע</label>
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                value={selectedElement.style?.backgroundColor || '#1e293b'}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, backgroundColor: e.target.value }})} />
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <label className="text-xs text-slate-400">טקסט</label>
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                value={selectedElement.style?.color || '#ffffff'}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, color: e.target.value }})} />
            </div>
            </>)}

            {/* SHAPE controls */}
            {selectedElement?.type === 'shape' && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
                <label className="text-xs text-slate-400">צבע</label>
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                value={selectedElement.style?.backgroundColor || template.primaryColor}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, backgroundColor: e.target.value }})} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs text-slate-400 whitespace-nowrap">שקיפות: {Math.round((selectedElement.style?.opacity ?? 1) * 100)}%</label>
                <input type="range" min={0} max={1} step={0.05} className="w-24"
                value={selectedElement.style?.opacity ?? 1}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) }})} />
            </div>
            </>)}

            {/* IMAGE controls */}
            {selectedElement?.type === 'image' && (<>
            <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs text-slate-400 whitespace-nowrap">שקיפות: {Math.round((selectedElement.style?.opacity ?? 1) * 100)}%</label>
                <input type="range" min={0} max={1} step={0.05} className="w-24"
                value={selectedElement.style?.opacity ?? 1}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, opacity: Number(e.target.value) }})} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs text-slate-400 whitespace-nowrap">פינות: {selectedElement.style?.borderRadius ?? 0}px</label>
                <input type="range" min={0} max={50} step={1} className="w-24"
                value={selectedElement.style?.borderRadius ?? 0}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, borderRadius: Number(e.target.value) }})} />
            </div>
            <label className="cursor-pointer flex items-center gap-1 px-2 py-1 border border-dashed border-white/20 rounded text-xs text-slate-400 hover:border-indigo-400 flex-shrink-0">
                <ImageIcon className="w-3 h-3" /><span>החלף</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => updateElement(selectedElementId!, { content: ev.target?.result as string });
                reader.readAsDataURL(file);
                }} />
            </label>
            </>)}

            {/* CONNECTION LINE controls */}
            {selectedElement?.type === 'connection_line' && (<>
            <div className="flex items-center gap-1 flex-shrink-0">
                <label className="text-xs text-slate-400">צבע קו</label>
                <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                value={selectedElement.style?.color || template.primaryColor}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, color: e.target.value }})} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <label className="text-xs text-slate-400 whitespace-nowrap">עובי: {selectedElement.style?.borderWidth || 2}px</label>
                <input type="range" min={1} max={8} step={1} className="w-24"
                value={selectedElement.style?.borderWidth || 2}
                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, borderWidth: Number(e.target.value) }})} />
            </div>
            </>)}

            {/* SHARED controls — z-index and duplicate/delete — shown for any non-page selection */}
            {selectedElement && selectedElement.type !== 'connection_line' && (<>
            <div className="w-px h-8 bg-white/10 flex-shrink-0" />
            <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => updateElement(selectedElementId!, el => ({ zIndex: (el.zIndex || 0) + 1 }))}
                className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 whitespace-nowrap">↑ קדימה</button>
                <button onClick={() => updateElement(selectedElementId!, el => ({ zIndex: Math.max(0, (el.zIndex || 0) - 1) }))}
                className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 whitespace-nowrap">↓ אחורה</button>
            </div>
            <button onClick={() => duplicateElement(selectedElementId!)}
                className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400 whitespace-nowrap flex-shrink-0">שכפל</button>
            </>)}
            {selectedElement && (<>
            <div className="w-px h-8 bg-white/10 flex-shrink-0" />
            <button onClick={() => deleteElement(selectedElementId!)}
                className="text-xs px-2 py-1 rounded bg-red-500/20 border border-red-500/40 hover:bg-red-500/40 text-red-300 whitespace-nowrap flex-shrink-0">🗑 מחק</button>
            </>)}

            {/* ALIGNMENT controls — shown when multi-select (future) or always visible */}
            {selectedElement && selectedElement.type !== 'connection_line' && (<>
            <div className="w-px h-8 bg-white/10 flex-shrink-0" />
            <div className="flex gap-1 flex-shrink-0">
                <button title="יישור לשמאל" onClick={() => updateElement(selectedElementId!, { x: 0 })} className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400">⊣</button>
                <button title="מרכז אופקי" onClick={() => updateElement(selectedElementId!, el => ({ x: 50 - el.width / 2 }))} className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400">⊕H</button>
                <button title="יישור לימין" onClick={() => updateElement(selectedElementId!, el => ({ x: 100 - el.width }))} className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400">⊢</button>
                <button title="יישור לעליון" onClick={() => updateElement(selectedElementId!, { y: 0 })} className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400">⊤</button>
                <button title="מרכז אנכי" onClick={() => updateElement(selectedElementId!, el => ({ y: 50 - el.height / 2 }))} className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400">⊕V</button>
                <button title="יישור לתחתון" onClick={() => updateElement(selectedElementId!, el => ({ y: 100 - el.height }))} className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 hover:border-slate-400">⊥</button>
            </div>
            </>)}
        </div>
        {showTemplatePicker && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={() => setShowTemplatePicker(false)}>
            <div className="bg-slate-800 rounded-2xl p-6 w-[600px] max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-right mb-4">בחר תבנית עיצוב</h2>
              <div className='flex items-center gap-2 mb-4 justify-end'>
                <label className='text-sm text-slate-300'>החל על כל העמודים</label>
                <button
                  onClick={() => setApplyTemplateToAll(!applyTemplateToAll)}
                  className={cn('w-10 h-5 rounded-full transition-colors relative', applyTemplateToAll ? 'bg-indigo-500' : 'bg-slate-600')}
                >
                  <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', applyTemplateToAll ? 'right-0.5' : 'left-0.5')} />
                </button>
              </div>
              <div className="grid grid-cols-5 gap-3">
                {DESIGN_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => {
                        setSelectedTemplateId(t.id);
                        if (applyTemplateToAll) {
                          updatePages(p => p.map(pg => ({...pg, templateId: t.id})));
                        } else {
                          updateCurrentPage(p => ({...p, templateId: t.id}));
                        }
                        setShowTemplatePicker(false);
                      }}
                        className={cn("rounded-xl overflow-hidden border-2 transition-all text-left", selectedTemplateId === t.id ? "border-indigo-400 scale-105" : "border-transparent hover:border-white/30")}
                    >
                        {/* Mini page preview */}
                        <div className="h-24 w-full relative overflow-hidden" style={{ background: t.backgroundGradient }}>
                        {/* Simulated title */}
                        <div className="absolute top-2 left-0 right-0 flex justify-center">
                            <div className="h-2 rounded-full w-16"
                            style={{ background: t.titleStyle === 'gradient' ? `linear-gradient(90deg, ${t.primaryColor}, ${t.accentColor})` : t.primaryColor }}
                            />
                        </div>
                        {/* Simulated text lines */}
                        <div className="absolute top-6 left-2 right-2 space-y-1">
                            <div className="h-1.5 rounded-full opacity-50" style={{ backgroundColor: t.textColor, width: '80%' }} />
                            <div className="h-1.5 rounded-full opacity-30" style={{ backgroundColor: t.textColor, width: '60%' }} />
                            <div className="h-1.5 rounded-full opacity-20" style={{ backgroundColor: t.textColor, width: '70%' }} />
                        </div>
                        {/* Simulated person card */}
                        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-lg"
                            style={{
                            backgroundColor: t.cardStyle === 'glass' ? 'rgba(255,255,255,0.1)' :
                                                t.cardStyle === 'solid' ? t.cardBackground :
                                                'transparent',
                            border: t.cardStyle === 'outline' ? `1px solid ${t.primaryColor}` : '1px solid rgba(255,255,255,0.15)'
                            }}
                        />
                        {/* Corner decoration if applicable */}
                        {t.decorativePattern === 'corners' && (
                            <>
                            <div className="absolute top-1 right-1 w-3 h-3 border-t border-r opacity-50" style={{ borderColor: t.primaryColor }} />
                            <div className="absolute bottom-1 left-1 w-3 h-3 border-b border-l opacity-50" style={{ borderColor: t.primaryColor }} />
                            </>
                        )}
                        {t.decorativePattern === 'border' && (
                            <div className="absolute inset-1 border opacity-20 rounded-sm" style={{ borderColor: t.primaryColor }} />
                        )}
                        {t.decorativePattern === 'dots' && (
                            <div className="absolute inset-0 opacity-10" style={{
                            backgroundImage: `radial-gradient(circle, ${t.primaryColor} 1px, transparent 1px)`,
                            backgroundSize: '8px 8px'
                            }} />
                        )}
                        </div>
                        <div className="p-1 text-center" style={{ backgroundColor: t.backgroundColor }}>
                        <p className="text-xs font-bold truncate" style={{ color: t.textColor }}>{t.nameHebrew}</p>
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
