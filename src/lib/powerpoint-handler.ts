'use client';
import PptxGenJS from 'pptxgenjs';
import type { FamilyTree, Person, Relationship } from './types';
import type { PptxExportOptions, PptxExportTheme } from '@/app/tree/[treeId]/powerpoint-export-modal';
import { format, differenceInYears } from 'date-fns';
import { he } from 'date-fns/locale';

interface Theme {
  background: string;
  titleColor: string;
  accentColor: string;
  textColor: string;
}

const THEMES: Record<PptxExportTheme, Theme> = {
  light: { background: 'FFFFFF', titleColor: '1e293b', accentColor: '26a69a', textColor: '475569' },
  dark: { background: '1A2A3A', titleColor: 'FFFFFF', accentColor: '26a69a', textColor: '94a3b8' },
  family: { background: 'FDF6E3', titleColor: '5C4813', accentColor: 'C9A227', textColor: '78716C' },
};

interface ExportParams {
  options: PptxExportOptions;
  tree: FamilyTree;
  people: Person[];
  relationships: Relationship[];
  onProgress: (progress: { text: string; percentage: number }) => void;
}

async function fetchImageAsBase64(url: string): Promise<string> {
  if (!url) return '';
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

function assignGenerations(people: Person[], relationships: Relationship[], rootId?: string) {
  const generations = new Map<string, number>();
  if (people.length === 0) return { peopleByGeneration: new Map(), totalGenerations: 0 };

  const childrenMap = new Map<string, string[]>();
  relationships.forEach(rel => {
    if (['parent', 'adoptive_parent', 'step_parent'].includes(rel.relationshipType)) {
      if (!childrenMap.has(rel.personAId)) childrenMap.set(rel.personAId, []);
      childrenMap.get(rel.personAId)!.push(rel.personBId);
    }
  });

  const roots = rootId ? [rootId] : people.filter(p => !relationships.some(r => r.personBId === p.id && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationshipType))).map(p => p.id);

  const q: [string, number][] = [];
  const visited = new Set<string>();

  roots.forEach(r => {
    q.push([r, 1]);
    visited.add(r);
  });

  while (q.length > 0) {
    const [personId, gen] = q.shift()!;
    generations.set(personId, gen);

    const children = childrenMap.get(personId) || [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        q.push([childId, gen + 1]);
      }
    }
  }

  const peopleByGeneration = new Map<number, Person[]>();
  people.forEach(p => {
    const gen = generations.get(p.id) || 0; // 0 for unassigned
    if (!peopleByGeneration.has(gen)) peopleByGeneration.set(gen, []);
    peopleByGeneration.get(gen)!.push(p);
  });

  const sortedGenerations = Array.from(peopleByGeneration.keys()).sort((a,b) => a-b);
  const remappedPeople = new Map<number, Person[]>();
  let totalGenerations = 0;
  sortedGenerations.forEach((gen, index) => {
    const newGenNum = gen === 0 ? 0 : index + 1;
    if (newGenNum > 0) totalGenerations++;
    remappedPeople.set(newGenNum, peopleByGeneration.get(gen)!.sort((a,b) => (a.birthDate || '').localeCompare(b.birthDate || '')));
  });

  return { peopleByGeneration: remappedPeople, totalGenerations };
}

