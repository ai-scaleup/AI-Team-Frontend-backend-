// src/agent-chat/dto/chat-message.dto.ts
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Body forwarded verbatim to the agent's n8n webhook. Every dashboard page
 * sends chatInput + sessionId; the rest varies by page (useMemory, metadata,
 * chatId) and by widget (agent), so all of it is optional and unknown fields
 * are rejected by the ValidationPipe on the controller.
 *
 * chatInput carries pasted file contents and the user's preference profile
 * inline, so the cap is generous: it exists to bound the request, not the
 * message.
 */
export class ChatMessageDto {
  @IsString()
  @MaxLength(500_000)
  chatInput: string;

  @IsString()
  @MaxLength(200)
  sessionId: string;

  @IsOptional()
  @IsBoolean()
  useMemory?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  chatId?: string;

  /** Sent by the Giulia / Jennifer widgets. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  agent?: string;
}
