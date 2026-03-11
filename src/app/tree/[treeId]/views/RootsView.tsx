'use client';
import { useState, useMemo, useRef, useEffect, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RootsProject, Person, FamilyTree, Relationship } from '@/lib/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Check, Search, Sparkles, Star, BookOpen, Gem, Wand2, Loader2, School, User, Calendar, MapPin, Edit, Flag, Recipe, BadgeCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

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
        "w-full bg-gray-50/50 border-2 border-indigo-100 rounded-2xl p-4 text-base text-right placeholder:text-right focus:bg-white focus:border-indigo-500 transition-all duration-300 shadow-inner focus:outline-none focus:ring-4 focus:ring-indigo-500/30",
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
                    className={cn(commonProps.className, "min-h-[90px] resize-y")}
                />
            ) : (
                <input
                    ref={ref as React.ForwardedRef<HTMLInputElement>}
                    {...commonProps}
                    className={cn(commonProps.className, "h-[48px]")}
                />
            )}
        </motion.div>
        {isMagical && (
            <Sparkles className="absolute top-1/2 -translate-y-1/2 right-4 h-5 w-5 text-teal-400 z-10 pointer-events-none" />
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
    }, []);

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

// --- Step 1: Formal Info ---
const Step1_FormalInfo = ({ projectData, onUpdate }: { projectData: any, onUpdate: (path: (string|number)[], value: any) => void }) => {
    const coverPage = projectData.coverPage || {};
    const fieldContainerClass = "space-y-2";
    const labelClass = "font-semibold text-slate-300 px-2 flex items-center justify-end gap-2 text-sm";
    const currentYear = new Date().getFullYear();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">מעטפת רשמית</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className={fieldContainerClass}>
                    <label className={labelClass}><User /> מגיש/ה</label>
                    <div className="h-[48px] flex items-center justify-end px-4 rounded-2xl bg-black/20 text-slate-300 text-base">
                        <BadgeCheck className="ml-2 text-teal-400" />
                        {coverPage.studentName || '[שם התלמיד/ה]'}
                    </div>
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}><School/> שם בית הספר</label>
                    <EditableField value={coverPage.schoolName || ''} onUpdate={(v) => onUpdate(['coverPage', 'schoolName'], v)} placeholder="לדוגמה: עירוני א'" isMagical={!!coverPage.schoolName} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}><MapPin/> עיר</label>
                    <EditableField value={coverPage.city || ''} onUpdate={(v) => onUpdate(['coverPage', 'city'], v)} placeholder="לדוגמה: תל אביב" isMagical={!!coverPage.city} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}><User/> כיתה</label>
                    <EditableField value={coverPage.grade || ''} onUpdate={(v) => onUpdate(['coverPage', 'grade'], v)} placeholder="לדוגמה: ז'3" isMagical={!!coverPage.grade} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}><User/> שם המורה</label>
                    <EditableField value={coverPage.teacherName || ''} onUpdate={(v) => onUpdate(['coverPage', 'teacherName'], v)} placeholder="לדוגמה: ישראל ישראלי" isMagical={!!coverPage.teacherName} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}><User/> שם המנהל/ת</label>
                    <EditableField value={coverPage.principalName || ''} onUpdate={(v) => onUpdate(['coverPage', 'principalName'], v)} placeholder="לדוגמה: דנה לוי" />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}><Calendar/> תאריך הגשה</label>
                    <EditableField value={coverPage.submissionDate || ''} onUpdate={(v) => onUpdate(['coverPage', 'submissionDate'], v)} placeholder="DD/MM/YYYY" />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}><Flag/> שנה עברית</label>
                    <EditableField value={coverPage.hebrewYear || ''} onUpdate={(v) => onUpdate(['coverPage', 'hebrewYear'], v)} placeholder="לדוגמה: תשפ''ה" isMagical={!!coverPage.hebrewYear} />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}><Flag/> שנה לועזית</label>
                    <EditableField value={coverPage.gregorianYear || currentYear.toString()} onUpdate={(v) => onUpdate(['coverPage', 'gregorianYear'], v)} placeholder={currentYear.toString()} isMagical={true} />
                </div>
            </div>
        </div>
    );
};

