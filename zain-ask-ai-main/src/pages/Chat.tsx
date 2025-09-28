import { useCallback } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import ChatInterface from "@/components/ChatInterface";
import ChatSidebar from "@/components/ChatSidebar";
import useChatSessions from "@/hooks/useChatSessions";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

const Chat = () => {
  const {
    sessions,
    activeSessionId,
    activeSession,
    setActiveSessionId,
    createNewSession,
    deleteSession,
    renameSession,
    addMessage,
    loading,
    error,
    loadConversationMessages,
  } = useChatSessions();

  // Determine if messages are loading for the active session
  const messagesLoading = activeSessionId && activeSession && activeSession.messages.length === 0 && activeSession.messageCount > 0;

  console.log('Chat page state:', {
    activeSessionId,
    activeSession: activeSession ? {
      id: activeSession.id,
      messagesLength: activeSession.messages.length,
      messageCount: activeSession.messageCount,
      title: activeSession.title
    } : null,
    messagesLoading,
    sessionsLength: sessions.length
  });

  const handleSendMessage = useCallback((content: string, sender: "user" | "bot" = "user", reference?: any) => {
    if (!activeSessionId) return;

    addMessage(activeSessionId, {
      content,
      sender,
      timestamp: new Date(),
      reference,
    });
  }, [activeSessionId, addMessage]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading conversations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error: {error}</p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const handleNewChat = () => {
    createNewSession();
  };

  return (
    <div className="min-h-screen bg-background">
      <SidebarProvider defaultOpen={true}>
        <div className="flex min-h-screen w-full">
          {/* Header with Sidebar Trigger */}
          <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-card/50 backdrop-blur-xl border-b border-border">
            <div className="flex items-center justify-between h-full px-4">
              <div className="flex items-center space-x-4">
                <SidebarTrigger className="md:hidden" />
                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold gradient-hero-text">
                      Zain AI Assistant
                    </h1>
                    <p className="text-xs text-muted-foreground">Kuwait</p>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={handleNewChat}
                size="sm"
                className="bg-gradient-primary hover:shadow-glow transition-all duration-200"
              >
                New Chat
              </Button>
            </div>
          </header>

          {/* Sidebar */}
          <ChatSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSessionSelect={setActiveSessionId}
            onNewChat={handleNewChat}
            onDeleteSession={deleteSession}
            onRenameSession={renameSession}
          />

          {/* Main Chat Area */}
          <SidebarInset className="pt-14">
            <ChatInterface
              sessionId={activeSessionId}
              messages={activeSession?.messages || []}
              onSendMessage={handleSendMessage}
              loading={messagesLoading}
            />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default Chat;