'use client';
import { useState, useMemo, useRef, useEffect, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootsProject, Person, FamilyTree, Relationship } from '@/lib/types';
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import {
  Check, Search, Sparkles, Star, BookOpen, Gem, Wand2, Loader2, School,
  User, Calendar, MapPin, Edit, Flag, Utensils, BadgeCheck, PlusCircle,
  BarChart2, Map, CalendarDays, X, RefreshCw, CheckCircle2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { rephraseText } from '@/ai/flows/rephrase-text-flow';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { v4 as uuidv4 } from 'uuid';
import { RootsDesignEditor } from './RootsDesignEditor';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MapSelectionModal } from './roots/MapSelectionModal';
import { StatsSelectionModal } from './roots/StatsSelectionModal';
import { CalendarSelectionModal } from './roots/CalendarSelectionModal';


// --- Utility & Base Components ---

function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): void => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
}

const WizardBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div className="cosmic-orb w-[600px] h-[600px] bg-indigo-900/50 top-[-20%] left-[-10%]" style={{ animationDelay: '0s' }} />
    <div className="cosmic-orb w-[500px] h-[500px] bg-violet-900/40 bottom-[-30%] right-[5%]" style={{ animationDelay: '5s' }} />
    <div className="cosmic-orb w-[400px] h-[400px] bg-teal-900/30 top-[20%] right-[-15%]" style={{ animationDelay: '10s' }} />
  </div>
);

const SaveIndicator = ({ status }: { status: 'idle' | 'saving' | 'saved' }) => (
  <AnimatePresence>
    {status !== 'idle' && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-4 py-2 text-sm text-slate-300 border border-white/10"
      >
        {status === 'saving' && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        {status === 'saving' ? 'שומר...' : 'נשמר אוטומטית'}
        {status === 'saved' && <Check className="h-4 w-4 text-emerald-400" />}
      </motion.div>
    )}
  </AnimatePresence>
);

const MotionButton = forwardRef<HTMLButtonElement, React.ComponentProps<"button"> & { className?: string }>(
  ({ className, children, ...props }, ref) => (
    <motion.button
      ref={ref}
      className={cn(
        "bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-bold py-2 px-5 text-sm rounded-2xl shadow-lg shadow-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      whileHover={{ y: -2, boxShadow: '0 10px 20px rgba(99, 102, 241, 0.4)' }}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {children}
    </motion.button>
  )
);
MotionButton.displayName = "MotionButton";


const GlassmorphicCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_25px_60px_rgba(99,0,255,0.25)] rounded-[2.5rem]',
        className
      )}
      {...props}
    />
  )
);
GlassmorphicCard.displayName = "GlassmorphicCard";

interface EditableFieldProps {
  value: string;
  onUpdate: (newValue: string) => void;
  placeholder?: string;
  isMagical?: boolean;
  className?: string;
  asTextarea?: boolean;
  fieldName?: string; // if provided, shows AiRephraseButton
}

const EditableField = forwardRef<HTMLInputElement | HTMLTextAreaElement, EditableFieldProps>(({ value, onUpdate, placeholder, isMagical, className, asTextarea }, ref) => {
  const [currentValue, setCurrentValue] = useState(value);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.target.value !== value) {
      onUpdateRef.current(e.target.value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !asTextarea) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  };
  
  const commonProps = {
    value: currentValue || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCurrentValue(e.target.value),
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    placeholder: placeholder,
    className: cn(
      "w-full bg-slate-800/80 border-2 border-slate-600 rounded-2xl px-3 py-1.5 text-sm text-white text-right placeholder:text-slate-400 placeholder:text-right",
      "focus:bg-slate-700/90 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/40",
      "transition-all duration-200",
      "shadow-inner shadow-black/30",
      isMagical && "pr-10",
      className
    ),
    style: { direction: 'rtl' } as React.CSSProperties,
  };

  return (
    <div className="relative" dir="rtl">
        <motion.div className="w-full" whileFocus={{ scale: 1.02 }}>
            {asTextarea ? (
                <textarea
                    ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
                    {...commonProps}
                    className={cn(commonProps.className, "min-h-[80px] resize-y")}
                />
            ) : (
                <input
                    ref={ref as React.ForwardedRef<HTMLInputElement>}
                    {...commonProps}
                    className={cn(commonProps.className, "h-[38px]")}
                />
            )}
        </motion.div>
        {isMagical && (
            <Sparkles className="absolute top-1/2 -translate-y-1/2 right-3 h-5 w-5 text-teal-400 z-10 pointer-events-none" />
        )}
    </div>
  );
});
EditableField.displayName = "EditableField";


