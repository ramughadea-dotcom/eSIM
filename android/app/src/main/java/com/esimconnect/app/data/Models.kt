package com.esimconnect.app.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class UserProfile(
    val id: String,
    @SerialName("app_user_id") val appUserId: String,
    @SerialName("full_name") val fullName: String,
    val email: String,
    @SerialName("demo_virtual_number") val demoVirtualNumber: String,
    @SerialName("avatar_url") val avatarUrl: String = "",
    val bio: String = "",
    @SerialName("account_status") val accountStatus: String = "active",
    @SerialName("otp_verified") val otpVerified: Int = 0,
    @SerialName("is_online") val isOnline: Int = 0,
    @SerialName("last_seen_at") val lastSeenAt: String = ""
)

@Serializable
data class DemoOtpPayload(
    val code: String,
    val expiresAt: String,
    val disclaimer: String
)

@Serializable
data class AuthResponse(
    val token: String,
    val user: UserProfile,
    val demoOtp: DemoOtpPayload? = null
)

@Serializable
data class ChatMessage(
    val id: String,
    @SerialName("sender_id") val senderId: String,
    @SerialName("receiver_id") val receiverId: String,
    val body: String,
    val status: String = "sent",
    @SerialName("created_at") val createdAt: String,
    @SerialName("delivered_at") val deliveredAt: String? = null,
    @SerialName("read_at") val readAt: String? = null
)

@Serializable
data class ConversationSummary(
    val peer: UserProfile,
    val lastMessage: ChatMessage,
    val unreadCount: Int = 0
)

@Serializable
data class CallRecord(
    val id: String,
    @SerialName("caller_id") val callerId: String,
    @SerialName("callee_id") val calleeId: String,
    @SerialName("call_type") val callType: String = "audio",
    val status: String,
    @SerialName("started_at") val startedAt: String,
    @SerialName("duration_seconds") val durationSeconds: Int = 0,
    @SerialName("caller_name") val callerName: String = "",
    @SerialName("caller_number") val callerNumber: String = "",
    @SerialName("callee_name") val calleeName: String = "",
    @SerialName("callee_number") val calleeNumber: String = ""
)

data class IncomingCallSession(
    val callId: String,
    val caller: UserProfile,
    val sdpOffer: String
)
