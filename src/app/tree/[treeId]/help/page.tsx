'use client';

import { useState, useMemo, useEffect } from 'react';
import { AppHeader } from '@/components/app-header';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const wikiContent = [
  {
    category: 'תחילת עבודה',
    articles: [
      {
        id: 'what-is-familytree',
        title: 'מה זה FamilyTree?',
        content: `
          <p>FamilyTree היא פלטפורמה מודרנית ואינטראקטיבית לבנייה וניהול של עצי משפחה. היא מאפשרת לך לתעד את ההיסטוריה המשפחתית שלך, להוסיף אנשים, להגדיר קשרים ביניהם, ולהציג את המידע במגוון תצוגות ויזואליות.</p>
          <p>המטרה היא להפוך את תהליך חקר השורשים לחוויה מהנה, נגישה ומשתפת.</p>
        `,
      },
      {
        id: 'add-first-person',
        title: 'איך להוסיף אדם ראשון',
        content: `
          <p>הדרך הקלה ביותר להתחיל היא להוסיף את עצמך. כך עושים זאת:</p>
          <ol>
            <li>לחץ על כפתור "הוסף אדם חדש" בסרגל הכלים הצדדי.</li>
            <li>בחלון שנפתח, מלא את שמך הפרטי ושם המשפחה שלך.</li>
            <li>מומלץ למלא כמה שיותר פרטים, כמו תאריך לידה, מין ומקום לידה.</li>
            <li>לחץ על "צור אדם" כדי לשמור. האדם החדש יופיע על קנבס העץ.</li>
          </ol>
        `,
      },
      {
        id: 'connect-people',
        title: 'איך לחבר בין אנשים',
        content: `
          <p>יצירת קשרים היא לב ליבו של עץ המשפחה. כדי לחבר בין שני אנשים:</p>
          <ol>
            <li>ודא ששני האנשים קיימים על קנבס העץ.</li>
            <li>לחץ על אחת מנקודות החיבור (עיגולים קטנים) שעל גבי כרטיס של אדם אחד, וגרור את קו החיבור אל כרטיס של אדם אחר.</li>
            <li>בחלון "הגדרת קשר" שנפתח, בחר את סוג הקשר ביניהם (למשל, "אבא", "נשואים").</li>
            <li>לחץ על "שמור קשר". קו יופיע בין שני האנשים כדי לסמל את הקשר.</li>
          </ol>
        `,
      },
    ],
  },
  {
    category: 'ניהול אנשים',
    articles: [
      {
        id: 'edit-person',
        title: 'עריכת פרטי אדם',
        content: `
          <p>ניתן לעדכן פרטים של כל אדם בכל עת. פשוט לחץ לחיצה כפולה על כרטיס האדם בקנבס העץ, או מצא אותו בתצוגת הטבלה ולחץ על כפתור העריכה. בחלון העריכה תוכל לשנות את כל הפרטים, להוסיף תיאור ביוגרפי, קישורים לרשתות חברתיות ועוד.</p>
        `,
      },
      {
        id: 'upload-photo',
        title: 'העלאת תמונה',
        content: `
          <p>תמונה אישית מוסיפה חיים לעץ. בחלון עריכת האדם, תוכל לראות אזור המיועד לתמונה. ניתן לגרור קובץ תמונה מהמחשב אל האזור המקווקו, ללחוץ עליו כדי לבחור קובץ, או להדביק קישור לתמונה משירות חיצוני.</p>
        `,
      },
      {
        id: 'status-and-dates',
        title: 'הגדרת סטטוס ותאריכים',
        content: `
          <p>תאריכי לידה ופטירה הם פרטים חשובים. כאשר אתה מוסיף תאריך פטירה, סטטוס האדם ישתנה אוטומטית ל"נפטר". ניתן גם להגדיר את הסטטוס ידנית ("חי", "נפטר", "לא ידוע"). מידע זה משפיע על חישובים בתצוגת הסטטיסטיקות וציר הזמן.</p>
        `,
      },
    ],
  },
  {
    category: 'תצוגות',
    articles: [
      { id: 'tree-view', title: 'תצוגת עץ (Canvas)', content: '<p>התצוגה הראשית והאינטראקטיבית ביותר. כאן תוכל להזיז אנשים, ליצור קשרים ביניהם, ולראות את מבנה המשפחה בצורה ויזואלית. השתמש בעכבר כדי לגרור את הקנבס ולגלול כדי להתקרב ולהתרחק.</p>' },
      { id: 'table-view', title: 'תצוגת טבלה', content: '<p>תצוגה זו מציגה את כל האנשים בעץ בטבלה מסודרת. היא מאפשרת למיין ולסנן את הנתונים לפי כל עמודה, ולערוך פרטים ישירות מהטבלה. שימושית במיוחד לניהול עצים גדולים.</p>' },
      { id: 'map-view', title: 'תצוגת מפה', content: '<p>אם הוספת מקומות לידה או מגורים לאנשים בעץ, תצוגת המפה תציג אותם על גבי מפה עולמית. זה מאפשר לראות את הפיזור הגיאוגרפי של המשפחה לאורך הדורות.</p>' },
      { id: 'calendar-view', title: 'תצוגת לוח שנה', content: '<p>לוח השנה מרכז את כל האירועים החשובים: ימי הולדת, ימי נישואין, ימי פטירה, וחגים. ניתן להוסיף גם אירועים מותאמים אישית. אפשר לעבור בין תצוגת חודש, שבוע ויום.</p>' },
      { id: 'statistics-view', title: 'תצוגת סטטיסטיקות', content: '<p>דשבורד שלם עם ניתוחים סטטיסטיים על עץ המשפחה שלך. תוכל לראות התפלגויות גילאים, מגדר, שמות נפוצים, ממוצעים ועוד המון נתונים מעניינים על המשפחה.</p>' },
    ],
  },
   {
    category: 'קשרים',
    articles: [
      { id: 'relationship-types', title: 'סוגי קשרים', content: '<p>המערכת תומכת במגוון רחב של קשרים, כולל הורים, בני זוג, אחים, תאומים, קשרי אימוץ, אפוטרופוסים ועוד. בחירת הקשר הנכון מבטיחה שהעץ יוצג בצורה מדויקת.</p>' },
      { id: 'add-relationship', title: 'הוספת קשר', content: '<p>כדי להוסיף קשר, גרור קו בין שתי נקודות חיבור על כרטיסי האנשים בקנבס העץ. בחלון שייפתח, בחר את סוג הקשר. המערכת תזהה אוטומטית מי ההורה ומי הילד בהתבסס על נקודות החיבור (עליונה/תחתונה).</p>' },
      { id: 'edit-relationship', title: 'עריכת קשר', content: '<p>כדי לערוך קשר קיים, לחץ לחיצה כפולה על קו החיבור בין שני אנשים בקנבס העץ. בחלון העריכה תוכל לשנות את סוג הקשר, להוסיף תאריכי התחלה וסיום (כמו תאריך נישואין) והערות.</p>' },
    ],
  },
  {
    category: 'כללי',
    articles: [
        { id: 'faq', title: 'שאלות נפוצות', content: '<p>כאן יופיעו תשובות לשאלות נפוצות של משתמשים.</p>' },
        { id: 'privacy-security', title: 'פרטיות ואבטחה', content: '<p>כל המידע שאתה מזין לעץ המשפחה שלך הוא פרטי ושייך לך בלבד. הנתונים מאובטחים בסטנדרטים הגבוהים ביותר ואף אחד לא יכול לגשת אליהם ללא הרשאתך.</p>' },
        { id: 'contact-us', title: 'יצירת קשר', content: '<p>נתקלת בבעיה? יש לך הצעה לשיפור? נשמח לשמוע ממך. ניתן ליצור קשר דרך עמוד התמיכה באתר.</p>' },
    ],
  }
];

