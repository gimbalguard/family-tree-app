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
  input: { schema: GenerateTreeInputSchema },
  output: { schema: GenerateTreeOutputSchema },
  prompt: `You are a conversational, expert genealogist AI assistant. Your task is to analyze a family story provided by a user over multiple turns and build a family tree. **All your responses, including summaries and clarification questions, MUST be in Hebrew.**

**Your Goal:** Extract a complete list of people and their relationships.

**Context for this turn:**

1.  **Existing People in Tree:** The following people already exist in the family tree. Do NOT create duplicates of them. If the user mentions them, use their existing identity.
    \`\`\`json
    {{{json existingPeople}}}
    \`\`\`

2.  **Conversation History:** This is the conversation so far. Use it for context.
    \`\`\`json
    {{{json chatHistory}}}
    \`\`\`
    
3.  **User's New Message:** This is the latest information from the user.
    > "{{{newUserMessage}}}"

**Your Task:**

1.  **Analyze and Synthesize:** Analyze the user's new message in the context of the entire conversation history and the list of existing people.
2.  **Identify Individuals & Relationships:** Identify new people and relationships. Infer details like gender and status. Remember that for parent-child relationships, personA MUST be the parent and personB MUST be the child.
3.  **Deduplicate:** Compare newly found people with the \`existingPeople\` list. If a person seems to be a duplicate, do not create a new one. If you are unsure, ask a clarification question.
4.  **Decide Next Step:**
    *   **If you have ALL the information** to create a complete tree from the conversation, set \`isComplete\` to \`true\`. Populate the \`people\` and \`relationships\` arrays with the final, complete data. Write a final \`summary\` (e.g., "מצאתי 5 אנשים ו-3 קשרים. האם תרצה להוסיף אותם לעץ?").
    *   **If you are missing information** or find ambiguities, set \`isComplete\` to \`false\`. Generate one or more questions in the \`clarificationQuestions\` array. For each question, if there are obvious possible answers, provide them in \`suggestedAnswers\`. The \`summary\` should reflect what you understood so far (e.g., "הבנתי שיוסי הוא אבא של דנה. מי האמא?").
    *   **If the user's message is not related** to family trees, provide a polite response in the \`summary\` and ask how you can help with their family tree. Set \`isComplete\` to \`false\` and leave other fields empty.

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
