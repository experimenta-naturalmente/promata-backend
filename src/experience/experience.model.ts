import { Category, TrailDifficulty, WeekDay } from 'generated/prisma';
import { createZodDto } from 'nestjs-zod';
import z from 'zod';

const stringToInt = z
  .string()
  .transform((val) => (val === '' ? undefined : parseInt(val, 10)))
  .pipe(z.number().int().optional());

const stringToFloat = z
  .string()
  .transform((val) => (val === '' ? undefined : parseFloat(val)))
  .pipe(z.number().optional());

const booleanFromString = z
  .string()
  .optional()
  .transform((val) => (val === undefined ? undefined : val === 'true'));

const dateFromIsoString = z.iso.datetime().optional();

const searchDateFromString = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) {
      return undefined;
    }

    const trimmed = val.trim();

    if (trimmed === '') {
      return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed}T00:00:00.000Z`;
    }

    return trimmed;
  })
  .pipe(z.iso.datetime().optional());

const weekDaysSchema = z
  .union([
    z.array(z.enum(Object.values(WeekDay))),
    z
      .string()
      .transform((val) =>
        val
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item.length > 0),
      )
      .pipe(z.array(z.enum(Object.values(WeekDay)))),
  ])
  .transform((val) => (Array.isArray(val) ? val : val));

const stringListSchema = z.union([z.array(z.string()), z.string().transform((val) => [val])]);

const capacityRangeRefinement = (
  data: { experienceMinCapacity?: number; experienceCapacity?: number },
  ctx: z.RefinementCtx,
) => {
  const min = data.experienceMinCapacity;
  const max = data.experienceCapacity;

  if (min !== undefined && min < 1) {
    ctx.addIssue({
      code: 'custom',
      message: 'A quantidade mínima de pessoas deve ser de pelo menos 1',
      path: ['experienceMinCapacity'],
    });
  }

  if (max !== undefined && max < 1) {
    ctx.addIssue({
      code: 'custom',
      message: 'A quantidade máxima de pessoas deve ser de pelo menos 1',
      path: ['experienceCapacity'],
    });
  }

  if (min !== undefined && max !== undefined && min > max) {
    ctx.addIssue({
      code: 'custom',
      message: 'A quantidade máxima de pessoas deve ser maior ou igual à mínima',
      path: ['experienceCapacity'],
    });
  }
};

const UpdateExperienceFormSchema = z
  .object({
    experienceName: z.string(),
    experienceDescription: z.string(),
    experienceCategory: z.enum(Object.values(Category)),
    experienceMinCapacity: stringToInt.optional(),
    experienceCapacity: stringToInt,
    experienceStartDate: dateFromIsoString,
    experienceEndDate: dateFromIsoString,
    experiencePrice: stringToFloat.optional(),
    experienceWeekDays: weekDaysSchema.optional(),
    trailDurationMinutes: stringToInt.optional(),
    trailDifficulty: z.enum(Object.values(TrailDifficulty)).optional(),
    trailLength: stringToFloat.optional(),
    professorShouldPay: booleanFromString,
    experienceImageUrls: stringListSchema.optional(),
  })
  .superRefine(capacityRangeRefinement);

export class UpdateExperienceFormDto extends createZodDto(UpdateExperienceFormSchema) {}

const CreateExperienceFormSchema = z
  .object({
    experienceName: z.string(),
    experienceDescription: z.string(),
    experienceCategory: z.enum(Object.values(Category)),
    experienceMinCapacity: stringToInt.optional(),
    experienceCapacity: z.string().transform((val) => parseInt(val, 10)),
    experienceStartDate: dateFromIsoString,
    experienceEndDate: dateFromIsoString,
    experiencePrice: z
      .string()
      .optional()
      .transform((val) => (val === undefined || val === '' ? undefined : parseFloat(val))),
    experienceWeekDays: weekDaysSchema.optional(),
    trailDurationMinutes: z
      .string()
      .optional()
      .transform((val) => (val === undefined || val === '' ? undefined : parseInt(val, 10))),
    trailDifficulty: z.enum(Object.values(TrailDifficulty)).optional(),
    trailLength: z
      .string()
      .optional()
      .transform((val) => (val === undefined || val === '' ? undefined : parseFloat(val))),
    professorShouldPay: booleanFromString,
  })
  .superRefine(capacityRangeRefinement);

export class CreateExperienceFormDto extends createZodDto(CreateExperienceFormSchema) {}

export const UserSearchParamsSchema = z.object({
  page: z.string().transform((val) => parseInt(val, 10)),
  limit: z.string().transform((val) => parseInt(val, 10)),
  name: z.string().optional(),
  email: z.email().optional(),
});

export class UserSearchParamsDto extends createZodDto(UserSearchParamsSchema) {}

export const ExperienceSearchParamsSchema = z.object({
  page: z.string().transform((val) => parseInt(val, 10)),
  limit: z.string().transform((val) => parseInt(val, 10)),
  dir: z
    .enum(['asc', 'desc'])
    .optional()
    .transform((val) => val ?? 'asc'),
  sort: z
    .enum(['name', 'description', 'date'])
    .optional()
    .transform((val) => {
      if (val === 'date') {
        return 'startDate';
      }

      return val ?? 'createdAt';
    }),
  name: z.string().optional(),
  description: z.string().optional(),
  category: z
    .array(z.enum(Object.values(Category)))
    .or(z.enum(Object.values(Category)).transform((v) => [v]))
    .optional(),
  startDate: z.iso.datetime().optional(),
  endDate: z.iso.datetime().optional(),
});

export class ExperienceSearchParamsDto extends createZodDto(ExperienceSearchParamsSchema) {}

export const GetExperienceFilterSchema = z.object({
  category: z.enum(Object.values(Category)),
  search: z.string().optional(),
  startDate: searchDateFromString,
  endDate: searchDateFromString,
  page: z.string().transform((val) => parseInt(val, 10)),
  limit: z.string().transform((val) => parseInt(val, 10)),
});

export class GetExperienceFilterDto extends createZodDto(GetExperienceFilterSchema) {}
