-- CreateTable
CREATE TABLE "public"."ExperienceImage" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExperienceImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExperienceImage_experienceId_position_idx" ON "public"."ExperienceImage"("experienceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceImage_experienceId_imageId_key" ON "public"."ExperienceImage"("experienceId", "imageId");

-- AddForeignKey
ALTER TABLE "public"."ExperienceImage" ADD CONSTRAINT "ExperienceImage_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "public"."Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExperienceImage" ADD CONSTRAINT "ExperienceImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "public"."Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: promove a imagem única já existente em cada experiência para a primeira posição da galeria
INSERT INTO "public"."ExperienceImage" ("id", "experienceId", "imageId", "position")
SELECT gen_random_uuid(), "id", "imageId", 0
FROM "public"."Experience"
WHERE "imageId" IS NOT NULL;
