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
  Query,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/public.decorator';
import { ApiAdminAuth } from '../common/swagger/api-admin-auth.decorator';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator';
import {
  BACKGROUND_UPLOAD_BODY,
  DETAIL,
  FULL,
  IMAGE_UPLOAD_BODY,
  LANG_QUERY,
  LIST_ITEM,
  MAX_IMAGE_BYTES,
  SLUG_PARAM,
} from './case.constants';
import { CaseService } from './case.service';
import { resolveLocale } from './case-locale.util';
import { CaseDetailDto } from './dto/case-detail.dto';
import { CaseFullDto } from './dto/case-full.dto';
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
      'Admin only. Creates a case with its text in `translations`: `ru` is required, `en` is optional for a draft. Unless `published: true` is sent it is a draft: it is not shown in the public list and its detail returns 404. A case can be published only with both `ru` and `en` (English) text, otherwise the answer is 400. The slug must be unique. A new case has no picture; upload one with `PUT /cases/{slug}/image`. The response carries the text of every language.',
  })
  @ApiCreatedResponse({
    type: CaseFullDto,
    description: 'The created case with all its translations',
  })
  @ApiErrorResponse(
    400,
    'Validation failed: a field is missing, malformed or unknown, `translations.ru` is missing, or `published: true` was sent without an English translation',
  )
  @ApiErrorResponse(409, 'A case with this slug already exists')
  @SerializeOptions(FULL)
  createCase(@Body() caseDataDto: CreateCaseDto) {
    return this.caseService.createCase(caseDataDto);
  }

  @Public()
  @Get()
  @ApiOperation({
    summary: 'List published cases',
    description:
      'Returns the published cases in the compact form used on the list page, ordered by `sortOrder` ascending and, within the same `sortOrder`, newest first. Drafts are never included. Every item carries `image` and `blurImage` (both null for a case without a picture). The text is in the language chosen with `lang` (Russian by default) and `locale` tells which one was served.',
  })
  @ApiQuery(LANG_QUERY)
  @ApiOkResponse({
    type: [CaseListItemDto],
    description: 'Published cases; an empty array when there are none',
  })
  @SerializeOptions(LIST_ITEM)
  findAll(@Query('lang') lang?: string) {
    return this.caseService.findAll(resolveLocale(lang));
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'Get a published case',
    description:
      'Returns the full case used on the detail page. The text is in the language chosen with `lang` (Russian by default) and `locale` tells which one was served. An unpublished case gives the same 404 as an unknown one, so drafts do not leak.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiQuery(LANG_QUERY)
  @ApiOkResponse({ type: CaseDetailDto, description: 'The published case' })
  @ApiErrorResponse(404, 'Unknown or unpublished case')
  @SerializeOptions(DETAIL)
  findBySlug(@Param('slug') slug: string, @Query('lang') lang?: string) {
    return this.caseService.findBySlug(slug, resolveLocale(lang));
  }

  @Patch(':slug')
  @ApiAdminAuth()
  @ApiOperation({
    summary: 'Update a case',
    description:
      'Admin only. Partial update: only the fields that are sent change, the rest stay as they are. In `translations` send only the languages and fields to change; `achievements`, when sent, replaces the whole list. A language that does not exist yet (for example `en`) must be sent complete. A case can be published only with both `ru` and `en` (English) text: `published: true` for a case without one is rejected with 400 unless the same request adds it. Works for drafts as well. The slug cannot be changed, and neither can the picture: use `PUT /cases/{slug}/image` for that.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({
    type: CaseFullDto,
    description: 'The updated case with all its translations',
  })
  @ApiErrorResponse(
    400,
    'Validation failed: a field is malformed, unknown, or the slug was sent; a new language was sent incomplete; or the case would be published without an English translation',
  )
  @ApiErrorResponse(404, 'Unknown case')
  @SerializeOptions(FULL)
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
  @ApiBody(IMAGE_UPLOAD_BODY)
  @ApiOperation({
    summary: 'Upload the picture of a case',
    description:
      'Admin only. Sets or replaces the picture of a case, drafts included. Send one file in the multipart field `file`. The server re-encodes it to a real WebP (at most 1920 px wide, never enlarged, EXIF orientation applied, metadata removed) and generates the blurred placeholder itself, so only one version is ever uploaded. The response is the case with the new `image` URL and `blurImage` data URI and the text of every language. A previous picture is removed from the storage. Uploading the same file again changes nothing.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({
    type: CaseFullDto,
    description: 'The case with its new picture and all its translations',
  })
  @ApiErrorResponse(
    400,
    'The `file` field is missing, or the file is not a valid JPEG, PNG or WebP image',
  )
  @ApiErrorResponse(404, 'Unknown case')
  @ApiErrorResponse(413, 'The file is larger than 10 MB')
  @SerializeOptions(FULL)
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

  @Put(':slug/background')
  @ApiAdminAuth()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody(BACKGROUND_UPLOAD_BODY)
  @ApiOperation({
    summary: 'Upload the background of a case',
    description:
      'Admin only. Sets or replaces the background picture of a case, drafts included. It is independent of the case picture (`PUT /cases/{slug}/image`), which stays unchanged. Send one file in the multipart field `file`. The server re-encodes it to a real WebP (at most 1920 px wide, never enlarged, EXIF orientation applied, metadata removed) and generates the blurred placeholder itself, so only one version is ever uploaded. The response is the case with the new `backgroundImage` URL and `backgroundBlurImage` data URI and the text of every language. A previous background is removed from the storage. Uploading the same file again changes nothing. The background is shown in the public detail view, not in the list.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({
    type: CaseFullDto,
    description: 'The case with its new background and all its translations',
  })
  @ApiErrorResponse(
    400,
    'The `file` field is missing, or the file is not a valid JPEG, PNG or WebP image',
  )
  @ApiErrorResponse(404, 'Unknown case')
  @ApiErrorResponse(413, 'The file is larger than 10 MB')
  @SerializeOptions(FULL)
  setBackground(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException(
        'The field "file" with a picture is required',
      );
    }
    return this.caseService.setBackground(slug, file.buffer);
  }

  @Delete(':slug/background')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiAdminAuth()
  @ApiOperation({
    summary: 'Remove the background of a case',
    description:
      'Admin only. Clears `backgroundImage` and `backgroundBlurImage` of the case and removes the stored file; the case picture stays. Repeating the call for a case that has no background is harmless and answers 204 as well.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiNoContentResponse({ description: 'The case has no background now' })
  @ApiErrorResponse(404, 'Unknown case')
  removeBackground(@Param('slug') slug: string) {
    return this.caseService.removeBackground(slug);
  }
}
