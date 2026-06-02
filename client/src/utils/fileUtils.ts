export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024; const sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
export function mimeTypeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMG';
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.includes('word')) return 'DOC';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'XLS';
  if (mimeType.startsWith('text/')) return 'TXT';
  return 'FILE';
}
export function isImage(mimeType: string): boolean { return mimeType.startsWith('image/'); }
export function getExtension(filename: string): string { return filename.split('.').pop()?.toUpperCase() || ''; }
