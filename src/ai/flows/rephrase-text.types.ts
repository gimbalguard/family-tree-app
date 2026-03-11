import { z } from 'genkit';

export const RephraseTextInputSchema = z.object({
  textToRephrase: z.string().describe("The original text written by the user."),
  fieldName: z.string().describe("The name of the field the text belongs to (e.g., 'משמעות שמי')."),
});
export type RephraseTextInput = z.infer<typeof RephraseTextInputSchema>;

export const RephraseTextOutputSchema = z.object({
  rephrasedText: z.string().describe("The improved, rephrased text."),
});
export type RephraseTextOutput = z.infer<typeof RephraseTextOutputSchema>;
