type RuntimeMode = 'wasm' | 'js-fallback';
export type ScopeAiLexTokenType =
  | 'word'
  | 'number'
  | 'email'
  | 'handle'
  | 'filler'
  | 'map_keyword'
  | 'zoom_keyword'
  | 'zoom_direction'
  | 'map_control'
  | 'map_style'
  | 'document_action'
  | 'endpoint_keyword'
  | 'role'
  | 'place_span';

const TILE_SIZE = 512;
const EARTH_RADIUS_KM = 6371.0088;
const PI = Math.PI;
const MERCATOR_MAX_LATITUDE = 85.05112878;
const DEFAULT_CLUSTER_RADIUS_PX = 64;
const DEFAULT_MIN_CLUSTER_POINTS = 2;
const SCOPE_WASM_MODULE_CANDIDATES = ['scope_wasm.js', 'scope_wasm.generated.js'] as const;

export interface ScopeWasmModuleInfo {
  version: string;
  algorithmsReady: boolean;
  status: string;
  runtimeMode: RuntimeMode;
  fallbackReason?: string;
}

export interface ScopeWasmCoordinateInput {
  id?: string;
  latitude?: number;
  lat?: number;
  longitude?: number;
  lng?: number;
  lon?: number;
}

export interface ScopeWasmViewport {
  west: number;
  south: number;
  east: number;
  north: number;
  width: number;
  height: number;
  zoom: number;
}

export interface ScopeWasmClusterOptions {
  radiusPx?: number;
  minPoints?: number;
  includeSingles?: boolean;
}

export interface ScopeWasmDistanceResult {
  valid: boolean;
  fromId: string;
  toId: string;
  kilometers: number;
  miles: number;
  meters: number;
}

export interface ScopeWasmClusterResult {
  id: string;
  clustered: boolean;
  pointCount: number;
  latitude: number;
  longitude: number;
  screenX: number;
  screenY: number;
  minScreenX: number;
  minScreenY: number;
  maxScreenX: number;
  maxScreenY: number;
  pointIds: string[];
}

export interface ScopeWasmHullPoint {
  id: string;
  latitude: number;
  longitude: number;
  screenX: number;
  screenY: number;
}

export interface ScopeWasmHullResult {
  valid: boolean;
  pointCount: number;
  hullPointCount: number;
  latitude: number;
  longitude: number;
  screenX: number;
  screenY: number;
  minScreenX: number;
  minScreenY: number;
  maxScreenX: number;
  maxScreenY: number;
  areaSquarePx: number;
  perimeterPx: number;
  pointIds: string[];
  hullPointIds: string[];
  hull: ScopeWasmHullPoint[];
}

export interface ScopeAiLexToken {
  type: ScopeAiLexTokenType;
  value: string;
  normalized: string;
  start: number;
  end: number;
}

interface NormalizedGeographicPoint {
  id: string;
  latitude: number;
  longitude: number;
  valid: boolean;
}

interface ProjectedPoint {
  id: string;
  latitude: number;
  longitude: number;
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
}

interface ViewportProjectionContext {
  viewport: ScopeWasmViewport;
  crossesAntimeridian: boolean;
  adjustedEast: number;
  westWorldX: number;
  eastWorldX: number;
  northWorldY: number;
  southWorldY: number;
  xSpan: number;
  ySpan: number;
}

interface RawScopeWasmModuleInfo {
  version: string;
  algorithmsReady: boolean;
  status: string;
}

interface ScopeWasmBindings {
  ping: () => string;
  getModuleInfo: () => RawScopeWasmModuleInfo;
  calculateHaversineDistance: (
    from: ScopeWasmCoordinateInput,
    to: ScopeWasmCoordinateInput,
  ) => ScopeWasmDistanceResult;
  clusterViewportPoints: (
    points: ScopeWasmCoordinateInput[],
    viewport: ScopeWasmViewport,
    options?: ScopeWasmClusterOptions,
  ) => ScopeWasmClusterResult[] | ArrayLike<ScopeWasmClusterResult>;
  buildViewportConvexHull: (
    points: ScopeWasmCoordinateInput[],
    viewport: ScopeWasmViewport,
  ) => ScopeWasmHullResult;
  lexScopeAiCommandText?: (input: string) => ScopeAiLexToken[] | ArrayLike<ScopeAiLexToken>;
}

interface ScopeWasmFactoryConfig {
  locateFile?: (path: string) => string;
}

type ScopeWasmFactory = (config?: ScopeWasmFactoryConfig) => Promise<ScopeWasmBindings> | ScopeWasmBindings;

interface ScopeWasmRuntime {
  mode: RuntimeMode;
  bindings: ScopeWasmBindings;
  fallbackReason?: string;
}

class DisjointSet {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = Array.from({ length: size }, () => 0);
  }

  find(index: number): number {
    if (this.parent[index] === index) {
      return index;
    }

    this.parent[index] = this.find(this.parent[index]);
    return this.parent[index];
  }

  unite(left: number, right: number) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);

    if (leftRoot === rightRoot) {
      return;
    }

    if (this.rank[leftRoot] < this.rank[rightRoot]) {
      this.parent[leftRoot] = rightRoot;
      return;
    }

    if (this.rank[leftRoot] > this.rank[rightRoot]) {
      this.parent[rightRoot] = leftRoot;
      return;
    }

    this.parent[rightRoot] = leftRoot;
    this.rank[leftRoot] += 1;
  }
}

