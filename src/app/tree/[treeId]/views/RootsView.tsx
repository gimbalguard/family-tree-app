'use client';
import { useState, useMemo, useRef, useEffect, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootsProject, Person, FamilyTree, Relationship } from '@/lib/types';
import { format, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Check, Search, Sparkles, Star, BookOpen, Gem, Wand2, Loader2, School, User, Calendar, MapPin, Edit, Flag, Recipe, BadgeCheck, PlusCircle } from 'lucide-react';
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
                    <label className={labelClass}>מגיש/ה <User className="inline h-3 w-3 mb-0.5" /></label>
                    <StudentSelector people={people} currentStudentId={currentStudentId} onStudentChange={onStudentChange} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}>שם בית הספר <School className="inline h-3 w-3 mb-0.5" /></label>
                    <EditableField value={coverPage.schoolName || ''} onUpdate={(v) => onUpdate(['coverPage', 'schoolName'], v)} placeholder="לדוגמה: עירוני א'" isMagical={!!coverPage.schoolName} />
                </div>

                <div className={fieldContainerClass}>
                    <label className={labelClass}>עיר <MapPin className="inline h-3 w-3 mb-0.5" /></label>
                    <EditableField value={coverPage.city || ''} onUpdate={(v) => onUpdate(['coverPage', 'city'], v)} placeholder="לדוגמה: תל אביב" isMagical={!!coverPage.city} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}>כיתה <User className="inline h-3 w-3 mb-0.5" /></label>
                    <EditableField value={coverPage.grade || ''} onUpdate={(v) => onUpdate(['coverPage', 'grade'], v)} placeholder="לדוגמה: ז'3" isMagical={!!coverPage.grade} />
                </div>
                
                <div className={fieldContainerClass}>
                    <label className={labelClass}>שם המורה <User className="inline h-3 w-3 mb-0.5" /></label>
                    <EditableField value={coverPage.teacherName || ''} onUpdate={(v) => onUpdate(['coverPage', 'teacherName'], v)} placeholder="לדוגמה: ישראל ישראלי" isMagical={!!coverPage.teacherName} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}>שם המנהל/ת <User className="inline h-3 w-3 mb-0.5" /></label>
                    <EditableField value={coverPage.principalName || ''} onUpdate={(v) => onUpdate(['coverPage', 'principalName'], v)} placeholder="לדוגמה: דנה לוי" />
                </div>
                
                <div className={fieldContainerClass}>
                    <label className={labelClass}>תאריך הגשה <Calendar className="inline h-3 w-3 mb-0.5" /></label>
                    <EditableField value={coverPage.submissionDate || ''} onUpdate={(v) => onUpdate(['coverPage', 'submissionDate'], v)} placeholder="DD/MM/YYYY" />
                </div>
                 <div className={fieldContainerClass}>
                    <label className={labelClass}>שנה עברית <Flag className="inline h-3 w-3 mb-0.5" /></label>
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


// --- Step 2: My Name ---
const Step2_MyName = ({ projectData, onUpdate }: { projectData: any, onUpdate: (path: (string|number)[], value: any) => void }) => {
  const myStory = projectData.personalStory || {};
  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">השם שלי</h1>
      <p className="text-slate-400 text-sm text-center">הכל מתחיל בשם — ספר/י לנו על השם שלך</p>
      
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
    </div>
  );
};

