package com.atlas.mobile.data.network

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import okhttp3.ResponseBody
import retrofit2.Converter
import retrofit2.Retrofit
import java.io.IOException
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type

/**
 * Retrofit converter factory that transparently unwraps both Atlas envelopes:
 *
 * - `ApiResponse<T>` (Core): `{ "data": {...}, "meta": {...} }`
 * - Django/Flask `data_response`: `{ "data": {...} }`
 *
 * Falls back to raw JSON decoding when neither envelope matches.
 */
class EnvelopeConverterFactory(private val moshi: Moshi) : Converter.Factory() {

    override fun responseBodyConverter(
        type: Type,
        annotations: Array<out Annotation>,
        retrofit: Retrofit
    ): Converter<ResponseBody, *> {
        val rawAdapter = moshi.adapter<Any>(type)
        val envelopeType: ParameterizedType = Types.newParameterizedType(EnvelopeShell::class.java, type)
        val envelopeAdapter: JsonAdapter<EnvelopeShell<Any>> = moshi.adapter(envelopeType)

        return Converter<ResponseBody, Any> { body ->
            val raw = body.string()
            if (raw.isEmpty()) {
                @Suppress("UNCHECKED_CAST")
                return@Converter Unit as Any
            }

            try {
                val envelope = envelopeAdapter.fromJson(raw)
                if (envelope?.data != null) return@Converter envelope.data as Any
            } catch (_: Throwable) { /* not an envelope — try raw */ }

            rawAdapter.fromJson(raw) ?: throw IOException("Empty response body")
        }
    }
}

/**
 * Kotlin-side mirror of the JSON envelope, used by the converter. Not meant
 * to be surfaced in domain models.
 */
@com.squareup.moshi.JsonClass(generateAdapter = true)
internal data class EnvelopeShell<T>(val data: T? = null)
