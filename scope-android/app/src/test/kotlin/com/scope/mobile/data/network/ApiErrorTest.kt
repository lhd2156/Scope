package com.scope.mobile.data.network

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
        val mapped = exception.toScopeError()
        assertEquals(ScopeError.Unauthorized, mapped)
    }

    @Test fun `404 maps to not found`() {
        val exception = HttpException(Response.error<Any>(404, errorBody("")))
        assertEquals(ScopeError.NotFound, exception.toScopeError())
    }

    @Test fun `500 maps to server error with status`() {
        val exception = HttpException(Response.error<Any>(500, errorBody("boom")))
        val mapped = exception.toScopeError()
        assertTrue(mapped is ScopeError.Server)
        assertEquals(500, (mapped as ScopeError.Server).status)
    }

    @Test fun `io exception maps to transport`() {
        val mapped = IOException("offline").toScopeError()
        assertTrue(mapped is ScopeError.Transport)
    }

    @Test fun `unknown maps to unknown`() {
        val mapped = IllegalStateException("bad").toScopeError()
        assertTrue(mapped is ScopeError.Unknown)
    }

    private fun errorBody(message: String) =
        message.toResponseBody("application/json".toMediaType())
}
