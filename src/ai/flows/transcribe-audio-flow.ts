'use server';
/**
 * @fileOverview An AI assistant that transcribes audio to text.
 *
 * - transcribeAudio - A function that handles the audio transcription.
 */

import { ai } from '@/ai/genkit';
import {
  TranscribeAudioInputSchema,
  TranscribeAudioOutputSchema,
  type TranscribeAudioInput,
  type TranscribeAudioOutput,
} from './transcribe-audio.types';

export async function transcribeAudio(
  input: TranscribeAudioInput
): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async (input) => {
    const { text } = await ai.generate({
      prompt: [
        { media: { url: input.audioDataUri } },
        { text: 'Transcribe the following audio. The user is telling a family story. The output should be in Hebrew.' },
      ],
      model: 'googleai/gemini-1.5-flash-latest',
    });

    return { transcript: text };
  }
);
