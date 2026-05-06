# Keep Moshi-generated adapters.
-keep class **JsonAdapter { *; }
-keep @com.squareup.moshi.JsonClass class *

# Retrofit.
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }

# OkHttp.
-dontwarn okhttp3.**
-dontwarn okio.**

# Hilt / Dagger.
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# Compose tooling — preserve previews.
-keep class androidx.compose.** { *; }

# MapLibre.
-keep class org.maplibre.** { *; }