// --- Step 3: My Story ---
const Step3_MyStory = ({ projectData, onUpdate }: { projectData: any, onUpdate: (path: (string|number)[], value: any) => void }) => {
  const myStory = projectData.personalStory || {};
  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">הסיפור שלי</h1>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between w-full">
          <AiRephraseButton value={myStory.birthStory || ''} onRephrase={(v) => onUpdate(['personalStory', 'birthStory'], v)} fieldName="סיפור הלידה שלי" />
          <label className="font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">סיפור הלידה שלי</label>
        </div>
        <EditableField asTextarea value={myStory.birthStory || ''} onUpdate={(v) => onUpdate(['personalStory', 'birthStory'], v)} placeholder="תארו את סיפור לידתכם כפי שסופר ע״י ההורים. איפה נולדתם? מה היה מיוחד?" />
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center justify-between w-full">
          <AiRephraseButton value={myStory.personalVision || ''} onRephrase={(v) => onUpdate(['personalStory', 'personalVision'], v)} fieldName="חזון אישי" />
          <label className="font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">חזון אישי — אני מאמין/ה ש...</label>
        </div>
        <EditableField asTextarea value={myStory.personalVision || ''} onUpdate={(v) => onUpdate(['personalStory', 'personalVision'], v)} placeholder="מהם הערכים שמנחים אותך? מה השאיפות שלך לעתיד?" />
      </div>

      {/* Life Events hint card */}
      <div className="mt-4 p-4 rounded-2xl bg-indigo-900/20 border border-indigo-500/20">
        <p className="text-xs text-indigo-300 text-right">
          💡 <strong>טיפ:</strong> בשלב עיצוב העבודה תוכל/י לצרף תמונות וצילומי מסך מלוח השנה המשפחתי כדי להמחיש את "תחנות החיים" שלך.
        </p>
      </div>
    </div>
  );
};


// --- Step 4: Nuclear Family ---
const Step4_NuclearFamily = ({ projectData, onUpdate, people, relationships, currentStudentId }: { 
  projectData: any, 
  onUpdate: (path: (string|number)[], value: any) => void,
  people: Person[],
  relationships: Relationship[],
  currentStudentId?: string
}) => {
  const family = projectData.nuclearFamily || {};
  
  const parents = useMemo(() => {
    if (!currentStudentId) return [];
    
    const parentRels = relationships.filter(r => 
      r.personBId === currentStudentId && 
      ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType)
    );

    const parentIds = [...new Set(parentRels.map(r => r.personAId))];
    
    return parentIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
  }, [relationships, people, currentStudentId]);
  
  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">המשפחה הגרעינית</h1>
      
      {/* Parents section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-300 text-right border-b border-white/10 pb-2">ההורים שלי</h2>
        
        {parents.length > 0 ? (
          parents.map((parent) => (
            <GlassmorphicCard key={parent.id} className="p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-3 justify-end">
                <div className="text-right">
                  <p className="font-bold text-white text-sm">{parent.firstName} {parent.lastName}</p>
                  <p className="text-xs text-slate-400">{parent.birthDate ? `נולד/ה: ${format(new Date(parent.birthDate), 'yyyy')}` : ''}{parent.birthPlace ? ` · ${parent.birthPlace}` : ''}</p>
                </div>
                <Avatar className="h-10 w-10 border-2 border-white/20">
                  <AvatarImage src={parent.photoURL || undefined} />
                  <AvatarFallback className="bg-slate-700">
                    <img src={getPlaceholderImage(parent.gender)} alt="" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <AiRephraseButton value={family[`parent_${parent.id}_bio`] || ''} onRephrase={(v) => onUpdate(['nuclearFamily', `parent_${parent.id}_bio`], v)} fieldName={`סיפור על ${parent.firstName}`} />
                  <label className="text-xs text-slate-400 block w-full text-right">ספר/י על {parent.firstName} במשפחה</label>
                </div>
                <EditableField asTextarea value={family[`parent_${parent.id}_bio`] || ''} onUpdate={(v) => onUpdate(['nuclearFamily', `parent_${parent.id}_bio`], v)} placeholder={`מי זה/זו ${parent.firstName}? מה הוא/היא עושה? מה מיוחד בו/בה?`} />
              </div>
            </GlassmorphicCard>
          ))
        ) : (
          <div className="text-center py-6 text-slate-500 text-sm bg-white/5 rounded-2xl">
            <p>לא נמצאו הורים בעץ המשפחה עבור {people.find(p => p.id === currentStudentId)?.firstName}.</p>
            <p className="text-xs mt-1">ניתן להוסיף הורים ישירות בעץ המשפחה.</p>
          </div>
        )}
        
        {/* Parents meeting story */}
        <div className="space-y-1 mt-3">
          <div className="flex items-center justify-between">
            <AiRephraseButton value={family.parentsMeetingStory || ''} onRephrase={(v) => onUpdate(['nuclearFamily', 'parentsMeetingStory'], v)} fieldName="סיפור ההיכרות של ההורים" />
            <label className="font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">סיפור ההיכרות של ההורים</label>
          </div>
          <EditableField asTextarea value={family.parentsMeetingStory || ''} onUpdate={(v) => onUpdate(['nuclearFamily', 'parentsMeetingStory'], v)} placeholder="איך הכירו ההורים שלך? מה הסיפור שלהם?" />
        </div>
      </div>

      {/* Tip card */}
      <div className="p-4 rounded-2xl bg-teal-900/20 border border-teal-500/20">
        <p className="text-xs text-teal-300 text-right">
          💡 <strong>טיפ:</strong> בשלב עיצוב העבודה תוכל/י לצרף צילום מסך מהעץ המשפחתי המציג את תמונת המשפחה הגרעינית שלך.
        </p>
      </div>
    </div>
  );
};


