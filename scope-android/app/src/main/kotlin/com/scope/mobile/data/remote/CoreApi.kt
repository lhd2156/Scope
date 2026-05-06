package com.scope.mobile.data.remote

import com.scope.mobile.data.model.ScopeNotification
import com.scope.mobile.data.model.ScopeUser
import com.scope.mobile.data.model.AuthPayload
import com.scope.mobile.data.model.Friendship
import com.scope.mobile.data.model.LiveSession
import com.scope.mobile.data.model.LoginRequest
import com.scope.mobile.data.model.LogoutRequest
import com.scope.mobile.data.model.PingLocationRequest
import com.scope.mobile.data.model.RefreshRequest
import com.scope.mobile.data.model.RegisterRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/** Client for the C# `Scope.Core` service (`/api/core/*`). */
interface CoreApi {

    // ---- Auth ----

    @POST("api/core/auth/register")
    suspend fun register(@Body body: RegisterRequest): AuthPayload

    @POST("api/core/auth/login")
    suspend fun login(@Body body: LoginRequest): AuthPayload

    @POST("api/core/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): AuthPayload

    @POST("api/core/auth/logout")
    suspend fun logout(@Body body: LogoutRequest): Map<String, Any>

    @GET("api/core/auth/me")
    suspend fun me(): ScopeUser

    // ---- Users ----

    @GET("api/core/users/{id}")
    suspend fun user(@Path("id") id: String): ScopeUser

    @GET("api/core/users/search")
    suspend fun searchUsers(@Query("q") query: String): List<ScopeUser>

    // ---- Friends ----

    @POST("api/core/friends/request/{userId}")
    suspend fun requestFriendship(@Path("userId") userId: String): Friendship

    @PUT("api/core/friends/{id}/accept")
    suspend fun acceptFriendship(@Path("id") id: String): Friendship

    // ---- Notifications ----

    @GET("api/core/notifications")
    suspend fun notifications(
        @Query("page") page: Int = 1,
        @Query("pageSize") pageSize: Int = 20
    ): List<ScopeNotification>

    // ---- Live ----

    @POST("api/core/live/start/{tripId}")
    suspend fun startLiveSession(@Path("tripId") tripId: String): LiveSession

    @PUT("api/core/live/ping")
    suspend fun pingLocation(@Body body: PingLocationRequest): LiveSession

    @GET("api/core/live/trip/{tripId}")
    suspend fun liveSessions(@Path("tripId") tripId: String): List<LiveSession>

    // ---- Health ----

    @GET("api/core/health")
    suspend fun health(): Map<String, Any>
}
