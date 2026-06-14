export function parsePositive(raw: string): number | null {
  const t = raw.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function formatPadDemError(message: string): string {
  if (message.includes('dem_api_key_invalid_format')) {
    return 'Неверный формат API-ключа OpenTopography: нужна 32-символьная hex-строка из myOpenTopo (не UUID).';
  }
  if (message.includes('dem_api_key_invalid') || message.includes('dem_api_key_unauthorized')) {
    return 'API-ключ OpenTopography отклонён. Проверьте OPENTOPOGRAPHY_API_KEY в backend/.env и перезапустите сервер.';
  }
  if (message.includes('dem_api_not_configured')) {
    return 'DEM не настроен: задайте OPENTOPOGRAPHY_API_KEY в backend/.env.';
  }
  if (message.includes('dem_bbox_too_small') || message.includes('dem_fetch_bad_request')) {
    return 'Не удалось загрузить DEM: слишком маленькая область запроса. Попробуйте увеличить габариты площадки.';
  }
  if (message.includes('dem_rate_limit_exceeded')) {
    return 'Превышен лимит запросов OpenTopography. Попробуйте позже.';
  }
  return message || 'Ошибка загрузки DEM';
}

export function formatSavedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('ru-RU');
}