let runtimePromise: Promise<ScopeWasmRuntime> | null = null;
let readyRuntime: ScopeWasmRuntime | null = null;

const SCOPE_AI_LEXER_TOKEN_TYPES = new Set<ScopeAiLexTokenType>([
  'word',
  'number',
  'email',
  'handle',
  'filler',
  'map_keyword',
  'zoom_keyword',
  'zoom_direction',
  'map_control',
  'map_style',
  'document_action',
  'endpoint_keyword',
  'role',
  'place_span',
]);

const SCOPE_AI_LEXER_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'around',
  'at',
  'can',
  'could',
  'for',
  'from',
  'in',
  'into',
  'it',
  'me',
  'my',
  'of',
  'on',
  'please',
  'pls',
  'that',
  'the',
  'this',
  'to',
  'with',
  'you',
]);

const SCOPE_AI_LEXER_KEYWORD_TYPES: Record<string, ScopeAiLexTokenType> = {
  map: 'map_keyword',
  zoom: 'zoom_keyword',
  zooming: 'zoom_keyword',
  in: 'zoom_direction',
  into: 'zoom_direction',
  out: 'zoom_direction',
  reset: 'map_control',
  fit: 'map_control',
  locate: 'map_control',
  center: 'map_control',
  recenter: 'map_control',
  focus: 'map_control',
  show: 'map_control',
  switch: 'map_control',
  change: 'map_control',
  turn: 'map_control',
  toggle: 'map_control',
  light: 'map_style',
  bright: 'map_style',
  dark: 'map_style',
  save: 'document_action',
  share: 'document_action',
  invite: 'document_action',
  add: 'document_action',
  public: 'document_action',
  publish: 'document_action',
  private: 'document_action',
  unpublish: 'document_action',
  rename: 'document_action',
  name: 'document_action',
  title: 'document_action',
  call: 'document_action',
  delete: 'document_action',
  remove: 'document_action',
  clear: 'document_action',
  discard: 'document_action',
  confirm: 'document_action',
  start: 'endpoint_keyword',
  starting: 'endpoint_keyword',
  end: 'endpoint_keyword',
  destination: 'endpoint_keyword',
  final: 'endpoint_keyword',
  finish: 'endpoint_keyword',
  viewer: 'role',
  view: 'role',
  editor: 'role',
  edit: 'role',
};

