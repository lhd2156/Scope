export type MapLayerSourceLayer = {
  'source-layer'?: unknown;
};

export function layerIdIncludes(normalizedLayerId: string, fragments: string[]): boolean {
  return fragments.some((fragment) => normalizedLayerId.includes(fragment));
}

export function getLayerSourceLayer(layer: MapLayerSourceLayer): string {
  return String(layer['source-layer'] ?? '').toLowerCase();
}

export function isCountryLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['country']) || sourceLayer === 'country_label';
}

export function isStateLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['state', 'province', 'admin-1', 'admin1']) ||
    layerIdIncludes(sourceLayer, ['state', 'province', 'admin_1', 'admin-1']);
}

export function isWaterLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['water', 'ocean', 'sea', 'lake', 'marine']) ||
    layerIdIncludes(sourceLayer, ['water', 'marine']);
}

export function isNaturalOrWaterLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return isWaterLabelLayer(normalizedLayerId, sourceLayer) ||
    layerIdIncludes(normalizedLayerId, ['natural']) ||
    layerIdIncludes(sourceLayer, ['natural_label']);
}

export function isNeighborhoodLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['neighborhood', 'settlement-subdivision']) ||
    layerIdIncludes(sourceLayer, ['neighborhood', 'settlement_subdivision']);
}

export function isSettlementLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['place-label', 'settlement', 'city', 'town', 'village', 'hamlet']) ||
    layerIdIncludes(sourceLayer, ['place_label', 'settlement', 'city', 'town', 'village', 'hamlet']);
}

export function isPoiLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return /(^|[-_ ])poi($|[-_ ])/.test(normalizedLayerId) ||
    layerIdIncludes(normalizedLayerId, ['point-of-interest', 'transit', 'airport']) ||
    layerIdIncludes(sourceLayer, ['poi', 'point_of_interest', 'transit', 'airport']);
}

export function isRoadLabelLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, [
    'road-label',
    'road-number',
    'road-shield',
    'route-number',
    'route-shield',
    'motorway-shield',
    'motorway-junction',
    'highway-label',
    'highway-shield',
  ]) ||
    layerIdIncludes(sourceLayer, ['road_label', 'road', 'motorway_junction', 'transportation_name']);
}

export function isRoadShieldLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, [
    'road-number-shield',
    'road-shield',
    'route-number',
    'route-shield',
    'motorway-shield',
    'highway-shield',
  ]) ||
    (isRoadLabelLayer(normalizedLayerId, sourceLayer) && layerIdIncludes(normalizedLayerId, ['shield']));
}

export function isRoadLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return sourceLayer === 'road' ||
    layerIdIncludes(normalizedLayerId, ['road', 'street', 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'bridge', 'tunnel']);
}

export function isSimpleRoadLineLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['road-simple', 'bridge-simple', 'tunnel-simple']);
}

export function isMajorRoadLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return isRoadLineLayer(normalizedLayerId, sourceLayer) &&
    layerIdIncludes(normalizedLayerId, ['motorway', 'trunk', 'primary', 'highway']);
}

export function isRoadCasingLineLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['case', 'casing']);
}

export function getNightRoadLineColor(normalizedLayerId: string, sourceLayer: string): string {
  if (isRoadCasingLineLayer(normalizedLayerId)) {
    return 'rgb(31, 42, 51)';
  }

  if (isMajorRoadLineLayer(normalizedLayerId, sourceLayer)) {
    return 'rgb(104, 119, 130)';
  }

  if (isSimpleRoadLineLayer(normalizedLayerId)) {
    return 'rgb(70, 86, 98)';
  }

  if (layerIdIncludes(normalizedLayerId, ['secondary', 'tertiary'])) {
    return 'rgb(78, 94, 105)';
  }

  return 'rgb(57, 72, 84)';
}

export function getNativeMajorRoadColor(normalizedLayerId: string): string {
  if (isRoadCasingLineLayer(normalizedLayerId)) {
    return 'rgb(247, 248, 244)';
  }

  if (layerIdIncludes(normalizedLayerId, ['motorway', 'trunk'])) {
    return 'rgb(152, 161, 160)';
  }

  if (layerIdIncludes(normalizedLayerId, ['primary'])) {
    return 'rgb(174, 181, 179)';
  }

  return 'rgb(202, 205, 200)';
}

export function isCountryBoundaryLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['admin-0', 'admin0', 'country']) ||
    layerIdIncludes(sourceLayer, ['admin_0', 'admin-0', 'country']);
}

export function isStateBoundaryLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['admin-1', 'admin1', 'state', 'province']) ||
    layerIdIncludes(sourceLayer, ['admin_1', 'admin-1', 'state', 'province']);
}

export function isAdministrativeBoundaryLineLayer(normalizedLayerId: string, sourceLayer: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['admin', 'boundary', 'state', 'province']) ||
    layerIdIncludes(sourceLayer, ['admin', 'boundary', 'state', 'province']);
}

export function isAridLandFillLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['sand', 'scrub', 'desert', 'bare', 'dry']);
}

export function isLandcoverFillLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['landcover', 'natural']);
}

export function isLanduseFillLayer(normalizedLayerId: string): boolean {
  return layerIdIncludes(normalizedLayerId, ['landuse', 'land-use', 'park', 'pitch', 'school', 'airport']);
}
