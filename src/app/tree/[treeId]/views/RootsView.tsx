'use client';

import React from 'react';
import type { RootsProject } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS } from '../tree-page-client';

// Define the shape of the project data
export interface RootsProjectData {
  projectName?: string;
  coverPage?: {
    title?: string;
    studentName?: string;
    teacherName?: string;
    submissionDate?: string;
    className?: string;
  };
  // Add other steps data structure later
  [key: string]: any;
}

type RootsViewProps = {
    project: RootsProject | null;
    onProjectChange: (path: string[], value: any) => void;
    currentStep: number;
    onStepChange: (step: number) => void;
};

const EditableField = ({ value, onUpdate, placeholder, className }: { value: string; onUpdate: (newValue: string) => void; placeholder: string; className?: string }) => {
    const handleBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
      onUpdate(e.currentTarget.textContent || '');
    };
  
    return (
      <span
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        className={cn(
          "px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-blue-50 dark:focus:bg-blue-950",
          !value && "text-muted-foreground",
          className
        )}
        dangerouslySetInnerHTML={{ __html: value || placeholder }}
      />
    );
};

export function RootsView({ project, onProjectChange, currentStep, onStepChange }: RootsViewProps) {
  const renderPreview = () => {
    switch (currentStep) {
        case 1:
            const { title, studentName, teacherName, submissionDate, className } = project?.projectData?.coverPage || {};
            return (
                <div className="p-8 border-4 border-gray-700 bg-white h-full text-black text-center flex flex-col justify-center items-center font-serif">
                    <h1 className="text-4xl font-bold mb-12">
                        <EditableField value={title || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'title'], newValue)} placeholder={project?.projectName || 'שם הפרויקט'} className="font-bold text-4xl" />
                    </h1>
                    <div className="space-y-4 text-lg">
                        <p>מגיש/ה: <EditableField value={studentName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'studentName'], newValue)} placeholder="[שם התלמיד/ה]" /></p>
                        <p>כיתה: <EditableField value={className || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'className'], newValue)} placeholder="[כיתה]" /></p>
                        <p>מורה: <EditableField value={teacherName || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'teacherName'], newValue)} placeholder="[שם המורה]" /></p>
                        <p>תאריך הגשה: <EditableField value={submissionDate || ''} onUpdate={(newValue) => onProjectChange(['coverPage', 'submissionDate'], newValue)} placeholder="[תאריך הגשה]" /></p>
                    </div>
                </div>
            )
        default:
            return (
                <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">תוכן השלב יוצג כאן...</p>
                </div>
            );
    }
  }

  return (
    <div className="w-full h-full flex flex-col p-4" dir="rtl">
        <Card className="flex-1 flex flex-col shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <h2 className="text-xl font-bold text-center flex-1">
                תצוגה מקדימה: {WIZARD_STEPS.find(s => s.id === currentStep)?.label}
            </h2>
          </CardHeader>
          <CardContent className="flex-1 p-2">
            {renderPreview()}
          </CardContent>
        </Card>
        
        {/* Stepper at the bottom */}
        <div className="p-4 border-t bg-card mt-4 rounded-b-lg shadow-lg">
            <div className="mb-2 text-center text-sm font-medium">
              שלב {currentStep} מתוך {WIZARD_STEPS.length}: {WIZARD_STEPS.find(s => s.id === currentStep)?.label}
            </div>
            <Progress value={(currentStep / WIZARD_STEPS.length) * 100} />
            <div className="flex justify-between items-center mt-2">
                <Button variant="outline" onClick={() => onStepChange(currentStep - 1)} disabled={currentStep === 1}>
                    → הקודם
                </Button>
                <div className="flex justify-center gap-2">
                    {WIZARD_STEPS.map(step => (
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
                 <Button variant="outline" onClick={() => onStepChange(currentStep + 1)} disabled={currentStep === WIZARD_STEPS.length}>
                    הבא ←
                </Button>
            </div>
        </div>
    </div>
  );
}
