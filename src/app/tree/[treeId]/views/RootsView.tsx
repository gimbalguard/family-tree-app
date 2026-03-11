
'use client';
import { useState, useMemo, useRef, useEffect, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useFirestore } from '@/firebase';
import type { RootsProject, Person, FamilyTree, Relationship } from '@/lib/types';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Check, Search, Sparkles, Wand2, Star, BadgeCheck, School, User, Calendar, MapPin, Edit, Flag, BookOpen, Recipe, Gem } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

export interface RootsProjectData {
  [key: string]: any;
}

type RootsViewProps = {
    project: RootsProject | null;
    people: Person[];
    relationships: Relationship[];
    tree: FamilyTree | null;
    onProjectChange: (path: (string|number)[], value: any) => void;
    onStepChange: (step: number) => void;
};


// ─── Shared UI Components ───────────────────────────────────────────────────

const WizardCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'w-full max-w-4xl mx-auto bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_20px_60px_-15px_rgba(79,70,229,0.3)] rounded-[2.5rem] p-10',
      className
    )}
    {...props}
  />
));
WizardCard.displayName = "WizardCard";

const GradientHeading = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <h1 className={cn("text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600", className)}>
        {children}
    </h1>
);

const MotionButton = motion(forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(({ className, ...props }, ref) => (
  <motion.button ref={ref} className={cn("bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed", className)} {...props} whileHover={{ translateY: -2 }} whileTap={{ scale: 0.95 }}/>
)));
MotionButton.displayName = "MotionButton";

const EditableField = ({ value, onUpdate, placeholder, isMagical, className, asTextarea }: { value: string, onUpdate: (newValue: string) => void, placeholder?: string, isMagical?: boolean, className?: string, asTextarea?: boolean }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleBlur = () => {
        if (ref.current && ref.current.textContent !== value) {
            onUpdate(ref.current.textContent || '');
        }
    };

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
        if (!e.currentTarget.textContent && placeholder) {
            // This logic is tricky with contentEditable. We will hide placeholder via parent state.
        }
    }
    
    return (
        <div className="relative">
            <motion.div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                onBlur={handleBlur}
                onInput={handleInput}
                dangerouslySetInnerHTML={{ __html: localValue || '' }}
                className={cn(
                    "w-full bg-gray-50/50 border-2 border-indigo-100 rounded-2xl p-4 text-lg focus:bg-white focus:border-indigo-500 transition-all duration-300 shadow-inner",
                    "outline-none focus:ring-4 focus:ring-indigo-500/20",
                    asTextarea ? "min-h-[120px]" : "min-h-[68px]",
                    className
                )}
                whileFocus={{ scale: 1.02 }}
            />
            {(!localValue && placeholder) && (
                <span className={cn("absolute right-4 text-muted-foreground/50 pointer-events-none z-0", asTextarea ? "top-4" : "top-1/2 -translate-y-1/2")}>
                    {placeholder}
                </span>
            )}
             {isMagical && (
                <Sparkles className="absolute top-3 left-3 h-5 w-5 text-blue-400 z-20" />
            )}
        </div>
    );
};

const ProgressBar = ({ currentStep, totalSteps }: { currentStep: number, totalSteps: number }) => {
    const percentage = ((currentStep) / (totalSteps - 1)) * 100;
    return (
        <div className="w-full bg-gray-200/50 rounded-full h-3 backdrop-blur-sm border border-white/10 overflow-hidden">
            <motion.div 
                className="bg-gradient-to-r from-emerald-400 to-indigo-500 h-full"
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
            />
        </div>
    )
}

// ─── Wizard Steps ─────────────────────────────────────────────────────────────

