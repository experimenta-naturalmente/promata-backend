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
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { ExperienceService } from './experience.service';
import { Roles } from 'src/auth/role/roles.decorator';
import { Public } from 'src/auth/role/public.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UserType } from 'generated/prisma';
import {
  CreateExperienceFormDto,
  ExperienceSearchParamsDto,
  UpdateExperienceFormDto,
  GetExperienceFilterDto,
} from './experience.model';
import { IMAGE_UPLOAD, MAX_EXPERIENCE_IMAGES } from 'src/common/upload.options';

/// Aceita tanto o campo legado `image` (uma foto) quanto `images` (galeria).
export interface ExperienceImageFiles {
  image?: Express.Multer.File[];
  images?: Express.Multer.File[];
}

const EXPERIENCE_IMAGE_FIELDS = [
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: MAX_EXPERIENCE_IMAGES },
];

const toImageList = (files?: ExperienceImageFiles | null): Express.Multer.File[] => [
  ...(files?.image ?? []),
  ...(files?.images ?? []),
];

@Controller('experience')
export class ExperienceController {
  constructor(private readonly experienceService: ExperienceService) {}

  @Delete(':experienceId')
  @Roles(UserType.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteExperience(@Param('experienceId') experienceId: string) {
    await this.experienceService.deleteExperience(experienceId);
  }

  @Patch(':experienceId/status/:active')
  @Roles(UserType.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async toggleExperienceStatus(
    @Param('experienceId') experienceId: string,
    @Param('active') active: string,
  ) {
    const isActive = active === 'true';
    await this.experienceService.toggleExperienceStatus(experienceId, isActive);
  }

  @Patch(':experienceId')
  @Roles(UserType.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor(EXPERIENCE_IMAGE_FIELDS, IMAGE_UPLOAD))
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateExperienceAsAdmin(
    @Param('experienceId') experienceId: string,
    @Body() updateExperienceDto: UpdateExperienceFormDto,
    @UploadedFiles() files: ExperienceImageFiles | null,
  ) {
    await this.experienceService.updateExperience(
      experienceId,
      updateExperienceDto,
      toImageList(files),
    );
  }

  @Get()
  @Roles(UserType.ADMIN)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  async searchExperience(@Query() experienceSearchParamsDto: ExperienceSearchParamsDto) {
    return await this.experienceService.searchExperience(experienceSearchParamsDto);
  }

  @Post()
  @Roles(UserType.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileFieldsInterceptor(EXPERIENCE_IMAGE_FIELDS, IMAGE_UPLOAD))
  @HttpCode(HttpStatus.CREATED)
  async createExperienceAsAdmin(
    @Body() createExperienceDto: CreateExperienceFormDto,
    @UploadedFiles() files: ExperienceImageFiles | null,
  ) {
    return await this.experienceService.createExperience(createExperienceDto, toImageList(files));
  }

  @Public()
  @Get('search')
  @HttpCode(HttpStatus.OK)
  async getExperienceFilter(@Query() getExperienceFilterDto: GetExperienceFilterDto) {
    return await this.experienceService.getExperienceFilter(getExperienceFilterDto);
  }

  @Public()
  @Get(':experienceId')
  @HttpCode(HttpStatus.OK)
  async getExperience(@Param('experienceId') experienceId: string) {
    return await this.experienceService.getExperience(experienceId);
  }
}
