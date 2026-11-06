import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId } from '@gestionnaire/db';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaTenantService } from '../common/prisma-tenant.service.js';
import { FileListFilterDto, UploadMetadataDto } from './dto/file.dto.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
  'application/json',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max par fichier
const DEFAULT_TENANT_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB quota par tenant

@Injectable()
export class FilesService {
  private readonly baseUploadDir: string;

  constructor(private readonly db: PrismaTenantService) {
    this.baseUploadDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  private getTenantDir(tenantId: string): string {
    const dir = path.join(this.baseUploadDir, tenantId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  async listFiles(tenantId: string, query: FileListFilterDto) {
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.StoredFileWhereInput = {
      tenantId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.search
        ? {
            OR: [
              { originalName: { contains: query.search, mode: 'insensitive' } },
              { fileName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.db.run(tenantId, async (tx) => {
      const [files, total, aggregate] = await Promise.all([
        tx.storedFile.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        tx.storedFile.count({ where }),
        tx.storedFile.aggregate({
          where,
          _sum: { sizeBytes: true },
        }),
      ]);

      return {
        data: files,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalSizeBytes: aggregate._sum.sizeBytes || 0,
      };
    });
  }

  async getStorageUsage(tenantId: string) {
    return this.db.run(tenantId, async (tx) => {
      const [aggregate, byCategory] = await Promise.all([
        tx.storedFile.aggregate({
          where: { tenantId },
          _sum: { sizeBytes: true },
          _count: { id: true },
        }),
        tx.storedFile.groupBy({
          by: ['category'],
          where: { tenantId },
          _sum: { sizeBytes: true },
          _count: { id: true },
        }),
      ]);

      const usedBytes = aggregate._sum.sizeBytes || 0;
      return {
        usedBytes,
        quotaBytes: DEFAULT_TENANT_QUOTA_BYTES,
        usedPercentage: Math.min(100, (usedBytes / DEFAULT_TENANT_QUOTA_BYTES) * 100),
        fileCount: aggregate._count.id || 0,
        categories: byCategory.map((cat) => ({
          category: cat.category,
          bytes: cat._sum.sizeBytes || 0,
          count: cat._count.id,
        })),
      };
    });
  }

  async saveUploadedFile(
    tenantId: string,
    userId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    meta: UploadMetadataDto,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`Fichier trop volumineux. Taille max: ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} Mo`);
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(`Type de fichier non autorisé (${file.mimetype})`);
    }

    // Vérification du quota du tenant
    const currentUsage = await this.getStorageUsage(tenantId);
    if (currentUsage.usedBytes + file.size > DEFAULT_TENANT_QUOTA_BYTES) {
      throw new BadRequestException('Quota de stockage de 5 Go dépassé pour cette organisation');
    }

    // Calcul du hash SHA-256
    const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Nom de fichier interne non prévisible
    const fileId = newId();
    const sanitizedExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const internalFileName = `${fileId}${sanitizedExt}`;
    const tenantDir = this.getTenantDir(tenantId);
    const diskPath = path.join(tenantDir, internalFileName);

    // Écriture sécurisée sur disque
    fs.writeFileSync(diskPath, file.buffer);

    return this.db.run(tenantId, async (tx) => {
      const stored = await tx.storedFile.create({
        data: {
          id: fileId,
          tenantId,
          uploadedByUserId: userId,
          fileName: internalFileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          hashSha256: hash,
          storagePath: diskPath,
          storageProvider: 'LOCAL',
          category: meta.category || 'ATTACHMENT',
          scanStatus: 'CLEAN',
          isPublic: meta.isPublic === 'true',
        },
      });

      return stored;
    });
  }

  async getFile(tenantId: string, fileId: string) {
    const file = await this.db.run(tenantId, (tx) =>
      tx.storedFile.findFirst({
        where: { id: fileId, tenantId },
      }),
    );
    if (!file) throw new NotFoundException('Fichier introuvable');
    return file;
  }

  async deleteFile(tenantId: string, fileId: string) {
    return this.db.run(tenantId, async (tx) => {
      const file = await tx.storedFile.findFirst({
        where: { id: fileId, tenantId },
      });
      if (!file) throw new NotFoundException('Fichier introuvable');

      // Suppression physique du fichier s'il existe
      if (fs.existsSync(file.storagePath)) {
        try {
          fs.unlinkSync(file.storagePath);
        } catch {
          // Journalisé si erreur FS, ne bloque pas la suppression DB
        }
      }

      await tx.storedFile.delete({ where: { id: fileId } });
      return { success: true, message: 'Fichier supprimé' };
    });
  }
}
