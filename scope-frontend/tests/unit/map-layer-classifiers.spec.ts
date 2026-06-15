import {
  getLayerSourceLayer,
  getNativeMajorRoadColor,
  getNightRoadLineColor,
  isAdministrativeBoundaryLineLayer,
  isAridLandFillLayer,
  isCountryBoundaryLineLayer,
  isCountryLabelLayer,
  isLandcoverFillLayer,
  isLanduseFillLayer,
  isMajorRoadLineLayer,
  isNaturalOrWaterLabelLayer,
  isNeighborhoodLabelLayer,
  isPoiLabelLayer,
  isRoadCasingLineLayer,
  isRoadLabelLayer,
  isRoadLineLayer,
  isRoadShieldLayer,
  isSettlementLabelLayer,
  isSimpleRoadLineLayer,
  isStateBoundaryLineLayer,
  isStateLabelLayer,
  isWaterLabelLayer,
  layerIdIncludes,
} from '@/components/map/mapLayerClassifiers';

describe('mapLayerClassifiers', () => {
  it('normalizes layer ids and source-layer values', () => {
    expect(layerIdIncludes('motorway-primary-label', ['primary'])).toBe(true);
    expect(layerIdIncludes('motorway-primary-label', ['secondary'])).toBe(false);
    expect(getLayerSourceLayer({ 'source-layer': 'Road' })).toBe('road');
    expect(getLayerSourceLayer({ 'source-layer': 42 })).toBe('42');
    expect(getLayerSourceLayer({})).toBe('');
  });

  it('classifies label layers from ids and source layers', () => {
    expect(isCountryLabelLayer('country-label', '')).toBe(true);
    expect(isCountryLabelLayer('', 'country_label')).toBe(true);
    expect(isStateLabelLayer('province-label', '')).toBe(true);
    expect(isStateLabelLayer('', 'admin_1')).toBe(true);
    expect(isWaterLabelLayer('marine-label', '')).toBe(true);
    expect(isWaterLabelLayer('', 'water')).toBe(true);
    expect(isNaturalOrWaterLabelLayer('natural-label', '')).toBe(true);
    expect(isNaturalOrWaterLabelLayer('', 'natural_label')).toBe(true);
    expect(isNeighborhoodLabelLayer('settlement-subdivision-label', '')).toBe(true);
    expect(isSettlementLabelLayer('city-label', '')).toBe(true);
    expect(isPoiLabelLayer('poi', '')).toBe(true);
    expect(isPoiLabelLayer('point-of-interest-label', '')).toBe(true);
    expect(isPoiLabelLayer('', 'airport')).toBe(true);
    expect(isPoiLabelLayer('spoil-label', '')).toBe(false);
  });

  it('classifies road label, shield, and line layers', () => {
    expect(isRoadLabelLayer('road-label', '')).toBe(true);
    expect(isRoadLabelLayer('', 'transportation_name')).toBe(true);
    expect(isRoadShieldLayer('highway-shield', '')).toBe(true);
    expect(isRoadShieldLayer('road-label-shield', '')).toBe(true);
    expect(isRoadLineLayer('', 'road')).toBe(true);
    expect(isRoadLineLayer('bridge-secondary', '')).toBe(true);
    expect(isSimpleRoadLineLayer('road-simple')).toBe(true);
    expect(isMajorRoadLineLayer('primary-road', '')).toBe(true);
    expect(isRoadCasingLineLayer('primary-road-casing')).toBe(true);
  });

  it('keeps map presentation road color decisions stable', () => {
    expect(getNightRoadLineColor('primary-road-casing', 'road')).toBe('rgb(31, 42, 51)');
    expect(getNightRoadLineColor('motorway-line', 'road')).toBe('rgb(104, 119, 130)');
    expect(getNightRoadLineColor('road-simple', 'road')).toBe('rgb(70, 86, 98)');
    expect(getNightRoadLineColor('secondary-road', 'road')).toBe('rgb(78, 94, 105)');
    expect(getNightRoadLineColor('local-road', 'road')).toBe('rgb(57, 72, 84)');

    expect(getNativeMajorRoadColor('primary-road-casing')).toBe('rgb(247, 248, 244)');
    expect(getNativeMajorRoadColor('motorway-line')).toBe('rgb(152, 161, 160)');
    expect(getNativeMajorRoadColor('primary-line')).toBe('rgb(174, 181, 179)');
    expect(getNativeMajorRoadColor('major-road')).toBe('rgb(202, 205, 200)');
  });

  it('classifies boundary and fill layers', () => {
    expect(isCountryBoundaryLineLayer('admin-0-boundary', '')).toBe(true);
    expect(isCountryBoundaryLineLayer('', 'country')).toBe(true);
    expect(isStateBoundaryLineLayer('admin-1-boundary', '')).toBe(true);
    expect(isStateBoundaryLineLayer('', 'province')).toBe(true);
    expect(isAdministrativeBoundaryLineLayer('boundary-line', '')).toBe(true);
    expect(isAdministrativeBoundaryLineLayer('', 'admin')).toBe(true);
    expect(isAridLandFillLayer('desert-fill')).toBe(true);
    expect(isLandcoverFillLayer('natural-fill')).toBe(true);
    expect(isLanduseFillLayer('school-landuse')).toBe(true);
  });
});