// --- Step 0: Identity ---
const Step0_IdentitySelection = ({ people, onSelect, currentStudentId, treeOwnerId, onConfirm }: { people: Person[], onSelect: (personId: string) => void, currentStudentId?: string, treeOwnerId?: string, onConfirm: () => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        if (!currentStudentId && treeOwnerId) {
            onSelect(treeOwnerId);
        }
    }, [currentStudentId, treeOwnerId, onSelect]);

    const handleSelectAndConfirm = (id: string) => {
        onSelect(id);
        setShowSearch(false);
    };

    const selectedPerson = useMemo(() => people.find(p => p.id === currentStudentId), [people, currentStudentId]);
    const filteredPeople = useMemo(() => people.filter(p => 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    ), [people, searchTerm]);

    const renderConfirmation = () => {
        if (!selectedPerson) return null;
        return (
            <motion.div
                key="confirmation"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="text-center flex flex-col items-center gap-6"
            >
                <Avatar className="h-24 w-24 ring-4 ring-indigo-500/50 ring-offset-4 ring-offset-black/20">
                    <AvatarImage src={selectedPerson.photoURL || undefined} />
                    <AvatarFallback className='bg-slate-700'>
                        <img src={getPlaceholderImage(selectedPerson.gender)} alt="avatar" />
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">{selectedPerson.firstName} {selectedPerson.lastName}</h2>
                    <p className="text-slate-400">{selectedPerson.birthDate ? format(new Date(selectedPerson.birthDate), 'yyyy') : 'שנת לידה לא ידועה'}</p>
                </div>
                <GlassmorphicCard className="p-6 w-full text-center">
                    <h3 className="text-lg font-bold text-slate-100">האם הפרויקט הוא עבור {selectedPerson.firstName}?</h3>
                </GlassmorphicCard>
                <div className="flex items-center gap-4 mt-4">
                    <Button variant="ghost" onClick={() => setShowSearch(true)} className="text-slate-300 hover:text-white">החלף אדם</Button>
                    <MotionButton onClick={onConfirm}>✓ כן, נמשיך!</MotionButton>
                </div>
            </motion.div>
        );
    };

    const renderSearch = () => (
        <motion.div
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full"
        >
            <h1 className="text-2xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">מי אני?</h1>
            <p className="text-slate-400 mt-1 mb-6 text-center">בחרו את עצמכם מהרשימה כדי להתחיל.</p>
            <div className="relative mb-4">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none" />
                <Input
                    placeholder="חיפוש..."
                    className="w-full max-w-sm mx-auto pr-12 bg-white/5 border-2 border-transparent rounded-2xl p-4 h-14 text-lg text-slate-100 focus:bg-white/10 focus:outline-none focus:border-white/20 focus:ring-4 focus:ring-indigo-500/30 placeholder:text-slate-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <ScrollArea className="h-64">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1">
                    {filteredPeople.map(person => (
                        <motion.button
                            key={person.id}
                            onClick={() => handleSelectAndConfirm(person.id)}
                            className="relative text-right p-3 border-2 rounded-2xl flex items-center gap-3 transition-all duration-200 bg-white/5 border-transparent hover:border-indigo-400/50"
                            whileHover={{ y: -3 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {person.id === treeOwnerId && <BadgeCheck className="absolute top-2 left-2 h-5 w-5 text-indigo-400" title="זה אתה בהגדרות העץ" />}
                            <Avatar className="h-12 w-12 border-2 border-white/20">
                                <AvatarImage src={person.photoURL || undefined} />
                                <AvatarFallback className='bg-slate-700'>
                                    <img src={getPlaceholderImage(person.gender)} alt="avatar" />
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-bold text-slate-100">{person.firstName} {person.lastName}</p>
                                <p className="text-xs text-slate-400">{person.birthDate ? format(new Date(person.birthDate), 'yyyy') : 'שנת לידה לא ידועה'}</p>
                            </div>
                        </motion.button>
                    ))}
                </div>
            </ScrollArea>
        </motion.div>
    );

    return (
        <GlassmorphicCard className="p-8 sm:p-12 max-w-xl mx-auto">
            <AnimatePresence mode="wait">
                {currentStudentId && !showSearch ? renderConfirmation() : renderSearch()}
            </AnimatePresence>
        </GlassmorphicCard>
    );
};

const StudentSelector = ({ people, currentStudentId, onStudentChange }: { 
  people: Person[], 
  currentStudentId?: string, 
  onStudentChange: (id: string) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedPerson = people.find(p => p.id === currentStudentId);

  const filtered = useMemo(() => 
    people.filter(p => 
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
    ), [people, search]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" dir="rtl" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); setIsOpen(prev => !prev); }}
        className="w-full h-[38px] flex items-center gap-2 px-3 rounded-xl bg-slate-800 border-2 border-teal-500/60 text-white text-sm hover:border-teal-400 transition-all duration-200 cursor-pointer"
        dir="rtl"
      >
        {/* RIGHT side: avatar + name (appears first in RTL) */}
        <BadgeCheck className="h-4 w-4 text-teal-400 flex-shrink-0" />
        {selectedPerson ? (
          <>
            <Avatar className="h-6 w-6 border border-white/20 flex-shrink-0">
              <AvatarImage src={selectedPerson.photoURL || undefined} />
              <AvatarFallback className="bg-slate-600 text-xs">
                <img src={getPlaceholderImage(selectedPerson.gender)} alt="" />
              </AvatarFallback>
            </Avatar>
            <span className="text-white font-medium flex-1 text-right">{selectedPerson.firstName} {selectedPerson.lastName}</span>
          </>
        ) : (
          <span className="text-slate-400 flex-1 text-right">בחר/י תלמיד/ה</span>
        )}
        {/* LEFT side: chevron */}
        <svg
          className={cn("h-4 w-4 text-slate-400 transition-transform flex-shrink-0 mr-auto", isOpen && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel — rendered in a portal-like fixed overlay */}
      {isOpen && (
        <div 
          className="absolute top-full mt-1 w-full z-[9999] bg-slate-900 border border-slate-600 rounded-xl shadow-2xl shadow-black/70 overflow-hidden"
          style={{ maxHeight: '280px', display: 'flex', flexDirection: 'column' }}
        >
          {/* Search input inside dropdown */}
          <div className="p-2 border-b border-slate-700 flex-shrink-0">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש..."
                autoFocus
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder:text-slate-500 text-right focus:outline-none focus:border-indigo-400"
                style={{ direction: 'rtl' }}
                onMouseDown={e => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-center text-slate-500 py-4 text-sm">לא נמצאו תוצאות</p>
            ) : (
              filtered.map(person => (
                <button
                  key={person.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onStudentChange(person.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "w-full flex items-center justify-end gap-3 px-4 py-2.5 text-right hover:bg-slate-700 active:bg-slate-600 transition-colors cursor-pointer",
                    person.id === currentStudentId && "bg-indigo-900/60"
                  )}
                >
                  {person.id === currentStudentId && (
                    <Check className="h-4 w-4 text-teal-400 flex-shrink-0 mr-auto" />
                  )}
                  <div className="text-right">
                    <p className="text-sm text-white font-medium">{person.firstName} {person.lastName}</p>
                    {person.birthDate && (
                      <p className="text-xs text-slate-400">{format(new Date(person.birthDate), 'yyyy')}</p>
                    )}
                  </div>
                  <Avatar className="h-8 w-8 border border-white/20 flex-shrink-0">
                    <AvatarImage src={person.photoURL || undefined} />
                    <AvatarFallback className="bg-slate-600">
                      <img src={getPlaceholderImage(person.gender)} alt="" />
                    </AvatarFallback>
                  </Avatar>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// --- Step 1: Formal Info ---
interface Step1FormalInfoProps {
    projectData: any;
    onUpdate: (path: (string | number)[], value: any) => void;
    people: Person[];
    onStudentChange: (personId: string) => void;
    currentStudentId?: string;
}
const Step1_FormalInfo = ({ projectData, onUpdate, people, onStudentChange, currentStudentId }: Step1FormalInfoProps) => {
    const coverPage = projectData.coverPage || {};
    const fieldContainerClass = "space-y-1";
    const labelClass = "font-semibold text-slate-300 px-1 text-xs block w-full text-right";
    const submissionDate = coverPage.submissionDate;

    useEffect(() => {
      if (submissionDate) {
        try {
          const date = new Date(submissionDate);
          if (isValid(date)) {
            // Get Hebrew year number
            const hebrewYearNum = parseInt(
              new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric' }).format(date)
            );
            
            // Convert to Hebrew letters (Gematria)
            const toHebrewLetters = (num: number): string => {
              const letters: [number, string][] = [
                [400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],
                [90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],
                [40,'מ'],[30,'ל'],[20,'כ'],[10,'י'],
                [9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],
                [4,'ד'],[3,'ג'],[2,'ב'],[1,'א']
              ];
              // Work with last 3 digits for year (remove thousands)
              let n = num % 1000;
              let result = '';
              for (const [val, letter] of letters) {
                while (n >= val) {
                  result += letter;
                  n -= val;
                }
              }
              // Fix special cases: יה→טו, יו→טז
              result = result.replace('יה', 'טו').replace('יו', 'טז');
              // Add geresh/gershayim
              if (result.length === 1) {
                result += '׳';
              } else {
                result = result.slice(0, -1) + '״' + result.slice(-1);
              }
              return result;
            };
            
            const hebrewLetters = toHebrewLetters(hebrewYearNum);
            const combined = `${hebrewLetters} (${hebrewYearNum})`;
            
            if (coverPage.hebrewYear !== combined) {
              onUpdate(['coverPage', 'hebrewYear'], combined);
            }
          }
        } catch (e) {
          console.error("Could not calculate Hebrew year:", e);
        }
      }
    }, [submissionDate, onUpdate, coverPage.hebrewYear]);

    return (
        <div className="space-y-3">
            <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">מעטפת רשמית</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2" dir="rtl">
                <div className={fieldContainerClass}>
                    <label className={labelClass}>
                        <User className="inline h-3 w-3 mb-0.5 ml-1" />
                        מגיש/ה
                    </label>
                    <StudentSelector people={people} currentStudentId={currentStudentId} onStudentChange={onStudentChange} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}>
                        <School className="inline h-3 w-3 mb-0.5 ml-1" />
                        שם בית הספר
                    </label>
                    <EditableField value={coverPage.schoolName || ''} onUpdate={(v) => onUpdate(['coverPage', 'schoolName'], v)} placeholder="לדוגמה: עירוני א'" isMagical={!!coverPage.schoolName} />
                </div>

                <div className={fieldContainerClass}>
                    <label className={labelClass}>
                        <MapPin className="inline h-3 w-3 mb-0.5 ml-1" />
                        עיר
                    </label>
                    <EditableField value={coverPage.city || ''} onUpdate={(v) => onUpdate(['coverPage', 'city'], v)} placeholder="לדוגמה: תל אביב" isMagical={!!coverPage.city} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}>
                        <User className="inline h-3 w-3 mb-0.5 ml-1" />
                        כיתה
                    </label>
                    <EditableField value={coverPage.grade || ''} onUpdate={(v) => onUpdate(['coverPage', 'grade'], v)} placeholder="לדוגמה: ז'3" isMagical={!!coverPage.grade} />
                </div>
                
                <div className={fieldContainerClass}>
                    <label className={labelClass}>
                        <User className="inline h-3 w-3 mb-0.5 ml-1" />
                        שם המורה
                    </label>
                    <EditableField value={coverPage.teacherName || ''} onUpdate={(v) => onUpdate(['coverPage', 'teacherName'], v)} placeholder="לדוגמה: ישראל ישראלי" isMagical={!!coverPage.teacherName} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}>
                        <User className="inline h-3 w-3 mb-0.5 ml-1" />
                        שם המנהל/ת
                    </label>
                    <EditableField value={coverPage.principalName || ''} onUpdate={(v) => onUpdate(['coverPage', 'principalName'], v)} placeholder="לדוגמה: דנה לוי" />
                </div>
                
                <div className={fieldContainerClass}>
                    <label className={labelClass}>
                        <Calendar className="inline h-3 w-3 mb-0.5 ml-1" />
                        תאריך הגשה
                    </label>
                    <EditableField value={coverPage.submissionDate || ''} onUpdate={(v) => onUpdate(['coverPage', 'submissionDate'], v)} placeholder="DD/MM/YYYY" />
                </div>
                 <div className={fieldContainerClass}>
                    <label className={labelClass}>
                        <Flag className="inline h-3 w-3 mb-0.5 ml-1" />
                        שנה עברית
                    </label>
                    <EditableField value={coverPage.hebrewYear || ''} onUpdate={(v) => onUpdate(['coverPage', 'hebrewYear'], v)} placeholder="תחושב אוטומטית" isMagical={!!coverPage.hebrewYear} />
                </div>
            </div>
        </div>
    );
};

const AiRephraseButton = ({ value, onRephrase, fieldName }: { 
  value: string; 
  onRephrase: (newValue: string) => void;
  fieldName: string;
}) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');
  const [showTooltip, setShowTooltip] = useState(false);

  const handleRephrase = async () => {
    if (!value || value.trim().length < 5) {
      setShowTooltip(true);
      setTimeout(() => setShowTooltip(false), 3000);
      return;
    }
    setStatus('loading');
    try {
      const result = await rephraseText({
        textToRephrase: value,
        fieldName: fieldName,
      });

      const improved = result.rephrasedText;
      
      if (improved) {
        onRephrase(improved);
        setStatus('done');
        setTimeout(() => setStatus('idle'), 2000);
      } else {
        setStatus('idle');
      }
    } catch (e) {
      console.error('AI rephrase error:', e);
      setStatus('idle');
    }
  };

  return (
    <div className="relative inline-flex">
      <motion.button
        type="button"
        onClick={handleRephrase}
        disabled={status === 'loading'}
        className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center transition-all duration-200",
          status === 'idle' && "bg-violet-500/20 hover:bg-violet-500/40 text-violet-300",
          status === 'loading' && "bg-violet-500/30 text-violet-300",
          status === 'done' && "bg-emerald-500/30 text-emerald-300"
        )}
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
        title="שפר עם AI"
      >
        {status === 'loading' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : status === 'done' ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Wand2 className="h-3.5 w-3.5" />
        )}
      </motion.button>
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full mb-2 right-0 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-xs text-slate-200 whitespace-nowrap z-50 shadow-xl"
          >
            כתוב משהו קודם כדי שה-AI יוכל לעזור 😊
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


// --- Step 2: My Story (Combined) ---
const Step2_MyStory = ({ projectData, onUpdate }: { projectData: any, onUpdate: (path: (string|number)[], value: any) => void }) => {
  const myStory = projectData.personalStory || {};
  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">הסיפור שלי</h1>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between w-full">
          <AiRephraseButton value={myStory.nameMeaning || ''} onRephrase={(v) => onUpdate(['personalStory', 'nameMeaning'], v)} fieldName="משמעות שמי" />
          <label className="font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">משמעות שמי</label>
        </div>
        <EditableField asTextarea value={myStory.nameMeaning || ''} onUpdate={(v) => onUpdate(['personalStory', 'nameMeaning'], v)} placeholder="ספרו על מקור השם שלכם, מה הוא מסמל, ומה הקשר שלו למשפחה..." />
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between w-full">
          <AiRephraseButton value={myStory.nameChoiceStory || ''} onRephrase={(v) => onUpdate(['personalStory', 'nameChoiceStory'], v)} fieldName="מי בחר את שמי" />
          <label className="font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">מי בחר את שמי ולמה</label>
        </div>
        <EditableField asTextarea value={myStory.nameChoiceStory || ''} onUpdate={(v) => onUpdate(['personalStory', 'nameChoiceStory'], v)} placeholder="מי החליט על השם? האם זה על שם מישהו? מה הסיפור?" />
      </div>

       <div className="space-y-1">
        <div className="flex items-center justify-between w-full">
          <AiRephraseButton value={myStory.birthStory || ''} onRephrase={(v) => onUpdate(['personalStory', 'birthStory'], v)} fieldName="סיפור הלידה שלי" />
          <label className="font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">סיפור הלידה שלי</label>
        </div>
        <EditableField asTextarea value={myStory.birthStory || ''} onUpdate={(v) => onUpdate(['personalStory', 'birthStory'], v)} placeholder="תארו את סיפור לידתכם כפי שסופר ע״י ההורים. איפה נולדתם? מה היה מיוחד?" />
      </div>
    </div>
  );
};


// --- Ancestor Card ---
const AncestorCard = ({
  person,
  title,
  fields,
  data,
  onUpdate,
  onEditPerson,
  isSyncable,
}: {
  person?: Person;
  title: string;
  fields: { key: string; label: string; placeholder: string; isTextarea?: boolean }[];
  data: any;
  onUpdate: (key: string, value: any) => void;
  onEditPerson?: (personId: string) => void;
  isSyncable?: boolean;
}) => {
  const { toast } = useToast();

  const handleSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!person) return;
    let syncedCount = 0;

    fields.forEach(field => {
      let valueToSync: any = undefined;
      switch (field.key) {
        case 'birthYear':
          if (person.birthDate && isValid(parseISO(person.birthDate))) {
            valueToSync = new Date(person.birthDate).getFullYear().toString();
          }
          break;
        case 'birthPlace':
          valueToSync = person.birthPlace;
          break;
        case 'story':
          valueToSync = person.description;
          break;
      }

      if (valueToSync !== undefined && data[field.key] !== valueToSync) {
        onUpdate(field.key, valueToSync);
        syncedCount++;
      }
    });

    if (syncedCount > 0) {
      toast({ title: `סונכרנו ${syncedCount} שדות מכרטיס האדם`, duration: 2000 });
    } else {
      toast({ title: "הפרטים כבר מסונכרנים", duration: 2000 });
    }
  };

  return (
    <GlassmorphicCard className="p-4 rounded-2xl space-y-3">
      <div
        className="flex w-full items-center gap-3 justify-end cursor-pointer"
        onClick={() => person && onEditPerson && onEditPerson(person.id)}
      >
        {person && isSyncable && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-400 hover:text-white mr-auto flex-shrink-0"
                  onClick={handleSync}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>סנכרן פרטים מכרטיס האדם</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <div className="text-right">
          <p className="font-bold text-white text-sm">{person ? `${person.firstName} ${person.lastName}` : title}</p>
          <p className="text-xs text-slate-400">
            {person?.birthDate ? `נולד/ה: ${format(parseISO(person.birthDate), 'yyyy')}` : title}
            {person?.birthPlace ? ` · ${person.birthPlace}` : ''}
          </p>
        </div>
        <Avatar className="h-10 w-10 border-2 border-white/20">
          <AvatarImage src={person?.photoURL || undefined} />
          <AvatarFallback className="bg-slate-700">
            <img src={getPlaceholderImage(person?.gender)} alt="" />
          </AvatarFallback>
        </Avatar>
      </div>
      {fields.map(field => (
        <div key={field.key} className="space-y-1">
          <div className="flex items-center justify-between">
            <AiRephraseButton 
              value={data[field.key] ?? ''} 
              onRephrase={(v) => onUpdate(field.key, v)} 
              fieldName={`${title}: ${field.label}`}
            />
            <label className="text-xs text-slate-400 block w-full text-right">{field.label}</label>
          </div>
          <EditableField
            asTextarea={field.isTextarea}
            value={data[field.key] ?? ''} 
            onUpdate={(v) => onUpdate(field.key, v)} 
            placeholder={field.placeholder}
          />
        </div>
      ))}
    </GlassmorphicCard>
  );
};

// --- Step 3: Nuclear Family ---
const Step3_NuclearFamily = ({ projectData, onUpdate, people, relationships, currentStudentId, onEditPerson }: { 
  projectData: any, 
  onUpdate: (path: (string|number)[], value: any) => void,
  people: Person[],
  relationships: Relationship[],
  currentStudentId?: string,
  onEditPerson?: (personId: string) => void
}) => {
  const family = projectData.nuclearFamily || {};
  
  const familyMembers = useMemo(() => {
    if (!currentStudentId) return { parents: [], siblings: [] };
    
    const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent'];
    const SIBLING_REL_TYPES = ['sibling', 'twin', 'step_sibling'];

    // Find Parents
    const parentRels = relationships.filter(r => 
      r.personBId === currentStudentId && PARENT_REL_TYPES.includes(r.relationshipType)
    );
    const parentIds = [...new Set(parentRels.map(r => r.personAId))];
    const parents = parentIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
    
    // Find Siblings
    const siblingIds = new Set<string>();

    // 1. Through common parents
    parentIds.forEach(parentId => {
      const childrenOfParent = relationships.filter(r => r.personAId === parentId && PARENT_REL_TYPES.includes(r.relationshipType)).map(r => r.personBId);
      childrenOfParent.forEach(childId => {
        if (childId !== currentStudentId) siblingIds.add(childId);
      });
    });
    
    // 2. Through direct sibling relationships
    relationships.forEach(r => {
      if (SIBLING_REL_TYPES.includes(r.relationshipType)) {
        if (r.personAId === currentStudentId) {
          siblingIds.add(r.personBId);
        } else if (r.personBId === currentStudentId) {
          siblingIds.add(r.personAId);
        }
      }
    });
    
    const siblings = Array.from(siblingIds).map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];

    return { parents, siblings };
  }, [relationships, people, currentStudentId]);
  
  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">המשפחה הגרעינית</h1>
      
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-300 text-right border-b border-white/10 pb-2">ההורים שלי</h2>
        {familyMembers.parents.length > 0 ? (
          familyMembers.parents.map((parent) => (
            <AncestorCard 
              key={parent.id}
              person={parent}
              title={`סיפור על ${parent.firstName}`}
              fields={[{ key: `parent_${parent.id}_bio`, label: `ספר/י על ${parent.firstName} במשפחה`, placeholder: `מה הוא/היא עושה? מה מיוחד בו/בה?`, isTextarea: true }]}
              data={family}
              onUpdate={(key, val) => onUpdate(['nuclearFamily', key], val)}
              onEditPerson={onEditPerson}
            />
          ))
        ) : (
          <div className="text-center py-6 text-slate-500 text-sm bg-white/5 rounded-2xl">
            <p>לא נמצאו הורים בעץ המשפחה עבור {people.find(p => p.id === currentStudentId)?.firstName}.</p>
            <p className="text-xs mt-1">ניתן להוסיף הורים ישירות בעץ המשפחה.</p>
          </div>
        )}
        
        <div className="space-y-1 mt-3">
          <div className="flex items-center justify-between">
            <AiRephraseButton value={family.parentsMeetingStory || ''} onRephrase={(v) => onUpdate(['nuclearFamily', 'parentsMeetingStory'], v)} fieldName="סיפור ההיכרות של ההורים" />
            <label className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">סיפור ההיכרות של ההורים</label>
          </div>
          <EditableField asTextarea value={family.parentsMeetingStory || ''} onUpdate={(v) => onUpdate(['nuclearFamily', 'parentsMeetingStory'], v)} placeholder="איך הכירו ההורים שלך? מה הסיפור שלהם?" />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-300 text-right border-b border-white/10 pb-2">אחים ואחיות</h2>
        {familyMembers.siblings.length > 0 ? (
          familyMembers.siblings.map((sibling) => (
             <AncestorCard 
              key={sibling.id}
              person={sibling}
              title={`סיפור על ${sibling.firstName}`}
              fields={[{ key: `sibling_${sibling.id}_bio`, label: `ספר/י על ${sibling.firstName}`, placeholder: `מה הקשר שלכם? מה הוא/היא אוהב/ת לעשות?`, isTextarea: true }]}
              data={family}
              onUpdate={(key, val) => onUpdate(['nuclearFamily', key], val)}
              onEditPerson={onEditPerson}
            />
          ))
        ) : (
           <div className="text-center py-6 text-slate-500 text-sm bg-white/5 rounded-2xl">
            <p>לא נמצאו אחים/אחיות.</p>
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-teal-900/20 border border-teal-500/20">
        <p className="text-xs text-teal-300 text-right">
          💡 <strong>טיפ:</strong> בשלב עיצוב העבודה תוכל/י לצרף צילום מסך מהעץ המשפחתי המציג את תמונת המשפחה הגרעינית שלך.
        </p>
      </div>
    </div>
  );
};


// --- Step 4 & 5: Grandparents ---
const GrandparentsStep = ({ side, projectData, onUpdate, people, relationships, currentStudentId, onEditPerson }: {
  side: 'paternal' | 'maternal';
  projectData: any;
  onUpdate: (path: (string|number)[], value: any) => void;
  people: Person[];
  relationships: Relationship[];
  currentStudentId?: string;
  onEditPerson?: (personId: string) => void;
}) => {
  const roots = projectData.familyRoots || {};
  
  const ancestors = useMemo(() => {
    const findParents = (personId?: string): Person[] => {
      if (!personId) return [];
      const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent'];
      const parentRels = relationships.filter(r => r.personBId === personId && PARENT_REL_TYPES.includes(r.relationshipType));
      return parentRels.map(r => people.find(p => p.id === r.personAId)).filter(Boolean) as Person[];
    };
    
    const parents = findParents(currentStudentId);
    const relevantParent = parents.find(p => side === 'paternal' ? p.gender === 'male' : p.gender === 'female');
    
    const grandparents = findParents(relevantParent?.id);
    const grandfather = grandparents.find(p => p.gender === 'male');
    const grandmother = grandparents.find(p => p.gender === 'female');
    
    return { grandfather, grandmother };
  }, [people, relationships, currentStudentId, side]);
  
  const fields = [
    { key: 'birthYear', label: 'שנת לידה', placeholder: 'לדוגמה: 1950' },
    { key: 'birthPlace', label: 'מקום לידה ומדינת מוצא', placeholder: 'לדוגמה: קזבלנקה, מרוקו' },
    { key: 'aliyahYear', label: 'שנת עלייה לישראל', placeholder: 'אם רלוונטי' },
    { key: 'story', label: 'סיפור חיים', placeholder: 'ספר/י בקצרה על חייהם, מהיכן עלו, זיכרונות ילדות, אירועים מיוחדים וכו\'...', isTextarea: true },
  ];
  
  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">
        סבא וסבתא: צד ה{side === 'paternal' ? 'אב' : 'אם'}
      </h1>
      <AncestorCard 
        isSyncable
        title={`סבא (אבא של ${side === 'paternal' ? 'אבא' : 'אמא'})`}
        person={ancestors.grandfather}
        fields={fields}
        data={roots[`${side}Grandfather`] || {}}
        onUpdate={(key, val) => onUpdate(['familyRoots', `${side}Grandfather`, key], val)}
        onEditPerson={onEditPerson}
      />
      <AncestorCard 
        isSyncable
        title={`סבתא (אמא של ${side === 'paternal' ? 'אבא' : 'אמא'})`}
        person={ancestors.grandmother}
        fields={fields}
        data={roots[`${side}Grandmother`] || {}}
        onUpdate={(key, val) => onUpdate(['familyRoots', `${side}Grandmother`, key], val)}
        onEditPerson={onEditPerson}
      />
    </div>
  );
};


// --- Step 6 & 7: Great-Grandparents ---
const GreatGrandparentsStep = ({ side, projectData, onUpdate, people, relationships, currentStudentId, onEditPerson }: {
  side: 'paternal' | 'maternal';
  projectData: any;
  onUpdate: (path: (string|number)[], value: any) => void;
  people: Person[];
  relationships: Relationship[];
  currentStudentId?: string;
  onEditPerson?: (personId: string) => void;
}) => {
   const roots = projectData.familyRoots || {};
  
  const ancestors = useMemo(() => {
    const findParents = (personId?: string): Person[] => {
      if (!personId) return [];
      const PARENT_REL_TYPES = ['parent', 'adoptive_parent', 'step_parent'];
      const parentRels = relationships.filter(r => r.personBId === personId && PARENT_REL_TYPES.includes(r.relationshipType));
      return parentRels.map(r => people.find(p => p.id === r.personAId)).filter(Boolean) as Person[];
    };
    
    const parents = findParents(currentStudentId);
    const relevantParent = parents.find(p => side === 'paternal' ? p.gender === 'male' : p.gender === 'female');
    const grandparents = findParents(relevantParent?.id);
    const grandfather = grandparents.find(p => p.gender === 'male');
    const grandmother = grandparents.find(p => p.gender === 'female');

    const ggf_p = findParents(grandfather?.id);
    const ggm_p = findParents(grandmother?.id);
    
    return { 
      ggf_f: ggf_p.find(p => p.gender === 'male'),
      ggm_f: ggf_p.find(p => p.gender === 'female'),
      ggf_m: ggm_p.find(p => p.gender === 'male'),
      ggm_m: ggm_p.find(p => p.gender === 'female'),
    };
  }, [people, relationships, currentStudentId, side]);

  const fields = [
    { key: 'story', label: 'מה ידוע על דור זה?', placeholder: 'שמות, מקומות, סיפורים שעברו במשפחה...', isTextarea: true },
  ];

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">
        הדור של סבא-רבא: צד ה{side === 'paternal' ? 'אב' : 'אם'}
      </h1>
      <AncestorCard isSyncable title="אבא של סבא" person={ancestors.ggf_f} fields={fields} data={roots[`${side}GGFf`] || {}} onUpdate={(k,v) => onUpdate(['familyRoots', `${side}GGFf`, k],v)} onEditPerson={onEditPerson} />
      <AncestorCard isSyncable title="אמא של סבא" person={ancestors.ggm_f} fields={fields} data={roots[`${side}GGMf`] || {}} onUpdate={(k,v) => onUpdate(['familyRoots', `${side}GGMf`, k],v)} onEditPerson={onEditPerson} />
      <AncestorCard isSyncable title="אבא של סבתא" person={ancestors.ggf_m} fields={fields} data={roots[`${side}GGFm`] || {}} onUpdate={(k,v) => onUpdate(['familyRoots', `${side}GGFm`, k],v)} onEditPerson={onEditPerson} />
      <AncestorCard isSyncable title="אמא של סבתא" person={ancestors.ggm_m} fields={fields} data={roots[`${side}GGMm`] || {}} onUpdate={(k,v) => onUpdate(['familyRoots', `${side}GGMm`, k],v)} onEditPerson={onEditPerson} />
    </div>
  );
};


// --- Step 8-12: Heritage Steps ---
const HeritageStep = ({ 
  title, icon, fieldKey, placeholder, projectData, onUpdate 
}: { 
  title: string;
  icon: React.ReactNode;
  fieldKey: string;
  placeholder: string;
  projectData: any;
  onUpdate: (path: (string|number)[], value: any) => void;
}) => {
  const heritage = projectData.heritage || {};
  return (
    <div className="space-y-3" dir="rtl">
      <h1 className="flex items-center justify-center gap-3 text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">
        {icon} {title}
      </h1>
      <div className="space-y-1">
        <div className="flex items-center justify-between w-full">
          <AiRephraseButton value={heritage[fieldKey] || ''} onRephrase={(v) => onUpdate(['heritage', fieldKey], v)} fieldName={title} />
        </div>
        <EditableField asTextarea value={heritage[fieldKey] || ''} onUpdate={(v) => onUpdate(['heritage', fieldKey], v)} placeholder={placeholder} />
      </div>
    </div>
  );
};

// --- Step 11: National History ---
const Step11_NationalHistory = ({ projectData, onUpdate }: { projectData: any, onUpdate: (path: (string|number)[], value: any) => void }) => {
  // Same as old Step6, just isolated.
  const heritage = projectData.heritage || {};
  const initialHistoricalEvents = useMemo(() => [
    { id: 'independence', label: 'מלחמת העצמאות', year: '1948' },
    { id: 'sinai', label: 'מבצע סיני', year: '1956' },
    { id: 'sixdays', label: 'מלחמת ששת הימים', year: '1967' },
    { id: 'kippur', label: 'מלחמת יום הכיפורים', year: '1973' },
    { id: 'galilee', label: 'מבצע שלום הגליל', year: '1982' },
    { id: 'aliyah1', label: 'העלייה הראשונה', year: '1882' },
    { id: 'aliyah_ethiopia', label: 'עלייה מאתיופיה', year: '1984/1991' },
    { id: 'aliyah_russia', label: 'עלייה מחבר המדינות', year: '1990s' },
    { id: 'herut_habanim', label: 'מבצע חרבות ברזל', year: '2023' },
  ], []);

  const [customEvents, setCustomEvents] = useState(heritage.customHistoricalEvents || []);
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventYear, setNewEventYear] = useState('');
  const [isAddEventPopoverOpen, setIsAddEventPopoverOpen] = useState(false);

  useEffect(() => {
    onUpdate(['heritage', 'customHistoricalEvents'], customEvents);
  }, [customEvents]);

  const allEvents = useMemo(() => [...initialHistoricalEvents, ...customEvents], [initialHistoricalEvents, customEvents]);
  const selectedEvents: string[] = heritage.selectedEvents || [];
  
  const toggleEvent = (eventId: string) => {
    const newSelected = selectedEvents.includes(eventId)
      ? selectedEvents.filter(e => e !== eventId)
      : [...selectedEvents, eventId];
    onUpdate(['heritage', 'selectedEvents'], newSelected);
  };
  
  const handleAddNewEvent = () => {
    if (!newEventLabel || !newEventYear) return;
    const newEvent = { id: uuidv4(), label: newEventLabel.trim(), year: newEventYear.trim() };
    setCustomEvents([...customEvents, newEvent]);
    toggleEvent(newEvent.id);
    setNewEventLabel('');
    setNewEventYear('');
    setIsAddEventPopoverOpen(false);
  };
  
  const handleUpdateCustomEvent = (eventId: string, newValues: { label: string; year: string; }) => {
    setCustomEvents(prev => prev.map((e: {id: string}) => 
        e.id === eventId ? { ...e, ...newValues } : e
    ));
  };
  
  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">מורשת והיסטוריה</h1>
      <p className="text-xs text-slate-400 text-center">סמן/י אירועים היסטוריים שמשפחתך הייתה קשורה אליהם וספר/י על כך:</p>
      <div className="flex flex-wrap gap-2 justify-end p-2 bg-black/20 rounded-xl">
        {allEvents.map((event, index) => (
          <EditableEventChip
            key={`event-${event.id}-${index}`}
            event={{...event, isCustom: !initialHistoricalEvents.some(initial => initial.id === event.id)}}
            isSelected={selectedEvents.includes(event.id)}
            onToggle={toggleEvent}
            onUpdate={handleUpdateCustomEvent}
          />
        ))}
        <Popover open={isAddEventPopoverOpen} onOpenChange={setIsAddEventPopoverOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-white/30 text-slate-300 hover:bg-white/10 hover:border-white/50">
                <PlusCircle className="inline ml-1 h-3 w-3" /> הוסף אירוע
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="grid gap-4" dir="rtl">
                <div className="space-y-2 text-right"><h4 className="font-medium leading-none">הוספת אירוע היסטורי</h4><p className="text-sm text-muted-foreground">האירוע יתווסף לרשימה.</p></div>
                <div className="grid gap-2 text-right">
                  <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="evt-label">שם האירוע</Label><Input id="evt-label" value={newEventLabel} onChange={(e) => setNewEventLabel(e.target.value)} className="col-span-2 h-8" /></div>
                  <div className="grid grid-cols-3 items-center gap-4"><Label htmlFor="evt-year">שנה</Label><Input id="evt-year" value={newEventYear} onChange={(e) => setNewEventYear(e.target.value)} className="col-span-2 h-8" /></div>
                </div>
                <Button onClick={handleAddNewEvent}>שמור והוסף</Button>
              </div>
            </PopoverContent>
          </Popover>
      </div>
        
      {selectedEvents.map((eventId, index) => {
        const event = allEvents.find(e => e.id === eventId);
        if (!event) return null;
        return (
          <div key={`selected-event-${eventId}-${index}`} className="space-y-1">
            <div className="flex items-center justify-between">
              <AiRephraseButton value={heritage[`event_${eventId}`] || ''} onRephrase={(v) => onUpdate(['heritage', `event_${eventId}`], v)} fieldName={event.label} />
              <label className="text-xs text-slate-300 block w-full text-right">הקשר של משפחתי ל{event.label}:</label>
            </div>
            <EditableField asTextarea value={heritage[`event_${eventId}`] || ''} onUpdate={(v) => onUpdate(['heritage', `event_${eventId}`], v)} placeholder={`ספר/י על הקשר של משפחתך ל${event.label}...`} />
          </div>
        );
      })}
    </div>
  );
};


