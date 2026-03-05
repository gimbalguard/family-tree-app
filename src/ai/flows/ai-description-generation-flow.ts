'use server';
/**
 * @fileOverview An AI assistant that generates a biographical description for a person.
 *
 * - generateDescription - A function that generates a biographical description.
 * - GenerateDescriptionInput - The input type for the generateDescription function.
 * - GenerateDescriptionOutput - The return type for the generateDescription function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateDescriptionInputSchema = z.object({
  firstName: z.string().describe("The person's first name."),
  lastName: z.string().describe("The person's last name."),
  gender: z.enum(['male', 'female', 'other']).optional().describe("The person's gender."),
  birthDate: z.string().optional().describe("The person's birth date in YYYY-MM-DD format."),
  deathDate: z.string().optional().describe("The person's death date in YYYY-MM-DD format."),
  birthPlace: z.string().optional().describe("The person's place of birth."),
  status: z.enum(['alive', 'deceased', 'unknown']).optional().describe("The person's current status."),
  relationshipsSummary: z.string().optional().describe("A summary of the person's key relationships, e.g., 'Spouse: Jane Doe, Children: John Doe Jr., Emily Doe'."),
  existingDescription: z.string().optional().describe("An existing description to enrich or use as a starting point.")
});
export type GenerateDescriptionInput = z.infer<typeof GenerateDescriptionInputSchema>;

const GenerateDescriptionOutputSchema = z.object({
  description: z.string().describe("A rich biographical description of the person."),
});
export type GenerateDescriptionOutput = z.infer<typeof GenerateDescriptionOutputSchema>;

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
