import api from '@/services/api';
import { DEMO_MODE_ENABLED, localFallbackEnabled } from '@/services/demoMode';
import { unwrapApiData } from '@/services/serviceUtils';

export interface WeatherLookupPoint {
  label: string;
  latitude?: number;
  longitude?: number;
  searchLabels?: string[];
}

export interface WeatherSnapshot {
  id: string;
  label: string;
  temperatureF: number;
  condition: string;
  windMph: number;
  provider?: 'demo' | 'nws' | 'openweather' | 'openmeteo';
  providerLabel?: string;
  observedAtIso?: string;
  checkedAtIso?: string;
  freshnessSeconds?: number | null;
  isStale?: boolean;
  conditionCode?: number;
  iconCode?: string;
  isDaytime?: boolean;
  airQuality?: AirQualitySnapshot;
}

export interface AirQualitySnapshot {
  index: number;
  label: string;
  scale: 'openweather' | 'us';
}

interface OpenWeatherMapWeatherResponse {
  name?: string;
  coord?: {
    lat?: number;
    lon?: number;
  };
  main?: {
    temp?: number;
  };
  weather?: Array<{
    id?: number;
    description?: string;
    main?: string;
    icon?: string;
  }>;
  wind?: {
    speed?: number;
  };
  dt?: number;
  sys?: {
    sunrise?: number;
    sunset?: number;
  };
}

interface OpenWeatherMapAirPollutionResponse {
  list?: Array<{
    main?: {
      aqi?: number;
    };
  }>;
}

