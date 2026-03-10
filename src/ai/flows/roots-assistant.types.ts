import { z } from 'genkit';

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

export const RootsAssistantInputSchema = z.object({
  currentStep: z.number(),
  stepInstruction: z.string(),
  treeDataSummary: z.string().optional(),
  stepChatHistory: z.array(ChatMessageSchema),
  newUserMessage: z.string(),
});

export type RootsAssistantInput = z.infer<typeof RootsAssistantInputSchema>;

// Define a partial schema for the data that can be updated
const CoverPageSchema = z.object({
    title: z.string().optional(),
    studentName: z.string().optional(),
    teacherName: z.string().optional(),
    submissionDate: z.string().optional(),
    className: z.string().optional(),
  }).deepPartial().optional();

const UpdatedProjectDataSchema = z.object({
    projectName: z.string().optional(),
    coverPage: CoverPageSchema,
    // Add other steps data structure later as they become defined
  }).deepPartial().optional();

export const RootsAssistantOutputSchema = z.object({
  aiResponse: z.string().describe("The AI's conversational response to the student in Hebrew."),
  updatedProjectData: UpdatedProjectDataSchema.describe("Any structured data extracted from the user's message. Return an empty object if no new data was found."),
});

export type RootsAssistantOutput = z.infer<typeof RootsAssistantOutputSchema>;
