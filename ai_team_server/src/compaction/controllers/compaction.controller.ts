import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  CompactionContextDto,
  CompactionStatusDto,
  CompactionTurnDto,
} from '../dto/compaction.dto';
import { CompactionService } from '../services/compaction.service';

/**
 * The runtime around a chat turn: one read before the model runs, one write
 * after it answered, and a status read for the page that shows a compaction
 * in progress. Compaction itself happens here, never in the agent workflows;
 * they only receive the finished summary inside a chat message.
 */
@ApiTags('compaction')
@Controller('compaction')
export class CompactionController {
  constructor(private readonly compactionService: CompactionService) {}

  @Post('context')
  @ApiOperation({
    summary: 'Get the memory block for a chat',
    description:
      'Called by an agent workflow before the model runs. Returns the summary to paste into the system prompt and how many recent turns to keep verbatim. Answers with an empty memory block when compaction is off, so the workflow needs no branch.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'agent'],
      properties: {
        sessionId: { type: 'string', example: 'session_1765435414978' },
        agent: {
          type: 'string',
          example: 'TONY',
          description: 'AgentName enum value or the frontend slug ("tony-ai").',
        },
        chatId: { type: 'string', example: 'chat_1765435414978' },
        email: { type: 'string', example: 'user@example.com' },
        title: { type: 'string', example: 'Piano editoriale Q4' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Context returned',
    schema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        memoryBlock: {
          type: 'string',
          description: 'Empty until the chat has been compacted at least once.',
        },
        keepLastTurns: { type: 'integer', example: 8 },
        liveTokens: { type: 'integer' },
        totalTokens: { type: 'integer' },
        conversationBudget: { type: 'integer' },
        percentOfBudget: { type: 'integer' },
        budgetExhausted: { type: 'boolean' },
        summaryVersion: { type: 'integer' },
        summaryPending: {
          type: 'boolean',
          description:
            'True until the newest summary has been delivered to the workflow.',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing sessionId or unknown agent' })
  getContext(@Body() body: CompactionContextDto) {
    return this.compactionService.getContext(body);
  }

  @Post('turn')
  @ApiOperation({
    summary: 'Record a finished turn, compacting if it crossed the watermark',
    description:
      'Called after the model answered. Appends the turn to the server-side mirror of the transcript and, when the chat has crossed its watermark, starts folding the older turns into a new summary in the background. Answers at once; /compaction/status says when the compaction is done.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'agent'],
      properties: {
        sessionId: { type: 'string' },
        agent: { type: 'string', example: 'TONY' },
        chatId: { type: 'string' },
        email: { type: 'string' },
        title: { type: 'string' },
        userText: { type: 'string' },
        aiText: { type: 'string' },
        promptTokens: {
          type: 'integer',
          description: 'Real provider usage when the caller has it.',
        },
        completionTokens: { type: 'integer' },
        totalTokens: { type: 'integer' },
        deliveredSummaryVersion: {
          type: 'integer',
          description:
            'Summary version the message of this turn carried to the workflow, if any.',
        },
        notifyChat: {
          type: 'boolean',
          description:
            'Leave a "compacted" marker in the chat transcript when this turn compacts.',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Turn recorded',
    schema: {
      type: 'object',
      properties: {
        compacting: {
          type: 'boolean',
          description: 'A compaction is running for this chat.',
        },
        liveTokens: { type: 'integer' },
        threshold: {
          type: 'integer',
          description: 'Token count at which the chat compacts.',
        },
        percentOfTrigger: {
          type: 'integer',
          description: 'How far the chat is towards that count, 0-100.',
        },
        conversationBudget: { type: 'integer' },
        compactionCount: { type: 'integer' },
        summaryVersion: { type: 'integer' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing text, sessionId or agent' })
  recordTurn(@Body() body: CompactionTurnDto) {
    return this.compactionService.recordTurn(body);
  }

  @Post('status')
  @ApiOperation({
    summary: 'Where the compaction of a chat stands',
    description:
      'Read by a chat page after a turn reported that a compaction started, until it has landed.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'agent'],
      properties: {
        sessionId: { type: 'string' },
        agent: { type: 'string', example: 'ALEX' },
        chatId: { type: 'string' },
      },
    },
  })
  @ApiOkResponse({
    description: 'Status returned',
    schema: {
      type: 'object',
      properties: {
        compacting: { type: 'boolean' },
        compactionCount: { type: 'integer' },
        summaryVersion: { type: 'integer' },
        summaryPending: { type: 'boolean' },
        liveTokens: { type: 'integer' },
        threshold: { type: 'integer' },
        percentOfTrigger: { type: 'integer' },
        lastCompactedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Missing sessionId or unknown agent' })
  getStatus(@Body() body: CompactionStatusDto) {
    return this.compactionService.getStatus(body);
  }
}
