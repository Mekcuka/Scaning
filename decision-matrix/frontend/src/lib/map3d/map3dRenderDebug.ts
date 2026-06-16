let passesThisFinish = 0;

export function noteMap3dRenderPass(): void {
  passesThisFinish++;
}

export function consumeMap3dRenderPasses(): number {
  const n = passesThisFinish;
  passesThisFinish = 0;
  return n;
}

export function map3dDebugPassesEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_MAP3D_DEBUG === 'true';
}
