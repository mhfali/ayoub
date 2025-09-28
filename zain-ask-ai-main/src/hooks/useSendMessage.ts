import { useState, useCallback, useRef } from 'react';
import { EventSourceParserStream } from 'eventsource-parser/stream';

interface UseSendMessageReturn {
  sendMessage: (message: string, sessionId: string, conversationHistory: Array<{content: string, role: 'user' | 'assistant', id?: string, doc_ids?: string[]}>, onChunk: (chunk: string, reference?: any) => void, onEnd: (reference?: any) => void) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const useSendMessage = (): UseSendMessageReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (message: string, sessionId: string, conversationHistory: Array<{content: string, role: 'user' | 'assistant', id?: string, doc_ids?: string[]}>, onChunk: (chunk: string, reference?: any) => void, onEnd: (reference?: any) => void) => {
    setIsLoading(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      // Generate conversation ID from session ID (for now, use session ID as conversation ID)
      const conversationId = sessionId.length === 36 ? sessionId : `conv_${sessionId}_${Date.now()}`;

      // Build messages array for API
      const messages = [
        ...conversationHistory.map(msg => ({
          content: msg.content,
          role: msg.role,
          ...(msg.id && { id: msg.id }),
          ...(msg.doc_ids && { doc_ids: msg.doc_ids })
        })),
        {
          content: message,
          role: 'user' as const,
          id: `user-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          doc_ids: []
        }
      ];

      const apiResponse = await fetch(`${import.meta.env.VITE_BASE_URL}/v1/conversation/completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': import.meta.env.VITE_TOKEN,
        },
        body: JSON.stringify({
          conversation_id: sessionId, // Use the real session ID
          messages: messages,
        }),
        signal: abortControllerRef.current.signal,
      });

      console.log('API Response status:', apiResponse.status);
      console.log('API Response headers:', Object.fromEntries(apiResponse.headers.entries()));

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.log('API Error response:', errorText);
        throw new Error(`Failed to send message: ${apiResponse.status} - ${errorText}`);
      }

      const reader = apiResponse.body
        ?.pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream())
        .getReader();

      let accumulatedResponse = '';
      let referenceData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        console.log('Raw streaming chunk:', value);

        try {
          const val = JSON.parse(value?.data || '');
          const d = val?.data;
          
          // Check if this is the done signal (data: true)
          if (d === true) {
            console.log('Stream done');
            onEnd(referenceData);
            break;
          }
          
          // Check if this contains the answer
          if (d && typeof d === 'object' && d.answer) {
            accumulatedResponse = d.answer; // Replace with the full accumulated answer
            referenceData = d.reference; // Extract reference data
            onChunk(accumulatedResponse, referenceData); // Pass the accumulated response and reference
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopMessage = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  return {
    sendMessage,
    isLoading,
    error,
  };
};