const SCOPE_AI_LEXER_ALIASES: Record<string, string> = {
  mapp: 'map',
  mpa: 'map',
  maap: 'map',
  mappp: 'map',
  zom: 'zoom',
  zomm: 'zoom',
  zoome: 'zoom',
  zoomigng: 'zooming',
  zoomingg: 'zooming',
  into: 'in',
  cneter: 'center',
  centar: 'center',
  cener: 'center',
  reecenter: 'recenter',
  swtich: 'switch',
  swich: 'switch',
  swithc: 'switch',
  toggel: 'toggle',
  toggl: 'toggle',
  lokate: 'locate',
  lcoate: 'locate',
  locat: 'locate',
  fitt: 'fit',
  sahre: 'share',
  shrae: 'share',
  shar: 'share',
  shre: 'share',
  invte: 'invite',
  inivte: 'invite',
  invtie: 'invite',
  renmae: 'rename',
  reanme: 'rename',
  publc: 'public',
  pubilc: 'public',
  publci: 'public',
  publsh: 'publish',
  publsih: 'publish',
  privte: 'private',
  prvate: 'private',
  privat: 'private',
  privtae: 'private',
  viwer: 'viewer',
  vewer: 'viewer',
  edtor: 'editor',
  editr: 'editor',
  delte: 'delete',
  deleet: 'delete',
  delet: 'delete',
  remvoe: 'remove',
  cnfirm: 'confirm',
  resset: 'reset',
  reser: 'reset',
  strt: 'start',
  sstart: 'start',
  dest: 'destination',
  destnation: 'destination',
  destinaton: 'destination',
  destiantion: 'destination',
  destinatoin: 'destination',
  ligt: 'light',
  lite: 'light',
  brite: 'bright',
  brigth: 'bright',
  drak: 'dark',
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundToPrecision(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isScopeAiLexemeCharacter(value: string): boolean {
  return /^[A-Za-z0-9@._'-]$/.test(value);
}

function normalizeScopeAiLexeme(value: string): string {
  const normalized = value.toLowerCase().replace(/^'+|'+$/g, '');
  return SCOPE_AI_LEXER_ALIASES[normalized] ?? normalized;
}

function isScopeAiEmailLexeme(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isScopeAiHandleLexeme(value: string): boolean {
  return /^@[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(value) && !value.includes('.');
}

function classifyScopeAiLexeme(value: string, normalized: string): ScopeAiLexTokenType {
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    return 'number';
  }

  if (isScopeAiEmailLexeme(value)) {
    return 'email';
  }

  if (isScopeAiHandleLexeme(value)) {
    return 'handle';
  }

  const keywordType = SCOPE_AI_LEXER_KEYWORD_TYPES[normalized];
  if (keywordType) {
    return keywordType;
  }

  if (SCOPE_AI_LEXER_STOP_WORDS.has(normalized)) {
    return 'filler';
  }

  return 'word';
}

function isScopeAiPlaceCandidateToken(token: ScopeAiLexToken): boolean {
  return (token.type === 'word' || token.type === 'number') && token.normalized.length > 1;
}

function buildScopeAiPlaceSpanTokens(tokens: ScopeAiLexToken[]): ScopeAiLexToken[] {
  const spans: ScopeAiLexToken[] = [];
  let index = 0;

  while (index < tokens.length) {
    if (!isScopeAiPlaceCandidateToken(tokens[index])) {
      index += 1;
      continue;
    }

    const startIndex = index;
    let endIndex = index;
    index += 1;

    while (index < tokens.length && isScopeAiPlaceCandidateToken(tokens[index])) {
      endIndex = index;
      index += 1;
    }

    if (endIndex <= startIndex) {
      continue;
    }

    const spanTokens = tokens.slice(startIndex, endIndex + 1);
    spans.push({
      type: 'place_span',
      value: spanTokens.map((token) => token.value).join(' '),
      normalized: spanTokens.map((token) => token.normalized).join(' '),
      start: spanTokens[0].start,
      end: spanTokens[spanTokens.length - 1].end,
    });
  }

  return spans;
}

function lexScopeAiCommandTextFallback(input: string): ScopeAiLexToken[] {
  const tokens: ScopeAiLexToken[] = [];
  let index = 0;

  while (index < input.length) {
    while (index < input.length && !isScopeAiLexemeCharacter(input[index])) {
      index += 1;
    }

    if (index >= input.length) {
      break;
    }

    const start = index;
    while (index < input.length && isScopeAiLexemeCharacter(input[index])) {
      index += 1;
    }

    const end = index;
    const value = input.slice(start, end);
    const normalized = normalizeScopeAiLexeme(value);
    if (!normalized) {
      continue;
    }

    tokens.push({
      type: classifyScopeAiLexeme(value, normalized),
      value,
      normalized,
      start,
      end,
    });
  }

  return [...tokens, ...buildScopeAiPlaceSpanTokens(tokens)];
}

export function lexScopeAiCommandTextFallbackForTests(input: string): ScopeAiLexToken[] {
  return lexScopeAiCommandTextFallback(input);
}

function degreesToRadians(value: number): number {
  return (value * PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / PI;
}

function wrapLongitude(longitude: number): number {
  let wrappedLongitude = longitude;

  while (wrappedLongitude < -180) {
    wrappedLongitude += 360;
  }

  while (wrappedLongitude >= 180) {
    wrappedLongitude -= 360;
  }

  return wrappedLongitude;
}

function worldSizeForZoom(zoom: number): number {
  return TILE_SIZE * (2 ** Math.max(zoom, 0));
}

function mercatorWorldX(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * worldSizeForZoom(zoom);
}

function mercatorWorldY(latitude: number, zoom: number): number {
  const clampedLatitude = clamp(latitude, -MERCATOR_MAX_LATITUDE, MERCATOR_MAX_LATITUDE);
  const latitudeRadians = degreesToRadians(clampedLatitude);
  const mercatorProjection = Math.log(Math.tan((PI / 4) + (latitudeRadians / 2)));
  return (0.5 - (mercatorProjection / (2 * PI))) * worldSizeForZoom(zoom);
}

function worldXToLongitude(worldX: number, zoom: number): number {
  const worldSize = worldSizeForZoom(zoom);
  return wrapLongitude(((worldX / worldSize) * 360) - 180);
}

function worldYToLatitude(worldY: number, zoom: number): number {
  const worldSize = worldSizeForZoom(zoom);
  const normalized = 1 - ((2 * worldY) / worldSize);
  return radiansToDegrees(Math.atan(Math.sinh(PI * normalized)));
}

function hashCell(x: number, y: number): string {
  return `${x}:${y}`;
}

function buildClusterId(pointIds: string[]): string {
  const prime = 1099511628211n;
  const mask = (1n << 64n) - 1n;
  let hash = 1469598103934665603n;

  for (const pointId of pointIds) {
    for (const character of pointId) {
      hash ^= BigInt(character.charCodeAt(0));
      hash = (hash * prime) & mask;
    }

    hash ^= BigInt(':'.charCodeAt(0));
    hash = (hash * prime) & mask;
  }

  return `cluster-${hash.toString(16)}-${pointIds.length}`;
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseCoordinate(
  input: ScopeWasmCoordinateInput | null | undefined,
  fallbackId: string,
): NormalizedGeographicPoint {
  if (!input) {
    return {
      id: fallbackId,
      latitude: 0,
      longitude: 0,
      valid: false,
    };
  }

  const latitude = input.latitude ?? input.lat;
  const longitude = input.longitude ?? input.lng ?? input.lon;
  const id = typeof input.id === 'string' && input.id.trim() ? input.id : fallbackId;

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return {
      id,
      latitude: 0,
      longitude: 0,
      valid: false,
    };
  }

  return {
    id,
    latitude: clamp(latitude, -MERCATOR_MAX_LATITUDE, MERCATOR_MAX_LATITUDE),
    longitude: wrapLongitude(longitude),
    valid: true,
  };
}

function parseViewport(viewport: ScopeWasmViewport): ScopeWasmViewport {
  const south = Math.min(viewport.south, viewport.north);
  const north = Math.max(viewport.south, viewport.north);

  return {
    west: viewport.west,
    south,
    east: viewport.east,
    north,
    width: Math.max(viewport.width, 0),
    height: Math.max(viewport.height, 0),
    zoom: Math.max(viewport.zoom, 0),
  };
}

function parseClusterOptions(options: ScopeWasmClusterOptions = {}): Required<ScopeWasmClusterOptions> {
  return {
    radiusPx: Math.max(options.radiusPx ?? DEFAULT_CLUSTER_RADIUS_PX, 1),
    minPoints: Math.max(options.minPoints ?? DEFAULT_MIN_CLUSTER_POINTS, 2),
    includeSingles: options.includeSingles ?? true,
  };
}

function buildProjectionContext(viewport: ScopeWasmViewport): ViewportProjectionContext {
  const normalizedViewport = parseViewport(viewport);
  const crossesAntimeridian = normalizedViewport.east < normalizedViewport.west;
  const adjustedEast = crossesAntimeridian ? normalizedViewport.east + 360 : normalizedViewport.east;
  const westWorldX = mercatorWorldX(normalizedViewport.west, normalizedViewport.zoom);
  const eastWorldX = mercatorWorldX(adjustedEast, normalizedViewport.zoom);
  const northWorldY = mercatorWorldY(normalizedViewport.north, normalizedViewport.zoom);
  const southWorldY = mercatorWorldY(normalizedViewport.south, normalizedViewport.zoom);

  return {
    viewport: normalizedViewport,
    crossesAntimeridian,
    adjustedEast,
    westWorldX,
    eastWorldX,
    northWorldY,
    southWorldY,
    xSpan: Math.max(Math.abs(eastWorldX - westWorldX), 1e-9),
    ySpan: Math.max(Math.abs(southWorldY - northWorldY), 1e-9),
  };
}

function projectVisiblePoints(
  points: ScopeWasmCoordinateInput[],
  projectionContext: ViewportProjectionContext,
): ProjectedPoint[] {
  const { viewport } = projectionContext;
  if (viewport.width <= 0 || viewport.height <= 0) {
    return [];
  }

  const projectedPoints: ProjectedPoint[] = [];

  points.forEach((point, index) => {
    const geographicPoint = parseCoordinate(point, `point-${index}`);
    if (!geographicPoint.valid) {
      return;
    }

    let adjustedLongitude = geographicPoint.longitude;
    if (projectionContext.crossesAntimeridian) {
      while (adjustedLongitude < viewport.west) {
        adjustedLongitude += 360;
      }

      while (adjustedLongitude > projectionContext.adjustedEast) {
        adjustedLongitude -= 360;
      }
    }

    const worldX = mercatorWorldX(adjustedLongitude, viewport.zoom);
    const worldY = mercatorWorldY(geographicPoint.latitude, viewport.zoom);
    const screenX = ((worldX - projectionContext.westWorldX) / projectionContext.xSpan) * viewport.width;
    const screenY = ((worldY - projectionContext.northWorldY) / projectionContext.ySpan) * viewport.height;

    if (screenX < 0 || screenX > viewport.width || screenY < 0 || screenY > viewport.height) {
      return;
    }

    projectedPoints.push({
      id: geographicPoint.id,
      latitude: geographicPoint.latitude,
      longitude: geographicPoint.longitude,
      worldX,
      worldY,
      screenX: roundToPrecision(screenX),
      screenY: roundToPrecision(screenY),
    });
  });

  return projectedPoints.sort((left, right) => {
    if (left.screenY !== right.screenY) {
      return left.screenY - right.screenY;
    }

    if (left.screenX !== right.screenX) {
      return left.screenX - right.screenX;
    }

    return left.id.localeCompare(right.id);
  });
}

function screenToGeographic(
  projectionContext: ViewportProjectionContext,
  screenX: number,
  screenY: number,
): { latitude: number; longitude: number } {
  const clampedScreenX = clamp(screenX, 0, projectionContext.viewport.width);
  const clampedScreenY = clamp(screenY, 0, projectionContext.viewport.height);
  const worldX = projectionContext.westWorldX + ((clampedScreenX / projectionContext.viewport.width) * projectionContext.xSpan);
  const worldY = projectionContext.northWorldY + ((clampedScreenY / projectionContext.viewport.height) * projectionContext.ySpan);

  return {
    latitude: worldYToLatitude(worldY, projectionContext.viewport.zoom),
    longitude: worldXToLongitude(worldX, projectionContext.viewport.zoom),
  };
}

function calculateScreenDistanceSquared(left: ProjectedPoint, right: ProjectedPoint): number {
  const deltaX = left.screenX - right.screenX;
  const deltaY = left.screenY - right.screenY;
  return (deltaX * deltaX) + (deltaY * deltaY);
}

function createSingletonResult(point: ProjectedPoint): ScopeWasmClusterResult {
  return {
    id: point.id,
    clustered: false,
    pointCount: 1,
    latitude: roundToPrecision(point.latitude, 6),
    longitude: roundToPrecision(point.longitude, 6),
    screenX: point.screenX,
    screenY: point.screenY,
    minScreenX: point.screenX,
    minScreenY: point.screenY,
    maxScreenX: point.screenX,
    maxScreenY: point.screenY,
    pointIds: [point.id],
  };
}

function createClusterResult(
  memberIndices: number[],
  projectedPoints: ProjectedPoint[],
  zoom: number,
): ScopeWasmClusterResult {
  const memberIds: string[] = [];
  let accumulatedWorldX = 0;
  let accumulatedWorldY = 0;
  let accumulatedScreenX = 0;
  let accumulatedScreenY = 0;
  let minScreenX = Number.POSITIVE_INFINITY;
  let minScreenY = Number.POSITIVE_INFINITY;
  let maxScreenX = Number.NEGATIVE_INFINITY;
  let maxScreenY = Number.NEGATIVE_INFINITY;

  memberIndices.forEach((memberIndex) => {
    const member = projectedPoints[memberIndex];
    memberIds.push(member.id);
    accumulatedWorldX += member.worldX;
    accumulatedWorldY += member.worldY;
    accumulatedScreenX += member.screenX;
    accumulatedScreenY += member.screenY;
    minScreenX = Math.min(minScreenX, member.screenX);
    minScreenY = Math.min(minScreenY, member.screenY);
    maxScreenX = Math.max(maxScreenX, member.screenX);
    maxScreenY = Math.max(maxScreenY, member.screenY);
  });

  memberIds.sort((left, right) => left.localeCompare(right));

  const memberCount = memberIndices.length;
  return {
    id: buildClusterId(memberIds),
    clustered: true,
    pointCount: memberCount,
    latitude: roundToPrecision(worldYToLatitude(accumulatedWorldY / memberCount, zoom), 6),
    longitude: roundToPrecision(worldXToLongitude(accumulatedWorldX / memberCount, zoom), 6),
    screenX: roundToPrecision(accumulatedScreenX / memberCount),
    screenY: roundToPrecision(accumulatedScreenY / memberCount),
    minScreenX: roundToPrecision(minScreenX),
    minScreenY: roundToPrecision(minScreenY),
    maxScreenX: roundToPrecision(maxScreenX),
    maxScreenY: roundToPrecision(maxScreenY),
    pointIds: memberIds,
  };
}

function screenCrossProduct(origin: ProjectedPoint, left: ProjectedPoint, right: ProjectedPoint): number {
  return ((left.screenX - origin.screenX) * (right.screenY - origin.screenY))
    - ((left.screenY - origin.screenY) * (right.screenX - origin.screenX));
}

function buildConvexHull(projectedPoints: ProjectedPoint[]): ProjectedPoint[] {
  const sortedPoints = [...projectedPoints].sort((left, right) => {
    if (left.screenX !== right.screenX) {
      return left.screenX - right.screenX;
    }

    if (left.screenY !== right.screenY) {
      return left.screenY - right.screenY;
    }

    return left.id.localeCompare(right.id);
  });

  const uniquePoints = sortedPoints.filter((point, index, collection) => (
    index === 0
      || point.screenX !== collection[index - 1].screenX
      || point.screenY !== collection[index - 1].screenY
  ));

  if (uniquePoints.length <= 2) {
    return uniquePoints;
  }

  const lowerHull: ProjectedPoint[] = [];
  uniquePoints.forEach((point) => {
    while (
      lowerHull.length >= 2
      && screenCrossProduct(lowerHull[lowerHull.length - 2], lowerHull[lowerHull.length - 1], point) <= 0
    ) {
      lowerHull.pop();
    }

    lowerHull.push(point);
  });

  const upperHull: ProjectedPoint[] = [];
  [...uniquePoints].reverse().forEach((point) => {
    while (
      upperHull.length >= 2
      && screenCrossProduct(upperHull[upperHull.length - 2], upperHull[upperHull.length - 1], point) <= 0
    ) {
      upperHull.pop();
    }

    upperHull.push(point);
  });

  lowerHull.pop();
  upperHull.pop();
  return [...lowerHull, ...upperHull];
}

function computeAverageScreenPoint(points: ProjectedPoint[]): { x: number; y: number } {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  const accumulated = points.reduce((totals, point) => ({
    x: totals.x + point.screenX,
    y: totals.y + point.screenY,
  }), { x: 0, y: 0 });

  return {
    x: accumulated.x / points.length,
    y: accumulated.y / points.length,
  };
}

function computeHullCentroid(hullPoints: ProjectedPoint[]): { x: number; y: number } {
  if (hullPoints.length <= 2) {
    return computeAverageScreenPoint(hullPoints);
  }

  let signedAreaTwice = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let index = 0; index < hullPoints.length; index += 1) {
    const currentPoint = hullPoints[index];
    const nextPoint = hullPoints[(index + 1) % hullPoints.length];
    const cross = (currentPoint.screenX * nextPoint.screenY) - (nextPoint.screenX * currentPoint.screenY);
    signedAreaTwice += cross;
    centroidX += (currentPoint.screenX + nextPoint.screenX) * cross;
    centroidY += (currentPoint.screenY + nextPoint.screenY) * cross;
  }

  if (Math.abs(signedAreaTwice) <= 1e-9) {
    return computeAverageScreenPoint(hullPoints);
  }

  return {
    x: centroidX / (3 * signedAreaTwice),
    y: centroidY / (3 * signedAreaTwice),
  };
}

function computeHullAreaSquarePx(hullPoints: ProjectedPoint[]): number {
  if (hullPoints.length <= 2) {
    return 0;
  }

  let signedAreaTwice = 0;
  for (let index = 0; index < hullPoints.length; index += 1) {
    const currentPoint = hullPoints[index];
    const nextPoint = hullPoints[(index + 1) % hullPoints.length];
    signedAreaTwice += (currentPoint.screenX * nextPoint.screenY) - (nextPoint.screenX * currentPoint.screenY);
  }

  return Math.abs(signedAreaTwice) / 2;
}

function computeHullPerimeterPx(hullPoints: ProjectedPoint[]): number {
  if (hullPoints.length <= 1) {
    return 0;
  }

  let perimeter = 0;
  for (let index = 0; index < hullPoints.length; index += 1) {
    const currentPoint = hullPoints[index];
    const nextPoint = hullPoints[(index + 1) % hullPoints.length];
    perimeter += Math.hypot(nextPoint.screenX - currentPoint.screenX, nextPoint.screenY - currentPoint.screenY);
    if (hullPoints.length === 2) {
      break;
    }
  }

  return perimeter;
}

function calculateHaversineDistanceFallback(
  from: ScopeWasmCoordinateInput,
  to: ScopeWasmCoordinateInput,
): ScopeWasmDistanceResult {
  const start = parseCoordinate(from, 'origin');
  const end = parseCoordinate(to, 'target');

  if (!start.valid || !end.valid) {
    return {
      valid: false,
      fromId: start.id,
      toId: end.id,
      kilometers: 0,
      miles: 0,
      meters: 0,
    };
  }

  const startLatitudeRadians = degreesToRadians(start.latitude);
  const endLatitudeRadians = degreesToRadians(end.latitude);
  const deltaLatitude = endLatitudeRadians - startLatitudeRadians;
  const deltaLongitude = degreesToRadians(wrapLongitude(end.longitude - start.longitude));
  const haversineComponent =
    (Math.sin(deltaLatitude / 2) ** 2)
    + (Math.cos(startLatitudeRadians) * Math.cos(endLatitudeRadians) * (Math.sin(deltaLongitude / 2) ** 2));
  const distanceKm = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversineComponent)));

  return {
    valid: true,
    fromId: start.id,
    toId: end.id,
    kilometers: roundToPrecision(distanceKm, 3),
    miles: roundToPrecision(distanceKm * 0.621371, 3),
    meters: roundToPrecision(distanceKm * 1000, 0),
  };
}

function clusterViewportPointsFallback(
  points: ScopeWasmCoordinateInput[],
  viewport: ScopeWasmViewport,
  options?: ScopeWasmClusterOptions,
): ScopeWasmClusterResult[] {
  const projectionContext = buildProjectionContext(viewport);
  const clusterOptions = parseClusterOptions(options);
  const projectedPoints = projectVisiblePoints(points, projectionContext);

  if (!projectedPoints.length) {
    return [];
  }

  const grid = new Map<string, number[]>();
  projectedPoints.forEach((point, index) => {
    const cellX = Math.floor(point.screenX / clusterOptions.radiusPx);
    const cellY = Math.floor(point.screenY / clusterOptions.radiusPx);
    const cellKey = hashCell(cellX, cellY);
    const existingEntries = grid.get(cellKey) ?? [];
    existingEntries.push(index);
    grid.set(cellKey, existingEntries);
  });

  const disjointSet = new DisjointSet(projectedPoints.length);
  const radiusSquared = clusterOptions.radiusPx * clusterOptions.radiusPx;

  projectedPoints.forEach((point, index) => {
    const cellX = Math.floor(point.screenX / clusterOptions.radiusPx);
    const cellY = Math.floor(point.screenY / clusterOptions.radiusPx);

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const neighborEntries = grid.get(hashCell(cellX + offsetX, cellY + offsetY));
        if (!neighborEntries) {
          continue;
        }

        neighborEntries.forEach((neighborIndex) => {
          if (neighborIndex <= index) {
            return;
          }

          if (calculateScreenDistanceSquared(point, projectedPoints[neighborIndex]) <= radiusSquared) {
            disjointSet.unite(index, neighborIndex);
          }
        });
      }
    }
  });

  const groupedIndices = new Map<number, number[]>();
  projectedPoints.forEach((_, index) => {
    const root = disjointSet.find(index);
    const members = groupedIndices.get(root) ?? [];
    members.push(index);
    groupedIndices.set(root, members);
  });

  const results: ScopeWasmClusterResult[] = [];
  groupedIndices.forEach((group) => {
    if (group.length < clusterOptions.minPoints) {
      if (!clusterOptions.includeSingles) {
        return;
      }

      group.forEach((memberIndex) => {
        results.push(createSingletonResult(projectedPoints[memberIndex]));
      });
      return;
    }

    results.push(createClusterResult(group, projectedPoints, projectionContext.viewport.zoom));
  });

  return results;
}

