'use server';
import {genkit} from 'genkit';
import {googleAI as googleAIPlugin} from '@genkit-ai/google-genai';

// Instantiate the plugin and export it so it can be used to qualify model names.
export const googleAI = googleAIPlugin();

export const ai = genkit({
  plugins: [googleAI],
  model: googleAI.model('gemini-pro'),
});
