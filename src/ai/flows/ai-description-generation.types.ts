import { z } from 'genkit';

export const GenerateDescriptionInputSchema = z.object({
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

export const GenerateDescriptionOutputSchema = z.object({
  description: z.string().describe("A rich biographical description of the person."),
});
export type GenerateDescriptionOutput = z.infer<typeof GenerateDescriptionOutputSchema>;