function buildViewportConvexHullFallback(
  points: ScopeWasmCoordinateInput[],
  viewport: ScopeWasmViewport,
): ScopeWasmHullResult {
  const projectionContext = buildProjectionContext(viewport);
  const projectedPoints = projectVisiblePoints(points, projectionContext);

  const emptyResult: ScopeWasmHullResult = {
    valid: false,
    pointCount: 0,
    hullPointCount: 0,
    latitude: 0,
    longitude: 0,
    screenX: 0,
    screenY: 0,
    minScreenX: 0,
    minScreenY: 0,
    maxScreenX: 0,
    maxScreenY: 0,
    areaSquarePx: 0,
    perimeterPx: 0,
    pointIds: [],
    hullPointIds: [],
    hull: [],
  };

  if (!projectedPoints.length) {
    return emptyResult;
  }

  const pointIds = projectedPoints.map((point) => point.id).sort((left, right) => left.localeCompare(right));
  const hullPoints = buildConvexHull(projectedPoints);
  const hullPointIds = hullPoints.map((point) => point.id);
  const centroid = computeHullCentroid(hullPoints);
  const geographicCentroid = screenToGeographic(projectionContext, centroid.x, centroid.y);

  return {
    valid: true,
    pointCount: projectedPoints.length,
    hullPointCount: hullPoints.length,
    latitude: roundToPrecision(geographicCentroid.latitude, 6),
    longitude: roundToPrecision(geographicCentroid.longitude, 6),
    screenX: roundToPrecision(centroid.x),
    screenY: roundToPrecision(centroid.y),
    minScreenX: roundToPrecision(Math.min(...projectedPoints.map((point) => point.screenX))),
    minScreenY: roundToPrecision(Math.min(...projectedPoints.map((point) => point.screenY))),
    maxScreenX: roundToPrecision(Math.max(...projectedPoints.map((point) => point.screenX))),
    maxScreenY: roundToPrecision(Math.max(...projectedPoints.map((point) => point.screenY))),
    areaSquarePx: roundToPrecision(computeHullAreaSquarePx(hullPoints)),
    perimeterPx: roundToPrecision(computeHullPerimeterPx(hullPoints)),
    pointIds,
    hullPointIds,
    hull: hullPoints.map((point) => ({
      id: point.id,
      latitude: roundToPrecision(point.latitude, 6),
      longitude: roundToPrecision(point.longitude, 6),
      screenX: roundToPrecision(point.screenX),
      screenY: roundToPrecision(point.screenY),
    })),
  };
}

