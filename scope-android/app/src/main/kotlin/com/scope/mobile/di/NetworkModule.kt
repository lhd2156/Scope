package com.scope.mobile.di

import android.content.Context
import com.scope.mobile.BuildConfig
import com.scope.mobile.data.network.ScopeAuthenticator
import com.scope.mobile.data.network.AuthInterceptor
import com.scope.mobile.data.network.EncryptedTokenStore
import com.scope.mobile.data.network.EnvelopeConverterFactory
import com.scope.mobile.data.network.TokenRefresher
import com.scope.mobile.data.network.TokenStore
import com.scope.mobile.data.remote.ContentApi
import com.scope.mobile.data.remote.CoreApi
import com.scope.mobile.data.remote.IntelApi
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Binds
import dagger.Lazy
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import javax.inject.Named
import javax.inject.Qualifier
import javax.inject.Singleton

@Qualifier @Retention(AnnotationRetention.BINARY) annotation class CoreRetrofit
@Qualifier @Retention(AnnotationRetention.BINARY) annotation class ContentRetrofit
@Qualifier @Retention(AnnotationRetention.BINARY) annotation class IntelRetrofit

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    @Provides
    @Singleton
    fun provideOkHttp(
        authInterceptor: AuthInterceptor,
        authenticator: ScopeAuthenticator
    ): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .authenticator(authenticator)
        .apply {
            if (BuildConfig.DEBUG) {
                addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY })
            }
        }
        .build()

    @Provides @Singleton @CoreRetrofit
    fun provideCoreRetrofit(client: OkHttpClient, moshi: Moshi): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.SCOPE_CORE_BASE_URL)
            .client(client)
            .addConverterFactory(EnvelopeConverterFactory(moshi))
            .build()

    @Provides @Singleton @ContentRetrofit
    fun provideContentRetrofit(client: OkHttpClient, moshi: Moshi): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.SCOPE_CONTENT_BASE_URL)
            .client(client)
            .addConverterFactory(EnvelopeConverterFactory(moshi))
            .build()

    @Provides @Singleton @IntelRetrofit
    fun provideIntelRetrofit(client: OkHttpClient, moshi: Moshi): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.SCOPE_INTEL_BASE_URL)
            .client(client)
            .addConverterFactory(EnvelopeConverterFactory(moshi))
            .build()

    @Provides @Singleton
    fun provideCoreApi(@CoreRetrofit retrofit: Retrofit): CoreApi = retrofit.create(CoreApi::class.java)

    @Provides @Singleton
    fun provideContentApi(@ContentRetrofit retrofit: Retrofit): ContentApi = retrofit.create(ContentApi::class.java)

    @Provides @Singleton
    fun provideIntelApi(@IntelRetrofit retrofit: Retrofit): IntelApi = retrofit.create(IntelApi::class.java)

    @Provides @Singleton
    fun provideTokenRefresher(lazyCore: Lazy<CoreApi>, store: TokenStore): TokenRefresher =
        TokenRefresher { refreshToken ->
            try {
                val payload = lazyCore.get().refresh(com.scope.mobile.data.model.RefreshRequest(refreshToken))
                store.save(payload.accessToken, payload.refreshToken)
                com.scope.mobile.data.network.ScopeTokens(payload.accessToken, payload.refreshToken)
            } catch (_: Throwable) {
                null
            }
        }

    @Provides @Singleton @Named("mapStyle")
    fun provideMapStyleUrl(): String = BuildConfig.SCOPE_MAP_STYLE_URL
}

@Module
@InstallIn(SingletonComponent::class)
abstract class BindsModule {
    @Binds @Singleton
    abstract fun bindTokenStore(impl: EncryptedTokenStore): TokenStore
}
