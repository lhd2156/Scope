import type { WeatherSnapshot } from '@/services/openWeatherMapService';

export type WeatherConditionKind =
  | 'clear-day'
  | 'clear-night'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'wind';

export type WeatherDisplayInput = Pick<WeatherSnapshot, 'condition' | 'iconCode' | 'isDaytime'>;

function isNightWeather(input: WeatherDisplayInput): boolean {
  if (typeof input.isDaytime === 'boolean') {
    return !input.isDaytime;
  }

  const iconCode = input.iconCode?.trim().toLowerCase();
  if (iconCode?.endsWith('n')) {
    return true;
  }

  if (iconCode?.endsWith('d')) {
    return false;
  }

  return /\b(night|overnight)\b/i.test(input.condition);
}

export function resolveWeatherConditionKind(input: WeatherDisplayInput): WeatherConditionKind {
  const normalizedCondition = input.condition.toLowerCase();

  if (normalizedCondition.includes('thunder') || normalizedCondition.includes('storm') || normalizedCondition.includes('squall')) {
    return 'storm';
  }

  if (normalizedCondition.includes('rain') || normalizedCondition.includes('drizzle') || normalizedCondition.includes('shower')) {
    return 'rain';
  }

  if (normalizedCondition.includes('snow') || normalizedCondition.includes('sleet') || normalizedCondition.includes('hail')) {
    return 'snow';
  }

  if (normalizedCondition.includes('fog') || normalizedCondition.includes('mist') || normalizedCondition.includes('haze') || normalizedCondition.includes('smoke')) {
    return 'fog';
  }

  if (normalizedCondition.includes('wind')) {
    return 'wind';
  }

  if (normalizedCondition.includes('clear') || normalizedCondition.includes('sun')) {
    return isNightWeather(input) ? 'clear-night' : 'clear-day';
  }

  return 'cloudy';
}

export function getWeatherSnapshotIconName(input: WeatherDisplayInput): string {
  const conditionKind = resolveWeatherConditionKind(input);

  if (conditionKind === 'clear-day') {
    return 'sun';
  }

  if (conditionKind === 'clear-night') {
    return 'moon';
  }

  if (conditionKind === 'rain') {
    return 'cloud-rain';
  }

  if (conditionKind === 'snow') {
    return 'cloud-snow';
  }

  if (conditionKind === 'storm') {
    return 'cloud-lightning';
  }

  if (conditionKind === 'fog') {
    return 'cloud-fog';
  }

  if (conditionKind === 'wind') {
    return 'wind';
  }

  return 'weather';
}

export function getWeatherSnapshotClassName(input: WeatherDisplayInput): string {
  const conditionKind = resolveWeatherConditionKind(input);
  return conditionKind === 'clear-day' ? 'is-clear' : `is-${conditionKind}`;
}
