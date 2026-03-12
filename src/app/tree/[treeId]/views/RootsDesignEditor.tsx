'use client';
import { useState, useRef, useCallback, useEffect, useMemo, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootsProject, Person, Relationship } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    ArrowLeft, ChevronDown, Circle, Diamond, GitMerge, Image as ImageIcon, MessageSquare, MousePointer2, Pilcrow, Plus, Redo, RotateCcw, Smile, Square, Star, Trash2, Undo, User,
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
}

// ============================================================
// TEMPLATES & GENERATOR
// ============================================================

export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    id: 'template_cosmic',
    name: 'Cosmic',
    nameHebrew: 'קוסמי',
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    accentColor: '#14b8a6',
    backgroundColor: '#0a0015',
    cardBackground: 'rgba(255,255,255,0.05)',
    textColor: '#f8fafc',
    mutedTextColor: '#94a3b8',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'cosmic',
    backgroundGradient: 'linear-gradient(135deg, #0a0015 0%, #000d1a 100%)',
  },
  {
    id: 'template_desert',
    name: 'Desert Sand',
    nameHebrew: 'חול המדבר',
    primaryColor: '#d97706',
    secondaryColor: '#b45309',
    accentColor: '#f59e0b',
    backgroundColor: '#1c1008',
    cardBackground: 'rgba(251,191,36,0.08)',
    textColor: '#fef3c7',
    mutedTextColor: '#d97706',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #1c1008 0%, #2d1b00 100%)',
  },
  {
    id: 'template_forest',
    name: 'Forest',
    nameHebrew: 'יער',
    primaryColor: '#16a34a',
    secondaryColor: '#15803d',
    accentColor: '#4ade80',
    backgroundColor: '#0a1f0a',
    cardBackground: 'rgba(74,222,128,0.07)',
    textColor: '#f0fdf4',
    mutedTextColor: '#86efac',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #0a1f0a 0%, #052e16 100%)',
  },
  {
    id: 'template_ocean',
    name: 'Ocean',
    nameHebrew: 'ים',
    primaryColor: '#0284c7',
    secondaryColor: '#0369a1',
    accentColor: '#38bdf8',
    backgroundColor: '#0a1628',
    cardBackground: 'rgba(56,189,248,0.07)',
    textColor: '#f0f9ff',
    mutedTextColor: '#7dd3fc',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #0a1628 0%, #001e3c 100%)',
  },
  {
    id: 'template_rose',
    name: 'Rose Gold',
    nameHebrew: 'זהב ורוד',
    primaryColor: '#e11d48',
    secondaryColor: '#be185d',
    accentColor: '#fb7185',
    backgroundColor: '#1a0a0f',
    cardBackground: 'rgba(251,113,133,0.07)',
    textColor: '#fff1f2',
    mutedTextColor: '#fda4af',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #1a0a0f 0%, #2d0a1a 100%)',
  },
  {
    id: 'template_parchment',
    name: 'Parchment',
    nameHebrew: 'קלף עתיק',
    primaryColor: '#92400e',
    secondaryColor: '#78350f',
    accentColor: '#d97706',
    backgroundColor: '#fef3c7',
    cardBackground: 'rgba(146,64,14,0.08)',
    textColor: '#1c1917',
    mutedTextColor: '#78350f',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'paper',
    backgroundGradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
  },
  {
    id: 'template_midnight',
    name: 'Midnight Blue',
    nameHebrew: 'חצות כחול',
    primaryColor: '#4f46e5',
    secondaryColor: '#3730a3',
    accentColor: '#818cf8',
    backgroundColor: '#030712',
    cardBackground: 'rgba(79,70,229,0.1)',
    textColor: '#eef2ff',
    mutedTextColor: '#a5b4fc',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'cosmic',
    backgroundGradient: 'linear-gradient(135deg, #030712 0%, #0f0a2e 100%)',
  },
  {
    id: 'template_spring',
    name: 'Spring',
    nameHebrew: 'אביב',
    primaryColor: '#0891b2',
    secondaryColor: '#0e7490',
    accentColor: '#67e8f9',
    backgroundColor: '#f0fdff',
    cardBackground: 'rgba(8,145,178,0.08)',
    textColor: '#164e63',
    mutedTextColor: '#0e7490',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'paper',
    backgroundGradient: 'linear-gradient(135deg, #f0fdff 0%, #e0f2fe 100%)',
  },
  {
    id: 'template_sunset',
    name: 'Sunset',
    nameHebrew: 'שקיעה',
    primaryColor: '#ea580c',
    secondaryColor: '#c2410c',
    accentColor: '#fb923c',
    backgroundColor: '#1a0a00',
    cardBackground: 'rgba(251,146,60,0.08)',
    textColor: '#fff7ed',
    mutedTextColor: '#fed7aa',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'gradient',
    backgroundGradient: 'linear-gradient(135deg, #1a0a00 0%, #431407 100%)',
  },
  {
    id: 'template_silver',
    name: 'Silver',
    nameHebrew: 'כסף',
    primaryColor: '#475569',
    secondaryColor: '#334155',
    accentColor: '#94a3b8',
    backgroundColor: '#f8fafc',
    cardBackground: 'rgba(71,85,105,0.07)',
    textColor: '#0f172a',
    mutedTextColor: '#475569',
    titleFont: 'Assistant',
    bodyFont: 'Assistant',
    backgroundStyle: 'paper',
    backgroundGradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
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
        id: 'cover_title',
        type: 'text',
        content: project.projectData?.projectName || 'עבודת שורשים',
        x: 10, y: 30, width: 80, height: 20,
        style: { fontSize: 48, fontWeight: 'extrabold', textAlign: 'center' }
      },
      {
        id: 'cover_student_name',
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
        { id: 'name_title', type: 'text', content: 'השם שלי', x: 10, y: 10, width: 80, height: 10, style: { fontSize: 36, fontWeight: 'bold', textAlign: 'center' } },
        { id: 'name_meaning_text', type: 'text', content: project.projectData.personalStory.nameMeaning, x: 15, y: 25, width: 70, height: 60, style: { fontSize: 16 } },
      ]
    });
  }

  // 3. Nuclear Family
  const parentRels = relationships.filter(r => r.personBId === project.studentPersonId && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType));
  const parents = parentRels.map(r => people.find(p => p.id === r.personAId)).filter(Boolean) as Person[];

  const nuclearFamilyElements: DesignElement[] = [];
  if (student) {
    nuclearFamilyElements.push({
      id: 'nf_student_card',
      type: 'person_card',
      personId: student.id,
      x: 35, y: 60, width: 30, height: 15,
      zIndex: 10
    });
  }
  parents.forEach((parent, index) => {
    nuclearFamilyElements.push({
      id: `nf_parent_${parent.id}_card`,
      type: 'person_card',
      personId: parent.id,
      x: 20 + (index * 40), y: 20, width: 30, height: 15,
      zIndex: 10
    });
    if (student) {
      nuclearFamilyElements.push({
          id: `nf_conn_${parent.id}`,
          type: 'connection_line',
          fromElementId: `nf_parent_${parent.id}_card`,
          toElementId: 'nf_student_card',
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

  return pages;
}

// ============================================================
// EDITOR COMPONENTS
// ============================================================

const PersonCardElement = ({ element, people }: { element: DesignElement, people: Person[] }) => {
    const person = people.find(p => p.id === element.personId);
    if (!person) return null;
    return (
      <div className="w-full h-full bg-white/5 backdrop-blur-xl border border-white/15 rounded-2xl p-3 flex flex-col items-center gap-2 shadow-xl">
        <div className="w-12 h-12 rounded-full border-2 border-white/30 overflow-hidden flex-shrink-0">
          {person.photoURL ? (
            <img src={person.photoURL} alt="" className="w-full h-full object-cover" />
          ) : (
            <img src={getPlaceholderImage(person.gender)} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="text-center">
          <p className="text-white font-bold text-xs">{person.firstName} {person.lastName}</p>
          {person.birthDate && <p className="text-slate-400 text-xs">{format(new Date(person.birthDate), 'yyyy')}</p>}
          {person.birthPlace && <p className="text-slate-500 text-xs truncate">{person.birthPlace}</p>}
        </div>
      </div>
    );
};

export function RootsDesignEditor({ project, people, relationships, onBack }: {
  project: RootsProject;
  people: Person[];
  relationships: Relationship[];
  onBack: () => void;
}) {
  const [pages, setPages] = useState<DesignPage[]>([]);
  const [isGenerating, setIsGenerating] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('template_cosmic');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'text' | 'shape' | 'person' | 'image' | 'icon' | 'line'>('select');
  const { toast } = useToast();

  const currentPage = pages[currentPageIndex];
  const template = DESIGN_TEMPLATES.find(t => t.id === selectedTemplateId) || DESIGN_TEMPLATES[0];

  useEffect(() => {
    const generated = generatePagesFromProject(project, people, relationships, selectedTemplateId);
    setPages(generated);
    setIsGenerating(false);
  }, [project, people, relationships, selectedTemplateId]);

  const updateCurrentPage = (updater: (page: DesignPage) => DesignPage) => {
    setPages(prev => {
      const newPages = [...prev];
      newPages[currentPageIndex] = updater(newPages[currentPageIndex]);
      return newPages;
    });
  };

  const addElement = (element: Omit<DesignElement, 'id'>) => {
    const newElement = { ...element, id: crypto.randomUUID() };
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
  
  const handleCanvasClick = (e: React.MouseEvent) => {
      if (activeTool === 'text') {
        addElement({
            type: 'text',
            content: 'טקסט חדש',
            x: (e.nativeEvent.offsetX / (e.target as HTMLElement).offsetWidth) * 100,
            y: (e.nativeEvent.offsetY / (e.target as HTMLElement).offsetHeight) * 100,
            width: 30, height: 10,
            style: { fontSize: 16, color: template.textColor }
        });
        setActiveTool('select');
      } else {
        setSelectedElementId(null);
      }
  }

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

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-white" dir="rtl">
        {/* Top Toolbar */}
        <header className="h-12 border-b border-white/10 px-4 flex items-center justify-between flex-shrink-0 z-20">
            <div className='flex items-center gap-4'>
                <Button variant="ghost" size="sm" onClick={() => onBack()}><ArrowLeft className="ml-2 h-4 w-4" />חזור לאשף</Button>
                <Separator orientation="vertical" className='h-6 bg-white/10'/>
                <h1 className='font-bold text-sm'>{project.projectData.projectName}</h1>
            </div>
            <div className='flex items-center gap-2'>
                <TooltipProvider>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'select' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('select')}><MousePointer2 /></Button></TooltipTrigger><TooltipContent><p>Select</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'text' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('text')}><Pilcrow /></Button></TooltipTrigger><TooltipContent><p>Text</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'shape' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('shape')}><Square /></Button></TooltipTrigger><TooltipContent><p>Shape</p></TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={activeTool === 'person' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('person')}><User /></Button></TooltipTrigger><TooltipContent><p>Person</p></TooltipContent></Tooltip>
                </TooltipProvider>
            </div>
            <div className='flex items-center gap-2'>
                <Button variant="ghost" size="sm" onClick={() => toast({title: "בקרוב..."})}><Undo className="ml-2"/></Button>
                <Button variant="ghost" size="sm" onClick={() => toast({title: "בקרוב..."})}><Redo className="ml-2"/></Button>
                 <Separator orientation="vertical" className='h-6 bg-white/10'/>
                 <Button variant="ghost" size="icon" onClick={() => selectedElementId && deleteElement(selectedElementId)} disabled={!selectedElementId}><Trash2 className="text-red-400"/></Button>
            </div>
        </header>

        <div className="flex-1 flex min-h-0">
            {/* Left Panel */}
            <aside className="w-48 border-l border-white/10 p-2 flex flex-col gap-2">
                <Button size="sm" variant="outline" className='bg-transparent w-full'>+ הוסף עמוד</Button>
                <div className='flex-1 overflow-y-auto space-y-2'>
                    {pages.map((page, index) => (
                        <div key={page.id} onClick={() => setCurrentPageIndex(index)} className={cn("aspect-[3/4] w-full bg-slate-800/50 rounded-md p-1 cursor-pointer border-2", currentPageIndex === index ? "border-indigo-500" : "border-transparent")}>
                            <div className='relative w-full h-full bg-slate-900/50 overflow-hidden rounded-sm'>
                                {/* mini preview here */}
                                <span className='absolute bottom-1 right-1 text-xs font-bold text-white/50'>{page.pageNumber}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>
            
            {/* Center Canvas */}
            <main className="flex-1 flex items-center justify-center p-8 bg-black/20 overflow-hidden">
                <div id="canvas-container" className="aspect-[3/4] h-full bg-slate-800 shadow-2xl relative" onClick={handleCanvasClick}>
                    {currentPage?.elements.map(el => (
                       <div 
                         key={el.id}
                         className={cn('absolute border-2', selectedElementId === el.id ? 'border-dashed border-blue-500' : 'border-transparent')}
                         style={{
                             left: `${el.x}%`,
                             top: `${el.y}%`,
                             width: `${el.width}%`,
                             height: `${el.height}%`,
                             zIndex: el.zIndex,
                             color: el.style?.color || template.textColor,
                             backgroundColor: el.style?.backgroundColor,
                             fontSize: el.style?.fontSize,
                             fontWeight: el.style?.fontWeight,
                             textAlign: el.style?.textAlign,
                         }}
                         onClick={(e) => { e.stopPropagation(); setSelectedElementId(el.id); }}
                       >
                           {el.type === 'text' && <div>{el.content}</div>}
                           {el.type === 'person_card' && <PersonCardElement element={el} people={people} />}
                       </div>
                    ))}
                </div>
            </main>

            {/* Right Panel */}
            <aside className="w-60 border-r border-white/10 p-4 space-y-4 overflow-y-auto">
                <h3 className='font-bold text-sm text-center'>{selectedElement ? `עריכת ${selectedElement.type}` : 'עריכת עמוד'}</h3>
                {selectedElement?.type === 'text' && (
                    <div className='space-y-4'>
                        <div className='space-y-1 text-right'>
                            <label className='text-xs text-slate-400'>גודל גופן</label>
                            <Slider
                                value={[selectedElement.style?.fontSize || 16]}
                                onValueChange={([val]) => updateElement(selectedElementId!, { style: { ...selectedElement.style, fontSize: val }})}
                                min={8} max={72} step={1}
                            />
                        </div>
                         <div className='space-y-1 text-right'>
                            <label className='text-xs text-slate-400'>צבע טקסט</label>
                            <Input 
                                type="color"
                                value={selectedElement.style?.color || '#ffffff'}
                                onChange={(e) => updateElement(selectedElementId!, { style: { ...selectedElement.style, color: e.target.value }})}
                            />
                        </div>
                    </div>
                )}
                 {!selectedElement && currentPage && (
                    <div className='space-y-4'>
                        <div className='space-y-1 text-right'>
                            <label className='text-xs text-slate-400'>צבע רקע עמוד</label>
                             <Input 
                                type="color"
                                value={currentPage.backgroundColor || template.backgroundColor}
                                onChange={(e) => updateCurrentPage(p => ({...p, backgroundColor: e.target.value}))}
                            />
                        </div>
                    </div>
                 )}
            </aside>
        </div>
    </div>
  );
}
