export function formatPoiNum(value: number, fractionDigits = 1): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: fractionDigits });
}
