package com.esimconnect.app.data

import com.esimconnect.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class ApiClient(@Volatile var baseUrl: String = BuildConfig.BASE_URL) {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    @Volatile
    var authToken: String? = null

    private suspend fun execute(
        method: String,
        path: String,
        body: JsonObject? = null
    ): JsonObject = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("$baseUrl$path")
        authToken?.let { builder.addHeader("Authorization", "Bearer $it") }

        val requestBody = body?.toString()?.toRequestBody(jsonMedia)
        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post(requestBody ?: "{}".toRequestBody(jsonMedia))
            "PATCH" -> builder.patch(requestBody ?: "{}".toRequestBody(jsonMedia))
            "DELETE" -> builder.delete(requestBody)
        }

        client.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string() ?: "{}"
            val parsed = json.parseToJsonElement(raw).jsonObject
            if (!response.isSuccessful) {
                val msg = parsed["error"]?.jsonPrimitive?.content ?: "Request failed (${response.code})"
                throw IllegalStateException(msg)
            }
            parsed
        }
    }

    suspend fun login(email: String, password: String): AuthResponse {
        val obj = execute(
            "POST",
            "/api/auth/login",
            buildJsonObject {
                put("email", email)
                put("password", password)
            }
        )
        return json.decodeFromJsonElement(obj)
    }

    suspend fun register(fullName: String, email: String, password: String): AuthResponse {
        val obj = execute(
            "POST",
            "/api/auth/register",
            buildJsonObject {
                put("fullName", fullName)
                put("email", email)
                put("password", password)
            }
        )
        return json.decodeFromJsonElement(obj)
    }

    suspend fun generateDemoOtp(): DemoOtpPayload {
        val obj = execute("POST", "/api/auth/demo-otp/generate")
        return json.decodeFromJsonElement(obj["demoOtp"]!!.jsonObject)
    }

    suspend fun verifyDemoOtp(code: String): UserProfile {
        val obj = execute(
            "POST",
            "/api/auth/demo-otp/verify",
            buildJsonObject { put("code", code) }
        )
        return json.decodeFromJsonElement(obj["user"]!!.jsonObject)
    }

    suspend fun requestPasswordReset(email: String): DemoOtpPayload {
        val obj = execute(
            "POST",
            "/api/auth/password-reset/request",
            buildJsonObject { put("email", email) }
        )
        return json.decodeFromJsonElement(obj["demoOtp"]!!.jsonObject)
    }

    suspend fun confirmPasswordReset(email: String, code: String, newPassword: String) {
        execute(
            "POST",
            "/api/auth/password-reset/confirm",
            buildJsonObject {
                put("email", email)
                put("code", code)
                put("newPassword", newPassword)
            }
        )
    }

    suspend fun getMe(): UserProfile {
        val obj = execute("GET", "/api/users/me")
        return json.decodeFromJsonElement(obj["user"]!!.jsonObject)
    }

    suspend fun updateProfile(fullName: String, bio: String, regenerateNumber: Boolean = false): UserProfile {
        val obj = execute(
            "PATCH",
            "/api/users/me",
            buildJsonObject {
                put("fullName", fullName)
                put("bio", bio)
                if (regenerateNumber) put("regenerateDemoNumber", true)
            }
        )
        return json.decodeFromJsonElement(obj["user"]!!.jsonObject)
    }

    suspend fun getContacts(): List<UserProfile> {
        val obj = execute("GET", "/api/users/contacts")
        return obj["contacts"]!!.jsonArray.map { json.decodeFromJsonElement(it) }
    }

    suspend fun searchDirectory(query: String): List<UserProfile> {
        val encoded = withContext(Dispatchers.IO) { URLEncoder.encode(query, "UTF-8") }
        val obj = execute("GET", "/api/users/directory?q=$encoded")
        return obj["users"]!!.jsonArray.map { json.decodeFromJsonElement(it) }
    }

    suspend fun lookupByNumber(number: String): UserProfile {
        val encoded = withContext(Dispatchers.IO) { URLEncoder.encode(number, "UTF-8") }
        val obj = execute("GET", "/api/users/lookup?number=$encoded")
        return json.decodeFromJsonElement(obj["user"]!!.jsonObject)
    }

    suspend fun getConversations(): List<ConversationSummary> {
        val obj = execute("GET", "/api/messages/conversations")
        return obj["conversations"]!!.jsonArray.map { json.decodeFromJsonElement(it) }
    }

    suspend fun getMessages(peerId: String): List<ChatMessage> {
        val obj = execute("GET", "/api/messages/$peerId")
        return obj["messages"]!!.jsonArray.map { json.decodeFromJsonElement(it) }
    }

    suspend fun sendMessage(receiverId: String, body: String): ChatMessage {
        val obj = execute(
            "POST",
            "/api/messages",
            buildJsonObject {
                put("receiverId", receiverId)
                put("body", body)
            }
        )
        return json.decodeFromJsonElement(obj["message"]!!.jsonObject)
    }

    suspend fun getCallHistory(): List<CallRecord> {
        val obj = execute("GET", "/api/calls")
        return obj["calls"]!!.jsonArray.map { json.decodeFromJsonElement(it) }
    }
}
