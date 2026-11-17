import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { StoragePaths } from '../config/storagePaths.ts';
import type { UploadedMediaAsset } from '../../src/types/questionBank.ts';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
};

export class MediaValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'MediaValidationError';
    this.statusCode = statusCode;
  }
}

function detectImageSignature(buffer: Buffer): 'png' | 'jpeg' | 'webp' | null {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

export function normalizeMediaRelativePath(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  const trimmed = imagePath.trim();
  if (!trimmed) return null;

  // Enforce strict relative path under "questions/<filename>"
  if (!trimmed.startsWith('questions/')) {
    throw new MediaValidationError('مسار الصورة غير صالح.');
  }

  const filename = path.posix.basename(trimmed);
  if (`questions/${filename}` !== trimmed) {
    throw new MediaValidationError('مسار الصورة غير صالح.');
  }

  if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(filename)) {
    throw new MediaValidationError('اسم أو صيغة ملف الصورة غير صالحة.');
  }

  return `questions/${filename}`;
}

export function mediaRelativePathToUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  return `/api/media/${imagePath}`;
}

export function saveUploadedQuestionImage(
  buffer: Buffer,
  mimeType: string,
  storagePaths: StoragePaths
): UploadedMediaAsset {
  if (!buffer || buffer.length === 0) {
    throw new MediaValidationError('ملف الصورة فارغ.');
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new MediaValidationError('حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت).', 413);
  }

  const normalizedMime = mimeType.toLowerCase();
  const extFromMime = ALLOWED_MIME_TO_EXT[normalizedMime];
  if (!extFromMime) {
    throw new MediaValidationError(
      'صيغة الملف غير مدعومة. الصيغ المسموحة: PNG و JPG و JPEG و WEBP.'
    );
  }

  const detectedSignature = detectImageSignature(buffer);
  if (!detectedSignature) {
    throw new MediaValidationError(
      'محتوى الملف لا يطابق صورة صالحة بصيغة PNG أو JPG أو WEBP.'
    );
  }

  const ext =
    detectedSignature === 'png'
      ? '.png'
      : detectedSignature === 'webp'
        ? '.webp'
        : '.jpg';

  const filename = `${crypto.randomUUID()}${ext}`;
  const relativePath = `questions/${filename}`;
  const fullPath = path.join(storagePaths.questionsMediaDir, filename);

  fs.writeFileSync(fullPath, buffer);

  return {
    imagePath: relativePath,
    imageUrl: `/api/media/${relativePath}`,
    mimeType:
      detectedSignature === 'png'
        ? 'image/png'
        : detectedSignature === 'webp'
          ? 'image/webp'
          : 'image/jpeg',
    sizeBytes: buffer.length,
  };
}

export function resolveSafeQuestionMediaFile(
  filename: string,
  storagePaths: StoragePaths
): string | null {
  const safeBase = path.basename(filename);
  if (safeBase !== filename || !/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(safeBase)) {
    return null;
  }

  const resolved = path.resolve(storagePaths.questionsMediaDir, safeBase);
  const rootWithSep = storagePaths.questionsMediaDir.endsWith(path.sep)
    ? storagePaths.questionsMediaDir
    : `${storagePaths.questionsMediaDir}${path.sep}`;

  if (!resolved.startsWith(rootWithSep)) {
    return null;
  }

  if (!fs.existsSync(resolved)) {
    return null;
  }

  return resolved;
}

export function countMediaReferences(db: DatabaseSync, relativePath: string): number {
  const row = db
    .prepare(
      `
      SELECT (
        (SELECT COUNT(*) FROM questions WHERE image_path = ?) +
        (SELECT COUNT(*) FROM question_options WHERE image_path = ?)
      ) AS total_refs
    `
    )
    .get(relativePath, relativePath) as { total_refs: number } | undefined;

  return row?.total_refs ?? 0;
}

export function deleteMediaFilesIfUnreferenced(
  db: DatabaseSync,
  storagePaths: StoragePaths,
  candidatePaths: Array<string | null | undefined>
): void {
  const uniquePaths = new Set(
    candidatePaths
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p) => p.length > 0)
  );

  for (const relPath of uniquePaths) {
    try {
      const normalized = normalizeMediaRelativePath(relPath);
      if (!normalized) continue;
      const refs = countMediaReferences(db, normalized);
      if (refs === 0) {
        const filename = path.posix.basename(normalized);
        const fullPath = path.join(storagePaths.questionsMediaDir, filename);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    } catch {
      // Never crash DB operation on cleanup of an already missing/invalid file
    }
  }
}
