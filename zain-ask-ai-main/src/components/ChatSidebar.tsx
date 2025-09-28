import { useState } from "react";
import {
  MessageCircle,
  Plus,
  Trash2,
  Edit2,
  MoreHorizontal,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import MarkdownContent from "./MarkdownContent";

export interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount: number;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
}

const ChatSidebar = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onNewChat,
  onDeleteSession,
  onRenameSession,
}: ChatSidebarProps) => {
  const { state } = useSidebar();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const formatTimeAgo = (date: Date) => {
    // Ensure we have a valid date
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return "Unknown";
    }

    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  };

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditingTitle(session.title);
  };

  const handleSaveEdit = () => {
    if (editingId && editingTitle.trim()) {
      onRenameSession(editingId, editingTitle.trim());
    }
    setEditingId(null);
    setEditingTitle("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  // Group sessions by time periods
  const groupedSessions = sessions.reduce(
    (groups: { [key: string]: ChatSession[] }, session) => {
      const now = new Date();
      const sessionDate = session.timestamp;
      const diffInDays = Math.floor(
        (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let group: string;
      if (diffInDays === 0) {
        group = "Today";
      } else if (diffInDays === 1) {
        group = "Yesterday";
      } else if (diffInDays < 7) {
        group = "Previous 7 days";
      } else if (diffInDays < 30) {
        group = "Previous 30 days";
      } else {
        group = "Older";
      }

      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(session);
      return groups;
    },
    {}
  );

  const groupOrder = [
    "Today",
    "Yesterday",
    "Previous 7 days",
    "Previous 30 days",
    "Older",
  ];
  const sortedGroups = groupOrder.filter((group) => groupedSessions[group]);

  return (
    <Sidebar className="border-r border-border bg-card/30 backdrop-blur-sm">
      <SidebarHeader className="border-b border-border/50 bg-gradient-surface/50">
        <div className="flex items-center justify-between px-2 py-3">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary-foreground" />
            </div>
            {state === "expanded" && (
              <div>
                <h2 className="font-semibold gradient-text">Chat History</h2>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={onNewChat}
          className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-200"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          {state === "expanded" && <span>New Chat</span>}
        </Button>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {sortedGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
            {state === "expanded" && (
              <>
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs">Start a new chat to see it here</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedGroups.map((groupName) => (
              <SidebarGroup key={groupName}>
                {state === "expanded" && (
                  <SidebarGroupLabel className="text-muted-foreground text-xs font-medium">
                    {groupName}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {groupedSessions[groupName].map((session) => (
                      <SidebarMenuItem key={session.id}>
                        <div className="group/item relative">
                          <SidebarMenuButton
                            onClick={() => onSessionSelect(session.id)}
                            isActive={session.id === activeSessionId}
                            className={cn(
                              "w-full !h-auto justify-start gap-3 py-3 px-2 rounded-lg transition-all duration-200",
                              session.id === activeSessionId
                                ? "bg-gradient-primary/10 border border-primary/20 text-primary shadow-sm"
                                : "hover:bg-secondary/50"
                            )}
                          >
                            <MessageCircle className="h-4 w-4 flex-shrink-0" />
                            {state === "expanded" && (
                              <div className="flex-1 min-w-0">
                                {editingId === session.id ? (
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) =>
                                      setEditingTitle(e.target.value)
                                    }
                                    onBlur={handleSaveEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveEdit();
                                      if (e.key === "Escape")
                                        handleCancelEdit();
                                    }}
                                    className="w-full bg-transparent border-none outline-none text-sm font-medium"
                                    autoFocus
                                  />
                                ) : (
                                  <>
                                    <p className="text-sm font-medium truncate">
                                      {truncateText(session.title, 30)}
                                    </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {truncateText(session.lastMessage, 35)}
                                      </p>
                                    <p className="text-xs text-muted-foreground/70">
                                      {formatTimeAgo(session.timestamp)} •{" "}
                                      {session.messageCount} messages
                                    </p>
                                  </>
                                )}
                              </div>
                            )}
                          </SidebarMenuButton>

                          {state === "expanded" && editingId !== session.id && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onClick={() => handleStartEdit(session)}
                                  className="cursor-pointer"
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onDeleteSession(session.id)}
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </div>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-border/50 bg-gradient-surface/50">
        {state === "expanded" && (
          <div className="w-full px-2 py-3 text-xs text-muted-foreground flex justify-between items-center">
            {/* You can add other footer content here if needed */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 p-0"
                  aria-label="User menu"
                >
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    // TODO: Implement logout logic here
                  }}
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default ChatSidebar;