function createFallbackBindings(): ScopeWasmBindings {
  return {
    ping: () => 'scope-wasm-js-fallback-ready',
    getModuleInfo: () => ({
      version: '0.4.0-js-fallback',
      algorithmsReady: true,
      status: 'Typed wrappers are using the JavaScript spatial fallback and Scope AI lexer fallback because wasm artifacts are unavailable.',
    }),
    calculateHaversineDistance: calculateHaversineDistanceFallback,
    clusterViewportPoints: clusterViewportPointsFallback,
    buildViewportConvexHull: buildViewportConvexHullFallback,
    lexScopeAiCommandText: lexScopeAiCommandTextFallback,
  };
}

function normalizeArray<T>(value: T[] | ArrayLike<T>): T[] {
  return Array.isArray(value) ? value : Array.from(value);
}

function sanitizeDistanceResult(result: ScopeWasmDistanceResult): ScopeWasmDistanceResult {
  return {
    valid: Boolean(result.valid),
    fromId: result.fromId,
    toId: result.toId,
    kilometers: roundToPrecision(result.kilometers, 3),
    miles: roundToPrecision(result.miles, 3),
    meters: roundToPrecision(result.meters, 0),
  };
}

function sanitizeClusterResult(result: ScopeWasmClusterResult): ScopeWasmClusterResult {
  return {
    ...result,
    pointIds: normalizeArray(result.pointIds),
  };
}

