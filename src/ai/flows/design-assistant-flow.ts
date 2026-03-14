'use server';
/**
 * @fileOverview An AI assistant for editing Shoreshim project presentation pages.
 *
 * - runDesignAssistant - A function that modifies page elements based on a user prompt.
 */
import { ai } from '@/ai/genkit';
import {
  DesignAssistantInputSchema,
  DesignAssistantOutputSchema,
  type DesignAssistantInput,
  type DesignAssistantOutput,
} from './design-assistant.types';

export async function runDesignAssistant(input: DesignAssistantInput): Promise<DesignAssistantOutput> {
  return designAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'designAssistantPrompt',
  input: { schema: DesignAssistantInputSchema },
  output: { schema: DesignAssistantOutputSchema },
  system: `You are an expert UI/UX designer and graphic artist specializing in presentation layouts for school projects.
Your task is to programmatically modify a JSON structure representing a presentation slide based on a user's request.

**CRITICAL RULES:**
1.  **PRESERVE IDs:** You MUST NOT change the 'id' of any element.
2.  **DO NOT ADD/REMOVE ELEMENTS:** Only modify the properties of existing elements unless explicitly asked to "delete" or "add" something.
3.  **RETURN ALL ELEMENTS:** The output 'updatedElements' array must contain ALL elements from the input, even those that were not modified.
4.  **STAY WITHIN BOUNDS:** All coordinates (x, y) and dimensions (width, height) are percentages of the page. They MUST be between 0 and 100.
5.  **FONT NAMES:** When changing fonts, only use font names from this exact list: 'Assistant', 'Heebo', 'Rubik', 'Frank Ruhl Libre', 'Alef', 'Secular One', 'Suez One', 'David Libre', 'Miriam Libre', 'Varela Round'.
6.  **COLORS:** All color values must be valid hex codes (e.g., '#RRGGBB').
7.  **BE CREATIVE BUT ACCURATE:** Interpret user requests creatively but precisely. "Make it look nicer" could mean adjusting alignment, spacing, and colors. "Make text bigger" means increasing the 'fontSize' property.
8.  **HEBREW CONTEXT:** The project is in Hebrew. Alignments should be right-to-left by default.

**INPUT JSON STRUCTURE:**
You will receive a JSON object with 'elements' (an array of DesignElement objects) and a 'prompt' (the user's request).

**OUTPUT JSON STRUCTURE:**
You MUST return a JSON object with a single key: 'updatedElements', containing the full, modified array of all elements.`,
  prompt: `User request: "{{{prompt}}}"

Current page elements JSON:
\`\`\`json
{{{json elements}}}
\`\`\`

Based on the user request, modify the JSON array of elements and return the complete, updated array.`,
});


const designAssistantFlow = ai.defineFlow(
  {
    name: 'designAssistantFlow',
    inputSchema: DesignAssistantInputSchema,
    outputSchema: DesignAssistantOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output?.updatedElements) {
      throw new Error("AI did not return a valid 'updatedElements' array.");
    }
    return output;
  }
);
