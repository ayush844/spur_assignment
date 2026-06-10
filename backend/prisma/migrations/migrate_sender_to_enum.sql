-- Safely convert messages.sender from TEXT to Sender enum without data loss.
-- Run once before `prisma db push` if you have existing rows.

DO $$ BEGIN
  CREATE TYPE "Sender" AS ENUM ('user', 'ai');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_check;

ALTER TABLE messages
  ALTER COLUMN sender TYPE "Sender" USING sender::"Sender";