function sanitizeHullResult(result: ScopeWasmHullResult): ScopeWasmHullResult {
  return {
    ...result,
    pointIds: normalizeArray(result.pointIds),
    hullPointIds: normalizeArray(result.hullPointIds),
    hull: normalizeArray(result.hull),
  };
}

function sanitizeScopeAiLexToken(token: ScopeAiLexToken, inputLength: number): ScopeAiLexToken | null {
  const type = SCOPE_AI_LEXER_TOKEN_TYPES.has(token.type) ? token.type : 'word';
  const start = Number.isFinite(token.start) ? Math.max(0, Math.min(inputLength, Math.trunc(token.start))) : 0;
  const end = Number.isFinite(token.end) ? Math.max(start, Math.min(inputLength, Math.trunc(token.end))) : start;
  const value = String(token.value ?? '').trim();
  const normalized = String(token.normalized ?? value).trim().toLowerCase();

  if (!value || !normalized) {
    return null;
  }

  return {
    type,
    value,
    normalized,
    start,
    end,
  };
}

function sanitizeScopeAiLexTokens(tokens: ScopeAiLexToken[] | ArrayLike<ScopeAiLexToken>, inputLength: number): ScopeAiLexToken[] {
  return normalizeArray(tokens)
    .map((token) => sanitizeScopeAiLexToken(token, inputLength))
    .filter((token): token is ScopeAiLexToken => Boolean(token));
}

