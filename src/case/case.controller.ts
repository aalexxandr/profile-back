import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  SerializeOptions,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import { CaseService } from './case.service';
import { CaseDetailDto } from './dto/case-detail.dto';
import { CaseListItemDto } from './dto/case-list-item.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

// Only `@Expose()`d fields of the DTO are sent; the service returns DB rows.
const LIST_ITEM = { type: CaseListItemDto, strategy: 'excludeAll' } as const;
const DETAIL = { type: CaseDetailDto, strategy: 'excludeAll' } as const;

const SLUG_PARAM = {
  name: 'slug',
  description: 'Unique identifier of the case (lowercase kebab-case)',
  example: 'spectre',
} as const;

@ApiTags('Cases')
@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a case',
    description:
      'Creates a case. Unless `published: true` is sent it is a draft: it is not shown in the public list and its detail returns 404. The slug must be unique.',
  })
  @ApiCreatedResponse({ type: CaseDetailDto, description: 'The created case' })
  @ApiErrorResponse(
    400,
    'Validation failed: a field is missing, malformed or unknown',
  )
  @ApiErrorResponse(409, 'A case with this slug already exists')
  @SerializeOptions(DETAIL)
  createCase(@Body() caseDataDto: CreateCaseDto) {
    return this.caseService.createCase(caseDataDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List published cases',
    description:
      'Returns the published cases in the compact form used on the list page, ordered by `sortOrder` ascending and, within the same `sortOrder`, newest first. Drafts are never included.',
  })
  @ApiOkResponse({
    type: [CaseListItemDto],
    description: 'Published cases; an empty array when there are none',
  })
  @SerializeOptions(LIST_ITEM)
  findAll() {
    return this.caseService.findAll();
  }

  @Get(':slug')
  @ApiOperation({
    summary: 'Get a published case',
    description:
      'Returns the full case used on the detail page. An unpublished case gives the same 404 as an unknown one, so drafts do not leak.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({ type: CaseDetailDto, description: 'The published case' })
  @ApiErrorResponse(404, 'Unknown or unpublished case')
  @SerializeOptions(DETAIL)
  findBySlug(@Param('slug') slug: string) {
    return this.caseService.findBySlug(slug);
  }

  @Patch(':slug')
  @ApiOperation({
    summary: 'Update a case',
    description:
      'Partial update: only the fields that are sent change, the rest stay as they are. Works for drafts as well. The slug cannot be changed.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({ type: CaseDetailDto, description: 'The updated case' })
  @ApiErrorResponse(
    400,
    'Validation failed: a field is malformed, unknown, or the slug was sent',
  )
  @ApiErrorResponse(404, 'Unknown case')
  @SerializeOptions(DETAIL)
  updateCase(@Param('slug') slug: string, @Body() caseDataDto: UpdateCaseDto) {
    return this.caseService.updateCase(slug, caseDataDto);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a case',
    description: 'Removes a case for good, whether it is published or a draft.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiNoContentResponse({ description: 'The case was deleted' })
  @ApiErrorResponse(404, 'Unknown case')
  deleteCase(@Param('slug') slug: string) {
    return this.caseService.deleteCase(slug);
  }
}
