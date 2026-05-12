import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTagFieldDto } from './dto/create-tag-field.dto';
import { UpdateTagFieldDto } from './dto/update-tag-field.dto';
import OpenAI from 'openai';

@Injectable()
export class TagsService {
  private openai: OpenAI;

  constructor(private prisma: PrismaService) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // ── TagField CRUD ──────────────────────────────────────────

  async createTagField(dto: CreateTagFieldDto) {
    return this.prisma.tagField.create({ data: dto });
  }

  async getAllTagFields() {
    return this.prisma.tagField.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTagFieldById(id: string) {
    const tagField = await this.prisma.tagField.findUnique({ where: { id } });
    if (!tagField)
      throw new NotFoundException(`TagField with id "${id}" not found`);
    return tagField;
  }

  async updateTagField(id: string, dto: UpdateTagFieldDto) {
    await this.getTagFieldById(id); // ensure it exists
    return this.prisma.tagField.update({
      where: { id },
      data: dto,
    });
  }

  async deleteTagField(id: string) {
    await this.getTagFieldById(id); // ensure it exists
    return this.prisma.tagField.delete({ where: { id } });
  }

  // ── Get Tags by Session ───────────────────────────────────

  async getTagsBySessionId(sessionId: string) {
    const tag = await this.prisma.tag.findFirst({
      where: { sessionId },
    });

    if (!tag) {
      throw new NotFoundException(`No tags found for sessionId "${sessionId}"`);
    }

    return tag;
  }

  // ── Tag Generation ─────────────────────────────────────────

  async generateTags(sessionId: string) {
    // 1. Fetch all chat logs for this session
    const chatLogs = await this.prisma.chatLog.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    if (chatLogs.length === 0) {
      throw new NotFoundException(
        `No chat logs found for sessionId "${sessionId}"`,
      );
    }

    // 2. Fetch all admin-defined tag fields
    const tagFields = await this.prisma.tagField.findMany();

    if (tagFields.length === 0) {
      throw new NotFoundException(
        'No TagFields defined. Please create TagFields first.',
      );
    }

    const tagNames = tagFields.map((tf) => tf.tagName);

    // 3. Build the conversation text
    const conversationText = chatLogs
      .map((log) => `${log.sender}: ${log.messageText}`)
      .join('\n');

    // 4. Call OpenAI to classify the conversation
    const prompt = `You are a conversation classifier. Given the following conversation, classify it using ONLY the tags from this list:

Available tags: ${JSON.stringify(tagNames)}

Conversation:
${conversationText}

Instructions:
- Analyze the conversation and select which tags apply.
- You MUST ONLY use tags from the provided list. Do NOT invent new tags.
- Return ONLY a valid JSON array of matching tag names, e.g. ["tag1", "tag2"].
- If no tags match, return an empty array [].`;

    let matchedTags: string[] = [];

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content?.trim() || '{}';
      const parsed = JSON.parse(content);

      // Handle both { "tags": [...] } and direct [...] formats
      const rawTags = Array.isArray(parsed) ? parsed : parsed.tags || [];

      // Filter to only include valid tag names from TagField
      matchedTags = rawTags.filter((tag: string) => tagNames.includes(tag));
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to generate tags via OpenAI: ${error.message}`,
      );
    }

    // 5. Upsert the Tag record for this sessionId
    const existingTag = await this.prisma.tag.findFirst({
      where: { sessionId },
    });

    if (existingTag) {
      return this.prisma.tag.update({
        where: { id: existingTag.id },
        data: { tags: matchedTags },
      });
    } else {
      return this.prisma.tag.create({
        data: {
          sessionId,
          tags: matchedTags,
        },
      });
    }
  }
}
