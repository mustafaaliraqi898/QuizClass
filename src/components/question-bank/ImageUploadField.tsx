import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { UploadedMediaAsset } from '../../types/questionBank';

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface ImageUploadFieldProps {
  label: string;
  imagePath: string | null;
  imageUrl: string | null;
  compact?: boolean;
  onUpload: (file: File) => Promise<UploadedMediaAsset>;
  onChange: (nextPath: string | null, nextUrl: string | null, previousPath: string | null) => void;
}

export function ImageUploadField({
  label,
  imagePath,
  imageUrl,
  compact = false,
  onUpload,
  onChange,
}: ImageUploadFieldProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
      setUploadError('صيغة الصورة غير مدعومة. الصيغ المسموحة: PNG، JPG، JPEG، WEBP.');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setUploadError('حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت).');
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await onUpload(file);
      const previousPath = imagePath;
      onChange(uploaded.imagePath, uploaded.imageUrl, previousPath);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تعذر رفع الصورة إلى مجلد التطبيق المحلي.';
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setUploadError(null);
    const previousPath = imagePath;
    onChange(null, null, previousPath);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        onChange={handleFileChange}
        className="sr-only"
      />

      {imageUrl && imagePath ? (
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border border-line bg-input p-2.5 ${
            compact ? '' : 'flex-col sm:flex-row'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`shrink-0 overflow-hidden rounded-lg border border-line bg-surface ${
                compact ? 'h-14 w-14' : 'h-20 w-28'
              }`}
            >
              <img
                src={imageUrl}
                alt={label}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-ink">{label}</p>
              <p className="mt-0.5 text-[11px] text-success-ink">
                تم الحفظ محلياً وجاهزة للمعاينة
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="qc-btn-secondary inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>استبدال</span>
            </button>

            <button
              type="button"
              disabled={isUploading}
              onClick={handleRemove}
              aria-label={`حذف ${label}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-danger-line bg-danger-soft px-2.5 text-xs font-bold text-danger-ink transition-colors hover:brightness-95 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>حذف</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-input text-xs font-bold text-ink-muted transition-colors hover:border-primary hover:bg-selected/60 hover:text-accent disabled:opacity-60 ${
            compact ? 'h-10 px-3' : 'h-20 flex-col px-4 py-3'
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              <span>جارٍ رفع الصورة وحفظها...</span>
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4 text-accent" />
              <span>{label}</span>
              {!compact && (
                <span className="text-[11px] font-normal text-ink-muted">
                  PNG أو JPG أو JPEG أو WEBP · بحد أقصى 5 ميجابايت
                </span>
              )}
            </>
          )}
        </button>
      )}

      {uploadError && (
        <p role="alert" className="text-xs font-bold text-danger-ink">
          {uploadError}
        </p>
      )}
    </div>
  );
}
