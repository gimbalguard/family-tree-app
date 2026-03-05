'use server';
/**
 * @fileOverview An AI assistant that generates a biographical description for a person.
 *
 * - generateDescription - A function that generates a biographical description.
 */

import { ai } from '@/ai/genkit';
import {
  GenerateDescriptionInputSchema,
  GenerateDescriptionOutputSchema,
  type GenerateDescriptionInput,
  type GenerateDescriptionOutput,
} from './ai-description-generation.types';

export async function generateDescription(input: GenerateDescriptionInput): Promise<GenerateDescriptionOutput> {
  return generateDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDescriptionPrompt',
  input: { schema: GenerateDescriptionInputSchema },
  output: { schema: GenerateDescriptionOutputSchema },
  prompt: `You are an expert biographer and storyteller. Your task is to write a concise, engaging, and rich biographical description for a person based on the provided details.

Combine all available information to create a coherent narrative. If some information is missing, make reasonable inferences but do not invent facts.

--- Person Details ---
First Name: {{{firstName}}}
Last Name: {{{lastName}}}
{{#if gender}}Gender: {{{gender}}}{{/if}}
{{#if birthDate}}Birth Date: {{{birthDate}}}{{/if}}
{{#if deathDate}}Death Date: {{{deathDate}}}{{/if}}
{{#if birthPlace}}Birth Place: {{{birthPlace}}}{{/if}}
{{#if status}}Status: {{{status}}}{{/if}}
{{#if relationshipsSummary}}Key Relationships: {{{relationshipsSummary}}}{{/if}}
{{#if existingDescription}}Existing Description (use this as a base or to enrich): {{{existingDescription}}}{{/if}}

Generate a biographical description up to 2000 characters. Focus on telling their story in an engaging way.`,
});

const generateDescriptionFlow = ai.defineFlow(
  {
    name: 'generateDescriptionFlow',
    inputSchema: GenerateDescriptionInputSchema,
    outputSchema: GenerateDescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
