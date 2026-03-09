'use server';
/**
 * @fileOverview An AI assistant that generates family trivia questions.
 *
 * - generateTrivia - A function that handles the trivia generation process.
 */

import { ai } from '@/ai/genkit';
import {
  TriviaGameInputSchema,
  TriviaGameOutputSchema,
  type TriviaGameInput,
  type TriviaGameOutput,
} from './trivia-generation.types';

export async function generateTrivia(input: TriviaGameInput): Promise<TriviaGameOutput> {
  return generateTriviaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTriviaPrompt',
  input: { schema: TriviaGameInputSchema },
  output: { schema: TriviaGameOutputSchema },
  prompt: `You are generating a family trivia game based on real family tree data.
Family data: {{{json familyData}}}
Generate {{{questionCount}}} trivia questions in Hebrew.
Difficulty: {{{difficulty}}}
Topics: {{{json topics}}}

If a person has a non-empty "description" field, use it to generate additional questions about their profession, life story, personality traits, or any specific details mentioned in that description.
For example: if the description says "היה רופא ילדים שעבד 40 שנה בבית חולים", generate a question like "מה היה מקצועו של [name]?" with plausible wrong answers.
Only generate description-based questions if the description contains meaningful content (more than 10 characters).
Mix description-based questions naturally with the other question types.

Return ONLY a valid JSON array with no extra text, no markdown, no backticks. Structure:
[{
  "question": "...",
  "options": ["א. ...", "ב. ...", "ג. ...", "ד. ..."],
  "correctIndex": 0,
  "explanation": "...",
  "topic": "..."
}]
`,
});

const generateTriviaFlow = ai.defineFlow(
  {
    name: 'generateTriviaFlow',
    inputSchema: TriviaGameInputSchema,
    outputSchema: TriviaGameOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