const Step0_IdentitySelection = ({ people, onSelect, currentStudentId, treeOwnerId, onContinue }: { people: Person[], onSelect: (personId: string) => void, currentStudentId?: string, treeOwnerId?: string, onContinue: () => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedId, setSelectedId] = useState(currentStudentId);

    useEffect(() => {
        // If there's a tree owner and no student is selected yet, pre-select the owner.
        if (treeOwnerId && !currentStudentId) {
            setSelectedId(treeOwnerId);
            onSelect(treeOwnerId);
        } else {
            setSelectedId(currentStudentId);
        }
    }, [currentStudentId, treeOwnerId, onSelect]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        onSelect(id);
    };
    
    const filteredPeople = useMemo(() => people.filter(p => 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    ), [people, searchTerm]);

    return (
      <WizardCard className="text-center">
          <GradientHeading>מי אני?</GradientHeading>
          <p className="text-muted-foreground mt-2 mb-6">בחר את עצמך מהרשימה כדי להתחיל את עבודת השורשים.</p>
          <div className="relative mb-4">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                  placeholder="חיפוש..."
                  className="w-full max-w-sm mx-auto pr-10 bg-gray-50/50 border-2 border-indigo-100 rounded-2xl p-4 text-lg focus:bg-white focus:border-indigo-500 transition-all duration-300 shadow-inner"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
          <ScrollArea className="h-72">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                  {filteredPeople.map(person => {
                      const isSelected = person.id === selectedId;
                      const isOwner = person.id === treeOwnerId;
                      return (
                          <motion.button
                              key={person.id}
                              onClick={() => handleSelect(person.id)}
                              className={cn(
                                  "relative text-right p-3 border-2 rounded-2xl flex items-center gap-3 transition-all duration-200",
                                  isSelected ? "bg-indigo-100 border-indigo-500 shadow-lg" : "bg-white/50 border-transparent hover:border-indigo-300"
                              )}
                              whileHover={{ y: -3 }}
                              whileTap={{ scale: 0.98 }}
                          >
                              {isOwner && <BadgeCheck className="absolute top-2 left-2 h-5 w-5 text-indigo-500" title="This is you in the tree settings" />}
                              {isSelected && <div className="absolute top-2 left-2 h-5 w-5 text-white bg-indigo-500 rounded-full flex items-center justify-center"><Check className="h-3 w-3" /></div>}
                              <Avatar className="h-12 w-12 border-2 border-white">
                                  <AvatarImage src={person.photoURL || undefined} />
                                  <AvatarFallback>
                                      <img src={getPlaceholderImage(person.gender)} alt="avatar" />
                                  </AvatarFallback>
                              </Avatar>
                              <div>
                                  <p className="font-bold">{person.firstName} {person.lastName}</p>
                                  <p className="text-xs text-muted-foreground">{person.birthDate ? format(new Date(person.birthDate), 'yyyy') : 'שנת לידה לא ידועה'}</p>
                              </div>
                          </motion.button>
                      )
                  })}
              </div>
          </ScrollArea>
          <MotionButton 
            className="mt-6" 
            disabled={!selectedId}
            onClick={onContinue}
          >
              המשך
          </MotionButton>
      </WizardCard>
  );
};


const Step1_FormalInfo = ({ projectData, onProjectChange }: { projectData: RootsProjectData, onProjectChange: (path: (string|number)[], value: any) => void }) => {
    const coverPage = projectData.coverPage || {};
    const fieldContainerClass = "space-y-2 text-right";
    const labelClass = "font-semibold text-gray-600 px-2 flex items-center gap-2";

    return (
        <div className="space-y-6">
            <GradientHeading className="text-center mb-10">שער העבודה</GradientHeading>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div className={fieldContainerClass}><label className={labelClass}><User/> מגיש/ה:</label><EditableField value={coverPage.studentName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'studentName'], newValue)} placeholder="[שם התלמיד/ה]" isMagical={!!coverPage.studentName} /></div>
                <div className={fieldContainerClass}><label className={labelClass}><School/> בית ספר:</label><EditableField value={coverPage.schoolName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'schoolName'], newValue)} placeholder="[שם בית הספר]" /></div>
                <div className={fieldContainerClass}><label className={labelClass}><School/> כיתה:</label><EditableField value={coverPage.className || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'className'], newValue)} placeholder="[כיתה]" /></div>
                <div className={fieldContainerClass}><label className={labelClass}><User/> מורה:</label><EditableField value={coverPage.teacherName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'teacherName'], newValue)} placeholder="[שם המורה]" /></div>
                <div className={fieldContainerClass}><label className={labelClass}><User/> שם המנהל/ת:</label><EditableField value={coverPage.principalName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'principalName'], newValue)} placeholder="[שם המנהל/ת]" /></div>
                <div className={fieldContainerClass}><label className={labelClass}><Calendar/> תאריך הגשה:</label><EditableField value={coverPage.submissionDate || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'submissionDate'], newValue)} placeholder="[תאריך הגשה]" /></div>
            </div>
        </div>
    );
};

