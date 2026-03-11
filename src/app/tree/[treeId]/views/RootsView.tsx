'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { RootsProject, Person, FamilyTree } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS } from '../roots-config';
import { Check, ChevronsUpDown, User, School, BookOpen, Users, Milestone } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

// Define the shape of the project data
export interface RootsProjectData {
  studentPersonId?: string;
  projectName?: string;
  coverPage?: {
    title?: string;
    studentName?: string;
    teacherName?: string;
    submissionDate?: string;
    schoolName?: string;
    className?: string;
    principalName?: string;
    hebrewYear?: string;
    gregorianYear?: string;
  };
  myStory?: {
    nameMeaning?: string;
    birthStory?: string;
    hobbies?: string;
  };
  // Add other steps data structure later
  [key: string]: any;
}

type RootsViewProps = {
    project: RootsProject | null;
    people: Person[];
    relationships: Relationship[];
    tree: FamilyTree | null;
    onProjectChange: (path: (string | number)[], value: any) => void;
    onStepChange: (step: number) => void;
};

// Reusable Editable Field Component - Enhanced for high-end look
const EditableField = ({ value, onUpdate, placeholder, multiline = false, className, as = 'div' }: { value: string; onUpdate: (newValue: string) => void; placeholder: string; multiline?: boolean, className?: string; as?: 'div' | 'h1' }) => {
    const ref = useRef<HTMLDivElement>(null);
    const isPlaceholder = !value;
    const Comp = as;

    useEffect(() => {
        if (ref.current && ref.current.textContent !== value) {
            ref.current.textContent = value;
        }
    }, [value]);
    
    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      onUpdate(e.currentTarget.textContent || '');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLDivElement).blur();
        }
    };
  
    return (
      <Comp
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "px-2 py-1 rounded-md min-h-[30px] inline-block w-full text-right",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-primary/10 transition-all focus:scale-[1.02] origin-right",
          isPlaceholder ? "text-muted-foreground/60 italic" : "text-foreground/90",
          multiline && "min-h-[100px] whitespace-pre-wrap",
          className
        )}
      >
        {isPlaceholder ? placeholder : value}
      </Comp>
    );
};