// --- Step 5: Family Roots ---
const AncestorCard = ({ title, person, data, onUpdate, fieldNamePrefix }: {
    title: string,
    person?: Person,
    data: any,
    onUpdate: (key: string, value: any) => void,
    fieldNamePrefix: string
}) => {
    const fields = [
        { key: 'name', label: 'שם מלא', placeholder: 'שם פרטי ושם משפחה', initialValue: person ? `${person.firstName} ${person.lastName}` : '', isTextarea: false },
        { key: 'birthYear', label: 'שנת לידה', placeholder: 'לדוגמה: 1920', initialValue: person?.birthDate?.substring(0, 4), isTextarea: false },
        { key: 'birthPlace', label: 'מקום לידה ומדינת מוצא', placeholder: 'לדוגמה: ורשה, פולין', initialValue: person?.birthPlace, isTextarea: false },
        { key: 'aliyahYear', label: 'שנת עלייה לישראל', placeholder: 'אם עלה/תה לישראל', isTextarea: false },
        { key: 'story', label: 'סיפור קצר', placeholder: 'מה אתה יודע על אותו/אותה? מה הסיפור שלהם?', isTextarea: true },
    ];

    return (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <h3 className="font-bold text-slate-200 text-right">{title}</h3>
            {fields.map(field => (
                <div key={field.key} className="space-y-1">
                    <div className="flex items-center justify-between">
                        {field.isTextarea && (
                            <AiRephraseButton 
                                value={data[`${fieldNamePrefix}_${field.key}`] ?? field.initialValue ?? ''} 
                                onRephrase={(v) => onUpdate(`${fieldNamePrefix}_${field.key}`, v)} 
                                fieldName={`${title}: ${field.label}`}
                            />
                        )}
                        <label className="text-xs text-slate-400 block text-right w-full">{field.label}</label>
                    </div>
                    <EditableField
                        asTextarea={field.isTextarea}
                        value={data[`${fieldNamePrefix}_${field.key}`] ?? field.initialValue ?? ''} 
                        onUpdate={(v) => onUpdate(`${fieldNamePrefix}_${field.key}`, v)} 
                        placeholder={field.placeholder}
                    />
                </div>
            ))}
        </div>
    );
};

