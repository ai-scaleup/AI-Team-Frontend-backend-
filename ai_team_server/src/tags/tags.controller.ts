import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TagsService } from './tags.service';
import { CreateTagFieldDto } from './dto/create-tag-field.dto';
import { UpdateTagFieldDto } from './dto/update-tag-field.dto';
import { GenerateTagsDto } from './dto/generate-tags.dto';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  // ── TagField endpoints ─────────────────────────────────────

  @Post('fields')
  @ApiOperation({ summary: 'Create a tag field' })
  @ApiBody({ type: CreateTagFieldDto })
  @ApiCreatedResponse({ description: 'Tag field created' })
  createTagField(@Body() dto: CreateTagFieldDto) {
    return this.tagsService.createTagField(dto);
  }

  @Get('fields')
  @ApiOperation({ summary: 'List tag fields' })
  @ApiOkResponse({ description: 'Tag fields returned' })
  getAllTagFields() {
    return this.tagsService.getAllTagFields();
  }

  @Get('fields/:id')
  @ApiOperation({ summary: 'Get a tag field by ID' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'Tag field returned' })
  getTagFieldById(@Param('id') id: string) {
    return this.tagsService.getTagFieldById(id);
  }

  @Patch('fields/:id')
  @ApiOperation({ summary: 'Update a tag field' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateTagFieldDto })
  @ApiOkResponse({ description: 'Tag field updated' })
  updateTagField(@Param('id') id: string, @Body() dto: UpdateTagFieldDto) {
    return this.tagsService.updateTagField(id, dto);
  }

  @Delete('fields/:id')
  @ApiOperation({ summary: 'Delete a tag field' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'Tag field deleted' })
  deleteTagField(@Param('id') id: string) {
    return this.tagsService.deleteTagField(id);
  }

  // ── Get Tags by Session endpoint ─────────────────────────

  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get generated tags for a session' })
  @ApiParam({ name: 'sessionId', example: 'session_123' })
  @ApiOkResponse({ description: 'Tags returned' })
  getTagsBySessionId(@Param('sessionId') sessionId: string) {
    return this.tagsService.getTagsBySessionId(sessionId);
  }

  // ── Tag Generation endpoint ────────────────────────────────

  @Post('generate')
  @ApiOperation({ summary: 'Generate tags for a session' })
  @ApiBody({ type: GenerateTagsDto })
  @ApiCreatedResponse({ description: 'Tags generated' })
  generateTags(@Body() dto: GenerateTagsDto) {
    return this.tagsService.generateTags(dto.sessionId);
  }
}
