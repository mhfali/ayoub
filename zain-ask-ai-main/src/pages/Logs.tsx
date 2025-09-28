import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Download, AlertTriangle, Ban, User, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { logsAPI, ChatLog, PaginationInfo, LogsAPIResponse, TotalsInfo } from "@/api/logs";
import MarkdownContent from "@/components/MarkdownContent";

const Logs = () => {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [totals, setTotals] = useState<TotalsInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFlag, setFilterFlag] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  // Function to remove think content from response
  const cleanResponse = (text: string = '') => {
    // Handle nested think tags by repeatedly removing them
    let result = text;
    let previousResult = '';
    
    // Keep removing think tags until no more are found
    while (result !== previousResult) {
      previousResult = result;
      result = result.replace(/<think>[\s\S]*?<\/think>/g, '');
    }
    
    return result.trim();
  };

  const fetchLogs = async (page: number = 1, flag: string = "all", user: string = "all", search: string = "") => {
    setLoading(true);
    try {
      const response = await logsAPI.getChatLogs({
        page,
        limit: pageSize,
        flag,
        user_id: user,
        search: search || undefined,
      });

      setLogs(response.logs);
      setPagination(response.pagination);
      setTotals(response.totals);
    } catch (error) {
      console.error("Error fetching logs:", error);
      // Fallback to empty data
      setLogs([]);
      setPagination(null);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(currentPage, filterFlag, filterUser, searchTerm);
  }, [currentPage, filterFlag, filterUser, searchTerm]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getFlagIcon = (log: ChatLog) => {
    if (!log.is_flagged) return null;
    
    switch (log.flag_reason) {
      case "inappropriate":
        return <Ban className="h-4 w-4" />;
      case "out of scope":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getFlagColor = (log: ChatLog) => {
    if (!log.is_flagged) return "";
    
    switch (log.flag_reason) {
      case "inappropriate":
        return "flag-inappropriate";
      case "out of scope":
        return "flag-out-of-scope";
      default:
        return "flag-flagged";
    }
  };

  const getFlagText = (log: ChatLog) => {
    if (!log.is_flagged) return "";
    
    switch (log.flag_reason) {
      case "inappropriate":
        return "Inappropriate";
      case "out of scope":
        return "Out of Scope";
      default:
        return "Flagged";
    }
  };

  const exportLogs = () => {
    const csvContent = [
      ["ID", "User ID", "Question", "Response", "Timestamp", "Is Flagged", "Flag Reason", "Conversation ID"].join(","),
      ...logs.map(log => [
        log.id,
        `"${log.user_id}"`,
        `"${log.question}"`,
        `"${log.response || ""}"`,
        log.create_time,
        log.is_flagged ? "Yes" : "No",
        log.flag_reason || "",
        log.conversation_id || ""
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };  const totalLogs = totals?.total_chats || 0;
  const flaggedCount = totals?.total_flagged || 0;
  const outOfScopeCount = totals?.total_out_scope || 0;
  const successRate = totalLogs > 0 ? Math.round(((totalLogs - flaggedCount) / totalLogs) * 100) : 0;

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-hero-text">
              Chat Logs & Analytics
            </h1>
            <p className="text-muted-foreground mt-2">
              Monitor and analyze user interactions with the AI assistant
            </p>
          </div>
          <Button 
            onClick={exportLogs}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-200"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Chats</p>
                  <p className="text-2xl font-bold gradient-text">{totalLogs}</p>
                </div>
                <User className="h-8 w-8 text-primary/60" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Flagged</p>
                  <p className="text-2xl font-bold text-destructive">
                    {flaggedCount}
                  </p>
                </div>
                <Ban className="h-8 w-8 text-destructive/60" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Out of Scope</p>
                  <p className="text-2xl font-bold text-warning">
                    {outOfScopeCount}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-warning/60" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold text-success">
                    {successRate}%
                  </p>
                </div>
                <Clock className="h-8 w-8 text-success/60" />
              </div>
            </CardContent>
          </Card>
        </div>

        

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by user ID, question, or response..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {/* Add user options dynamically if needed */}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterFlag} onValueChange={setFilterFlag}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by flag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Logs</SelectItem>
                    <SelectItem value="unflagged">Unflagged</SelectItem>
                    <SelectItem value="flagged">Any Flag</SelectItem>
                    <SelectItem value="inappropriate">Inappropriate</SelectItem>
                    <SelectItem value="out of scope">Out of Scope</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(pagination.pages - 4, pagination.page - 2)) + i;
                      if (pageNum > pagination.pages) return null;
                      
                      return (
                        <Button
                          key={pageNum}
                          variant={pageNum === pagination.page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Logs List */}
        <Card>
          <CardHeader>
            <CardTitle className="gradient-text">Chat History</CardTitle>
            <CardDescription>
              {logs.length} of {totalLogs} conversations
              {pagination && ` (Page ${pagination.page} of ${pagination.pages})`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p>Loading logs...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-lg bg-gradient-surface border border-border/50 hover:border-primary/30 transition-colors animate-fade-in"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{log.user_id}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(log.create_time).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {log.is_flagged && (
                        <Badge
                          variant="outline"
                          className={cn("flex items-center space-x-1", getFlagColor(log))}
                        >
                          {getFlagIcon(log)}
                          <span>{getFlagText(log)}</span>
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="bg-secondary/30 rounded-lg p-3">
                        <p className="text-sm font-medium text-primary mb-1">User Question:</p>
                        <p className="text-sm">{log.question}</p>
                      </div>
                      
                      {log.response && (
                        <div className="bg-card rounded-lg p-3 border border-border/30">
                          <p className="text-sm font-medium text-accent mb-1">AI Response:</p>
                          <div className="text-sm">
                            <MarkdownContent
                              content={cleanResponse(log.response)}
                              loading={false}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/30 flex justify-between items-center text-xs text-muted-foreground">
                      <span>Conversation ID: {log.conversation_id || "N/A"}</span>
                      <span>Log ID: {log.id}</span>
                    </div>
                  </div>
                ))}
                
                {logs.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No logs found matching your criteria</p>
                    <p className="text-sm">Try adjusting your search or filter settings</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>


      </div>
    </Layout>
  );
};

export default Logs;