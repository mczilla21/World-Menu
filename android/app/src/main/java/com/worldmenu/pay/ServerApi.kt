package com.worldmenu.pay

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * Communicates with the World Menu POS server.
 */
class ServerApi(private val baseUrl: String) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val json = "application/json; charset=utf-8".toMediaType()

    /** Get Stripe Terminal connection token from the server */
    suspend fun getConnectionToken(): String = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$baseUrl/api/payments/stripe/terminal/connection-token")
            .post("{}".toRequestBody(json))
            .build()

        val response = client.newCall(request).execute()
        val body = response.body?.string() ?: throw Exception("Empty response")
        val data = JSONObject(body)

        if (data.has("secret")) {
            data.getString("secret")
        } else {
            throw Exception(data.optString("error", "Failed to get connection token"))
        }
    }

    /** Create a payment intent for card-present transaction */
    suspend fun createPaymentIntent(amountCents: Int, tableNumber: String): PaymentIntentInfo =
        withContext(Dispatchers.IO) {
            val bodyJson = JSONObject().apply {
                put("amount", amountCents)
                put("table_number", tableNumber)
            }
            val request = Request.Builder()
                .url("$baseUrl/api/payments/stripe/terminal/create-intent")
                .post(bodyJson.toString().toRequestBody(json))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: throw Exception("Empty response")
            val data = JSONObject(body)

            if (data.has("clientSecret")) {
                PaymentIntentInfo(
                    clientSecret = data.getString("clientSecret"),
                    id = data.getString("id")
                )
            } else {
                throw Exception(data.optString("error", "Failed to create payment intent"))
            }
        }

    /** Notify server that payment succeeded */
    suspend fun notifyPaymentSuccess(paymentIntentId: String, tableNumber: String, amountCents: Int) =
        withContext(Dispatchers.IO) {
            val bodyJson = JSONObject().apply {
                put("payment_intent_id", paymentIntentId)
                put("table_number", tableNumber)
                put("amount", amountCents)
            }
            val request = Request.Builder()
                .url("$baseUrl/api/payments/stripe/terminal/capture")
                .post(bodyJson.toString().toRequestBody(json))
                .build()
            client.newCall(request).execute()
        }

    /** Check if server is reachable */
    suspend fun ping(): Boolean = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("$baseUrl/api/version")
                .get()
                .build()
            val response = client.newCall(request).execute()
            response.isSuccessful
        } catch (e: Exception) {
            false
        }
    }
}

data class PaymentIntentInfo(
    val clientSecret: String,
    val id: String
)
