import { AchievementDto } from './achievement.dto';
import { CaseFullDto } from './case-full.dto';
import { CaseFullTranslationsDto } from './case-full-translations.dto';
import { CaseTranslationDto } from './case-translation.dto';
import { CreateCaseDto } from './create-case.dto';
import { CreateCaseTranslationsDto } from './create-case-translations.dto';
import { UpdateCaseTranslationsDto } from './update-case-translations.dto';

// the metadata key @nestjs/swagger writes with @ApiProperty
const API_MODEL_PROPERTIES = 'swagger/apiModelProperties';

type Lazy = () => unknown;
type Constructor = { prototype: object };

// the Swagger document resolves these lazily, so a wrong import (undefined
// class, circular reference) would only show up when the document is built
function lazyType(dto: Constructor, property: string): unknown {
  const meta = Reflect.getMetadata(
    API_MODEL_PROPERTIES,
    dto.prototype,
    property,
  ) as { type: Lazy };
  return meta.type();
}

describe('lazy Swagger types of the case DTOs', () => {
  it.each([
    [CreateCaseDto, 'translations', CreateCaseTranslationsDto],
    [CreateCaseTranslationsDto, 'ru', CaseTranslationDto],
    [CreateCaseTranslationsDto, 'en', CaseTranslationDto],
    [UpdateCaseTranslationsDto, 'ru', undefined],
    [UpdateCaseTranslationsDto, 'en', undefined],
    [CaseFullDto, 'translations', CaseFullTranslationsDto],
    [CaseFullTranslationsDto, 'ru', undefined],
    [CaseFullTranslationsDto, 'en', undefined],
    [CaseTranslationDto, 'achievements', [AchievementDto]],
  ])('%p.%s points at a defined class', (dto, property, expected) => {
    const type = lazyType(dto, property);

    expect(type).toBeDefined();
    if (expected) expect(type).toEqual(expected);
  });
});
