import * as XLSX from 'xlsx';
import type {
  QuestionDifficulty,
  QuestionOptionInput,
  QuestionPayload,
  QuestionType,
} from '../types/questionBank';

export const EXCEL_COLUMNS = [
  'نوع السؤال',
  'نص السؤال',
  'الخيار 1',
  'الخيار 2',
  'الخيار 3',
  'الخيار 4',
  'الخيار 5',
  'الخيار 6',
  'رقم الإجابة الصحيحة',
  'الإجابة الصحيحة',
  'المادة',
  'الصف',
  'الموضوع',
  'الصعوبة',
] as const;

export interface ParsedQuestionRow {
  rowNumber: number;
  rawType: string;
  type: QuestionType | null;
  prompt: string;
  options: string[];
  correctOptionIndex: number | null;
  correctBooleanText: string;
  correctBoolean: boolean | null;
  subject: string;
  grade: string;
  topic: string;
  difficultyText: string;
  difficulty: QuestionDifficulty;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  isDuplicateInFile?: boolean;
  isDuplicateInBank?: boolean;
  payload: QuestionPayload | null;
}

export interface ExcelImportSummary {
  fileName: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
  multipleChoiceCount: number;
  trueFalseCount: number;
  duplicateCount: number;
  rows: ParsedQuestionRow[];
  validPayloads: QuestionPayload[];
  fatalError?: string;
}

export const TEMPLATE_FILE_NAME = 'QuizClass_QuestionBank_Template.xlsx';

/**
 * Creates the two-sheet Excel workbook for QuizClass Question Bank template.
 */
