/** User-facing Russian messages for OpenTopography / DEM API error codes from backend. */
export function formatDemApiError(message: string): string {
  if (message.includes('dem_api_key_invalid_format')) {
    return 'Неверный формат API-ключа OpenTopography: нужна 32-символьная hex-строка из myOpenTopo (не UUID).';
  }
  if (message.includes('dem_api_key_invalid') || message.includes('dem_api_key_unauthorized')) {
    return 'API-ключ OpenTopography отклонён. Проверьте OPENTOPOGRAPHY_API_KEY в backend/.env и перезапустите сервер.';
  }
  if (message.includes('dem_api_not_configured')) {
    return 'ЦМР недоступен: не настроен ключ OpenTopography (OPENTOPOGRAPHY_API_KEY). Обратитесь к администратору.';
  }
  if (message.includes('dem_bbox_too_small') || message.includes('dem_fetch_bad_request')) {
    return 'Не удалось загрузить ЦМР: слишком маленькая область запроса. Попробуйте увеличить габариты объекта.';
  }
  if (message.includes('dem_rate_limit_exceeded')) {
    return 'Превышен лимит запросов OpenTopography. Попробуйте позже.';
  }
  if (message.includes('dem_fetch_empty_response') || message.includes('dem_fetch_not_geotiff')) {
    return 'Не удалось загрузить ЦМР: сервер OpenTopography вернул некорректный ответ.';
  }
  if (message.includes('dem_fetch_failed') || message.includes('dem_invalid_geotiff')) {
    return 'Не удалось загрузить или прочитать файл ЦМР. Попробуйте позже или обратитесь к администратору.';
  }
  if (message.includes('dem_elevation_sample_failed')) {
    return 'Не удалось снять отметки с ЦМР для линии. Проверьте геометрию и повторите расчёт.';
  }
  if (message.includes('dem_not_loaded')) {
    return 'ЦМР не загружен. Сначала загрузите ЦМР для площадки.';
  }
  return message || 'Ошибка загрузки ЦМР';
}
