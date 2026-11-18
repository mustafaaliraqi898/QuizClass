import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as XLSX from 'xlsx';
import { createServerApp } from '../server/app.ts';
import { resolveStoragePaths, type StoragePaths } from '../server/config/storagePaths.ts';
import { initializeDatabase } from '../server/db/database.ts';
import { QuestionBankView } from '../src/components/question-bank/QuestionBankView.tsx';
import { QuestionImportModal } from '../src/components/question-bank/QuestionImportModal.tsx';
import type { QuestionPayload } from '../src/types/questionBank.ts';
import {
  EXCEL_COLUMNS,
  generateQuestionBankTemplateWorkbook,
  parseQuestionsFromExcel,
} from '../src/utils/questionBankExcel.ts';

describe('QuizClass Question Bank Excel Import Complete Suite', () => {
  let tempDataDir: string;
  let storagePaths: StoragePaths;
  let db: DatabaseSync;
  let server: Server;
  let baseUrl: string;

  before(async () => {
    tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qc-excel-import-test-'));
    storagePaths = resolveStoragePaths(tempDataDir);
    db = initializeDatabase(storagePaths.dbFilePath);
    const app = createServerApp(db, storagePaths);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
    if (tempDataDir && fs.existsSync(tempDataDir)) {
      fs.rmSync(tempDataDir, { recursive: true, force: true });
    }
  });

  function createWorkbookBuffer(rows: unknown[][], sheetName = 'الأسئلة'): Uint8Array {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([[...EXCEL_COLUMNS], ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  }

  it('1. generates template with both sheets (الأسئلة and التعليمات), all 14 columns, and valid examples', () => {
    const wb = generateQuestionBankTemplateWorkbook();
    assert.deepEqual(wb.SheetNames, ['الأسئلة', 'التعليمات']);

    const wsQuestions = wb.Sheets['الأسئلة'];
    const data = XLSX.utils.sheet_to_json<string[]>(wsQuestions, { header: 1 });
    assert.ok(data.length >= 7, 'Template should contain header and at least 6 sample rows');
    assert.deepEqual(data[0], [...EXCEL_COLUMNS]);

    // Check RTL view
    assert.equal(wsQuestions['!views']?.[0]?.rightToLeft, true);

    const wsInstructions = wb.Sheets['التعليمات'];
    assert.ok(wsInstructions);
    assert.equal(wsInstructions['!views']?.[0]?.rightToLeft, true);
  });

  it('2. imports valid multiple-choice questions with 2, 4, and 6 options and various difficulty levels', () => {
    const rows = [
      [
        'اختيار من متعدد',
        'ما هي عاصمة فلسطين؟',
        'القدس',
        'عمان',
        'بيروت',
        'دمشق',
        '',
        '',
        1,
        '',
        'التاريخ',
        'الثامن',
        'المدن',
        'سهل',
      ],
      [
        'اختيار من متعدد',
        'أي من التالي عدد أولي؟',
        '4',
        '7',
        '',
        '',
        '',
        '',
        2,
        '',
        'الرياضيات',
        'السادس',
        'الأعداد',
        'متوسط',
      ],
      [
        'اختيار من متعدد',
        'ألوان الطيف الأساسية؟',
        'أحمر',
        'أزرق',
        'أصفر',
        'أخضر',
        'برتقالي',
        'بنفسجي',
        1,
        '',
        'العلوم',
        'الخامس',
        'الضوء',
        'صعب',
      ],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'mcq_valid.xlsx');

    assert.equal(summary.totalRows, 3);
    assert.equal(summary.validCount, 3);
    assert.equal(summary.errorCount, 0);
    assert.equal(summary.multipleChoiceCount, 3);
    assert.equal(summary.trueFalseCount, 0);

    const q1 = summary.validPayloads[0];
    assert.equal(q1.type, 'multiple_choice');
    assert.equal(q1.prompt, 'ما هي عاصمة فلسطين؟');
    assert.equal(q1.difficulty, 'easy');
    assert.equal(q1.options?.length, 4);
    assert.equal(q1.options?.[0].isCorrect, true);
    assert.equal(q1.options?.[1].isCorrect, false);
    assert.equal(q1.correctBoolean, null);

    const q2 = summary.validPayloads[1];
    assert.equal(q2.options?.length, 2);
    assert.equal(q2.options?.[1].isCorrect, true);
    assert.equal(q2.difficulty, 'medium');

    const q3 = summary.validPayloads[2];
    assert.equal(q3.options?.length, 6);
    assert.equal(q3.difficulty, 'hard');
  });

  it('3. imports valid true/false questions with صح and خطأ values', () => {
    const rows = [
      [
        'صح أو خطأ',
        'الشمس نجم مضيء بذاته.',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'صح',
        'العلوم',
        'السادس',
        'الفلك',
        'سهل',
      ],
      [
        'صح أو خطأ',
        'الماء يغلي عند درجة حرارة 50 مئوية.',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'خطأ',
        'العلوم',
        'السابع',
        'الفيزياء',
        'سهل',
      ],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'tf_valid.xlsx');

    assert.equal(summary.totalRows, 2);
    assert.equal(summary.validCount, 2);
    assert.equal(summary.errorCount, 0);
    assert.equal(summary.multipleChoiceCount, 0);
    assert.equal(summary.trueFalseCount, 2);

    assert.equal(summary.validPayloads[0].type, 'true_false');
    assert.equal(summary.validPayloads[0].correctBoolean, true);
    assert.equal(summary.validPayloads[0].options?.length, 0);

    assert.equal(summary.validPayloads[1].type, 'true_false');
    assert.equal(summary.validPayloads[1].correctBoolean, false);
  });

  it('4. imports mixed question types in one file seamlessly', () => {
    const rows = [
      [
        'اختيار من متعدد',
        'سؤال خيارات مختلط 1',
        'خيار أ',
        'خيار ب',
        '',
        '',
        '',
        '',
        1,
        '',
        'لغة عربية',
        'الأول',
        'النحو',
        'سهل',
      ],
      [
        'صح أو خطأ',
        'سؤال صح وخطأ مختلط 2',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'صح',
        'لغة عربية',
        'الأول',
        'النحو',
        'متوسط',
      ],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'mixed.xlsx');

    assert.equal(summary.totalRows, 2);
    assert.equal(summary.validCount, 2);
    assert.equal(summary.multipleChoiceCount, 1);
    assert.equal(summary.trueFalseCount, 1);
  });

  it('5. safely ignores completely blank rows and whitespace lines', () => {
    const rows = [
      ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [
        'اختيار من متعدد',
        'سؤال بعد سطر فارغ',
        'خيار 1',
        'خيار 2',
        '',
        '',
        '',
        '',
        2,
        '',
        '',
        '',
        '',
        'سهل',
      ],
      [' ', '   ', '', '', '', '', '', '', '', '', '', '', '', ''],
      [
        'صح أو خطأ',
        'سؤال صح وخطأ بعد فراغ',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'صح',
        '',
        '',
        '',
        'سهل',
      ],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'blanks.xlsx');

    assert.equal(summary.totalRows, 2, 'Should only count the 2 non-empty rows');
    assert.equal(summary.validCount, 2);
    assert.equal(summary.errorCount, 0);
  });

  it('6. detects and flags question with missing prompt text', () => {
    const rows = [
      [
        'اختيار من متعدد',
        '', // Missing prompt!
        'خيار 1',
        'خيار 2',
        '',
        '',
        '',
        '',
        1,
        '',
        'العلوم',
        'الخامس',
        '',
        'سهل',
      ],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'missing_prompt.xlsx');

    assert.equal(summary.validCount, 0);
    assert.equal(summary.errorCount, 1);
    assert.match(summary.rows[0].errors.join(' '), /لم يتم إدخال نص السؤال/);
  });

  it('7. detects and flags multiple-choice question with less than 2 options', () => {
    const rows = [
      [
        'اختيار من متعدد',
        'سؤال بخيار واحد فقط؟',
        'الخيار الوحيد',
        '',
        '',
        '',
        '',
        '',
        1,
        '',
        'العلوم',
        'الخامس',
        '',
        'سهل',
      ],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'single_option.xlsx');

    assert.equal(summary.validCount, 0);
    assert.equal(summary.errorCount, 1);
    assert.match(summary.rows[0].errors.join(' '), /أقل من خيارين/);
  });

  it('8. detects multiple-choice missing correct answer or with index out of options range', () => {
    const rows = [
      [
        'اختيار من متعدد',
        'سؤال بدون إجابة صحيحة',
        'خيار 1',
        'خيار 2',
        'خيار 3',
        '',
        '',
        '',
        '', // Missing correct option!
        '',
        '',
        '',
        '',
        'سهل',
      ],
      [
        'اختيار من متعدد',
        'سؤال برقم إجابة خارج النطاق',
        'خيار 1',
        'خيار 2',
        'خيار 3',
        '',
        '',
        '',
        5, // Out of range! Only 3 options provided
        '',
        '',
        '',
        '',
        'سهل',
      ],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'invalid_correct_idx.xlsx');

    assert.equal(summary.validCount, 0);
    assert.equal(summary.errorCount, 2);
    assert.match(summary.rows[0].errors.join(' '), /رقم الإجابة الصحيحة/);
    assert.match(summary.rows[1].errors.join(' '), /رقم الإجابة الصحيحة .* غير صالح/);
  });

  it('9. detects and flags true/false question with invalid boolean value', () => {
    const rows = [
      [
        'صح أو خطأ',
        'الماء مركب عضوي.',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'ربما', // Invalid boolean text!
        '',
        '',
        '',
        'سهل',
      ],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'invalid_tf.xlsx');

    assert.equal(summary.validCount, 0);
    assert.equal(summary.errorCount, 1);
    assert.match(summary.rows[0].errors.join(' '), /يجب أن تكون "صح" أو "خطأ"/);
  });

  it('10. detects and flags invalid difficulty value', () => {
    const rows = [
      [
        'صح أو خطأ',
        'سؤال بصعوبة غير مقبولة.',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'صح',
        '',
        '',
        '',
        'مستحيل', // Invalid difficulty!
      ],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'invalid_diff.xlsx');

    assert.equal(summary.validCount, 0);
    assert.equal(summary.errorCount, 1);
    assert.match(summary.rows[0].errors.join(' '), /قيمة الصعوبة غير صالحة/);
  });

  it('11. handles corrupt or non-Excel binary files cleanly with fatalError message', () => {
    const corruptBuffer = Buffer.from('NOT_A_VALID_EXCEL_FILE_CONTENT_AT_ALL');
    const summary = parseQuestionsFromExcel(corruptBuffer, 'corrupt.xlsx');

    assert.equal(summary.totalRows, 0);
    assert.ok(summary.fatalError);
    assert.match(summary.fatalError, /تعذر قراءة ملف Excel/);
  });

  it('12. warns on duplicate questions in the same file and against existing bank questions without blocking valid import', () => {
    const existingBankPrompts = new Set(['سؤال موجود مسبقاً في بنك الأسئلة'.toLowerCase()]);

    const rows = [
      [
        'صح أو خطأ',
        'سؤال موجود مسبقاً في بنك الأسئلة',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'صح',
        '',
        '',
        '',
        'سهل',
      ],
      [
        'اختيار من متعدد',
        'سؤال مكرر في الملف نفسه',
        'خيار 1',
        'خيار 2',
        '',
        '',
        '',
        '',
        1,
        '',
        '',
        '',
        '',
        'سهل',
      ],
      [
        'اختيار من متعدد',
        'سؤال مكرر في الملف نفسه', // Duplicate of previous row!
        'خيار أ',
        'خيار ب',
        '',
        '',
        '',
        '',
        2,
        '',
        '',
        '',
        '',
        'متوسط',
      ],
    ];

    const buf = createWorkbookBuffer(rows);
    const summary = parseQuestionsFromExcel(buf, 'duplicates.xlsx', existingBankPrompts);

    assert.equal(summary.totalRows, 3);
    assert.equal(summary.validCount, 3, 'Duplicates are valid to import if format is correct');
    assert.equal(summary.errorCount, 0);
    assert.ok(summary.duplicateCount >= 2);

    assert.equal(summary.rows[0].isDuplicateInBank, true);
    assert.equal(summary.rows[2].isDuplicateInFile, true);
    assert.match(summary.rows[0].warnings.join(' '), /موجود مسبقاً في بنك الأسئلة/);
    assert.match(summary.rows[2].warnings.join(' '), /مكرر داخل نفس ملف Excel/);
  });

  it('13. batch saves valid questions to SQLite via POST /api/questions/batch inside transaction', async () => {
    const payloads: QuestionPayload[] = [
      {
        type: 'multiple_choice',
        prompt: 'سؤال استيراد دفعة 1 - كيمياء',
        imagePath: null,
        correctBoolean: null,
        subject: 'الكيمياء',
        grade: 'العاشر',
        topic: 'العناصر',
        difficulty: 'easy',
        options: [
          { optionText: 'أكسجين', imagePath: null, isCorrect: true },
          { optionText: 'نيتروجين', imagePath: null, isCorrect: false },
        ],
      },
      {
        type: 'true_false',
        prompt: 'سؤال استيراد دفعة 2 - كيمياء',
        imagePath: null,
        correctBoolean: true,
        subject: 'الكيمياء',
        grade: 'العاشر',
        topic: 'التفاعلات',
        difficulty: 'medium',
        options: [],
      },
    ];

    const res = await fetch(`${baseUrl}/api/questions/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: payloads }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as { success: boolean; count: number; questions: Array<{ id: string; prompt: string }> };
    assert.equal(body.success, true);
    assert.equal(body.count, 2);
    assert.equal(body.questions.length, 2);

    // Verify questions appear in Question Bank list
    const listRes = await fetch(`${baseUrl}/api/questions?search=سؤال استيراد دفعة`);
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as { questions: Array<{ prompt: string }> };
    assert.equal(listBody.questions.length, 2);

    // Verify stats updated
    const statsRes = await fetch(`${baseUrl}/api/questions/stats`);
    const statsBody = (await statsRes.json()) as { totalQuestions: number };
    assert.ok(statsBody.totalQuestions >= 2);
  });

  it('14. rolls back transaction cleanly if any item in batch is invalid', async () => {
    const invalidBatch: unknown[] = [
      {
        type: 'multiple_choice',
        prompt: 'سؤال صالح في دفعة بها خطأ',
        imagePath: null,
        correctBoolean: null,
        options: [
          { optionText: 'خيار 1', imagePath: null, isCorrect: true },
          { optionText: 'خيار 2', imagePath: null, isCorrect: false },
        ],
      },
      {
        type: 'multiple_choice',
        prompt: '', // INVALID! Empty prompt
        imagePath: null,
        correctBoolean: null,
        options: [],
      },
    ];

    const res = await fetch(`${baseUrl}/api/questions/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: invalidBatch }),
    });

    assert.equal(res.status, 400);

    // Verify first question was rolled back and NOT inserted
    const verifyRes = await fetch(`${baseUrl}/api/questions?search=سؤال صالح في دفعة بها خطأ`);
    const verifyBody = (await verifyRes.json()) as { questions: unknown[] };
    assert.equal(verifyBody.questions.length, 0);
  });

  it('15. renders Excel action buttons on QuestionBankView and QuestionImportModal preview', () => {
    const viewHtml = renderToStaticMarkup(React.createElement(QuestionBankView));

    assert.match(viewHtml, /data-testid="download-excel-template-btn"/);
    assert.match(viewHtml, /تنزيل قالب Excel/);
    assert.match(viewHtml, /data-testid="import-excel-questions-btn"/);
    assert.match(viewHtml, /استيراد أسئلة من Excel/);
    assert.match(viewHtml, /إضافة سؤال جديد/);

    // Modal preview rendering
    const modalHtml = renderToStaticMarkup(
      React.createElement(QuestionImportModal, {
        isOpen: true,
        summary: {
          fileName: 'test_preview.xlsx',
          totalRows: 2,
          validCount: 1,
          errorCount: 1,
          warningCount: 0,
          multipleChoiceCount: 1,
          trueFalseCount: 0,
          duplicateCount: 0,
          rows: [
            {
              rowNumber: 2,
              rawType: 'اختيار من متعدد',
              type: 'multiple_choice',
              prompt: 'ما هي عاصمة فلسطين؟',
              options: ['القدس', 'عمان'],
              correctOptionIndex: 1,
              correctBooleanText: '',
              correctBoolean: null,
              subject: 'التاريخ',
              grade: 'الثامن',
              topic: 'المدن',
              difficultyText: 'سهل',
              difficulty: 'easy',
              isValid: true,
              errors: [],
              warnings: [],
              payload: {
                type: 'multiple_choice',
                prompt: 'ما هي عاصمة فلسطين؟',
                imagePath: null,
                correctBoolean: null,
                options: [
                  { optionText: 'القدس', imagePath: null, isCorrect: true },
                  { optionText: 'عمان', imagePath: null, isCorrect: false },
                ],
              },
            },
            {
              rowNumber: 3,
              rawType: 'اختيار من متعدد',
              type: null,
              prompt: '',
              options: [],
              correctOptionIndex: null,
              correctBooleanText: '',
              correctBoolean: null,
              subject: '',
              grade: '',
              topic: '',
              difficultyText: '',
              difficulty: 'medium',
              isValid: false,
              errors: ['لم يتم إدخال نص السؤال.'],
              warnings: [],
              payload: null,
            },
          ],
          validPayloads: [
            {
              type: 'multiple_choice',
              prompt: 'ما هي عاصمة فلسطين؟',
              imagePath: null,
              correctBoolean: null,
              options: [
                { optionText: 'القدس', imagePath: null, isCorrect: true },
                { optionText: 'عمان', imagePath: null, isCorrect: false },
              ],
            },
          ],
        },
        isSaving: false,
        onClose: () => {},
        onSelectDifferentFile: () => {},
        onConfirmImport: async () => {},
      })
    );

    assert.match(modalHtml, /معاينة استيراد الأسئلة من Excel/);
    assert.match(modalHtml, /test_preview\.xlsx/);
    assert.match(modalHtml, /جاهز للاستيراد/);
    assert.match(modalHtml, /صفوف بها أخطاء/);
    assert.match(modalHtml, /لم يتم إدخال نص السؤال/);
    assert.match(modalHtml, /تأكيد الاستيراد \(1 سؤالاً\)/);
  });
});