interface OpenMeteoGeocodeResponse {
  results?: Array<{
    name?: string;
    admin1?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

interface OpenMeteoForecastResponse {
  current?: {
    time?: number | string;
    temperature_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
    is_day?: number;
  };
}

interface OpenMeteoAirQualityResponse {
  current?: {
    us_aqi?: number;
  };
}

interface BackendCurrentWeatherResponse {
  label?: string | null;
  latitude?: number;
  longitude?: number;
  temperatureF?: number;
  condition?: string;
  windMph?: number;
  provider?: 'nws' | 'openweather' | 'openmeteo';
  providerLabel?: string;
  observedAtIso?: string;
  checkedAtIso?: string;
  freshnessSeconds?: number | null;
  isStale?: boolean;
  weatherCode?: number;
  conditionCode?: number;
  iconCode?: string;
  isDaytime?: boolean;
  airQuality?: AirQualitySnapshot | null;
}

const OPEN_WEATHER_MAP_URL = 'https://api.openweathermap.org/data/2.5/weather';
const OPEN_WEATHER_MAP_AIR_POLLUTION_URL = 'https://api.openweathermap.org/data/2.5/air_pollution';
const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
let openWeatherMapUnavailable = false;
const DEMO_WEATHER_ENABLED = DEMO_MODE_ENABLED && localFallbackEnabled('VITE', 'ENABLE', 'DEMO', 'WEATHER');
const CLIENT_WEATHER_FALLBACK_ENABLED = localFallbackEnabled('VITE', 'ENABLE', 'CLIENT', 'WEATHER', 'FALLBACK');

function getOpenWeatherMapApiKey(): string {
  return import.meta.env.VITE_OPENWEATHERMAP_API_KEY?.trim() ?? '';
}

function normalizeBackendWeatherSnapshot(point: WeatherLookupPoint, body: BackendCurrentWeatherResponse): WeatherSnapshot {
  const temperature = getOptionalWeatherNumber(body.temperatureF);
  const windSpeed = getOptionalWeatherNumber(body.windMph);
  const condition = normalizeCondition(body.condition);
  if (temperature === null || windSpeed === null) {
    throw new Error('Weather is unavailable right now.');
  }

  const conditionCode = getOptionalWeatherNumber(body.conditionCode ?? body.weatherCode);
  const freshnessSeconds = getOptionalWeatherNumber(body.freshnessSeconds);
  const resolvedLabel = point.label.trim() || body.label?.trim() || 'Route point';
  return {
    id: `${resolvedLabel}:${body.latitude ?? point.latitude ?? ''}:${body.longitude ?? point.longitude ?? ''}`,
    label: resolvedLabel,
    temperatureF: temperature,
    condition,
    windMph: windSpeed,
    provider: body.provider ?? 'openmeteo',
    providerLabel: body.providerLabel ?? 'Scope weather',
    ...(body.observedAtIso ? { observedAtIso: body.observedAtIso } : {}),
    ...(body.checkedAtIso ? { checkedAtIso: body.checkedAtIso } : {}),
    ...(freshnessSeconds !== null ? { freshnessSeconds } : {}),
    ...(typeof body.isStale === 'boolean' ? { isStale: body.isStale } : {}),
    ...(conditionCode !== null ? { conditionCode } : {}),
    ...(body.iconCode ? { iconCode: body.iconCode } : {}),
    ...(typeof body.isDaytime === 'boolean' ? { isDaytime: body.isDaytime } : {}),
    ...(body.airQuality ? { airQuality: body.airQuality } : {}),
  };
}

async function getBackendCurrentWeatherSnapshot(point: WeatherLookupPoint): Promise<WeatherSnapshot> {
  const label = point.label.trim();
  if (!label && !hasCoordinatePair(point.latitude, point.longitude)) {
    throw new Error('Weather location is missing.');
  }

  const params: Record<string, string | number> = {};
  if (hasCoordinatePair(point.latitude, point.longitude)) {
    params.lat = Number(point.latitude);
    params.lng = Number(point.longitude);
  }
  if (label) {
    params.q = label;
  }

  const { data } = await api.get('/api/intel/weather/current', { params });
  return normalizeBackendWeatherSnapshot(point, unwrapApiData(data) as BackendCurrentWeatherResponse);
}

function buildLocalWeatherSnapshot(point: WeatherLookupPoint): WeatherSnapshot {
  const latitude = getOptionalWeatherNumber(point.latitude) ?? 32;
  const longitude = getOptionalWeatherNumber(point.longitude) ?? -97;
  const label = point.label.trim() || 'Map preview';
  const temperatureOffset = Math.round((Math.abs(latitude) + Math.abs(longitude)) % 11);
  const conditionCode = Math.round((Math.abs(latitude * longitude)) % 4);
  const condition = ['Clear', 'Partly Cloudy', 'Current Conditions', 'Breezy'][conditionCode] ?? 'Current Conditions';

  return {
    id: `local-weather:${label}:${latitude.toFixed(2)}:${longitude.toFixed(2)}`,
    label,
    temperatureF: 66 + temperatureOffset,
    condition,
    windMph: 6 + Math.round(Math.abs(longitude) % 8),
    provider: 'local',
    providerLabel: 'Scope local weather',
    conditionCode,
    isDaytime: true,
  };
}

function hasCoordinatePair(latitude: number | undefined, longitude: number | undefined): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && Number(latitude) >= -90
    && Number(latitude) <= 90
    && Number(longitude) >= -180
    && Number(longitude) <= 180;
}

function normalizeCondition(value: string | undefined): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return 'Current conditions';
  }

  return normalizedValue.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getOptionalWeatherNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getOpenWeatherAirQualityLabel(index: number): string {
  switch (index) {
    case 1:
      return 'Good';
    case 2:
      return 'Fair';
    case 3:
      return 'Moderate';
    case 4:
      return 'Poor';
    case 5:
      return 'Very Poor';
    default:
      return 'Unknown';
  }
}

function getUsAirQualityLabel(index: number): string {
  if (index <= 50) {
    return 'Good';
  }

  if (index <= 100) {
    return 'Moderate';
  }

  if (index <= 150) {
    return 'Sensitive';
  }

  if (index <= 200) {
    return 'Unhealthy';
  }

  if (index <= 300) {
    return 'Very Unhealthy';
  }

  return 'Hazardous';
}

function normalizeOpenWeatherAirQuality(index: unknown): AirQualitySnapshot | null {
  const airQualityIndex = getOptionalWeatherNumber(index);
  if (airQualityIndex === null) {
    return null;
  }

  const roundedIndex = Math.round(airQualityIndex);
  if (roundedIndex < 1 || roundedIndex > 5) {
    return null;
  }

  return {
    index: roundedIndex,
    label: getOpenWeatherAirQualityLabel(roundedIndex),
    scale: 'openweather',
  };
}

