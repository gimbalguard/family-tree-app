import { z } from 'genkit';

const PersonSchema = z.object({
  key: z
    .string()
    .describe(
      "A unique temporary identifier for this person, e.g., 'PERSON_1'."
    ),
  firstName: z.string().describe("The person's first name."),
  lastName: z.string().describe("The person's last name."),
  gender: z
    .enum(['male', 'female', 'other'])
    .describe("The person's inferred gender."),
  birthDate: z
    .string()
    .optional()
    .describe("The person's birth date in YYYY-MM-DD format if available."),
  deathDate: z
    .string()
    .optional()
    .describe("The person's death date in YYYY-MM-DD format if available."),
  status: z
    .enum(['alive', 'deceased', 'unknown'])
    .describe("The person's inferred life status."),
});

const RelationshipSchema = z.object({
  personAKey: z
    .string()
    .describe('The key of the first person in the relationship.'),
  personBKey: z
    .string()
    .describe('The key of the second person in the relationship.'),
  relationshipType: z
    .enum([
      'parent',
      'spouse',
      'adoptive_parent',
      'step_parent',
      'sibling',
      'twin',
      'ex_spouse',
      'guardian',
      'godparent',
    ])
    .describe(
      "The type of relationship. For parent-child, personA should be the parent and personB the child."
    ),
});

export const GenerateTreeInputSchema = z.object({
  story: z
    .string()
    .describe('A natural language description of a family history.'),
  treeName: z.string().describe('A name for the new family tree.'),
});
export type GenerateTreeInput = z.infer<typeof GenerateTreeInputSchema>;

export const GenerateTreeOutputSchema = z.object({
  people: z
    .array(PersonSchema)
    .describe('A list of all individuals extracted from the story.'),
  relationships: z
    .array(RelationshipSchema)
    .describe('A list of all relationships between the individuals.'),
  summary: z
    .string()
    .describe(
      'A short, friendly summary of what was found in the story (e.g., "I found 5 people and 3 relationships.").'
    ),
  clarificationQuestion: z
    .string()
    .nullable()
    .describe(
      'If the story is ambiguous, ask a single, clear question to the user. Otherwise, this should be null.'
    ),
});
export type GenerateTreeOutput = z.infer<typeof GenerateTreeOutputSchema>;