export function generateQuestionBankTemplateWorkbook(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: الأسئلة (Questions)
  const questionsData = [
    [...EXCEL_COLUMNS],
    [
      'اختيار من متعدد',
      'ما هي عاصمة دولة فلسطين؟',
      'القدس',
      'عمان',
      'بيروت',
      'دمشق',
      '',
      '',
      1,
      '',
      'التاريخ والجغرافيا',
      'الصف الثامن',
      'المدن والعواصم',
      'سهل',
    ],
    [
      'اختيار من متعدد',
      'أي الكواكب التالية هو الأقرب إلى كوكب الأرض؟',
      'المريخ',
      'الزهرة',
      'عطارد',
      'المشتري',
      '',
      '',
      2,
      '',
      'العلوم',
      'الصف السادس',
      'المجموعة الشمسية',
      'متوسط',
    ],
    [
      'اختيار من متعدد',
      'ما هو ناتج العملية الحسابية: (12 × 4) + 16 ؟',
      '64',
      '54',
      '48',
      '72',
      '',
      '',
      1,
      '',
      'الرياضيات',
      'الصف الخامس',
      'العمليات الحسابية',
      'متوسط',
    ],
    [
      'صح أو خطأ',
      'الشمس نجم مضيء بذاته وتدور حوله كواكب المجموعة الشمسية.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'صح',
      'العلوم',
      'الصف السادس',
      'الفضاء والفلك',
      'سهل',
    ],
    [
      'صح أو خطأ',
      'يغلي الماء النقي عند درجة حرارة 50 مئوية تحت الضغط الجوي العادي.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'خطأ',
      'الفيزياء',
      'الصف السابع',
      'حالات المادة',
      'سهل',
    ],
    [
      'صح أو خطأ',
      'يتكون جزيء الماء من ذرتي أكسجين وذرة هيدروجين واحدة (HO2).',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'خطأ',
      'الكيمياء',
      'الصف الثامن',
      'المركبات الكيميائية',
      'متوسط',
    ],
  ];

  const wsQuestions = XLSX.utils.aoa_to_sheet(questionsData);
  wsQuestions['!views'] = [{ rightToLeft: true }];
  wsQuestions['!cols'] = [
    { wch: 18 }, // نوع السؤال
    { wch: 45 }, // نص السؤال
    { wch: 20 }, // الخيار 1
    { wch: 20 }, // الخيار 2
    { wch: 20 }, // الخيار 3
    { wch: 20 }, // الخيار 4
    { wch: 20 }, // الخيار 5
    { wch: 20 }, // الخيار 6
    { wch: 22 }, // رقم الإجابة الصحيحة
    { wch: 18 }, // الإجابة الصحيحة
    { wch: 22 }, // المادة
    { wch: 18 }, // الصف
    { wch: 22 }, // الموضوع
    { wch: 15 }, // الصعوبة
  ];

  // Sheet 2: التعليمات (Instructions)
  const instructionsData = [
    ['دليل وتعليمات تعبئة قالب بنك الأسئلة - QuizClass'],
    [''],
    ['ملاحظة هامة: يرجى حذف الصفوف النموذجية التوضيحية قبل إدراج أسئلتك وحفظ الملف.'],
    [''],
    ['1. إرشادات عامة:'],
    ['  - لا تقم بتغيير أسماء الأعمدة أو ترتيبها في ورقة (الأسئلة).'],
    ['  - الحقول (المادة، الصف، الموضوع) اختيارية، ويمكن تركها فارغة.'],
    ['  - حقل (الصعوبة) يقبل إحدى القيم: "سهل"، "متوسط"، "صعب" (إذا تُرِك فارغاً يُعيّن افتراضياً إلى "متوسط").'],
    [''],
    ['2. أسئلة الاختيار من متعدد (Multiple Choice):'],
    ['  - عمود (نوع السؤال): اكتب "اختيار من متعدد".'],
    ['  - عمود (نص السؤال): اكتب نص السؤال بوضوح.'],
    ['  - أعمدة الخيارات: يجب تعبئة الخيار 1 والخيار 2 كحد أدنى، ويمكن إضافة حتى 6 خيارات.'],
    ['  - عمود (رقم الإجابة الصحيحة): اكتب رقم الخيار الصحيح (من 1 إلى 6). مثال: إذا كان الخيار الثاني هو الصحيح اكتب 2.'],
    ['  - عمود (الإجابة الصحيحة): اتركه فارغاً لأسئلة الاختيار من متعدد.'],
    [''],
    ['3. أسئلة صح أو خطأ (True / False):'],
    ['  - عمود (نوع السؤال): اكتب "صح أو خطأ".'],
    ['  - عمود (نص السؤال): اكتب نص العبارة المطلوب الحكم عليها.'],
    ['  - أعمدة الخيارات (1 إلى 6) وعمود رقم الإجابة الصحيحة: اتركها فارغة تماماً.'],
    ['  - عمود (الإجابة الصحيحة): اكتب كلمة "صح" أو "خطأ".'],
    [''],
    ['4. الأخطاء الشائعة التي تمنع الاستيراد:'],
    ['  - ترك نص السؤال فارغاً.'],
    ['  - إدخال أقل من خيارين في سؤال الاختيار من متعدد.'],
    ['  - كتابة رقم إجابة صحيحة خارج نطاق الخيارات المعبأة (مثال: كتابة 4 مع وجود 3 خيارات فقط).'],
    ['  - ترك حقل الإجابة الصحيحة فارغاً في سؤال صح أو خطأ.'],
    ['  - كتابة قيمة صعوبة غير مقبولة (القيم المقبولة حصراً: سهل، متوسط، صعب).'],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructionsData);
  wsInstructions['!views'] = [{ rightToLeft: true }];
  wsInstructions['!cols'] = [{ wch: 80 }];

  XLSX.utils.book_append_sheet(wb, wsQuestions, 'الأسئلة');
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'التعليمات');

  return wb;
}

/**
 * Triggers in-browser file download of the template .xlsx workbook.
 */
