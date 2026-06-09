import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export type Sender = 'user' | 'ai';

export interface Message {
  id: string;
  conversationId: string;
  sender: Sender;
  text: string;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  createdAt: Date;
}

export async function createConversation(): Promise<Conversation> {
  const result = await pool.query(
    'INSERT INTO conversations DEFAULT VALUES RETURNING id, created_at'
  );
  const row = result.rows[0];
  return { id: row.id, createdAt: row.created_at };
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const result = await pool.query(
    'SELECT id, created_at FROM conversations WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { id: row.id, createdAt: row.created_at };
}

export async function addMessage(
  conversationId: string,
  sender: Sender,
  text: string
): Promise<Message> {
  const result = await pool.query(
    `INSERT INTO messages (conversation_id, sender, text)
     VALUES ($1, $2, $3)
     RETURNING id, conversation_id, sender, text, created_at`,
    [conversationId, sender, text]
  );
  const row = result.rows[0];
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: row.sender,
    text: row.text,
    createdAt: row.created_at,
  };
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const result = await pool.query(
    `SELECT id, conversation_id, sender, text, created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    sender: row.sender,
    text: row.text,
    createdAt: row.created_at,
  }));
}
