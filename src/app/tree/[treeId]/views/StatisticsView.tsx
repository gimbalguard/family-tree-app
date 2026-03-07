'use client';

import React, { useMemo, useState } from 'react';
import type { Person, Relationship } from '@/lib/types';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  Heart,
  Smile,
  Frown,
  GitCommit,
  BookUser,
  Globe,
  Briefcase,
  Zodiac,
  Cake,
  CalendarDays,
  FileText,
  UserCheck,
  Percent,
  CalendarClock,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  differenceInYears,
  getYear,
  getMonth,
  isValid,
  parseISO,
  format,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// ─── Constants and Helpers ──────────────────────────────────────────────────

const COLORS = [
  '#2A7EE3', // Accent: Vibrant Azure
  '#4C3399', // Primary: Muted Indigo
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff8042',
  '#00C49F',
  '#FFBB28',
  '#a4de6c',
  '#d0ed57',
  '#ffc658',
  '#8dd1e1',
];

const getZodiacSign = (date: Date): string | null => {
  if (!isValid(date)) return null;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const signs: { [key: string]: { start: [number, number]; end: [number, number] } } = {
    טלה: { start: [3, 21], end: [4, 19] },
    שור: { start: [4, 20], end: [5, 20] },
    תאומים: { start: [5, 21], end: [6, 20] },
    סרטן: { start: [6, 21], end: [7, 22] },
    אריה: { start: [7, 23], end: [8, 22] },
    בתולה: { start: [8, 23], end: [9, 22] },
    מאזניים: { start: [9, 23], end: [10, 22] },
    עקרב: { start: [10, 23], end: [11, 21] },
    קשת: { start: [11, 22], end: [12, 21] },
    גדי: { start: [12, 22], end: [1, 19] },
    דלי: { start: [1, 20], end: [2, 18] },
    דגים: { start: [2, 19], end: [3, 20] },
  };

  for (const sign in signs) {
    const { start, end } = signs[sign];
    if (sign === 'גדי') { // Capricorn spans new year
      if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return sign;
    } else if (
      (month === start[0] && day >= start[1]) ||
      (month === end[0] && day <= end[1])
    ) {
      return sign;
    }
  }
  return null;
};

const countOccurrences = (arr: (string | undefined | null)[]): { name: string; value: number }[] => {
  const counts = arr.reduce((acc: { [key: string]: number }, item) => {
    if (item) {
      acc[item] = (acc[item] || 0) + 1;
    }
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

// ─── Reusable Components ────────────────────────────────────────────────────

const StatCard = ({ title, value, icon, onClick }: { title: string; value: string | number; icon?: React.ReactNode; onClick?: () => void }) => (
  <Card onClick={onClick} className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const ChartCard = ({ title, children, dataAvailable, minHeight = '300px', onClick }: { title: string; children: React.ReactNode; dataAvailable: boolean, minHeight?: string | number, onClick?: () => void }) => (
  <Card onClick={onClick} className={cn("flex flex-col", onClick && "cursor-pointer hover:shadow-md transition-shadow")} style={{ minHeight }}>
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
    </CardHeader>
    <CardContent className="flex-1 flex flex-col items-center justify-center">
      {dataAvailable ? (
        <>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
          {onClick && <div className="text-xs text-muted-foreground pt-2">לחץ להרחבה</div>}
        </>
      ) : (
        <div className="text-muted-foreground text-sm">אין מספיק נתונים להצגת הגרף</div>
      )}
    </CardContent>
  </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/80 p-2 border rounded-md shadow-lg backdrop-blur-sm">
        <p className="label font-bold">{`${label}`}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.fill }}>{`${pld.name}: ${pld.value}`}</p>
        ))}
      </div>
    );
  }
  return null;
};


// ─── Main View Component ────────────────────────────────────────────────────