type Article = { id: string; title: string; content: string };
type Category = { category: string; articles: Article[] };

function WikiSidebar({ content, activeId, onSelect }: { content: Category[], activeId: string, onSelect: (id: string) => void }) {
  return (
    <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r p-4 h-auto md:h-screen md:sticky top-0 bg-muted/20">
      <h2 className="font-bold mb-4 text-lg text-primary text-right">מרכז העזרה</h2>
      <ScrollArea className="h-full max-h-48 md:max-h-full md:h-[calc(100vh-220px)]">
        <nav className="space-y-4 pr-2">
          {content.map((cat) => (
            <div key={cat.category}>
              <h3 className="font-semibold text-gray-800 mb-2 text-right">{cat.category}</h3>
              <ul className="space-y-1">
                {cat.articles.map((article) => (
                  <li key={article.id}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start h-auto py-1 px-2 text-sm text-muted-foreground hover:text-primary/80 hover:bg-primary/5 text-right",
                        activeId === article.id && "text-primary bg-primary/10 font-bold"
                      )}
                      onClick={() => onSelect(article.id)}
                    >
                      {article.title}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

function WikiContent({ article }: { article: Article }) {
    return (
        <article className="prose prose-sm lg:prose-base max-w-none text-right">
            <h1 className="text-3xl font-bold mb-4 border-b pb-2 text-primary">{article.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: article.content }} className="space-y-4 text-foreground/90" />
        </article>
    )
}

function SearchResults({ results, onSelect }: { results: Article[], onSelect: (id: string) => void }) {
    if (results.length === 0) {
        return <div className="text-center text-muted-foreground mt-16">לא נמצאו תוצאות לחיפוש שלך.</div>
    }
    return (
        <div className="text-right">
            <h1 className="text-2xl font-bold mb-6">תוצאות חיפוש</h1>
            <div className="space-y-6">
                {results.map(article => (
                    <div key={article.id}>
                        <h2 className="text-xl font-semibold text-primary hover:underline cursor-pointer" onClick={() => onSelect(article.id)}>
                            {article.title}
                        </h2>
                        <div 
                            className="text-sm text-muted-foreground line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: article.content }} 
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}


export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeArticleId, setActiveArticleId] = useState(wikiContent[0].articles[0].id);

  const allArticles = useMemo(() => wikiContent.flatMap(cat => cat.articles), []);

  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const lowercasedTerm = searchTerm.toLowerCase();
    return allArticles.filter(
      article =>
        article.title.toLowerCase().includes(lowercasedTerm) ||
        article.content.toLowerCase().includes(lowercasedTerm)
    );
  }, [searchTerm, allArticles]);

  const activeArticle = useMemo(() => {
    return allArticles.find(a => a.id === activeArticleId) ?? allArticles[0];
  }, [activeArticleId, allArticles]);

  const handleSelectArticle = (id: string) => {
    setActiveArticleId(id);
    setSearchTerm('');
    document.getElementById('main-content')?.scrollTo(0, 0);
  };
  
  useEffect(() => {
      if (!searchTerm) {
          setActiveArticleId(prevId => allArticles.find(a => a.id === prevId) ? prevId : allArticles[0].id);
      }
  }, [searchTerm, allArticles]);

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1">
        <div className="flex flex-col md:flex-row">
            <WikiSidebar content={wikiContent} activeId={activeArticleId} onSelect={handleSelectArticle} />
            
            <div className="flex-1 p-6 md:p-10">
                <div className="relative mb-8 max-w-2xl">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder="חפש במרכז העזרה..."
                    className="pl-12 text-base h-12 rounded-lg border-2 border-transparent focus:border-primary transition-colors bg-muted/40 text-right"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                </div>
                <ScrollArea id="main-content" className="h-[calc(100vh-220px)]">
                <div className="pl-4">
                    {searchTerm ? (
                        <SearchResults results={searchResults} onSelect={handleSelectArticle} />
                    ) : (
                        <WikiContent article={activeArticle} />
                    )}
                </div>
                </ScrollArea>
            </div>
        </div>
      </main>
    </div>
  );
}
