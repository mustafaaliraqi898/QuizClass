import fs from 'node:fs';
import path from 'node:path';

export interface StoragePaths {
  dataDir: string;
  dbFilePath: string;
  mediaDir: string;
  questionsMediaDir: string;
}

export function resolveStoragePaths(customDataDir?: string): StoragePaths {
  const configuredDir = customDataDir ?? process.env.QUIZCLASS_DATA_DIR;
  const dataDir = configuredDir
    ? path.resolve(configuredDir)
    : path.resolve(process.cwd(), 'app-data');

  const mediaDir = path.join(dataDir, 'media');
  const questionsMediaDir = path.join(mediaDir, 'questions');
  const dbFilePath = path.join(dataDir, 'quizclass.sqlite');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(questionsMediaDir, { recursive: true });

  return {
    dataDir,
    dbFilePath,
    mediaDir,
    questionsMediaDir,
  };
}
