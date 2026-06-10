import { Sender } from '@prisma/client';
import { prisma } from './prisma.js';

export { Sender };

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
  const row = await prisma.conversation.create({ data: {} });
  return { id: row.id, createdAt: row.createdAt };
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const row = await prisma.conversation.findUnique({ where: { id } });
  if (!row) return null;
  return { id: row.id, createdAt: row.createdAt };
}

export async function addMessage(
  conversationId: string,
  sender: Sender,
  text: string
): Promise<Message> {
  const row = await prisma.message.create({
    data: { conversationId, sender, text },
  });
  return {
    id: row.id,
    conversationId: row.conversationId,
    sender: row.sender,
    text: row.text,
    createdAt: row.createdAt,
  };
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    sender: row.sender,
    text: row.text,
    createdAt: row.createdAt,
  }));
}
