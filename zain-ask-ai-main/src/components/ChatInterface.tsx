import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Bot, User, Sparkles, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Message } from "@/hooks/useChatSessions";
import MarkdownContent from "./MarkdownContent";
import { useSendMessage } from "@/hooks/useSendMessage";
import useChatSessions from "@/hooks/useChatSessions";
import { useFetchDocumentInfosByIds } from "@/hooks/document-hooks";
import { InnerUploadedMessageFiles } from "./UploadedMessageFiles";

interface ChatInterfaceProps {
  sessionId: string | null;
  messages: Message[];
  onSendMessage: (content: string, sender?: "user" | "bot", reference?: any) => void;
  loading?: boolean;
}

const ChatInterface = ({ sessionId, messages, onSendMessage, loading = false }: ChatInterfaceProps) => {
  console.log('ChatInterface props:', { sessionId, messages: messages.length, loading });
  console.log('Messages array:', messages);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { sendMessage, isLoading, error } = useSendMessage();
  const { updateLastMessage } = useChatSessions();
  const { data: documentList, setDocumentIds } = useFetchDocumentInfosByIds();

  // Update streaming message content
  useEffect(() => {
    if (streamingMessage) {
      // No need to do anything here, the message is already in state
    }
  }, [streamingMessage]);

  // Update document IDs when messages change
  useEffect(() => {
    const allDocIds: string[] = [];
    
    messages.forEach(msg => {
      if (msg.sender === 'bot' && msg.reference?.doc_aggs) {
        allDocIds.push(...msg.reference.doc_aggs.map(doc => doc.doc_id));
      }
    });
    
    // Also include streaming message documents
    if (streamingMessage?.reference?.doc_aggs) {
      allDocIds.push(...streamingMessage.reference.doc_aggs.map(doc => doc.doc_id));
    }
    
    const uniqueDocIds = [...new Set(allDocIds)];
    if (uniqueDocIds.length > 0) {
      setDocumentIds(uniqueDocIds);
    }
  }, [messages, streamingMessage, setDocumentIds]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  // Clear input when session changes
  useEffect(() => {
    setInputValue("");
    setIsTyping(false);
    setStreamingMessage(null);
  }, [sessionId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionId || isLoading) return;

    const userMessage = inputValue;
    setInputValue("");

    // Send user message
    onSendMessage(userMessage, "user");
    setIsTyping(true);

    // Create streaming message placeholder
    const botMessageId = `bot-${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let finalContent = "";
    let finalReference = null;
    setStreamingMessage({
      id: botMessageId,
      content: "",
      sender: "bot",
      timestamp: new Date(),
    });

    try {
      // Convert messages to API format (include the user message we just added)
      const conversationHistory = messages.map(msg => ({
        content: msg.content,
        role: msg.sender === 'bot' ? 'assistant' as const : 'user' as const,
        id: msg.id,
        doc_ids: [] as string[]
      }));

      await sendMessage(
        userMessage,
        sessionId,
        conversationHistory,
        (chunk: string, reference?: any) => {
          // Update streaming message content and reference
          finalContent = chunk;
          finalReference = reference;
          setStreamingMessage(prev => prev ? { ...prev, content: chunk, reference } : null);
        },
        (reference?: any) => {
          // Stream ended, add the final message with reference
          finalReference = reference;
          if (finalContent.trim()) {
            onSendMessage(finalContent, "bot", finalReference);
          }
          setStreamingMessage(null);
        }
      );
    } catch (err) {
      console.error('Error sending message:', err);
      // Fallback to mock response if API fails
      setTimeout(() => {
        const botResponse = "شكراً لك على رسالتك. أنا هنا لمساعدتك في أي استفسارات تتعلق بخدمات زين.\n\nThank you for your message. I'm here to help you with any Zain-related queries.";
        updateLastMessage(sessionId, userMessage);
        setStreamingMessage(null);
      }, 1500);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!sessionId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No chat selected</h3>
          <p>Select a chat from the sidebar or start a new conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-6 pt-6">
        <div>
          <h1 className="text-3xl font-bold gradient-hero-text">
            AI Chat Assistant
          </h1>
          <p className="text-muted-foreground mt-1">
            Powered by Zain Kuwait's intelligent system
          </p>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 rounded-full bg-gradient-primary/10 border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">AI Powered</span>
        </div>
      </div>

      {/* Messages Container */}
      <Card className="flex-1 flex flex-col bg-gradient-surface border-border/50 shadow-card mx-6 mb-6">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-sm">Loading messages...</p>
              </div>
            </div>
          ) : messages.length === 0 && !streamingMessage ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground max-w-md">
                <Bot className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Welcome to Zain AI Assistant</h3>
                <p className="text-sm mb-4">
                  I'm here to help you with any questions about Zain's services, billing, packages, and more.
                  Ask me anything in Arabic or English!
                </p>
                <div className="text-xs opacity-70">
                  مثال: "ما هي باقات الإنترنت المتاحة؟" أو "What internet packages are available?"
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start space-x-3 animate-fade-in",
                message.sender === "user" ? "flex-row-reverse space-x-reverse" : ""
              )}
            >
              {/* Avatar */}
              <div
                className={cn(
                  "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                  message.sender === "user"
                    ? "bg-gradient-primary"
                    : "bg-secondary border border-border"
                )}
              >
                {message.sender === "user" ? (
                  <User className="h-4 w-4 text-primary-foreground" />
                ) : (
                  <Bot className="h-4 w-4 text-foreground" />
                )}
              </div>

              {/* Message Bubble */}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 shadow-sm",
                  message.sender === "user"
                    ? "message-user"
                    : "message-bot"
                )}
              >
                {message.sender === "user" ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </p>
                ) : (
                  <MarkdownContent content={message.content} reference={message.reference} loading={false} />
                )}
                <p className="text-xs opacity-70 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {/* Streaming Message */}
          {streamingMessage && streamingMessage.content.trim() !== "" && (
            <div className="flex items-start space-x-3 animate-fade-in">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center">
                <Bot className="h-4 w-4 text-foreground" />
              </div>
              <div className="message-bot rounded-2xl px-4 py-3 max-w-[80%]">
                <MarkdownContent content={streamingMessage.content} reference={streamingMessage.reference} loading={false} />
                <p className="text-xs opacity-70 mt-2">
                  {streamingMessage.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {isTyping && (!streamingMessage || streamingMessage.content.trim() === "") && (
            <div className="flex items-start space-x-3 animate-fade-in">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center">
                <Bot className="h-4 w-4 text-foreground" />
              </div>
              <div className="message-bot rounded-2xl px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
            </div>
          )}

          {/* Documents at the bottom */}
          {documentList.length > 0 && (
            <div className="mt-4">
              <InnerUploadedMessageFiles
                files={documentList}
              />
            </div>
          )}

          <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border/50 p-4 bg-card/50">
          <div className="flex space-x-3">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="اكتب رسالتك هنا... / Type your message here..."
              className="flex-1 bg-background border-border focus:border-primary transition-colors"
              disabled={isTyping}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping || isLoading}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-200"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send • Shift+Enter for new line
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ChatInterface;