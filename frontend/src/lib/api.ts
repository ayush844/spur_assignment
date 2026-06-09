const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface SendMessageResponse {
  reply: string;
  sessionId: string;
  error?: boolean;
}

export interface SessionHistoryResponse {
  sessionId: string;
  messages: ChatMessage[];
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error ?? 'Something went wrong', res.status);
  }
  return data as T;
}

export async function sendMessage(
  message: string,
  sessionId?: string
): Promise<SendMessageResponse> {
  const res = await fetch(`${API_BASE}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });
  return handleResponse<SendMessageResponse>(res);
}

export async function getSessionHistory(
  sessionId: string
): Promise<SessionHistoryResponse> {
  const res = await fetch(`${API_BASE}/chat/session/${sessionId}`);
  return handleResponse<SessionHistoryResponse>(res);
}
