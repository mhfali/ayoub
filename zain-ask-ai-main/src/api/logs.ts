export interface ChatLog {
  id: string;
  user_id: string;
  question: string;
  response: string;
  create_time: string;
  is_flagged: boolean;
  flag_reason?: string;
  conversation_id?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface TotalsInfo {
  total_chats: number;
  total_flagged: number;
  total_out_scope: number;
}

export interface LogsAPIResponse {
  logs: ChatLog[];
  pagination: PaginationInfo;
  totals: TotalsInfo;
}

export interface GetLogsParams {
  page?: number;
  limit?: number;
  flag?: string;
  user_id?: string;
  search?: string;
}

class LogsAPI {
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

  // Get list of chat logs
  async getChatLogs(params: GetLogsParams = {}): Promise<LogsAPIResponse> {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.flag) searchParams.append('flag', params.flag);
    if (params.user_id) searchParams.append('user_id', params.user_id);
    if (params.search) searchParams.append('search', params.search);

    const queryString = searchParams.toString();
    const endpoint = `/v1/chat_log/list${queryString ? `?${queryString}` : ''}`;

    return this.request(endpoint);
  }
}

export const logsAPI = new LogsAPI();