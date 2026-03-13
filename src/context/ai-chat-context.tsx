'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { GenerateTreeOutput } from '@/ai/flows/ai-tree-generation.types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: React.ReactNode;
  textContent: string;
  data?: GenerateTreeOutput | null;
}

interface AiChatContextType {
  chatHistory: ChatMessage[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isGenerating: boolean;
  setIsGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  isTranscribing: boolean;
  setIsTranscribing: React.Dispatch<React.SetStateAction<boolean>>;
  clearChat: () => void;
}

const AiChatContext = createContext<AiChatContextType | undefined>(undefined);

export const AiChatProvider = ({ children }: { children: ReactNode }) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const clearChat = () => {
    setChatHistory([]);
  };

  return (
    <AiChatContext.Provider value={{
      chatHistory,
      setChatHistory,
      isGenerating,
      setIsGenerating,
      isTranscribing,
      setIsTranscribing,
      clearChat,
    }}>
      {children}
    </AiChatContext.Provider>
  );
};

export const useAiChat = () => {
  const context = useContext(AiChatContext);
  if (!context) {
    throw new Error('useAiChat must be used within an AiChatProvider');
  }
  return context;
};
