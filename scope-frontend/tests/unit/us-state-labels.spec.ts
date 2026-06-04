import {
  buildUsStateLabelFeatureCollection,
  LOWER_48_US_STATE_LABELS,
  SCOPE_US_STATE_ABBREVIATION_LABEL_OPACITY,
  SCOPE_US_STATE_ABBREVIATION_LABEL_TEXT_FIELD,
  SCOPE_US_STATE_NAME_LABEL_TEXT_FIELD,
  US_STATE_LABELS,
} from '@/components/map/usStateLabels';

describe('US state map labels', () => {
  it('keeps the full state label catalog available', () => {
    expect(US_STATE_LABELS).toHaveLength(52);
    expect(new Set(US_STATE_LABELS.map((state) => state.code))).toHaveLength(52);
    expect(new Set(US_STATE_LABELS.map((state) => state.name))).toHaveLength(52);
    expect(US_STATE_LABELS.map((state) => state.name)).toEqual(expect.arrayContaining([
      'Alaska',
      'California',
      'District of Columbia',
      'Florida',
      'Hawaii',
      'New York',
      'Puerto Rico',
      'Texas',
      'Washington',
    ]));
  });

  it('uses only the lower 48 states for the default blank planner map', () => {
    expect(LOWER_48_US_STATE_LABELS).toHaveLength(48);
    expect(LOWER_48_US_STATE_LABELS.map((state) => state.code)).not.toEqual(expect.arrayContaining([
      'AK',
      'DC',
      'HI',
      'PR',
    ]));
  });

  it('builds GeoJSON points that Mapbox can render as symbol labels', () => {
    const collection = buildUsStateLabelFeatureCollection(LOWER_48_US_STATE_LABELS);

    expect(collection.type).toBe('FeatureCollection');
    expect(collection.features).toHaveLength(48);
    expect(collection.features.every((feature) => feature.type === 'Feature')).toBe(true);
    expect(collection.features.every((feature) => feature.geometry.type === 'Point')).toBe(true);
    expect(collection.features.every((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
    })).toBe(true);
  });

  it('renders default Scope state labels from postal abbreviations', () => {
    const texas = buildUsStateLabelFeatureCollection(US_STATE_LABELS).features.find((feature) => feature.properties.code === 'TX');

    expect(SCOPE_US_STATE_ABBREVIATION_LABEL_TEXT_FIELD).toEqual(['get', 'code']);
    expect(SCOPE_US_STATE_NAME_LABEL_TEXT_FIELD).toEqual(['get', 'name']);
    expect(texas?.properties).toEqual({
      code: 'TX',
      name: 'Texas',
    });
  });

  it('fades abbreviation labels out as the map zooms into full state names', () => {
    expect(SCOPE_US_STATE_ABBREVIATION_LABEL_OPACITY).toEqual([
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
    ]);
  });
});
