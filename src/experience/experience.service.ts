import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { StorageService } from 'src/storage/storage.service';
import { Prisma } from 'generated/prisma';
import {
  CreateExperienceFormDto,
  ExperienceSearchParamsDto,
  GetExperienceFilterDto,
  UpdateExperienceFormDto,
} from './experience.model';
import { isPerDayOnlyCategory, toPublicExperienceFilterCategory } from './experience-pricing';

const IMAGE_GALLERY_SELECT = {
  select: { image: { select: { url: true } } },
  orderBy: { position: 'asc' },
} as const;

/// Achata a galeria (`ExperienceImage[]`) em uma lista simples de URLs para o cliente.
function flattenGallery<T extends { images: { image: { url: string } }[] }>(experience: T) {
  const { images, ...rest } = experience;

  return { ...rest, images: images.map(({ image }) => image) };
}

@Injectable()
export class ExperienceService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  private async uploadExperienceImages(files?: Express.Multer.File[] | null) {
    const images: { id: string; url: string }[] = [];

    for (const file of files ?? []) {
      const uploaded = await this.storageService.uploadFile(file, {
        directory: 'experiences',
        contentType: file.mimetype ?? undefined,
        cacheControl: 'public, max-age=31536000',
      });

      const createdImage = await this.databaseService.image.create({
        data: { url: uploaded.url },
      });

      images.push(createdImage);
    }