function resolveWasmAssetBasePath(): string {
  const baseUrl = import.meta.env.BASE_URL ?? '/';
  const trimmedBase = baseUrl === '/' ? '' : baseUrl.replace(/\/+$/, '');
  return `${trimmedBase}/wasm/dist/`;
}

function shouldAttemptWasmBindings(): boolean {
  return import.meta.env.VITE_ENABLE_SCOPE_WASM !== 'false';
}

async function assertWasmModuleAssetAvailable(modulePath: string): Promise<void> {
  if (typeof fetch !== 'function') {
    return;
  }

  const response = await fetch(modulePath, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`Scope WASM artifacts are unavailable (${response.status}).`);
  }
}

async function loadWasmBindingsFromModule(moduleFileName: string): Promise<ScopeWasmBindings> {
  const assetBasePath = resolveWasmAssetBasePath();
  const modulePath = `${assetBasePath}${moduleFileName}`;
  await assertWasmModuleAssetAvailable(modulePath);
  const importedModule = await import(/* @vite-ignore */ modulePath);
  const factory = (
    (typeof importedModule.default === 'function' && importedModule.default)
    || (typeof importedModule.createScopeWasmModule === 'function' && importedModule.createScopeWasmModule)
  ) as ScopeWasmFactory | undefined;

  if (!factory) {
    throw new Error('Scope WASM module did not expose a supported factory.');
  }

  return factory({
    locateFile: (path) => `${assetBasePath}${path}`,
  });
}

