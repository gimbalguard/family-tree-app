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
      'separated',
      'partner',
      'ex_partner',
      'step_sibling',
    ])
    .describe(
      "The type of relationship. For parent-child, personA should be the parent and personB the child."
    ),
});


const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const ExistingPersonSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
});

export const GenerateTreeInputSchema = z.object({
  newUserMessage: z.string().describe("The newest message from the user."),
  treeName: z.string().describe('A name for the new family tree.'),
  chatHistory: z.array(ChatMessageSchema).describe("The history of the conversation so far."),
  existingPeople: z.array(ExistingPersonSchema).describe("A list of people who already exist in the tree to avoid duplicates."),
  photoDataUri: z
    .string()
    .optional()
    .describe(
      "A photo attached by the user, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateTreeInput = z.infer<typeof GenerateTreeInputSchema>;

const ClarificationQuestionSchema = z.object({
  question: z.string().describe("The question to ask the user for clarification."),
  suggestedAnswers: z.array(z.string()).optional().describe("A list of suggested single-click answers for the user."),
});

export const GenerateTreeOutputSchema = z.object({
  people: z.array(PersonSchema).optional().describe('A list of all individuals extracted from the story. This is only provided when the tree is complete.'),
  relationships: z.array(RelationshipSchema).optional().describe('A list of all relationships between the individuals. This is only provided when the tree is complete.'),
  summary: z.string().describe('A short, friendly summary of what was found or the current state of the conversation (e.g., "I found 5 people and 3 relationships." or "OK, I understood that. Now, what is the relationship between...").'),
  clarificationQuestions: z.array(ClarificationQuestionSchema).optional().describe('If the story is ambiguous, ask one or more clear questions to the user. Otherwise, this should be null or empty.'),
  isComplete: z.boolean().describe("Set to true only when you have all the information and are ready to present the final tree structure."),
});
export type GenerateTreeOutput = z.infer<typeof GenerateTreeOutputSchema>;
