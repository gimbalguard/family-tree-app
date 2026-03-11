'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { RootsProject, Person, FamilyTree } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS } from '../roots-config';
import { useUser } from '@/firebase';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getPlaceholderImage } from '@/lib/placeholder-images';
import { Label } from '@/components/ui/label';

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
    tree: FamilyTree | null;
    onProjectChange: (path: (string | number)[], value: any) => void;
    onStepChange: (step: number) => void;
};

// Reusable Editable Field Component
const EditableField = ({ value, onUpdate, placeholder, multiline = false, className }: { value: string; onUpdate: (newValue: string) => void; placeholder: string; multiline?: boolean, className?: string }) => {
    const ref = useRef<HTMLDivElement>(null);
    const isPlaceholder = !value;

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
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "px-2 py-1 rounded-md min-h-[30px] inline-block",
          "hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-primary/10 transition-all focus:scale-[1.02] origin-right",
          isPlaceholder && "text-muted-foreground/70",
          className
        )}
      >
        {isPlaceholder ? placeholder : value}
      </div>
    );
};


// Step 0: Identity Selection
const Step0_Identity = ({ people, tree, onSelect }: { people: Person[], tree: FamilyTree | null, onSelect: (personId: string) => void }) => {
    const [open, setOpen] = useState(false);
    
    const initialOwnerId = tree?.ownerPersonId || '';
    const validInitialOwner = people.find(p => p.id === initialOwnerId);
    const [value, setValue] = useState(validInitialOwner ? initialOwnerId : '');
  
    return (
        <Card className="max-w-md mx-auto text-center shadow-2xl rounded-3xl p-8">
            <h2 className="text-3xl font-bold mb-4">מי אני בעץ?</h2>
            <p className="text-muted-foreground mb-6">בחירת זהותך תקבע את נקודת המבט של עבודת השורשים.</p>
             <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-12 text-lg">
                        {value ? people.find(p => p.id === value)?.firstName + ' ' + people.find(p => p.id === value)?.lastName : "בחר אדם..."}
                        <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                        <CommandInput placeholder="חפש אדם..." />
                        <CommandList>
                            <CommandEmpty>לא נמצא אדם.</CommandEmpty>
                            <CommandGroup>
                                {people.map(person => (
                                    <CommandItem
                                        key={person.id}
                                        value={person.id}
                                        onSelect={(currentValue) => {
                                            setValue(currentValue)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check className={cn("ml-2 h-4 w-4", value === person.id ? "opacity-100" : "opacity-0")} />
                                        <Avatar className="h-6 w-6 mr-2">
                                            <AvatarImage src={person.photoURL || undefined} />
                                            <AvatarFallback><img src={getPlaceholderImage(person.gender)} alt="avatar"/></AvatarFallback>
                                        </Avatar>
                                        {person.firstName} {person.lastName}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <Button size="lg" className="w-full mt-6" onClick={() => onSelect(value)} disabled={!value}>המשך</Button>
        </Card>
    );
};


// Step 1: Formal Info
const Step1_FormalInfo = ({ projectData, onProjectChange }: { projectData: RootsProjectData, onProjectChange: (path: (string|number)[], value: any) => void }) => {
    const { coverPage = {} } = projectData;

    return (
        <div className="space-y-6">
             <div className="p-8 border-4 border-gray-700 bg-white text-black text-center flex flex-col justify-center items-center font-serif min-h-[500px]">
                <h1 className="text-4xl font-bold mb-12">
                    <EditableField value={coverPage.title || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'title'], newValue)} placeholder={projectData.projectName || 'שם הפרויקט'} className="font-bold text-4xl" />
                </h1>
                <div className="space-y-4 text-lg">
                    <p>מגיש/ה: <EditableField value={coverPage.studentName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'studentName'], newValue)} placeholder="[שם התלמיד/ה]" /></p>
                    <p>בית ספר: <EditableField value={coverPage.schoolName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'schoolName'], newValue)} placeholder="[שם בית הספר]" /></p>
                    <p>כיתה: <EditableField value={coverPage.className || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'className'], newValue)} placeholder="[כיתה]" /></p>
                    <p>מורה: <EditableField value={coverPage.teacherName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'teacherName'], newValue)} placeholder="[שם המורה]" /></p>
                    <p>תאריך הגשה: <EditableField value={coverPage.submissionDate || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'submissionDate'], newValue)} placeholder="[תאריך הגשה]" /></p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                <div className="space-y-1">
                    <Label>מנהל/ת בית הספר</Label>
                    <EditableField value={coverPage.principalName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'principalName'], newValue)} placeholder="שם המנהל/ת" />
                </div>
                <div className="space-y-1">
                    <Label>שנה עברית</Label>
                    <EditableField value={coverPage.hebrewYear || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'hebrewYear'], newValue)} placeholder="לדוג׳: תשפ״ה" />
                </div>
            </div>
        </div>
    );
};

// Main Component
export function RootsView({ project, people, tree, onProjectChange, onStepChange }: RootsViewProps) {
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
            onProjectChange(['studentPersonId'], personId);
            const student = people.find(p => p.id === personId);
            onProjectChange(['coverPage', 'studentName'], student ? `${student.firstName} ${student.lastName}` : '');
            onStepChange(1);
        }} />;
    }

    switch (currentStep) {
        case 1:
            return <Step1_FormalInfo projectData={project.projectData || {}} onProjectChange={debouncedSave} />;
        default:
            return (
                <div className="flex items-center justify-center h-full">
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
    <div className="w-full h-full flex flex-col p-4 bg-muted/20" dir="rtl">
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto py-8">
                 <Card className="w-full shadow-2xl rounded-3xl">
                     <CardContent className="p-4 sm:p-8">
                        {renderStepContent()}
                     </CardContent>
                 </Card>
            </div>
        </div>
        
        {project.projectData?.studentPersonId && (
            <div className="p-4 border-t bg-card mt-4 rounded-b-lg shadow-lg shrink-0">
                <div className="mb-2 text-center text-sm font-medium">
                שלב {currentStep} מתוך {WIZARD_STEPS.length - 1}: {WIZARD_STEPS.find(s => s.id === currentStep)?.label}
                </div>
                <Progress value={((currentStep) / (WIZARD_STEPS.length -1)) * 100} />
                <div className="flex justify-between items-center mt-2">
                    <Button variant="outline" onClick={() => onStepChange(currentStep - 1)} disabled={currentStep <= 1}>
                        → הקודם
                    </Button>
                    <div className="flex justify-center gap-2">
                        {WIZARD_STEPS.slice(1).map(step => ( // Exclude step 0 from stepper
                            <button
                            key={step.id}
                            onClick={() => onStepChange(step.id)}
                            className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all",
                                currentStep === step.id ? "bg-primary text-primary-foreground scale-110" :
                                currentStep > step.id ? "bg-primary/50 text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}
                            >
                            {step.id}
                            </button>
                        ))}
                    </div>
                    <Button variant="outline" onClick={() => onStepChange(currentStep + 1)} disabled={currentStep >= WIZARD_STEPS.length - 1}>
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