    return images;
  }

  private async resolveImagesByUrl(urls?: string[] | null) {
    if (!urls || urls.length === 0) {
      return [];
    }

    const images = await this.databaseService.image.findMany({
      where: { url: { in: urls } },
      select: { id: true, url: true },
    });
    const byUrl = new Map(images.map((image) => [image.url, image]));

    return urls
      .map((url) => byUrl.get(url))
      .filter((image): image is { id: string; url: string } => image !== undefined);
  }

  async getExperience(experienceId: string) {
    const experience = await this.databaseService.experience.findUnique({
      where: { id: experienceId },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        minCapacity: true,
        capacity: true,
        startDate: true,
        endDate: true,
        price: true,
        weekDays: true,
        durationMinutes: true,
        trailDifficulty: true,
        trailLength: true,
        professorShouldPay: true,
        image: {
          select: {
            url: true,
          },
        },
        images: IMAGE_GALLERY_SELECT,
      },
    });

    if (!experience) {
      throw new NotFoundException('Experiência não encontrada');
    }

    return flattenGallery(experience);
  }

  async deleteExperience(experienceId: string) {
    const experience = await this.databaseService.experience.findUnique({
      where: { id: experienceId },
      select: { id: true },
    });

    if (!experience) {
      throw new NotFoundException('Experiência não encontrada');
    }

    const reservationCount = await this.databaseService.reservation.count({
      where: {
        experienceId,
        active: true,
        ReservationGroup: { active: true },
      },
    });

    if (reservationCount > 0) {
      throw new BadRequestException(
        'Não é possível deletar a experiência pois existem reservas associadas. Desative-a em vez de deletar.',
      );
    }

    await this.databaseService.experience.delete({
      where: { id: experienceId },
    });
  }

  async toggleExperienceStatus(experienceId: string, active: boolean) {
    const experience = await this.databaseService.experience.findUnique({
      where: { id: experienceId },
    });

    if (!experience) {
      throw new NotFoundException('Experiência não encontrada');
    }

    await this.databaseService.experience.update({
      where: { id: experienceId },
      data: { active },
    });
  }

  async updateExperience(
    experienceId: string,
    updateExperienceDto: UpdateExperienceFormDto,
    files?: Express.Multer.File[] | null,
  ) {
    const keptUrls = updateExperienceDto.experienceImageUrls;
    const keptImages = await this.resolveImagesByUrl(keptUrls);
    const uploadedImages = await this.uploadExperienceImages(files);
    const galleryImages = [...keptImages, ...uploadedImages];
    // Um cliente que não menciona imagens mantém a galeria intacta.
    const gallery =
      keptUrls === undefined && uploadedImages.length === 0
        ? {}
        : {
            images: {
              deleteMany: {},
              create: galleryImages.map((image, position) => ({
                imageId: image.id,
                position,
              })),
            },
          };

    await this.databaseService.experience.update({
      where: { id: experienceId },
      data: {
        name: updateExperienceDto.experienceName,
        description: updateExperienceDto.experienceDescription,
        category: updateExperienceDto.experienceCategory,
        minCapacity: updateExperienceDto.experienceMinCapacity,
        capacity: updateExperienceDto.experienceCapacity,
        startDate: updateExperienceDto.experienceStartDate,
        endDate: updateExperienceDto.experienceEndDate,
        price: updateExperienceDto.experiencePrice,
        weekDays: updateExperienceDto.experienceWeekDays,
        durationMinutes: updateExperienceDto.trailDurationMinutes,
        trailDifficulty: updateExperienceDto.trailDifficulty,
        trailLength: updateExperienceDto.trailLength,
        imageId: galleryImages[0]?.id,
        ...gallery,
      },
    });
  }

  async searchExperience(experienceSearchParamsDto: ExperienceSearchParamsDto) {
    const where: Prisma.ExperienceWhereInput = {
      name: {
        contains: experienceSearchParamsDto.name,
      },
      description: {
        contains: experienceSearchParamsDto.description,
      },
      startDate: {
        gte: experienceSearchParamsDto.startDate,
      },
      endDate: {
        lte: experienceSearchParamsDto.endDate,
      },
    };

    if (experienceSearchParamsDto.category && experienceSearchParamsDto.category.length > 0) {
      where.category = {
        in: experienceSearchParamsDto.category,
      };
    }

    const experiences = await this.databaseService.experience.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        startDate: true,
        endDate: true,
        active: true,
        category: true,
        price: true,
      },
      orderBy: {
        [experienceSearchParamsDto.sort]: experienceSearchParamsDto.dir,
      },
      skip: experienceSearchParamsDto.limit * experienceSearchParamsDto.page,
      take: experienceSearchParamsDto.limit,
    });

    const total = await this.databaseService.experience.count({ where });

    return {
      page: experienceSearchParamsDto.page,
      limit: experienceSearchParamsDto.limit,
      total,
      items: experiences,
    };
  }

  async createExperience(
    createExperienceDto: CreateExperienceFormDto,
    files?: Express.Multer.File[] | null,
  ) {
    const uploadedImages = await this.uploadExperienceImages(files);

    await this.databaseService.experience.create({
      data: {
        name: createExperienceDto.experienceName,
        description: createExperienceDto.experienceDescription,
        category: createExperienceDto.experienceCategory,
        minCapacity: createExperienceDto.experienceMinCapacity,
        capacity: createExperienceDto.experienceCapacity,
        startDate: createExperienceDto.experienceStartDate,
        endDate: createExperienceDto.experienceEndDate,
        price: createExperienceDto.experiencePrice,
        weekDays: createExperienceDto.experienceWeekDays,
        durationMinutes: createExperienceDto.trailDurationMinutes,
        trailDifficulty: createExperienceDto.trailDifficulty,
        trailLength: createExperienceDto.trailLength,
        active: true,
        imageId: uploadedImages[0]?.id,
        images: {
          create: uploadedImages.map((image, position) => ({ imageId: image.id, position })),
        },
      },
    });
  }

  async getExperienceFilter(getExperienceFilterDto: GetExperienceFilterDto) {
    const andConditions: Prisma.ExperienceWhereInput[] = [];

    const rangeStart = getExperienceFilterDto.startDate ?? getExperienceFilterDto.endDate;
    const rangeEnd = getExperienceFilterDto.endDate ?? getExperienceFilterDto.startDate;

    if (rangeStart) {
      andConditions.push({
        OR: [{ startDate: null }, { startDate: { lte: rangeStart } }],
      });
    }

    if (rangeEnd) {
      andConditions.push({
        OR: [{ endDate: null }, { endDate: { gte: rangeEnd } }],
      });
    }

    const where: Prisma.ExperienceWhereInput = {
      category: toPublicExperienceFilterCategory(getExperienceFilterDto.category),
      name: {
        contains: getExperienceFilterDto.search,
        mode: 'insensitive',
      },
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };

    const experiences = await this.databaseService.experience.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        category: true,
        minCapacity: true,
        capacity: true,
        startDate: true,
        endDate: true,
        price: true,
        weekDays: true,
        durationMinutes: true,
        trailDifficulty: true,
        trailLength: true,
        image: {
          select: {
            url: true,
          },
        },
        images: IMAGE_GALLERY_SELECT,
      },

      skip: getExperienceFilterDto.limit * getExperienceFilterDto.page,
      take: getExperienceFilterDto.limit,
    });

    const total = await this.databaseService.experience.count({ where });
    const items = experiences.map((experience) => ({
      ...flattenGallery(experience),
      priceMax:
        experience.price == null
          ? null
          : isPerDayOnlyCategory(experience.category)
            ? experience.price.toNumber()
            : experience.price.mul(experience.capacity).toNumber(),
    }));

    return {
      page: getExperienceFilterDto.page,
      limit: getExperienceFilterDto.limit,
      total,
      items,
    };
  }
}
