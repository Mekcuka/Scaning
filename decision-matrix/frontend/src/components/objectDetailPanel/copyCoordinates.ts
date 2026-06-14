export async function copyCoordinates(
  lon: string,
  lat: string,
  pushToast: (type: 'success' | 'error', message: string) => void,
) {
  await copyTextToClipboard(`${lon}, ${lat}`, pushToast);
}

export async function copyTextToClipboard(
  text: string,
  pushToast: (type: 'success' | 'error', message: string) => void,
) {
  try {
    await navigator.clipboard.writeText(text);
    pushToast('success', 'Координаты скопированы');
  } catch {
    pushToast('error', 'Не удалось скопировать');
  }
}
