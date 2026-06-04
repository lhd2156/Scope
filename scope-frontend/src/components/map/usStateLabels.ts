interface UsStateLabel {
  code: string;
  name: string;
  coordinates: [number, number];
}

interface UsStateLabelFeature {
  type: 'Feature';
  properties: {
    code: string;
    name: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface UsStateLabelFeatureCollection {
  type: 'FeatureCollection';
  features: UsStateLabelFeature[];
}

export const SCOPE_US_STATE_LABEL_SOURCE_ID = 'scope-us-state-labels';
export const SCOPE_US_STATE_LABEL_LAYER_ID = 'scope-us-state-labels';
export const SCOPE_US_STATE_NAME_LABEL_LAYER_ID = 'scope-us-state-name-labels';
export const SCOPE_US_STATE_ABBREVIATION_LABEL_TEXT_FIELD = ['get', 'code'] as const;
export const SCOPE_US_STATE_NAME_LABEL_TEXT_FIELD = ['get', 'name'] as const;
export const SCOPE_US_STATE_ABBREVIATION_LABEL_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  2.35,
  0.72,
  3,
  0.92,
  4.9,
  0.86,
  5.45,
  0.34,
  6.05,
  0,
] as const;
export const SCOPE_US_STATE_NAME_LABEL_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5.25,
  0,
  5.75,
  0.34,
  6.35,
  0.82,
  7.6,
  0.88,
  8.45,
  0,
] as const;

export const US_STATE_LABELS: readonly UsStateLabel[] = [
  { code: 'AL', name: 'Alabama', coordinates: [-86.8, 32.8] },
  { code: 'AK', name: 'Alaska', coordinates: [-152.4, 64.2] },
  { code: 'AZ', name: 'Arizona', coordinates: [-111.7, 34.3] },
  { code: 'AR', name: 'Arkansas', coordinates: [-92.4, 34.9] },
  { code: 'CA', name: 'California', coordinates: [-119.5, 37.1] },
  { code: 'CO', name: 'Colorado', coordinates: [-105.55, 39] },
  { code: 'CT', name: 'Connecticut', coordinates: [-72.7, 41.6] },
  { code: 'DE', name: 'Delaware', coordinates: [-75.5, 39] },
  { code: 'DC', name: 'District of Columbia', coordinates: [-77.04, 38.91] },
  { code: 'FL', name: 'Florida', coordinates: [-82.4, 28.6] },
  { code: 'GA', name: 'Georgia', coordinates: [-83.5, 32.7] },
  { code: 'HI', name: 'Hawaii', coordinates: [-157.5, 20.8] },
  { code: 'ID', name: 'Idaho', coordinates: [-114.5, 44.2] },
  { code: 'IL', name: 'Illinois', coordinates: [-89.2, 40] },
  { code: 'IN', name: 'Indiana', coordinates: [-86.1, 39.9] },
  { code: 'IA', name: 'Iowa', coordinates: [-93.5, 42.1] },
  { code: 'KS', name: 'Kansas', coordinates: [-98.4, 38.5] },
  { code: 'KY', name: 'Kentucky', coordinates: [-84.7, 37.5] },
  { code: 'LA', name: 'Louisiana', coordinates: [-91.9, 31] },
  { code: 'ME', name: 'Maine', coordinates: [-69, 45.3] },
  { code: 'MD', name: 'Maryland', coordinates: [-76.7, 39] },
  { code: 'MA', name: 'Massachusetts', coordinates: [-71.8, 42.3] },
  { code: 'MI', name: 'Michigan', coordinates: [-84.8, 44.3] },
  { code: 'MN', name: 'Minnesota', coordinates: [-94.6, 46.1] },
  { code: 'MS', name: 'Mississippi', coordinates: [-89.7, 32.7] },
  { code: 'MO', name: 'Missouri', coordinates: [-92.6, 38.4] },
  { code: 'MT', name: 'Montana', coordinates: [-110.5, 46.9] },
  { code: 'NE', name: 'Nebraska', coordinates: [-99.9, 41.5] },
  { code: 'NV', name: 'Nevada', coordinates: [-116.6, 39.3] },
  { code: 'NH', name: 'New Hampshire', coordinates: [-71.6, 43.7] },
  { code: 'NJ', name: 'New Jersey', coordinates: [-74.7, 40.1] },
  { code: 'NM', name: 'New Mexico', coordinates: [-106.1, 34.4] },
  { code: 'NY', name: 'New York', coordinates: [-75, 43] },
  { code: 'NC', name: 'North Carolina', coordinates: [-79.4, 35.5] },
  { code: 'ND', name: 'North Dakota', coordinates: [-100.5, 47.5] },
  { code: 'OH', name: 'Ohio', coordinates: [-82.8, 40.3] },
  { code: 'OK', name: 'Oklahoma', coordinates: [-97.5, 35.6] },
  { code: 'OR', name: 'Oregon', coordinates: [-120.5, 44] },
  { code: 'PA', name: 'Pennsylvania', coordinates: [-77.8, 40.9] },
  { code: 'PR', name: 'Puerto Rico', coordinates: [-66.4, 18.2] },
  { code: 'RI', name: 'Rhode Island', coordinates: [-71.5, 41.7] },
  { code: 'SC', name: 'South Carolina', coordinates: [-80.9, 33.9] },
  { code: 'SD', name: 'South Dakota', coordinates: [-100, 44.4] },
  { code: 'TN', name: 'Tennessee', coordinates: [-86.4, 35.8] },
  { code: 'TX', name: 'Texas', coordinates: [-99.5, 31.2] },
  { code: 'UT', name: 'Utah', coordinates: [-111.7, 39.3] },
  { code: 'VT', name: 'Vermont', coordinates: [-72.7, 44] },
  { code: 'VA', name: 'Virginia', coordinates: [-78.8, 37.5] },
  { code: 'WA', name: 'Washington', coordinates: [-120.5, 47.4] },
  { code: 'WV', name: 'West Virginia', coordinates: [-80.6, 38.6] },
  { code: 'WI', name: 'Wisconsin', coordinates: [-89.9, 44.6] },
  { code: 'WY', name: 'Wyoming', coordinates: [-107.6, 43.1] },
];

export const LOWER_48_US_STATE_LABELS: readonly UsStateLabel[] = US_STATE_LABELS.filter(
  (state) => !['AK', 'DC', 'HI', 'PR'].includes(state.code),
);

export function buildUsStateLabelFeatureCollection(
  states: readonly UsStateLabel[] = US_STATE_LABELS,
): UsStateLabelFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: states.map((state) => ({
      type: 'Feature',
      properties: {
        code: state.code,
        name: state.name,
      },
      geometry: {
        type: 'Point',
        coordinates: state.coordinates,
      },
    })),
  };
}
