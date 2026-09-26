import { useCallback, useEffect, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Modal } from './Modal';

/** Avatars render at 64px at most; 512 leaves room for retina without shipping a huge file. */
const OUTPUT_SIZE = 512;

/**
 * Draws the selected region at a fixed square size. PNG rather than JPEG so a logo with a
 * transparent background does not come back with a white box behind it in dark mode.
 */
async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });

  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the image');

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the image'))), 'image/png'),
  );
}

export function ImageCropper({
  file,
  onCancel,
  onCropped,
  busy,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (cropped: File) => void;
  busy?: boolean;
}) {
  const [src, setSrc] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  // Object URLs are not garbage collected on their own; hold one only while this modal is open.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const save = async () => {
    if (!area) return;
    setError('');
    setWorking(true);
    try {
      const blob = await cropToBlob(src, area);
      onCropped(new File([blob], 'avatar.png', { type: 'image/png' }));
    } catch (e) {
      setError((e as Error).message);
      setWorking(false);
    }
  };

  const pending = working || busy;

  return (
    <Modal
      title="Position your photo"
      description="Drag to move, pinch or use the slider to zoom. The circle is what people will see."
      onClose={onCancel}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} disabled={pending} className="btn-ghost btn-sm">
            Cancel
          </button>
          <button onClick={save} disabled={pending || !area} className="btn-primary btn-sm">
            {pending ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="relative h-64 w-full overflow-hidden rounded-xl bg-black/80">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <label className="flex items-center gap-3">
          <span className="text-xs text-ink-muted">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-ink/[0.12] accent-primary"
          />
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