export async function exportToPowerPoint({ options, tree, people, relationships, onProgress }: ExportParams) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.rtl = true;

  const theme = THEMES[options.theme];
  const { peopleByGeneration, totalGenerations } = assignGenerations(people, relationships, tree.ownerPersonId);
  const personCount = people.length;
  let slidesCreated = 0;
  const totalSlidesToCreate = (options.includePersonSlides ? personCount : 0) + (options.includeGenerations ? totalGenerations : 0) + (options.includeTitle ? 1 : 0) + (options.includeStats ? 1 : 0) + (options.includeEnding ? 1 : 0);

  const updateProgress = (text: string) => {
    slidesCreated++;
    onProgress({ text, percentage: (slidesCreated / totalSlidesToCreate) * 100 });
  };
  
  // Slide 1: Title
  if (options.includeTitle) {
    updateProgress('יוצר שקף פתיחה...');
    const slide = pptx.addSlide();
    slide.background = { color: theme.background };
    slide.addText(options.title, { x: 0.5, y: 3, w: '90%', h: 1, align: 'center', fontSize: 36, bold: true, color: theme.titleColor });
    slide.addText(`עץ משפחה — ${personCount} אנשים, ${totalGenerations} דורות`, { x: 0.5, y: 4, w: '90%', h: 0.75, align: 'center', fontSize: 18, color: theme.textColor });
    slide.addText(format(new Date(), 'dd/MM/yyyy'), { x: 8.5, y: 5.2, w: 1, h: 0.25, align: 'right', fontSize: 10, color: theme.textColor });
  }

  // Person Slides
  if (options.includePersonSlides) {
    const sortedGenKeys = Array.from(peopleByGeneration.keys()).sort((a, b) => a - b);
    for (const gen of sortedGenKeys) {
      if (options.includeGenerations) {
        updateProgress(`יוצר שקף דור ${gen}...`);
        const slide = pptx.addSlide();
        slide.background = { color: theme.background };
        const genLabel = gen === 0 ? 'ללא שיוך' : `דור ${gen}`;
        slide.addText(genLabel, { x: 0, y: 0, w: '100%', h: '100%', align: 'center', valign: 'middle', fontSize: 48, bold: true, color: theme.accentColor });
      }

      const peopleInGen = peopleByGeneration.get(gen) || [];
      for (const person of peopleInGen) {
        updateProgress(`יוצר שקף עבור ${person.firstName}...`);
        const slide = pptx.addSlide();
        slide.background = { color: theme.background };
        
        // Photo
        const imageUrl = person.photoURL;
        if (imageUrl) {
            const base64Img = await fetchImageAsBase64(imageUrl);
            if (base64Img) {
                slide.addImage({ data: base64Img, x: 0.5, y: 1, w: 3.5, h: 3.5, sizing: { type: 'cover', w: 3.5, h: 3.5 } });
            }
        }

        // Details
        let yPos = 1.0;
        slide.addText(`${person.firstName} ${person.lastName}`, { x: 4.5, y: yPos, w: 5, h: 0.5, fontSize: 28, bold: true, color: theme.titleColor, align: 'right' });
        yPos += 0.6;
        if(person.maidenName || person.nickname) {
            slide.addText(`${person.maidenName || ''} (${person.nickname || ''})`, { x: 4.5, y: yPos, w: 5, h: 0.3, fontSize: 14, color: theme.textColor, align: 'right' });
            yPos += 0.4;
        }
        
        yPos += 0.2; // spacer
        
        if (person.birthDate) slide.addText(`נולד/ה: ${format(new Date(person.birthDate), 'd MMMM yyyy', {locale: he})} ב${person.birthPlace || ''}`, { x: 4.5, y: yPos, w: 5, h: 0.3, fontSize: 12, color: theme.textColor, align: 'right' });
        yPos += 0.3;
        if (person.status === 'deceased' && person.deathDate) {
            const age = differenceInYears(new Date(person.deathDate), new Date(person.birthDate!));
            slide.addText(`נפטר/ה: ${format(new Date(person.deathDate), 'd MMMM yyyy', {locale: he})} (גיל ${age})`, { x: 4.5, y: yPos, w: 5, h: 0.3, fontSize: 12, color: theme.textColor, align: 'right' });
            yPos += 0.3;
        }

        if (person.countryOfResidence) slide.addText(`מגורים: ${person.cityOfResidence || ''}, ${person.countryOfResidence}`, { x: 4.5, y: yPos, w: 5, h: 0.3, fontSize: 12, color: theme.textColor, align: 'right' });
        yPos += 0.3;

        if (person.description) {
            slide.addText(person.description, { x: 4.5, y: yPos, w: 5, h: 1.5, fontSize: 11, color: theme.textColor, align: 'right' });
        }
      }
    }
  }

  // Stats Slide
  if (options.includeStats) {
      updateProgress('יוצר שקף סטטיסטיקות...');
      const slide = pptx.addSlide();
      slide.background = { color: theme.background };
      slide.addText('סטטיסטיקות עץ', { x: 0, y: 0.2, w: '100%', align: 'center', fontSize: 24, bold: true, color: theme.titleColor });
      // Add stats here, simplified
      slide.addText(`סה"כ אנשים: ${personCount}`, { x: 7, y: 1, w: 2.5, h: 0.4, align: 'right', fontSize: 14, color: theme.textColor });
      slide.addText(`חיים: ${people.filter(p=>p.status === 'alive').length}`, { x: 7, y: 1.5, w: 2.5, h: 0.4, align: 'right', fontSize: 14, color: theme.textColor });
      slide.addText(`נפטרו: ${people.filter(p=>p.status === 'deceased').length}`, { x: 7, y: 2.0, w: 2.5, h: 0.4, align: 'right', fontSize: 14, color: theme.textColor });
  }

  // Ending Slide
  if (options.includeEnding) {
    updateProgress('יוצר שקף סיום...');
    const slide = pptx.addSlide();
    slide.background = { color: theme.background };
    slide.addText(`עץ משפחת ${tree.treeName}`, { x: 0, y: 2, w: '100%', h: 1, align: 'center', fontSize: 32, bold: true, color: theme.titleColor });
    slide.addText(`נוצר באמצעות FamilyTree | ${format(new Date(), 'd MMMM yyyy', {locale: he})}`, { x: 0, y: 4.5, w: '100%', h: 0.5, align: 'center', fontSize: 12, color: theme.textColor });
  }
  
  await pptx.writeFile({ fileName: `משפחת-${tree.treeName}-${format(new Date(), 'yyyy-MM-dd')}.pptx` });
}
