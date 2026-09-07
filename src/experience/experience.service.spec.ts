/* eslint-disable @typescript-eslint/unbound-method */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ExperienceService } from './experience.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateExperienceFormDto,
  UpdateExperienceFormDto,
  ExperienceSearchParamsDto,
  GetExperienceFilterDto,
} from './experience.model';

describe('ExperienceService', () => {
  let service: ExperienceService;
  let databaseService: any;
  let storageService: any;

  const mockFile = {
    fieldname: 'image',
    originalname: 'test.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image-content'),
    size: 1024,
  } as Express.Multer.File;

  beforeEach(async () => {
    const mockDatabaseService = {
      experience: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      image: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      reservation: {
        count: jest.fn(),
      },
    };

    const mockStorageService = {
      uploadFile: jest.fn(),
      deleteFileByUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperienceService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<ExperienceService>(ExperienceService);
    databaseService = module.get(DatabaseService);
    storageService = module.get(StorageService);

    jest.clearAllMocks();
  });

  describe('deleteExperience', () => {
    const experienceId = '1b7b4b0a-1e67-41af-9f0f-4a11f3e8a9f7';

    it('should delete experience when it exists and has no reservations', async () => {
      databaseService.experience.findUnique.mockResolvedValueOnce({ id: experienceId } as never);
      databaseService.reservation.count.mockResolvedValueOnce(0);
      databaseService.experience.delete.mockResolvedValueOnce({} as never);

      await service.deleteExperience(experienceId);

      expect(databaseService.experience.findUnique).toHaveBeenCalledWith({
        where: { id: experienceId },
        select: { id: true },
      });

      expect(databaseService.reservation.count).toHaveBeenCalledWith({
        where: {
          experienceId,
          active: true,
          ReservationGroup: { active: true },
        },
      });

      expect(databaseService.experience.delete).toHaveBeenCalledWith({
        where: { id: experienceId },
      });
    });

    it('should throw NotFoundException when experience does not exist', async () => {
      databaseService.experience.findUnique.mockResolvedValueOnce(null);

      const deletePromise = service.deleteExperience(experienceId);

      await expect(deletePromise).rejects.toThrow(NotFoundException);
      await expect(deletePromise).rejects.toThrow('Experiência não encontrada');

      expect(databaseService.reservation.count).not.toHaveBeenCalled();
      expect(databaseService.experience.delete).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when there are reservations', async () => {
      databaseService.experience.findUnique.mockResolvedValueOnce({ id: experienceId } as never);
      databaseService.reservation.count.mockResolvedValueOnce(2);

      const deletePromise = service.deleteExperience(experienceId);

      await expect(deletePromise).rejects.toThrow(BadRequestException);
      await expect(deletePromise).rejects.toThrow(
        'Não é possível deletar a experiência pois existem reservas associadas. Desative-a em vez de deletar.',
      );

      expect(databaseService.experience.delete).not.toHaveBeenCalled();
    });
  });

  describe('toggleExperienceStatus', () => {
    const experienceId = '1b7b4b0a-1e67-41af-9f0f-4a11f3e8a9f7';

    it('should activate experience when active is true', async () => {
      const mockExperience = { id: experienceId, active: false };

      databaseService.experience.findUnique.mockResolvedValueOnce(mockExperience as never);
      databaseService.experience.update.mockResolvedValueOnce({} as never);

      await service.toggleExperienceStatus(experienceId, true);

      expect(databaseService.experience.findUnique).toHaveBeenCalledWith({
        where: { id: experienceId },
      });

      expect(databaseService.experience.update).toHaveBeenCalledWith({
        where: { id: experienceId },
        data: { active: true },
      });
    });

    it('should deactivate experience when active is false', async () => {
      const mockExperience = { id: experienceId, active: true };

      databaseService.experience.findUnique.mockResolvedValueOnce(mockExperience as never);
      databaseService.experience.update.mockResolvedValueOnce({} as never);

      await service.toggleExperienceStatus(experienceId, false);

      expect(databaseService.experience.findUnique).toHaveBeenCalledWith({
        where: { id: experienceId },
      });

      expect(databaseService.experience.update).toHaveBeenCalledWith({
        where: { id: experienceId },
        data: { active: false },
      });
    });

    it('should throw NotFoundException when experience does not exist', async () => {
      databaseService.experience.findUnique.mockResolvedValueOnce(null);

      await expect(service.toggleExperienceStatus(experienceId, true)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.toggleExperienceStatus(experienceId, true)).rejects.toThrow(
        'Experiência não encontrada',
      );

      expect(databaseService.experience.update).not.toHaveBeenCalled();
    });
  });

  describe('getExperience', () => {
    const experienceId = 'exp-1';

    it('should return experience data without active flag when active experience exists', async () => {
      const experience = {
        id: experienceId,
        name: 'Experience name',
        description: 'Description',
        category: 'TRAIL',
        minCapacity: 5,
        capacity: 20,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-01-31'),
        price: 100,
        weekDays: ['MONDAY'],
        durationMinutes: 120,
        trailDifficulty: 'LIGHT',
        trailLength: 5,
        professorShouldPay: true,
        active: true,
        image: { url: 'https://example.com/image.png' },
        images: [
          { image: { url: 'https://example.com/image.png' } },
          { image: { url: 'https://example.com/image-2.png' } },
        ],
      };

      databaseService.experience.findUnique.mockResolvedValueOnce(experience);

      const result = await service.getExperience(experienceId);

      expect(result).toEqual({
        id: experience.id,
        name: experience.name,
        description: experience.description,
        category: experience.category,
        minCapacity: experience.minCapacity,
        capacity: experience.capacity,
        startDate: experience.startDate,
        endDate: experience.endDate,
        price: experience.price,
        weekDays: experience.weekDays,
        durationMinutes: experience.durationMinutes,
        trailDifficulty: experience.trailDifficulty,
        trailLength: experience.trailLength,
        professorShouldPay: experience.professorShouldPay,
        active: experience.active,
        image: experience.image,
        images: [
          { url: 'https://example.com/image.png' },
          { url: 'https://example.com/image-2.png' },
        ],
      });
    });

    it('should throw NotFoundException when experience does not exist', async () => {
      databaseService.experience.findUnique.mockResolvedValueOnce(null);

      await expect(service.getExperience(experienceId)).rejects.toThrow(NotFoundException);
      await expect(service.getExperience(experienceId)).rejects.toThrow(
        'Experiência não encontrada',
      );
    });

    it('should throw NotFoundException when experience is inactive', async () => {
      databaseService.experience.findUnique.mockResolvedValueOnce(null);

      await expect(service.getExperience(experienceId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateExperience', () => {
    const experienceId = '1b7b4b0a-1e67-41af-9f0f-4a11f3e8a9f7';
    const imageId = '2c8c5c1b-2f78-52bg-0g1g-5b22g4f9b0g8';
    const uploadedUrl = 'https://s3.example.com/experiences/updated.jpg';

    it('should update experience without file', async () => {
      const dto: UpdateExperienceFormDto = {
        experienceName: 'Updated Experience',
        experienceDescription: 'Updated description',
        experienceCategory: 'ADVENTURE',
        experienceMinCapacity: 5,
        experienceCapacity: 20,
        experienceStartDate: '2025-01-01T10:00:00Z',
        experienceEndDate: '2025-12-31T18:00:00Z',
        experiencePrice: 150.5,
        experienceWeekDays: ['MONDAY', 'WEDNESDAY'],
        trailDurationMinutes: 180,
        trailDifficulty: 'MEDIUM',
        trailLength: 8,
      } as never;

      databaseService.experience.update.mockResolvedValueOnce({} as never);

      await service.updateExperience(experienceId, dto, null);

      expect(storageService.uploadFile).not.toHaveBeenCalled();
      expect(databaseService.experience.update).toHaveBeenCalledWith({
        where: { id: experienceId },
        data: {
          name: dto.experienceName,
          description: dto.experienceDescription,
          category: dto.experienceCategory,
          minCapacity: dto.experienceMinCapacity,
          capacity: dto.experienceCapacity,
          startDate: dto.experienceStartDate,
          endDate: dto.experienceEndDate,
          price: dto.experiencePrice,
          weekDays: dto.experienceWeekDays,
          durationMinutes: dto.trailDurationMinutes,
          trailDifficulty: dto.trailDifficulty,
          trailLength: dto.trailLength,
          imageId: undefined,
        },
      });
    });

    it('should update experience with file upload', async () => {
      const dto: UpdateExperienceFormDto = {
        experienceName: 'Experience with Image',
      } as never;

      const mockImage = { id: imageId, url: uploadedUrl };

      storageService.uploadFile.mockResolvedValueOnce({ url: uploadedUrl });
      databaseService.image.create.mockResolvedValueOnce(mockImage as never);
      databaseService.experience.update.mockResolvedValueOnce({} as never);

      await service.updateExperience(experienceId, dto, [mockFile]);

      expect(storageService.uploadFile).toHaveBeenCalledWith(mockFile, {
        directory: 'experiences',
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      });

      expect(databaseService.image.create).toHaveBeenCalledWith({
        data: { url: uploadedUrl },
      });

      expect(databaseService.experience.update).toHaveBeenCalledWith({
        where: { id: experienceId },
        data: {
          name: dto.experienceName,
          description: undefined,
          category: undefined,
          minCapacity: undefined,
          capacity: undefined,
          startDate: undefined,
          endDate: undefined,
          price: undefined,
          weekDays: undefined,
          durationMinutes: undefined,
          trailDifficulty: undefined,
          trailLength: undefined,
          imageId,
          images: {
            deleteMany: {},
            create: [{ imageId, position: 0 }],
          },
        },
      });
    });

    it('should replace the whole gallery when several files are sent', async () => {
      const dto: UpdateExperienceFormDto = { experienceName: 'Gallery' } as never;
      const secondFile = { ...mockFile, originalname: 'second.jpg' } as Express.Multer.File;

      storageService.uploadFile
        .mockResolvedValueOnce({ url: uploadedUrl })
        .mockResolvedValueOnce({ url: 'https://s3.example.com/experiences/second.jpg' });
      databaseService.image.create
        .mockResolvedValueOnce({ id: imageId, url: uploadedUrl } as never)
        .mockResolvedValueOnce({ id: 'second-image-id', url: 'second' } as never);
      databaseService.experience.update.mockResolvedValueOnce({} as never);

      await service.updateExperience(experienceId, dto, [mockFile, secondFile]);

      expect(databaseService.experience.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imageId,
            images: {
              deleteMany: {},
              create: [
                { imageId, position: 0 },
                { imageId: 'second-image-id', position: 1 },
              ],
            },
          }),
        }),
      );
    });

    it('should keep the listed urls before the newly uploaded files', async () => {
      const dto: UpdateExperienceFormDto = {
        experienceName: 'Mixed gallery',
        experienceImageUrls: ['https://s3.example.com/b.jpg', 'https://s3.example.com/a.jpg'],
      } as never;

      // Retorno fora de ordem para provar que a ordem enviada é a que vale
      databaseService.image.findMany.mockResolvedValueOnce([
        { id: 'image-a', url: 'https://s3.example.com/a.jpg' },
        { id: 'image-b', url: 'https://s3.example.com/b.jpg' },
      ] as never);
      storageService.uploadFile.mockResolvedValueOnce({ url: uploadedUrl });
      databaseService.image.create.mockResolvedValueOnce({ id: imageId, url: uploadedUrl } as never);
      databaseService.experience.update.mockResolvedValueOnce({} as never);

      await service.updateExperience(experienceId, dto, [mockFile]);

      expect(databaseService.experience.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imageId: 'image-b',
            images: {
              deleteMany: {},
              create: [
                { imageId: 'image-b', position: 0 },
                { imageId: 'image-a', position: 1 },
                { imageId, position: 2 },
              ],
            },
          }),
        }),
      );
    });

    it('should drop urls that no longer exist in the database', async () => {
      const dto: UpdateExperienceFormDto = {
        experienceName: 'Stale url',
        experienceImageUrls: ['https://s3.example.com/gone.jpg', 'https://s3.example.com/a.jpg'],
      } as never;

      databaseService.image.findMany.mockResolvedValueOnce([
        { id: 'image-a', url: 'https://s3.example.com/a.jpg' },
      ] as never);
      databaseService.experience.update.mockResolvedValueOnce({} as never);

      await service.updateExperience(experienceId, dto, []);

      expect(storageService.uploadFile).not.toHaveBeenCalled();
      expect(databaseService.experience.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imageId: 'image-a',
            images: { deleteMany: {}, create: [{ imageId: 'image-a', position: 0 }] },
          }),
        }),
      );
    });

    it('should update experience with file upload missing mimetype', async () => {
      const dto: UpdateExperienceFormDto = {
        experienceName: 'Update No Mime',
      } as never;

      const fileNoMime = { ...mockFile, mimetype: undefined } as unknown as Express.Multer.File;
      storageService.uploadFile.mockResolvedValueOnce({ url: 'url' });
      databaseService.image.create.mockResolvedValueOnce({ id: 'img-id' } as never);
      databaseService.experience.update.mockResolvedValueOnce({} as never);

      await service.updateExperience(experienceId, dto, [fileNoMime]);

      expect(storageService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ originalname: 'test.jpg' }),
        expect.objectContaining({ contentType: undefined }),
      );
    });
  });

  describe('searchExperience', () => {
    it('should search experiences with filters and pagination', async () => {
      const searchParams: ExperienceSearchParamsDto = {
        page: 0,
        limit: 10,
        dir: 'asc',
        sort: 'name',
        name: 'Trail',
        description: 'Mountain',
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2025-12-31T00:00:00Z'),
      } as never;

      const mockExperiences = [
        {
          id: 'exp-1',
          name: 'Mountain Trail',
          description: 'Beautiful mountain trail',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
        },
      ];

      databaseService.experience.findMany.mockResolvedValueOnce(mockExperiences as never);
      databaseService.experience.count.mockResolvedValueOnce(1);

      const result = await service.searchExperience(searchParams);

      expect(result).toEqual({
        page: 0,
        limit: 10,
        total: 1,
        items: mockExperiences,
      });

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Trail' },
            description: { contains: 'Mountain' },
            startDate: { gte: new Date('2025-01-01') },
            endDate: { lte: new Date('2025-12-31') },
          }),
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
          orderBy: { name: 'asc' },
          skip: 0,
          take: 10,
        }),
      );

      expect(databaseService.experience.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Trail' },
            description: { contains: 'Mountain' },
            startDate: { gte: new Date('2025-01-01') },
            endDate: { lte: new Date('2025-12-31') },
          }),
        }),
      );
    });

    it('should search with pagination on second page', async () => {
      const searchParams: ExperienceSearchParamsDto = {
        page: 2,
        limit: 5,
        dir: 'desc',
        sort: 'description',
      } as never;

      databaseService.experience.findMany.mockResolvedValueOnce([]);
      databaseService.experience.count.mockResolvedValueOnce(12);

      const result = await service.searchExperience(searchParams);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.total).toBe(12);

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: undefined },
            description: { contains: undefined },
            startDate: { lte: undefined },
            endDate: { gte: undefined },
          }),
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
          orderBy: { description: 'desc' },
          skip: 10,
          take: 5,
        }),
      );
    });

    it('should search without filters', async () => {
      const searchParams: ExperienceSearchParamsDto = {
        page: 0,
        limit: 20,
        dir: 'asc',
        sort: 'name',
      } as never;

      const mockExperiences = [
        { id: '1', name: 'Exp 1' },
        { id: '2', name: 'Exp 2' },
      ];

      databaseService.experience.findMany.mockResolvedValueOnce(mockExperiences as never);
      databaseService.experience.count.mockResolvedValueOnce(2);

      await service.searchExperience(searchParams);

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: undefined },
            description: { contains: undefined },
            startDate: { lte: undefined },
            endDate: { gte: undefined },
          }),
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
          orderBy: { name: 'asc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should return empty results when no experiences match', async () => {
      const searchParams: ExperienceSearchParamsDto = {
        page: 0,
        limit: 10,
        dir: 'asc',
        sort: 'name',
        name: 'NonExistent',
      } as never;

      databaseService.experience.findMany.mockResolvedValueOnce([]);
      databaseService.experience.count.mockResolvedValueOnce(0);

      const result = await service.searchExperience(searchParams);

      expect(result).toEqual({
        page: 0,
        limit: 10,
        total: 0,
        items: [],
      });
    });

    it('should search with category filter', async () => {
      const searchParams: ExperienceSearchParamsDto = {
        page: 0,
        limit: 10,
        dir: 'asc',
        sort: 'name',
        category: ['TRAIL', 'ADVENTURE'],
      } as never;

      databaseService.experience.findMany.mockResolvedValueOnce([]);
      databaseService.experience.count.mockResolvedValueOnce(0);

      await service.searchExperience(searchParams);

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { in: ['TRAIL', 'ADVENTURE'] },
          }),
        }),
      );
    });

    it('should handle date range filtering correctly', async () => {
      const searchParams: ExperienceSearchParamsDto = {
        page: 0,
        limit: 10,
        dir: 'asc',
        sort: 'name',
        startDate: '2025-07-15T12:00:00Z',
        endDate: '2025-07-15T12:00:00Z',
      } as never;

      databaseService.experience.findMany.mockResolvedValueOnce([]);
      databaseService.experience.count.mockResolvedValueOnce(0);

      await service.searchExperience(searchParams);

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDate: { gte: '2025-07-15T12:00:00Z' },
            endDate: { lte: '2025-07-15T12:00:00Z' },
          }),
        }),
      );
    });
  });

  describe('createExperience', () => {
    const imageId = '2c8c5c1b-2f78-52bg-0g1g-5b22g4f9b0g8';
    const uploadedUrl = 'https://s3.example.com/experiences/created.jpg';

    it('should create experience without file', async () => {
      const dto: CreateExperienceFormDto = {
        experienceName: 'Simple Experience',
        experienceDescription: 'Basic trail',
        experienceCategory: 'NATURE',
        experienceMinCapacity: 2,
        experienceCapacity: 10,
        experienceWeekDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      } as never;

      databaseService.experience.create.mockResolvedValueOnce({} as never);

      await service.createExperience(dto, null);

      expect(storageService.uploadFile).not.toHaveBeenCalled();
      expect(databaseService.experience.create).toHaveBeenCalledWith({
        data: {
          name: dto.experienceName,
          description: dto.experienceDescription,
          category: dto.experienceCategory,
          minCapacity: dto.experienceMinCapacity,
          capacity: dto.experienceCapacity,
          startDate: undefined,
          endDate: undefined,
          price: undefined,
          weekDays: dto.experienceWeekDays,
          durationMinutes: undefined,
          trailDifficulty: undefined,
          trailLength: undefined,
          active: true,
          imageId: undefined,
          images: { create: [] },
        },
      });
    });

    it('should create experience with file upload', async () => {
      const dto: CreateExperienceFormDto = {
        experienceName: 'Mountain Adventure',
        experienceDescription: 'Amazing mountain trail',
        experienceCategory: 'ADVENTURE',
        experienceMinCapacity: 4,
        experienceCapacity: 20,
        experienceStartDate: '2025-01-01T08:00:00Z',
        experienceEndDate: '2025-12-31T18:00:00Z',
        experiencePrice: 250,
        experienceWeekDays: ['SATURDAY', 'SUNDAY'],
        trailDurationMinutes: 240,
        trailDifficulty: 'HARD',
        trailLength: 12,
      } as never;

      const mockImage = { id: imageId, url: uploadedUrl };

      storageService.uploadFile.mockResolvedValueOnce({ url: uploadedUrl });
      databaseService.image.create.mockResolvedValueOnce(mockImage as never);
      databaseService.experience.create.mockResolvedValueOnce({} as never);

      await service.createExperience(dto, [mockFile]);

      expect(storageService.uploadFile).toHaveBeenCalledWith(mockFile, {
        directory: 'experiences',
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      });

      expect(databaseService.image.create).toHaveBeenCalledWith({
        data: { url: uploadedUrl },
      });

      expect(databaseService.experience.create).toHaveBeenCalledWith({
        data: {
          name: dto.experienceName,
          description: dto.experienceDescription,
          category: dto.experienceCategory,
          minCapacity: dto.experienceMinCapacity,
          capacity: dto.experienceCapacity,
          startDate: dto.experienceStartDate,
          endDate: dto.experienceEndDate,
          price: dto.experiencePrice,
          weekDays: dto.experienceWeekDays,
          durationMinutes: dto.trailDurationMinutes,
          trailDifficulty: dto.trailDifficulty,
          trailLength: dto.trailLength,
          active: true,
          imageId,
          images: { create: [{ imageId, position: 0 }] },
        },
      });
    });

    it('should create experience with several images keeping the upload order', async () => {
      const dto: CreateExperienceFormDto = { experienceName: 'Gallery' } as never;
      const files = ['a.jpg', 'b.jpg', 'c.jpg'].map(
        (originalname) => ({ ...mockFile, originalname }) as Express.Multer.File,
      );

      storageService.uploadFile
        .mockResolvedValueOnce({ url: 'https://s3.example.com/experiences/a.jpg' })
        .mockResolvedValueOnce({ url: 'https://s3.example.com/experiences/b.jpg' })
        .mockResolvedValueOnce({ url: 'https://s3.example.com/experiences/c.jpg' });
      databaseService.image.create
        .mockResolvedValueOnce({ id: 'image-a' } as never)
        .mockResolvedValueOnce({ id: 'image-b' } as never)
        .mockResolvedValueOnce({ id: 'image-c' } as never);
      databaseService.experience.create.mockResolvedValueOnce({} as never);

      await service.createExperience(dto, files);

      expect(storageService.uploadFile).toHaveBeenCalledTimes(3);
      expect(databaseService.experience.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            // A capa continua sendo a primeira imagem enviada
            imageId: 'image-a',
            images: {
              create: [
                { imageId: 'image-a', position: 0 },
                { imageId: 'image-b', position: 1 },
                { imageId: 'image-c', position: 2 },
              ],
            },
          }),
        }),
      );
    });

    it('should create experience with file upload missing mimetype', async () => {
      const dto: CreateExperienceFormDto = {
        experienceName: 'No Mime',
      } as never;

      const fileNoMime = { ...mockFile, mimetype: undefined } as unknown as Express.Multer.File;
      storageService.uploadFile.mockResolvedValueOnce({ url: 'url' });
      databaseService.image.create.mockResolvedValueOnce({ id: 'img-id' } as never);
      databaseService.experience.create.mockResolvedValueOnce({} as never);

      await service.createExperience(dto, [fileNoMime]);

      expect(storageService.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({ originalname: 'test.jpg' }),
        expect.objectContaining({ contentType: undefined }),
      );
    });
  });

  describe('getExperienceFilter', () => {
    it('should add the maximum price based on unit price and capacity', async () => {
      const filterDto: GetExperienceFilterDto = {
        page: 0,
        limit: 10,
        category: 'HOSPEDAGEM',
      } as never;
      const toNumber = jest.fn().mockReturnValue(1200);
      const price = {
        mul: jest.fn().mockReturnValue({ toNumber }),
      };

      databaseService.experience.findMany.mockResolvedValueOnce([
        {
          id: 'experience-1',
          price,
          capacity: 4,
          images: [
            { image: { url: 'https://example.com/first.png' } },
            { image: { url: 'https://example.com/second.png' } },
          ],
        },
      ]);
      databaseService.experience.count.mockResolvedValueOnce(1);

      const result = await service.getExperienceFilter(filterDto);

      expect(price.mul).toHaveBeenCalledWith(4);
      expect(toNumber).toHaveBeenCalledTimes(1);
      expect(result.items[0].priceMax).toBe(1200);
      expect(result.items[0].images).toEqual([
        { url: 'https://example.com/first.png' },
        { url: 'https://example.com/second.png' },
      ]);
    });

    it('should keep house hosting priceMax as the daily rate', async () => {
      const filterDto: GetExperienceFilterDto = {
        page: 0,
        limit: 10,
        category: 'HOSTING_HOUSE',
      } as never;
      const toNumber = jest.fn().mockReturnValue(350);
      const price = {
        mul: jest.fn(),
        toNumber,
      };

      databaseService.experience.findMany.mockResolvedValueOnce([
        {
          id: 'house-1',
          category: 'HOSTING_HOUSE',
          price,
          capacity: 8,
          images: [],
        },
      ]);
      databaseService.experience.count.mockResolvedValueOnce(1);

      const result = await service.getExperienceFilter(filterDto);

      expect(price.mul).not.toHaveBeenCalled();
      expect(toNumber).toHaveBeenCalledTimes(1);
      expect(result.items[0].priceMax).toBe(350);
    });

    it('should include room and house hosting when filtering by HOSTING', async () => {
      const filterDto: GetExperienceFilterDto = {
        page: 0,
        limit: 10,
        category: 'HOSTING',
      } as never;

      databaseService.experience.findMany.mockResolvedValueOnce([]);
      databaseService.experience.count.mockResolvedValueOnce(0);

      await service.getExperienceFilter(filterDto);

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: { in: ['HOSTING', 'HOSTING_HOUSE'] },
          }),
        }),
      );
    });

    it('should filter by date range and search term', async () => {
      const filterDto: GetExperienceFilterDto = {
        page: 0,
        limit: 10,
        category: 'TRAIL',
        search: 'mountain',
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-01-31T00:00:00Z',
      } as never;

      databaseService.experience.findMany.mockResolvedValueOnce([]);
      databaseService.experience.count.mockResolvedValueOnce(0);

      await service.getExperienceFilter(filterDto);

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'TRAIL',
            name: { contains: 'mountain', mode: 'insensitive' },
            AND: [
              { OR: [{ startDate: null }, { startDate: { lte: filterDto.startDate } }] },
              { OR: [{ endDate: null }, { endDate: { gte: filterDto.endDate } }] },
            ],
          }),
        }),
      );
    });

    it('should cover a single arrival date when only startDate is provided', async () => {
      const filterDto: GetExperienceFilterDto = {
        page: 0,
        limit: 10,
        category: 'HOSPEDAGEM',
        startDate: '2025-06-15T00:00:00Z',
      } as never;

      databaseService.experience.findMany.mockResolvedValueOnce([]);
      databaseService.experience.count.mockResolvedValueOnce(0);

      await service.getExperienceFilter(filterDto);

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              { OR: [{ startDate: null }, { startDate: { lte: filterDto.startDate } }] },
              { OR: [{ endDate: null }, { endDate: { gte: filterDto.startDate } }] },
            ],
          }),
        }),
      );
    });

    it('should cover a single departure date when only endDate is provided', async () => {
      const filterDto: GetExperienceFilterDto = {
        page: 0,
        limit: 10,
        category: 'HOSPEDAGEM',
        endDate: '2025-06-20T00:00:00Z',
      } as never;

      databaseService.experience.findMany.mockResolvedValueOnce([]);
      databaseService.experience.count.mockResolvedValueOnce(0);

      await service.getExperienceFilter(filterDto);

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              { OR: [{ startDate: null }, { startDate: { lte: filterDto.endDate } }] },
              { OR: [{ endDate: null }, { endDate: { gte: filterDto.endDate } }] },
            ],
          }),
        }),
      );
    });

    it('should filter without optional dates', async () => {
      const filterDto: GetExperienceFilterDto = {
        page: 0,
        limit: 10,
        category: 'TRAIL',
      } as never;

      databaseService.experience.findMany.mockResolvedValueOnce([]);
      databaseService.experience.count.mockResolvedValueOnce(0);

      await service.getExperienceFilter(filterDto);

      expect(databaseService.experience.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            category: 'TRAIL',
            name: { contains: undefined, mode: 'insensitive' },
          },
        }),
      );
    });
  });
});
