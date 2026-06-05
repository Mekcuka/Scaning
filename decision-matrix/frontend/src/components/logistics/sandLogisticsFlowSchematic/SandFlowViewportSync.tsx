import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';

/** Применяет viewport внутри ReactFlow (useReactFlow только здесь). */
export function SandFlowViewportSync({
  viewport,
}: {
  viewport: { x: number; y: number; zoom: number };
}) {
  const { setViewport } = useReactFlow();

  useEffect(() => {
    setViewport(viewport, { duration: 0 });
  }, [viewport, setViewport]);

  return null;
}
