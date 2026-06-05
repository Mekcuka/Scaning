export function quarryId(objectId: string): string {
  return `q:${objectId}`;
}

export function consumerId(objectId: string): string {
  return `c:${objectId}`;
}

export function networkNodeId(nodeId: string): string {
  return `n:${nodeId}`;
}

export function segmentKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
