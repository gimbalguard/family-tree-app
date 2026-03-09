import { z } from 'genkit';

const QuestionSchema = z.object({
    question: z.string().describe("The trivia question text."),
    options: z.array(z.string()).length(4).describe("An array of 4 multiple-choice answers."),
    correctIndex: z.number().min(0).max(3).describe("The 0-based index of the correct answer in the options array."),
    explanation: z.string().describe("A brief explanation for the correct answer."),
    topic: z.string().describe("The topic of the question (e.g., 'קשרי משפחה', 'תאריכים').")
});

export const TriviaGameInputSchema = z.object({
    familyData: z.any().describe("The family tree data as a JSON object containing people and relationships."),
    questionCount: z.number().describe("The number of questions to generate."),
    difficulty: z.string().describe("The desired difficulty level for the questions."),
    topics: z.array(z.string()).describe("An array of topics to generate questions from.")
});
export type TriviaGameInput = z.infer<typeof TriviaGameInputSchema>;

export const TriviaGameOutputSchema = z.array(QuestionSchema);
export type TriviaGameOutput = z.infer<typeof TriviaGameOutputSchema>;