async function loadWasmBindings(): Promise<ScopeWasmBindings> {
  if (!shouldAttemptWasmBindings()) {
    throw new Error('Scope WASM runtime is disabled; using the JavaScript spatial fallback.');
  }

  const loadFailures: string[] = [];
  for (const moduleFileName of SCOPE_WASM_MODULE_CANDIDATES) {
    try {
      return await loadWasmBindingsFromModule(moduleFileName);
    } catch (error) {
      loadFailures.push(`${moduleFileName}: ${error instanceof Error ? error.message : 'unknown failure'}`);
    }
  }

  throw new Error(`Scope WASM artifacts are unavailable (${loadFailures.join('; ')}).`);
}

async function getRuntime(): Promise<ScopeWasmRuntime> {
  if (!runtimePromise) {
    runtimePromise = loadWasmBindings()
      .then((bindings) => ({
        mode: 'wasm' as const,
        bindings,
      }))
      .catch((error: unknown) => ({
        mode: 'js-fallback' as const,
        bindings: createFallbackBindings(),
        fallbackReason: error instanceof Error ? error.message : 'Unknown Scope WASM loader failure.',
      }))
      .then((runtime) => {
        readyRuntime = runtime;
        return runtime;
      });
  }

  return runtimePromise;
}

export async function preloadScopeWasmRuntime(): Promise<void> {
  await getRuntime();
}

export async function pingScopeWasmRuntime(): Promise<string> {
  const runtime = await getRuntime();
  return runtime.bindings.ping();
}

export async function getScopeWasmModuleInfo(): Promise<ScopeWasmModuleInfo> {
  const runtime = await getRuntime();
  const moduleInfo = runtime.bindings.getModuleInfo();

  return {
    ...moduleInfo,
    runtimeMode: runtime.mode,
    fallbackReason: runtime.fallbackReason,
  };
}

export async function calculateHaversineDistance(
  from: ScopeWasmCoordinateInput,
  to: ScopeWasmCoordinateInput,
): Promise<ScopeWasmDistanceResult> {
  const runtime = await getRuntime();
  return sanitizeDistanceResult(runtime.bindings.calculateHaversineDistance(from, to));
}

export async function clusterViewportPoints(
  points: ScopeWasmCoordinateInput[],
  viewport: ScopeWasmViewport,
  options?: ScopeWasmClusterOptions,
): Promise<ScopeWasmClusterResult[]> {
  const runtime = await getRuntime();
  return normalizeArray(runtime.bindings.clusterViewportPoints(points, viewport, options)).map(sanitizeClusterResult);
}

export async function buildViewportConvexHull(
  points: ScopeWasmCoordinateInput[],
  viewport: ScopeWasmViewport,
): Promise<ScopeWasmHullResult> {
  const runtime = await getRuntime();
  return sanitizeHullResult(runtime.bindings.buildViewportConvexHull(points, viewport));
}

export function lexScopeAiCommandText(input: string): ScopeAiLexToken[] {
  const runtime = readyRuntime;
  const nativeLexer = runtime?.mode === 'wasm' ? runtime.bindings.lexScopeAiCommandText : null;

  if (nativeLexer) {
    return sanitizeScopeAiLexTokens(nativeLexer(input), input.length);
  }

  return lexScopeAiCommandTextFallback(input);
}

export async function lexScopeAiCommandTextWithRuntime(input: string): Promise<ScopeAiLexToken[]> {
  const runtime = await getRuntime();
  const nativeLexer = runtime.mode === 'wasm' ? runtime.bindings.lexScopeAiCommandText : null;

  if (nativeLexer) {
    return sanitizeScopeAiLexTokens(nativeLexer(input), input.length);
  }

  return sanitizeScopeAiLexTokens(runtime.bindings.lexScopeAiCommandText?.(input) ?? lexScopeAiCommandTextFallback(input), input.length);
}

export function resetScopeWasmRuntimeForTests() {
  runtimePromise = null;
  readyRuntime = null;
}
