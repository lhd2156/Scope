package com.scope.mobile.data.network

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class TokenStoreTest {

    @Test fun `in memory store defaults to empty`() = runTest {
        val store = InMemoryTokenStore()
        assertEquals(ScopeTokens.Empty, store.tokens.value)
        assertFalse(store.tokens.value.hasSession)
    }

    @Test fun `save updates tokens and hasSession`() = runTest {
        val store = InMemoryTokenStore()
        store.save("access-1", "refresh-1")
        assertEquals("access-1", store.tokens.value.accessToken)
        assertEquals("refresh-1", store.tokens.value.refreshToken)
        assertTrue(store.tokens.value.hasSession)
    }

    @Test fun `clear resets to empty`() = runTest {
        val store = InMemoryTokenStore(ScopeTokens("a", "r"))
        store.clear()
        assertEquals(ScopeTokens.Empty, store.tokens.value)
    }
}
