'use server';
/**
 * @fileOverview An AI assistant that rephrases text for a school project.
 *
 * - rephraseText - A function that handles the text rephrasing.
 */

import { ai } from '@/ai/genkit';
import {
    RephraseTextInputSchema,
    RephraseTextOutputSchema,
    type RephraseTextInput,
    type RephraseTextOutput,
} from './rephrase-text.types';

export async function rephraseText(input: RephraseTextInput): Promise<RephraseTextOutput> {
  return rephraseTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'rephraseTextPrompt',
  input: { schema: RephraseTextInputSchema },
  output: { schema: RephraseTextOutputSchema },
  prompt: `אתה עוזר לתלמיד ישראלי לכתוב עבודת שורשים. התלמיד כתב את הטקסט הבא בשדה "{{fieldName}}".
            
תפקידך:
1. לתקן שגיאות כתיב ודקדוק בעברית
2. לשפר את הניסוח כך שיישמע מקצועי ויפה יותר
3. לשמור על הסגנון האישי של התלמיד ועל התוכן המקורי
4. לכתוב בגוף ראשון (אני/אנחנו)
5. לא להוסיף מידע שלא היה בטקסט המקורי

הטקסט המקורי:
"{{textToRephrase}}"

החזר אך ורק את הטקסט המשופר, ללא הסברים, ללא מרכאות.`,
});

const rephraseTextFlow = ai.defineFlow(
  {
    name: 'rephraseTextFlow',
    inputSchema: RephraseTextInputSchema,
    outputSchema: RephraseTextOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("AI did not return a valid rephrased text.");
    }
    return output;
  }
);
