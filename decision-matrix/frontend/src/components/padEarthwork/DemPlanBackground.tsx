import { useEffect, useRef } from 'react';
import { renderDemPreviewOnCanvas, type PadDemPreview } from '../../lib/padEarthworkDemPreview';

interface DemPlanBackgroundProps {
  preview: PadDemPreview | null;
  viewHalf: number;
  pan?: { east_m: number; north_m: number };
  loading?: boolean;
}

export function DemPlanBackground({
  preview,
  viewHalf,
  pan = { east_m: 0, north_m: 0 },
  loading = false,
}: DemPlanBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !preview) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      renderDemPreviewOnCanvas(ctx, preview, viewHalf, pan);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [preview, viewHalf, pan]);

  if (!preview && !loading) return null;

  return (
    <div ref={containerRef} className="pad-earthwork-sketch-editor__dem-wrap" aria-hidden={!preview}>
      <canvas ref={canvasRef} className="pad-earthwork-sketch-editor__dem-canvas" />
      {loading && (
        <div className="pad-earthwork-sketch-editor__dem-loading text-xs">Загрузка рельефа…</div>
      )}
    </div>
  );
}
