package com.atlas.mobile.ui.map

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.atlas.mobile.BuildConfig
import com.atlas.mobile.data.model.Spot
import com.atlas.mobile.ui.components.AtlasSpacing
import com.atlas.mobile.ui.spots.SpotsViewModel
import com.atlas.mobile.ui.theme.AtlasTokens
import org.maplibre.android.annotations.MarkerOptions
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style

/**
 * MapLibre-powered map screen. Renders every visible Spot as a marker. Uses
 * the demo MapLibre style by default, but `BuildConfig.ATLAS_MAP_STYLE_URL`
 * accepts any Mapbox-compatible style URL (point it at a real Mapbox style
 * + token by overriding `ATLAS_MAP_STYLE_URL` in `local.properties`).
 */
@Composable
fun MapScreen(
    onOpenSpot: (String) -> Unit,
    viewModel: SpotsViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val mapView = remember { MapView(context) }
    val spots = rememberUpdatedState(state.spots)
    val onOpen = rememberUpdatedState(onOpenSpot)

    DisposableEffect(mapView) {
        mapView.onStart()
        mapView.onResume()
        onDispose {
            mapView.onPause()
            mapView.onStop()
            mapView.onDestroy()
        }
    }

    LaunchedEffect(mapView, spots.value) {
        mapView.getMapAsync { map ->
            map.setStyle(Style.Builder().fromUri(BuildConfig.ATLAS_MAP_STYLE_URL))
            map.cameraPosition = CameraPosition.Builder()
                .target(LatLng(37.7749, -122.4194))
                .zoom(10.0)
                .build()
            map.clear()
            spots.value.forEach { spot: Spot ->
                map.addMarker(
                    MarkerOptions()
                        .position(LatLng(spot.latitude, spot.longitude))
                        .title(spot.title)
                        .snippet(spot.category.label)
                )
            }
            map.setOnMarkerClickListener { marker ->
                spots.value.firstOrNull {
                    it.latitude == marker.position.latitude && it.longitude == marker.position.longitude
                }?.let { onOpen.value(it.id) }
                true
            }
        }
    }

    Box(Modifier.fillMaxSize()) {
        AndroidView(factory = { mapView }, modifier = Modifier.fillMaxSize())

        if (state.isLoading) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(AtlasSpacing.Base)
            ) {
                Text(
                    "Loading…",
                    color = AtlasTokens.TextPrimary,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier
                        .padding(horizontal = AtlasSpacing.Md, vertical = AtlasSpacing.Sm)
                )
            }
        }
    }
}