const Step5_Roots = ({ projectData, onUpdate, people, relationships, currentStudentId }: {
  projectData: any,
  onUpdate: (path: (string|number)[], value: any) => void,
  people: Person[],
  relationships: Relationship[],
  currentStudentId?: string
}) => {
  const roots = projectData.familyRoots || {};
  const [activeSection, setActiveSection] = useState<string | null>('paternal');

  const ancestors = useMemo(() => {
    const findParents = (personId?: string): Person[] => {
        if (!personId) return [];
        const parentRels = relationships.filter(r => r.personBId === personId && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType));
        return parentRels.map(r => people.find(p => p.id === r.personAId)).filter(Boolean) as Person[];
    };
    
    const parents = findParents(currentStudentId);
    const father = parents.find(p => p.gender === 'male');
    const mother = parents.find(p => p.gender === 'female');
    
    const paternalGrandparents = findParents(father?.id);
    const maternalGrandparents = findParents(mother?.id);
    
    const paternalGrandfather = paternalGrandparents.find(p => p.gender === 'male');
    const paternalGrandmother = paternalGrandparents.find(p => p.gender === 'female');
    
    const maternalGrandfather = maternalGrandparents.find(p => p.gender === 'male');
    const maternalGrandmother = maternalGrandparents.find(p => p.gender === 'female');
    
    const paternalGGFs = findParents(paternalGrandfather?.id);
    const paternalGGMs = findParents(paternalGrandmother?.id);

    const maternalGGFs = findParents(maternalGrandfather?.id);
    const maternalGGMs = findParents(maternalGrandmother?.id);

    return {
      paternalGrandfather, paternalGrandmother,
      maternalGrandfather, maternalGrandmother,
      paternalGreatGrandfather: paternalGGFs.find(p => p.gender === 'male'),
      paternalGreatGrandmother: paternalGGMs.find(p => p.gender === 'female'),
      maternalGreatGrandfather: maternalGGFs.find(p => p.gender === 'male'),
      maternalGreatGrandmother: maternalGGMs.find(p => p.gender === 'female'),
    };
  }, [people, relationships, currentStudentId]);
  
  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">שורשי המשפחה</h1>
      <p className="text-slate-400 text-xs text-center">4 דורות של זיכרון משפחתי</p>
      
      <Accordion type="single" collapsible className="w-full space-y-2" value={activeSection || ''} onValueChange={setActiveSection}>
        <AccordionItem value="paternal" className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/10">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-200">סבא וסבתא מצד אבא 👴</span>
          </AccordionTrigger>
          <AccordionContent className="p-4 space-y-4 bg-black/20">
            <AncestorCard title="סבא (אבא של אבא)" person={ancestors.paternalGrandfather} data={roots} onUpdate={(k, v) => onUpdate(['familyRoots', k], v)} fieldNamePrefix="paternalGrandfather" />
            <AncestorCard title="סבתא (אמא של אבא)" person={ancestors.paternalGrandmother} data={roots} onUpdate={(k, v) => onUpdate(['familyRoots', k], v)} fieldNamePrefix="paternalGrandmother" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="maternal" className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/10">
             <span className="flex items-center gap-2 text-sm font-bold text-slate-200">סבא וסבתא מצד אמא 👵</span>
          </AccordionTrigger>
          <AccordionContent className="p-4 space-y-4 bg-black/20">
            <AncestorCard title="סבא (אבא של אמא)" person={ancestors.maternalGrandfather} data={roots} onUpdate={(k, v) => onUpdate(['familyRoots', k], v)} fieldNamePrefix="maternalGrandfather" />
            <AncestorCard title="סבתא (אמא של אמא)" person={ancestors.maternalGrandmother} data={roots} onUpdate={(k, v) => onUpdate(['familyRoots', k], v)} fieldNamePrefix="maternalGrandmother" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="paternal-gg" className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/10">
             <span className="flex items-center gap-2 text-sm font-bold text-slate-200">הורי-סבא מצד אבא 🌳</span>
          </AccordionTrigger>
          <AccordionContent className="p-4 space-y-4 bg-black/20">
            <AncestorCard title="אבא של סבא" person={ancestors.paternalGreatGrandfather} data={roots} onUpdate={(k, v) => onUpdate(['familyRoots', k], v)} fieldNamePrefix="paternalGreatGrandfather" />
            <AncestorCard title="אמא של סבתא" person={ancestors.paternalGreatGrandmother} data={roots} onUpdate={(k, v) => onUpdate(['familyRoots', k], v)} fieldNamePrefix="paternalGreatGrandmother" />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="maternal-gg" className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/10">
             <span className="flex items-center gap-2 text-sm font-bold text-slate-200">הורי-סבא מצד אמא 🌳</span>
          </AccordionTrigger>
          <AccordionContent className="p-4 space-y-4 bg-black/20">
            <AncestorCard title="אבא של סבא" person={ancestors.maternalGreatGrandfather} data={roots} onUpdate={(k, v) => onUpdate(['familyRoots', k], v)} fieldNamePrefix="maternalGreatGrandfather" />
            <AncestorCard title="אמא של סבתא" person={ancestors.maternalGreatGrandmother} data={roots} onUpdate={(k, v) => onUpdate(['familyRoots', k], v)} fieldNamePrefix="maternalGreatGrandmother" />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="p-4 rounded-2xl bg-indigo-900/20 border border-indigo-500/20">
        <p className="text-xs text-indigo-300 text-right">
          🗺️ <strong>טיפ:</strong> אם מילאת מקומות לידה מחוץ לישראל, בשלב עיצוב העבודה תוכל/י לייצא מפת הגירה משפחתית אוטומטית מתוך מודול המפות במערכת.
        </p>
      </div>
    </div>
  );
};


