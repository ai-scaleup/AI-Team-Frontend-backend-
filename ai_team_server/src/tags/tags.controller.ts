
import { Controller, Post, Get, Patch, Delete, Body, Param } from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagFieldDto } from './dto/create-tag-field.dto';
import { UpdateTagFieldDto } from './dto/update-tag-field.dto';
import { GenerateTagsDto } from './dto/generate-tags.dto';

@Controller('tags')
export class TagsController {
    constructor(private readonly tagsService: TagsService) { }

    // ── TagField endpoints ─────────────────────────────────────

    @Post('fields')
    createTagField(@Body() dto: CreateTagFieldDto) {
        return this.tagsService.createTagField(dto);
    }

    @Get('fields')
    getAllTagFields() {
        return this.tagsService.getAllTagFields();
    }

    @Get('fields/:id')
    getTagFieldById(@Param('id') id: string) {
        return this.tagsService.getTagFieldById(id);
    }

    @Patch('fields/:id')
    updateTagField(@Param('id') id: string, @Body() dto: UpdateTagFieldDto) {
        return this.tagsService.updateTagField(id, dto);
    }

    @Delete('fields/:id')
    deleteTagField(@Param('id') id: string) {
        return this.tagsService.deleteTagField(id);
    }

    // ── Get Tags by Session endpoint ─────────────────────────

    @Get('session/:sessionId')
    getTagsBySessionId(@Param('sessionId') sessionId: string) {
        return this.tagsService.getTagsBySessionId(sessionId);
    }

    // ── Tag Generation endpoint ────────────────────────────────

    @Post('generate')
    generateTags(@Body() dto: GenerateTagsDto) {
        return this.tagsService.generateTags(dto.sessionId);
    }
}
