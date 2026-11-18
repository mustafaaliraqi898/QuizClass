var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express7 = __toESM(require("express"), 1);
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_http = __toESM(require("node:http"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var import_vite = require("vite");

// server/app.ts
var import_express6 = __toESM(require("express"), 1);

// server/routes/interactiveLearningRoutes.ts
var import_express = __toESM(require("express"), 1);

// server/middleware/localAdminGuard.ts
var LOOPBACK_IPS = /* @__PURE__ */ new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function isLoopbackAddress(address) {
  if (!address) return false;
  return LOOPBACK_IPS.has(address);
}
function isTrustedCloudPreviewRequest(req) {
  const appUrl = process.env.APP_URL;
  const isCloudRun = Boolean(process.env.K_SERVICE || appUrl && appUrl.startsWith("https://"));
  if (!isCloudRun) {
    return false;
  }
  const forwardedProto = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers.host;
  if (forwardedProto !== "https" || !hostHeader) {
    return false;
  }
  if (appUrl) {
    try {
      const expectedHost = new URL(appUrl).host;
      if (hostHeader === expectedHost) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return hostHeader.endsWith(".run.app");
}
function localAdminGuard(req, res, next) {
  if (process.env.QUIZCLASS_ALLOW_REMOTE_ADMIN === "true") {
    next();
    return;
  }
  const remoteAddress = req.socket.remoteAddress;
  if (isLoopbackAddress(remoteAddress) || isTrustedCloudPreviewRequest(req)) {
    next();
    return;
  }
  res.status(403).json({
    error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0646\u0641\u064A\u0630 \u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0645\u0646 \u0623\u062C\u0647\u0632\u0629 \u0627\u0644\u0634\u0628\u0643\u0629 \u0627\u0644\u0623\u062E\u0631\u0649."
  });
}

// server/services/interactiveLearningRepository.ts
var import_node_crypto3 = require("node:crypto");

// server/services/questionBankRepository.ts
var import_node_crypto2 = __toESM(require("node:crypto"), 1);

// server/services/mediaStorageService.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
var ALLOWED_MIME_TO_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp"
};
var MediaValidationError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "MediaValidationError";
    this.statusCode = statusCode;
  }
};
function detectImageSignature(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10) {
    return "png";
  }
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return "jpeg";
  }
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  return null;
}
function normalizeMediaRelativePath(imagePath, allowedScope = "questions") {
  if (!imagePath) return null;
  const trimmed = imagePath.trim();
  if (!trimmed) return null;
  const matchedPrefix = trimmed.startsWith("questions/") ? "questions" : trimmed.startsWith("quizzes/") ? "quizzes" : null;
  if (!matchedPrefix) {
    throw new MediaValidationError("\u0645\u0633\u0627\u0631 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  }
  if (allowedScope !== "any" && matchedPrefix !== allowedScope) {
    throw new MediaValidationError("\u0645\u0633\u0627\u0631 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  }
  const filename = import_node_path.default.posix.basename(trimmed);
  if (`${matchedPrefix}/${filename}` !== trimmed) {
    throw new MediaValidationError("\u0645\u0633\u0627\u0631 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
  }
  if (!/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(filename)) {
    throw new MediaValidationError("\u0627\u0633\u0645 \u0623\u0648 \u0635\u064A\u063A\u0629 \u0645\u0644\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
  }
  return `${matchedPrefix}/${filename}`;
}
function mediaRelativePathToUrl(imagePath) {
  if (!imagePath) return null;
  return `/api/media/${imagePath}`;
}
function saveUploadedQuestionImage(buffer, mimeType, storagePaths) {
  if (!buffer || buffer.length === 0) {
    throw new MediaValidationError("\u0645\u0644\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0641\u0627\u0631\u063A.");
  }
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new MediaValidationError("\u062D\u062C\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 (5 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A).", 413);
  }
  const normalizedMime = mimeType.toLowerCase();
  const extFromMime = ALLOWED_MIME_TO_EXT[normalizedMime];
  if (!extFromMime) {
    throw new MediaValidationError(
      "\u0635\u064A\u063A\u0629 \u0627\u0644\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629. \u0627\u0644\u0635\u064A\u063A \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629: PNG \u0648 JPG \u0648 JPEG \u0648 WEBP."
    );
  }
  const detectedSignature = detectImageSignature(buffer);
  if (!detectedSignature) {
    throw new MediaValidationError(
      "\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0645\u0644\u0641 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0635\u0648\u0631\u0629 \u0635\u0627\u0644\u062D\u0629 \u0628\u0635\u064A\u063A\u0629 PNG \u0623\u0648 JPG \u0623\u0648 WEBP."
    );
  }
  const ext = detectedSignature === "png" ? ".png" : detectedSignature === "webp" ? ".webp" : ".jpg";
  const filename = `${import_node_crypto.default.randomUUID()}${ext}`;
  const relativePath = `questions/${filename}`;
  const fullPath = import_node_path.default.join(storagePaths.questionsMediaDir, filename);
  import_node_fs.default.writeFileSync(fullPath, buffer);
  return {
    imagePath: relativePath,
    imageUrl: `/api/media/${relativePath}`,
    mimeType: detectedSignature === "png" ? "image/png" : detectedSignature === "webp" ? "image/webp" : "image/jpeg",
    sizeBytes: buffer.length
  };
}
function resolveSafeMediaFile(scope, filename, storagePaths) {
  const safeBase = import_node_path.default.basename(filename);
  if (safeBase !== filename || !/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/i.test(safeBase)) {
    return null;
  }
  const targetDir = scope === "quizzes" ? storagePaths.quizzesMediaDir : storagePaths.questionsMediaDir;
  const resolved = import_node_path.default.resolve(targetDir, safeBase);
  const rootWithSep = targetDir.endsWith(import_node_path.default.sep) ? targetDir : `${targetDir}${import_node_path.default.sep}`;
  if (!resolved.startsWith(rootWithSep)) {
    return null;
  }
  if (!import_node_fs.default.existsSync(resolved)) {
    return null;
  }
  return resolved;
}
function resolveSafeQuestionMediaFile(filename, storagePaths) {
  return resolveSafeMediaFile("questions", filename, storagePaths);
}
function resolveSafeQuizMediaFile(filename, storagePaths) {
  return resolveSafeMediaFile("quizzes", filename, storagePaths);
}
function assertMediaFileExists(relativePath, storagePaths, allowedScope = "questions") {
  if (!relativePath) return;
  const normalized = normalizeMediaRelativePath(relativePath, allowedScope);
  if (!normalized) return;
  const scope = normalized.startsWith("quizzes/") ? "quizzes" : "questions";
  const filename = import_node_path.default.posix.basename(normalized);
  const resolved = resolveSafeMediaFile(scope, filename, storagePaths);
  if (!resolved) {
    throw new MediaValidationError("\u0645\u0644\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0631\u0641\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0645\u062C\u0644\u062F \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062D\u0644\u064A.");
  }
}
function copyMediaToQuiz(sourceRelativePath, storagePaths) {
  const normalized = normalizeMediaRelativePath(sourceRelativePath, "any");
  if (!normalized) return null;
  const sourceScope = normalized.startsWith("quizzes/") ? "quizzes" : "questions";
  const sourceFilename = import_node_path.default.posix.basename(normalized);
  const sourceFullPath = resolveSafeMediaFile(sourceScope, sourceFilename, storagePaths);
  if (!sourceFullPath) {
    throw new MediaValidationError("\u0645\u0644\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0631\u0641\u0642 \u0628\u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0644\u0646\u0633\u062E\u0647 \u0625\u0644\u0649 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629.");
  }
  const ext = import_node_path.default.extname(sourceFilename).toLowerCase() || ".png";
  const destFilename = `${import_node_crypto.default.randomUUID()}${ext}`;
  const destFullPath = import_node_path.default.join(storagePaths.quizzesMediaDir, destFilename);
  import_node_fs.default.copyFileSync(sourceFullPath, destFullPath);
  return `quizzes/${destFilename}`;
}
function unlinkMediaFilesDirectly(storagePaths, relativePaths) {
  for (const relPath of relativePaths) {
    try {
      const normalized = normalizeMediaRelativePath(relPath, "any");
      if (!normalized) continue;
      const scope = normalized.startsWith("quizzes/") ? "quizzes" : "questions";
      const filename = import_node_path.default.posix.basename(normalized);
      const resolved = resolveSafeMediaFile(scope, filename, storagePaths);
      if (resolved && import_node_fs.default.existsSync(resolved)) {
        import_node_fs.default.unlinkSync(resolved);
      }
    } catch {
    }
  }
}
function countMediaReferences(db, relativePath) {
  const row = db.prepare(
    `
      SELECT (
        (SELECT COUNT(*) FROM questions WHERE image_path = ?) +
        (SELECT COUNT(*) FROM question_options WHERE image_path = ?) +
        (SELECT COUNT(*) FROM quiz_questions WHERE image_path = ?) +
        (SELECT COUNT(*) FROM quiz_question_options WHERE image_path = ?) +
        (SELECT COUNT(*) FROM live_session_questions WHERE image_path = ?) +
        (SELECT COUNT(*) FROM live_session_question_options WHERE image_path = ?) +
        (SELECT COUNT(*) FROM archived_session_questions WHERE image_path = ?) +
        (SELECT COUNT(*) FROM archived_session_options WHERE image_path = ?)
      ) AS total_refs
    `
  ).get(
    relativePath,
    relativePath,
    relativePath,
    relativePath,
    relativePath,
    relativePath,
    relativePath,
    relativePath
  );
  return row?.total_refs ?? 0;
}
function deleteMediaFilesIfUnreferenced(db, storagePaths, candidatePaths) {
  const uniquePaths = new Set(
    candidatePaths.map((p) => typeof p === "string" ? p.trim() : "").filter((p) => p.length > 0)
  );
  for (const relPath of uniquePaths) {
    try {
      const normalized = normalizeMediaRelativePath(relPath, "any");
      if (!normalized) continue;
      const refs = countMediaReferences(db, normalized);
      if (refs === 0) {
        const scope = normalized.startsWith("quizzes/") ? "quizzes" : "questions";
        const filename = import_node_path.default.posix.basename(normalized);
        const targetDir = scope === "quizzes" ? storagePaths.quizzesMediaDir : storagePaths.questionsMediaDir;
        const fullPath = import_node_path.default.join(targetDir, filename);
        if (import_node_fs.default.existsSync(fullPath)) {
          import_node_fs.default.unlinkSync(fullPath);
        }
      }
    } catch {
    }
  }
}

// server/services/questionBankRepository.ts
var QuestionValidationError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "QuestionValidationError";
    this.statusCode = statusCode;
  }
};
var QuestionNotFoundError = class extends Error {
  constructor(message = "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.") {
    super(message);
    this.statusCode = 404;
    this.name = "QuestionNotFoundError";
  }
};
var MAX_PROMPT_LENGTH = 2e3;
var MAX_OPTION_TEXT_LENGTH = 500;
var MAX_CLASSIFICATION_LENGTH = 120;
function cleanOptionalText(value, fieldLabel, maxLength = MAX_CLASSIFICATION_LENGTH) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (fieldLabel && trimmed.length > maxLength) {
    throw new QuestionValidationError(
      `\u0627\u0644\u062D\u0642\u0644 (${fieldLabel}) \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 (${maxLength} \u062D\u0631\u0641\u0627\u064B).`
    );
  }
  return trimmed;
}
function escapeSqlLikePattern(value) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
function validateAndNormalizePayload(payload, storagePaths) {
  if (!payload || typeof payload !== "object") {
    throw new QuestionValidationError("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
  }
  if (payload.type !== "multiple_choice" && payload.type !== "true_false") {
    throw new QuestionValidationError("\u0646\u0648\u0639 \u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645.");
  }
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (prompt.length === 0) {
    throw new QuestionValidationError("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0646\u0635 \u0627\u0644\u0633\u0624\u0627\u0644 \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638.");
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new QuestionValidationError(
      `\u0646\u0635 \u0627\u0644\u0633\u0624\u0627\u0644 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 (${MAX_PROMPT_LENGTH} \u062D\u0631\u0641\u0627\u064B).`
    );
  }
  const imagePath = normalizeMediaRelativePath(payload.imagePath);
  assertMediaFileExists(imagePath, storagePaths);
  const subject = cleanOptionalText(payload.subject, "\u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629");
  const grade = cleanOptionalText(payload.grade, "\u0627\u0644\u0635\u0641 \u0627\u0644\u062F\u0631\u0627\u0633\u064A");
  const topic = cleanOptionalText(payload.topic, "\u0627\u0644\u0645\u0648\u0636\u0648\u0639");
  let difficulty = null;
  if (payload.difficulty !== void 0 && payload.difficulty !== null && payload.difficulty !== "") {
    if (payload.difficulty !== "easy" && payload.difficulty !== "medium" && payload.difficulty !== "hard") {
      throw new QuestionValidationError("\u0645\u0633\u062A\u0648\u0649 \u0627\u0644\u0635\u0639\u0648\u0628\u0629 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
    }
    difficulty = payload.difficulty;
  }
  if (payload.type === "true_false") {
    if (typeof payload.correctBoolean !== "boolean") {
      throw new QuestionValidationError("\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0635\u062D\u064A\u062D\u0629 (\u0635\u062D \u0623\u0648 \u062E\u0637\u0623).");
    }
    return {
      type: "true_false",
      prompt,
      imagePath,
      correctBoolean: payload.correctBoolean ? 1 : 0,
      subject,
      grade,
      topic,
      difficulty,
      options: []
    };
  }
  if (!Array.isArray(payload.options) || payload.options.length < 2) {
    throw new QuestionValidationError("\u064A\u062C\u0628 \u0623\u0646 \u064A\u062D\u062A\u0648\u064A \u0633\u0624\u0627\u0644 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u0646 \u0645\u062A\u0639\u062F\u062F \u0639\u0644\u0649 \u0627\u062E\u062A\u064A\u0627\u0631\u064A\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644.");
  }
  if (payload.options.length > 6) {
    throw new QuestionValidationError("\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0639\u062F\u062F \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A \u0647\u0648 6 \u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A.");
  }
  const normalizedOptions = payload.options.map((opt, index) => {
    const optionText = cleanOptionalText(
      opt?.optionText,
      `\u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631 \u0631\u0642\u0645 ${index + 1}`,
      MAX_OPTION_TEXT_LENGTH
    );
    const optImagePath = normalizeMediaRelativePath(opt?.imagePath);
    assertMediaFileExists(optImagePath, storagePaths);
    if (!optionText && !optImagePath) {
      throw new QuestionValidationError(
        `\u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631 \u0631\u0642\u0645 ${index + 1} \u0641\u0627\u0631\u063A\u061B \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0646\u0635 \u0623\u0648 \u0625\u0631\u0641\u0627\u0642 \u0635\u0648\u0631\u0629 \u0644\u0644\u0627\u062E\u062A\u064A\u0627\u0631.`
      );
    }
    return {
      optionText,
      imagePath: optImagePath,
      isCorrect: Boolean(opt?.isCorrect)
    };
  });
  const correctCount = normalizedOptions.filter((opt) => opt.isCorrect).length;
  if (correctCount !== 1) {
    throw new QuestionValidationError(
      "\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0625\u062C\u0627\u0628\u0629 \u0635\u062D\u064A\u062D\u0629 \u0648\u0627\u062D\u062F\u0629 \u0641\u0642\u0637 \u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631 \u0645\u0646 \u0645\u062A\u0639\u062F\u062F."
    );
  }
  return {
    type: "multiple_choice",
    prompt,
    imagePath,
    correctBoolean: null,
    subject,
    grade,
    topic,
    difficulty,
    options: normalizedOptions
  };
}
function mapOptionRow(row) {
  return {
    id: row.id,
    questionId: row.question_id,
    optionOrder: row.option_order,
    optionText: row.option_text,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    isCorrect: row.is_correct === 1
  };
}
function mapQuestionRow(row, options) {
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    correctBoolean: row.correct_boolean === null ? null : row.correct_boolean === 1,
    subject: row.subject,
    grade: row.grade,
    topic: row.topic,
    difficulty: row.difficulty,
    options,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
var SqliteQuestionBankRepository = class {
  constructor(db, storagePaths) {
    this.db = db;
    this.storagePaths = storagePaths;
  }
  getStats() {
    const row = this.db.prepare(
      `
        SELECT
          COUNT(*) AS total_questions,
          COALESCE(SUM(CASE WHEN type = 'multiple_choice' THEN 1 ELSE 0 END), 0) AS mc_count,
          COALESCE(SUM(CASE WHEN type = 'true_false' THEN 1 ELSE 0 END), 0) AS tf_count,
          COUNT(DISTINCT CASE WHEN subject IS NOT NULL AND TRIM(subject) <> '' THEN TRIM(subject) END) AS subject_count
        FROM questions
      `
    ).get();
    return {
      totalQuestions: row?.total_questions ?? 0,
      multipleChoiceCount: row?.mc_count ?? 0,
      trueFalseCount: row?.tf_count ?? 0,
      subjectCount: row?.subject_count ?? 0
    };
  }
  getFacets() {
    const subjectRows = this.db.prepare(
      `SELECT DISTINCT TRIM(subject) AS value FROM questions WHERE subject IS NOT NULL AND TRIM(subject) <> '' ORDER BY value ASC`
    ).all();
    const gradeRows = this.db.prepare(
      `SELECT DISTINCT TRIM(grade) AS value FROM questions WHERE grade IS NOT NULL AND TRIM(grade) <> '' ORDER BY value ASC`
    ).all();
    const topicRows = this.db.prepare(
      `SELECT DISTINCT TRIM(topic) AS value FROM questions WHERE topic IS NOT NULL AND TRIM(topic) <> '' ORDER BY value ASC`
    ).all();
    return {
      subjects: subjectRows.map((r) => r.value),
      grades: gradeRows.map((r) => r.value),
      topics: topicRows.map((r) => r.value)
    };
  }
  listQuestions(filters = {}) {
    const whereClauses = [];
    const params = [];
    const search = cleanOptionalText(filters.search);
    if (search) {
      const pattern = `%${escapeSqlLikePattern(search)}%`;
      whereClauses.push(
        `(
          prompt LIKE ? ESCAPE '\\'
          OR COALESCE(subject, '') LIKE ? ESCAPE '\\'
          OR COALESCE(grade, '') LIKE ? ESCAPE '\\'
          OR COALESCE(topic, '') LIKE ? ESCAPE '\\'
          OR EXISTS (
            SELECT 1 FROM question_options qo
            WHERE qo.question_id = questions.id AND COALESCE(qo.option_text, '') LIKE ? ESCAPE '\\'
          )
        )`
      );
      params.push(pattern, pattern, pattern, pattern, pattern);
    }
    if (filters.type && filters.type !== "all") {
      whereClauses.push("type = ?");
      params.push(filters.type);
    }
    const subject = cleanOptionalText(filters.subject);
    if (subject && subject !== "all") {
      whereClauses.push("TRIM(subject) = ?");
      params.push(subject);
    }
    const grade = cleanOptionalText(filters.grade);
    if (grade && grade !== "all") {
      whereClauses.push("TRIM(grade) = ?");
      params.push(grade);
    }
    const topic = cleanOptionalText(filters.topic);
    if (topic && topic !== "all") {
      whereClauses.push("TRIM(topic) = ?");
      params.push(topic);
    }
    if (filters.difficulty && filters.difficulty !== "all") {
      whereClauses.push("difficulty = ?");
      params.push(filters.difficulty);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const questionRows = this.db.prepare(`SELECT * FROM questions ${whereSql} ORDER BY created_at DESC`).all(...params);
    const optionsByQuestionId = /* @__PURE__ */ new Map();
    if (questionRows.length > 0) {
      const placeholders = questionRows.map(() => "?").join(", ");
      const optionRows = this.db.prepare(
        `SELECT * FROM question_options WHERE question_id IN (${placeholders}) ORDER BY option_order ASC`
      ).all(...questionRows.map((q) => q.id));
      for (const optRow of optionRows) {
        const list = optionsByQuestionId.get(optRow.question_id) ?? [];
        list.push(mapOptionRow(optRow));
        optionsByQuestionId.set(optRow.question_id, list);
      }
    }
    const questions = questionRows.map(
      (qRow) => mapQuestionRow(qRow, optionsByQuestionId.get(qRow.id) ?? [])
    );
    return {
      questions,
      facets: this.getFacets(),
      stats: this.getStats()
    };
  }
  getQuestionById(id) {
    const qRow = this.db.prepare("SELECT * FROM questions WHERE id = ?").get(id);
    if (!qRow) {
      throw new QuestionNotFoundError();
    }
    const optionRows = this.db.prepare("SELECT * FROM question_options WHERE question_id = ? ORDER BY option_order ASC").all(id);
    return mapQuestionRow(qRow, optionRows.map(mapOptionRow));
  }
  createQuestion(payload) {
    const normalized = validateAndNormalizePayload(payload, this.storagePaths);
    const id = import_node_crypto2.default.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(
        `
          INSERT INTO questions (
            id, type, prompt, image_path, correct_boolean,
            subject, grade, topic, difficulty, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        id,
        normalized.type,
        normalized.prompt,
        normalized.imagePath,
        normalized.correctBoolean,
        normalized.subject,
        normalized.grade,
        normalized.topic,
        normalized.difficulty,
        now,
        now
      );
      if (normalized.type === "multiple_choice") {
        const insertOption = this.db.prepare(
          `
          INSERT INTO question_options (
            id, question_id, option_order, option_text, image_path, is_correct
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
        );
        normalized.options.forEach((opt, index) => {
          insertOption.run(
            import_node_crypto2.default.randomUUID(),
            id,
            index,
            opt.optionText,
            opt.imagePath,
            opt.isCorrect ? 1 : 0
          );
        });
      }
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
    return this.getQuestionById(id);
  }
  updateQuestion(id, payload) {
    const existing = this.getQuestionById(id);
    const normalized = validateAndNormalizePayload(payload, this.storagePaths);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const oldMediaPaths = [
      existing.imagePath,
      ...existing.options.map((opt) => opt.imagePath)
    ].filter((p) => Boolean(p));
    const newMediaSet = new Set(
      [
        normalized.imagePath,
        ...normalized.options.map((opt) => opt.imagePath)
      ].filter((p) => Boolean(p))
    );
    const removedMediaPaths = oldMediaPaths.filter((p) => !newMediaSet.has(p));
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const updateResult = this.db.prepare(
        `
          UPDATE questions
          SET type = ?, prompt = ?, image_path = ?, correct_boolean = ?,
              subject = ?, grade = ?, topic = ?, difficulty = ?, updated_at = ?
          WHERE id = ?
        `
      ).run(
        normalized.type,
        normalized.prompt,
        normalized.imagePath,
        normalized.correctBoolean,
        normalized.subject,
        normalized.grade,
        normalized.topic,
        normalized.difficulty,
        now,
        id
      );
      if (updateResult.changes === 0) {
        throw new QuestionNotFoundError();
      }
      this.db.prepare("DELETE FROM question_options WHERE question_id = ?").run(id);
      if (normalized.type === "multiple_choice") {
        const insertOption = this.db.prepare(
          `
          INSERT INTO question_options (
            id, question_id, option_order, option_text, image_path, is_correct
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
        );
        normalized.options.forEach((opt, index) => {
          insertOption.run(
            import_node_crypto2.default.randomUUID(),
            id,
            index,
            opt.optionText,
            opt.imagePath,
            opt.isCorrect ? 1 : 0
          );
        });
      }
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
    if (removedMediaPaths.length > 0) {
      deleteMediaFilesIfUnreferenced(this.db, this.storagePaths, removedMediaPaths);
    }
    return this.getQuestionById(id);
  }
  deleteQuestion(id) {
    const existing = this.getQuestionById(id);
    const candidatePaths = [
      existing.imagePath,
      ...existing.options.map((opt) => opt.imagePath)
    ];
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db.prepare("DELETE FROM questions WHERE id = ?").run(id);
      if (result.changes === 0) {
        throw new QuestionNotFoundError();
      }
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
    deleteMediaFilesIfUnreferenced(this.db, this.storagePaths, candidatePaths);
  }
};

// server/services/interactiveLearningRepository.ts
var InteractiveActivityValidationError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "InteractiveActivityValidationError";
    this.statusCode = statusCode;
  }
};
var InteractiveActivityNotFoundError = class extends Error {
  constructor(message = "\u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.") {
    super(message);
    this.statusCode = 404;
    this.name = "InteractiveActivityNotFoundError";
  }
};
function normalizeOptionalText(value, maxLength = 120) {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}
var SqliteInteractiveLearningRepository = class {
  constructor(db, storagePaths) {
    this.db = db;
    this.questionBankRepo = new SqliteQuestionBankRepository(db, storagePaths);
  }
  mapSummaryRow(row, questionCountOverride) {
    return {
      id: row.id,
      title: row.title,
      subject: row.subject,
      grade: row.grade,
      autoFullscreen: row.auto_fullscreen === 1,
      questionCount: questionCountOverride ?? Number(row.question_count ?? 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  validatePayload(payload) {
    if (!payload || typeof payload !== "object") {
      throw new InteractiveActivityValidationError("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629.");
    }
    const title = typeof payload.title === "string" ? payload.title.replace(/\s+/g, " ").trim() : "";
    if (title.length < 2) {
      throw new InteractiveActivityValidationError("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0639\u0646\u0648\u0627\u0646 \u0644\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A (\u062D\u0631\u0641\u0627\u0646 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644).");
    }
    if (title.length > 160) {
      throw new InteractiveActivityValidationError("\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0646\u0634\u0627\u0637 \u0637\u0648\u064A\u0644 \u062C\u062F\u0627\u064B (\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 160 \u062D\u0631\u0641\u0627\u064B).");
    }
    if (!Array.isArray(payload.questionIds) || payload.questionIds.length === 0) {
      throw new InteractiveActivityValidationError("\u064A\u062C\u0628 \u0627\u062E\u062A\u064A\u0627\u0631 \u0633\u0624\u0627\u0644 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0645\u0646 \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629.");
    }
    const seen = /* @__PURE__ */ new Set();
    const questionIds = [];
    for (const rawId of payload.questionIds) {
      if (typeof rawId !== "string" || !rawId.trim()) {
        throw new InteractiveActivityValidationError("\u0645\u0639\u0631\u0641 \u0623\u062D\u062F \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
      }
      const cleanId = rawId.trim();
      if (seen.has(cleanId)) {
        throw new InteractiveActivityValidationError("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0633\u0624\u0627\u0644 \u0646\u0641\u0633\u0647 \u062F\u0627\u062E\u0644 \u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u062A\u0639\u0644\u064A\u0645\u064A.");
      }
      seen.add(cleanId);
      questionIds.push(cleanId);
    }
    for (const qId of questionIds) {
      const exists = this.db.prepare("SELECT id FROM questions WHERE id = ?").get(qId);
      if (!exists) {
        throw new InteractiveActivityValidationError(
          "\u0623\u062D\u062F \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u062E\u062A\u0627\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0623\u0648 \u062A\u0645 \u062D\u0630\u0641\u0647.",
          404
        );
      }
    }
    return {
      title,
      subject: normalizeOptionalText(payload.subject, 100),
      grade: normalizeOptionalText(payload.grade, 100),
      autoFullscreen: Boolean(payload.autoFullscreen),
      questionIds
    };
  }
  listActivities() {
    const rows = this.db.prepare(
      `SELECT a.id, a.title, a.subject, a.grade, a.auto_fullscreen, a.created_at, a.updated_at,
                COUNT(iaq.id) AS question_count
         FROM interactive_activities a
         LEFT JOIN interactive_activity_questions iaq ON iaq.activity_id = a.id
         GROUP BY a.id
         ORDER BY a.updated_at DESC, a.created_at DESC`
    ).all();
    return {
      activities: rows.map((row) => this.mapSummaryRow(row))
    };
  }
  getActivityById(id) {
    const row = this.db.prepare(
      `SELECT id, title, subject, grade, auto_fullscreen, created_at, updated_at
         FROM interactive_activities
         WHERE id = ?`
    ).get(id);
    if (!row) {
      throw new InteractiveActivityNotFoundError();
    }
    const linkedRows = this.db.prepare(
      `SELECT question_id
         FROM interactive_activity_questions
         WHERE activity_id = ?
         ORDER BY question_order ASC`
    ).all(id);
    const questions = [];
    for (const linked of linkedRows) {
      try {
        const question = this.questionBankRepo.getQuestionById(linked.question_id);
        questions.push(question);
      } catch {
      }
    }
    return {
      ...this.mapSummaryRow(row, questions.length),
      questions
    };
  }
  createActivity(payload) {
    const clean = this.validatePayload(payload);
    const id = (0, import_node_crypto3.randomUUID)();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const insertActivity = this.db.prepare(
      `INSERT INTO interactive_activities (id, title, subject, grade, auto_fullscreen, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const insertItem = this.db.prepare(
      `INSERT INTO interactive_activity_questions (id, activity_id, question_id, question_order)
       VALUES (?, ?, ?, ?)`
    );
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      insertActivity.run(
        id,
        clean.title,
        clean.subject,
        clean.grade,
        clean.autoFullscreen ? 1 : 0,
        now,
        now
      );
      clean.questionIds.forEach((questionId, index) => {
        insertItem.run((0, import_node_crypto3.randomUUID)(), id, questionId, index);
      });
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
    return this.getActivityById(id);
  }
  updateActivity(id, payload) {
    const existing = this.db.prepare("SELECT id FROM interactive_activities WHERE id = ?").get(id);
    if (!existing) {
      throw new InteractiveActivityNotFoundError();
    }
    const clean = this.validatePayload(payload);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updateStmt = this.db.prepare(
      `UPDATE interactive_activities
       SET title = ?, subject = ?, grade = ?, auto_fullscreen = ?, updated_at = ?
       WHERE id = ?`
    );
    const deleteItems = this.db.prepare(
      "DELETE FROM interactive_activity_questions WHERE activity_id = ?"
    );
    const insertItem = this.db.prepare(
      `INSERT INTO interactive_activity_questions (id, activity_id, question_id, question_order)
       VALUES (?, ?, ?, ?)`
    );
    this.db.exec("BEGIN IMMEDIATE;");
    try {
      updateStmt.run(
        clean.title,
        clean.subject,
        clean.grade,
        clean.autoFullscreen ? 1 : 0,
        now,
        id
      );
      deleteItems.run(id);
      clean.questionIds.forEach((questionId, index) => {
        insertItem.run((0, import_node_crypto3.randomUUID)(), id, questionId, index);
      });
      this.db.exec("COMMIT;");
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
    return this.getActivityById(id);
  }
  deleteActivity(id) {
    const result = this.db.prepare("DELETE FROM interactive_activities WHERE id = ?").run(id);
    if (result.changes === 0) {
      throw new InteractiveActivityNotFoundError();
    }
  }
};

// server/routes/interactiveLearningRoutes.ts
function createInteractiveLearningRouter(db, storagePaths) {
  const router = import_express.default.Router();
  const repository = new SqliteInteractiveLearningRepository(db, storagePaths);
  router.use("/interactive-activities", localAdminGuard);
  router.get("/interactive-activities", (_req, res, next) => {
    try {
      res.json(repository.listActivities());
    } catch (error) {
      next(error);
    }
  });
  router.get("/interactive-activities/:id", (req, res, next) => {
    try {
      const activity = repository.getActivityById(String(req.params.id));
      res.json(activity);
    } catch (error) {
      next(error);
    }
  });
  router.post("/interactive-activities", (req, res, next) => {
    try {
      const created = repository.createActivity(req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });
  router.put("/interactive-activities/:id", (req, res, next) => {
    try {
      const updated = repository.updateActivity(String(req.params.id), req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });
  router.delete("/interactive-activities/:id", (req, res, next) => {
    try {
      repository.deleteActivity(String(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.use((error, _req, res, next) => {
    if (error instanceof InteractiveActivityValidationError || error instanceof InteractiveActivityNotFoundError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  });
  return router;
}

// server/routes/liveSessionRoutes.ts
var import_express2 = __toESM(require("express"), 1);

// server/services/liveSessionRepository.ts
var import_node_crypto6 = __toESM(require("node:crypto"), 1);

// server/services/networkDiscoveryService.ts
var import_node_os = __toESM(require("node:os"), 1);
var import_qrcode = __toESM(require("qrcode"), 1);
var VIRTUAL_INTERFACE_PATTERNS = [
  /^lo$/i,
  /^docker/i,
  /^veth/i,
  /^br-/i,
  /^virbr/i,
  /^vmnet/i,
  /^vbox/i,
  /^utun/i,
  /^tun/i,
  /^tap/i,
  /^wg/i,
  /^tailscale/i,
  /^ham/i,
  /wsl/i,
  /hyper-v/i,
  /virtual/i
];
var PREFERRED_LAN_INTERFACE_PATTERNS = [
  /^wi-?fi/i,
  /^wlan/i,
  /^wlp/i,
  /^en\d*$/i,
  /^eth\d*$/i,
  /^enp/i,
  /^ethernet/i
];
function isPrivateLanIpv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}
function isLinkLocalIpv4(ip) {
  return ip.startsWith("169.254.");
}
function scoreInterface(name, ip) {
  const isVirtualName = VIRTUAL_INTERFACE_PATTERNS.some((re) => re.test(name));
  const isLinkLocal = isLinkLocalIpv4(ip);
  const isVirtual = isVirtualName || isLinkLocal;
  let score = 0;
  if (!isVirtual) score += 100;
  if (isPrivateLanIpv4(ip)) score += 50;
  if (ip.startsWith("192.168.")) score += 20;
  if (PREFERRED_LAN_INTERFACE_PATTERNS.some((re) => re.test(name))) score += 25;
  if (isLinkLocal) score -= 80;
  let label = `\u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u0634\u0628\u0643\u0629 (${name})`;
  if (/wi-?fi|wlan|wlp/i.test(name)) {
    label = `\u0634\u0628\u0643\u0629 Wi-Fi \u0627\u0644\u0645\u062D\u0644\u064A\u0629 (${name})`;
  } else if (/eth|enp|en\d|ethernet/i.test(name)) {
    label = `\u0627\u0644\u0634\u0628\u0643\u0629 \u0627\u0644\u0633\u0644\u0643\u064A\u0629 / \u0627\u0644\u0645\u062D\u0644\u064A\u0629 (${name})`;
  } else if (isVirtual) {
    label = `\u0648\u0627\u062C\u0647\u0629 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 (${name})`;
  }
  return { isVirtual, score, label };
}
function discoverLanIpv4Addresses() {
  const interfaces = import_node_os.default.networkInterfaces();
  const candidates = [];
  const seenIps = /* @__PURE__ */ new Set();
  for (const [interfaceName, records] of Object.entries(interfaces)) {
    if (!records) continue;
    for (const record of records) {
      const family = String(record.family);
      if (family !== "IPv4" && family !== "4" || record.internal) {
        continue;
      }
      if (!record.address || seenIps.has(record.address)) {
        continue;
      }
      seenIps.add(record.address);
      const { isVirtual, score, label } = scoreInterface(interfaceName, record.address);
      candidates.push({
        interfaceName,
        ip: record.address,
        isVirtual,
        score,
        label
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.ip.localeCompare(b.ip));
  return candidates;
}
function buildJoinUrl(origin, pinCode) {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  return `${normalizedOrigin}/join?pin=${encodeURIComponent(pinCode)}`;
}
function isLoopbackHost(hostname) {
  const clean = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return clean === "localhost" || clean === "127.0.0.1" || clean === "::1";
}
async function generateQrDataUrl(targetUrl) {
  return import_qrcode.default.toDataURL(targetUrl, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0f172a",
      light: "#ffffff"
    }
  });
}
async function resolveSessionNetworkOptions(options) {
  const { pinCode, port, requestOrigin } = options;
  const rawLanCandidates = discoverLanIpv4Addresses();
  const entries = [];
  for (const candidate of rawLanCandidates) {
    const joinUrl = buildJoinUrl(`http://${candidate.ip}:${port}`, pinCode);
    entries.push({
      interfaceName: candidate.interfaceName,
      ip: candidate.ip,
      port,
      joinUrl,
      isPrimary: false,
      isVirtual: candidate.isVirtual,
      label: candidate.label
    });
  }
  if (requestOrigin) {
    try {
      const parsed = new URL(requestOrigin);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !isLoopbackHost(parsed.hostname) && !entries.some((e) => e.ip === parsed.hostname && String(e.port) === (parsed.port || (parsed.protocol === "https:" ? "443" : "80")))) {
        const originPort = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
        const joinUrl = buildJoinUrl(parsed.origin, pinCode);
        entries.push({
          interfaceName: parsed.protocol === "https:" ? "preview-proxy" : "request-host",
          ip: parsed.hostname,
          port: originPort,
          joinUrl,
          isPrimary: false,
          isVirtual: false,
          label: parsed.protocol === "https:" ? `\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0627\u0644\u062D\u0627\u0644\u064A (${parsed.hostname})` : `\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u062D\u0627\u0644\u064A (${parsed.hostname})`
        });
      }
    } catch {
    }
  }
  if (entries.length === 0) {
    const fallbackOrigin = requestOrigin || `http://127.0.0.1:${port}`;
    entries.push({
      interfaceName: "fallback",
      ip: "127.0.0.1",
      port,
      joinUrl: buildJoinUrl(fallbackOrigin, pinCode),
      isPrimary: true,
      isVirtual: true,
      label: "\u0639\u0646\u0648\u0627\u0646 \u0645\u062D\u0644\u064A \u0645\u0624\u0642\u062A (\u0644\u0645 \u064A\u064F\u0643\u062A\u0634\u0641 \u0627\u062A\u0635\u0627\u0644 Wi-Fi/LAN \u062E\u0627\u0631\u062C\u064A)"
    });
  } else {
    const primaryIndex = entries.findIndex((e) => !e.isVirtual && e.interfaceName !== "preview-proxy");
    const chosenIndex = primaryIndex >= 0 ? primaryIndex : 0;
    entries[chosenIndex].isPrimary = true;
    if (chosenIndex > 0) {
      const [primary2] = entries.splice(chosenIndex, 1);
      entries.unshift(primary2);
    }
  }
  const networkAddresses = await Promise.all(
    entries.map(async (entry) => ({
      ...entry,
      qrDataUrl: await generateQrDataUrl(entry.joinUrl)
    }))
  );
  const primary = networkAddresses[0];
  return {
    networkAddresses,
    primaryJoinUrl: primary.joinUrl,
    primaryQrDataUrl: primary.qrDataUrl
  };
}

// server/services/quizRepository.ts
var import_node_crypto4 = __toESM(require("node:crypto"), 1);
var QuizValidationError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "QuizValidationError";
    this.statusCode = statusCode;
  }
};
var QuizNotFoundError = class extends Error {
  constructor(message = "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.") {
    super(message);
    this.statusCode = 404;
    this.name = "QuizNotFoundError";
  }
};
var MAX_TITLE_LENGTH = 200;
var MAX_CLASSIFICATION_LENGTH2 = 120;
var MAX_DESCRIPTION_LENGTH = 1e3;
var MIN_TIME_SECONDS = 5;
var MAX_TIME_SECONDS = 600;
var MAX_QUESTIONS_PER_QUIZ = 200;
function cleanOptionalText2(value, fieldLabel, maxLength = MAX_CLASSIFICATION_LENGTH2) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (fieldLabel && trimmed.length > maxLength) {
    throw new QuizValidationError(
      `\u0627\u0644\u062D\u0642\u0644 (${fieldLabel}) \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 (${maxLength} \u062D\u0631\u0641\u0627\u064B).`
    );
  }
  return trimmed;
}
function escapeSqlLikePattern2(value) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
function validateTimeSeconds(value, label) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new QuizValidationError(`${label} \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0631\u0642\u0645\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B \u0628\u0627\u0644\u062B\u0648\u0627\u0646\u064A.`);
  }
  if (value < MIN_TIME_SECONDS || value > MAX_TIME_SECONDS) {
    throw new QuizValidationError(
      `${label} \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u064A\u0646 ${MIN_TIME_SECONDS} \u0648 ${MAX_TIME_SECONDS} \u062B\u0627\u0646\u064A\u0629.`
    );
  }
  return value;
}
function mapSnapshotOptionRow(row) {
  return {
    id: row.id,
    quizQuestionId: row.quiz_question_id,
    optionOrder: row.option_order,
    optionText: row.option_text,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    isCorrect: row.is_correct === 1
  };
}
function mapSnapshotQuestionRow(row, options) {
  return {
    id: row.id,
    quizId: row.quiz_id,
    sourceQuestionId: row.source_question_id,
    questionOrder: row.question_order,
    type: row.type,
    prompt: row.prompt,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    correctBoolean: row.correct_boolean === null ? null : row.correct_boolean === 1,
    subject: row.subject,
    grade: row.grade,
    topic: row.topic,
    difficulty: row.difficulty,
    timeLimitSeconds: row.time_limit_seconds,
    options
  };
}
function mapQuizSummaryRow(row) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    grade: row.grade,
    description: row.description,
    defaultTimeSeconds: row.default_time_seconds,
    lifecycleStatus: row.lifecycle_status ?? "draft",
    questionCount: row.question_count ?? 0,
    totalDurationSeconds: row.total_duration_seconds ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function mapBankOptionRow(row) {
  return {
    id: row.id,
    questionId: row.question_id,
    optionOrder: row.option_order,
    optionText: row.option_text,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    isCorrect: row.is_correct === 1
  };
}
function mapBankQuestionRow(row, options) {
  return {
    id: row.id,
    type: row.type,
    prompt: row.prompt,
    imagePath: row.image_path,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    correctBoolean: row.correct_boolean === null ? null : row.correct_boolean === 1,
    subject: row.subject,
    grade: row.grade,
    topic: row.topic,
    difficulty: row.difficulty,
    options,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
var SqliteQuizRepository = class {
  constructor(db, storagePaths) {
    this.db = db;
    this.storagePaths = storagePaths;
    this.questionBankRepo = new SqliteQuestionBankRepository(db, storagePaths);
  }
  getStats() {
    const row = this.db.prepare(
      `
        SELECT
          (SELECT COUNT(*) FROM quizzes) AS total_quizzes,
          (SELECT COUNT(*) FROM quiz_questions) AS total_quiz_questions
      `
    ).get();
    return {
      totalQuizzes: row?.total_quizzes ?? 0,
      totalQuizQuestions: row?.total_quiz_questions ?? 0
    };
  }
  listQuizzes() {
    const rows = this.db.prepare(
      `
        SELECT
          q.id,
          q.title,
          q.subject,
          q.grade,
          q.description,
          q.default_time_seconds,
          q.lifecycle_status,
          q.created_at,
          q.updated_at,
          COUNT(qq.id) AS question_count,
          COALESCE(SUM(qq.time_limit_seconds), 0) AS total_duration_seconds
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
        GROUP BY q.id
        ORDER BY q.created_at DESC
      `
    ).all();
    return {
      quizzes: rows.map(mapQuizSummaryRow),
      stats: this.getStats()
    };
  }
  getQuizById(id) {
    const row = this.db.prepare(
      `
        SELECT
          q.id,
          q.title,
          q.subject,
          q.grade,
          q.description,
          q.default_time_seconds,
          q.lifecycle_status,
          q.created_at,
          q.updated_at,
          COUNT(qq.id) AS question_count,
          COALESCE(SUM(qq.time_limit_seconds), 0) AS total_duration_seconds
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
        WHERE q.id = ?
        GROUP BY q.id
      `
    ).get(id);
    if (!row) {
      throw new QuizNotFoundError();
    }
    const questionRows = this.db.prepare(
      `SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order ASC`
    ).all(id);
    const optionsByQuestionId = /* @__PURE__ */ new Map();
    if (questionRows.length > 0) {
      const placeholders = questionRows.map(() => "?").join(", ");
      const optionRows = this.db.prepare(
        `SELECT * FROM quiz_question_options WHERE quiz_question_id IN (${placeholders}) ORDER BY option_order ASC`
      ).all(...questionRows.map((q) => q.id));
      for (const optRow of optionRows) {
        const list = optionsByQuestionId.get(optRow.quiz_question_id) ?? [];
        list.push(mapSnapshotOptionRow(optRow));
        optionsByQuestionId.set(optRow.quiz_question_id, list);
      }
    }
    const questions = questionRows.map(
      (qRow) => mapSnapshotQuestionRow(qRow, optionsByQuestionId.get(qRow.id) ?? [])
    );
    return {
      ...mapQuizSummaryRow(row),
      questions
    };
  }
  previewOrDrawRandom(request = {}) {
    const filters = request.filters ?? {};
    const whereClauses = [];
    const params = [];
    const search = cleanOptionalText2(filters.search);
    if (search) {
      const pattern = `%${escapeSqlLikePattern2(search)}%`;
      whereClauses.push(
        `(
          prompt LIKE ? ESCAPE '\\'
          OR COALESCE(subject, '') LIKE ? ESCAPE '\\'
          OR COALESCE(grade, '') LIKE ? ESCAPE '\\'
          OR COALESCE(topic, '') LIKE ? ESCAPE '\\'
          OR EXISTS (
            SELECT 1 FROM question_options qo
            WHERE qo.question_id = questions.id AND COALESCE(qo.option_text, '') LIKE ? ESCAPE '\\'
          )
        )`
      );
      params.push(pattern, pattern, pattern, pattern, pattern);
    }
    if (filters.type && filters.type !== "all") {
      whereClauses.push("type = ?");
      params.push(filters.type);
    }
    const subject = cleanOptionalText2(filters.subject);
    if (subject && subject !== "all") {
      whereClauses.push("TRIM(subject) = ?");
      params.push(subject);
    }
    const grade = cleanOptionalText2(filters.grade);
    if (grade && grade !== "all") {
      whereClauses.push("TRIM(grade) = ?");
      params.push(grade);
    }
    const topic = cleanOptionalText2(filters.topic);
    if (topic && topic !== "all") {
      whereClauses.push("TRIM(topic) = ?");
      params.push(topic);
    }
    if (filters.difficulty && filters.difficulty !== "all") {
      whereClauses.push("difficulty = ?");
      params.push(filters.difficulty);
    }
    const excludeIds = Array.isArray(request.excludeQuestionIds) ? Array.from(
      new Set(
        request.excludeQuestionIds.filter((id) => typeof id === "string").map((id) => id.trim()).filter((id) => id.length > 0)
      )
    ) : [];
    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => "?").join(", ");
      whereClauses.push(`id NOT IN (${placeholders})`);
      params.push(...excludeIds);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const countRow = this.db.prepare(`SELECT COUNT(*) AS available_count FROM questions ${whereSql}`).get(...params);
    const availableCount = countRow?.available_count ?? 0;
    if (!request.draw) {
      return {
        availableCount,
        questions: []
      };
    }
    const count = request.count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
      throw new QuizValidationError("\u064A\u0631\u062C\u0649 \u062A\u062D\u062F\u064A\u062F \u0639\u062F\u062F \u0635\u062D\u064A\u062D \u0644\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0633\u062D\u0628\u0647\u0627 (1 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644).");
    }
    if (availableCount === 0) {
      throw new QuizValidationError("\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0633\u0626\u0644\u0629 \u0645\u062A\u0627\u062D\u0629 \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0634\u0631\u0648\u0637 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0641\u064A \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629.");
    }
    if (count > availableCount) {
      throw new QuizValidationError(
        `\u0627\u0644\u0639\u062F\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628 (${count}) \u0623\u0643\u0628\u0631 \u0645\u0646 \u0639\u062F\u062F \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 (${availableCount}).`
      );
    }
    const selectedRows = this.db.prepare(`SELECT * FROM questions ${whereSql} ORDER BY RANDOM() LIMIT ?`).all(...params, count);
    const optionsByQuestionId = /* @__PURE__ */ new Map();
    if (selectedRows.length > 0) {
      const placeholders = selectedRows.map(() => "?").join(", ");
      const optionRows = this.db.prepare(
        `SELECT * FROM question_options WHERE question_id IN (${placeholders}) ORDER BY option_order ASC`
      ).all(...selectedRows.map((q) => q.id));
      for (const optRow of optionRows) {
        const list = optionsByQuestionId.get(optRow.question_id) ?? [];
        list.push(mapBankOptionRow(optRow));
        optionsByQuestionId.set(optRow.question_id, list);
      }
    }
    return {
      availableCount,
      questions: selectedRows.map(
        (row) => mapBankQuestionRow(row, optionsByQuestionId.get(row.id) ?? [])
      )
    };
  }
  validateHeaderFields(payload) {
    if (!payload || typeof payload !== "object") {
      throw new QuizValidationError("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
    }
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    if (title.length === 0) {
      throw new QuizValidationError("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638.");
    }
    if (title.length > MAX_TITLE_LENGTH) {
      throw new QuizValidationError(
        `\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 (${MAX_TITLE_LENGTH} \u062D\u0631\u0641\u0627\u064B).`
      );
    }
    const subject = cleanOptionalText2(payload.subject, "\u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u062F\u0631\u0627\u0633\u064A\u0629");
    const grade = cleanOptionalText2(payload.grade, "\u0627\u0644\u0635\u0641 \u0627\u0644\u062F\u0631\u0627\u0633\u064A");
    const description = cleanOptionalText2(
      payload.description,
      "\u0648\u0635\u0641 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629",
      MAX_DESCRIPTION_LENGTH
    );
    const defaultTimeSeconds = validateTimeSeconds(
      payload.defaultTimeSeconds,
      "\u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0644\u0644\u0625\u062C\u0627\u0628\u0629"
    );
    if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
      throw new QuizValidationError("\u064A\u062C\u0628 \u0625\u0636\u0627\u0641\u0629 \u0633\u0624\u0627\u0644 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0625\u0644\u0649 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629.");
    }
    if (payload.questions.length > MAX_QUESTIONS_PER_QUIZ) {
      throw new QuizValidationError(
        `\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0639\u062F\u062F \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0641\u064A \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0627\u0644\u0648\u0627\u062D\u062F\u0629 \u0647\u0648 ${MAX_QUESTIONS_PER_QUIZ} \u0633\u0624\u0627\u0644\u0627\u064B.`
      );
    }
    return {
      title,
      subject,
      grade,
      description,
      defaultTimeSeconds,
      questions: payload.questions
    };
  }
  prepareQuestionSnapshots(items, existingQuizSnapshots, newlyCopiedFiles) {
    const seenBankIds = /* @__PURE__ */ new Set();
    const seenSnapshotIds = /* @__PURE__ */ new Set();
    const prepared = [];
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item || typeof item !== "object") {
        throw new QuizValidationError(`\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u0624\u0627\u0644 \u0631\u0642\u0645 ${index + 1} \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.`);
      }
      const timeLimitSeconds = validateTimeSeconds(
        item.timeLimitSeconds,
        `\u0648\u0642\u062A \u0627\u0644\u0633\u0624\u0627\u0644 \u0631\u0642\u0645 ${index + 1}`
      );
      if (item.kind === "existing_snapshot") {
        if (!existingQuizSnapshots) {
          throw new QuizValidationError("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0645\u0631\u062C\u0639 \u0646\u0633\u062E\u0629 \u0645\u062D\u0641\u0648\u0638\u0629 \u0639\u0646\u062F \u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u0627\u0628\u0642\u0629 \u062C\u062F\u064A\u062F\u0629.");
        }
        const snapshotId = typeof item.quizQuestionId === "string" ? item.quizQuestionId.trim() : "";
        if (!snapshotId) {
          throw new QuizValidationError(`\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u0645\u062D\u0641\u0648\u0638 \u0631\u0642\u0645 ${index + 1} \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.`);
        }
        if (seenSnapshotIds.has(snapshotId)) {
          throw new QuizValidationError("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0633\u0624\u0627\u0644 \u0646\u0641\u0633\u0647 \u0623\u0643\u062B\u0631 \u0645\u0646 \u0645\u0631\u0629 \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629.");
        }
        const existingSnap = existingQuizSnapshots.get(snapshotId);
        if (!existingSnap) {
          throw new QuizValidationError("\u0623\u062D\u062F \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629.");
        }
        if (existingSnap.sourceQuestionId) {
          if (seenBankIds.has(existingSnap.sourceQuestionId)) {
            throw new QuizValidationError("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0633\u0624\u0627\u0644 \u0646\u0641\u0633\u0647 \u0623\u0643\u062B\u0631 \u0645\u0646 \u0645\u0631\u0629 \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629.");
          }
          seenBankIds.add(existingSnap.sourceQuestionId);
        }
        seenSnapshotIds.add(snapshotId);
        prepared.push({
          sourceQuestionId: existingSnap.sourceQuestionId,
          type: existingSnap.type,
          prompt: existingSnap.prompt,
          imagePath: existingSnap.imagePath,
          correctBoolean: existingSnap.correctBoolean,
          subject: existingSnap.subject,
          grade: existingSnap.grade,
          topic: existingSnap.topic,
          difficulty: existingSnap.difficulty,
          timeLimitSeconds,
          options: existingSnap.options.map((opt, optIdx) => ({
            optionOrder: optIdx,
            optionText: opt.optionText,
            imagePath: opt.imagePath,
            isCorrect: opt.isCorrect
          }))
        });
        continue;
      }
      if (item.kind === "bank_question") {
        const sourceId = typeof item.sourceQuestionId === "string" ? item.sourceQuestionId.trim() : "";
        if (!sourceId) {
          throw new QuizValidationError(`\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0633\u0624\u0627\u0644 \u0631\u0642\u0645 ${index + 1} \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.`);
        }
        if (seenBankIds.has(sourceId)) {
          throw new QuizValidationError("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0633\u0624\u0627\u0644 \u0646\u0641\u0633\u0647 \u0623\u0643\u062B\u0631 \u0645\u0646 \u0645\u0631\u0629 \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629.");
        }
        seenBankIds.add(sourceId);
        let bankQuestion;
        try {
          bankQuestion = this.questionBankRepo.getQuestionById(sourceId);
        } catch {
          throw new QuizValidationError(
            "\u0623\u062D\u062F \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u0645\u062E\u062A\u0627\u0631\u0629 \u0644\u0645 \u064A\u0639\u062F \u0645\u0648\u062C\u0648\u062F\u0627\u064B \u0641\u064A \u0628\u0646\u0643 \u0627\u0644\u0623\u0633\u0626\u0644\u0629. \u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0623\u0633\u0626\u0644\u0629."
          );
        }
        const copiedQuestionImage = copyMediaToQuiz(bankQuestion.imagePath, this.storagePaths);
        if (copiedQuestionImage) {
          newlyCopiedFiles.push(copiedQuestionImage);
        }
        const preparedOptions = bankQuestion.options.map((opt, optIdx) => {
          const copiedOptionImage = copyMediaToQuiz(opt.imagePath, this.storagePaths);
          if (copiedOptionImage) {
            newlyCopiedFiles.push(copiedOptionImage);
          }
          return {
            optionOrder: optIdx,
            optionText: opt.optionText,
            imagePath: copiedOptionImage,
            isCorrect: opt.isCorrect
          };
        });
        prepared.push({
          sourceQuestionId: bankQuestion.id,
          type: bankQuestion.type,
          prompt: bankQuestion.prompt,
          imagePath: copiedQuestionImage,
          correctBoolean: bankQuestion.correctBoolean,
          subject: bankQuestion.subject,
          grade: bankQuestion.grade,
          topic: bankQuestion.topic,
          difficulty: bankQuestion.difficulty,
          timeLimitSeconds,
          options: preparedOptions
        });
        continue;
      }
      throw new QuizValidationError(`\u0646\u0648\u0639 \u0645\u0635\u062F\u0631 \u0627\u0644\u0633\u0624\u0627\u0644 \u0631\u0642\u0645 ${index + 1} \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645.`);
    }
    return prepared;
  }
  insertSnapshotQuestions(quizId, snapshots) {
    const insertQuestion = this.db.prepare(
      `
      INSERT INTO quiz_questions (
        id, quiz_id, source_question_id, question_order, type, prompt,
        image_path, correct_boolean, subject, grade, topic, difficulty, time_limit_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    );
    const insertOption = this.db.prepare(
      `
      INSERT INTO quiz_question_options (
        id, quiz_question_id, option_order, option_text, image_path, is_correct
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
    );
    snapshots.forEach((snap, orderIndex) => {
      const quizQuestionId = import_node_crypto4.default.randomUUID();
      insertQuestion.run(
        quizQuestionId,
        quizId,
        snap.sourceQuestionId,
        orderIndex,
        snap.type,
        snap.prompt,
        snap.imagePath,
        snap.correctBoolean === null ? null : snap.correctBoolean ? 1 : 0,
        snap.subject,
        snap.grade,
        snap.topic,
        snap.difficulty,
        snap.timeLimitSeconds
      );
      if (snap.type === "multiple_choice") {
        snap.options.forEach((opt, optIndex) => {
          insertOption.run(
            import_node_crypto4.default.randomUUID(),
            quizQuestionId,
            optIndex,
            opt.optionText,
            opt.imagePath,
            opt.isCorrect ? 1 : 0
          );
        });
      }
    });
  }
  createQuiz(payload) {
    const validated = this.validateHeaderFields(payload);
    const quizId = import_node_crypto4.default.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newlyCopiedFiles = [];
    try {
      const snapshots = this.prepareQuestionSnapshots(
        validated.questions,
        null,
        newlyCopiedFiles
      );
      this.db.exec("BEGIN IMMEDIATE");
      try {
        this.db.prepare(
          `
            INSERT INTO quizzes (
              id, title, subject, grade, description, default_time_seconds, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        ).run(
          quizId,
          validated.title,
          validated.subject,
          validated.grade,
          validated.description,
          validated.defaultTimeSeconds,
          now,
          now
        );
        this.insertSnapshotQuestions(quizId, snapshots);
        this.db.exec("COMMIT");
      } catch (dbError) {
        try {
          this.db.exec("ROLLBACK");
        } catch {
        }
        throw dbError;
      }
    } catch (error) {
      unlinkMediaFilesDirectly(this.storagePaths, newlyCopiedFiles);
      throw error;
    }
    return this.getQuizById(quizId);
  }
  assertNoActiveLiveSession(quizId, actionLabel) {
    const active = this.db.prepare(
      `SELECT id FROM live_sessions WHERE quiz_id = ? AND status IN ('waiting', 'running') LIMIT 1`
    ).get(quizId);
    if (active) {
      throw new QuizValidationError(
        `\u0644\u0627 \u064A\u0645\u0643\u0646 ${actionLabel} \u0623\u062B\u0646\u0627\u0621 \u0648\u062C\u0648\u062F \u062C\u0644\u0633\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0646\u0634\u0637\u0629 \u0644\u0647\u0627. \u0623\u0646\u0647\u0650 \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0623\u0648 \u0623\u0644\u063A\u0650\u0647\u0627 \u0623\u0648\u0644\u0627\u064B.`,
        409
      );
    }
  }
  updateQuiz(id, payload) {
    const existing = this.getQuizById(id);
    this.assertNoActiveLiveSession(id, "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629");
    const validated = this.validateHeaderFields(payload);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existingMap = /* @__PURE__ */ new Map();
    const oldMediaPaths = [];
    for (const q of existing.questions) {
      existingMap.set(q.id, q);
      if (q.imagePath) oldMediaPaths.push(q.imagePath);
      for (const opt of q.options) {
        if (opt.imagePath) oldMediaPaths.push(opt.imagePath);
      }
    }
    const newlyCopiedFiles = [];
    let retainedOrNewSet = /* @__PURE__ */ new Set();
    try {
      const snapshots = this.prepareQuestionSnapshots(
        validated.questions,
        existingMap,
        newlyCopiedFiles
      );
      retainedOrNewSet = new Set(
        snapshots.flatMap((s) => [s.imagePath, ...s.options.map((o) => o.imagePath)]).filter((p) => Boolean(p))
      );
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const result = this.db.prepare(
          `
            UPDATE quizzes
            SET title = ?, subject = ?, grade = ?, description = ?,
                default_time_seconds = ?, updated_at = ?
            WHERE id = ?
          `
        ).run(
          validated.title,
          validated.subject,
          validated.grade,
          validated.description,
          validated.defaultTimeSeconds,
          now,
          id
        );
        if (result.changes === 0) {
          throw new QuizNotFoundError();
        }
        this.db.prepare("DELETE FROM quiz_questions WHERE quiz_id = ?").run(id);
        this.insertSnapshotQuestions(id, snapshots);
        this.db.exec("COMMIT");
      } catch (dbError) {
        try {
          this.db.exec("ROLLBACK");
        } catch {
        }
        throw dbError;
      }
    } catch (error) {
      unlinkMediaFilesDirectly(this.storagePaths, newlyCopiedFiles);
      throw error;
    }
    const removedMediaPaths = oldMediaPaths.filter((p) => !retainedOrNewSet.has(p));
    if (removedMediaPaths.length > 0) {
      deleteMediaFilesIfUnreferenced(this.db, this.storagePaths, removedMediaPaths);
    }
    return this.getQuizById(id);
  }
  deleteQuiz(id) {
    const existing = this.getQuizById(id);
    this.assertNoActiveLiveSession(id, "\u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629");
    const candidatePaths = [];
    for (const q of existing.questions) {
      candidatePaths.push(q.imagePath);
      for (const opt of q.options) {
        candidatePaths.push(opt.imagePath);
      }
    }
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.db.prepare("DELETE FROM quizzes WHERE id = ?").run(id);
      if (result.changes === 0) {
        throw new QuizNotFoundError();
      }
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
    deleteMediaFilesIfUnreferenced(this.db, this.storagePaths, candidatePaths);
  }
  getLinkedQuizSummaryForQuestion(questionId) {
    const updatableRows = this.db.prepare(
      `
        SELECT DISTINCT q.id, q.title
        FROM quizzes q
        INNER JOIN quiz_questions qq ON qq.quiz_id = q.id
        WHERE qq.source_question_id = ?
          AND q.lifecycle_status = 'draft'
        ORDER BY q.created_at DESC
      `
    ).all(questionId);
    const lockedRow = this.db.prepare(
      `
        SELECT COUNT(DISTINCT q.id) AS locked_count
        FROM quizzes q
        INNER JOIN quiz_questions qq ON qq.quiz_id = q.id
        WHERE qq.source_question_id = ?
          AND q.lifecycle_status <> 'draft'
      `
    ).get(questionId);
    return {
      updatableQuizCount: updatableRows.length,
      lockedQuizCount: lockedRow?.locked_count ?? 0,
      updatableQuizzes: updatableRows.map((row) => ({
        id: row.id,
        title: row.title
      }))
    };
  }
  syncQuestionToLinkedQuizzes(questionId, options) {
    const bankQuestion = this.questionBankRepo.getQuestionById(questionId);
    const targetRows = this.db.prepare(
      `
        SELECT qq.id AS quiz_question_id, qq.quiz_id, qq.image_path
        FROM quiz_questions qq
        INNER JOIN quizzes q ON q.id = qq.quiz_id
        WHERE qq.source_question_id = ?
          AND q.lifecycle_status = 'draft'
      `
    ).all(questionId);
    const lockedRow = this.db.prepare(
      `
        SELECT COUNT(DISTINCT q.id) AS locked_count
        FROM quizzes q
        INNER JOIN quiz_questions qq ON qq.quiz_id = q.id
        WHERE qq.source_question_id = ?
          AND q.lifecycle_status <> 'draft'
      `
    ).get(questionId);
    const skippedLockedQuizCount = lockedRow?.locked_count ?? 0;
    if (targetRows.length === 0) {
      return {
        questionId,
        updatedQuizCount: 0,
        updatedQuizQuestionCount: 0,
        skippedLockedQuizCount,
        updatedQuizIds: []
      };
    }
    const newlyCopiedFiles = [];
    const oldMediaCandidates = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const preparedUpdates = [];
    const touchedQuizIds = /* @__PURE__ */ new Set();
    try {
      for (const target of targetRows) {
        if (target.image_path) {
          oldMediaCandidates.push(target.image_path);
        }
        const existingOptionImages = this.db.prepare(
          `SELECT image_path FROM quiz_question_options WHERE quiz_question_id = ? AND image_path IS NOT NULL`
        ).all(target.quiz_question_id);
        for (const optImg of existingOptionImages) {
          oldMediaCandidates.push(optImg.image_path);
        }
        const copiedQuestionImage = copyMediaToQuiz(
          bankQuestion.imagePath,
          this.storagePaths
        );
        if (copiedQuestionImage) {
          newlyCopiedFiles.push(copiedQuestionImage);
        }
        const newOptions = bankQuestion.type === "multiple_choice" ? bankQuestion.options.map((opt, optIdx) => {
          const copiedOptImg = copyMediaToQuiz(opt.imagePath, this.storagePaths);
          if (copiedOptImg) {
            newlyCopiedFiles.push(copiedOptImg);
          }
          return {
            optionOrder: optIdx,
            optionText: opt.optionText,
            imagePath: copiedOptImg,
            isCorrect: opt.isCorrect
          };
        }) : [];
        preparedUpdates.push({
          quizQuestionId: target.quiz_question_id,
          quizId: target.quiz_id,
          newQuestionImagePath: copiedQuestionImage,
          newOptions
        });
        touchedQuizIds.add(target.quiz_id);
      }
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const updateSnapshotStmt = this.db.prepare(
          `
          UPDATE quiz_questions
          SET type = ?, prompt = ?, image_path = ?, correct_boolean = ?,
              subject = ?, grade = ?, topic = ?, difficulty = ?
          WHERE id = ?
            AND source_question_id = ?
            AND quiz_id IN (SELECT id FROM quizzes WHERE lifecycle_status = 'draft')
        `
        );
        const deleteOptionsStmt = this.db.prepare(
          `DELETE FROM quiz_question_options WHERE quiz_question_id = ?`
        );
        const insertOptionStmt = this.db.prepare(
          `
          INSERT INTO quiz_question_options (
            id, quiz_question_id, option_order, option_text, image_path, is_correct
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
        );
        const updateQuizTimestampStmt = this.db.prepare(
          `UPDATE quizzes SET updated_at = ? WHERE id = ? AND lifecycle_status = 'draft'`
        );
        for (const item of preparedUpdates) {
          const updateRes = updateSnapshotStmt.run(
            bankQuestion.type,
            bankQuestion.prompt,
            item.newQuestionImagePath,
            bankQuestion.correctBoolean === null ? null : bankQuestion.correctBoolean ? 1 : 0,
            bankQuestion.subject,
            bankQuestion.grade,
            bankQuestion.topic,
            bankQuestion.difficulty,
            item.quizQuestionId,
            questionId
          );
          if (updateRes.changes !== 1) {
            throw new QuizValidationError(
              "\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062B \u0646\u0633\u062E\u0629 \u0627\u0644\u0633\u0624\u0627\u0644 \u0641\u064A \u0625\u062D\u062F\u0649 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0627\u062A \u0644\u0639\u062F\u0645 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u0631\u062C\u0639 \u0623\u0648 \u062A\u063A\u064A\u0651\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629."
            );
          }
          deleteOptionsStmt.run(item.quizQuestionId);
          if (bankQuestion.type === "multiple_choice") {
            item.newOptions.forEach((opt, optIdx) => {
              insertOptionStmt.run(
                import_node_crypto4.default.randomUUID(),
                item.quizQuestionId,
                optIdx,
                opt.optionText,
                opt.imagePath,
                opt.isCorrect ? 1 : 0
              );
            });
          }
        }
        for (const quizId of touchedQuizIds) {
          updateQuizTimestampStmt.run(now, quizId);
        }
        if (options?.testBeforeCommitHook) {
          options.testBeforeCommitHook();
        }
        this.db.exec("COMMIT");
      } catch (dbError) {
        try {
          this.db.exec("ROLLBACK");
        } catch {
        }
        throw dbError;
      }
    } catch (error) {
      unlinkMediaFilesDirectly(this.storagePaths, newlyCopiedFiles);
      throw error;
    }
    if (oldMediaCandidates.length > 0) {
      deleteMediaFilesIfUnreferenced(this.db, this.storagePaths, oldMediaCandidates);
    }
    return {
      questionId,
      updatedQuizCount: touchedQuizIds.size,
      updatedQuizQuestionCount: preparedUpdates.length,
      skippedLockedQuizCount,
      updatedQuizIds: Array.from(touchedQuizIds)
    };
  }
};

// server/services/resultsArchiveRepository.ts
var import_node_crypto5 = __toESM(require("node:crypto"), 1);
var ResultsArchiveValidationError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "ResultsArchiveValidationError";
    this.statusCode = statusCode;
  }
};
var ResultsArchiveNotFoundError = class extends Error {
  constructor(message = "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0641\u064A \u0627\u0644\u0623\u0631\u0634\u064A\u0641.") {
    super(message);
    this.statusCode = 404;
    this.name = "ResultsArchiveNotFoundError";
  }
};
function escapeSqlLikePattern3(value) {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
function computeAccuracyPercent(correctCount, questionCount) {
  if (!Number.isFinite(questionCount) || questionCount <= 0) {
    return null;
  }
  if (!Number.isFinite(correctCount) || correctCount < 0) {
    return null;
  }
  const boundedCorrect = Math.min(correctCount, questionCount);
  return Math.round(boundedCorrect / questionCount * 1e3) / 10;
}
function mapArchivedSessionRow(row) {
  return {
    id: row.id,
    liveSessionId: row.live_session_id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    quizSubject: row.quiz_subject,
    quizGrade: row.quiz_grade,
    pinCode: row.pin_code,
    status: "completed",
    scoringMode: row.scoring_mode,
    advanceMode: row.advance_mode,
    allowAnswerChange: row.allow_answer_change === 1,
    allowLateJoin: row.allow_late_join === 1,
    questionIntroSeconds: row.question_intro_seconds,
    autoAdvanceSeconds: row.auto_advance_seconds,
    fullScreenMode: row.full_screen_mode === 1,
    questionCount: Number(row.question_count ?? 0),
    participantCount: Number(row.participant_count ?? 0),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    archivedAt: row.archived_at
  };
}
function mapArchivedParticipantRow(row) {
  return {
    id: row.id,
    archiveId: row.archive_id,
    sourceParticipantId: row.source_participant_id,
    displayName: row.display_name,
    avatarId: row.avatar_id || "avatar_cat",
    totalScore: Number(row.total_score ?? 0),
    rankPosition: row.rank_position !== null && row.rank_position !== void 0 ? Number(row.rank_position) : null,
    correctCount: Number(row.correct_count ?? 0),
    wrongCount: Number(row.wrong_count ?? 0),
    unansweredCount: Number(row.unanswered_count ?? 0),
    accuracyPercent: row.accuracy_percent !== null && row.accuracy_percent !== void 0 ? Number(row.accuracy_percent) : null,
    totalResponseTimeMs: Number(row.total_response_time_ms ?? 0),
    joinedAt: row.joined_at
  };
}
function mapArchivedOptionRow(row) {
  return {
    id: row.id,
    optionOrder: row.option_order,
    optionText: row.option_text,
    imageUrl: mediaRelativePathToUrl(row.image_path),
    isCorrect: row.is_correct === 1
  };
}
function archiveCompletedSessionTx(db, sessionId) {
  const cleanSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!cleanSessionId) return false;
  const existing = db.prepare(`SELECT id FROM archived_sessions WHERE live_session_id = ? LIMIT 1`).get(cleanSessionId);
  if (existing) {
    return false;
  }
  const sessionRow = db.prepare(
    `
      SELECT
        id, quiz_id, quiz_title, quiz_subject, quiz_grade, pin_code, status,
        scoring_mode, advance_mode, allow_answer_change, allow_late_join,
        question_intro_seconds, auto_advance_seconds, full_screen_mode,
        started_at, ended_at
      FROM live_sessions
      WHERE id = ?
      LIMIT 1
    `
  ).get(cleanSessionId);
  if (!sessionRow || sessionRow.status !== "completed") {
    return false;
  }
  const questionRows = db.prepare(
    `
      SELECT
        id, session_id, source_quiz_question_id, source_question_id,
        question_order, type, prompt, image_path, correct_boolean,
        subject, grade, topic, difficulty, time_limit_seconds, points
      FROM live_session_questions
      WHERE session_id = ?
      ORDER BY question_order ASC
    `
  ).all(cleanSessionId);
  const participantRows = db.prepare(
    `
      SELECT
        id, session_id, display_name, avatar_id, total_score,
        correct_count, wrong_count, total_response_time_ms,
        rank_position, joined_at
      FROM live_session_participants
      WHERE session_id = ?
      ORDER BY COALESCE(rank_position, 999999) ASC, total_score DESC, joined_at ASC
    `
  ).all(cleanSessionId);
  const answerRows = db.prepare(
    `
      SELECT
        id, session_id, session_question_id, participant_id,
        selected_option_id, selected_boolean, is_correct,
        response_time_ms, points_awarded, answered_at
      FROM live_session_answers
      WHERE session_id = ?
    `
  ).all(cleanSessionId);
  const optionRowsBySourceQuestionId = /* @__PURE__ */ new Map();
  if (questionRows.length > 0) {
    const placeholders = questionRows.map(() => "?").join(", ");
    const optionRows = db.prepare(
      `
        SELECT id, session_question_id, option_order, option_text, image_path, is_correct
        FROM live_session_question_options
        WHERE session_question_id IN (${placeholders})
        ORDER BY option_order ASC
      `
    ).all(...questionRows.map((q) => q.id));
    for (const opt of optionRows) {
      const list = optionRowsBySourceQuestionId.get(opt.session_question_id) ?? [];
      list.push(opt);
      optionRowsBySourceQuestionId.set(opt.session_question_id, list);
    }
  }
  const archiveId = import_node_crypto5.default.randomUUID();
  const archivedAt = (/* @__PURE__ */ new Date()).toISOString();
  const questionCount = questionRows.length;
  const participantCount = participantRows.length;
  db.prepare(
    `
    INSERT INTO archived_sessions (
      id, live_session_id, quiz_id, quiz_title, quiz_subject, quiz_grade,
      pin_code, status, scoring_mode, advance_mode, allow_answer_change,
      allow_late_join, question_intro_seconds, auto_advance_seconds,
      full_screen_mode, question_count, participant_count,
      started_at, ended_at, archived_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    archiveId,
    sessionRow.id,
    sessionRow.quiz_id,
    sessionRow.quiz_title,
    sessionRow.quiz_subject,
    sessionRow.quiz_grade,
    sessionRow.pin_code,
    sessionRow.scoring_mode ?? "speed_and_accuracy",
    sessionRow.advance_mode ?? "auto",
    sessionRow.allow_answer_change ? 1 : 0,
    sessionRow.allow_late_join ? 1 : 0,
    Number(sessionRow.question_intro_seconds ?? 5),
    Number(sessionRow.auto_advance_seconds ?? 5),
    sessionRow.full_screen_mode ? 1 : 0,
    questionCount,
    participantCount,
    sessionRow.started_at,
    sessionRow.ended_at,
    archivedAt
  );
  const insertQuestionStmt = db.prepare(
    `
    INSERT INTO archived_session_questions (
      id, archive_id, source_session_question_id, source_quiz_question_id,
      source_question_id, question_order, type, prompt, image_path,
      correct_boolean, subject, grade, topic, difficulty,
      time_limit_seconds, points
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );
  const insertOptionStmt = db.prepare(
    `
    INSERT INTO archived_session_options (
      id, archive_question_id, source_option_id, option_order,
      option_text, image_path, is_correct
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  );
  const questionIdMap = /* @__PURE__ */ new Map();
  const optionSnapshotMap = /* @__PURE__ */ new Map();
  for (const q of questionRows) {
    const archiveQuestionId = import_node_crypto5.default.randomUUID();
    questionIdMap.set(q.id, archiveQuestionId);
    insertQuestionStmt.run(
      archiveQuestionId,
      archiveId,
      q.id,
      q.source_quiz_question_id,
      q.source_question_id,
      q.question_order,
      q.type,
      q.prompt,
      q.image_path,
      q.correct_boolean,
      q.subject,
      q.grade,
      q.topic,
      q.difficulty,
      q.time_limit_seconds,
      Number(q.points ?? 1e3)
    );
    const optList = optionRowsBySourceQuestionId.get(q.id) ?? [];
    for (const opt of optList) {
      const archiveOptionId = import_node_crypto5.default.randomUUID();
      optionSnapshotMap.set(opt.id, {
        archiveOptionId,
        optionText: opt.option_text
      });
      insertOptionStmt.run(
        archiveOptionId,
        archiveQuestionId,
        opt.id,
        opt.option_order,
        opt.option_text,
        opt.image_path,
        opt.is_correct ? 1 : 0
      );
    }
  }
  const insertParticipantStmt = db.prepare(
    `
    INSERT INTO archived_session_participants (
      id, archive_id, source_participant_id, display_name, avatar_id,
      total_score, rank_position, correct_count, wrong_count,
      unanswered_count, accuracy_percent, total_response_time_ms, joined_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );
  const participantIdMap = /* @__PURE__ */ new Map();
  for (const p of participantRows) {
    const archiveParticipantId = import_node_crypto5.default.randomUUID();
    participantIdMap.set(p.id, archiveParticipantId);
    const correctCount = Number(p.correct_count ?? 0);
    const wrongCount = Number(p.wrong_count ?? 0);
    const unansweredCount = Math.max(0, questionCount - (correctCount + wrongCount));
    const accuracyPercent = computeAccuracyPercent(correctCount, questionCount);
    insertParticipantStmt.run(
      archiveParticipantId,
      archiveId,
      p.id,
      p.display_name,
      p.avatar_id || "avatar_cat",
      Number(p.total_score ?? 0),
      p.rank_position !== null && p.rank_position !== void 0 ? Number(p.rank_position) : null,
      correctCount,
      wrongCount,
      unansweredCount,
      accuracyPercent,
      Number(p.total_response_time_ms ?? 0),
      p.joined_at
    );
  }
  const insertAnswerStmt = db.prepare(
    `
    INSERT INTO archived_session_answers (
      id, archive_id, archive_question_id, archive_participant_id,
      selected_archive_option_id, selected_option_text_snapshot,
      selected_boolean, is_correct, response_time_ms, points_awarded, answered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );
  for (const ans of answerRows) {
    const archiveQuestionId = questionIdMap.get(ans.session_question_id);
    const archiveParticipantId = participantIdMap.get(ans.participant_id);
    if (!archiveQuestionId || !archiveParticipantId) {
      continue;
    }
    const selectedOptSnap = ans.selected_option_id ? optionSnapshotMap.get(ans.selected_option_id) : void 0;
    insertAnswerStmt.run(
      import_node_crypto5.default.randomUUID(),
      archiveId,
      archiveQuestionId,
      archiveParticipantId,
      selectedOptSnap?.archiveOptionId ?? null,
      selectedOptSnap?.optionText ?? null,
      ans.selected_boolean,
      ans.is_correct ? 1 : 0,
      ans.response_time_ms,
      Number(ans.points_awarded ?? 0),
      ans.answered_at
    );
  }
  return true;
}
function backfillLegacyCompletedSessions(db) {
  const missingRows = db.prepare(
    `
      SELECT ls.id
      FROM live_sessions ls
      WHERE ls.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM archived_sessions a WHERE a.live_session_id = ls.id
        )
      ORDER BY COALESCE(ls.ended_at, ls.updated_at, ls.created_at) ASC
    `
  ).all();
  if (missingRows.length === 0) {
    return 0;
  }
  let archivedCount = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of missingRows) {
      if (archiveCompletedSessionTx(db, row.id)) {
        archivedCount += 1;
      }
    }
    db.exec("COMMIT");
    return archivedCount;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
    }
    throw error;
  }
}
var SqliteResultsArchiveRepository = class {
  constructor(db) {
    this.db = db;
  }
  archiveCompletedSessionAtomic(sessionId) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const created = archiveCompletedSessionTx(this.db, sessionId);
      this.db.exec("COMMIT");
      return created;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
  }
  listArchivedResults(filters = {}) {
    const whereClauses = [];
    const params = [];
    const search = typeof filters.search === "string" ? filters.search.trim() : "";
    if (search.length > 0) {
      const pattern = `%${escapeSqlLikePattern3(search)}%`;
      whereClauses.push(
        `(quiz_title LIKE ? ESCAPE '\\' OR COALESCE(quiz_subject, '') LIKE ? ESCAPE '\\' OR COALESCE(quiz_grade, '') LIKE ? ESCAPE '\\' OR pin_code LIKE ? ESCAPE '\\')`
      );
      params.push(pattern, pattern, pattern, pattern);
    }
    const exactDate = typeof filters.date === "string" ? filters.date.trim() : "";
    if (exactDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(exactDate)) {
        throw new ResultsArchiveValidationError("\u0635\u064A\u063A\u0629 \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 YYYY-MM-DD.");
      }
      whereClauses.push(`date(COALESCE(ended_at, archived_at), 'localtime') = ?`);
      params.push(exactDate);
    }
    const dateFrom = typeof filters.dateFrom === "string" ? filters.dateFrom.trim() : "";
    if (dateFrom) {
      whereClauses.push(`COALESCE(ended_at, archived_at) >= ?`);
      params.push(dateFrom);
    }
    const dateTo = typeof filters.dateTo === "string" ? filters.dateTo.trim() : "";
    if (dateTo) {
      const upperBound = /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo}T23:59:59.999Z` : dateTo;
      whereClauses.push(`COALESCE(ended_at, archived_at) <= ?`);
      params.push(upperBound);
    }
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const orderDirection = filters.sort === "oldest" ? "ASC" : "DESC";
    const rows = this.db.prepare(
      `
        SELECT *
        FROM archived_sessions
        ${whereSql}
        ORDER BY COALESCE(ended_at, archived_at) ${orderDirection}, archived_at ${orderDirection}
      `
    ).all(...params);
    const totalRow = this.db.prepare(`SELECT COUNT(*) AS cnt FROM archived_sessions`).get();
    return {
      archives: rows.map(mapArchivedSessionRow),
      totalCount: Number(totalRow?.cnt ?? rows.length)
    };
  }
  getArchivedResultById(archiveId) {
    const cleanArchiveId = typeof archiveId === "string" ? archiveId.trim() : "";
    if (!cleanArchiveId) {
      throw new ResultsArchiveValidationError("\u0645\u0639\u0631\u0651\u0641 \u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
    }
    const sessionRow = this.db.prepare(`SELECT * FROM archived_sessions WHERE id = ? LIMIT 1`).get(cleanArchiveId);
    if (!sessionRow) {
      throw new ResultsArchiveNotFoundError();
    }
    const participantRows = this.db.prepare(
      `
        SELECT *
        FROM archived_session_participants
        WHERE archive_id = ?
        ORDER BY COALESCE(rank_position, 999999) ASC, total_score DESC, COALESCE(joined_at, '') ASC, id ASC
      `
    ).all(cleanArchiveId);
    return {
      session: mapArchivedSessionRow(sessionRow),
      participants: participantRows.map(mapArchivedParticipantRow)
    };
  }
  getArchivedParticipantDetails(archiveId, participantRowId) {
    const cleanArchiveId = typeof archiveId === "string" ? archiveId.trim() : "";
    const cleanParticipantId = typeof participantRowId === "string" ? participantRowId.trim() : "";
    if (!cleanArchiveId || !cleanParticipantId) {
      throw new ResultsArchiveValidationError("\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u0627\u0644\u0645\u0634\u0627\u0631\u0643 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
    }
    const sessionRow = this.db.prepare(`SELECT * FROM archived_sessions WHERE id = ? LIMIT 1`).get(cleanArchiveId);
    if (!sessionRow) {
      throw new ResultsArchiveNotFoundError();
    }
    const participantRow = this.db.prepare(
      `
        SELECT *
        FROM archived_session_participants
        WHERE id = ? AND archive_id = ?
        LIMIT 1
      `
    ).get(cleanParticipantId, cleanArchiveId);
    if (!participantRow) {
      throw new ResultsArchiveNotFoundError("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0634\u0627\u0631\u0643 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0623\u0631\u0634\u064A\u0641.");
    }
    const questionRows = this.db.prepare(
      `
        SELECT *
        FROM archived_session_questions
        WHERE archive_id = ?
        ORDER BY question_order ASC
      `
    ).all(cleanArchiveId);
    const optionsByQuestionId = /* @__PURE__ */ new Map();
    if (questionRows.length > 0) {
      const placeholders = questionRows.map(() => "?").join(", ");
      const optionRows = this.db.prepare(
        `
          SELECT *
          FROM archived_session_options
          WHERE archive_question_id IN (${placeholders})
          ORDER BY option_order ASC
        `
      ).all(...questionRows.map((q) => q.id));
      for (const opt of optionRows) {
        const list = optionsByQuestionId.get(opt.archive_question_id) ?? [];
        list.push(mapArchivedOptionRow(opt));
        optionsByQuestionId.set(opt.archive_question_id, list);
      }
    }
    const answerRows = this.db.prepare(
      `
        SELECT *
        FROM archived_session_answers
        WHERE archive_id = ? AND archive_participant_id = ?
      `
    ).all(cleanArchiveId, cleanParticipantId);
    const answerByQuestionId = new Map(
      answerRows.map((ans) => [ans.archive_question_id, ans])
    );
    const questions = questionRows.map((qRow) => {
      const options = optionsByQuestionId.get(qRow.id) ?? [];
      const correctOption = options.find((opt) => opt.isCorrect) ?? null;
      const answer = answerByQuestionId.get(qRow.id);
      let selectedOptionText = null;
      let selectedOptionImageUrl = null;
      if (answer) {
        if (qRow.type === "multiple_choice") {
          const matchedOpt = answer.selected_archive_option_id ? options.find((opt) => opt.id === answer.selected_archive_option_id) : void 0;
          selectedOptionText = matchedOpt?.optionText ?? answer.selected_option_text_snapshot ?? null;
          selectedOptionImageUrl = matchedOpt?.imageUrl ?? null;
        }
      }
      const outcome = !answer ? "unanswered" : answer.is_correct === 1 ? "correct" : "wrong";
      return {
        archiveQuestionId: qRow.id,
        questionOrder: qRow.question_order,
        type: qRow.type,
        prompt: qRow.prompt,
        imageUrl: mediaRelativePathToUrl(qRow.image_path),
        points: Number(qRow.points ?? 1e3),
        timeLimitSeconds: qRow.time_limit_seconds,
        subject: qRow.subject,
        grade: qRow.grade,
        topic: qRow.topic,
        difficulty: qRow.difficulty,
        options,
        correctBoolean: qRow.correct_boolean === null || qRow.correct_boolean === void 0 ? null : qRow.correct_boolean === 1,
        correctOptionId: correctOption?.id ?? null,
        correctOptionText: correctOption?.optionText ?? null,
        correctOptionImageUrl: correctOption?.imageUrl ?? null,
        outcome,
        selectedOptionId: answer?.selected_archive_option_id ?? null,
        selectedOptionText,
        selectedOptionImageUrl,
        selectedBoolean: answer && answer.selected_boolean !== null && answer.selected_boolean !== void 0 ? answer.selected_boolean === 1 : null,
        pointsAwarded: answer ? Number(answer.points_awarded ?? 0) : 0,
        responseTimeMs: answer && answer.response_time_ms !== null && answer.response_time_ms !== void 0 ? Number(answer.response_time_ms) : null,
        answeredAt: answer?.answered_at ?? null
      };
    });
    return {
      session: mapArchivedSessionRow(sessionRow),
      participant: mapArchivedParticipantRow(participantRow),
      questions
    };
  }
};

// server/services/liveSessionRepository.ts
var LiveSessionValidationError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "LiveSessionValidationError";
    this.statusCode = statusCode;
  }
};
var LiveSessionNotFoundError = class extends Error {
  constructor(message = "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u062C\u0644\u0633\u0629 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.") {
    super(message);
    this.statusCode = 404;
    this.name = "LiveSessionNotFoundError";
  }
};
var LiveSessionConflictError = class extends Error {
  constructor(message, existingSessionId) {
    super(message);
    this.statusCode = 409;
    this.code = "ACTIVE_SESSION_EXISTS";
    this.name = "LiveSessionConflictError";
    this.existingSessionId = existingSessionId;
  }
};
var DEFAULT_LIVE_SESSION_SETTINGS = {
  questionIntroSeconds: 5,
  advanceMode: "auto",
  autoAdvanceSeconds: 5,
  allowAnswerChange: false,
  allowLateJoin: true,
  scoringMode: "speed_and_accuracy",
  fullScreenMode: false
};
var MIN_PARTICIPANT_NAME_LENGTH = 2;
var MAX_PARTICIPANT_NAME_LENGTH = 40;
var MIN_PHASE_SECONDS = 1;
var MAX_PHASE_SECONDS = 60;
function normalizePinCode(rawPin) {
  if (typeof rawPin !== "string" && typeof rawPin !== "number") {
    return "";
  }
  return String(rawPin).replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 1632)).replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 1776)).replace(/\s+/g, "").trim();
}
function cleanParticipantDisplayName(rawName) {
  if (typeof rawName !== "string") return "";
  return rawName.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}
function normalizeParticipantName(rawName) {
  const collapsed = cleanParticipantDisplayName(rawName);
  return collapsed.replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآٱ]/g, "\u0627").toLocaleLowerCase("en-US");
}
function mapSettingsFromRow(row) {
  return {
    questionIntroSeconds: row.question_intro_seconds ?? 5,
    advanceMode: row.advance_mode === "manual" ? "manual" : "auto",
    autoAdvanceSeconds: row.auto_advance_seconds ?? 5,
    allowAnswerChange: row.allow_answer_change === 1,
    allowLateJoin: row.allow_late_join === 1,
    scoringMode: row.scoring_mode === "accuracy_only" ? "accuracy_only" : "speed_and_accuracy",
    fullScreenMode: (row.full_screen_mode ?? 0) === 1
  };
}
function validateLiveSessionSettings(input, base = DEFAULT_LIVE_SESSION_SETTINGS) {
  if (input === void 0 || input === null) {
    return { ...base };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new LiveSessionValidationError("\u0635\u064A\u063A\u0629 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
  }
  const raw = input;
  const next = { ...base };
  if (raw.questionIntroSeconds !== void 0) {
    const val = Number(raw.questionIntroSeconds);
    if (!Number.isInteger(val) || val < MIN_PHASE_SECONDS || val > MAX_PHASE_SECONDS) {
      throw new LiveSessionValidationError(
        `\u0645\u062F\u0629 \u0639\u0631\u0636 \u0627\u0644\u0633\u0624\u0627\u0644 \u0642\u0628\u0644 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0639\u062F\u062F\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B \u0628\u064A\u0646 ${MIN_PHASE_SECONDS} \u0648${MAX_PHASE_SECONDS} \u062B\u0627\u0646\u064A\u0629.`
      );
    }
    next.questionIntroSeconds = val;
  }
  if (raw.advanceMode !== void 0) {
    if (raw.advanceMode !== "auto" && raw.advanceMode !== "manual") {
      throw new LiveSessionValidationError("\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u064A\u0646 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
    }
    next.advanceMode = raw.advanceMode;
  }
  if (raw.autoAdvanceSeconds !== void 0) {
    const val = Number(raw.autoAdvanceSeconds);
    if (!Number.isInteger(val) || val < MIN_PHASE_SECONDS || val > MAX_PHASE_SECONDS) {
      throw new LiveSessionValidationError(
        `\u0645\u062F\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0628\u0644 \u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0639\u062F\u062F\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B \u0628\u064A\u0646 ${MIN_PHASE_SECONDS} \u0648${MAX_PHASE_SECONDS} \u062B\u0627\u0646\u064A\u0629.`
      );
    }
    next.autoAdvanceSeconds = val;
  }
  if (raw.allowAnswerChange !== void 0) {
    if (typeof raw.allowAnswerChange !== "boolean") {
      throw new LiveSessionValidationError("\u0642\u064A\u0645\u0629 \u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0633\u0645\u0627\u062D \u0628\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
    }
    next.allowAnswerChange = raw.allowAnswerChange;
  }
  if (raw.allowLateJoin !== void 0) {
    if (typeof raw.allowLateJoin !== "boolean") {
      throw new LiveSessionValidationError("\u0642\u064A\u0645\u0629 \u0625\u0639\u062F\u0627\u062F \u0627\u0644\u0633\u0645\u0627\u062D \u0628\u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0627\u0644\u0645\u062A\u0623\u062E\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
    }
    next.allowLateJoin = raw.allowLateJoin;
  }
  if (raw.scoringMode !== void 0) {
    if (raw.scoringMode !== "speed_and_accuracy" && raw.scoringMode !== "accuracy_only") {
      throw new LiveSessionValidationError("\u0637\u0631\u064A\u0642\u0629 \u0627\u062D\u062A\u0633\u0627\u0628 \u0627\u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u0645\u062E\u062A\u0627\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
    }
    next.scoringMode = raw.scoringMode;
  }
  if (raw.fullScreenMode !== void 0) {
    if (typeof raw.fullScreenMode !== "boolean") {
      throw new LiveSessionValidationError("\u0642\u064A\u0645\u0629 \u0625\u0639\u062F\u0627\u062F \u0648\u0636\u0639 \u0645\u0644\u0621 \u0627\u0644\u0634\u0627\u0634\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
    }
    next.fullScreenMode = raw.fullScreenMode;
  }
  return next;
}
function computeTimingFields(row, nowMs = Date.now()) {
  const startedMs = row.phase_started_at ? Date.parse(row.phase_started_at) : NaN;
  const endsMs = row.phase_ends_at ? Date.parse(row.phase_ends_at) : NaN;
  const phaseDurationMs = Number.isFinite(startedMs) && Number.isFinite(endsMs) && endsMs >= startedMs ? endsMs - startedMs : null;
  const remainingMs = Number.isFinite(endsMs) ? Math.max(0, endsMs - nowMs) : null;
  return {
    phaseStartedAt: row.phase_started_at,
    phaseEndsAt: row.phase_ends_at,
    phaseDurationMs,
    serverNowMs: nowMs,
    remainingMs
  };
}
function mapParticipantRow(row, totalQuestions) {
  const answeredTotal = (row.correct_count ?? 0) + (row.wrong_count ?? 0);
  return {
    id: row.id,
    sessionId: row.session_id,
    displayName: row.display_name,
    avatarId: row.avatar_id ?? "avatar_cat",
    connectionStatus: row.connection_status,
    totalScore: row.total_score ?? 0,
    correctCount: row.correct_count ?? 0,
    wrongCount: row.wrong_count ?? 0,
    unansweredCount: Math.max(0, totalQuestions - answeredTotal),
    totalResponseTimeMs: row.total_response_time_ms ?? 0,
    rankPosition: row.rank_position,
    joinedAt: row.joined_at,
    lastSeenAt: row.last_seen_at,
    disconnectedAt: row.disconnected_at
  };
}
function mapSessionSummaryRow(row, nowMs = Date.now()) {
  const timing = computeTimingFields(row, nowMs);
  return {
    id: row.id,
    quizId: row.quiz_id,
    quizTitle: row.quiz_title,
    quizSubject: row.quiz_subject,
    quizGrade: row.quiz_grade,
    pinCode: row.pin_code,
    status: row.status,
    currentPhase: row.current_phase ?? "lobby",
    settings: mapSettingsFromRow(row),
    questionCount: row.question_count ?? 0,
    participantCount: row.participant_count ?? 0,
    connectedParticipantCount: row.connected_participant_count ?? 0,
    currentQuestionIndex: row.current_question_index,
    ...timing,
    createdAt: row.created_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    updatedAt: row.updated_at
  };
}
function mapToStudentPublicInfo(row, nowMs = Date.now()) {
  const timing = computeTimingFields(row, nowMs);
  return {
    sessionId: row.id,
    quizTitle: row.quiz_title,
    quizSubject: row.quiz_subject,
    quizGrade: row.quiz_grade,
    pinCode: row.pin_code,
    status: row.status,
    currentPhase: row.current_phase ?? "lobby",
    settings: mapSettingsFromRow(row),
    questionCount: row.question_count ?? 0,
    participantCount: row.participant_count ?? 0,
    currentQuestionIndex: row.current_question_index,
    ...timing
  };
}
function safeTokenEquals(a, b) {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return import_node_crypto6.default.timingSafeEqual(bufA, bufB);
}
var SqliteLiveSessionRepository = class {
  constructor(db, storagePaths) {
    this.db = db;
    this.storagePaths = storagePaths;
    this.quizRepo = new SqliteQuizRepository(db, storagePaths);
  }
  getSessionRowById(sessionId) {
    return this.db.prepare(
      `
        SELECT
          ls.*,
          (SELECT COUNT(*) FROM live_session_questions lsq WHERE lsq.session_id = ls.id) AS question_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id) AS participant_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id AND lsp.connection_status = 'connected') AS connected_participant_count
        FROM live_sessions ls
        WHERE ls.id = ?
      `
    ).get(sessionId);
  }
  getSessionRowByPin(pinCode) {
    return this.db.prepare(
      `
        SELECT
          ls.*,
          (SELECT COUNT(*) FROM live_session_questions lsq WHERE lsq.session_id = ls.id) AS question_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id) AS participant_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id AND lsp.connection_status = 'connected') AS connected_participant_count
        FROM live_sessions ls
        WHERE ls.pin_code = ?
        ORDER BY
          CASE ls.status
            WHEN 'waiting' THEN 0
            WHEN 'running' THEN 1
            ELSE 2
          END ASC,
          ls.created_at DESC
        LIMIT 1
      `
    ).get(pinCode);
  }
  getSessionQuestionByOrder(sessionId, questionOrder) {
    if (questionOrder < 0) return void 0;
    return this.db.prepare(
      `SELECT * FROM live_session_questions WHERE session_id = ? AND question_order = ? LIMIT 1`
    ).get(sessionId, questionOrder);
  }
  getSessionQuestionOptions(sessionQuestionId) {
    return this.db.prepare(
      `SELECT * FROM live_session_question_options WHERE session_question_id = ? ORDER BY option_order ASC`
    ).all(sessionQuestionId);
  }
  buildLeaderboard(participantRows, totalQuestions) {
    const sorted = [...participantRows].sort((a, b) => {
      if ((b.total_score ?? 0) !== (a.total_score ?? 0)) {
        return (b.total_score ?? 0) - (a.total_score ?? 0);
      }
      if ((b.correct_count ?? 0) !== (a.correct_count ?? 0)) {
        return (b.correct_count ?? 0) - (a.correct_count ?? 0);
      }
      if ((a.total_response_time_ms ?? 0) !== (b.total_response_time_ms ?? 0)) {
        return (a.total_response_time_ms ?? 0) - (b.total_response_time_ms ?? 0);
      }
      if (a.joined_at !== b.joined_at) {
        return a.joined_at.localeCompare(b.joined_at);
      }
      return a.id.localeCompare(b.id);
    });
    return sorted.map((row, idx) => {
      const answeredTotal = (row.correct_count ?? 0) + (row.wrong_count ?? 0);
      return {
        participantId: row.id,
        displayName: row.display_name,
        avatarId: row.avatar_id ?? "avatar_cat",
        rankPosition: row.rank_position ?? idx + 1,
        totalScore: row.total_score ?? 0,
        correctCount: row.correct_count ?? 0,
        wrongCount: row.wrong_count ?? 0,
        unansweredCount: Math.max(0, totalQuestions - answeredTotal),
        totalResponseTimeMs: row.total_response_time_ms ?? 0
      };
    });
  }
  recomputeSessionStandingsTx(sessionId) {
    const participantRows = this.db.prepare(`SELECT * FROM live_session_participants WHERE session_id = ?`).all(sessionId);
    const aggRows = this.db.prepare(
      `
        SELECT
          lsa.participant_id AS participant_id,
          COALESCE(SUM(lsa.points_awarded), 0) AS total_score,
          COALESCE(SUM(CASE WHEN lsa.is_correct = 1 THEN 1 ELSE 0 END), 0) AS correct_count,
          COALESCE(SUM(CASE WHEN lsa.is_correct = 0 THEN 1 ELSE 0 END), 0) AS wrong_count,
          COALESCE(SUM(CASE WHEN lsa.is_correct = 1 THEN COALESCE(lsa.response_time_ms, 0) ELSE 0 END), 0) AS correct_time_ms
        FROM live_session_answers lsa
        INNER JOIN live_session_questions lsq ON lsq.id = lsa.session_question_id
        WHERE lsa.session_id = ? AND lsq.results_finalized = 1
        GROUP BY lsa.participant_id
      `
    ).all(sessionId);
    const aggByParticipant = new Map(aggRows.map((row) => [row.participant_id, row]));
    const computed = participantRows.map((p) => {
      const agg = aggByParticipant.get(p.id);
      return {
        id: p.id,
        joinedAt: p.joined_at,
        totalScore: agg ? Number(agg.total_score) : 0,
        correctCount: agg ? Number(agg.correct_count) : 0,
        wrongCount: agg ? Number(agg.wrong_count) : 0,
        totalResponseTimeMs: agg ? Number(agg.correct_time_ms) : 0
      };
    });
    computed.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      if (a.totalResponseTimeMs !== b.totalResponseTimeMs) {
        return a.totalResponseTimeMs - b.totalResponseTimeMs;
      }
      if (a.joinedAt !== b.joinedAt) return a.joinedAt.localeCompare(b.joinedAt);
      return a.id.localeCompare(b.id);
    });
    const updateStmt = this.db.prepare(
      `
      UPDATE live_session_participants
      SET total_score = ?,
          correct_count = ?,
          wrong_count = ?,
          total_response_time_ms = ?,
          rank_position = ?
      WHERE id = ? AND session_id = ?
    `
    );
    computed.forEach((entry, index) => {
      updateStmt.run(
        entry.totalScore,
        entry.correctCount,
        entry.wrongCount,
        entry.totalResponseTimeMs,
        index + 1,
        entry.id,
        sessionId
      );
    });
  }
  generateUniqueActivePin() {
    const checkStmt = this.db.prepare(
      `SELECT 1 FROM live_sessions WHERE pin_code = ? AND status IN ('waiting', 'running') LIMIT 1`
    );
    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = String(import_node_crypto6.default.randomInt(1e5, 1e6));
      if (!checkStmt.get(candidate)) {
        return candidate;
      }
    }
    throw new LiveSessionValidationError("\u062A\u0639\u0630\u0631 \u062A\u0648\u0644\u064A\u062F \u0631\u0645\u0632 PIN \u0641\u0631\u064A\u062F \u0644\u0644\u062C\u0644\u0633\u0629 \u062D\u0627\u0644\u064A\u0627\u064B. \u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.", 500);
  }
  insertFrozenSessionQuestions(sessionId, questions) {
    const insertQuestionStmt = this.db.prepare(
      `
      INSERT INTO live_session_questions (
        id, session_id, source_quiz_question_id, source_question_id, question_order,
        type, prompt, image_path, correct_boolean, subject, grade, topic,
        difficulty, time_limit_seconds, points, results_finalized
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `
    );
    const insertOptionStmt = this.db.prepare(
      `
      INSERT INTO live_session_question_options (
        id, session_question_id, option_order, option_text, image_path, is_correct
      ) VALUES (?, ?, ?, ?, ?, ?)
    `
    );
    questions.forEach((question, index) => {
      const sessionQuestionId = import_node_crypto6.default.randomUUID();
      insertQuestionStmt.run(
        sessionQuestionId,
        sessionId,
        question.id,
        question.sourceQuestionId,
        index,
        question.type,
        question.prompt,
        question.imagePath,
        question.correctBoolean === null ? null : question.correctBoolean ? 1 : 0,
        question.subject,
        question.grade,
        question.topic,
        question.difficulty,
        question.timeLimitSeconds,
        1e3
      );
      if (question.type === "multiple_choice") {
        question.options.forEach((opt, optIdx) => {
          insertOptionStmt.run(
            import_node_crypto6.default.randomUUID(),
            sessionQuestionId,
            optIdx,
            opt.optionText,
            opt.imagePath,
            opt.isCorrect ? 1 : 0
          );
        });
      }
    });
  }
  buildTeacherQuestionResults(sessionId, questionRow, totalParticipants) {
    const options = this.getSessionQuestionOptions(questionRow.id);
    const answers = this.db.prepare(
      `
        SELECT
          lsa.*,
          lsp.display_name AS participant_name,
          lsp.joined_at AS participant_joined_at
        FROM live_session_answers lsa
        INNER JOIN live_session_participants lsp ON lsp.id = lsa.participant_id
        WHERE lsa.session_id = ? AND lsa.session_question_id = ?
        ORDER BY COALESCE(lsa.response_time_ms, 9999999) ASC, lsp.joined_at ASC
      `
    ).all(sessionId, questionRow.id);
    const optionCountMap = /* @__PURE__ */ new Map();
    let correctCount = 0;
    let wrongCount = 0;
    let trueSelectedCount = 0;
    let falseSelectedCount = 0;
    const correctParticipantNames = [];
    for (const ans of answers) {
      if (ans.is_correct === 1) {
        correctCount += 1;
        correctParticipantNames.push(ans.participant_name);
      } else {
        wrongCount += 1;
      }
      if (ans.selected_option_id) {
        optionCountMap.set(
          ans.selected_option_id,
          (optionCountMap.get(ans.selected_option_id) ?? 0) + 1
        );
      }
      if (ans.selected_boolean === 1) trueSelectedCount += 1;
      if (ans.selected_boolean === 0) falseSelectedCount += 1;
    }
    const correctOpt = options.find((opt) => opt.is_correct === 1) ?? null;
    return {
      sessionQuestionId: questionRow.id,
      questionOrder: questionRow.question_order,
      type: questionRow.type,
      prompt: questionRow.prompt,
      imageUrl: mediaRelativePathToUrl(questionRow.image_path),
      points: questionRow.points,
      correctOptionId: questionRow.type === "multiple_choice" ? correctOpt?.id ?? null : null,
      correctBoolean: questionRow.type === "true_false" && questionRow.correct_boolean !== null ? questionRow.correct_boolean === 1 : null,
      options: options.map((opt) => ({
        id: opt.id,
        optionOrder: opt.option_order,
        optionText: opt.option_text,
        imageUrl: mediaRelativePathToUrl(opt.image_path),
        isCorrect: opt.is_correct === 1,
        selectionCount: optionCountMap.get(opt.id) ?? 0
      })),
      correctCount,
      wrongCount,
      unansweredCount: Math.max(0, totalParticipants - (correctCount + wrongCount)),
      trueSelectedCount,
      falseSelectedCount,
      correctParticipantNames
    };
  }
  async getTeacherSessionDetails(sessionId, options) {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    const participantRows = this.db.prepare(
      `
        SELECT * FROM live_session_participants
        WHERE session_id = ?
        ORDER BY COALESCE(rank_position, 999999) ASC, joined_at ASC
      `
    ).all(sessionId);
    const totalQuestions = row.question_count ?? 0;
    const nowMs = Date.now();
    const port = options?.port ?? Number(process.env.PORT ?? 3e3);
    const networkInfo = await resolveSessionNetworkOptions({
      pinCode: row.pin_code,
      port,
      requestOrigin: options?.requestOrigin
    });
    let currentQuestion = null;
    let answeredCount = 0;
    let questionResults = null;
    if (row.status === "running" && row.current_question_index >= 0 && (row.current_phase === "question_intro" || row.current_phase === "answering" || row.current_phase === "question_results")) {
      const qRow = this.getSessionQuestionByOrder(sessionId, row.current_question_index);
      if (qRow) {
        const optRows = this.getSessionQuestionOptions(qRow.id);
        currentQuestion = {
          id: qRow.id,
          questionOrder: qRow.question_order,
          type: qRow.type,
          prompt: qRow.prompt,
          imageUrl: mediaRelativePathToUrl(qRow.image_path),
          timeLimitSeconds: qRow.time_limit_seconds,
          points: qRow.points,
          options: optRows.map((opt) => ({
            id: opt.id,
            optionOrder: opt.option_order,
            optionText: opt.option_text,
            imageUrl: mediaRelativePathToUrl(opt.image_path)
          }))
        };
        const countRow = this.db.prepare(
          `SELECT COUNT(*) AS cnt FROM live_session_answers WHERE session_id = ? AND session_question_id = ?`
        ).get(sessionId, qRow.id);
        answeredCount = Number(countRow?.cnt ?? 0);
        if (row.current_phase === "question_results") {
          questionResults = this.buildTeacherQuestionResults(
            sessionId,
            qRow,
            participantRows.length
          );
        }
      }
    }
    const finalResults = row.status === "completed" || row.current_phase === "final_results" ? this.buildLeaderboard(participantRows, totalQuestions) : null;
    return {
      ...mapSessionSummaryRow(row, nowMs),
      hostToken: row.host_token,
      participants: participantRows.map((p) => mapParticipantRow(p, totalQuestions)),
      networkAddresses: networkInfo.networkAddresses,
      primaryJoinUrl: networkInfo.primaryJoinUrl,
      primaryQrDataUrl: networkInfo.primaryQrDataUrl,
      answeredCount,
      currentQuestion,
      questionResults,
      finalResults
    };
  }
  async listSessionsForTeacher(options) {
    const activeRow = this.db.prepare(
      `
        SELECT ls.id
        FROM live_sessions ls
        WHERE ls.status IN ('waiting', 'running')
        ORDER BY ls.created_at DESC
        LIMIT 1
      `
    ).get();
    const activeSession = activeRow ? await this.getTeacherSessionDetails(activeRow.id, options) : null;
    const recentRows = this.db.prepare(
      `
        SELECT
          ls.*,
          (SELECT COUNT(*) FROM live_session_questions lsq WHERE lsq.session_id = ls.id) AS question_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id) AS participant_count,
          (SELECT COUNT(*) FROM live_session_participants lsp WHERE lsp.session_id = ls.id AND lsp.connection_status = 'connected') AS connected_participant_count
        FROM live_sessions ls
        ORDER BY ls.created_at DESC
        LIMIT 15
      `
    ).all();
    const nowMs = Date.now();
    return {
      activeSession,
      recentSessions: recentRows.map((r) => mapSessionSummaryRow(r, nowMs))
    };
  }
  async createSession(quizId, options) {
    const cleanQuizId = typeof quizId === "string" ? quizId.trim() : "";
    if (!cleanQuizId) {
      throw new LiveSessionValidationError("\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
    }
    const validatedSettings = validateLiveSessionSettings(
      options?.settings,
      DEFAULT_LIVE_SESSION_SETTINGS
    );
    let quiz;
    try {
      quiz = this.quizRepo.getQuizById(cleanQuizId);
    } catch (error) {
      if (error instanceof QuizNotFoundError) {
        throw new LiveSessionNotFoundError("\u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A.");
      }
      throw error;
    }
    if (quiz.questions.length === 0) {
      throw new LiveSessionValidationError(
        "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0634\u063A\u064A\u0644 \u062C\u0644\u0633\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0644\u0627 \u062A\u062D\u062A\u0648\u064A \u0639\u0644\u0649 \u0623\u064A \u0623\u0633\u0626\u0644\u0629 \u0645\u062D\u0641\u0648\u0638\u0629."
      );
    }
    const existingForQuiz = this.db.prepare(
      `
        SELECT id, pin_code, status
        FROM live_sessions
        WHERE quiz_id = ? AND status IN ('waiting', 'running')
        LIMIT 1
      `
    ).get(cleanQuizId);
    if (existingForQuiz) {
      throw new LiveSessionConflictError(
        `\u062A\u0648\u062C\u062F \u062C\u0644\u0633\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0646\u0634\u0637\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0628\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 ${existingForQuiz.pin_code}.`,
        existingForQuiz.id
      );
    }
    const sessionId = import_node_crypto6.default.randomUUID();
    const pinCode = this.generateUniqueActivePin();
    const hostToken = import_node_crypto6.default.randomBytes(24).toString("hex");
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(
        `
          INSERT INTO live_sessions (
            id, quiz_id, quiz_title, quiz_subject, quiz_grade,
            pin_code, host_token, status, current_question_index,
            current_phase, phase_started_at, phase_ends_at,
            question_intro_seconds, advance_mode, auto_advance_seconds,
            allow_answer_change, allow_late_join, scoring_mode, full_screen_mode,
            question_started_at, created_at, started_at, ended_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', -1, 'lobby', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?)
        `
      ).run(
        sessionId,
        quiz.id,
        quiz.title,
        quiz.subject,
        quiz.grade,
        pinCode,
        hostToken,
        validatedSettings.questionIntroSeconds,
        validatedSettings.advanceMode,
        validatedSettings.autoAdvanceSeconds,
        validatedSettings.allowAnswerChange ? 1 : 0,
        validatedSettings.allowLateJoin ? 1 : 0,
        validatedSettings.scoringMode,
        validatedSettings.fullScreenMode ? 1 : 0,
        now,
        now
      );
      this.insertFrozenSessionQuestions(sessionId, quiz.questions);
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      const message = error instanceof Error ? error.message : "";
      if (message.includes("idx_live_sessions_active_quiz")) {
        const conflict = this.db.prepare(
          `SELECT id, pin_code FROM live_sessions WHERE quiz_id = ? AND status IN ('waiting', 'running') LIMIT 1`
        ).get(cleanQuizId);
        if (conflict) {
          throw new LiveSessionConflictError(
            `\u062A\u0648\u062C\u062F \u062C\u0644\u0633\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u0646\u0634\u0637\u0629 \u062D\u0627\u0644\u064A\u0627\u064B \u0644\u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0628\u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 ${conflict.pin_code}.`,
            conflict.id
          );
        }
      }
      throw error;
    }
    return this.getTeacherSessionDetails(sessionId, options);
  }
  async updateSessionSettings(sessionId, settingsInput, options) {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.", 403);
    }
    if (row.status !== "waiting") {
      throw new LiveSessionValidationError(
        "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0628\u0639\u062F \u0628\u062F\u0626\u0647\u0627 \u0623\u0648 \u0625\u0646\u0647\u0627\u0626\u0647\u0627.",
        409
      );
    }
    const nextSettings = validateLiveSessionSettings(settingsInput, mapSettingsFromRow(row));
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updateRes = this.db.prepare(
      `
        UPDATE live_sessions
        SET question_intro_seconds = ?,
            advance_mode = ?,
            auto_advance_seconds = ?,
            allow_answer_change = ?,
            allow_late_join = ?,
            scoring_mode = ?,
            full_screen_mode = ?,
            updated_at = ?
        WHERE id = ? AND status = 'waiting'
      `
    ).run(
      nextSettings.questionIntroSeconds,
      nextSettings.advanceMode,
      nextSettings.autoAdvanceSeconds,
      nextSettings.allowAnswerChange ? 1 : 0,
      nextSettings.allowLateJoin ? 1 : 0,
      nextSettings.scoringMode,
      nextSettings.fullScreenMode ? 1 : 0,
      now,
      sessionId
    );
    if (updateRes.changes !== 1) {
      throw new LiveSessionValidationError(
        "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0628\u0639\u062F \u0628\u062F\u0626\u0647\u0627.",
        409
      );
    }
    return this.getTeacherSessionDetails(sessionId, options);
  }
  async startSession(sessionId, options) {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0628\u062F\u0621 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.", 403);
    }
    if (row.status === "running") {
      return this.getTeacherSessionDetails(sessionId, options);
    }
    if (row.status !== "waiting") {
      throw new LiveSessionValidationError(
        "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0628\u062F\u0621 \u0627\u0644\u062C\u0644\u0633\u0629 \u0644\u0623\u0646\u0647\u0627 \u0645\u0646\u062A\u0647\u064A\u0629 \u0623\u0648 \u0645\u0644\u063A\u0627\u0629 \u0628\u0627\u0644\u0641\u0639\u0644.",
        409
      );
    }
    const settings = validateLiveSessionSettings(options?.settings, mapSettingsFromRow(row));
    const quiz = this.quizRepo.getQuizById(row.quiz_id);
    if (quiz.questions.length === 0) {
      throw new LiveSessionValidationError(
        "\u062A\u0639\u0630\u0631 \u0628\u062F\u0621 \u0627\u0644\u062C\u0644\u0633\u0629 \u0644\u0639\u062F\u0645 \u0648\u062C\u0648\u062F \u0623\u0633\u0626\u0644\u0629 \u0635\u0627\u0644\u062D\u0629 \u0641\u064A \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629."
      );
    }
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const introEndsIso = new Date(nowMs + settings.questionIntroSeconds * 1e3).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`DELETE FROM live_session_questions WHERE session_id = ?`).run(sessionId);
      this.insertFrozenSessionQuestions(sessionId, quiz.questions);
      const updateSessionRes = this.db.prepare(
        `
          UPDATE live_sessions
          SET quiz_title = ?,
              quiz_subject = ?,
              quiz_grade = ?,
              status = 'running',
              current_question_index = 0,
              current_phase = 'question_intro',
              phase_started_at = ?,
              phase_ends_at = ?,
              question_intro_seconds = ?,
              advance_mode = ?,
              auto_advance_seconds = ?,
              allow_answer_change = ?,
              allow_late_join = ?,
              scoring_mode = ?,
              full_screen_mode = ?,
              question_started_at = NULL,
              started_at = ?,
              updated_at = ?
          WHERE id = ? AND status = 'waiting'
        `
      ).run(
        quiz.title,
        quiz.subject,
        quiz.grade,
        nowIso,
        introEndsIso,
        settings.questionIntroSeconds,
        settings.advanceMode,
        settings.autoAdvanceSeconds,
        settings.allowAnswerChange ? 1 : 0,
        settings.allowLateJoin ? 1 : 0,
        settings.scoringMode,
        settings.fullScreenMode ? 1 : 0,
        nowIso,
        nowIso,
        sessionId
      );
      if (updateSessionRes.changes !== 1) {
        throw new LiveSessionValidationError("\u062A\u0639\u0630\u0631 \u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 \u0625\u0644\u0649 \u0642\u064A\u062F \u0627\u0644\u062A\u0634\u063A\u064A\u0644.", 409);
      }
      this.db.prepare(
        `
          UPDATE quizzes
          SET lifecycle_status = 'started', updated_at = ?
          WHERE id = ?
        `
      ).run(nowIso, row.quiz_id);
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
    return this.getTeacherSessionDetails(sessionId, options);
  }
  /**
   * الانتقال الذري من مرحلة عرض السؤال التمهيدي (question_intro) إلى مرحلة استقبال الإجابات (answering).
   */
  beginAnsweringPhase(sessionId, expectedQuestionIndex) {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.getSessionRowById(sessionId);
      if (!row || row.status !== "running" || row.current_phase !== "question_intro" || row.current_question_index !== expectedQuestionIndex) {
        this.db.exec("ROLLBACK");
        return false;
      }
      const qRow = this.getSessionQuestionByOrder(sessionId, expectedQuestionIndex);
      if (!qRow) {
        this.db.exec("ROLLBACK");
        return false;
      }
      const endsIso = new Date(nowMs + qRow.time_limit_seconds * 1e3).toISOString();
      const res = this.db.prepare(
        `
          UPDATE live_sessions
          SET current_phase = 'answering',
              phase_started_at = ?,
              phase_ends_at = ?,
              question_started_at = ?,
              updated_at = ?
          WHERE id = ?
            AND status = 'running'
            AND current_phase = 'question_intro'
            AND current_question_index = ?
        `
      ).run(nowIso, endsIso, nowIso, nowIso, sessionId, expectedQuestionIndex);
      this.db.exec("COMMIT");
      return res.changes === 1;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
  }
  /**
   * إغلاق استقبال الإجابات واحتساب نتائج السؤال وتحديث النقاط والترتيب ذرياً في SQLite.
   */
  finalizeCurrentQuestion(sessionId, expectedQuestionIndex) {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.getSessionRowById(sessionId);
      if (!row || row.status !== "running" || row.current_phase !== "answering" || row.current_question_index !== expectedQuestionIndex) {
        this.db.exec("ROLLBACK");
        return false;
      }
      const qRow = this.getSessionQuestionByOrder(sessionId, expectedQuestionIndex);
      if (!qRow) {
        this.db.exec("ROLLBACK");
        return false;
      }
      this.db.prepare(`UPDATE live_session_questions SET results_finalized = 1 WHERE id = ?`).run(qRow.id);
      this.recomputeSessionStandingsTx(sessionId);
      const nextEndsIso = row.advance_mode === "auto" ? new Date(nowMs + row.auto_advance_seconds * 1e3).toISOString() : null;
      const res = this.db.prepare(
        `
          UPDATE live_sessions
          SET current_phase = 'question_results',
              phase_started_at = ?,
              phase_ends_at = ?,
              updated_at = ?
          WHERE id = ?
            AND status = 'running'
            AND current_phase = 'answering'
            AND current_question_index = ?
        `
      ).run(nowIso, nextEndsIso, nowIso, sessionId, expectedQuestionIndex);
      this.db.exec("COMMIT");
      return res.changes === 1;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
  }
  /**
   * الانتقال من نتائج السؤال الحالي إلى السؤال التالي (question_intro) أو إلى النتائج النهائية (completed/final_results).
   */
  advanceFromResults(sessionId, expectedQuestionIndex) {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.getSessionRowById(sessionId);
      if (!row || row.status !== "running" || row.current_phase !== "question_results") {
        this.db.exec("ROLLBACK");
        return { transitioned: false, completed: false };
      }
      if (expectedQuestionIndex !== void 0 && row.current_question_index !== expectedQuestionIndex) {
        this.db.exec("ROLLBACK");
        return { transitioned: false, completed: false };
      }
      const totalQuestions = row.question_count ?? 0;
      const nextIndex = row.current_question_index + 1;
      if (nextIndex < totalQuestions) {
        const nextEndsIso = new Date(nowMs + row.question_intro_seconds * 1e3).toISOString();
        const res = this.db.prepare(
          `
            UPDATE live_sessions
            SET current_question_index = ?,
                current_phase = 'question_intro',
                phase_started_at = ?,
                phase_ends_at = ?,
                question_started_at = NULL,
                updated_at = ?
            WHERE id = ?
              AND status = 'running'
              AND current_phase = 'question_results'
              AND current_question_index = ?
          `
        ).run(nextIndex, nowIso, nextEndsIso, nowIso, sessionId, row.current_question_index);
        this.db.exec("COMMIT");
        return { transitioned: res.changes === 1, completed: false };
      }
      this.recomputeSessionStandingsTx(sessionId);
      const completeRes = this.db.prepare(
        `
          UPDATE live_sessions
          SET status = 'completed',
              current_phase = 'final_results',
              phase_started_at = ?,
              phase_ends_at = NULL,
              ended_at = ?,
              updated_at = ?
          WHERE id = ?
            AND status = 'running'
            AND current_phase = 'question_results'
            AND current_question_index = ?
        `
      ).run(nowIso, nowIso, nowIso, sessionId, row.current_question_index);
      this.db.prepare(`UPDATE quizzes SET lifecycle_status = 'completed', updated_at = ? WHERE id = ?`).run(nowIso, row.quiz_id);
      if (completeRes.changes === 1) {
        archiveCompletedSessionTx(this.db, sessionId);
      }
      this.db.exec("COMMIT");
      return { transitioned: completeRes.changes === 1, completed: completeRes.changes === 1 };
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
  }
  async nextQuestionByTeacher(sessionId, options) {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u062A\u062D\u0643\u0645 \u0641\u064A \u062A\u0642\u062F\u0645 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.", 403);
    }
    if (row.status !== "running") {
      throw new LiveSessionValidationError("\u0627\u0644\u062C\u0644\u0633\u0629 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u062D\u0627\u0644\u064A\u0627\u064B.", 409);
    }
    if (row.current_phase !== "question_results") {
      throw new LiveSessionValidationError(
        "\u064A\u0645\u0643\u0646 \u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0625\u0644\u0649 \u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u062A\u0627\u0644\u064A \u0641\u0642\u0637 \u0628\u0639\u062F \u0627\u0646\u062A\u0647\u0627\u0621 \u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u062D\u0627\u0644\u064A \u0648\u0639\u0631\u0636 \u0646\u062A\u0627\u0626\u062C\u0647.",
        409
      );
    }
    this.advanceFromResults(sessionId, row.current_question_index);
    return this.getTeacherSessionDetails(sessionId, options);
  }
  async completeSession(sessionId, options) {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0625\u0646\u0647\u0627\u0621 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.", 403);
    }
    if (row.status === "completed") {
      return this.getTeacherSessionDetails(sessionId, options);
    }
    if (row.status !== "running") {
      throw new LiveSessionValidationError("\u064A\u0645\u0643\u0646 \u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062C\u0644\u0633\u0629 \u0641\u0642\u0637 \u0628\u0639\u062F \u0628\u062F\u0626\u0647\u0627.", 409);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const freshRow = this.getSessionRowById(sessionId);
      if (freshRow && freshRow.current_question_index >= 0) {
        const currentQ = this.getSessionQuestionByOrder(
          sessionId,
          freshRow.current_question_index
        );
        if (currentQ && freshRow.current_phase === "answering") {
          this.db.prepare(`UPDATE live_session_questions SET results_finalized = 1 WHERE id = ?`).run(currentQ.id);
        }
      }
      this.recomputeSessionStandingsTx(sessionId);
      this.db.prepare(
        `
          UPDATE live_sessions
          SET status = 'completed',
              current_phase = 'final_results',
              phase_started_at = ?,
              phase_ends_at = NULL,
              ended_at = ?,
              updated_at = ?
          WHERE id = ? AND status = 'running'
        `
      ).run(now, now, now, sessionId);
      this.db.prepare(
        `
          UPDATE quizzes
          SET lifecycle_status = 'completed', updated_at = ?
          WHERE id = ?
        `
      ).run(now, row.quiz_id);
      archiveCompletedSessionTx(this.db, sessionId);
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
    return this.getTeacherSessionDetails(sessionId, options);
  }
  async cancelSession(sessionId, options) {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    if (options?.hostToken && !safeTokenEquals(row.host_token, options.hostToken)) {
      throw new LiveSessionValidationError("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0625\u0644\u063A\u0627\u0621 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.", 403);
    }
    if (row.status === "cancelled") {
      return this.getTeacherSessionDetails(sessionId, options);
    }
    if (row.status === "completed") {
      throw new LiveSessionValidationError("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u062C\u0644\u0633\u0629 \u0645\u0643\u062A\u0645\u0644\u0629 \u0628\u0627\u0644\u0641\u0639\u0644.", 409);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(
        `
          UPDATE live_sessions
          SET status = 'cancelled',
              phase_ends_at = NULL,
              ended_at = ?,
              updated_at = ?
          WHERE id = ? AND status IN ('waiting', 'running')
        `
      ).run(now, now, sessionId);
      if (row.started_at) {
        this.db.prepare(`UPDATE quizzes SET lifecycle_status = 'completed', updated_at = ? WHERE id = ?`).run(now, row.quiz_id);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
    return this.getTeacherSessionDetails(sessionId, options);
  }
  lookupPublicSessionByPin(rawPin) {
    const pinCode = normalizePinCode(rawPin);
    if (!/^\d{6}$/.test(pinCode)) {
      throw new LiveSessionValidationError("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 PIN \u0635\u062D\u064A\u062D \u0645\u0643\u0648\u0651\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645.");
    }
    const row = this.getSessionRowByPin(pinCode);
    if (!row) {
      throw new LiveSessionNotFoundError("\u0631\u0645\u0632 \u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0644\u0627 \u062A\u0648\u062C\u062F \u062C\u0644\u0633\u0629 \u0645\u0637\u0627\u0628\u0642\u0629.");
    }
    if (row.status === "completed") {
      throw new LiveSessionValidationError("\u0627\u0646\u062A\u0647\u062A \u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0648\u0644\u0645 \u064A\u0639\u062F \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0645\u062A\u0627\u062D\u0627\u064B.", 409);
    }
    if (row.status === "cancelled") {
      throw new LiveSessionValidationError("\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629 \u0645\u0646 \u0642\u0650\u0628\u0644 \u0627\u0644\u0645\u0639\u0644\u0645.", 409);
    }
    if (row.status === "running" && row.allow_late_join === 0) {
      throw new LiveSessionValidationError(
        "\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0644\u0623\u0646 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0642\u062F \u0628\u062F\u0623\u062A \u0628\u0627\u0644\u0641\u0639\u0644 \u0648\u0644\u0627 \u064A\u064F\u0633\u0645\u062D \u0628\u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0627\u0644\u0645\u062A\u0623\u062E\u0631.",
        409
      );
    }
    return mapToStudentPublicInfo(row);
  }
  getStudentPublicSessionById(sessionId) {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    return mapToStudentPublicInfo(row);
  }
  getStudentLiveState(sessionId, participantId) {
    const row = this.getSessionRowById(sessionId);
    if (!row) {
      throw new LiveSessionNotFoundError();
    }
    const participantRow = this.db.prepare(`SELECT * FROM live_session_participants WHERE id = ? AND session_id = ?`).get(participantId, sessionId);
    if (!participantRow) {
      throw new LiveSessionValidationError("\u0627\u0644\u0645\u0634\u0627\u0631\u0643 \u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.", 404);
    }
    const nowMs = Date.now();
    const totalQuestions = row.question_count ?? 0;
    const publicSession = mapToStudentPublicInfo(row, nowMs);
    const participantAnswered = (participantRow.correct_count ?? 0) + (participantRow.wrong_count ?? 0);
    let currentQuestion = null;
    let myAnswer = null;
    let questionResult = null;
    let finalSummary = null;
    if (row.status === "running" && row.current_question_index >= 0) {
      const qRow = this.getSessionQuestionByOrder(sessionId, row.current_question_index);
      if (qRow) {
        const answerRow = this.db.prepare(
          `SELECT * FROM live_session_answers WHERE session_question_id = ? AND participant_id = ? LIMIT 1`
        ).get(qRow.id, participantId);
        if (answerRow) {
          myAnswer = {
            sessionQuestionId: qRow.id,
            selectedOptionId: answerRow.selected_option_id,
            selectedBoolean: answerRow.selected_boolean === null ? null : answerRow.selected_boolean === 1,
            answeredAt: answerRow.answered_at
          };
        }
        if (row.current_phase === "question_intro") {
          currentQuestion = {
            id: qRow.id,
            questionOrder: qRow.question_order,
            type: qRow.type,
            prompt: qRow.prompt,
            imageUrl: mediaRelativePathToUrl(qRow.image_path),
            timeLimitSeconds: qRow.time_limit_seconds
          };
        } else if (row.current_phase === "answering") {
          const optRows = qRow.type === "multiple_choice" ? this.getSessionQuestionOptions(qRow.id) : [];
          currentQuestion = {
            id: qRow.id,
            questionOrder: qRow.question_order,
            type: qRow.type,
            prompt: qRow.prompt,
            imageUrl: mediaRelativePathToUrl(qRow.image_path),
            timeLimitSeconds: qRow.time_limit_seconds,
            options: optRows.map((opt) => ({
              id: opt.id,
              optionOrder: opt.option_order,
              optionText: opt.option_text,
              imageUrl: mediaRelativePathToUrl(opt.image_path)
            }))
          };
        } else if (row.current_phase === "question_results") {
          const optRows = qRow.type === "multiple_choice" ? this.getSessionQuestionOptions(qRow.id) : [];
          const correctOpt = optRows.find((opt) => opt.is_correct === 1) ?? null;
          const joinedMidResult = !answerRow && Boolean(row.phase_started_at) && participantRow.joined_at >= row.phase_started_at;
          questionResult = {
            sessionQuestionId: qRow.id,
            questionOrder: qRow.question_order,
            type: qRow.type,
            prompt: qRow.prompt,
            imageUrl: mediaRelativePathToUrl(qRow.image_path),
            points: qRow.points,
            correctOptionId: qRow.type === "multiple_choice" ? correctOpt?.id ?? null : null,
            correctBoolean: qRow.type === "true_false" && qRow.correct_boolean !== null ? qRow.correct_boolean === 1 : null,
            options: optRows.map((opt) => ({
              id: opt.id,
              optionOrder: opt.option_order,
              optionText: opt.option_text,
              imageUrl: mediaRelativePathToUrl(opt.image_path),
              isCorrect: opt.is_correct === 1
            })),
            myResult: {
              answered: Boolean(answerRow),
              selectedOptionId: answerRow?.selected_option_id ?? null,
              selectedBoolean: answerRow && answerRow.selected_boolean !== null ? answerRow.selected_boolean === 1 : null,
              isCorrect: answerRow ? answerRow.is_correct === 1 : false,
              responseTimeMs: answerRow?.response_time_ms ?? null,
              pointsAwarded: answerRow?.points_awarded ?? 0
            },
            joinedMidResult
          };
        }
      }
    }
    if (row.status === "completed" || row.current_phase === "final_results") {
      const allParticipants = this.db.prepare(`SELECT * FROM live_session_participants WHERE session_id = ?`).all(sessionId);
      const leaderboard = this.buildLeaderboard(allParticipants, totalQuestions);
      const mySummary = leaderboard.find((e) => e.participantId === participantId) ?? null;
      finalSummary = {
        mySummary,
        leaderboard
      };
    }
    return {
      session: publicSession,
      participant: {
        id: participantRow.id,
        sessionId: participantRow.session_id,
        displayName: participantRow.display_name,
        avatarId: participantRow.avatar_id ?? "avatar_cat",
        connectionStatus: participantRow.connection_status,
        totalScore: participantRow.total_score ?? 0,
        correctCount: participantRow.correct_count ?? 0,
        wrongCount: participantRow.wrong_count ?? 0,
        unansweredCount: Math.max(0, totalQuestions - participantAnswered),
        rankPosition: participantRow.rank_position,
        joinedAt: participantRow.joined_at
      },
      currentQuestion,
      myAnswer,
      questionResult,
      finalSummary
    };
  }
  submitStudentAnswer(input) {
    if (!input || typeof input !== "object") {
      throw new LiveSessionValidationError("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0627\u0644\u0645\u0631\u0633\u0644\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
    }
    const sessionId = typeof input.sessionId === "string" ? input.sessionId.trim() : "";
    const participantId = typeof input.participantId === "string" ? input.participantId.trim() : "";
    const reconnectToken = typeof input.reconnectToken === "string" ? input.reconnectToken.trim() : "";
    const sessionQuestionId = typeof input.sessionQuestionId === "string" ? input.sessionQuestionId.trim() : "";
    if (!sessionQuestionId) {
      throw new LiveSessionValidationError("\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0633\u0624\u0627\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.");
    }
    this.verifyParticipantAuth({ sessionId, participantId, reconnectToken });
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.getSessionRowById(sessionId);
      if (!row) {
        throw new LiveSessionNotFoundError();
      }
      if (row.status !== "running") {
        throw new LiveSessionValidationError("\u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u062D\u0627\u0644\u064A\u0627\u064B.", 409);
      }
      if (row.current_phase === "question_intro") {
        throw new LiveSessionValidationError(
          "\u0644\u0645 \u064A\u0628\u062F\u0623 \u0648\u0642\u062A \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0628\u0639\u062F\u061B \u064A\u0631\u062C\u0649 \u0627\u0646\u062A\u0638\u0627\u0631 \u0638\u0647\u0648\u0631 \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631\u0627\u062A.",
          409
        );
      }
      if (row.current_phase !== "answering") {
        throw new LiveSessionValidationError("\u0627\u0646\u062A\u0647\u0649 \u0648\u0642\u062A \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0633\u0624\u0627\u0644.", 409);
      }
      const phaseEndsAtMs = row.phase_ends_at ? Date.parse(row.phase_ends_at) : NaN;
      if (!Number.isFinite(phaseEndsAtMs) || nowMs > phaseEndsAtMs) {
        throw new LiveSessionValidationError("\u0627\u0646\u062A\u0647\u0649 \u0648\u0642\u062A \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0633\u0624\u0627\u0644.", 409);
      }
      const currentQuestion = this.getSessionQuestionByOrder(
        sessionId,
        row.current_question_index
      );
      if (!currentQuestion || currentQuestion.id !== sessionQuestionId) {
        throw new LiveSessionValidationError(
          "\u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u0645\u0631\u0633\u0644 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0633\u0624\u0627\u0644 \u0627\u0644\u0646\u0634\u0637 \u062D\u0627\u0644\u064A\u0627\u064B \u0641\u064A \u0627\u0644\u062C\u0644\u0633\u0629.",
          409
        );
      }
      const existingAnswer = this.db.prepare(
        `SELECT * FROM live_session_answers WHERE session_question_id = ? AND participant_id = ? LIMIT 1`
      ).get(currentQuestion.id, participantId);
      if (existingAnswer && row.allow_answer_change === 0) {
        throw new LiveSessionValidationError(
          "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0625\u062C\u0627\u0628\u062A\u0643 \u0628\u0627\u0644\u0641\u0639\u0644 \u0648\u0644\u0627 \u064A\u064F\u0633\u0645\u062D \u0628\u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0625\u062C\u0627\u0628\u0629 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629.",
          409
        );
      }
      let selectedOptionId = null;
      let selectedBooleanInt = null;
      let isCorrect = false;
      if (currentQuestion.type === "multiple_choice") {
        const rawOptId = typeof input.selectedOptionId === "string" ? input.selectedOptionId.trim() : "";
        if (!rawOptId) {
          throw new LiveSessionValidationError("\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0625\u062D\u062F\u0649 \u0627\u0644\u0625\u062C\u0627\u0628\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062D\u0629.");
        }
        const matchedOption = this.db.prepare(
          `SELECT * FROM live_session_question_options WHERE id = ? AND session_question_id = ? LIMIT 1`
        ).get(rawOptId, currentQuestion.id);
        if (!matchedOption) {
          throw new LiveSessionValidationError("\u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0645\u062D\u062F\u062F \u0644\u0627 \u064A\u062A\u0628\u0639 \u0644\u0647\u0630\u0627 \u0627\u0644\u0633\u0624\u0627\u0644.");
        }
        selectedOptionId = matchedOption.id;
        isCorrect = matchedOption.is_correct === 1;
      } else {
        if (typeof input.selectedBoolean !== "boolean") {
          throw new LiveSessionValidationError("\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \xAB\u0635\u062D\xBB \u0623\u0648 \xAB\u062E\u0637\u0623\xBB.");
        }
        selectedBooleanInt = input.selectedBoolean ? 1 : 0;
        isCorrect = currentQuestion.correct_boolean !== null && currentQuestion.correct_boolean === 1 === input.selectedBoolean;
      }
      const startedAtIso = row.question_started_at ?? row.phase_started_at ?? nowIso;
      const startedAtMs = Date.parse(startedAtIso);
      const totalTimeMs = currentQuestion.time_limit_seconds * 1e3;
      const rawElapsed = Number.isFinite(startedAtMs) ? Math.max(0, nowMs - startedAtMs) : 0;
      const responseTimeMs = Math.min(totalTimeMs, rawElapsed);
      let pointsAwarded = 0;
      if (isCorrect) {
        if (row.scoring_mode === "accuracy_only") {
          pointsAwarded = 1e3;
        } else {
          const remainingMs = Math.max(0, totalTimeMs - responseTimeMs);
          pointsAwarded = Math.round(1e3 * (remainingMs / totalTimeMs));
        }
      }
      if (existingAnswer) {
        this.db.prepare(
          `
            UPDATE live_session_answers
            SET selected_option_id = ?,
                selected_boolean = ?,
                is_correct = ?,
                response_time_ms = ?,
                points_awarded = ?,
                answered_at = ?
            WHERE id = ?
          `
        ).run(
          selectedOptionId,
          selectedBooleanInt,
          isCorrect ? 1 : 0,
          responseTimeMs,
          pointsAwarded,
          nowIso,
          existingAnswer.id
        );
      } else {
        this.db.prepare(
          `
            INSERT INTO live_session_answers (
              id, session_id, session_question_id, participant_id,
              selected_option_id, selected_boolean, is_correct,
              response_time_ms, points_awarded, answered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        ).run(
          import_node_crypto6.default.randomUUID(),
          sessionId,
          currentQuestion.id,
          participantId,
          selectedOptionId,
          selectedBooleanInt,
          isCorrect ? 1 : 0,
          responseTimeMs,
          pointsAwarded,
          nowIso
        );
      }
      this.db.prepare(`UPDATE live_session_participants SET last_seen_at = ? WHERE id = ?`).run(nowIso, participantId);
      this.db.exec("COMMIT");
      return {
        received: true,
        updated: Boolean(existingAnswer),
        answer: {
          sessionQuestionId: currentQuestion.id,
          selectedOptionId,
          selectedBoolean: selectedBooleanInt === null ? null : selectedBooleanInt === 1,
          answeredAt: nowIso
        }
      };
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      throw error;
    }
  }
  joinSession(input) {
    if (!input || typeof input !== "object") {
      throw new LiveSessionValidationError("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629.");
    }
    const pinCode = normalizePinCode(input.pinCode);
    if (!/^\d{6}$/.test(pinCode)) {
      throw new LiveSessionValidationError("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 PIN \u0635\u062D\u064A\u062D \u0645\u0643\u0648\u0651\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645.");
    }
    const displayName = cleanParticipantDisplayName(input.displayName);
    if (displayName.length < MIN_PARTICIPANT_NAME_LENGTH) {
      throw new LiveSessionValidationError(
        `\u064A\u0631\u062C\u0649 \u0643\u062A\u0627\u0628\u0629 \u0627\u0633\u0645 \u0627\u0644\u0637\u0627\u0644\u0628 (${MIN_PARTICIPANT_NAME_LENGTH} \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644).`
      );
    }
    if (displayName.length > MAX_PARTICIPANT_NAME_LENGTH) {
      throw new LiveSessionValidationError(
        `\u0627\u0633\u0645 \u0627\u0644\u0637\u0627\u0644\u0628 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 (${MAX_PARTICIPANT_NAME_LENGTH} \u062D\u0631\u0641\u0627\u064B).`
      );
    }
    const normalizedName = normalizeParticipantName(displayName);
    if (!normalizedName) {
      throw new LiveSessionValidationError("\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0648\u0627\u0636\u062D \u0644\u0644\u0637\u0627\u0644\u0628.");
    }
    const row = this.getSessionRowByPin(pinCode);
    if (!row) {
      throw new LiveSessionNotFoundError("\u0631\u0645\u0632 \u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u062A\u0647.");
    }
    if (row.status === "cancelled") {
      throw new LiveSessionValidationError("\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0625\u0644\u064A\u0647\u0627.", 409);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existingParticipantId = typeof input.existingParticipantId === "string" ? input.existingParticipantId.trim() : "";
    const suppliedReconnectToken = typeof input.reconnectToken === "string" ? input.reconnectToken.trim() : "";
    if (existingParticipantId) {
      const existingById = this.db.prepare(`SELECT * FROM live_session_participants WHERE id = ?`).get(existingParticipantId);
      if (existingById) {
        if (existingById.session_id !== row.id) {
          throw new LiveSessionValidationError(
            "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0634\u0627\u0631\u0643 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0627 \u064A\u062A\u0628\u0639 \u0644\u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.",
            403
          );
        }
        if (suppliedReconnectToken && safeTokenEquals(existingById.reconnect_token, suppliedReconnectToken)) {
          this.db.prepare(
            `
              UPDATE live_session_participants
              SET connection_status = 'connected', last_seen_at = ?, disconnected_at = NULL
              WHERE id = ?
            `
          ).run(now, existingById.id);
          const liveState2 = this.getStudentLiveState(row.id, existingById.id);
          return {
            session: liveState2.session,
            participant: liveState2.participant,
            reconnectToken: existingById.reconnect_token,
            reconnected: true,
            liveState: liveState2
          };
        }
      }
    }
    if (row.status === "completed") {
      throw new LiveSessionValidationError("\u0627\u0646\u062A\u0647\u062A \u0647\u0630\u0647 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0625\u0644\u064A\u0647\u0627.", 409);
    }
    if (row.status === "running" && row.allow_late_join === 0) {
      throw new LiveSessionValidationError(
        "\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0644\u0623\u0646 \u0627\u0644\u0645\u0633\u0627\u0628\u0642\u0629 \u0642\u062F \u0628\u062F\u0623\u062A \u0628\u0627\u0644\u0641\u0639\u0644 \u0648\u0644\u0627 \u064A\u064F\u0633\u0645\u062D \u0628\u0627\u0644\u0627\u0646\u0636\u0645\u0627\u0645 \u0627\u0644\u0645\u062A\u0623\u062E\u0631.",
        409
      );
    }
    const duplicate = this.db.prepare(
      `
        SELECT id FROM live_session_participants
        WHERE session_id = ? AND normalized_name = ?
        LIMIT 1
      `
    ).get(row.id, normalizedName);
    if (duplicate) {
      throw new LiveSessionValidationError(
        "\u064A\u0648\u062C\u062F \u0637\u0627\u0644\u0628 \u0645\u0646\u0636\u0645 \u0628\u0647\u0630\u0627 \u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629. \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0633\u0645 \u0645\u062E\u062A\u0644\u0641 \u0623\u0648 \u0625\u0636\u0627\u0641\u0629 \u0627\u0633\u0645 \u0627\u0644\u0639\u0627\u0626\u0644\u0629.",
        409
      );
    }
    const VALID_AVATAR_IDS = /* @__PURE__ */ new Set([
      "avatar_cat",
      "avatar_robot",
      "avatar_fox",
      "avatar_bear",
      "avatar_penguin",
      "avatar_lion",
      "avatar_owl",
      "avatar_alien",
      "avatar_koala",
      "avatar_panda",
      "avatar_tiger",
      "avatar_bunny"
    ]);
    const requestedAvatarId = typeof input.avatarId === "string" ? input.avatarId.trim() : "";
    const avatarId = VALID_AVATAR_IDS.has(requestedAvatarId) ? requestedAvatarId : "avatar_cat";
    const participantId = import_node_crypto6.default.randomUUID();
    const reconnectToken = import_node_crypto6.default.randomBytes(24).toString("hex");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(
        `
          INSERT INTO live_session_participants (
            id, session_id, display_name, normalized_name, reconnect_token,
            connection_status, total_score, correct_count, wrong_count,
            total_response_time_ms, rank_position,
            joined_at, last_seen_at, disconnected_at, avatar_id
          ) VALUES (?, ?, ?, ?, ?, 'connected', 0, 0, 0, 0, NULL, ?, ?, NULL, ?)
        `
      ).run(
        participantId,
        row.id,
        displayName,
        normalizedName,
        reconnectToken,
        now,
        now,
        avatarId
      );
      this.db.exec("COMMIT");
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
      }
      const message = error instanceof Error ? error.message : "";
      if (message.includes("UNIQUE constraint failed")) {
        throw new LiveSessionValidationError(
          "\u064A\u0648\u062C\u062F \u0637\u0627\u0644\u0628 \u0645\u0646\u0636\u0645 \u0628\u0647\u0630\u0627 \u0627\u0644\u0627\u0633\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.",
          409
        );
      }
      throw error;
    }
    const liveState = this.getStudentLiveState(row.id, participantId);
    return {
      session: liveState.session,
      participant: liveState.participant,
      reconnectToken,
      reconnected: false,
      liveState
    };
  }
  verifyParticipantAuth(options) {
    const cleanSessionId = typeof options.sessionId === "string" ? options.sessionId.trim() : "";
    const cleanParticipantId = typeof options.participantId === "string" ? options.participantId.trim() : "";
    const cleanToken = typeof options.reconnectToken === "string" ? options.reconnectToken.trim() : "";
    if (!cleanSessionId || !cleanParticipantId || !cleanToken) {
      throw new LiveSessionValidationError("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0634\u0627\u0631\u0643 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629.", 401);
    }
    const sessionRow = this.getSessionRowById(cleanSessionId);
    if (!sessionRow) {
      throw new LiveSessionNotFoundError();
    }
    const participantRow = this.db.prepare(`SELECT * FROM live_session_participants WHERE id = ?`).get(cleanParticipantId);
    if (!participantRow) {
      throw new LiveSessionValidationError("\u0627\u0644\u0645\u0634\u0627\u0631\u0643 \u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.", 404);
    }
    if (participantRow.session_id !== cleanSessionId) {
      throw new LiveSessionValidationError(
        "\u0645\u0631\u0641\u0648\u0636: \u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u0634\u0627\u0631\u0643 \u0644\u0627 \u064A\u0646\u062A\u0645\u064A \u0625\u0644\u0649 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629.",
        403
      );
    }
    if (!safeTokenEquals(participantRow.reconnect_token, cleanToken)) {
      throw new LiveSessionValidationError("\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u062E\u0627\u0635 \u0628\u0627\u0644\u0645\u0634\u0627\u0631\u0643 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D.", 403);
    }
    const totalQuestions = sessionRow.question_count ?? 0;
    return {
      session: mapToStudentPublicInfo(sessionRow),
      participant: mapParticipantRow(participantRow, totalQuestions)
    };
  }
  verifyTeacherHostToken(sessionId, hostToken) {
    const cleanSessionId = typeof sessionId === "string" ? sessionId.trim() : "";
    const cleanHostToken = typeof hostToken === "string" ? hostToken.trim() : "";
    if (!cleanSessionId || !cleanHostToken) return false;
    const row = this.db.prepare(`SELECT host_token FROM live_sessions WHERE id = ?`).get(cleanSessionId);
    if (!row) return false;
    return safeTokenEquals(row.host_token, cleanHostToken);
  }
  setParticipantConnectionStatus(sessionId, participantId, status) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const res = this.db.prepare(
      `
        UPDATE live_session_participants
        SET connection_status = ?,
            last_seen_at = ?,
            disconnected_at = CASE WHEN ? = 'disconnected' THEN ? ELSE NULL END
        WHERE id = ? AND session_id = ?
      `
    ).run(status, now, status, now, participantId, sessionId);
    if (res.changes === 0) return null;
    const sessionRow = this.getSessionRowById(sessionId);
    const totalQuestions = sessionRow?.question_count ?? 0;
    const row = this.db.prepare(`SELECT * FROM live_session_participants WHERE id = ? AND session_id = ?`).get(participantId, sessionId);
    return row ? mapParticipantRow(row, totalQuestions) : null;
  }
  markAllParticipantsDisconnectedOnBoot() {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    this.db.prepare(
      `
        UPDATE live_session_participants
        SET connection_status = 'disconnected',
            disconnected_at = COALESCE(disconnected_at, ?)
        WHERE connection_status = 'connected'
          AND session_id IN (SELECT id FROM live_sessions WHERE status IN ('waiting', 'running'))
      `
    ).run(now);
  }
  listRunningSessionStatesForRecovery() {
    const rows = this.db.prepare(
      `
        SELECT id, current_phase, current_question_index, phase_ends_at, advance_mode
        FROM live_sessions
        WHERE status = 'running'
      `
    ).all();
    return rows.map((row) => ({
      id: row.id,
      currentPhase: row.current_phase,
      currentQuestionIndex: row.current_question_index,
      phaseEndsAt: row.phase_ends_at,
      advanceMode: row.advance_mode
    }));
  }
};

// server/routes/liveSessionRoutes.ts
function resolveRequestOrigin(req) {
  const host = req.headers.host;
  if (!host) return null;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = typeof forwardedProto === "string" && forwardedProto.trim() ? forwardedProto.split(",")[0].trim() : req.protocol || "http";
  return `${proto}://${host}`;
}
function resolveRequestPort(req) {
  const localPort = req.socket?.localPort;
  if (typeof localPort === "number" && localPort > 0) {
    return localPort;
  }
  return Number(process.env.PORT ?? 3e3);
}
function createLiveSessionRouter(db, storagePaths, liveSocketHub) {
  const router = import_express2.default.Router();
  const repository = new SqliteLiveSessionRepository(db, storagePaths);
  router.get("/live-sessions/lookup", (req, res, next) => {
    try {
      const info = repository.lookupPublicSessionByPin(req.query.pin);
      res.json({ session: info });
    } catch (error) {
      next(error);
    }
  });
  router.post("/live-sessions/join", async (req, res, next) => {
    try {
      const result = repository.joinSession(req.body);
      await liveSocketHub.broadcastTeacherSessionUpdate(
        result.session.sessionId,
        resolveRequestOrigin(req)
      );
      res.status(result.reconnected ? 200 : 201).json(result);
    } catch (error) {
      next(error);
    }
  });
  router.get(
    "/live-sessions/:id/student-state",
    (req, res, next) => {
      try {
        const sessionId = String(req.params.id);
        const participantId = typeof req.query.participantId === "string" ? req.query.participantId : "";
        const reconnectToken = typeof req.query.reconnectToken === "string" ? req.query.reconnectToken : typeof req.headers["x-reconnect-token"] === "string" ? req.headers["x-reconnect-token"] : "";
        repository.verifyParticipantAuth({
          sessionId,
          participantId,
          reconnectToken
        });
        const state = repository.getStudentLiveState(sessionId, participantId);
        res.json(state);
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    "/live-sessions/:id/answer",
    async (req, res, next) => {
      try {
        const sessionId = String(req.params.id);
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const result = repository.submitStudentAnswer({
          sessionId,
          participantId: typeof body.participantId === "string" ? body.participantId : "",
          reconnectToken: typeof body.reconnectToken === "string" ? body.reconnectToken : "",
          sessionQuestionId: typeof body.sessionQuestionId === "string" ? body.sessionQuestionId : "",
          selectedOptionId: typeof body.selectedOptionId === "string" ? body.selectedOptionId : null,
          selectedBoolean: typeof body.selectedBoolean === "boolean" ? body.selectedBoolean : null
        });
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );
  router.get(
    "/live-sessions",
    localAdminGuard,
    async (req, res, next) => {
      try {
        const result = await repository.listSessionsForTeacher({
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req)
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    "/live-sessions",
    localAdminGuard,
    async (req, res, next) => {
      try {
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const session = await repository.createSession(body.quizId ?? "", {
          settings: body.settings,
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req)
        });
        res.status(201).json(session);
      } catch (error) {
        if (error instanceof LiveSessionConflictError) {
          try {
            const existingSession = await repository.getTeacherSessionDetails(
              error.existingSessionId,
              {
                port: resolveRequestPort(req),
                requestOrigin: resolveRequestOrigin(req)
              }
            );
            res.status(409).json({
              error: error.message,
              code: error.code,
              existingSession
            });
            return;
          } catch (innerErr) {
            next(innerErr);
            return;
          }
        }
        next(error);
      }
    }
  );
  router.get(
    "/live-sessions/:id",
    localAdminGuard,
    async (req, res, next) => {
      try {
        const session = await repository.getTeacherSessionDetails(String(req.params.id), {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req)
        });
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );
  router.put(
    "/live-sessions/:id/settings",
    localAdminGuard,
    async (req, res, next) => {
      try {
        const sessionId = String(req.params.id);
        const session = await repository.updateSessionSettings(sessionId, req.body, {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req)
        });
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    "/live-sessions/:id/start",
    localAdminGuard,
    async (req, res, next) => {
      try {
        const sessionId = String(req.params.id);
        const body = req.body && typeof req.body === "object" ? req.body : {};
        const session = await repository.startSession(sessionId, {
          settings: body.settings,
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req)
        });
        liveSocketHub.syncSessionSchedule(sessionId);
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    "/live-sessions/:id/next-question",
    localAdminGuard,
    async (req, res, next) => {
      try {
        const sessionId = String(req.params.id);
        const session = await repository.nextQuestionByTeacher(sessionId, {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req)
        });
        liveSocketHub.syncSessionSchedule(sessionId);
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    "/live-sessions/:id/complete",
    localAdminGuard,
    async (req, res, next) => {
      try {
        const sessionId = String(req.params.id);
        const session = await repository.completeSession(sessionId, {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req)
        });
        liveSocketHub.syncSessionSchedule(sessionId);
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );
  router.post(
    "/live-sessions/:id/cancel",
    localAdminGuard,
    async (req, res, next) => {
      try {
        const sessionId = String(req.params.id);
        const session = await repository.cancelSession(sessionId, {
          port: resolveRequestPort(req),
          requestOrigin: resolveRequestOrigin(req)
        });
        liveSocketHub.syncSessionSchedule(sessionId);
        await liveSocketHub.broadcastTeacherSessionUpdate(sessionId, resolveRequestOrigin(req));
        await liveSocketHub.broadcastStudentSessionStatus(sessionId);
        res.json(session);
      } catch (error) {
        next(error);
      }
    }
  );
  router.use((error, _req, res, next) => {
    if (error instanceof LiveSessionValidationError || error instanceof LiveSessionNotFoundError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  });
  return router;
}

// server/routes/questionBankRoutes.ts
var import_express3 = __toESM(require("express"), 1);
var import_multer = __toESM(require("multer"), 1);
function createQuestionBankRouter(db, storagePaths) {
  const router = import_express3.default.Router();
  const repository = new SqliteQuestionBankRepository(db, storagePaths);
  const quizRepository = new SqliteQuizRepository(db, storagePaths);
  const upload = (0, import_multer.default)({
    storage: import_multer.default.memoryStorage(),
    limits: {
      fileSize: MAX_IMAGE_SIZE_BYTES,
      files: 1
    }
  });
  router.use("/questions", localAdminGuard);
  router.get("/questions/stats", (_req, res, next) => {
    try {
      const stats = repository.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });
  router.get("/questions", (req, res, next) => {
    try {
      const typeParam = typeof req.query.type === "string" ? req.query.type : void 0;
      const difficultyParam = typeof req.query.difficulty === "string" ? req.query.difficulty : void 0;
      const filters = {
        search: typeof req.query.search === "string" ? req.query.search : void 0,
        type: typeParam === "multiple_choice" || typeParam === "true_false" ? typeParam : "all",
        subject: typeof req.query.subject === "string" ? req.query.subject : void 0,
        grade: typeof req.query.grade === "string" ? req.query.grade : void 0,
        topic: typeof req.query.topic === "string" ? req.query.topic : void 0,
        difficulty: difficultyParam === "easy" || difficultyParam === "medium" || difficultyParam === "hard" ? difficultyParam : "all"
      };
      const result = repository.listQuestions(filters);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  router.get("/questions/:id", (req, res, next) => {
    try {
      const question = repository.getQuestionById(String(req.params.id));
      res.json(question);
    } catch (error) {
      next(error);
    }
  });
  router.get("/questions/:id/linked-quizzes", (req, res, next) => {
    try {
      const questionId = String(req.params.id);
      repository.getQuestionById(questionId);
      const summary = quizRepository.getLinkedQuizSummaryForQuestion(questionId);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  });
  router.post("/questions", (req, res, next) => {
    try {
      const created = repository.createQuestion(req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });
  router.put("/questions/:id", (req, res, next) => {
    try {
      const updated = repository.updateQuestion(String(req.params.id), req.body);
      const linkedQuizSummary = quizRepository.getLinkedQuizSummaryForQuestion(updated.id);
      res.json({
        ...updated,
        linkedQuizSummary
      });
    } catch (error) {
      next(error);
    }
  });
  router.post("/questions/:id/sync-quizzes", (req, res, next) => {
    try {
      const result = quizRepository.syncQuestionToLinkedQuizzes(String(req.params.id));
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  router.delete("/questions/:id", (req, res, next) => {
    try {
      repository.deleteQuestion(String(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.post(
    "/media/upload",
    localAdminGuard,
    (req, res, next) => {
      upload.single("image")(req, res, (err) => {
        if (err instanceof import_multer.default.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            next(
              new MediaValidationError(
                "\u062D\u062C\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 (5 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A).",
                413
              )
            );
            return;
          }
          next(new MediaValidationError("\u062A\u0639\u0630\u0631 \u0645\u0639\u0627\u0644\u062C\u0629 \u0645\u0644\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0631\u0641\u0648\u0639."));
          return;
        }
        if (err) {
          next(err);
          return;
        }
        next();
      });
    },
    (req, res, next) => {
      try {
        if (!req.file) {
          throw new MediaValidationError("\u0644\u0645 \u064A\u062A\u0645 \u0625\u0631\u0641\u0627\u0642 \u0623\u064A \u0645\u0644\u0641 \u0635\u0648\u0631\u0629.");
        }
        const saved = saveUploadedQuestionImage(
          req.file.buffer,
          req.file.mimetype,
          storagePaths
        );
        res.status(201).json(saved);
      } catch (error) {
        next(error);
      }
    }
  );
  router.delete("/media", localAdminGuard, (req, res, next) => {
    try {
      const imagePath = typeof req.body?.imagePath === "string" ? req.body.imagePath : typeof req.query.imagePath === "string" ? req.query.imagePath : null;
      if (!imagePath) {
        throw new MediaValidationError("\u0645\u0633\u0627\u0631 \u0627\u0644\u0635\u0648\u0631\u0629 \u0645\u0637\u0644\u0648\u0628.");
      }
      const normalized = normalizeMediaRelativePath(imagePath);
      if (normalized) {
        deleteMediaFilesIfUnreferenced(db, storagePaths, [normalized]);
      }
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.get("/media/questions/:filename", (req, res) => {
    const filePath = resolveSafeQuestionMediaFile(
      String(req.params.filename),
      storagePaths
    );
    if (!filePath) {
      res.status(404).json({ error: "\u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(filePath);
  });
  router.use((error, _req, res, _next) => {
    if (error instanceof QuestionValidationError || error instanceof QuestionNotFoundError || error instanceof QuizValidationError || error instanceof QuizNotFoundError || error instanceof MediaValidationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error("[QuizClass API Error]", error);
    res.status(500).json({
      error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0639\u0627\u0645\u0644 \u0645\u0639 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062D\u0644\u064A\u0629."
    });
  });
  return router;
}

// server/routes/quizRoutes.ts
var import_express4 = __toESM(require("express"), 1);
function createQuizRouter(db, storagePaths) {
  const router = import_express4.default.Router();
  const repository = new SqliteQuizRepository(db, storagePaths);
  router.use("/quizzes", localAdminGuard);
  router.get("/quizzes/stats", (_req, res, next) => {
    try {
      const stats = repository.getStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });
  router.post("/quizzes/random-preview", (req, res, next) => {
    try {
      const result = repository.previewOrDrawRandom(req.body ?? {});
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  router.get("/quizzes", (_req, res, next) => {
    try {
      const result = repository.listQuizzes();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  router.get("/quizzes/:id", (req, res, next) => {
    try {
      const quiz = repository.getQuizById(String(req.params.id));
      res.json(quiz);
    } catch (error) {
      next(error);
    }
  });
  router.post("/quizzes", (req, res, next) => {
    try {
      const created = repository.createQuiz(req.body);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  });
  router.put("/quizzes/:id", (req, res, next) => {
    try {
      const updated = repository.updateQuiz(String(req.params.id), req.body);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  });
  router.delete("/quizzes/:id", (req, res, next) => {
    try {
      repository.deleteQuiz(String(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });
  router.get("/media/quizzes/:filename", (req, res) => {
    const filePath = resolveSafeQuizMediaFile(String(req.params.filename), storagePaths);
    if (!filePath) {
      res.status(404).json({ error: "\u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
      return;
    }
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(filePath);
  });
  router.use((error, _req, res, next) => {
    if (error instanceof QuizValidationError || error instanceof QuizNotFoundError || error instanceof MediaValidationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  });
  return router;
}

// server/routes/resultsArchiveRoutes.ts
var import_express5 = __toESM(require("express"), 1);
function createResultsArchiveRouter(db) {
  const router = import_express5.default.Router();
  const repository = new SqliteResultsArchiveRepository(db);
  router.use("/results", localAdminGuard);
  router.get("/results", (req, res, next) => {
    try {
      const sortParam = typeof req.query.sort === "string" ? req.query.sort : void 0;
      const result = repository.listArchivedResults({
        search: typeof req.query.search === "string" ? req.query.search : void 0,
        date: typeof req.query.date === "string" ? req.query.date : void 0,
        dateFrom: typeof req.query.dateFrom === "string" ? req.query.dateFrom : void 0,
        dateTo: typeof req.query.dateTo === "string" ? req.query.dateTo : void 0,
        sort: sortParam === "oldest" ? "oldest" : "newest"
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  router.get("/results/:archiveId", (req, res, next) => {
    try {
      const details = repository.getArchivedResultById(String(req.params.archiveId));
      res.json(details);
    } catch (error) {
      next(error);
    }
  });
  router.get(
    "/results/:archiveId/participants/:participantId",
    (req, res, next) => {
      try {
        const details = repository.getArchivedParticipantDetails(
          String(req.params.archiveId),
          String(req.params.participantId)
        );
        res.json(details);
      } catch (error) {
        next(error);
      }
    }
  );
  router.use((error, _req, res, next) => {
    if (error instanceof ResultsArchiveValidationError || error instanceof ResultsArchiveNotFoundError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    next(error);
  });
  return router;
}

// server/services/liveSessionSocket.ts
var import_socket = require("socket.io");

// server/services/liveSessionEngine.ts
var LiveSessionPhaseEngine = class {
  constructor(repository, onPhaseTransitioned) {
    this.timers = /* @__PURE__ */ new Map();
    this.closed = false;
    this.repository = repository;
    this.onPhaseTransitioned = onPhaseTransitioned;
  }
  clearTimer(sessionId) {
    const existing = this.timers.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(sessionId);
    }
  }
  clearAll() {
    this.closed = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
  scheduleSession(sessionId) {
    if (this.closed) return;
    this.clearTimer(sessionId);
    let runningStates;
    try {
      runningStates = this.repository.listRunningSessionStatesForRecovery();
    } catch {
      return;
    }
    const current = runningStates.find((s) => s.id === sessionId);
    if (!current) return;
    if (current.currentPhase === "question_results" && current.advanceMode === "manual") {
      return;
    }
    if (!current.phaseEndsAt) return;
    const endsAtMs = Date.parse(current.phaseEndsAt);
    if (!Number.isFinite(endsAtMs)) return;
    const delayMs = Math.min(Math.max(0, endsAtMs - Date.now()), 2147483647);
    const expectedPhase = current.currentPhase;
    const expectedIndex = current.currentQuestionIndex;
    const timer = setTimeout(() => {
      this.timers.delete(sessionId);
      if (this.closed) return;
      void this.executeTransition(sessionId, expectedPhase, expectedIndex);
    }, delayMs);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
    this.timers.set(sessionId, timer);
  }
  async executeTransition(sessionId, expectedPhase, expectedIndex) {
    if (this.closed) return;
    try {
      let transitioned = false;
      if (expectedPhase === "question_intro") {
        transitioned = this.repository.beginAnsweringPhase(sessionId, expectedIndex);
      } else if (expectedPhase === "answering") {
        transitioned = this.repository.finalizeCurrentQuestion(sessionId, expectedIndex);
      } else if (expectedPhase === "question_results") {
        const res = this.repository.advanceFromResults(sessionId, expectedIndex);
        transitioned = res.transitioned;
      }
      if (transitioned && !this.closed) {
        await this.onPhaseTransitioned(sessionId);
        this.scheduleSession(sessionId);
      }
    } catch {
    }
  }
  recoverActiveSessionsOnBoot() {
    if (this.closed) return;
    let runningSessions;
    try {
      runningSessions = this.repository.listRunningSessionStatesForRecovery();
    } catch {
      return;
    }
    const nowMs = Date.now();
    for (const session of runningSessions) {
      if (session.currentPhase === "question_results" && session.advanceMode === "manual") {
        continue;
      }
      const endsAtMs = session.phaseEndsAt ? Date.parse(session.phaseEndsAt) : NaN;
      if (Number.isFinite(endsAtMs) && endsAtMs <= nowMs) {
        if (session.currentPhase === "question_intro") {
          this.repository.beginAnsweringPhase(session.id, session.currentQuestionIndex);
          this.scheduleSession(session.id);
        } else if (session.currentPhase === "answering") {
          this.repository.finalizeCurrentQuestion(session.id, session.currentQuestionIndex);
          this.scheduleSession(session.id);
        } else if (session.currentPhase === "question_results" && session.advanceMode === "auto") {
          const res = this.repository.advanceFromResults(
            session.id,
            session.currentQuestionIndex
          );
          if (!res.completed) {
            this.scheduleSession(session.id);
          }
        }
      } else {
        this.scheduleSession(session.id);
      }
    }
  }
};

// server/services/liveSessionSocket.ts
var NOOP_LIVE_SESSION_HUB = {
  async broadcastTeacherSessionUpdate() {
  },
  async broadcastStudentSessionStatus() {
  },
  syncSessionSchedule() {
  },
  async close() {
  }
};
var LOOPBACK_IPS2 = /* @__PURE__ */ new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
function isSocketFromLocalAdmin(req) {
  if (process.env.QUIZCLASS_ALLOW_REMOTE_ADMIN === "true") {
    return true;
  }
  const remoteAddress = req.socket.remoteAddress;
  if (remoteAddress && LOOPBACK_IPS2.has(remoteAddress)) {
    return true;
  }
  const appUrl = process.env.APP_URL;
  const isCloudRun = Boolean(process.env.K_SERVICE || appUrl && appUrl.startsWith("https://"));
  if (!isCloudRun) {
    return false;
  }
  const forwardedProto = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers.host;
  if (forwardedProto !== "https" || !hostHeader) {
    return false;
  }
  if (appUrl) {
    try {
      const expectedHost = new URL(appUrl).host;
      if (hostHeader === expectedHost) return true;
    } catch {
      return false;
    }
  }
  return hostHeader.endsWith(".run.app");
}
function resolveSocketRequestOrigin(req) {
  const host = req.headers.host;
  if (!host) return null;
  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = typeof protoHeader === "string" && protoHeader.trim() ? protoHeader.split(",")[0].trim() : "http";
  return `${proto}://${host}`;
}
function attachLiveSessionSocket(httpServer, db, storagePaths) {
  const repository = new SqliteLiveSessionRepository(db, storagePaths);
  repository.markAllParticipantsDisconnectedOnBoot();
  const io = new import_socket.Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true
    },
    pingInterval: 1e4,
    pingTimeout: 1e4
  });
  const activeParticipantSockets = /* @__PURE__ */ new Map();
  const getServerPort = () => {
    const addr = httpServer.address();
    if (addr && typeof addr === "object" && "port" in addr) {
      return addr.port;
    }
    return Number(process.env.PORT ?? 3e3);
  };
  const teacherRoom = (sessionId) => `session:${sessionId}:teacher`;
  const studentRoom = (sessionId) => `session:${sessionId}:students`;
  const broadcastTeacherSessionUpdate = async (sessionId, requestOrigin) => {
    try {
      const details = await repository.getTeacherSessionDetails(sessionId, {
        port: getServerPort(),
        requestOrigin
      });
      io.to(teacherRoom(sessionId)).emit("session:teacher_state", details);
    } catch {
    }
  };
  const broadcastStudentSessionStatus = async (sessionId) => {
    try {
      const sockets = await io.in(studentRoom(sessionId)).fetchSockets();
      for (const clientSocket of sockets) {
        const clientData = clientSocket.data;
        const pid = clientData.participantId;
        if (!pid) continue;
        try {
          const state = repository.getStudentLiveState(sessionId, pid);
          clientSocket.emit("session:student_state", state);
          clientSocket.emit("session:student_status", { session: state.session });
        } catch {
        }
      }
    } catch {
    }
  };
  const phaseEngine = new LiveSessionPhaseEngine(repository, async (sessionId) => {
    await Promise.all([
      broadcastTeacherSessionUpdate(sessionId),
      broadcastStudentSessionStatus(sessionId)
    ]);
  });
  phaseEngine.recoverActiveSessionsOnBoot();
  const syncSessionSchedule = (sessionId) => {
    phaseEngine.scheduleSession(sessionId);
  };
  io.on("connection", (socket) => {
    const data = socket.data;
    socket.on(
      "teacher:subscribe",
      async (payload, ack) => {
        try {
          if (!isSocketFromLocalAdmin(socket.request)) {
            ack?.({ ok: false, error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0645\u062A\u0627\u0628\u0639\u0629 \u0644\u0648\u062D\u0629 \u0627\u0644\u0645\u0639\u0644\u0645 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632." });
            return;
          }
          const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
          const hostToken = typeof payload?.hostToken === "string" ? payload.hostToken.trim() : "";
          if (!sessionId || !hostToken || !repository.verifyTeacherHostToken(sessionId, hostToken)) {
            ack?.({ ok: false, error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u0639\u0644\u0645 \u0644\u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629." });
            return;
          }
          for (const room of socket.rooms) {
            if (room !== socket.id && room.startsWith("session:")) {
              await socket.leave(room);
            }
          }
          data.role = "teacher";
          data.sessionId = sessionId;
          data.participantId = void 0;
          await socket.join(teacherRoom(sessionId));
          const details = await repository.getTeacherSessionDetails(sessionId, {
            port: getServerPort(),
            requestOrigin: resolveSocketRequestOrigin(socket.request)
          });
          socket.emit("session:teacher_state", details);
          ack?.({ ok: true, data: details });
        } catch (error) {
          const message = error instanceof Error ? error.message : "\u062A\u0639\u0630\u0631 \u0631\u0628\u0637 \u0634\u0627\u0634\u0629 \u0627\u0644\u0645\u0639\u0644\u0645 \u0628\u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629.";
          ack?.({ ok: false, error: message });
        }
      }
    );
    socket.on(
      "student:subscribe",
      async (payload, ack) => {
        try {
          const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
          const participantId = typeof payload?.participantId === "string" ? payload.participantId.trim() : "";
          const reconnectToken = typeof payload?.reconnectToken === "string" ? payload.reconnectToken.trim() : "";
          const verified = repository.verifyParticipantAuth({
            sessionId,
            participantId,
            reconnectToken
          });
          if (verified.session.status === "cancelled") {
            ack?.({ ok: false, error: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0647\u0630\u0647 \u0627\u0644\u062C\u0644\u0633\u0629." });
            return;
          }
          if (data.role === "student" && data.participantId && data.participantId !== participantId) {
            const oldSockets = activeParticipantSockets.get(data.participantId);
            oldSockets?.delete(socket.id);
          }
          for (const room of socket.rooms) {
            if (room !== socket.id && room.startsWith("session:")) {
              await socket.leave(room);
            }
          }
          data.role = "student";
          data.sessionId = verified.session.sessionId;
          data.participantId = verified.participant.id;
          let socketSet = activeParticipantSockets.get(verified.participant.id);
          if (!socketSet) {
            socketSet = /* @__PURE__ */ new Set();
            activeParticipantSockets.set(verified.participant.id, socketSet);
          }
          socketSet.add(socket.id);
          repository.setParticipantConnectionStatus(
            verified.session.sessionId,
            verified.participant.id,
            "connected"
          );
          await socket.join(studentRoom(verified.session.sessionId));
          const safeStudentState = repository.getStudentLiveState(
            verified.session.sessionId,
            verified.participant.id
          );
          socket.emit("session:student_state", safeStudentState);
          ack?.({ ok: true, data: safeStudentState });
          await broadcastTeacherSessionUpdate(
            verified.session.sessionId,
            resolveSocketRequestOrigin(socket.request)
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0627\u0644\u0637\u0627\u0644\u0628.";
          ack?.({ ok: false, error: message });
        }
      }
    );
    socket.on(
      "student:submit_answer",
      async (payload, ack) => {
        try {
          const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
          const participantId = typeof payload?.participantId === "string" ? payload.participantId.trim() : "";
          if (data.role === "student" && (data.sessionId && data.sessionId !== sessionId || data.participantId && data.participantId !== participantId)) {
            ack?.({ ok: false, error: "\u0645\u0631\u0641\u0648\u0636: \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u0627\u0644\u0645\u0634\u0627\u0631\u0643 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629." });
            return;
          }
          const result = repository.submitStudentAnswer({
            sessionId,
            participantId,
            reconnectToken: typeof payload?.reconnectToken === "string" ? payload.reconnectToken : "",
            sessionQuestionId: typeof payload?.sessionQuestionId === "string" ? payload.sessionQuestionId : "",
            selectedOptionId: payload?.selectedOptionId ?? null,
            selectedBoolean: typeof payload?.selectedBoolean === "boolean" ? payload.selectedBoolean : null
          });
          ack?.({ ok: true, data: result });
          await broadcastTeacherSessionUpdate(
            sessionId,
            resolveSocketRequestOrigin(socket.request)
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "\u062A\u0639\u0630\u0631 \u062A\u0633\u062C\u064A\u0644 \u0625\u062C\u0627\u0628\u062A\u0643 \u062D\u0627\u0644\u064A\u0627\u064B.";
          ack?.({ ok: false, error: message });
        }
      }
    );
    const rejectUnauthorizedControl = (_payload, ack) => {
      ack?.({ ok: false, error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0644\u0645\u0634\u0627\u0631\u0643\u064A\u0646 \u0628\u0627\u0644\u062A\u062D\u0643\u0645 \u0641\u064A \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u0627\u0644\u0645\u0624\u0642\u062A." });
    };
    socket.on("session:start", rejectUnauthorizedControl);
    socket.on("session:cancel", rejectUnauthorizedControl);
    socket.on("session:complete", rejectUnauthorizedControl);
    socket.on("session:next_question", rejectUnauthorizedControl);
    socket.on("session:update_settings", rejectUnauthorizedControl);
    socket.on("disconnect", async () => {
      if (data.role !== "student" || !data.sessionId || !data.participantId) {
        return;
      }
      const socketSet = activeParticipantSockets.get(data.participantId);
      if (socketSet) {
        socketSet.delete(socket.id);
        if (socketSet.size > 0) {
          return;
        }
        activeParticipantSockets.delete(data.participantId);
      }
      repository.setParticipantConnectionStatus(data.sessionId, data.participantId, "disconnected");
      await broadcastTeacherSessionUpdate(
        data.sessionId,
        resolveSocketRequestOrigin(socket.request)
      );
    });
  });
  return {
    io,
    broadcastTeacherSessionUpdate,
    broadcastStudentSessionStatus,
    syncSessionSchedule,
    async close() {
      phaseEngine.clearAll();
      await new Promise((resolve) => {
        io.close(() => resolve());
      });
    }
  };
}

// server/app.ts
function createServerApp(db, storagePaths, liveSocketHub = NOOP_LIVE_SESSION_HUB) {
  const app = (0, import_express6.default)();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(import_express6.default.json({ limit: "1mb" }));
  app.use("/api", createQuestionBankRouter(db, storagePaths));
  app.use("/api", createQuizRouter(db, storagePaths));
  app.use("/api", createLiveSessionRouter(db, storagePaths, liveSocketHub));
  app.use("/api", createInteractiveLearningRouter(db, storagePaths));
  app.use("/api", createResultsArchiveRouter(db));
  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && "status" in error && error.status === 400) {
      res.status(400).json({ error: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0631\u0633\u0644\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." });
      return;
    }
    if (error instanceof QuestionValidationError || error instanceof QuestionNotFoundError || error instanceof QuizValidationError || error instanceof QuizNotFoundError || error instanceof LiveSessionValidationError || error instanceof LiveSessionNotFoundError || error instanceof InteractiveActivityValidationError || error instanceof InteractiveActivityNotFoundError || error instanceof ResultsArchiveValidationError || error instanceof ResultsArchiveNotFoundError || error instanceof MediaValidationError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error("[QuizClass API Error]", error);
    res.status(500).json({
      error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0639\u0627\u0645\u0644 \u0645\u0639 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062D\u0644\u064A\u0629."
    });
  });
  return app;
}

// server/config/storagePaths.ts
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_path2 = __toESM(require("node:path"), 1);
function resolveStoragePaths(customDataDir) {
  const configuredDir = customDataDir ?? process.env.QUIZCLASS_DATA_DIR;
  const dataDir = configuredDir ? import_node_path2.default.resolve(configuredDir) : import_node_path2.default.resolve(process.cwd(), "app-data");
  const mediaDir = import_node_path2.default.join(dataDir, "media");
  const questionsMediaDir = import_node_path2.default.join(mediaDir, "questions");
  const quizzesMediaDir = import_node_path2.default.join(mediaDir, "quizzes");
  const dbFilePath = import_node_path2.default.join(dataDir, "quizclass.sqlite");
  import_node_fs2.default.mkdirSync(dataDir, { recursive: true });
  import_node_fs2.default.mkdirSync(questionsMediaDir, { recursive: true });
  import_node_fs2.default.mkdirSync(quizzesMediaDir, { recursive: true });
  return {
    dataDir,
    dbFilePath,
    mediaDir,
    questionsMediaDir,
    quizzesMediaDir
  };
}

// server/db/database.ts
var import_node_sqlite = require("node:sqlite");
function initializeDatabase(dbFilePath) {
  const db = new import_node_sqlite.DatabaseSync(dbFilePath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false')),
      prompt TEXT NOT NULL,
      image_path TEXT,
      correct_boolean INTEGER CHECK (correct_boolean IS NULL OR correct_boolean IN (0, 1)),
      subject TEXT,
      grade TEXT,
      topic TEXT,
      difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question_options (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      option_order INTEGER NOT NULL,
      option_text TEXT,
      image_path TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      UNIQUE (question_id, option_order)
    );

    CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
    CREATE INDEX IF NOT EXISTS idx_questions_grade ON questions(grade);
    CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
    CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
    CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT,
      grade TEXT,
      description TEXT,
      default_time_seconds INTEGER NOT NULL DEFAULT 30 CHECK (default_time_seconds BETWEEN 5 AND 600),
      lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft', 'started', 'completed')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      source_question_id TEXT,
      question_order INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false')),
      prompt TEXT NOT NULL,
      image_path TEXT,
      correct_boolean INTEGER CHECK (correct_boolean IS NULL OR correct_boolean IN (0, 1)),
      subject TEXT,
      grade TEXT,
      topic TEXT,
      difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
      time_limit_seconds INTEGER NOT NULL CHECK (time_limit_seconds BETWEEN 5 AND 600),
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      UNIQUE (quiz_id, question_order)
    );

    CREATE TABLE IF NOT EXISTS quiz_question_options (
      id TEXT PRIMARY KEY,
      quiz_question_id TEXT NOT NULL,
      option_order INTEGER NOT NULL,
      option_text TEXT,
      image_path TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      FOREIGN KEY (quiz_question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
      UNIQUE (quiz_question_id, option_order)
    );

    CREATE INDEX IF NOT EXISTS idx_quizzes_created_at ON quizzes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id, question_order);
    CREATE INDEX IF NOT EXISTS idx_quiz_questions_source_id ON quiz_questions(source_question_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_question_options_qq_id ON quiz_question_options(quiz_question_id, option_order);

    CREATE TABLE IF NOT EXISTS live_sessions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      quiz_title TEXT NOT NULL,
      quiz_subject TEXT,
      quiz_grade TEXT,
      pin_code TEXT NOT NULL,
      host_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'running', 'completed', 'cancelled')),
      current_question_index INTEGER NOT NULL DEFAULT -1,
      current_phase TEXT NOT NULL DEFAULT 'lobby' CHECK (current_phase IN ('lobby', 'question_intro', 'answering', 'question_results', 'final_results')),
      phase_started_at TEXT,
      phase_ends_at TEXT,
      question_intro_seconds INTEGER NOT NULL DEFAULT 5 CHECK (question_intro_seconds BETWEEN 1 AND 60),
      advance_mode TEXT NOT NULL DEFAULT 'auto' CHECK (advance_mode IN ('auto', 'manual')),
      auto_advance_seconds INTEGER NOT NULL DEFAULT 5 CHECK (auto_advance_seconds BETWEEN 1 AND 60),
      allow_answer_change INTEGER NOT NULL DEFAULT 0 CHECK (allow_answer_change IN (0, 1)),
      allow_late_join INTEGER NOT NULL DEFAULT 1 CHECK (allow_late_join IN (0, 1)),
      scoring_mode TEXT NOT NULL DEFAULT 'speed_and_accuracy' CHECK (scoring_mode IN ('speed_and_accuracy', 'accuracy_only')),
      full_screen_mode INTEGER NOT NULL DEFAULT 0 CHECK (full_screen_mode IN (0, 1)),
      question_started_at TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_active_pin
      ON live_sessions(pin_code)
      WHERE status IN ('waiting', 'running');

    CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_active_quiz
      ON live_sessions(quiz_id)
      WHERE status IN ('waiting', 'running');

    CREATE INDEX IF NOT EXISTS idx_live_sessions_created_at ON live_sessions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);

    CREATE TABLE IF NOT EXISTS live_session_questions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      source_quiz_question_id TEXT,
      source_question_id TEXT,
      question_order INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false')),
      prompt TEXT NOT NULL,
      image_path TEXT,
      correct_boolean INTEGER CHECK (correct_boolean IS NULL OR correct_boolean IN (0, 1)),
      subject TEXT,
      grade TEXT,
      topic TEXT,
      difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
      time_limit_seconds INTEGER NOT NULL CHECK (time_limit_seconds BETWEEN 5 AND 600),
      points INTEGER NOT NULL DEFAULT 1000,
      results_finalized INTEGER NOT NULL DEFAULT 0 CHECK (results_finalized IN (0, 1)),
      FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
      UNIQUE (session_id, question_order)
    );

    CREATE TABLE IF NOT EXISTS live_session_question_options (
      id TEXT PRIMARY KEY,
      session_question_id TEXT NOT NULL,
      option_order INTEGER NOT NULL,
      option_text TEXT,
      image_path TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      FOREIGN KEY (session_question_id) REFERENCES live_session_questions(id) ON DELETE CASCADE,
      UNIQUE (session_question_id, option_order)
    );

    CREATE INDEX IF NOT EXISTS idx_live_session_questions_session_id
      ON live_session_questions(session_id, question_order);
    CREATE INDEX IF NOT EXISTS idx_live_session_question_options_sq_id
      ON live_session_question_options(session_question_id, option_order);

    CREATE TABLE IF NOT EXISTS live_session_participants (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      reconnect_token TEXT NOT NULL,
      connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected')),
      total_score INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      total_response_time_ms INTEGER NOT NULL DEFAULT 0,
      rank_position INTEGER,
      joined_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      disconnected_at TEXT,
      avatar_id TEXT NOT NULL DEFAULT 'avatar_cat',
      FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
      UNIQUE (session_id, normalized_name)
    );

    CREATE INDEX IF NOT EXISTS idx_live_session_participants_session_id
      ON live_session_participants(session_id, joined_at ASC);

    CREATE TABLE IF NOT EXISTS live_session_answers (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      session_question_id TEXT NOT NULL,
      participant_id TEXT NOT NULL,
      selected_option_id TEXT,
      selected_boolean INTEGER CHECK (selected_boolean IS NULL OR selected_boolean IN (0, 1)),
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      response_time_ms INTEGER,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      answered_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (session_question_id) REFERENCES live_session_questions(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES live_session_participants(id) ON DELETE CASCADE,
      UNIQUE (session_question_id, participant_id)
    );

    CREATE INDEX IF NOT EXISTS idx_live_session_answers_session_id
      ON live_session_answers(session_id);
    CREATE INDEX IF NOT EXISTS idx_live_session_answers_participant_id
      ON live_session_answers(participant_id);

    CREATE TABLE IF NOT EXISTS interactive_activities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subject TEXT,
      grade TEXT,
      auto_fullscreen INTEGER NOT NULL DEFAULT 0 CHECK (auto_fullscreen IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interactive_activity_questions (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      question_order INTEGER NOT NULL,
      FOREIGN KEY (activity_id) REFERENCES interactive_activities(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
      UNIQUE (activity_id, question_order),
      UNIQUE (activity_id, question_id)
    );

    CREATE INDEX IF NOT EXISTS idx_interactive_activities_updated_at
      ON interactive_activities(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_interactive_activity_questions_order
      ON interactive_activity_questions(activity_id, question_order);

    CREATE TABLE IF NOT EXISTS archived_sessions (
      id TEXT PRIMARY KEY,
      live_session_id TEXT NOT NULL UNIQUE,
      quiz_id TEXT,
      quiz_title TEXT NOT NULL,
      quiz_subject TEXT,
      quiz_grade TEXT,
      pin_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status = 'completed'),
      scoring_mode TEXT NOT NULL DEFAULT 'speed_and_accuracy' CHECK (scoring_mode IN ('speed_and_accuracy', 'accuracy_only')),
      advance_mode TEXT NOT NULL DEFAULT 'auto' CHECK (advance_mode IN ('auto', 'manual')),
      allow_answer_change INTEGER NOT NULL DEFAULT 0 CHECK (allow_answer_change IN (0, 1)),
      allow_late_join INTEGER NOT NULL DEFAULT 1 CHECK (allow_late_join IN (0, 1)),
      question_intro_seconds INTEGER NOT NULL DEFAULT 5,
      auto_advance_seconds INTEGER NOT NULL DEFAULT 5,
      full_screen_mode INTEGER NOT NULL DEFAULT 0 CHECK (full_screen_mode IN (0, 1)),
      question_count INTEGER NOT NULL DEFAULT 0,
      participant_count INTEGER NOT NULL DEFAULT 0,
      started_at TEXT,
      ended_at TEXT,
      archived_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_archived_sessions_ended_at
      ON archived_sessions(ended_at DESC, archived_at DESC);
    CREATE INDEX IF NOT EXISTS idx_archived_sessions_quiz_title
      ON archived_sessions(quiz_title);

    CREATE TABLE IF NOT EXISTS archived_session_questions (
      id TEXT PRIMARY KEY,
      archive_id TEXT NOT NULL,
      source_session_question_id TEXT,
      source_quiz_question_id TEXT,
      source_question_id TEXT,
      question_order INTEGER NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('multiple_choice', 'true_false')),
      prompt TEXT NOT NULL,
      image_path TEXT,
      correct_boolean INTEGER CHECK (correct_boolean IS NULL OR correct_boolean IN (0, 1)),
      subject TEXT,
      grade TEXT,
      topic TEXT,
      difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
      time_limit_seconds INTEGER NOT NULL,
      points INTEGER NOT NULL DEFAULT 1000,
      FOREIGN KEY (archive_id) REFERENCES archived_sessions(id) ON DELETE CASCADE,
      UNIQUE (archive_id, question_order)
    );

    CREATE INDEX IF NOT EXISTS idx_archived_session_questions_archive_id
      ON archived_session_questions(archive_id, question_order);

    CREATE TABLE IF NOT EXISTS archived_session_options (
      id TEXT PRIMARY KEY,
      archive_question_id TEXT NOT NULL,
      source_option_id TEXT,
      option_order INTEGER NOT NULL,
      option_text TEXT,
      image_path TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      FOREIGN KEY (archive_question_id) REFERENCES archived_session_questions(id) ON DELETE CASCADE,
      UNIQUE (archive_question_id, option_order)
    );

    CREATE INDEX IF NOT EXISTS idx_archived_session_options_q_id
      ON archived_session_options(archive_question_id, option_order);

    CREATE TABLE IF NOT EXISTS archived_session_participants (
      id TEXT PRIMARY KEY,
      archive_id TEXT NOT NULL,
      source_participant_id TEXT,
      display_name TEXT NOT NULL,
      avatar_id TEXT NOT NULL DEFAULT 'avatar_cat',
      total_score INTEGER NOT NULL DEFAULT 0,
      rank_position INTEGER,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      unanswered_count INTEGER NOT NULL DEFAULT 0,
      accuracy_percent REAL,
      total_response_time_ms INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT,
      FOREIGN KEY (archive_id) REFERENCES archived_sessions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_archived_session_participants_archive_rank
      ON archived_session_participants(archive_id, rank_position ASC, total_score DESC);

    CREATE TABLE IF NOT EXISTS archived_session_answers (
      id TEXT PRIMARY KEY,
      archive_id TEXT NOT NULL,
      archive_question_id TEXT NOT NULL,
      archive_participant_id TEXT NOT NULL,
      selected_archive_option_id TEXT,
      selected_option_text_snapshot TEXT,
      selected_boolean INTEGER CHECK (selected_boolean IS NULL OR selected_boolean IN (0, 1)),
      is_correct INTEGER NOT NULL DEFAULT 0 CHECK (is_correct IN (0, 1)),
      response_time_ms INTEGER,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      answered_at TEXT NOT NULL,
      FOREIGN KEY (archive_id) REFERENCES archived_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (archive_question_id) REFERENCES archived_session_questions(id) ON DELETE CASCADE,
      FOREIGN KEY (archive_participant_id) REFERENCES archived_session_participants(id) ON DELETE CASCADE,
      UNIQUE (archive_question_id, archive_participant_id)
    );

    CREATE INDEX IF NOT EXISTS idx_archived_session_answers_archive_participant
      ON archived_session_answers(archive_id, archive_participant_id);
  `);
  const ensureColumns = (table, definitions) => {
    const existingCols = new Set(
      db.prepare(`PRAGMA table_info(${table})`).all().map(
        (col) => col.name
      )
    );
    for (const def of definitions) {
      if (!existingCols.has(def.name)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${def.sql};`);
      }
    }
  };
  ensureColumns("quizzes", [
    {
      name: "lifecycle_status",
      sql: `lifecycle_status TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft', 'started', 'completed'))`
    }
  ]);
  ensureColumns("live_sessions", [
    {
      name: "current_phase",
      sql: `current_phase TEXT NOT NULL DEFAULT 'lobby' CHECK (current_phase IN ('lobby', 'question_intro', 'answering', 'question_results', 'final_results'))`
    },
    { name: "phase_started_at", sql: "phase_started_at TEXT" },
    { name: "phase_ends_at", sql: "phase_ends_at TEXT" },
    {
      name: "question_intro_seconds",
      sql: "question_intro_seconds INTEGER NOT NULL DEFAULT 5 CHECK (question_intro_seconds BETWEEN 1 AND 60)"
    },
    {
      name: "advance_mode",
      sql: `advance_mode TEXT NOT NULL DEFAULT 'auto' CHECK (advance_mode IN ('auto', 'manual'))`
    },
    {
      name: "auto_advance_seconds",
      sql: "auto_advance_seconds INTEGER NOT NULL DEFAULT 5 CHECK (auto_advance_seconds BETWEEN 1 AND 60)"
    },
    {
      name: "allow_answer_change",
      sql: "allow_answer_change INTEGER NOT NULL DEFAULT 0 CHECK (allow_answer_change IN (0, 1))"
    },
    {
      name: "allow_late_join",
      sql: "allow_late_join INTEGER NOT NULL DEFAULT 1 CHECK (allow_late_join IN (0, 1))"
    },
    {
      name: "scoring_mode",
      sql: `scoring_mode TEXT NOT NULL DEFAULT 'speed_and_accuracy' CHECK (scoring_mode IN ('speed_and_accuracy', 'accuracy_only'))`
    },
    {
      name: "full_screen_mode",
      sql: "full_screen_mode INTEGER NOT NULL DEFAULT 0 CHECK (full_screen_mode IN (0, 1))"
    },
    { name: "question_started_at", sql: "question_started_at TEXT" },
    { name: "started_at", sql: "started_at TEXT" },
    { name: "ended_at", sql: "ended_at TEXT" }
  ]);
  ensureColumns("live_session_questions", [
    {
      name: "results_finalized",
      sql: "results_finalized INTEGER NOT NULL DEFAULT 0 CHECK (results_finalized IN (0, 1))"
    }
  ]);
  ensureColumns("live_session_participants", [
    {
      name: "connection_status",
      sql: `connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected'))`
    },
    { name: "total_score", sql: "total_score INTEGER NOT NULL DEFAULT 0" },
    { name: "correct_count", sql: "correct_count INTEGER NOT NULL DEFAULT 0" },
    { name: "wrong_count", sql: "wrong_count INTEGER NOT NULL DEFAULT 0" },
    { name: "total_response_time_ms", sql: "total_response_time_ms INTEGER NOT NULL DEFAULT 0" },
    { name: "rank_position", sql: "rank_position INTEGER" },
    { name: "disconnected_at", sql: "disconnected_at TEXT" },
    { name: "avatar_id", sql: "avatar_id TEXT NOT NULL DEFAULT 'avatar_cat'" }
  ]);
  backfillLegacyCompletedSessions(db);
  return db;
}

// server.ts
var PORT = Number(process.env.PORT ?? 3e3);
var IS_PRODUCTION = process.env.NODE_ENV === "production";
async function startServer() {
  const storagePaths = resolveStoragePaths();
  const db = initializeDatabase(storagePaths.dbFilePath);
  let liveSocketHub = NOOP_LIVE_SESSION_HUB;
  const hubProxy = {
    broadcastTeacherSessionUpdate: (sessionId, requestOrigin) => liveSocketHub.broadcastTeacherSessionUpdate(sessionId, requestOrigin),
    broadcastStudentSessionStatus: (sessionId) => liveSocketHub.broadcastStudentSessionStatus(sessionId),
    syncSessionSchedule: (sessionId) => liveSocketHub.syncSessionSchedule(sessionId),
    close: () => liveSocketHub.close()
  };
  const app = createServerApp(db, storagePaths, hubProxy);
  const httpServer = import_node_http.default.createServer(app);
  liveSocketHub = attachLiveSessionSocket(httpServer, db, storagePaths);
  let vite;
  if (IS_PRODUCTION) {
    const appRoot = process.env.QUIZCLASS_APP_ROOT || process.cwd();
    const distDir = import_node_path3.default.join(appRoot, "dist");
    app.use(import_express7.default.static(distDir));
    app.get("*", (_req, res) => {
      const indexFile = import_node_path3.default.join(distDir, "index.html");
      if (import_node_fs3.default.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("\u062A\u0637\u0628\u064A\u0642 QuizClass \u063A\u064A\u0631 \u0645\u0628\u0646\u064A \u0628\u0639\u062F.");
      }
    });
  } else {
    vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        ws: { server: httpServer }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`QuizClass server running on http://0.0.0.0:${PORT}`);
  });
  const shutdown = () => {
    void liveSocketHub.close().catch(() => {
    });
    void vite?.close().catch(() => {
    });
    httpServer.close(() => {
      try {
        db.close();
      } catch {
      }
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
startServer().catch((error) => {
  console.error("Failed to start QuizClass server:", error);
  process.exit(1);
});