// --- Step 2: Personal Story ---
const Step2_PersonalStory = ({ projectData, onUpdate }: { projectData: any, onUpdate: (path: (string|number)[], value: any) => void }) => {
    const myStory = projectData.personalStory || {};
    const fieldContainerClass = "space-y-3";
    const labelClass = "font-bold text-base text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400 flex items-center justify-end gap-3";

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-teal-400">הסיפור האישי שלי</h1>
            <div className="space-y-6">
                <div className={fieldContainerClass}>
                    <label className={labelClass}><Wand2/> משמעות שמי</label>
                    <EditableField asTextarea value={myStory.nameMeaning || ''} onUpdate={(v) => onUpdate(['personalStory', 'nameMeaning'], v)} placeholder="ספרו על מקור השם שלכם, מה הוא מסמל עבורכם, והאם יש לו סיפור מיוחד במשפחה..." />
                </div>
                 <div className={fieldContainerClass}>
                    <label className={labelClass}><Gem/> מי בחר את שמי ומדוע</label>
                    <EditableField asTextarea value={myStory.nameChoiceStory || ''} onUpdate={(v) => onUpdate(['personalStory', 'nameChoiceStory'], v)} placeholder="מי החליט על השם הזה? האם זה על שם מישהו? מה היה הסיפור מאחורי הבחירה?" />
                </div>
                <div className={fieldContainerClass}>
                    <label className={labelClass}><Star/> סיפור הלידה שלי</label>
                    <EditableField asTextarea value={myStory.birthStory || ''} onUpdate={(v) => onUpdate(['personalStory', 'birthStory'], v)} placeholder="תארו את סיפור לידתכם כפי שסופר לכם על ידי ההורים. איפה נולדתם? האם היו אירועים מיוחדים?" />
                </div>
                 <div className={fieldContainerClass}>
                    <label className={labelClass}><BookOpen/> חזון אישי</label>
                    <EditableField asTextarea value={myStory.personalVision || ''} onUpdate={(v) => onUpdate(['personalStory', 'personalVision'], v)} placeholder="אני מאמין/ה ש... מהם הערכים שמובילים אתכם? מה השאיפות שלכם לעתיד?" />
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
       <div className="flex justify-between items-center mb-4 px-2">
         <h2 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">עבודת שורשים: {studentName}</h2>
         <p className="text-sm text-slate-400 font-medium">פרק {currentStep} מתוך {totalSteps}</p>
       </div>
       <div className="w-full bg-white/5 rounded-full h-3 mb-6 overflow-hidden border border-white/10">
            <motion.div
                className="bg-gradient-to-r from-emerald-400 to-indigo-500 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
            />
        </div>
      <GlassmorphicCard className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1">
            <div className="p-8 sm:p-10">
             {children}
            </div>
        </ScrollArea>
      </GlassmorphicCard>
      <div className="flex justify-between items-center mt-6">
        <MotionButton onClick={() => onStepChange(currentStep - 1)} disabled={currentStep <= 1} className="bg-white/10 backdrop-blur-md">
          ← הקודם
        </MotionButton>
        <MotionButton onClick={() => onStepChange(currentStep + 1)} disabled={currentStep >= totalSteps}>
          הבא ←
        </MotionButton>
      </div>
    </div>
  );
}


// --- Main View Component ---
export function RootsView({ project, people, relationships, tree, updateProject }: {
  project: RootsProject | null;
  people: Person[];
  relationships: Relationship[];
  tree: FamilyTree | null;
  updateProject: (updater: (project: RootsProject) => RootsProject) => void;
}) {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Debounced save logic
  const debouncedSave = useCallback(
    debounce((proj: RootsProject) => {
      updateProject(() => proj);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 2000),
    [updateProject]
  );

  const handleProjectUpdate = (path: (string | number)[], value: any) => {
    setSaveStatus('saving');
    // This is a safe deep copy method
    const newProject = JSON.parse(JSON.stringify(project));
    let current = newProject.projectData;
    for (let i = 0; i < path.length - 1; i++) {
        const segment = path[i];
        if (current[segment] === undefined || typeof current[segment] !== 'object') {
            current[segment] = {};
        }
        current = current[segment];
    }
    current[path[path.length - 1]] = value;

    updateProject(() => newProject); // Optimistic update
    debouncedSave(newProject);
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
                  studentName: studentName
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

  const steps = [
    { id: 0, label: 'זהות' },
    { id: 1, label: 'שער' },
    { id: 2, label: 'הסיפור שלי' },
    { id: 3, label: 'משפחה גרעינית' },
    { id: 4, label: 'שורשים' },
    { id: 5, label: 'מורשת' },
  ];

  const student = people.find(p => p.id === project.studentPersonId);

  const renderStepContent = () => {
    switch (project.currentStep) {
        case 0:
            return <Step0_IdentitySelection
                people={people}
                onSelect={handleSelectStudent}
                currentStudentId={project.studentPersonId}
                treeOwnerId={tree.ownerPersonId}
                onConfirm={() => handleStepChange(1)}
            />;
        case 1: return <Step1_FormalInfo projectData={project.projectData} onUpdate={handleProjectUpdate} />;
        case 2: return <Step2_PersonalStory projectData={project.projectData} onUpdate={handleProjectUpdate} />;
        case 3: return <p className='text-center p-10'>שלב 3 בבנייה</p>;
        case 4: return <p className='text-center p-10'>שלב 4 בבנייה</p>;
        case 5: return <p className='text-center p-10'>שלב 5 בבנייה</p>;
        default:
            return <Step0_IdentitySelection
                people={people}
                onSelect={handleSelectStudent}
                currentStudentId={project.studentPersonId}
                treeOwnerId={tree.ownerPersonId}
                onConfirm={() => handleStepChange(1)}
            />;
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