export function StatisticsView({ people, relationships, onEditPerson }: { people: Person[]; relationships: Relationship[]; onEditPerson?: (personId: string) => void; }) {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const summaryStats = useMemo(() => {
    const earliestBirth = Math.min(...people.map(p => p.birthDate ? getYear(parseISO(p.birthDate)) : Infinity).filter(isFinite));
    const marriageAgeData = people.flatMap(person => {
      const personRels = relationships.filter(r =>
        (r.personAId === person.id || r.personBId === person.id) &&
        ['spouse', 'partner'].includes(r.relationshipType) &&
        r.startDate && person.birthDate
      );
      if (personRels.length > 0) {
        const marriageDate = new Date(personRels[0].startDate!);
        const birthDate = new Date(person.birthDate!);
        if (isValid(marriageDate) && isValid(birthDate)) {
          return differenceInYears(marriageDate, birthDate);
        }
      }
      return [];
    });
    const averageMarriageAge = marriageAgeData.length > 0
      ? (marriageAgeData.reduce((a, b) => a + b, 0) / marriageAgeData.length)
      : 0;

    return {
      totalPeople: people.length,
      males: people.filter(p => p.gender === 'male').length,
      females: people.filter(p => p.gender === 'female').length,
      living: people.filter(p => p.status === 'alive').length,
      deceased: people.filter(p => p.status === 'deceased').length,
      totalRelationships: relationships.length,
      familyNames: new Set(people.map(p => p.lastName)).size,
      birthCountries: new Set(people.map(p => p.countryOfResidence).filter(Boolean)).size,
      divorces: relationships.filter(r => ['ex_spouse', 'separated', 'ex_partner'].includes(r.relationshipType)).length,
      treeSpan: isFinite(earliestBirth) ? `${earliestBirth} - ${getYear(new Date())}` : 'N/A',
      averageMarriageAge: averageMarriageAge > 0 ? averageMarriageAge.toFixed(1) : 'N/A',
    };
  }, [people, relationships]);

  // All other useMemo hooks from original component...
  const genderData = useMemo(() => [
    { name: 'זכרים', value: summaryStats.males },
    { name: 'נקבות', value: summaryStats.females },
    { name: 'אחר', value: people.length - summaryStats.males - summaryStats.females },
  ].filter(d => d.value > 0), [people.length, summaryStats]);

  const ageData = useMemo(() => {
    const livingPeople = people.filter(p => p.status === 'alive' && p.birthDate && isValid(parseISO(p.birthDate)));
    const buckets = {
      '0-10': 0, '11-20': 0, '21-30': 0, '31-40': 0, '41-50': 0,
      '51-60': 0, '61-70': 0, '71-80': 0, '81-90': 0, '91+': 0
    };
    livingPeople.forEach(p => {
      const age = differenceInYears(new Date(), parseISO(p.birthDate!));
      if (age <= 10) buckets['0-10']++;
      else if (age <= 20) buckets['11-20']++;
      else if (age <= 30) buckets['21-30']++;
      else if (age <= 40) buckets['31-40']++;
      else if (age <= 50) buckets['41-50']++;
      else if (age <= 60) buckets['51-60']++;
      else if (age <= 70) buckets['61-70']++;
      else if (age <= 80) buckets['71-80']++;
      else if (age <= 90) buckets['81-90']++;
      else buckets['91+']++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, 'מספר אנשים': value }));
  }, [people]);

  const livingStatusData = useMemo(() => [
    { name: 'חיים', value: summaryStats.living },
    { name: 'נפטרים', value: summaryStats.deceased },
    { name: 'לא ידוע', value: people.length - summaryStats.living - summaryStats.deceased },
  ].filter(d => d.value > 0), [people.length, summaryStats]);

  const birthMonthData = useMemo(() => {
    const months = Array(12).fill(0);
    people.forEach(p => {
      if (p.birthDate && isValid(parseISO(p.birthDate))) {
        months[getMonth(parseISO(p.birthDate))]++;
      }
    });
    const monthNames = he.localize!.month(0, { width: 'abbreviated' }).constructor.name === 'String' ?
      Array.from({ length: 12 }, (_, i) => he.localize!.month(i, { width: 'long' })) :
      ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

    return monthNames.map((name, index) => ({ name, 'מספר לידות': months[index] }));
  }, [people]);

  const zodiacData = useMemo(() => {
    const signs = people.reduce((acc: { [key: string]: number }, p) => {
      if (p.birthDate && isValid(parseISO(p.birthDate))) {
        const sign = getZodiacSign(parseISO(p.birthDate));
        if (sign) acc[sign] = (acc[sign] || 0) + 1;
      }
      return acc;
    }, {});
    return Object.entries(signs).map(([name, value]) => ({ name, value }));
  }, [people]);

  const topCountriesResidence = useMemo(() => countOccurrences(people.map(p => p.countryOfResidence)).slice(0, 10), [people]);
  const topBirthPlaces = useMemo(() => countOccurrences(people.map(p => p.birthPlace)).slice(0, 10), [people]);
  const topFirstNames = useMemo(() => countOccurrences(people.map(p => p.firstName)).slice(0, 10), [people]);
  const topLastNames = useMemo(() => countOccurrences(people.map(p => p.lastName)).slice(0, 10), [people]);
  
  const religionData = useMemo(() => {
     const religionMap: {[key: string]: string} = {
        'jewish': 'יהדות', 'christian': 'נצרות', 'muslim': 'אסלאם', 
        'buddhist': 'בודהיזם', 'other': 'אחר', '': 'לא צוין'
     };
     const counts = countOccurrences(people.map(p => p.religion || ''));
     return counts.map(c => ({ name: religionMap[c.name] || c.name, value: c.value }));
  }, [people]);

  const birthDecadeData = useMemo(() => {
      const decades = people.reduce((acc: { [key: string]: number }, p) => {
          if (p.birthDate && isValid(parseISO(p.birthDate))) {
              const year = getYear(parseISO(p.birthDate));
              const decade = Math.floor(year / 10) * 10;
              acc[`${decade}s`] = (acc[`${decade}s`] || 0) + 1;
          }
          return acc;
      }, {});
      return Object.entries(decades).map(([name, value]) => ({ name, 'מספר אנשים': value })).sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  const childrenCountData = useMemo(() => {
    const parentChildRels = ['parent', 'adoptive_parent', 'step_parent'];
    const childCounts: { [key: string]: number } = {};
    relationships.forEach(rel => {
      if (parentChildRels.includes(rel.relationshipType)) {
        childCounts[rel.personAId] = (childCounts[rel.personAId] || 0) + 1;
      }
    });
    return Object.entries(childCounts)
      .map(([personId, count]) => {
        const person = people.find(p => p.id === personId);
        return { name: `${person?.firstName || ''} ${person?.lastName || ''}`.trim(), value: count, person };
      })
      .filter(p => p.name)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [people, relationships]);

  const averageLifespan = useMemo(() => {
    const deceasedWithDates = people.filter(p => p.status === 'deceased' && p.birthDate && p.deathDate && isValid(parseISO(p.birthDate)) && isValid(parseISO(p.deathDate)));
    if (deceasedWithDates.length === 0) return 0;
    const totalYears = deceasedWithDates.reduce((sum, p) => sum + differenceInYears(parseISO(p.deathDate!), parseISO(p.birthDate!)), 0);
    return Math.round(totalYears / deceasedWithDates.length);
  }, [people]);

  const profileCompleteness = useMemo(() => {
      if (people.length === 0) return { withPhoto: 0, avgCompleteness: 0 };
      const completenessFields: (keyof Person)[] = ['firstName', 'lastName', 'birthDate', 'birthPlace', 'gender', 'religion', 'countryOfResidence', 'photoURL', 'description'];
      let totalScore = 0;
      let withPhoto = 0;
      people.forEach(p => {
          if (p.photoURL) withPhoto++;
          let score = 0;
          completenessFields.forEach(field => {
              if (p[field]) score++;
          });
          totalScore += (score / completenessFields.length);
      });
      return {
          withPhoto: (withPhoto / people.length) * 100,
          avgCompleteness: (totalScore / people.length) * 100,
      }
  }, [people]);

  // Modal Content Renderers
  const renderModalContent = () => {
    if (!activeModal) return null;

    const peopleList = (
      <Table>
        <TableHeader><TableRow><TableHead>שם</TableHead><TableHead>תאריך לידה</TableHead><TableHead>סטטוס</TableHead></TableRow></TableHeader>
        <TableBody>
          {people.map(p => (
            <TableRow key={p.id}>
              <TableCell><Button variant="link" className="p-0 h-auto" onClick={() => { onEditPerson?.(p.id); setActiveModal(null); }}>{p.firstName} {p.lastName}</Button></TableCell>
              <TableCell>{p.birthDate ? format(new Date(p.birthDate), 'dd/MM/yyyy', { locale: he }) : '–'}</TableCell>
              <TableCell>{p.status === 'alive' ? 'חי' : p.status === 'deceased' ? 'נפטר' : 'לא ידוע'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );

    switch(activeModal) {
      case 'totalPeople': return peopleList;
      case 'living': return (
          <Table>
            <TableHeader><TableRow><TableHead>שם</TableHead><TableHead>גיל</TableHead></TableRow></TableHeader>
            <TableBody>
              {people.filter(p => p.status === 'alive').map(p => (
                <TableRow key={p.id}>
                  <TableCell><Button variant="link" className="p-0 h-auto" onClick={() => { onEditPerson?.(p.id); setActiveModal(null); }}>{p.firstName} {p.lastName}</Button></TableCell>
                  <TableCell>{p.birthDate ? differenceInYears(new Date(), new Date(p.birthDate)) : '–'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      );
      case 'deceased': return (
        <Table>
            <TableHeader><TableRow><TableHead>שם</TableHead><TableHead>תאריך פטירה</TableHead></TableRow></TableHeader>
            <TableBody>
            {people.filter(p => p.status === 'deceased').map(p => (
                <TableRow key={p.id}>
                <TableCell><Button variant="link" className="p-0 h-auto" onClick={() => { onEditPerson?.(p.id); setActiveModal(null); }}>{p.firstName} {p.lastName}</Button></TableCell>
                <TableCell>{p.deathDate ? format(new Date(p.deathDate), 'dd/MM/yyyy', { locale: he }) : '–'}</TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
      );
      case 'gender': return <div className="h-[500px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%" label>{genderData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip content={<CustomTooltip />} /><Legend /></PieChart></ResponsiveContainer></div>;
      case 'age': return (
          <>
            <div className="h-[500px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={ageData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} orientation="right" /><Tooltip content={<CustomTooltip />} /><Bar dataKey="מספר אנשים" fill={COLORS[0]} /></BarChart></ResponsiveContainer></div>
            <Table>
                <TableHeader><TableRow><TableHead>שם</TableHead><TableHead>גיל</TableHead></TableRow></TableHeader>
                <TableBody>
                {people.filter(p => p.status === 'alive' && p.birthDate).sort((a,b) => differenceInYears(new Date(), new Date(b.birthDate!)) - differenceInYears(new Date(), new Date(a.birthDate!))).map(p => (
                    <TableRow key={p.id}>
                    <TableCell><Button variant="link" className="p-0 h-auto" onClick={() => { onEditPerson?.(p.id); setActiveModal(null); }}>{p.firstName} {p.lastName}</Button></TableCell>
                    <TableCell>{differenceInYears(new Date(), new Date(p.birthDate!))}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
          </>
      );
      // Add more cases here for each modal
      default: return null;
    }
  }


  return (
    <>
      <ScrollArea className="h-full w-full">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl">
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
            <StatCard title="סה״כ אנשים" value={summaryStats.totalPeople} icon={<Users />} onClick={() => setActiveModal('totalPeople')} />
            <StatCard title="חיים" value={summaryStats.living} icon={<Smile className="text-green-500" />} onClick={() => setActiveModal('living')} />
            <StatCard title="נפטרו" value={summaryStats.deceased} icon={<Frown className="text-gray-500" />} onClick={() => setActiveModal('deceased')} />
            <StatCard title="סה״כ קשרים" value={summaryStats.totalRelationships} icon={<GitCommit />} />
            <StatCard title="תוחלת חיים ממוצעת" value={`${averageLifespan} שנים`} icon={<Heart />} />
            <StatCard title="טווח שנים בעץ" value={summaryStats.treeSpan} icon={<CalendarClock />} />
            <StatCard title="גיל נישואין ממוצע" value={summaryStats.averageMarriageAge} icon={<Clock />} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            
            <ChartCard title="התפלגות מגדר" dataAvailable={genderData.length > 0} onClick={() => setActiveModal('gender')}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {genderData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ChartCard>

            <ChartCard title="התפלגות סטטוס" dataAvailable={livingStatusData.length > 0} onClick={() => setActiveModal('livingStatus')}>
              <PieChart>
                <Pie data={livingStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {livingStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ChartCard>
            
            <ChartCard title="התפלגות דתית" dataAvailable={religionData.length > 0} onClick={() => setActiveModal('religion')}>
              <PieChart>
                <Pie data={religionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {religionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend />
              </PieChart>
            </ChartCard>
            
            <ChartCard title="התפלגות גילאים (חיים)" dataAvailable={ageData.some(d => d['מספר אנשים'] > 0)} onClick={() => setActiveModal('age')}>
                <BarChart data={ageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} orientation="right" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="מספר אנשים" fill={COLORS[0]} />
                </BarChart>
            </ChartCard>

            <ChartCard title="לידות לפי חודש" dataAvailable={birthMonthData.some(d => d['מספר לידות'] > 0)} onClick={() => setActiveModal('birthMonth')}>
                <BarChart data={birthMonthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} orientation="right" />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="מספר לידות" fill={COLORS[1]} />
                </BarChart>
            </ChartCard>

             <ChartCard title="התפלגות מזלות" dataAvailable={zodiacData.length > 0} onClick={() => setActiveModal('zodiac')}>
              <PieChart>
                <Pie data={zodiacData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {zodiacData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{fontSize: '10px'}}/>
              </PieChart>
            </ChartCard>

            <ChartCard title="לידות לפי עשור" dataAvailable={birthDecadeData.length > 0} onClick={() => setActiveModal('birthDecade')}>
                <BarChart data={birthDecadeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} orientation="right"/>
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="מספר אנשים" fill={COLORS[2]} />
                </BarChart>
            </ChartCard>

            <ChartCard title="10 שמות המשפחה הנפוצים ביותר" dataAvailable={topLastNames.length > 0} onClick={() => setActiveModal('topLastNames')}>
              <BarChart data={topLastNames} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tickLine={false} axisLine={false} orientation="right" reversed/>
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="כמות" layout="vertical" fill={COLORS[3]}>
                   {topLastNames.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ChartCard>
            
             <ChartCard title="10 השמות הפרטיים הנפוצים ביותר" dataAvailable={topFirstNames.length > 0} onClick={() => setActiveModal('topFirstNames')}>
              <BarChart data={topFirstNames} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tickLine={false} axisLine={false} orientation="right" reversed />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="כמות" layout="vertical" fill={COLORS[4]}>
                   {topFirstNames.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ChartCard>

            <ChartCard title="הורים עם הכי הרבה ילדים" dataAvailable={childrenCountData.length > 0} onClick={() => setActiveModal('childrenCount')}>
              <BarChart data={childrenCountData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} orientation="right" reversed />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="מספר ילדים" layout="vertical" fill={COLORS[5]}>
                   {childrenCountData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ChartCard>

            <ChartCard title="10 מדינות המגורים המובילות" dataAvailable={topCountriesResidence.length > 0} onClick={() => setActiveModal('topCountries')}>
              <BarChart data={topCountriesResidence} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tickLine={false} axisLine={false} orientation="right" reversed />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="כמות" layout="vertical" fill={COLORS[6]}>
                   {topCountriesResidence.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ChartCard>

            <ChartCard title="10 מקומות הלידה המובילים" dataAvailable={topBirthPlaces.length > 0} onClick={() => setActiveModal('topBirthPlaces')}>
              <BarChart data={topBirthPlaces} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tickLine={false} axisLine={false} orientation="right" reversed />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="כמות" layout="vertical" fill={COLORS[7]}>
                   {topBirthPlaces.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ChartCard>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveModal('completeness')}>
                <CardHeader><CardTitle className="text-base">שלמות פרופילים</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <div className="flex justify-between mb-1 text-sm">
                            <span>עם תמונה</span>
                            <span>{profileCompleteness.withPhoto.toFixed(0)}%</span>
                        </div>
                        <Progress value={profileCompleteness.withPhoto} />
                    </div>
                    <div>
                        <div className="flex justify-between mb-1 text-sm">
                            <span>מילוי ממוצע</span>
                             <span>{profileCompleteness.avgCompleteness.toFixed(0)}%</span>
                        </div>
                         <Progress value={profileCompleteness.avgCompleteness} />
                    </div>
                    <div className="text-xs text-muted-foreground pt-2">לחץ להרחבה</div>
                </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
      <Dialog open={!!activeModal} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>{activeModal}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            <ScrollArea className="h-full">
              {renderModalContent()}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
