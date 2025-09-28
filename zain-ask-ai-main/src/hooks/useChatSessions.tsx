import { useState, useCallback, useEffect } from "react";
import { ChatSession } from "@/components/ChatSidebar";
import { chatAPI, Conversation } from "@/api/chat";
import { IReference } from "@/interfaces/database/chat";
import { useFetchDocumentThumbnailsByIds } from "./document-hooks";

export interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  reference?: IReference; // Reference data for document chunks and aggregations
}

export interface ChatSessionWithMessages extends ChatSession {
  messages: Message[];
}

const useChatSessions = () => {
  const [sessions, setSessions] = useState<ChatSessionWithMessages[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState<Set<string>>(new Set());
  const { setDocumentIds } = useFetchDocumentThumbnailsByIds();

  // Extract document IDs from conversation references
  const getDocumentIdsFromConversionReference = useCallback((data: Conversation) => {
    const references = data.reference || [];
    const documentIds = references.reduce(
      (pre: Array<string>, cur: IReference) => {
        cur.doc_aggs
          ?.map((x) => x.doc_id)
          .forEach((x) => {
            if (pre.every((y) => y !== x)) {
              pre.push(x);
            }
          });
        return pre;
      },
      [],
    );
    return documentIds;
  }, []);

  // Load conversations from API
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading conversations...');
      const conversations = await chatAPI.getConversations();
      console.log('Raw conversations from API:', conversations);

      // Convert API conversations to our format (without messages initially)
      const formattedSessions: ChatSessionWithMessages[] = conversations.map((conv: Conversation) => {
        // Find the last user message
        const userMessages = Array.isArray(conv.message) 
          ? conv.message.filter((msg: any) => msg.role !== 'assistant')
          : [];
        const lastUserMessage = userMessages.length > 0 
          ? userMessages[userMessages.length - 1].content 
          : '';

        return {
          id: conv.id,
          title: conv.name,
          lastMessage: lastUserMessage,
          timestamp: new Date(conv.update_time || conv.create_time),
          messageCount: Array.isArray(conv.message) ? conv.message.length : 0,
          messages: [], // Start with empty messages, load on demand
        };
      });

      console.log('Formatted sessions:', formattedSessions);
      setSessions(formattedSessions);

      // Preload document thumbnails for all conversations
      const allDocumentIds: string[] = [];
      conversations.forEach((conv: Conversation) => {
        const docIds = getDocumentIdsFromConversionReference(conv);
        allDocumentIds.push(...docIds);
      });
      const uniqueDocumentIds = [...new Set(allDocumentIds)];
      if (uniqueDocumentIds.length > 0) {
        console.log('Preloading document thumbnails:', uniqueDocumentIds);
        setDocumentIds(uniqueDocumentIds);
      }

      // Set active session to the first one if none is selected
      if (!activeSessionId && formattedSessions.length > 0) {
        setActiveSessionId(formattedSessions[0].id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [activeSessionId]);

  // Load messages for a specific conversation
  const loadConversationMessages = useCallback(async (conversationId: string) => {
    // Prevent multiple simultaneous calls for the same conversation
    if (loadingMessages.has(conversationId)) {
      return [];
    }

    setLoadingMessages(prev => new Set(prev).add(conversationId));

    try {
      console.log('Loading messages for conversation:', conversationId);
      const messages = await chatAPI.getConversationMessages(conversationId);
      console.log('Raw messages from API:', messages);

      // Convert API messages to our format
      const formattedMessages: Message[] = messages.map((msg: any) => ({
        id: msg.id || `${conversationId}-${Date.now()}-${Math.random()}`,
        content: msg.content || '',
        sender: msg.role === 'assistant' ? 'bot' : 'user',
        timestamp: new Date(msg.created_at ? msg.created_at * 1000 : Date.now()),
        reference: msg.reference,
      }));

      // Ensure all message IDs are unique
      const usedIds = new Set<string>();
      const uniqueFormattedMessages = formattedMessages.map((msg, index) => {
        let uniqueId = msg.id;
        let counter = 1;
        while (usedIds.has(uniqueId)) {
          uniqueId = `${msg.id}_${counter}`;
          counter++;
        }
        usedIds.add(uniqueId);
        return { ...msg, id: uniqueId };
      });

      console.log('Formatted messages:', uniqueFormattedMessages);

      // Preload document thumbnails for this conversation
      const conversationDocumentIds: string[] = [];
      uniqueFormattedMessages.forEach((msg: Message) => {
        if (msg.sender === 'bot' && msg.reference?.doc_aggs) {
          conversationDocumentIds.push(...msg.reference.doc_aggs.map(doc => doc.doc_id));
        }
      });
      const uniqueConversationDocumentIds = [...new Set(conversationDocumentIds)];
      if (uniqueConversationDocumentIds.length > 0) {
        console.log('Preloading conversation document thumbnails:', uniqueConversationDocumentIds);
        setDocumentIds(uniqueConversationDocumentIds);
      }

      setSessions(prev => prev.map(session => {
        if (session.id === conversationId) {
          const lastUserMessage = uniqueFormattedMessages.filter(m => m.sender === 'user').pop();
          const lastMessage = lastUserMessage ? lastUserMessage.content : '';
          return {
            ...session,
            messages: uniqueFormattedMessages,
            lastMessage,
            messageCount: uniqueFormattedMessages.length,
          };
        }
        return session;
      }));

      return uniqueFormattedMessages;
    } catch (err) {
      console.error('Failed to load conversation messages:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
      return [];
    } finally {
      setLoadingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(conversationId);
        return newSet;
      });
    }
  }, [loadingMessages]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for active session when it changes
  useEffect(() => {
    console.log('useEffect triggered:', { activeSessionId, sessionsLength: sessions.length, loadingMessages: Array.from(loadingMessages) });
    if (activeSessionId && sessions.length > 0 && !loadingMessages.has(activeSessionId)) {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      console.log('Active session found:', activeSession);
      if (activeSession && activeSession.messages.length === 0 && activeSession.messageCount > 0) {
        console.log('Loading messages for conversation:', activeSessionId);
        loadConversationMessages(activeSessionId);
      } else {
        console.log('Not loading messages:', {
          hasSession: !!activeSession,
          messagesLength: activeSession?.messages.length,
          messageCount: activeSession?.messageCount
        });
      }
    }
  }, [activeSessionId, sessions, loadingMessages]);

  const setActiveSessionIdAndLoadMessages = useCallback(async (sessionId: string | null) => {
    setActiveSessionId(sessionId);
    // Messages will be loaded automatically by the useEffect
  }, []);

  const getActiveSession = useCallback(() => {
    return sessions.find(session => session.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const createNewSession = useCallback(async () => {
    try {
      const newConversation = await chatAPI.createConversation();
      await loadConversations(); // Reload conversations
      setActiveSessionId(newConversation.id);
    } catch (err) {
      console.error('Failed to create conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    }
  }, [loadConversations]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await chatAPI.deleteConversation(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        setActiveSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }, [activeSessionId, sessions]);

  const renameSession = useCallback(async (sessionId: string, newName: string) => {
    try {
      await chatAPI.renameConversation(sessionId, newName);
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, title: newName } : s
      ));
    } catch (err) {
      console.error('Failed to rename conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to rename conversation');
    }
  }, []);

  const addMessage = useCallback((sessionId: string, message: Omit<Message, "id">) => {
    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        // Generate a unique ID
        const existingIds = new Set(session.messages.map(m => m.id));
        let messageId = `${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let counter = 1;
        while (existingIds.has(messageId)) {
          messageId = `${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}_${counter}`;
          counter++;
        }

        const newMessage: Message = { ...message, id: messageId };
        const updatedMessages = [...session.messages, newMessage];
        const lastUserMessage = updatedMessages.filter(m => m.sender === 'user').pop();
        return {
          ...session,
          messages: updatedMessages,
          lastMessage: lastUserMessage ? lastUserMessage.content : '',
          messageCount: updatedMessages.length,
          timestamp: newMessage.timestamp,
        };
      }
      return session;
    }));
  }, []);

  const updateLastMessage = useCallback((sessionId: string, content: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === sessionId) {
        return {
          ...session,
          lastMessage: content,
          timestamp: new Date(),
        };
      }
      return session;
    }));
  }, []);

  return {
    sessions,
    activeSessionId,
    activeSession: getActiveSession(),
    setActiveSessionId: setActiveSessionIdAndLoadMessages,
    createNewSession,
    deleteSession,
    renameSession,
    addMessage,
    updateLastMessage,
    loading,
    error,
    reloadConversations: loadConversations,
    loadConversationMessages,
  };
};

export default useChatSessions;