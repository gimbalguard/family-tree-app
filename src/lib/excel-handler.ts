'use client';
import * as XLSX from 'xlsx';
import type { FamilyTree, Person, Relationship, SocialLink, ManualEvent, CanvasPosition } from './types';
import { format } from 'date-fns';

export interface ParsedExcelData {
  treeName: string;
  people: any[];
  relationships: any[];
  socialLinks: any[];
  manualEvents: any[];
  canvasPositions: any[];
}

const toISOStringOrNull = (timestamp: any) => {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate().toISOString();
  if (typeof timestamp === 'string' || timestamp instanceof Date) {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

export const exportToExcel = ({
  tree,
  people,
  relationships,
  socialLinks,
  manualEvents,
  canvasPositions,
}: {
  tree: FamilyTree,
  people: Person[],
  relationships: Relationship[],
  socialLinks: (SocialLink & { personId: string })[],
  manualEvents: ManualEvent[],
  canvasPositions: CanvasPosition[],
}): { blob: Blob; fileName: string } => {
  const personMap = new Map(people.map(p => [p.id, `${p.firstName} ${p.lastName}`]));

  const peopleSheetData = people.map(p => ({
    id: p.id,
    userId: p.userId,
    treeId: p.treeId,
    firstName: p.firstName,
    lastName: p.lastName,
    middleName: p.middleName || '',
    previousFirstName: p.previousFirstName || '',
    maidenName: p.maidenName || '',
    nickname: p.nickname || '',
    gender: p.gender,
    birthDate: p.birthDate || '',
    deathDate: p.deathDate || '',
    birthPlace: p.birthPlace || '',
    status: p.status,
    religion: p.religion || '',
    countryOfResidence: p.countryOfResidence || '',
    cityOfResidence: p.cityOfResidence || '',
    photoURL: p.photoURL || '',
    description: p.description || '',
    isLocked: p.isLocked ?? false,
    groupId: p.groupId || '',
    createdAt: toISOStringOrNull(p.createdAt),
    updatedAt: toISOStringOrNull(p.updatedAt),
  }));

  const relationshipsSheetData = relationships.map(r => ({
    id: r.id,
    userId: r.userId,
    treeId: r.treeId,
    personAId: r.personAId,
    personAName: personMap.get(r.personAId) || '',
    personBId: r.personBId,
    personBName: personMap.get(r.personBId) || '',
    relationshipType: r.relationshipType,
    startDate: r.startDate || '',
    endDate: r.endDate || '',
    notes: r.notes || '',
    manuallyEdited: r.manuallyEdited ?? false,
  }));
  
  const socialLinksSheetData = socialLinks.map(sl => ({
    id: sl.id,
    personId: sl.personId,
    personName: personMap.get(sl.personId) || '',
    platform: sl.platform,
    url: sl.url,
  }));

  const manualEventsSheetData = manualEvents.map(me => ({
    id: me.id,
    userId: me.userId,
    treeId: me.treeId,
    title: me.title,
    date: me.date,
    time: me.time || '',
    allDay: me.allDay,
    description: me.description || '',
    color: me.color,
    createdAt: toISOStringOrNull(me.createdAt),
    updatedAt: toISOStringOrNull(me.updatedAt),
  }));

  const canvasPositionsSheetData = canvasPositions.map(cp => ({
    id: cp.id,
    userId: cp.userId,
    treeId: cp.treeId,
    personId: cp.personId,
    x: cp.x,
    y: cp.y,
    isLocked: cp.isLocked ?? false,
    groupId: cp.groupId || '',
    updatedAt: toISOStringOrNull(cp.updatedAt),
  }));

  const treeInfoSheetData = [{
    treeName: tree.treeName,
    id: tree.id,
    userId: tree.userId,
    language: tree.language || 'he',
    privacy: tree.privacy || 'private',
    shareToken: tree.shareToken || '',
    ownerPersonId: tree.ownerPersonId || '',
    personCount: people.length,
    relationshipCount: relationships.length,
    exportDate: new Date().toISOString(),
    formatVersion: "2.0"
  }];

  const sheets = {
    "אנשים": peopleSheetData,
    "קשרים": relationshipsSheetData,
    "קשרים חברתיים": socialLinksSheetData,
    "אירועים": manualEventsSheetData,
    "מיקומי קנבס": canvasPositionsSheetData,
    "מידע על העץ": treeInfoSheetData,
  };
  
  const wb = XLSX.utils.book_new();

  Object.entries(sheets).forEach(([sheetName, data]) => {
    const ws = XLSX.utils.json_to_sheet(data);
    
    // Set RTL
    ws['!props'] = { RTL: true };

    // Auto-fit columns
    if (data.length > 0) {
      const colWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(
          key.length,
          ...data.map(row => (row[key as keyof typeof row] || '').toString().length)
        ) + 2
      }));
      ws['!cols'] = colWidths;
    }

    // Style header
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: 0, c: C });
        if (!ws[address]) continue;
        ws[address].s = {
          font: { bold: true, color: { rgb: "FFFFFFFF" } },
          fill: { fgColor: { rgb: "26a69a" } }, // Teal color
        };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const fileName = `משפחת-${tree.treeName}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  
  return { blob, fileName };
};


export const parseAndValidateExcel = (fileBuffer: ArrayBuffer): ParsedExcelData => {
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const requiredSheets = ["אנשים", "קשרים", "מידע על העץ"];
    
    for (const sheetName of requiredSheets) {
        if (!wb.SheetNames.includes(sheetName)) {
            throw new Error(`קובץ לא תקין — חסרים גיליונות`);
        }
    }

    const treeInfoData = XLSX.utils.sheet_to_json(wb.Sheets["מידע על העץ"]);
    if (treeInfoData.length === 0 || !(treeInfoData[0] as any).formatVersion || parseFloat((treeInfoData[0] as any).formatVersion) < 2) {
        throw new Error(`גרסת קובץ לא נתמכת — ייצא מחדש`);
    }

    const people = XLSX.utils.sheet_to_json(wb.Sheets["אנשים"]);
    if (people.length === 0) {
        throw new Error(`לא נמצאו אנשים בקובץ`);
    }

    const relationships = XLSX.utils.sheet_to_json(wb.Sheets["קשרים"]);
    const socialLinks = wb.SheetNames.includes("קשרים חברתיים") ? XLSX.utils.sheet_to_json(wb.Sheets["קשרים חברתיים"]) : [];
    const manualEvents = wb.SheetNames.includes("אירועים") ? XLSX.utils.sheet_to_json(wb.Sheets["אירועים"]) : [];
    const canvasPositions = wb.SheetNames.includes("מיקומי קנבס") ? XLSX.utils.sheet_to_json(wb.Sheets["מיקומי קנבס"]) : [];
    
    return {
        treeName: (treeInfoData[0] as any).treeName,
        people,
        relationships,
        socialLinks,
        manualEvents,
        canvasPositions,
    };
};