// --- Step 6: Heritage ---
const Step6_Heritage = ({ projectData, onUpdate }: { projectData: any, onUpdate: (path: (string|number)[], value: any) => void }) => {
  const heritage = projectData.heritage || {};
  
  const initialHistoricalEvents = [
    { id: 'independence', label: 'מלחמת העצמאות', year: '1948' },
    { id: 'sinai', label: 'מבצע סיני', year: '1956' },
    { id: 'sixdays', label: 'מלחמת ששת הימים', year: '1967' },
    { id: 'kippur', label: 'מלחמת יום הכיפורים', year: '1973' },
    { id: 'galilee', label: 'מבצע שלום הגליל', year: '1982' },
    { id: 'aliyah1', label: 'העלייה הראשונה', year: '1882' },
    { id: 'aliyah_ethiopia', label: 'עלייה מאתיופיה', year: '1984/1991' },
    { id: 'aliyah_russia', label: 'עלייה מחבר המדינות', year: '1990s' },
    { id: 'herut_habanim', label: 'מבצע חרבות ברזל', year: '2023' },
  ];

  const customEvents = heritage.customHistoricalEvents || [];
  const combinedEvents = [...initialHistoricalEvents, ...customEvents];

  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventYear, setNewEventYear] = useState('');
  const [isAddEventPopoverOpen, setIsAddEventPopoverOpen] = useState(false);

  const selectedEvents: string[] = heritage.selectedEvents || [];
  
  const toggleEvent = (eventId: string) => {
    const newSelected = selectedEvents.includes(eventId)
      ? selectedEvents.filter(e => e !== eventId)
      : [...selectedEvents, eventId];
    onUpdate(['heritage', 'selectedEvents'], newSelected);
  };
  
  const handleAddNewEvent = () => {
    if (!newEventLabel || !newEventYear) return;
    const newId = newEventLabel.toLowerCase().replace(/\s/g, '_').replace(/[^\w-]/g, '') + `_${newEventYear}`;
    const newEvent = { id: newId, label: newEventLabel, year: newEventYear };
    
    const updatedCustomEvents = [...(heritage.customHistoricalEvents || []), newEvent];
    onUpdate(['heritage', 'customHistoricalEvents'], updatedCustomEvents);
    
    toggleEvent(newId);
    
    setNewEventLabel('');
    setNewEventYear('');
    setIsAddEventPopoverOpen(false);
  };

  return (
    <div className="space-y-5" dir="rtl">
      <h1 className="text-lg font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">מורשת והיסטוריה לאומית</h1>
      
      {/* Inherited object */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <AiRephraseButton value={heritage.inheritedObject || ''} onRephrase={(v) => onUpdate(['heritage', 'inheritedObject'], v)} fieldName="חפץ עובר בירושה" />
          <label className="font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">חפץ עובר בירושה 💎</label>
        </div>
        <EditableField asTextarea value={heritage.inheritedObject || ''} onUpdate={(v) => onUpdate(['heritage', 'inheritedObject'], v)} placeholder="תארו חפץ שעבר במשפחה מדור לדור. מה הוא? מאיפה הגיע? מה הוא מסמל?" />
      </div>
      
      {/* Family recipe */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <AiRephraseButton value={heritage.familyRecipe || ''} onRephrase={(v) => onUpdate(['heritage', 'familyRecipe'], v)} fieldName="מתכון משפחתי" />
          <label className="font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">מתכון משפחתי 🍽️</label>
        </div>
        <EditableField asTextarea value={heritage.familyRecipe || ''} onUpdate={(v) => onUpdate(['heritage', 'familyRecipe'], v)} placeholder="מה המנה שכולם מחכים לה בארוחות משפחתיות? מי מכינה אותה? מה הסיפור שלה?" />
      </div>
      
      {/* Family name origin */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <AiRephraseButton value={heritage.familyNameOrigin || ''} onRephrase={(v) => onUpdate(['heritage', 'familyNameOrigin'], v)} fieldName="מקור שם המשפחה" />
          <label className="font-bold text-sm text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 block w-full text-right">מקור שם המשפחה</label>
        </div>
        <EditableField asTextarea value={heritage.familyNameOrigin || ''} onUpdate={(v) => onUpdate(['heritage', 'familyNameOrigin'], v)} placeholder="מאיפה מגיע שם המשפחה? מה משמעותו? מתי אומץ שם זה?" />
      </div>

      {/* Historical events */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-300 text-right">קשר המשפחה להיסטוריה הלאומית</h2>
        <p className="text-xs text-slate-400 text-right">סמן/י אירועים היסטוריים שמשפחתך הייתה קשורה אליהם:</p>
        <div className="flex flex-wrap gap-2 justify-start">
          {combinedEvents.map(event => (
            <button
              key={event.id}
              type="button"
              onClick={() => toggleEvent(event.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border",
                selectedEvents.includes(event.id)
                  ? "bg-indigo-500/30 border-indigo-400 text-indigo-200"
                  : "bg-white/5 border-white/10 text-slate-400 hover:border-white/30"
              )}
            >
              {event.label} ({event.year})
            </button>
          ))}
          <Popover open={isAddEventPopoverOpen} onOpenChange={setIsAddEventPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border border-dashed",
                  "border-white/30 text-slate-300 hover:bg-white/10 hover:border-white/50"
                )}
              >
                <PlusCircle className="inline ml-1 h-3 w-3" />
                הוסף אירוע
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="grid gap-4" dir="rtl">
                <div className="space-y-2 text-right">
                  <h4 className="font-medium leading-none">הוספת אירוע היסטורי</h4>
                  <p className="text-sm text-muted-foreground">
                    האירוע יתווסף לרשימה עבור פרויקט זה.
                  </p>
                </div>
                <div className="grid gap-2 text-right">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="evt-label">שם האירוע</Label>
                    <Input
                      id="evt-label"
                      value={newEventLabel}
                      onChange={(e) => setNewEventLabel(e.target.value)}
                      className="col-span-2 h-8"
                    />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="evt-year">שנה</Label>
                    <Input
                      id="evt-year"
                      value={newEventYear}
                      onChange={(e) => setNewEventYear(e.target.value)}
                      className="col-span-2 h-8"
                    />
                  </div>
                </div>
                <Button onClick={handleAddNewEvent}>שמור והוסף</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        
        {/* Text fields for selected events */}
        {selectedEvents.map(eventId => {
          const event = combinedEvents.find(e => e.id === eventId);
          if (!event) return null;
          return (
            <div key={eventId} className="space-y-1">
              <div className="flex items-center justify-between">
                <AiRephraseButton value={heritage[`event_${eventId}`] || ''} onRephrase={(v) => onUpdate(['heritage', `event_${eventId}`], v)} fieldName={event.label} />
                <label className="text-xs text-slate-300 block w-full text-right">הקשר של משפחתי ל{event.label}:</label>
              </div>
              <EditableField asTextarea value={heritage[`event_${eventId}`] || ''} onUpdate={(v) => onUpdate(['heritage', `event_${eventId}`], v)} placeholder={`ספר/י על הקשר של משפחתך ל${event.label}...`} />
            </div>
          );
        })}
      </div>

      {/* Final completion card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900/40 to-violet-900/40 border border-indigo-500/30 text-center">
        <p className="text-sm text-slate-200 font-bold">🎉 כמעט סיימת!</p>
        <p className="text-xs text-slate-400 mt-1">לאחר השמירה, כל המידע יהיה מוכן לייצוא לעיצוב הסופי של העבודה.</p>
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
        <MotionButton onClick={() => onStepChange(currentStep + 1)} disabled={currentStep >= totalSteps}>
          {currentStep === totalSteps ? 'סיים ושמור 🎉' : 'הבא ←'}
        </MotionButton>
      </div>
    </div>
  );
}


// --- Main View Component ---
export function RootsView({ project, people, relationships, tree, updateProject, setProject }: {
  project: RootsProject | null;
  people: Person[];
  relationships: Relationship[];
  tree: FamilyTree | null;
  updateProject: (updater: (project: RootsProject) => RootsProject) => void;
  setProject: (project: RootsProject) => void;
}) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const steps = [
    { id: 0, label: 'זהות' },
    { id: 1, label: 'שער' },
    { id: 2, label: 'השם שלי' },
    { id: 3, label: 'הסיפור שלי' },
    { id: 4, label: 'משפחה גרעינית' },
    { id: 5, label: 'שורשים' },
    { id: 6, label: 'מורשת' },
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
    updateProject(proj => ({ ...proj, currentStep: step }));
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
                studentPersonId: personId,
            }
        };
        return { 
            ...proj,
            studentPersonId: personId,
            projectData: newProjectData
        };
    });
  };

  if (!project || !tree) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gray-900 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const student = people.find(p => p.id === project.studentPersonId);

  const renderStepContent = () => {
    switch (project.currentStep) {
      case 0: return <Step0_IdentitySelection people={people} onSelect={handleSelectStudent} currentStudentId={project.studentPersonId} treeOwnerId={tree.ownerPersonId} onConfirm={() => handleStepChange(1)} />;
      case 1: return <Step1_FormalInfo projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} onStudentChange={handleSelectStudent} currentStudentId={project.studentPersonId} />;
      case 2: return <Step2_MyName projectData={project.projectData} onUpdate={handleProjectUpdate} />;
      case 3: return <Step3_MyStory projectData={project.projectData} onUpdate={handleProjectUpdate} />;
      case 4: return <Step4_NuclearFamily projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} relationships={relationships} currentStudentId={project.studentPersonId} />;
      case 5: return <Step5_Roots projectData={project.projectData} onUpdate={handleProjectUpdate} people={people} relationships={relationships} currentStudentId={project.studentPersonId} />;
      case 6: return <Step6_Heritage projectData={project.projectData} onUpdate={handleProjectUpdate} />;
      default: return <Step0_IdentitySelection people={people} onSelect={handleSelectStudent} currentStudentId={project.studentPersonId} treeOwnerId={tree.ownerPersonId} onConfirm={() => handleStepChange(1)} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-[#0a0015] to-[#000d1a] text-slate-100 overflow-hidden" dir="rtl">
      <WizardBackground />
      <SaveIndicator status={saveStatus} />

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
