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

export type MediaScope = 'questions' | 'quizzes';

export function normalizeMediaRelativePath(
  imagePath: string | null | undefined,
  allowedScope: MediaScope | 'any' = 'questions'
): string | null {
  if (!imagePath) return null;
  const trimmed = imagePath.trim();
  if (!trimmed) return null;

  const matchedPrefix =
    trimmed.startsWith('questions/')
      ? 'questions'
      : trimmed.startsWith('quizzes/')
        ? 'quizzes'
        : null;

  if (!matchedPrefix) {
    throw new MediaValidationError('مسار الصورة غير صالح.');
  }

  if (allowedScope !== 'any' && matchedPrefix !== allowedScope) {
    throw new MediaValidationError('مسار الصورة غير صالح.');
  }

  const filename = path.posix.basename(trimmed);
  if (`${matchedPrefix}/${filename}` !== trimmed) {
    throw new MediaValidationError('مسار الصورة غير صالح.');
  }

  if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(filename)) {
    throw new MediaValidationError('اسم أو صيغة ملف الصورة غير صالحة.');
  }

  return `${matchedPrefix}/${filename}`;
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

export function resolveSafeMediaFile(
  scope: MediaScope,
  filename: string,
  storagePaths: StoragePaths
): string | null {
  const safeBase = path.basename(filename);
  if (safeBase !== filename || !/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(safeBase)) {
    return null;
  }

  const targetDir =
    scope === 'quizzes' ? storagePaths.quizzesMediaDir : storagePaths.questionsMediaDir;
  const resolved = path.resolve(targetDir, safeBase);
  const rootWithSep = targetDir.endsWith(path.sep) ? targetDir : `${targetDir}${path.sep}`;

  if (!resolved.startsWith(rootWithSep)) {
    return null;
  }

  if (!fs.existsSync(resolved)) {
    return null;
  }

  return resolved;
}

export function resolveSafeQuestionMediaFile(
  filename: string,
  storagePaths: StoragePaths
): string | null {
  return resolveSafeMediaFile('questions', filename, storagePaths);
}

export function resolveSafeQuizMediaFile(
  filename: string,
  storagePaths: StoragePaths
): string | null {
  return resolveSafeMediaFile('quizzes', filename, storagePaths);
}

export function assertMediaFileExists(
  relativePath: string | null,
  storagePaths: StoragePaths,
  allowedScope: MediaScope | 'any' = 'questions'
): void {
  if (!relativePath) return;
  const normalized = normalizeMediaRelativePath(relativePath, allowedScope);
  if (!normalized) return;
  const scope: MediaScope = normalized.startsWith('quizzes/') ? 'quizzes' : 'questions';
  const filename = path.posix.basename(normalized);
  const resolved = resolveSafeMediaFile(scope, filename, storagePaths);
  if (!resolved) {
    throw new MediaValidationError('ملف الصورة المرفق غير موجود في مجلد البيانات المحلي.');
  }
}

export function copyMediaToQuiz(
  sourceRelativePath: string | null | undefined,
  storagePaths: StoragePaths
): string | null {
  const normalized = normalizeMediaRelativePath(sourceRelativePath, 'any');
  if (!normalized) return null;

  const sourceScope: MediaScope = normalized.startsWith('quizzes/') ? 'quizzes' : 'questions';
  const sourceFilename = path.posix.basename(normalized);
  const sourceFullPath = resolveSafeMediaFile(sourceScope, sourceFilename, storagePaths);

  if (!sourceFullPath) {
    throw new MediaValidationError('ملف الصورة المرفق بالسؤال غير موجود لنسخه إلى المسابقة.');
  }

  const ext = path.extname(sourceFilename).toLowerCase() || '.png';
  const destFilename = `${crypto.randomUUID()}${ext}`;
  const destFullPath = path.join(storagePaths.quizzesMediaDir, destFilename);
  fs.copyFileSync(sourceFullPath, destFullPath);

  return `quizzes/${destFilename}`;
}

export function unlinkMediaFilesDirectly(
  storagePaths: StoragePaths,
  relativePaths: Array<string | null | undefined>
): void {
  for (const relPath of relativePaths) {
    try {
      const normalized = normalizeMediaRelativePath(relPath, 'any');
      if (!normalized) continue;
      const scope: MediaScope = normalized.startsWith('quizzes/') ? 'quizzes' : 'questions';
      const filename = path.posix.basename(normalized);
      const resolved = resolveSafeMediaFile(scope, filename, storagePaths);
      if (resolved && fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
    } catch {
      // Ignore cleanup errors during rollback
    }
  }
}

export function countMediaReferences(db: DatabaseSync, relativePath: string): number {
  const row = db
    .prepare(
      `
      SELECT (
        (SELECT COUNT(*) FROM questions WHERE image_path = ?) +
        (SELECT COUNT(*) FROM question_options WHERE image_path = ?) +
        (SELECT COUNT(*) FROM quiz_questions WHERE image_path = ?) +
        (SELECT COUNT(*) FROM quiz_question_options WHERE image_path = ?) +
        (SELECT COUNT(*) FROM live_session_questions WHERE image_path = ?) +
        (SELECT COUNT(*) FROM live_session_question_options WHERE image_path = ?)
      ) AS total_refs
    `
    )
    .get(
      relativePath,
      relativePath,
      relativePath,
      relativePath,
      relativePath,
      relativePath
    ) as
    | { total_refs: number }
    | undefined;

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
      const normalized = normalizeMediaRelativePath(relPath, 'any');
      if (!normalized) continue;
      const refs = countMediaReferences(db, normalized);
      if (refs === 0) {
        const scope: MediaScope = normalized.startsWith('quizzes/') ? 'quizzes' : 'questions';
        const filename = path.posix.basename(normalized);
        const targetDir =
          scope === 'quizzes' ? storagePaths.quizzesMediaDir : storagePaths.questionsMediaDir;
        const fullPath = path.join(targetDir, filename);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    } catch {
      // Never crash DB operation on cleanup of an already missing/invalid file
    }
  }
}
