'use server';
/**
 * @fileOverview An AI assistant for the Shoreshim (Roots) project wizard.
 *
 * - rootsAssistant - A function that guides the user through the project steps.
 */
import { ai } from '@/ai/genkit';
import {
  RootsAssistantInputSchema,
  RootsAssistantOutputSchema,
  type RootsAssistantInput,
  type RootsAssistantOutput,
} from './roots-assistant.types';

export async function rootsAssistant(input: RootsAssistantInput): Promise<RootsAssistantOutput> {
  return rootsAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'rootsAssistantPrompt',
  input: { schema: RootsAssistantInputSchema },
  output: { schema: RootsAssistantOutputSchema },
  system: `אתה מדריך חינוכי מומחה לעבודת שורשים לתלמידי כיתה ז' בישראל.
תפקידך להנחות את התלמיד בבניית עבודת שורשים מקיפה ומרגשת.

כללים:
- שאל שאלה אחת בכל פעם — אל תציף את התלמיד.
- טון: מעודד, חם, סקרן וחינוכי.
- אם התלמיד מדלג על שאלה — כבד את בחירתו ותמשיך.
- הפוך תשובות קצרות לסיפור זורם ומרגש בתוך הפרק.
- אם מזהה אי-דיוק היסטורי (תאריכים, אירועים) — ציין בעדינות ובקש לבדוק.
- היה רגיש אם חסר בן משפחה — אל תתקע את התלמיד.
- השתמש בנתונים מהעץ שסופקו כנקודת פתיחה, אבל תמיד אפשר לתקן.
- תמיד תמיד תמיד תענה בעברית.

נתוני העץ הקיימים (לעיון בלבד):
{{{treeDataSummary}}}`,
  prompt: `---
השלב הנוכחי: {{currentStep}}
ההנחיה לשלב זה: "{{stepInstruction}}"

היסטוריית השיחה לשלב זה:
{{{json stepChatHistory}}}

ההודעה החדשה של התלמיד:
> "{{{newUserMessage}}}"

בהתבסס על ההודעה החדשה, ספק תשובה שיחתית ומעוררת השראה לתלמיד.
בנוסף, נתח את ההודעה ואת הקשר השיחה כדי לחלץ מידע רלוונטי עבור פרויקט השורשים.
החזר את המידע המובנה בשדה 'updatedProjectData'. אם אין מידע חדש לחלץ, החזר אובייקט ריק.
`,
});

const rootsAssistantFlow = ai.defineFlow(
  {
    name: 'rootsAssistantFlow',
    inputSchema: RootsAssistantInputSchema,
    outputSchema: RootsAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