// Step 0: Identity Selection
const Step0_Identity = ({ people, tree, onSelect }: { people: Person[], tree: FamilyTree | null, onSelect: (personId: string) => void }) => {
    const [open, setOpen] = useState(false);
    const initialOwnerId = tree?.ownerPersonId || '';
    const validInitialOwner = people.find(p => p.id === initialOwnerId);
    const [value, setValue] = useState(validInitialOwner ? initialOwnerId : '');
    const [searchTerm, setSearchTerm] = useState("");

    const filteredPeople = useMemo(() => {
        if (!searchTerm) return people;
        return people.filter(person =>
            `${person.firstName} ${person.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [people, searchTerm]);

    const selectedPerson = people.find(p => p.id === value);

    useEffect(() => {
        if (!open) setSearchTerm("");
    }, [open]);

    return (
        <Card className="max-w-md mx-auto text-center shadow-2xl rounded-3xl p-8 bg-card/80 backdrop-blur-sm border-white/20">
            <User className="mx-auto h-16 w-16 text-primary mb-4"/>
            <h2 className="text-3xl font-bold mb-4">מי אני בעץ?</h2>
            <p className="text-muted-foreground mb-6">בחירת זהותך תקבע את נקודת המבט של עבודת השורשים.</p>
            <div className="relative">
                <Input
                    placeholder="חפש אדם..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-12 text-lg text-center bg-background/50 mb-2"
                />
                <ScrollArea className="h-60 border rounded-lg">
                    {filteredPeople.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">לא נמצא אדם.</div>
                    ) : (
                       filteredPeople.map(person => (
                            <button
                                key={person.id}
                                className={cn(
                                    "w-full text-right h-auto py-2 px-3 flex items-center gap-3 transition-colors",
                                    value === person.id ? "bg-primary/20" : "hover:bg-muted/50"
                                )}
                                onClick={() => setValue(person.id)}
                            >
                                <Avatar className="h-10 w-10 border-2 border-white">
                                    <AvatarImage src={person.photoURL || undefined} />
                                    <AvatarFallback><img src={getPlaceholderImage(person.gender)} alt="avatar"/></AvatarFallback>
                                </Avatar>
                                <span className="font-semibold">{person.firstName} {person.lastName}</span>
                                {value === person.id && <Check className="h-5 w-5 text-primary mr-auto" />}
                            </button>
                        ))
                    )}
                </ScrollArea>
            </div>
            <Button size="lg" className="w-full mt-6 text-lg" onClick={() => onSelect(value)} disabled={!value}>המשך</Button>
        </Card>
    );
};

// Step 1: Formal Info
const Step1_FormalInfo = ({ projectData, onProjectChange }: { projectData: RootsProjectData, onProjectChange: (path: (string|number)[], value: any) => void }) => {
    const { coverPage = {} } = projectData;

    return (
        <div className="space-y-6">
             <div className="p-8 border-4 border-gray-700 bg-white text-black text-center flex flex-col justify-between items-center font-serif min-h-[600px] shadow-2xl">
                <div>
                  <EditableField as="h1" value={coverPage.title || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'title'], newValue)} placeholder={projectData.projectName || 'שם הפרויקט'} className="font-bold text-5xl mb-16" />
                </div>
                <div className="space-y-6 text-2xl">
                    <div className="flex items-center gap-2"><span>מגיש/ה:</span><EditableField value={coverPage.studentName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'studentName'], newValue)} placeholder="[שם התלמיד/ה]" className="text-2xl font-semibold"/></div>
                    <div className="flex items-center gap-2"><span>בית ספר:</span><EditableField value={coverPage.schoolName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'schoolName'], newValue)} placeholder="[שם בית הספר]" className="text-2xl"/></div>
                    <div className="flex items-center gap-2"><span>כיתה:</span><EditableField value={coverPage.className || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'className'], newValue)} placeholder="[כיתה]" className="text-2xl"/></div>
                    <div className="flex items-center gap-2"><span>מורה:</span><EditableField value={coverPage.teacherName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'teacherName'], newValue)} placeholder="[שם המורה]" className="text-2xl"/></div>
                </div>
                 <div className="w-full">
                    <div className="flex justify-between w-full mt-16 text-lg">
                       <EditableField value={coverPage.submissionDate || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'submissionDate'], newValue)} placeholder="[תאריך הגשה]" className="text-lg"/>
                       <EditableField value={coverPage.hebrewYear || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'hebrewYear'], newValue)} placeholder="[שנה עברית]" className="text-lg"/>
                    </div>
                 </div>
            </div>
        </div>
    );
};

// Step 2: My Story
const Step2_MyStory = ({ projectData, onProjectChange }: { projectData: RootsProjectData, onProjectChange: (path: (string|number)[], value: any) => void }) => {
    const { myStory = {} } = projectData;

    return (
        <div className="space-y-8">
            <div className="text-center">
                <BookOpen className="mx-auto h-12 w-12 text-primary mb-2"/>
                <h2 className="text-3xl font-bold">הסיפור האישי שלי</h2>
                <p className="text-muted-foreground mt-1">כאן המקום לספר על עצמך</p>
            </div>
            <div className="space-y-6">
                <div>
                    <label className="text-lg font-semibold block text-right mb-1">מה משמעות השם שלי?</label>
                    <EditableField multiline value={myStory.nameMeaning || ''} onUpdate={(v) => onProjectChange(['myStory', 'nameMeaning'], v)} placeholder="מי בחר את השם? האם יש לו משמעות מיוחדת?..." className="bg-background"/>
                </div>
                 <div>
                    <label className="text-lg font-semibold block text-right mb-1">סיפור הלידה שלי</label>
                    <EditableField multiline value={myStory.birthStory || ''} onUpdate={(v) => onProjectChange(['myStory', 'birthStory'], v)} placeholder="ספר/י על היום שנולדת, איפה זה קרה, וסיפורים מיוחדים מההורים." className="bg-background"/>
                </div>
                 <div>
                    <label className="text-lg font-semibold block text-right mb-1">תחביבים וחלומות</label>
                    <EditableField multiline value={myStory.hobbies || ''} onUpdate={(v) => onProjectChange(['myStory', 'hobbies'], v)} placeholder="מה את/ה אוהב/ת לעשות בזמנך הפנוי? מה החלום הכי גדול שלך?" className="bg-background"/>
                </div>
            </div>
        </div>
    );
}

// Step 3: Nuclear Family
const Step3_NuclearFamily = ({ projectData, people, relationships, onProjectChange }: { projectData: RootsProjectData, people: Person[], relationships: Relationship[], onProjectChange: Function }) => {
    const studentId = projectData.studentPersonId;

    const { parents, siblings } = useMemo(() => {
        if (!studentId) return { parents: [], siblings: [] };

        const parentIds = relationships
            .filter(r => r.personBId === studentId && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType))
            .map(r => r.personAId);
        
        const parents = people.filter(p => parentIds.includes(p.id));

        const siblingIds = new Set<string>();
        parentIds.forEach(parentId => {
            relationships.forEach(r => {
                if (r.personAId === parentId && r.personBId !== studentId && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType)) {
                    siblingIds.add(r.personBId);
                }
            });
        });

        const siblings = people.filter(p => siblingIds.has(p.id)).sort((a,b) => (a.birthDate || '').localeCompare(b.birthDate || ''));

        return { parents, siblings };
    }, [studentId, people, relationships]);

    return (
        <div className="space-y-8">
            <div className="text-center">
                <Users className="mx-auto h-12 w-12 text-primary mb-2"/>
                <h2 className="text-3xl font-bold">המשפחה הגרעינית שלי</h2>
                <p className="text-muted-foreground mt-1">ספר על האנשים הקרובים אליך ביותר.</p>
            </div>
            
            <div>
                <h3 className="text-2xl font-semibold border-b-2 border-primary pb-1 mb-4 text-right">הורים</h3>
                <div className="space-y-4">
                    {parents.length > 0 ? parents.map(p => (
                        <div key={p.id}>
                            <label className="text-lg font-semibold block text-right mb-1">סיפור על {p.firstName}</label>
                            <EditableField multiline value={projectData.family?.parents?.[p.id]?.story || ''} onUpdate={(v) => onProjectChange(['family', 'parents', p.id, 'story'], v)} placeholder={`איפה נולד/ה? מה המקצוע? מה התחביבים?`} className="bg-background"/>
                        </div>
                    )) : <p className="text-muted-foreground text-center">לא נמצאו הורים בעץ.</p>}
                </div>
            </div>

            <div>
                <h3 className="text-2xl font-semibold border-b-2 border-primary pb-1 mb-4 text-right">אחים ואחיות</h3>
                <div className="space-y-4">
                    {siblings.length > 0 ? siblings.map(s => (
                        <div key={s.id}>
                             <label className="text-lg font-semibold block text-right mb-1">סיפור על {s.firstName}</label>
                            <EditableField multiline value={projectData.family?.siblings?.[s.id]?.story || ''} onUpdate={(v) => onProjectChange(['family', 'siblings', s.id, 'story'], v)} placeholder={`מה הגיל? מה הקשר ביניכם?`} className="bg-background"/>
                        </div>
                    )) : <p className="text-muted-foreground text-center">לא נמצאו אחים בעץ.</p>}
                </div>
            </div>
        </div>
    );
};


// Main Component
export function RootsView({ project, people, relationships, tree, onProjectChange, onStepChange }: RootsViewProps) {
  const currentStep = project?.currentStep || 0;
  
  const debouncedSave = useCallback(
    debounce(onProjectChange, 2000),
    [onProjectChange]
  );

  const renderStepContent = () => {
    if (!project) return null;
    
    // Step 0 - always show if no student is selected
    if (!project.projectData?.studentPersonId) {
        return <Step0_Identity people={people} tree={tree} onSelect={(personId) => {
            const student = people.find(p => p.id === personId);
            onProjectChange(['studentPersonId'], personId);
            onProjectChange(['coverPage', 'studentName'], student ? `${student.firstName} ${student.lastName}` : '');
            onStepChange(1);
        }} />;
    }

    switch (currentStep) {
        case 1:
            return <Step1_FormalInfo projectData={project.projectData || {}} onProjectChange={debouncedSave} />;
        case 2:
            return <Step2_MyStory projectData={project.projectData || {}} onProjectChange={debouncedSave} />;
        case 3:
            return <Step3_NuclearFamily projectData={project.projectData || {}} people={people} relationships={relationships} onProjectChange={debouncedSave} />;
        default:
            return (
                <div className="flex items-center justify-center h-96">
                    <p className="text-muted-foreground">שלב {currentStep} - תוכן יוצג כאן...</p>
                </div>
            );
    }
  };
  
  if (!project) {
      return (
          <div className="flex h-full items-center justify-center">
              טוען פרויקט...
          </div>
      );
  }

  return (
    <div className="w-full h-full flex flex-col p-4 bg-gray-100 dark:bg-gray-900" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23a0aec0\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} dir="rtl">
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto py-8">
                 <Card className="w-full shadow-2xl rounded-3xl bg-card/95 backdrop-blur-sm border-white/10">
                     <CardContent className="p-4 sm:p-8">
                        {renderStepContent()}
                     </CardContent>
                 </Card>
            </div>
        </div>
        
        {project.projectData?.studentPersonId && (
            <div className="p-4 border-t bg-card/95 backdrop-blur-sm mt-4 rounded-t-2xl shadow-lg shrink-0">
                <div className="mb-2 text-center text-sm font-medium">
                שלב {currentStep} מתוך {WIZARD_STEPS.length - 1}: {WIZARD_STEPS.find(s => s.id === currentStep)?.label}
                </div>
                <Progress value={((currentStep) / (WIZARD_STEPS.length -1)) * 100} />
                <div className="flex justify-between items-center mt-4">
                    <Button variant="outline" onClick={() => onStepChange(currentStep - 1)} disabled={currentStep <= 1}>
                        → הקודם
                    </Button>
                    <div className="flex justify-center gap-2">
                        {WIZARD_STEPS.slice(1).map(step => ( // Exclude step 0 from stepper
                            <button
                            key={step.id}
                            onClick={() => onStepChange(step.id)}
                            className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all border-2",
                                currentStep === step.id ? "bg-primary text-primary-foreground border-primary-foreground/50 scale-110" :
                                currentStep > step.id ? "bg-primary/50 text-primary-foreground border-transparent" : "bg-muted text-muted-foreground border-border"
                            )}
                            >
                            {step.id}
                            </button>
                        ))}
                    </div>
                    <Button onClick={() => onStepChange(currentStep + 1)} disabled={currentStep >= WIZARD_STEPS.length - 1}>
                        הבא ←
                    </Button>
                </div>
            </div>
        )}
    </div>
  );
}

function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: Parameters<F>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
