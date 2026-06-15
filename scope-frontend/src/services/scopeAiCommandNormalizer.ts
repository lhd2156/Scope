const DIRECT_NOISY_COMMAND_WORDS: Record<string, string> = {
  strt: 'start',
  strting: 'starting',
  adress: 'address',
  addres: 'address',
  addr: 'address',
  loction: 'location',
  locaton: 'location',
  plce: 'place',
  palce: 'place',
  endd: 'end',
  dest: 'destination',
  destnation: 'destination',
  destinaton: 'destination',
  destiantion: 'destination',
  destinatoin: 'destination',
  actuually: 'actually',
  actully: 'actually',
  wether: 'weather',
  weathr: 'weather',
  forecastt: 'forecast',
  budgte: 'budget',
  buget: 'budget',
  bugdet: 'budget',
  maxx: 'max',
  minn: 'min',
  cheep: 'cheap',
  cheapestt: 'cheapest',
  travlers: 'travelers',
  travelrs: 'travelers',
  travellers: 'travelers',
  peopel: 'people',
  diesl: 'diesel',
  svae: 'save',
  saev: 'save',
  zom: 'zoom',
  zomm: 'zoom',
  zoome: 'zoom',
  zoomin: 'zoom in',
  zoomout: 'zoom out',
  zoomigng: 'zooming',
  zoomingg: 'zooming',
  mpa: 'map',
  maap: 'map',
  mappp: 'map',
  cneter: 'center',
  centar: 'center',
  cener: 'center',
  reecenter: 'recenter',
  swtich: 'switch',
  swich: 'switch',
  swithc: 'switch',
  toggel: 'toggle',
  toggl: 'toggle',
  shrae: 'share',
  sahre: 'share',
  shar: 'share',
  shre: 'share',
  pubilc: 'public',
  publc: 'public',
  publci: 'public',
  publsh: 'publish',
  publsih: 'publish',
  privte: 'private',
  prvate: 'private',
  privat: 'private',
  privtae: 'private',
  renmae: 'rename',
  reanme: 'rename',
  rnmae: 'rename',
  invte: 'invite',
  invtie: 'invite',
  viwer: 'viewer',
  vewer: 'viewer',
  edtor: 'editor',
  editr: 'editor',
  delte: 'delete',
  deleet: 'delete',
  delet: 'delete',
  cnfirm: 'confirm',
  buidl: 'build',
  bulid: 'build',
  bild: 'build',
  itenerary: 'itinerary',
  iterinary: 'itinerary',
  stauts: 'status',
  staus: 'status',
  statuz: 'status',
  resset: 'reset',
  reser: 'reset',
  rest: 'reset',
  lcoate: 'locate',
  locat: 'locate',
  fitt: 'fit',
  brite: 'bright',
  brigth: 'bright',
  lite: 'light',
};

const FUZZY_COMMAND_WORDS = [
  'start',
  'starting',
  'destination',
  'actually',
  'weather',
  'forecast',
  'budget',
  'bowling',
  'travelers',
  'people',
  'diesel',
  'save',
  'share',
  'public',
  'private',
  'rename',
  'invite',
  'delete',
  'confirm',
  'map',
  'zoom',
  'zooming',
  'center',
  'recenter',
  'focus',
  'show',
  'open',
  'switch',
  'change',
  'turn',
  'toggle',
  'build',
  'route',
  'itinerary',
  'status',
  'nearby',
  'stop',
  'stops',
  'place',
  'places',
  'reset',
  'locate',
  'fit',
  'light',
  'bright',
  'dark',
  'clear',
  'remove',
  'discard',
] as const;

export function collapseRepeatedLetters(value: string): string {
  return value.replace(/([a-z])\1+/gi, '$1');
}

export function damerauLevenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const distances = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    distances[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    distances[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost,
      );

      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        distances[row][column] = Math.min(distances[row][column], distances[row - 2][column - 2] + 1);
      }
    }
  }

  return distances[left.length][right.length];
}

export function shouldFuzzyNormalizeCommandWord(value: string, target: string): boolean {
  if (!/^[a-z]+$/i.test(value) || value.length < 4 || Math.abs(value.length - target.length) > 2) {
    return false;
  }

  if (target === 'start') {
    return /^s/.test(value) && /t/.test(value) && /r/.test(value);
  }

  if (target === 'starting') {
    return /^s/.test(value) && /t/.test(value) && /r/.test(value) && /ing?$/.test(value);
  }

  if (target === 'destination') {
    return /^d/.test(value) && /st|tn|tion/.test(value);
  }

  return value[0] === target[0];
}

export function normalizeNoisyCommandWord(rawWord: string): string {
  const lower = rawWord.toLowerCase();
  const collapsed = collapseRepeatedLetters(lower);
  const direct = DIRECT_NOISY_COMMAND_WORDS[lower] ?? DIRECT_NOISY_COMMAND_WORDS[collapsed];
  if (direct) {
    return direct;
  }

  if (/^[A-Z][a-z]/.test(rawWord)) {
    return rawWord;
  }

  for (const target of FUZZY_COMMAND_WORDS) {
    const threshold = target.length >= 8 ? 2 : 1;
    if (
      shouldFuzzyNormalizeCommandWord(lower, target) &&
      (damerauLevenshteinDistance(lower, target) <= threshold ||
        damerauLevenshteinDistance(collapsed, target) <= threshold)
    ) {
      return target;
    }
  }

  return rawWord;
}

export function normalizeNoisyCommandTokens(value: string): string {
  return value.replace(/\b[a-z][a-z]*\b/gi, (word) => normalizeNoisyCommandWord(word));
}

export function normalizeNoisyScopeAiPrompt(value: string): string {
  return normalizeNoisyCommandTokens(value)
    .replace(/\bs+start\b/gi, 'start')
    .replace(/\bstrt\b/gi, 'start')
    .replace(/\bstrting\b/gi, 'starting')
    .replace(/\bendd\b/gi, 'end')
    .replace(/\bdest(?:i|ina)?n?ation\b/gi, 'destination')
    .replace(/\bfinal\s+dest\b/gi, 'final destination')
    .replace(/\bactu+a+l+y\b/gi, 'actually')
    .replace(/\bactully\b/gi, 'actually')
    .replace(/\bweth?er\b/gi, 'weather')
    .replace(/\bforecastt\b/gi, 'forecast')
    .replace(/\bbudg(?:e|te|et)\b/gi, 'budget')
    .replace(/\bmaxx\b/gi, 'max')
    .replace(/\bminn\b/gi, 'min')
    .replace(/\bcheep\b/gi, 'cheap')
    .replace(/\bcheapestt\b/gi, 'cheapest')
    .replace(/\bfr\b/gi, 'for')
    .replace(/\bnvm\b/gi, 'nevermind')
    .replace(/\bov\b/gi, 'of')
    .replace(/([a-z])!+\s+/gi, '$1 ')
    .replace(/[?!]{2,}/g, (match) => match[0] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeScopeAiCommandText(value: string): string {
  return normalizeNoisyScopeAiPrompt(value);
}