function normalizeUsAirQuality(index: unknown): AirQualitySnapshot | null {
  const airQualityIndex = getOptionalWeatherNumber(index);
  if (airQualityIndex === null || airQualityIndex < 0) {
    return null;
  }

  const roundedIndex = Math.round(airQualityIndex);
  return {
    index: roundedIndex,
    label: getUsAirQualityLabel(roundedIndex),
    scale: 'us',
  };
}

function getOpenMeteoCondition(code: number): string {
  if (code === 0) {
    return 'Clear';
  }

  if ([1, 2, 3].includes(code)) {
    return 'Partly Cloudy';
  }

  if ([45, 48].includes(code)) {
    return 'Fog';
  }

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return 'Rain';
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return 'Snow';
  }

  if ([95, 96, 99].includes(code)) {
    return 'Thunderstorms';
  }

  return 'Current Conditions';
}

function normalizeIconCode(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function normalizeIsDaytime(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 1 || value === '1') {
    return true;
  }

  if (value === 0 || value === '0') {
    return false;
  }

  return null;
}

function normalizeIsoDateTime(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const normalizedValue = value.includes('T') ? value : value.replace(' ', 'T');
  const parsedDate = new Date(normalizedValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function normalizeUnixTimestampIso(value: unknown): string | null {
  const timestamp = getOptionalWeatherNumber(value);
  if (timestamp === null) {
    return null;
  }

  const parsedDate = new Date(timestamp * 1000);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function resolveOpenWeatherIsDaytime(body: OpenWeatherMapWeatherResponse): boolean | null {
  const iconCode = normalizeIconCode(body.weather?.[0]?.icon);
  if (iconCode?.endsWith('d')) {
    return true;
  }

  if (iconCode?.endsWith('n')) {
    return false;
  }

  const observationTime = getOptionalWeatherNumber(body.dt);
  const sunrise = getOptionalWeatherNumber(body.sys?.sunrise);
  const sunset = getOptionalWeatherNumber(body.sys?.sunset);
  if (observationTime === null || sunrise === null || sunset === null) {
    return null;
  }

  return observationTime >= sunrise && observationTime < sunset;
}

function uniqueLabels(labels: string[]): string[] {
  const seenLabels = new Set<string>();

  return labels
    .map((label) => label.trim())
    .filter((label) => {
      const normalizedLabel = label.toLowerCase();
      if (!normalizedLabel || seenLabels.has(normalizedLabel)) {
        return false;
      }

      seenLabels.add(normalizedLabel);
      return true;
    });
}

function buildDerivedSearchLabels(label: string): string[] {
  const segments = label
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    return [];
  }

  return [
    segments.slice(-2).join(', '),
    segments[segments.length - 1] ?? '',
    segments[0] ?? '',
  ];
}

function buildSearchLabels(point: WeatherLookupPoint): string[] {
  return uniqueLabels([
    point.label,
    ...(point.searchLabels ?? []),
    ...buildDerivedSearchLabels(point.label),
  ]);
}

function buildWeatherUrl(point: WeatherLookupPoint, apiKey: string, queryLabel: string): URL {
  const url = new URL(OPEN_WEATHER_MAP_URL);
  url.searchParams.set('appid', apiKey);
  url.searchParams.set('units', 'imperial');

  if (hasCoordinatePair(point.latitude, point.longitude)) {
    url.searchParams.set('lat', String(point.latitude));
    url.searchParams.set('lon', String(point.longitude));
    return url;
  }

  url.searchParams.set('q', queryLabel);
  return url;
}

function buildAirPollutionUrl(latitude: number, longitude: number, apiKey: string): URL {
  const url = new URL(OPEN_WEATHER_MAP_AIR_POLLUTION_URL);
  url.searchParams.set('appid', apiKey);
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  return url;
}

async function getOpenWeatherAirQualitySnapshot(
  point: WeatherLookupPoint,
  apiKey: string,
  weatherBody?: OpenWeatherMapWeatherResponse | null,
): Promise<AirQualitySnapshot | null> {
  const latitude = getOptionalWeatherNumber(point.latitude) ?? getOptionalWeatherNumber(weatherBody?.coord?.lat);
  const longitude = getOptionalWeatherNumber(point.longitude) ?? getOptionalWeatherNumber(weatherBody?.coord?.lon);
  if (!hasCoordinatePair(latitude ?? undefined, longitude ?? undefined)) {
    return null;
  }

  const response = await fetch(buildAirPollutionUrl(Number(latitude), Number(longitude), apiKey).toString());
  const body = await response.json().catch(() => null) as OpenWeatherMapAirPollutionResponse | null;
  if (response.status === 401 || response.status === 403 || response.status === 429) {
    openWeatherMapUnavailable = true;
    return null;
  }

  if (!response.ok || !body) {
    return null;
  }

  return normalizeOpenWeatherAirQuality(body.list?.[0]?.main?.aqi);
}

async function getOpenMeteoAirQualitySnapshot(point: WeatherLookupPoint): Promise<AirQualitySnapshot | null> {
  const resolvedPoint = await resolveOpenMeteoPoint(point);
  const url = new URL(OPEN_METEO_AIR_QUALITY_URL);
  url.searchParams.set('latitude', String(resolvedPoint.latitude));
  url.searchParams.set('longitude', String(resolvedPoint.longitude));
  url.searchParams.set('current', 'us_aqi');

  const response = await fetch(url.toString());
  const body = await response.json().catch(() => null) as OpenMeteoAirQualityResponse | null;
  if (!response.ok || !body?.current) {
    return null;
  }

  return normalizeUsAirQuality(body.current.us_aqi);
}

async function resolveOpenMeteoPoint(point: WeatherLookupPoint): Promise<WeatherLookupPoint & { latitude: number; longitude: number }> {
  const label = point.label.trim();
  if (hasCoordinatePair(point.latitude, point.longitude)) {
    return {
      label: label || 'Route point',
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    };
  }

  if (!label) {
    throw new Error('Weather location is missing.');
  }

  for (const searchLabel of buildSearchLabels(point)) {
    const url = new URL(OPEN_METEO_GEOCODING_URL);
    url.searchParams.set('name', searchLabel);
    url.searchParams.set('count', '1');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString());
    const body = await response.json().catch(() => null) as OpenMeteoGeocodeResponse | null;
    const result = body?.results?.[0];
    if (response.ok && result && hasCoordinatePair(result.latitude, result.longitude)) {
      return {
        label: [result.name, result.admin1, result.country].filter(Boolean).join(', ') || label,
        latitude: Number(result.latitude),
        longitude: Number(result.longitude),
      };
    }
  }

  throw new Error('Weather is unavailable right now.');
}

async function getOpenMeteoSnapshot(point: WeatherLookupPoint): Promise<WeatherSnapshot> {
  const resolvedPoint = await resolveOpenMeteoPoint(point);
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set('latitude', String(resolvedPoint.latitude));
  url.searchParams.set('longitude', String(resolvedPoint.longitude));
  url.searchParams.set('current', 'temperature_2m,weather_code,wind_speed_10m,is_day');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('timeformat', 'unixtime');

  const response = await fetch(url.toString());
  const body = await response.json().catch(() => null) as OpenMeteoForecastResponse | null;
  if (!response.ok || !body?.current) {
    throw new Error('Weather is unavailable right now.');
  }

  const temperature = getOptionalWeatherNumber(body.current.temperature_2m);
  const windSpeed = getOptionalWeatherNumber(body.current.wind_speed_10m);
  const weatherCode = getOptionalWeatherNumber(body.current.weather_code);
  if (temperature === null || windSpeed === null || weatherCode === null) {
    throw new Error('Weather is unavailable right now.');
  }

  const resolvedLabel = point.label.trim() || resolvedPoint.label;
  const airQuality = await getOpenMeteoAirQualitySnapshot(resolvedPoint).catch(() => null);
  const isDaytime = normalizeIsDaytime(body.current.is_day);
  const observedAtIso = normalizeUnixTimestampIso(body.current.time) ?? normalizeIsoDateTime(body.current.time);
  return {
    id: `${resolvedLabel}:${resolvedPoint.latitude}:${resolvedPoint.longitude}`,
    label: resolvedLabel,
    temperatureF: temperature,
    condition: getOpenMeteoCondition(weatherCode),
    windMph: windSpeed,
    provider: 'openmeteo',
    providerLabel: 'Open-Meteo',
    ...(observedAtIso ? { observedAtIso } : {}),
    checkedAtIso: new Date().toISOString(),
    conditionCode: weatherCode,
    ...(isDaytime !== null ? { isDaytime } : {}),
    ...(airQuality ? { airQuality } : {}),
  };
}

export function canLoadOpenWeatherMapWeather(): boolean {
  return typeof fetch === 'function';
}

export async function getOpenWeatherMapSnapshot(point: WeatherLookupPoint): Promise<WeatherSnapshot> {
  const apiKey = getOpenWeatherMapApiKey();
  const label = point.label.trim();

  if (!label && !hasCoordinatePair(point.latitude, point.longitude)) {
    throw new Error('Weather location is missing.');
  }

  if (DEMO_WEATHER_ENABLED) {
    return buildLocalWeatherSnapshot({ ...point, label });
  }

  try {
    return await getBackendCurrentWeatherSnapshot({ ...point, label });
  } catch {
    if (!CLIENT_WEATHER_FALLBACK_ENABLED) {
      throw new Error('Weather is unavailable right now.');
    }
  }

  if (apiKey && !openWeatherMapUnavailable) {
    const searchLabels = buildSearchLabels({ ...point, label });

    for (const searchLabel of searchLabels) {
      try {
        const response = await fetch(buildWeatherUrl({ ...point, label }, apiKey, searchLabel).toString());
        const body = await response.json().catch(() => null) as OpenWeatherMapWeatherResponse | null;
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          openWeatherMapUnavailable = true;
          break;
        }

        if (!response.ok || !body) {
          continue;
        }

        const temperature = getOptionalWeatherNumber(body.main?.temp);
        const windSpeed = getOptionalWeatherNumber(body.wind?.speed);
        const condition = normalizeCondition(body.weather?.[0]?.description ?? body.weather?.[0]?.main);
        if (temperature === null || windSpeed === null || !body.weather?.length) {
          continue;
        }

        const resolvedLabel = label || body.name?.trim() || 'Route point';
        const openWeatherAirQuality = await getOpenWeatherAirQualitySnapshot({ ...point, label }, apiKey, body)
          .catch(() => null);
        const airQuality = openWeatherAirQuality ?? await getOpenMeteoAirQualitySnapshot({
          ...point,
          label: resolvedLabel,
          latitude: point.latitude ?? body.coord?.lat,
          longitude: point.longitude ?? body.coord?.lon,
        }).catch(() => null);
        const conditionCode = getOptionalWeatherNumber(body.weather?.[0]?.id);
        const iconCode = normalizeIconCode(body.weather?.[0]?.icon);
        const isDaytime = resolveOpenWeatherIsDaytime(body);
        const observedAtIso = normalizeUnixTimestampIso(body.dt);
        return {
          id: `${resolvedLabel}:${point.latitude ?? ''}:${point.longitude ?? ''}`,
          label: resolvedLabel,
          temperatureF: temperature,
          condition,
          windMph: windSpeed,
          provider: 'openweather',
          providerLabel: 'OpenWeatherMap',
          ...(observedAtIso ? { observedAtIso } : {}),
          checkedAtIso: new Date().toISOString(),
          ...(conditionCode !== null ? { conditionCode } : {}),
          ...(iconCode ? { iconCode } : {}),
          ...(isDaytime !== null ? { isDaytime } : {}),
          ...(airQuality ? { airQuality } : {}),
        };
      } catch {
        openWeatherMapUnavailable = true;
        break;
      }
    }
  }

  return getOpenMeteoSnapshot({ ...point, label });
}
