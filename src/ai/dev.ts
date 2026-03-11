'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/ai-description-generation-flow.ts';
import '@/ai/flows/ai-tree-generation-flow.ts';
import '@/ai/flows/transcribe-audio-flow.ts';
import '@/ai/flows/trivia-generation-flow.ts';
import '@/ai/flows/roots-assistant-flow.ts';
import '@/ai/flows/rephrase-text-flow.ts';
