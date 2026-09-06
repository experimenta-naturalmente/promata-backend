import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const MB = 1024 * 1024;

function createUploadOptions(allowedMimes: readonly string[], maxBytes: number): MulterOptions {
  return {
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (!allowedMimes.includes(file.mimetype)) {
        return cb(
          new BadRequestException(`Tipo de arquivo não permitido: ${file.mimetype}`),
          false,
        );
      }
      cb(null, true);
    },
  };
}

export const IMAGE_UPLOAD = createUploadOptions(
  ['image/jpeg', 'image/png', 'image/webp'] as const,
  5 * MB,
);

export const MAX_EXPERIENCE_IMAGES = 10;

export const DOCUMENT_UPLOAD = createUploadOptions(
  ['image/jpeg', 'image/png', 'application/pdf'] as const,
  10 * MB,
);
