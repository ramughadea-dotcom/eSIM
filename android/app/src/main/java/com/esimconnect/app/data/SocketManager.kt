package com.esimconnect.app.data

import com.esimconnect.app.BuildConfig
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONObject

sealed interface SignalingEvent {
    data class PresenceChanged(val userId: String, val isOnline: Boolean) : SignalingEvent
    data class NewMessage(val senderId: String, val messageId: String, val body: String, val createdAt: String) : SignalingEvent
    data class MessagesRead(val peerId: String) : SignalingEvent
    data class IncomingCall(val callId: String, val callerId: String, val callerName: String, val callerNumber: String, val sdpOffer: String) : SignalingEvent
    data class CallAccepted(val callId: String, val sdpAnswer: String) : SignalingEvent
    data class CallRejected(val callId: String, val reason: String) : SignalingEvent
    data class IceCandidateReceived(val callId: String, val candidateJson: JSONObject) : SignalingEvent
    data class CallEnded(val callId: String) : SignalingEvent
}

class SocketManager(@Volatile var baseUrl: String = BuildConfig.BASE_URL) {

    private var socket: Socket? = null
    private val _events = MutableSharedFlow<SignalingEvent>(extraBufferCapacity = 32)
    val events: SharedFlow<SignalingEvent> = _events

    fun connect(token: String) {
        disconnect()
        val options = IO.Options.builder()
            .setAuth(mapOf("token" to token))
            .setReconnection(true)
            .build()

        val sock = IO.socket(baseUrl, options)
        sock.on("presence:update") { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            _events.tryEmit(
                SignalingEvent.PresenceChanged(
                    userId = obj.optString("userId"),
                    isOnline = obj.optBoolean("isOnline", false)
                )
            )
        }
        sock.on("message:new") { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            val msg = obj.optJSONObject("message") ?: return@on
            _events.tryEmit(
                SignalingEvent.NewMessage(
                    senderId = msg.optString("sender_id"),
                    messageId = msg.optString("id"),
                    body = msg.optString("body"),
                    createdAt = msg.optString("created_at")
                )
            )
        }
        sock.on("messages:read") { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            _events.tryEmit(SignalingEvent.MessagesRead(obj.optString("peerId")))
        }
        sock.on("call:incoming") { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            val caller = obj.optJSONObject("caller") ?: return@on
            _events.tryEmit(
                SignalingEvent.IncomingCall(
                    callId = obj.optString("callId"),
                    callerId = caller.optString("id"),
                    callerName = caller.optString("full_name"),
                    callerNumber = caller.optString("demo_virtual_number"),
                    sdpOffer = obj.optString("sdpOffer")
                )
            )
        }
        sock.on("call:accepted") { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            _events.tryEmit(
                SignalingEvent.CallAccepted(
                    callId = obj.optString("callId"),
                    sdpAnswer = obj.optString("sdpAnswer")
                )
            )
        }
        sock.on("call:rejected") { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            _events.tryEmit(
                SignalingEvent.CallRejected(
                    callId = obj.optString("callId"),
                    reason = obj.optString("reason", "Call declined")
                )
            )
        }
        sock.on("call:ice-candidate") { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            val candidate = obj.optJSONObject("candidate") ?: return@on
            _events.tryEmit(
                SignalingEvent.IceCandidateReceived(
                    callId = obj.optString("callId"),
                    candidateJson = candidate
                )
            )
        }
        sock.on("call:ended") { args ->
            val obj = args.firstOrNull() as? JSONObject ?: return@on
            _events.tryEmit(SignalingEvent.CallEnded(obj.optString("callId")))
        }

        sock.connect()
        socket = sock
    }

    fun initiateCall(calleeId: String, sdpOffer: String, onResult: (Boolean, String?, String?) -> Unit) {
        val payload = JSONObject().apply {
            put("calleeId", calleeId)
            put("sdpOffer", sdpOffer)
        }
        socket?.emit("call:initiate", arrayOf(payload), Ack { ackArgs ->
            val res = ackArgs.firstOrNull() as? JSONObject
            val ok = res?.optBoolean("ok", false) ?: false
            val callId = res?.optString("callId")?.takeIf { it.isNotEmpty() }
            val error = res?.optString("error")?.takeIf { it.isNotEmpty() }
            onResult(ok, callId, error)
        })
    }

    fun acceptCall(callId: String, callerId: String, sdpAnswer: String) {
        val payload = JSONObject().apply {
            put("callId", callId)
            put("callerId", callerId)
            put("sdpAnswer", sdpAnswer)
        }
        socket?.emit("call:accept", payload)
    }

    fun rejectCall(callId: String, callerId: String) {
        val payload = JSONObject().apply {
            put("callId", callId)
            put("callerId", callerId)
            put("reason", "Declined by user")
        }
        socket?.emit("call:reject", payload)
    }

    fun sendIceCandidate(callId: String, targetUserId: String, candidate: JSONObject) {
        val payload = JSONObject().apply {
            put("callId", callId)
            put("targetUserId", targetUserId)
            put("candidate", candidate)
        }
        socket?.emit("call:ice-candidate", payload)
    }

    fun endCall(callId: String, peerId: String, durationSeconds: Int) {
        val payload = JSONObject().apply {
            put("callId", callId)
            put("peerId", peerId)
            put("durationSeconds", durationSeconds)
        }
        socket?.emit("call:end", payload)
    }

    fun markMessagesRead(peerId: String) {
        socket?.emit("message:read", JSONObject().apply { put("peerId", peerId) })
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
    }
}
