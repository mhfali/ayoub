import { Message } from '../hooks/useChatSessions';

export interface Conversation {
  id: string;
  name: string;
  create_time: number;
  update_time: number;
  message?: any[]; // The actual messages stored in the conversation
  reference?: any[];
  user_id?: string;
  dialog_id?: string;
}

export interface ChatAPIResponse {
  code: number;
  data: any;
  message: string;
}

class ChatAPI {
  private baseURL = import.meta.env.VITE_BASE_URL;
  private token = import.meta.env.VITE_TOKEN;

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.code !== 0) {
      throw new Error(data.message || 'API request failed');
    }

    return data.data;
  }

  // Get list of conversations
  async getConversations(): Promise<Conversation[]> {
    return this.request(`/v1/conversation/list?dialog_id=${import.meta.env.VITE_DIALOG_ID}`);
  }

  // Create a new conversation
  async createConversation(name?: string): Promise<Conversation> {
    return this.request('/v1/conversation/set', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        is_new: true,
        name: name || 'New Chat',
        dialog_id: import.meta.env.VITE_DIALOG_ID, // Using the same dialog_id as in the list endpoint
      }),
    });
  }

  // Get conversation details with messages
  async getConversation(conversationId: string): Promise<Conversation> {
    return this.request(`/v1/conversation/get?conversation_id=${conversationId}`);
  }

  // Delete a conversation
  async deleteConversation(conversationId: string): Promise<void> {
    return this.request('/v1/conversation/rm', {
      method: 'POST',
      body: JSON.stringify({
        conversation_ids: [conversationId],
        dialog_id: import.meta.env.VITE_DIALOG_ID,
      }),
    });
  }

  // Rename a conversation
  async renameConversation(conversationId: string, name: string): Promise<void> {
    return this.request('/v1/conversation/set', {
      method: 'POST',
      body: JSON.stringify({
        conversation_id: conversationId,
        is_new: false,
        name: name,
        dialog_id: import.meta.env.VITE_DIALOG_ID,
      }),
    });
  }

  // Get messages for a specific conversation
  async getConversationMessages(conversationId: string): Promise<Message[]> {
    const response = await this.request(`/v1/conversation/get?conversation_id=${conversationId}`);
    console.log('Conversation messages response:', response);
    // Handle different response structures
    const conversation = response.data || response;
    const messages = conversation.message || conversation.messages || [];
    const references = conversation.reference || [];
    
    console.log('Extracted messages:', messages);
    console.log('Extracted references:', references);
    
    // Associate references with assistant messages (skip the first assistant message like ragflow)
    const assistantMessages = messages
      .filter((msg: any) => msg.role === 'assistant')
      .slice(1); // Skip the first assistant message
    
    const messagesWithReferences = messages.map((msg: any) => {
      if (msg.role === 'assistant') {
        const assistantIndex = assistantMessages.findIndex((assistantMsg: any) => assistantMsg.id === msg.id);
        if (assistantIndex >= 0 && references[assistantIndex]) {
          return { ...msg, reference: references[assistantIndex] };
        }
      }
      return msg;
    });
    
    return messagesWithReferences;
  }
}

export const chatAPI = new ChatAPI();