// --- Step 13: Final Touches ---
const Step13_FinalTouches = ({ 
    project, projectData, onUpdate, people,
    onOpenMap, onOpenStats, onOpenCalendar
}: {
  project: RootsProject;
  projectData: any,
  onUpdate: (path: (string|number)[], value: any) => void,
  people: Person[],
  onOpenMap: () => void;
  onOpenStats: () => void;
  onOpenCalendar: () => void;
}) => {
    const finalizationData = projectData.finalPresentation || {};
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const involvedIds = useMemo(() => {
        const ids = new Set<string>();
        if (project.studentPersonId) ids.add(project.studentPersonId);
        const getIds = (obj: any) => {
            if (!obj) return;
            if (typeof obj === 'string' && people.some(p => p.id === obj)) {
                ids.add(obj);
            } else if (obj.personId && typeof obj.personId === 'string' && people.some(p => p.id === obj.personId)) {
                ids.add(obj.personId);
            }

            if (Array.isArray(obj)) {
                obj.forEach(v => getIds(v));
            } else if (typeof obj === 'object') {
                Object.values(obj).forEach(v => getIds(v));
            }
        };
        getIds(projectData.familyRoots);
        
        const nuclearFamily = projectData.nuclearFamily || {};
        const parentKeys = Object.keys(nuclearFamily).filter(k => k.startsWith('parent_'));
        parentKeys.forEach(key => {
            const personId = key.split('_')[1];
            if (people.some(p => p.id === personId)) ids.add(personId);
        });

        const siblingKeys = Object.keys(nuclearFamily).filter(k => k.startsWith('sibling_'));
        siblingKeys.forEach(key => {
            const personId = key.split('_')[1];
            if (people.some(p => p.id === personId)) ids.add(personId);
        });

        (finalizationData.extraPeople || []).forEach((id: string) => ids.add(id));
        return Array.from(ids);
    }, [project, projectData, finalizationData.extraPeople, people]);

    const involvedPeople = useMemo(() => people.filter(p => involvedIds.includes(p.id)), [involvedIds, people]);
    const availablePeople = useMemo(() => people.filter(p => !involvedIds.includes(p.id) && `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())), [involvedIds, people, searchTerm]);

    const handleAddPerson = (personId: string) => {
        const currentExtra = finalizationData.extraPeople || [];
        onUpdate(['finalPresentation', 'extraPeople'], [...currentExtra, personId]);
        setSearchTerm('');
        setIsAdding(false);
    };

    const handleRemovePerson = (personId: string) => {
        const currentExtra = finalizationData.extraPeople || [];
        onUpdate(['finalPresentation', 'extraPeople'], currentExtra.filter((id: string) => id !== personId));
    };

    const extras = [
        { key: 'map', label: 'מפת נדידה משפחתית', icon: <Map className="h-4 w-4" />, onClick: onOpenMap, selected: !!finalizationData.mapScreenshotUrl },
        { key: 'stats', label: 'גרפים סטטיסטיים', icon: <BarChart2 className="h-4 w-4" />, onClick: onOpenStats, selected: (finalizationData.selectedStats || []).length > 0 },
        { key: 'calendar', label: 'אירועים חשובים מלוח השנה', icon: <CalendarDays className="h-4 w-4" />, onClick: onOpenCalendar, selected: (finalizationData.selectedEvents || []).length > 0 },
    ];
    
    return (
        <div className="space-y-6" dir="rtl">
            <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">הכנה לייצוא המצגת</h1>
            
            <div className="p-4 bg-black/20 rounded-2xl space-y-3">
                <h2 className="text-sm font-bold text-slate-300 text-right">אנשים שיופיעו במצגת ({involvedPeople.length})</h2>
                <ScrollArea className="h-40 border rounded-lg bg-slate-900/50">
                    {involvedPeople.map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-2 p-1.5 border-b border-white/5">
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 flex-shrink-0" onClick={() => handleRemovePerson(p.id)}><X className="h-3.5 w-3.5" /></Button>
                            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                                <span className="text-xs font-medium text-slate-200 truncate">{p.firstName} {p.lastName}</span>
                                <Avatar className="h-7 w-7"><AvatarImage src={p.photoURL || undefined} /><AvatarFallback><img src={getPlaceholderImage(p.gender)} alt="" /></AvatarFallback></Avatar>
                            </div>
                        </div>
                    ))}
                </ScrollArea>
                 <Popover open={isAdding} onOpenChange={setIsAdding}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full border-dashed bg-transparent border-slate-600 hover:bg-slate-700/50 hover:text-slate-100 text-slate-300">
                            <PlusCircle className="ml-2 h-4 w-4" /> הוסף אדם מהעץ
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="center">
                        <div className="p-2 border-b"><Input placeholder="חיפוש..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                        <ScrollArea className="h-60">
                           {availablePeople.map(p => (
                                <button key={p.id} onClick={() => handleAddPerson(p.id)} className="w-full text-right p-2 hover:bg-slate-700 flex items-center gap-2 justify-end">
                                     <span className="text-xs">{p.firstName} {p.lastName}</span>
                                     <Avatar className="h-7 w-7"><AvatarImage src={p.photoURL || undefined} /><AvatarFallback><img src={getPlaceholderImage(p.gender)} alt="" /></AvatarFallback></Avatar>
                                </button>
                           ))}
                        </ScrollArea>
                    </PopoverContent>
                </Popover>
            </div>

            <div className="p-4 bg-black/20 rounded-2xl space-y-3">
                 <h2 className="text-sm font-bold text-slate-300 text-right">תוכן נוסף למצגת</h2>
                 <div className="space-y-2">
                    {extras.map(({ key, label, icon, onClick, selected }) => (
                         <div key={key} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-800/50">
                            <div className="flex items-center gap-2 text-slate-300">
                               {icon}{label}
                            </div>
                             <Button size="sm" variant="outline" onClick={onClick} className="bg-slate-700 border-slate-600 hover:bg-slate-600 text-slate-200">
                                {selected ? <CheckCircle2 className="h-4 w-4 text-green-400 ml-2" /> : null}
                                {selected ? 'שנה בחירה' : 'בחר'}
                            </Button>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );
};


// --- Wizard Shell ---
const WizardShell = ({ children, currentStep, totalSteps, onStepChange, studentName }: { children: React.ReactNode; currentStep: number; totalSteps: number; onStepChange: (step: number) => void, studentName?: string; }) => {
  const percentage = ((currentStep) / totalSteps) * 100;
  return (
    <div className="w-full h-full flex flex-col max-w-2xl mx-auto">
       <div className="flex justify-between items-center mb-3 px-2">
         <h2 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">עבודת שורשים: {studentName}</h2>
         <p className="text-sm text-slate-400 font-medium">פרק {currentStep} מתוך {totalSteps}</p>
       </div>
       <div className="w-full bg-white/5 rounded-full h-3 mb-3 overflow-hidden border border-white/10">
            <motion.div
                className="bg-gradient-to-r from-emerald-400 to-indigo-500 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
            />
        </div>
      <GlassmorphicCard className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
            <div className="p-4 sm:p-6">
             {children}
            </div>
        </ScrollArea>
      </GlassmorphicCard>
      <div className="flex justify-between items-center mt-3">
        <MotionButton onClick={() => onStepChange(currentStep - 1)} disabled={currentStep <= 1} className="bg-white/10 backdrop-blur-md">
          ← הקודם
        </MotionButton>
        <MotionButton onClick={() => onStepChange(currentStep + 1)} disabled={currentStep > totalSteps}>
          {currentStep === totalSteps ? 'סיים ועצב 🎉' : 'הבא ←'}
        </MotionButton>
      </div>
    </div>
  );
}


// --- Main View Component ---
export function RootsView({ project, people, relationships, tree, updateProject, setProject, onEditPerson }: {
  project: RootsProject | null;
  people: Person[];
  relationships: Relationship[];
  tree: FamilyTree | null;
  updateProject: (updater: (project: RootsProject) => RootsProject) => void;
  setProject: (project: RootsProject) => void;
  onEditPerson?: (personId: string) => void;
}) {
  const { toast } = useToast();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);

  const steps = [
    { id: 0, label: 'זהות' }, // Identity
    { id: 1, label: 'שער' }, // Cover Page
    { id: 2, label: 'הסיפור שלי' }, // My Story
    { id: 3, label: 'משפחה גרעינית' }, // Nuclear Family
    { id: 4, label: 'סבא וסבתא: צד האב' },
    { id: 5, label: 'סבא וסבתא: צד האם' },
    { id: 6, label: 'סבא-רבא: צד האב' },
    { id: 7, label: 'סבא-רבא: צד האם' },
    { id: 8, label: 'מורשת: חפץ' },
    { id: 9, label: 'מורשת: מתכון' },
    { id: 10, label: 'מורשת: שם משפחה' },
    { id: 11, label: 'מורשת: היסטוריה' },
    { id: 12, label: 'סיכום' },
    { id: 13, label: 'הכנה' },
  ];

  // Debounced save logic
  const debouncedSave = useCallback(
    debounce((proj: RootsProject) => {
      setProject(proj);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 2000),
    [setProject]
  );

  const handleProjectUpdate = (path: (string | number)[], value: any) => {
    setSaveStatus('saving');
    updateProject(proj => {
        const newProject = JSON.parse(JSON.stringify(proj));
        let current = newProject.projectData;
        for (let i = 0; i < path.length - 1; i++) {
            const segment = path[i];
            if (current[segment] === undefined || typeof current[segment] !== 'object' || current[segment] === null) {
                current[segment] = {};
            }
            current = current[segment];
        }
        current[path[path.length - 1]] = value;
        debouncedSave(newProject);
        return newProject;
    });
  };
  
  const handleStepChange = (step: number) => {
    if (step > steps.length - 1) {
        setSaveStatus('saving');
        if (project) {
          setProject(project); 
        }
        setShowDesignEditor(true);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
        updateProject(proj => ({ ...proj, currentStep: step }));
    }
  };

  const handleSelectStudent = (personId: string) => {
    updateProject(proj => {
        const student = people.find(p => p.id === personId);
        const studentName = student ? `${student.firstName} ${student.lastName}` : '';
        const newProjectData = {
            ...proj.projectData,
            coverPage: {
                ...proj.projectData?.coverPage,
                studentName: studentName,
            }
        };
        return { 
            ...proj,
            studentPersonId: personId,
            projectData: newProjectData
        };
    });
  };

  const onUpdateProjectForEditor = useCallback((updater: (p: RootsProject) => RootsProject) => {
    setSaveStatus('saving');
    updateProject(updater);
    // The debounced save will be triggered by the main updateProject effect
  }, [updateProject]);

    const handleMapConfirm = (dataUrl: string) => {
        handleProjectUpdate(['finalPresentation', 'mapScreenshotUrl'], dataUrl);
        setMapModalOpen(false);
        toast({ title: 'תמונת המפה נשמרה!' });
    };

    const handleStatsConfirm = (selected: {id: string, title: string}[]) => {
        handleProjectUpdate(['finalPresentation', 'selectedStats'], selected);
        setStatsModalOpen(false);
        toast({ title: `${selected.length} גרפים נבחרו.` });
    };

    const handleCalendarConfirm = (selected: {id: string, title: string, date: string}[]) => {
        handleProjectUpdate(['finalPresentation', 'selectedEvents'], selected);
        setCalendarModalOpen(false);
        toast({ title: `${selected.length} אירועים נבחרו.` });
    };

  const student = useMemo(() => {
    if (!project) return undefined;
    return people.find(p => p.id === project.studentPersonId);
  }, [project, people]);

  const involvedPeopleIds = useMemo(() => {
    if (!project) return [];

    const projectData = project.projectData || {};
    const finalizationData = projectData.finalPresentation || {};
    
    const ids = new Set<string>();
    if (project.studentPersonId) ids.add(project.studentPersonId);
    
    const getIds = (obj: any) => {
        if (!obj) return;
        if (typeof obj === 'string' && people.some(p => p.id === obj)) {
            ids.add(obj);
        } else if (obj.personId && typeof obj.personId === 'string' && people.some(p => p.id === obj.personId)) {
            ids.add(obj.personId);
        }

        if (Array.isArray(obj)) {
            obj.forEach(v => getIds(v));
        } else if (typeof obj === 'object') {
            Object.values(obj).forEach(v => getIds(v));
        }
    };
    getIds(projectData.familyRoots);
    
    const nuclearFamily = projectData.nuclearFamily || {};
    const parentKeys = Object.keys(nuclearFamily).filter(k => k.startsWith('parent_'));
    parentKeys.forEach(key => {
        const personId = key.split('_')[1];
        if (people.some(p => p.id === personId)) ids.add(personId);
    });

    const siblingKeys = Object.keys(nuclearFamily).filter(k => k.startsWith('sibling_'));
    siblingKeys.forEach(key => {
        const personId = key.split('_')[1];
        if (people.some(p => p.id === personId)) ids.add(personId);
    });

    (finalizationData.extraPeople || []).forEach((id: string) => ids.add(id));
    return Array.from(ids);
  }, [project, people]);

  if (showDesignEditor && project) {
    return (
      <RootsDesignEditor
        project={project}
        people={people}
        relationships={relationships}
        onBack={() => setShowDesignEditor(false)}
        onUpdateProject={onUpdateProjectForEditor}
      />
    );
  }

  if (!project || !tree) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-900 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const renderStepContent = () => {
    switch (project.currentStep) {
      case 0: return <Step0_IdentitySelection people={people} onSelect={handleSelectStudent} currentStudentId={project.studentPersonId} treeOwnerId={tree.ownerPersonId} onConfirm={() => handleStepChange(1)} />;
      case 1: return <Step1_FormalInfo projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} onStudentChange={handleSelectStudent} currentStudentId={project.studentPersonId} />;
      case 2: return <Step2_MyStory projectData={project.projectData} onUpdate={handleProjectUpdate} />;
      case 3: return <Step3_NuclearFamily projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} relationships={relationships} currentStudentId={project.studentPersonId} onEditPerson={onEditPerson} />;
      case 4: return <GrandparentsStep side="paternal" projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} relationships={relationships} currentStudentId={project.studentPersonId} onEditPerson={onEditPerson} />;
      case 5: return <GrandparentsStep side="maternal" projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} relationships={relationships} currentStudentId={project.studentPersonId} onEditPerson={onEditPerson} />;
      case 6: return <GreatGrandparentsStep side="paternal" projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} relationships={relationships} currentStudentId={project.studentPersonId} onEditPerson={onEditPerson} />;
      case 7: return <GreatGrandparentsStep side="maternal" projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} relationships={relationships} currentStudentId={project.studentPersonId} onEditPerson={onEditPerson} />;
      case 8: return <HeritageStep title="חפץ משפחתי" icon={<Gem />} fieldKey="inheritedObject" placeholder="תארו חפץ שעבר במשפחה..." projectData={project.projectData} onUpdate={handleProjectUpdate} />;
      case 9: return <HeritageStep title="מתכון משפחתי" icon={<Utensils />} fieldKey="familyRecipe" placeholder="מה המנה שכולם מחכים לה..." projectData={project.projectData} onUpdate={handleProjectUpdate} />;
      case 10: return <HeritageStep title="מקור שם המשפחה" icon={<BookOpen />} fieldKey="familyNameOrigin" placeholder="מאיפה מגיע שם המשפחה..." projectData={project.projectData} onUpdate={handleProjectUpdate} />;
      case 11: return <Step11_NationalHistory projectData={project.projectData} onUpdate={handleProjectUpdate} />;
      case 12: return <HeritageStep title="סיכום ורפלקציה" icon={<Star />} fieldKey="conclusion" placeholder="מה למדתי על עצמי ועל משפחתי..." projectData={project.projectData} onUpdate={handleProjectUpdate} />;
      case 13: return <Step13_FinalTouches project={project} projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} onOpenMap={() => setMapModalOpen(true)} onOpenStats={() => setStatsModalOpen(true)} onOpenCalendar={() => setCalendarModalOpen(true)} />;
      default: return <Step0_IdentitySelection people={people} onSelect={handleSelectStudent} currentStudentId={project.studentPersonId} treeOwnerId={tree.ownerPersonId} onConfirm={() => handleStepChange(1)} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#0a0015] to-[#000d1a] text-slate-100 overflow-hidden" dir="rtl">
      <WizardBackground />
      <SaveIndicator status={saveStatus} />
      
      {mapModalOpen && 
        <MapSelectionModal 
            isOpen={mapModalOpen} 
            onClose={() => setMapModalOpen(false)} 
            people={people}
            onConfirm={handleMapConfirm}
        />}

      {statsModalOpen && 
        <StatsSelectionModal 
            isOpen={statsModalOpen} 
            onClose={() => setStatsModalOpen(false)} 
            people={people}
            relationships={relationships}
            onConfirm={handleStatsConfirm}
            initialSelected={project.projectData.finalPresentation?.selectedStats || []}
        />}

      {calendarModalOpen && 
        <CalendarSelectionModal
            isOpen={calendarModalOpen}
            onClose={() => setCalendarModalOpen(false)}
            people={people}
            relationships={relationships}
            manualEvents={project.projectData.manualEvents || []} // assuming manual events are here
            involvedPeopleIds={involvedPeopleIds}
            onConfirm={handleCalendarConfirm}
            initialSelected={project.projectData.finalPresentation?.selectedEvents || []}
        />}

      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0 max-h-[90vh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={project.currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="w-full h-full"
          >
            {project.currentStep > 0 ? (
              <WizardShell
                currentStep={project.currentStep}
                totalSteps={steps.length - 1}
                onStepChange={handleStepChange}
                studentName={student?.firstName}
              >
                {renderStepContent()}
              </WizardShell>
            ) : (
                renderStepContent()
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// EditableEventChip component moved here to be within the same file scope
const EditableEventChip = ({ event, isSelected, onToggle, onUpdate }: { 
  event: { id: string; label: string; year: string; isCustom: boolean }, 
  isSelected: boolean, 
  onToggle: (id: string) => void,
  onUpdate: (id: string, values: {label: string, year: string}) => void 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(event.label);
  const [year, setYear] = useState(event.year);

  const handleSave = () => {
    onUpdate(event.id, { label, year });
    setIsEditing(false);
  };
  
  if (isEditing) {
    return (
      <div className="flex gap-1 p-1 bg-slate-700 rounded-full">
        <Input value={label} onChange={e => setLabel(e.target.value)} className="h-6 text-xs w-28 bg-slate-800" />
        <Input value={year} onChange={e => setYear(e.target.value)} className="h-6 text-xs w-16 bg-slate-800" />
        <Button size="icon" className="h-6 w-6" onClick={handleSave}><Check className="h-4 w-4" /></Button>
      </div>
    );
  }

  return (
    <div className={cn(
        "relative group px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors",
        isSelected ? 'bg-teal-500/80 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
    )}>
      <div onClick={() => onToggle(event.id)}>
        {event.label} <span className="opacity-70">({event.year})</span>
      </div>
      {event.isCustom && (
        <button onClick={() => setIsEditing(true)} className="absolute -top-1 -right-1 h-5 w-5 bg-slate-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100">
          <Edit className="h-3 w-3" />
        </button>
      )}
    </div>
  )
};

    