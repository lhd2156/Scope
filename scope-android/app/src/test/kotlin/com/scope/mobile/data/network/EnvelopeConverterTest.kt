package com.scope.mobile.data.network

import com.scope.mobile.data.model.ScopeUser
import com.scope.mobile.data.model.Spot
import com.scope.mobile.data.model.SpotCategory
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.http.GET
import kotlinx.coroutines.runBlocking

class EnvelopeConverterTest {
    private lateinit var server: MockWebServer
    private lateinit var service: TestService

    interface TestService {
        @GET("/envelope") suspend fun envelope(): ScopeUser
        @GET("/raw") suspend fun raw(): ScopeUser
        @GET("/list") suspend fun list(): List<Spot>
    }

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()

        val moshi = Moshi.Builder().add(KotlinJsonAdapterFactory()).build()
        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .addConverterFactory(EnvelopeConverterFactory(moshi))
            .build()
        service = retrofit.create(TestService::class.java)
    }

    @After fun tearDown() { server.shutdown() }

    @Test
    fun `envelope is unwrapped into domain object`() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """{"data":{"id":"u1","username":"louisdo","displayName":"Louis Do","email":"l@x"}}"""
            )
        )
        val result = service.envelope()
        assertEquals("u1", result.id)
        assertEquals("louisdo", result.username)
    }

    @Test
    fun `raw json without envelope still decodes`() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """{"id":"u2","username":"v","displayName":"V"}"""
            )
        )
        val result = service.raw()
        assertEquals("u2", result.id)
    }

    @Test
    fun `envelope wraps list responses`() = runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """{"data":[{"id":"s1","title":"Pier","latitude":1.0,"longitude":2.0,"category":"scenic"}]}"""
            )
        )
        val spots = service.list()
        assertEquals(1, spots.size)
        assertEquals(SpotCategory.SCENIC, spots.first().category)
        assertNotNull(spots.first().id)
    }
}