export function downloadQuestionBankTemplate(): void {
  const wb = generateQuestionBankTemplateWorkbook();
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const nativeBridge = (window as Window & {
    QuizClassNative?: {
      saveBase64File: (fileName: string, mimeType: string, base64Data: string) => void;
    };
  }).QuizClassNative;

  // Android WebView cannot reliably download blob: URLs. Use the native
  // Downloads bridge when running inside the Android application.
  if (nativeBridge?.saveBase64File) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    nativeBridge.saveBase64File(TEMPLATE_FILE_NAME, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', btoa(binary));
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = TEMPLATE_FILE_NAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Normalizes Arabic string for robust column header / type comparison.
 */
function normalizeArabicKey(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ');
}

/**
 * Parses questions from an uploaded Excel file array buffer.
 */
export function parseQuestionsFromExcel(
  fileData: ArrayBuffer | Uint8Array,
  fileName = TEMPLATE_FILE_NAME,
  existingPrompts: Set<string> = new Set()
): ExcelImportSummary {
  // Check if buffer is an actual binary Excel/Zip/OLE file
  const isBinaryExcel = (() => {
    try {
      const bytes = new Uint8Array(fileData);
      if (bytes.length < 4) return false;
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
      const isOle =
        bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
      return isZip || isOle;
    } catch {
      return false;
    }
  })();

  if (!isBinaryExcel) {
    return {
      fileName,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
      multipleChoiceCount: 0,
      trueFalseCount: 0,
      duplicateCount: 0,
      rows: [],
      validPayloads: [],
      fatalError:
        'تعذر قراءة ملف Excel؛ يرجى التأكد من أن الملف سليم بصيغة .xlsx أو .xls متوافقة.',
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
  } catch {
    return {
      fileName,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
      multipleChoiceCount: 0,
      trueFalseCount: 0,
      duplicateCount: 0,
      rows: [],
      validPayloads: [],
      fatalError:
        'تعذر قراءة ملف Excel؛ يرجى التأكد من أن الملف سليم بصيغة .xlsx أو .xls متوافقة.',
    };
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return {
      fileName,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
      multipleChoiceCount: 0,
      trueFalseCount: 0,
      duplicateCount: 0,
      rows: [],
      validPayloads: [],
      fatalError: 'ملف Excel لا يحتوي على أي أوراق عمل.',
    };
  }

  // Look for the "الأسئلة" sheet, or fallback to the first sheet
  const targetSheetName =
    workbook.SheetNames.find((name) => normalizeArabicKey(name).includes('اسئل')) ??
    workbook.SheetNames[0];

  const worksheet = workbook.Sheets[targetSheetName];
  if (!worksheet) {
    return {
      fileName,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
      multipleChoiceCount: 0,
      trueFalseCount: 0,
      duplicateCount: 0,
      rows: [],
      validPayloads: [],
      fatalError: 'تعذر العثور على ورقة الأسئلة داخل ملف Excel.',
    };
  }

  // Convert to 2D array of rows
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
  });

  if (!rawRows || rawRows.length === 0) {
    return {
      fileName,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
      multipleChoiceCount: 0,
      trueFalseCount: 0,
      duplicateCount: 0,
      rows: [],
      validPayloads: [],
      fatalError: 'ورقة الأسئلة فارغة تماماً.',
    };
  }

  // Scan first 10 rows to locate header row
  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const row = rawRows[i];
    if (Array.isArray(row)) {
      const rowText = row.map((cell) => normalizeArabicKey(String(cell ?? ''))).join(' ');
      if (
        (rowText.includes('نوع') && rowText.includes('سوال')) ||
        (rowText.includes('نص') && rowText.includes('سوال'))
      ) {
        headerRowIndex = i;
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    return {
      fileName,
      totalRows: 0,
      validCount: 0,
      errorCount: 0,
      warningCount: 0,
      multipleChoiceCount: 0,
      trueFalseCount: 0,
      duplicateCount: 0,
      rows: [],
      validPayloads: [],
      fatalError:
        'لم يتم العثور على صف العناوين المطلوب (نوع السؤال، نص السؤال، الخيارات...) في ورقة الأسئلة.',
    };
  }

  const headerRow = (rawRows[headerRowIndex] as unknown[]).map((cell) =>
    normalizeArabicKey(String(cell ?? ''))
  );

  // Exact matching first, followed by safe contextual fallback
  const findCol = (
    exactPatterns: string[],
    fallback?: (col: string) => boolean
  ): number => {
    for (const pattern of exactPatterns) {
      const pNorm = normalizeArabicKey(pattern);
      const idx = headerRow.findIndex((col) => col === pNorm);
      if (idx !== -1) return idx;
    }
    if (fallback) {
      const idx = headerRow.findIndex(fallback);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const colType = findCol(['نوع السؤال', 'النوع'], (c) => c.includes('نوع'));
  const colPrompt = findCol(
    ['نص السؤال', 'السؤال', 'العبارة'],
    (c) => c.includes('سوال') && !c.includes('نوع')
  );
  const colOpt1 = findCol(
    ['الخيار 1', 'خيار 1', 'اختيار 1', 'الأول'],
    (c) => (c.includes('خيار') || c.includes('اختيار')) && (c.includes('1') || c.includes('اول'))
  );
  const colOpt2 = findCol(
    ['الخيار 2', 'خيار 2', 'اختيار 2', 'الثاني'],
    (c) => (c.includes('خيار') || c.includes('اختيار')) && (c.includes('2') || c.includes('ثاني'))
  );
  const colOpt3 = findCol(
    ['الخيار 3', 'خيار 3', 'اختيار 3', 'الثالث'],
    (c) => (c.includes('خيار') || c.includes('اختيار')) && (c.includes('3') || c.includes('ثالث'))
  );
  const colOpt4 = findCol(
    ['الخيار 4', 'خيار 4', 'اختيار 4', 'الرابع'],
    (c) => (c.includes('خيار') || c.includes('اختيار')) && (c.includes('4') || c.includes('رابع'))
  );
  const colOpt5 = findCol(
    ['الخيار 5', 'خيار 5', 'اختيار 5', 'الخامس'],
    (c) => (c.includes('خيار') || c.includes('اختيار')) && (c.includes('5') || c.includes('خامس'))
  );
  const colOpt6 = findCol(
    ['الخيار 6', 'خيار 6', 'اختيار 6', 'السادس'],
    (c) => (c.includes('خيار') || c.includes('اختيار')) && (c.includes('6') || c.includes('سادس'))
  );
  const colCorrectOption = findCol(
    ['رقم الإجابة الصحيحة', 'رقم الخيار الصحيح', 'رقم الإجابة', 'الإجابة الصحيحة (رقم)'],
    (c) => c.includes('رقم')
  );
  const colCorrectBoolean = findCol(
    ['الإجابة الصحيحة', 'صح أو خطأ', 'صح وخطأ', 'صحيح أو خاطئ'],
    (c) => (c.includes('اجاب') || c.includes('صح') || c.includes('خط')) && !c.includes('رقم')
  );
  const colSubject = findCol(['المادة'], (c) => c.includes('ماد'));
  const colGrade = findCol(['الصف'], (c) => c.includes('صف'));
  const colTopic = findCol(
    ['الموضوع', 'الوحدة', 'الدرس'],
    (c) => c.includes('موضوع') || c.includes('وحد') || c.includes('درس')
  );
  const colDifficulty = findCol(['الصعوبة', 'المستوى'], (c) => c.includes('صعوب'));

  const parsedRows: ParsedQuestionRow[] = [];
  const seenPromptsInFile = new Set<string>();

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r] as unknown[];
    if (!Array.isArray(row)) continue;

    // Check if entire row is empty
    const isRowEmpty = row.every((c) => String(c ?? '').trim() === '');
    if (isRowEmpty) continue;

    const rowNumber = r + 1; // 1-indexed Excel row
    const errors: string[] = [];
    const warnings: string[] = [];

    const rawType = colType !== -1 ? String(row[colType] ?? '').trim() : '';
    const rawPrompt = colPrompt !== -1 ? String(row[colPrompt] ?? '').trim() : '';

    // Collect options
    const optionIndices = [colOpt1, colOpt2, colOpt3, colOpt4, colOpt5, colOpt6];
    const options: string[] = [];
    for (let o = 0; o < optionIndices.length; o++) {
      const idx = optionIndices[o];
      if (idx !== -1 && idx < row.length) {
        const val = String(row[idx] ?? '').trim();
        if (val) options.push(val);
      }
    }

    const rawCorrectOption =
      colCorrectOption !== -1 ? String(row[colCorrectOption] ?? '').trim() : '';
    const rawCorrectBoolean =
      colCorrectBoolean !== -1 ? String(row[colCorrectBoolean] ?? '').trim() : '';
    const rawSubject = colSubject !== -1 ? String(row[colSubject] ?? '').trim() : '';
    const rawGrade = colGrade !== -1 ? String(row[colGrade] ?? '').trim() : '';
    const rawTopic = colTopic !== -1 ? String(row[colTopic] ?? '').trim() : '';
    const rawDifficulty =
      colDifficulty !== -1 ? String(row[colDifficulty] ?? '').trim() : '';

    // 1. Validate prompt
    if (!rawPrompt) {
      errors.push('لم يتم إدخال نص السؤال.');
    } else if (rawPrompt.length > 2000) {
      errors.push('نص السؤال طويل جداً؛ الحد الأقصى 2000 حرف.');
    }

    // 2. Validate Type & Answers
    const normType = normalizeArabicKey(rawType);
    const isMCQ =
      normType.includes('اختيار') ||
      normType.includes('متعدد') ||
      normType.includes('multiple');
    const isTF =
      normType.includes('صح') ||
      normType.includes('خطا') ||
      normType.includes('true') ||
      normType.includes('false');

    let questionType: QuestionType | null = null;
    let correctOptionIndex: number | null = null;
    let correctBoolean: boolean | null = null;

    if (isMCQ) {
      questionType = 'multiple_choice';

      if (options.length < 2) {
        errors.push(
          `عدد الخيارات المدخلة (${options.length}) أقل من خيارين؛ يجب إدخال خيارين على الأقل.`
        );
      }

      // Read correct option index (e.g. 1 to 6)
      const numStr = rawCorrectOption || rawCorrectBoolean;
      const parsedNum = parseInt(numStr, 10);
      if (isNaN(parsedNum) || parsedNum < 1 || parsedNum > options.length) {
        errors.push(
          `رقم الإجابة الصحيحة (${numStr || 'فارغ'}) غير صالح؛ يجب أن يكون رقماً من 1 إلى ${
            options.length || 2
          } يطابق أحد الخيارات المعبأة.`
        );
      } else {
        correctOptionIndex = parsedNum;
      }
    } else if (isTF) {
      questionType = 'true_false';

      const normBool = normalizeArabicKey(rawCorrectBoolean || rawCorrectOption);
      if (
        ['صح', 'صحيح', 'نعم', 'true', '1'].some((v) => normBool === normalizeArabicKey(v))
      ) {
        correctBoolean = true;
      } else if (
        ['خطا', 'خاطئ', 'لا', 'false', '0'].some((v) => normBool === normalizeArabicKey(v))
      ) {
        correctBoolean = false;
      } else {
        errors.push(
          `الإجابة الصحيحة لسؤال صح أو خطأ ("${
            rawCorrectBoolean || rawCorrectOption || 'فارغ'
          }") غير صالحة؛ يجب أن تكون "صح" أو "خطأ".`
        );
      }

      if (options.length > 0) {
        warnings.push('تم تجاهل الخيارات المدخلة لأن نوع السؤال هو صح أو خطأ.');
      }
    } else {
      errors.push(
        `نوع السؤال غير معروف ("${rawType || 'فارغ'}"). يجب تحديد "اختيار من متعدد" أو "صح أو خطأ".`
      );
    }

    // 3. Validate Difficulty
    let difficulty: QuestionDifficulty = 'medium';
    if (rawDifficulty) {
      const normDiff = normalizeArabicKey(rawDifficulty);
      if (normDiff === 'سهل' || normDiff === 'easy') {
        difficulty = 'easy';
      } else if (normDiff === 'متوسط' || normDiff === 'medium') {
        difficulty = 'medium';
      } else if (normDiff === 'صعب' || normDiff === 'hard') {
        difficulty = 'hard';
      } else {
        errors.push(
          `قيمة الصعوبة غير صالحة ("${rawDifficulty}")؛ القيم المقبولة هي: سهل، متوسط، صعب.`
        );
      }
    }

    // 4. Duplicate Checks (Prompt text)
    const promptNormalized = rawPrompt.toLowerCase();
    let isDuplicateInBank = false;
    let isDuplicateInFile = false;

    if (rawPrompt) {
      if (existingPrompts.has(promptNormalized)) {
        isDuplicateInBank = true;
        warnings.push('نص السؤال مطابق لسؤال موجود مسبقاً في بنك الأسئلة.');
      }
      if (seenPromptsInFile.has(promptNormalized)) {
        isDuplicateInFile = true;
        warnings.push('نص السؤال مكرر داخل نفس ملف Excel.');
      }
      seenPromptsInFile.add(promptNormalized);
    }

    // 5. Construct Payload if valid
    const isValid = errors.length === 0 && questionType !== null;
    let payload: QuestionPayload | null = null;

    if (isValid && questionType === 'multiple_choice') {
      const optionInputs: QuestionOptionInput[] = options.map((optText, idx) => ({
        optionText: optText,
        imagePath: null,
        isCorrect: idx + 1 === correctOptionIndex,
      }));

      payload = {
        type: 'multiple_choice',
        prompt: rawPrompt,
        imagePath: null,
        correctBoolean: null,
        subject: rawSubject || null,
        grade: rawGrade || null,
        topic: rawTopic || null,
        difficulty,
        options: optionInputs,
      };
    } else if (isValid && questionType === 'true_false') {
      payload = {
        type: 'true_false',
        prompt: rawPrompt,
        imagePath: null,
        correctBoolean,
        subject: rawSubject || null,
        grade: rawGrade || null,
        topic: rawTopic || null,
        difficulty,
        options: [],
      };
    }

    parsedRows.push({
      rowNumber,
      rawType,
      type: questionType,
      prompt: rawPrompt,
      options,
      correctOptionIndex,
      correctBooleanText: rawCorrectBoolean,
      correctBoolean,
      subject: rawSubject,
      grade: rawGrade,
      topic: rawTopic,
      difficultyText: rawDifficulty,
      difficulty,
      isValid,
      errors,
      warnings,
      isDuplicateInBank,
      isDuplicateInFile,
      payload,
    });
  }

  const validRows = parsedRows.filter((r) => r.isValid && r.payload !== null);
  const validPayloads = validRows.map((r) => r.payload as QuestionPayload);
  const errorCount = parsedRows.filter((r) => !r.isValid).length;
  const warningCount = parsedRows.filter((r) => r.warnings.length > 0).length;
  const multipleChoiceCount = validRows.filter((r) => r.type === 'multiple_choice').length;
  const trueFalseCount = validRows.filter((r) => r.type === 'true_false').length;
  const duplicateCount = parsedRows.filter(
    (r) => r.isDuplicateInBank || r.isDuplicateInFile
  ).length;

  return {
    fileName,
    totalRows: parsedRows.length,
    validCount: validRows.length,
    errorCount,
    warningCount,
    multipleChoiceCount,
    trueFalseCount,
    duplicateCount,
    rows: parsedRows,
    validPayloads,
  };
}