const Step2_MyStory = ({ projectData, onProjectChange, student }: { projectData: RootsProjectData, onProjectChange: (path: (string|number)[], value: any) => void, student?: Person }) => {
    const myStory = projectData.myStory || {};
    const fieldContainerClass = "space-y-2 text-right";
    const labelClass = "font-bold text-xl text-indigo-700 flex items-center justify-end gap-2";
    return (
        <div className="space-y-12">
             <GradientHeading className="text-center mb-10">הסיפור האישי שלי</GradientHeading>
             <div className="space-y-8">
                <div className={fieldContainerClass}><label className={labelClass}><Wand2/> משמעות השם שלי</label><EditableField asTextarea value={myStory.nameMeaning || ''} onUpdate={(newValue) => onProjectChange(['myStory', 'nameMeaning'], newValue)} placeholder="כתוב/י כאן על משמעות שמך..." isMagical={!!student?.firstName} /></div>
                <div className={fieldContainerClass}><label className={labelClass}><Star/> סיפור הלידה שלי</label><EditableField asTextarea value={myStory.birthStory || ''} onUpdate={(newValue) => onProjectChange(['myStory', 'birthStory'], newValue)} placeholder="תאר/י את סיפור לידתך, כפי שסופר לך..." isMagical={!!student?.birthDate}/></div>
             </div>
        </div>
    );
};

// ─── Main View Component ──────────────────────────────────────────────────────

export function RootsView({ project, people, relationships, tree, onProjectChange, onStepChange }: RootsViewProps) {
    if (!project || !tree) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-gray-100 text-muted-foreground">טוען פרויקט שורשים...</div>
        );
    }
    
    const WIZARD_STEPS = useMemo(() => [
        { id: 0, label: 'בחירת זהות' }, { id: 1, label: 'שער' }, { id: 2, label: 'הסיפור שלי' },
        { id: 3, label: 'המשפחה הגרעינית' }, { id: 4, label: 'שורשים' },
        { id: 5, label: 'מורשת וסמלים' }, { id: 6, label: 'סיכום' },
    ], []);

    const handleSelectStudent = (personId: string) => {
        onProjectChange(['studentPersonId'], personId);
        const student = people.find(p => p.id === personId);
        if (student) {
            onProjectChange(['coverPage', 'studentName'], `${student.firstName} ${student.lastName}`);
        }
    };
    
    const handleContinueFromIdentity = () => {
        if (project.studentPersonId) {
            onStepChange(1);
        }
    };

    const renderStepContent = () => {
        const student = people.find(p => p.id === project.studentPersonId);
        switch (project.currentStep) {
            case 0: return <Step0_IdentitySelection people={people} onSelect={handleSelectStudent} currentStudentId={project.studentPersonId} treeOwnerId={tree.ownerPersonId} onContinue={handleContinueFromIdentity}/>;
            case 1: return <Step1_FormalInfo projectData={project.projectData} onProjectChange={onProjectChange} />;
            case 2: return <Step2_MyStory projectData={project.projectData} onProjectChange={onProjectChange} student={student} />;
            default: return <div className="text-center p-8"><h2 className="text-2xl font-bold">פרק בבנייה</h2><p className="text-muted-foreground mt-2">הפרק הזה עדיין בפיתוח ויגיע בקרוב!</p></div>;
        }
    };

    const isIdentityStep = project.currentStep === 0;

    return (
        <div className="w-full h-full flex flex-col p-4 sm:p-8 bg-gradient-to-br from-indigo-50 via-white to-violet-50" dir="rtl">
            <div className="flex-1 flex items-center justify-center overflow-y-auto">
                 <AnimatePresence mode="wait">
                    <motion.div
                        key={project.currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                        className="w-full"
                    >
                        {isIdentityStep ? (
                             <Step0_IdentitySelection people={people} onSelect={handleSelectStudent} currentStudentId={project.studentPersonId} treeOwnerId={tree.ownerPersonId} onContinue={handleContinueFromIdentity}/>
                        ) : (
                            <WizardCard>
                                {renderStepContent()}
                            </WizardCard>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
            
            {!isIdentityStep && (
                <div className="flex flex-col items-center gap-4 pt-6 mt-6 border-t-2 border-indigo-100 max-w-4xl mx-auto w-full">
                    <div className="w-full">
                       <ProgressBar currentStep={project.currentStep} totalSteps={WIZARD_STEPS.length} />
                    </div>
                    <div className="flex justify-between items-center w-full">
                        <MotionButton onClick={() => onStepChange(project.currentStep - 1)} disabled={project.currentStep <= 1}>
                            הקודם
                        </MotionButton>
                        <p className="text-sm text-muted-foreground font-medium">פרק {project.currentStep} מתוך {WIZARD_STEPS.length - 1}</p>
                        <MotionButton onClick={() => onStepChange(project.currentStep + 1)} disabled={project.currentStep >= WIZARD_STEPS.length - 1}>
                            הבא
                        </MotionButton>
                    </div>
                </div>
            )}
        </div>
    );
}
