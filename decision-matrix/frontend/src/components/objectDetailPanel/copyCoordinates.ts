export async function copyCoordinates(
  lon: string,
  lat: string,
  pushToast: (type: 'success' | 'error', message: string) => void,
) {
  const text = `${lon}, ${lat}`;
  try {
    await navigator.clipboard.writeText(text);
    pushToast('success', 'Координаты скопированы');
  } catch {
    pushToast('error', 'Не удалось скопировать');
  }
}
