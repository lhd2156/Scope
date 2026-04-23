package com.atlas.mobile.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.atlas.mobile.data.model.AtlasUser
import com.atlas.mobile.ui.auth.AuthLandingScreen
import com.atlas.mobile.ui.explore.ExploreScreen
import com.atlas.mobile.ui.home.HomeScreen
import com.atlas.mobile.ui.map.MapScreen
import com.atlas.mobile.ui.profile.ProfileScreen
import com.atlas.mobile.ui.session.SessionViewModel
import com.atlas.mobile.ui.spotdetail.SpotDetailScreen

object Routes {
    const val HOME = "home"
    const val EXPLORE = "explore"
    const val MAP = "map"
    const val PROFILE = "profile"
    const val SPOT_DETAIL = "spot/{id}"
    fun spotDetail(id: String) = "spot/$id"
}

@Composable
fun AtlasRoot(sessionViewModel: SessionViewModel = hiltViewModel()) {
    val state by sessionViewModel.state.collectAsStateWithLifecycle()

    when {
        state.isBootstrapping -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        !state.isAuthenticated -> AuthLandingScreen(onSignIn = sessionViewModel::signIn, onRegister = sessionViewModel::register, state = state)
        else -> MainShell(user = state.user, onSignOut = sessionViewModel::signOut)
    }
}

@Composable
private fun MainShell(user: AtlasUser?, onSignOut: () -> Unit) {
    val controller = rememberNavController()
    val backStack by controller.currentBackStackEntryAsState()
    val current = backStack?.destination?.route

    Scaffold(
        bottomBar = {
            val isTopLevel = current in setOf(Routes.HOME, Routes.EXPLORE, Routes.MAP, Routes.PROFILE, null)
            if (isTopLevel) {
                NavigationBar {
                    listOf(
                        Triple(Routes.HOME, Icons.Filled.Home, "Home"),
                        Triple(Routes.EXPLORE, Icons.Filled.Explore, "Explore"),
                        Triple(Routes.MAP, Icons.Filled.Map, "Map"),
                        Triple(Routes.PROFILE, Icons.Filled.Person, "Profile")
                    ).forEach { (route, icon, label) ->
                        NavigationBarItem(
                            selected = backStack?.destination?.hierarchy?.any { it.route == route } == true,
                            onClick = {
                                controller.navigate(route) {
                                    popUpTo(controller.graph.startDestinationId) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(icon, contentDescription = label) },
                            label = { Text(label) }
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = controller,
            startDestination = Routes.HOME,
            modifier = Modifier.padding(padding)
        ) {
            composable(Routes.HOME) {
                HomeScreen(onOpenSpot = { controller.navigate(Routes.spotDetail(it)) })
            }
            composable(Routes.EXPLORE) {
                ExploreScreen(onOpenSpot = { controller.navigate(Routes.spotDetail(it)) })
            }
            composable(Routes.MAP) {
                MapScreen(onOpenSpot = { controller.navigate(Routes.spotDetail(it)) })
            }
            composable(Routes.PROFILE) {
                ProfileScreen(user = user, onSignOut = onSignOut)
            }
            composable(Routes.SPOT_DETAIL) { backStackEntry ->
                val id = backStackEntry.arguments?.getString("id") ?: return@composable
                SpotDetailScreen(spotId = id, onBack = { controller.popBackStack() })
            }
        }
    }
}
