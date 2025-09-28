import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Download, Filter, AlertTriangle, MessageSquare } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

interface ChatLog {
  id: string;
  tenant_id: string;
  user_id: string;
  question: string;
  response: string;
  is_flagged: boolean;
  log_type: 'normal' | 'flagged';
  flag_reason?: string;
  kb_ids: string[];
  tokens_used?: number;
  response_time?: number;
  source: string;
  metadata: Record<string, any>;
  create_time: string;
  update_time: string;
}

interface ChatLogStats {
  total_logs: number;
  flagged_logs: number;
  flag_rate: number;
  total_tokens: number;
  avg_response_time: number;
}

const ChatHistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const [allLogs, setAllLogs] = useState<ChatLog[]>([]);
  const [flaggedLogs, setFlaggedLogs] = useState<ChatLog[]>([]);
  const [stats, setStats] = useState<ChatLogStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  // Mock API calls - replace with actual API calls
  const fetchChatLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Replace with actual API call
      const response = await fetch('/api/v1/chat_log/list', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllLogs(data.data?.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch chat logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFlaggedLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Replace with actual API call
      const response = await fetch('/api/v1/chat_log/flagged', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setFlaggedLogs(data.data?.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch flagged logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      // Replace with actual API call
      const response = await fetch('/api/v1/chat_log/statistics', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.data || null);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const exportLogs = useCallback(async () => {
    try {
      // Replace with actual API call
      const response = await fetch('/api/v1/chat_log/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `chat_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  }, []);

  useEffect(() => {
    fetchChatLogs();
    fetchFlaggedLogs();
    fetchStats();
  }, [fetchChatLogs, fetchFlaggedLogs, fetchStats]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderLogTable = (logs: ChatLog[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Question</TableHead>
          <TableHead>Response</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Tokens</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className="text-sm">
              {formatDate(log.create_time)}
            </TableCell>
            <TableCell className="max-w-xs">
              <div className="truncate" title={log.question}>
                {log.question}
              </div>
            </TableCell>
            <TableCell className="max-w-xs">
              <div className="truncate" title={log.response}>
                {log.response || 'No response'}
              </div>
            </TableCell>
            <TableCell>
              {log.is_flagged ? (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Flagged
                </Badge>
              ) : (
                <Badge variant="secondary">Normal</Badge>
              )}
              {log.flag_reason && (
                <div className="text-xs text-muted-foreground mt-1">
                  {log.flag_reason}
                </div>
              )}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{log.source}</Badge>
            </TableCell>
            <TableCell>{log.tokens_used || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <PageHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Chat History</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                fetchChatLogs();
                fetchFlaggedLogs();
                fetchStats();
              }}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportLogs}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </PageHeader>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Chats</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_logs}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Flagged Chats</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.flagged_logs}</div>
              <p className="text-xs text-muted-foreground">
                {stats.flag_rate.toFixed(1)}% flag rate
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_tokens.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_response_time.toFixed(2)}s</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chat Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Chat Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">
                All Chats ({allLogs.length})
              </TabsTrigger>
              <TabsTrigger value="flagged">
                Flagged Only ({flaggedLogs.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading...
                </div>
              ) : allLogs.length > 0 ? (
                renderLogTable(allLogs)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No chat logs found
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="flagged" className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading...
                </div>
              ) : flaggedLogs.length > 0 ? (
                renderLogTable(flaggedLogs)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No flagged chats found
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChatHistoryPage;