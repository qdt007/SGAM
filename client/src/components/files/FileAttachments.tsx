import { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filesApi } from '../../api/filesApi';
import { useAuthStore } from '../../stores/authStore';
import { formatFileSize, isImage, getExtension } from '../../utils/fileUtils';
import { formatRelative } from '../../utils/dateUtils';
import { keys } from '../../constants/queryKeys';
import { cn } from '../../utils/cn';

const MAX_MB = 10;

export function FileAttachments({ taskId, canUpload = true }: { taskId: string; canUpload?: boolean }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: files = [] } = useQuery({
    queryKey: keys.tasks.files(taskId),
    queryFn: () => filesApi.listByTask(taskId),
  });

  const { mutate: upload, isPending } = useMutation({
    mutationFn: (selected: File[]) => filesApi.upload(taskId, selected, setProgress),
    onSuccess: () => {
      setProgress(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: keys.tasks.files(taskId) });
    },
    onError: (e: unknown) => {
      setProgress(null);
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Upload failed');
    },
  });

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => filesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.tasks.files(taskId) }),
  });

  const handleFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const selected = Array.from(list).slice(0, 5);
    const tooBig = selected.find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than ${MAX_MB} MB`);
      return;
    }
    setError(null);
    upload(selected);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon="ph:paperclip-duotone" width={18} className="text-ink-muted" />
        <h3 className="text-sm font-semibold text-ink">
          Attachments {files.length > 0 && <span className="text-ink-muted font-normal">({files.length})</span>}
        </h3>
      </div>

      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'rounded-xl border border-dashed px-4 py-6 text-center cursor-pointer transition-colors',
            dragging
              ? 'border-primary bg-primary/[0.06]'
              : 'border-hairline hover:border-primary-400 dark:hover:border-primary-400',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {isPending && progress !== null ? (
            <div className="space-y-2">
              <p className="text-sm text-ink-muted">Uploading… {progress}%</p>
              <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <Icon icon="ph:cloud-arrow-up-duotone" width={26} className="mx-auto text-ink-muted mb-1.5" />
              <p className="text-sm text-ink">Drop files here or click to browse</p>
              <p className="text-xs text-ink-muted mt-0.5">Up to 5 files, {MAX_MB} MB each</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f) => (
            <div key={f.id} className="group flex items-center gap-3 rounded-xl px-3 py-2 bg-black/[0.03]">
              {isImage(f.mimeType) ? (
                <img src={f.url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {getExtension(f.originalName) || 'FILE'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-ink hover:underline truncate block"
                >
                  {f.originalName}
                </a>
                <p className="text-xs text-ink-muted">
                  {formatFileSize(f.size)} · {f.uploader?.displayName} · {formatRelative(f.createdAt)}
                </p>
              </div>
              {f.uploaderId === user?.id && (
                <button
                  onClick={() => remove(f.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted hover:text-red-500 shrink-0"
                  aria-label="Delete file"
                >
                  <Icon icon="ph:trash" width={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
