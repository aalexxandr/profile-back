import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  SerializeOptions,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/public.decorator';
import { ApiAdminAuth } from '../common/swagger/api-admin-auth.decorator';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import {
  DETAIL,
  LIST_ITEM,
  MAX_IMAGE_BYTES,
  SLUG_PARAM,
} from './case.constants';
import { CaseService } from './case.service';
import { CaseDetailDto } from './dto/case-detail.dto';
import { CaseListItemDto } from './dto/case-list-item.dto';
import { CreateCaseDto } from './dto/create-case.dto';
import { UpdateCaseDto } from './dto/update-case.dto';

@ApiTags('Cases')
@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Post()
  @ApiAdminAuth()
  @ApiOperation({
    summary: 'Create a case',
    description:
      'Admin only. Creates a case. Unless `published: true` is sent it is a draft: it is not shown in the public list and its detail returns 404. The slug must be unique. A new case has no picture; upload one with `PUT /cases/{slug}/image`.',
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

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List published cases',
    description:
      'Returns the published cases in the compact form used on the list page, ordered by `sortOrder` ascending and, within the same `sortOrder`, newest first. Drafts are never included. Every item carries `image` and `blurImage` (both null for a case without a picture).',
  })
  @ApiOkResponse({
    type: [CaseListItemDto],
    description: 'Published cases; an empty array when there are none',
  })
  @SerializeOptions(LIST_ITEM)
  findAll() {
    return this.caseService.findAll();
  }

  @Public()
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
  @ApiAdminAuth()
  @ApiOperation({
    summary: 'Update a case',
    description:
      'Admin only. Partial update: only the fields that are sent change, the rest stay as they are. Works for drafts as well. The slug cannot be changed, and neither can the picture: use `PUT /cases/{slug}/image` for that.',
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
  @ApiAdminAuth()
  @ApiOperation({
    summary: 'Delete a case',
    description:
      'Admin only. Removes a case for good, whether it is published or a draft. Its stored picture is removed as well.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiNoContentResponse({ description: 'The case was deleted' })
  @ApiErrorResponse(404, 'Unknown case')
  deleteCase(@Param('slug') slug: string) {
    return this.caseService.deleteCase(slug);
  }

  @Put(':slug/image')
  @ApiAdminAuth()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'The picture: JPEG, PNG or WebP (recognised by content, not by name), up to 10 MB',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload the picture of a case',
    description:
      'Admin only. Sets or replaces the picture of a case, drafts included. Send one file in the multipart field `file`. The server re-encodes it to a real WebP (at most 1920 px wide, never enlarged, EXIF orientation applied, metadata removed) and generates the blurred placeholder itself, so only one version is ever uploaded. The response is the case detail with the new `image` URL and `blurImage` data URI. A previous picture is removed from the storage. Uploading the same file again changes nothing.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({
    type: CaseDetailDto,
    description: 'The case with its new picture',
  })
  @ApiErrorResponse(
    400,
    'The `file` field is missing, or the file is not a valid JPEG, PNG or WebP image',
  )
  @ApiErrorResponse(404, 'Unknown case')
  @ApiErrorResponse(413, 'The file is larger than 10 MB')
  @SerializeOptions(DETAIL)
  setImage(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(
        'The field "file" with a picture is required',
      );
    }
    return this.caseService.setImage(slug, file.buffer);
  }

  @Delete(':slug/image')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiAdminAuth()
  @ApiOperation({
    summary: 'Remove the picture of a case',
    description:
      'Admin only. Clears `image` and `blurImage` of the case and removes the stored file. Repeating the call for a case that has no picture is harmless and answers 204 as well.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiNoContentResponse({ description: 'The case has no picture now' })
  @ApiErrorResponse(404, 'Unknown case')
  removeImage(@Param('slug') slug: string) {
    return this.caseService.removeImage(slug);
  }
}
