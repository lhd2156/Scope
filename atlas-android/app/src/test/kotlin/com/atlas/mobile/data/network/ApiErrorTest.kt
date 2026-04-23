package com.atlas.mobile.data.network

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException

class ApiErrorTest {

    @Test fun `401 maps to unauthorized`() {
        val exception = HttpException(Response.error<Any>(401, errorBody("")))
        val mapped = exception.toAtlasError()
        assertEquals(AtlasError.Unauthorized, mapped)
    }

    @Test fun `404 maps to not found`() {
        val exception = HttpException(Response.error<Any>(404, errorBody("")))
        assertEquals(AtlasError.NotFound, exception.toAtlasError())
    }

    @Test fun `500 maps to server error with status`() {
        val exception = HttpException(Response.error<Any>(500, errorBody("boom")))
        val mapped = exception.toAtlasError()
        assertTrue(mapped is AtlasError.Server)
        assertEquals(500, (mapped as AtlasError.Server).status)
    }

    @Test fun `io exception maps to transport`() {
        val mapped = IOException("offline").toAtlasError()
        assertTrue(mapped is AtlasError.Transport)
    }

    @Test fun `unknown maps to unknown`() {
        val mapped = IllegalStateException("bad").toAtlasError()
        assertTrue(mapped is AtlasError.Unknown)
    }

    private fun errorBody(message: String) =
        message.toResponseBody("application/json".toMediaType())
}
