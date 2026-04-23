package com.atlas.mobile.data.realtime

import com.atlas.mobile.data.network.TokenStore
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Minimal SignalR JSON-protocol client over OkHttp WebSockets. Atlas Core
 * uses SignalR to push notifications, friend-request events, and live-trip
 * location updates.
 *
 * Swap this for `com.microsoft.signalr:signalr-kotlin` when you need the
 * full feature surface (MessagePack, streaming invocations).
 */
@Singleton
class SignalRClient @Inject constructor(
    private val client: OkHttpClient,
    private val tokens: TokenStore,
    moshi: Moshi
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _invocations = MutableSharedFlow<SignalRInvocation>(
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    val invocations: SharedFlow<SignalRInvocation> = _invocations
    private var socket: WebSocket? = null
    private val mapAdapter = moshi.adapter<Map<String, Any?>>(
        Types.newParameterizedType(Map::class.java, String::class.java, Any::class.java)
    )

    fun connect(hubUrl: String) {
        disconnect()
        val request = Request.Builder().url(hubUrl).apply {
            val access = tokens.tokens.value.accessToken
            if (access.isNotBlank()) addHeader("Authorization", "Bearer $access")
        }.build()

        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send("{\"protocol\":\"json\",\"version\":1}$RECORD_SEPARATOR")
            }
            override fun onMessage(webSocket: WebSocket, text: String) {
                handle(webSocket, text)
            }
            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                handle(webSocket, bytes.utf8())
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                disconnect()
            }
        })
    }

    fun disconnect() {
        socket?.close(1000, null)
        socket = null
    }

    fun invoke(method: String, arguments: List<String>) {
        val payload = buildString {
            append("{\"type\":1,\"target\":\"").append(method).append("\",\"arguments\":[")
            arguments.forEachIndexed { index, value ->
                if (index > 0) append(',')
                append('"').append(value).append('"')
            }
            append("]}").append(RECORD_SEPARATOR)
        }
        socket?.send(payload)
    }

    fun onMethod(method: String): SharedFlow<SignalRInvocation> = invocations // clients filter themselves.

    private fun handle(webSocket: WebSocket, raw: String) {
        raw.split(RECORD_SEPARATOR).filter { it.isNotBlank() }.forEach { frame ->
            val parsed = runCatching { mapAdapter.fromJson(frame) }.getOrNull() ?: return@forEach
            when (parsed["type"] as? Double ?: (parsed["type"] as? Int)?.toDouble()) {
                1.0 -> {
                    val target = parsed["target"] as? String ?: return@forEach
                    @Suppress("UNCHECKED_CAST")
                    val args = (parsed["arguments"] as? List<Any?>) ?: emptyList()
                    scope.launch {
                        _invocations.emit(SignalRInvocation(target, args))
                    }
                }
                6.0 -> webSocket.send("{\"type\":6}$RECORD_SEPARATOR")
                else -> Unit
            }
        }
    }

    companion object {
        private const val RECORD_SEPARATOR: Char = '\u001E'
    }
}

data class SignalRInvocation(
    val target: String,
    val arguments: List<Any?>
)
