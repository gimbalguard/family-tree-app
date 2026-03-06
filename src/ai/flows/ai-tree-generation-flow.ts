'use server';
/**
 * @fileOverview An AI assistant that generates a family tree structure from a user's story.
 *
 * - generateTreeFromStory - A function that handles the tree generation process.
 */

import { ai } from '@/ai/genkit';
import {
  GenerateTreeInputSchema,
  GenerateTreeOutputSchema,
  type GenerateTreeInput,
  type GenerateTreeOutput,
} from './ai-tree-generation.types';

// The exported function that will be called by the client
export async function generateTreeFromStory(
  input: GenerateTreeInput
): Promise<GenerateTreeOutput> {
  return generateTreeFlow(input);
}

// The prompt definition
const prompt = ai.definePrompt({
  name: 'generateTreePrompt',
  model: 'googleai/gemini-2.0-flash-001',
  input: { schema: GenerateTreeInputSchema },
  output: { schema: GenerateTreeOutputSchema },
  prompt: `You are an expert genealogist AI assistant. Your task is to analyze a family story provided by the user and extract all individuals and their relationships to build a family tree structure. **All your responses, including summaries and clarification questions, MUST be in Hebrew.**

Carefully read the user's story:
"{{{story}}}"

Based on the story, perform the following actions:
1.  **Identify Individuals**: Create a list of all unique individuals.
    *   Assign a unique 'key' to each person (e.g., "PERSON_1", "PERSON_2").
    *   Extract their first name and last name.
    *   Infer their gender ('male', 'female', 'other') from their name or relationships (e.g., 'wife' is female, 'father' is male). If gender is ambiguous, use 'other'.
    *   Infer their status ('alive', 'deceased', 'unknown'). If a death date is mentioned, they are 'deceased'. If not specified, assume 'alive' unless context suggests otherwise.
    *   Extract birth and death dates if provided.

2.  **Identify Relationships**: Create a list of relationships connecting the individuals you identified.
    *   Use the unique 'key' you assigned to each person to define the relationship between 'personAKey' and 'personBKey'.
    *   **Crucially, for parent-child relationships ('parent', 'step_parent', 'adoptive_parent'), 'personAKey' MUST be the parent and 'personBKey' MUST be the child.**
    *   For symmetrical relationships like 'spouse' or 'sibling', the order does not matter.
    *   Infer relationship types accurately (e.g., "my wife" is a 'spouse' relationship).

3.  **Summarize Findings**: Write a brief, one-sentence summary of your findings (e.g., "מצאתי 5 אנשים ו-3 קשרים בסיפור שלך.").

4.  **Ask for Clarification (if needed)**: If any part of the story is ambiguous or information is missing to establish a clear relationship, formulate a single, simple question to ask the user. For example, "מי ההורה של דוד, יוני או ג'יין?" or "מה הקשר בין שרה למייק?". If everything is clear, set this field to null.

Produce the final output in the specified JSON format.
`,
});

// The Genkit flow
const generateTreeFlow = ai.defineFlow(
  {
    name: 'generateTreeFlow',
    inputSchema: GenerateTreeInputSchema,
    outputSchema: GenerateTreeOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
