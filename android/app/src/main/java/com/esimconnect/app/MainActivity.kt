package com.esimconnect.app

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Chat
import androidx.compose.material.icons.rounded.Contacts
import androidx.compose.material.icons.rounded.Dialpad
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.esimconnect.app.data.ApiClient
import com.esimconnect.app.data.CallRecord
import com.esimconnect.app.data.ChatMessage
import com.esimconnect.app.data.ConversationSummary
import com.esimconnect.app.data.DemoOtpPayload
import com.esimconnect.app.data.SignalingEvent
import com.esimconnect.app.data.SocketManager
import com.esimconnect.app.data.UserProfile
import com.esimconnect.app.ui.screens.ActiveCallScreen
import com.esimconnect.app.ui.screens.ChatListScreen
import com.esimconnect.app.ui.screens.ContactsScreen
import com.esimconnect.app.ui.screens.DemoNumberScreen
import com.esimconnect.app.ui.screens.DialerScreen
import com.esimconnect.app.ui.screens.HomeDashboardScreen
import com.esimconnect.app.ui.screens.IncomingCallScreen
import com.esimconnect.app.ui.screens.LoginScreen
import com.esimconnect.app.ui.screens.PrivateChatScreen
import com.esimconnect.app.ui.screens.ProfileScreen
import com.esimconnect.app.ui.screens.RegistrationScreen
import com.esimconnect.app.ui.screens.SettingsScreen
import com.esimconnect.app.ui.screens.SplashScreen
import com.esimconnect.app.ui.theme.ESIMConnectTheme
import com.esimconnect.app.webrtc.WebRtcAudioManager
import kotlinx.coroutines.launch

enum class ScreenRoute {
    SPLASH, LOGIN, REGISTER, HOME, CONTACTS, DIALER, CHATS, PROFILE,
    PRIVATE_CHAT, DEMO_NUMBER, SETTINGS, INCOMING_CALL, ACTIVE_CALL
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ESIMConnectApp()
        }
    }
}

@Composable
fun ESIMConnectApp() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val api = remember { ApiClient() }
    val socketManager = remember { SocketManager() }

    var isDarkTheme by remember { mutableStateOf(false) }
    var route by remember { mutableStateOf(ScreenRoute.SPLASH) }
    var currentUser by remember { mutableStateOf<UserProfile?>(null) }
    var isLoading by remember { mutableStateOf(false) }
    var authError by remember { mutableStateOf<String?>(null) }
    var pendingOtp by remember { mutableStateOf<DemoOtpPayload?>(null) }

    var contacts by remember { mutableStateOf<List<UserProfile>>(emptyList()) }
    var contactSearch by remember { mutableStateOf("") }
    var conversations by remember { mutableStateOf<List<ConversationSummary>>(emptyList()) }
    var callRecords by remember { mutableStateOf<List<CallRecord>>(emptyList()) }

    var activeChatPeer by remember { mutableStateOf<UserProfile?>(null) }
    var chatMessages by remember { mutableStateOf<List<ChatMessage>>(emptyList()) }

    var activeCallId by remember { mutableStateOf<String?>(null) }
    var activeCallPeerId by remember { mutableStateOf<String?>(null) }
    var activeCallPeerName by remember { mutableStateOf("") }
    var activeCallPeerNumber by remember { mutableStateOf("") }
    var activeCallOffer by remember { mutableStateOf<String?>(null) }
    var isCallConnected by remember { mutableStateOf(false) }
    var isMuted by remember { mutableStateOf(false) }
    var isSpeaker by remember { mutableStateOf(false) }

    val webRtc = remember {
        WebRtcAudioManager(context) { candidateJson ->
            val cid = activeCallId ?: return@WebRtcAudioManager
            val pid = activeCallPeerId ?: return@WebRtcAudioManager
            socketManager.sendIceCandidate(cid, pid, candidateJson)
        }
    }

    val micPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    fun refreshDashboardData() {
        scope.launch {
            runCatching {
                contacts = api.searchDirectory(contactSearch)
                conversations = api.getConversations()
                callRecords = api.getCallHistory()
            }
        }
    }

    fun startOutgoingCall(peer: UserProfile) {
        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        activeCallPeerId = peer.id
        activeCallPeerName = peer.fullName
        activeCallPeerNumber = peer.demoVirtualNumber
        isCallConnected = false
        isMuted = false
        route = ScreenRoute.ACTIVE_CALL

        webRtc.createOffer { offerSdp ->
            socketManager.initiateCall(peer.id, offerSdp) { ok, callId, _ ->
                if (ok && callId != null) {
                    activeCallId = callId
                } else {
                    webRtc.close()
                    route = ScreenRoute.HOME
                    refreshDashboardData()
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        socketManager.events.collect { ev ->
            when (ev) {
                is SignalingEvent.PresenceChanged -> refreshDashboardData()
                is SignalingEvent.NewMessage -> {
                    if (activeChatPeer?.id == ev.senderId) {
                        chatMessages = api.getMessages(ev.senderId)
                        socketManager.markMessagesRead(ev.senderId)
                    }
                    conversations = api.getConversations()
                }
                is SignalingEvent.MessagesRead -> {
                    activeChatPeer?.let { chatMessages = api.getMessages(it.id) }
                }
                is SignalingEvent.IncomingCall -> {
                    activeCallId = ev.callId
                    activeCallPeerId = ev.callerId
                    activeCallPeerName = ev.callerName
                    activeCallPeerNumber = ev.callerNumber
                    activeCallOffer = ev.sdpOffer
                    isCallConnected = false
                    route = ScreenRoute.INCOMING_CALL
                }
                is SignalingEvent.CallAccepted -> {
                    webRtc.setRemoteAnswer(ev.sdpAnswer)
                    isCallConnected = true
                }
                is SignalingEvent.CallRejected, is SignalingEvent.CallEnded -> {
                    webRtc.close()
                    activeCallId = null
                    isCallConnected = false
                    route = ScreenRoute.HOME
                    refreshDashboardData()
                }
                is SignalingEvent.IceCandidateReceived -> {
                    webRtc.addRemoteIceCandidate(ev.candidateJson)
                }
            }
        }
    }

    ESIMConnectTheme(darkTheme = isDarkTheme) {
        val showBottomBar = route in setOf(
            ScreenRoute.HOME, ScreenRoute.CONTACTS, ScreenRoute.DIALER, ScreenRoute.CHATS, ScreenRoute.PROFILE
        )

        Scaffold(
            bottomBar = {
                if (showBottomBar) {
                    NavigationBar {
                        NavigationBarItem(
                            selected = route == ScreenRoute.HOME,
                            onClick = { route = ScreenRoute.HOME },
                            icon = { Icon(Icons.Rounded.Home, null) },
                            label = { Text("Home") }
                        )
                        NavigationBarItem(
                            selected = route == ScreenRoute.CONTACTS,
                            onClick = { route = ScreenRoute.CONTACTS },
                            icon = { Icon(Icons.Rounded.Contacts, null) },
                            label = { Text("Contacts") }
                        )
                        NavigationBarItem(
                            selected = route == ScreenRoute.DIALER,
                            onClick = { route = ScreenRoute.DIALER },
                            icon = { Icon(Icons.Rounded.Dialpad, null) },
                            label = { Text("Dialer") }
                        )
                        NavigationBarItem(
                            selected = route == ScreenRoute.CHATS,
                            onClick = { route = ScreenRoute.CHATS },
                            icon = { Icon(Icons.AutoMirrored.Rounded.Chat, null) },
                            label = { Text("Chats") }
                        )
                        NavigationBarItem(
                            selected = route == ScreenRoute.PROFILE,
                            onClick = { route = ScreenRoute.PROFILE },
                            icon = { Icon(Icons.Rounded.Person, null) },
                            label = { Text("Profile") }
                        )
                    }
                }
            }
        ) { innerPadding ->
            Box(modifier = Modifier.padding(innerPadding)) {
                when (route) {
                    ScreenRoute.SPLASH -> SplashScreen { route = ScreenRoute.LOGIN }
                    ScreenRoute.LOGIN -> LoginScreen(
                        isLoading = isLoading,
                        errorMessage = authError,
                        onLogin = { email, pass ->
                            scope.launch {
                                isLoading = true
                                authError = null
                                runCatching { api.login(email, pass) }
                                    .onSuccess { res ->
                                        api.authToken = res.token
                                        currentUser = res.user
                                        socketManager.connect(res.token)
                                        refreshDashboardData()
                                        route = ScreenRoute.HOME
                                    }
                                    .onFailure { authError = it.message }
                                isLoading = false
                            }
                        },
                        onNavigateRegister = { authError = null; route = ScreenRoute.REGISTER },
                        onResetPassword = { email, onOtp ->
                            scope.launch {
                                runCatching { api.requestPasswordReset(email) }
                                    .onSuccess(onOtp)
                                    .onFailure { authError = it.message }
                            }
                        },
                        onConfirmReset = { email, code, newPass, onDone ->
                            scope.launch {
                                runCatching { api.confirmPasswordReset(email, code, newPass) }
                                    .onSuccess { onDone() }
                                    .onFailure { authError = it.message }
                            }
                        }
                    )
                    ScreenRoute.REGISTER -> RegistrationScreen(
                        isLoading = isLoading,
                        errorMessage = authError,
                        pendingOtp = pendingOtp,
                        onRegister = { name, email, pass ->
                            scope.launch {
                                isLoading = true
                                authError = null
                                runCatching { api.register(name, email, pass) }
                                    .onSuccess { res ->
                                        api.authToken = res.token
                                        currentUser = res.user
                                        pendingOtp = res.demoOtp
                                        socketManager.connect(res.token)
                                        refreshDashboardData()
                                    }
                                    .onFailure { authError = it.message }
                                isLoading = false
                            }
                        },
                        onVerifyOtp = { code ->
                            scope.launch {
                                runCatching { api.verifyDemoOtp(code) }
                                    .onSuccess { updated ->
                                        currentUser = updated
                                        pendingOtp = null
                                        route = ScreenRoute.HOME
                                    }
                                    .onFailure { authError = it.message }
                            }
                        },
                        onSkipOtp = { pendingOtp = null; route = ScreenRoute.HOME },
                        onNavigateLogin = { authError = null; route = ScreenRoute.LOGIN }
                    )
                    ScreenRoute.HOME -> currentUser?.let { user ->
                        HomeDashboardScreen(
                            user = user,
                            contacts = contacts,
                            calls = callRecords,
                            conversations = conversations,
                            onCallUser = ::startOutgoingCall,
                            onOpenChat = { peer ->
                                activeChatPeer = peer
                                scope.launch {
                                    chatMessages = api.getMessages(peer.id)
                                    route = ScreenRoute.PRIVATE_CHAT
                                }
                            },
                            onOpenDemoNumber = { route = ScreenRoute.DEMO_NUMBER }
                        )
                    }
                    ScreenRoute.CONTACTS -> ContactsScreen(
                        contacts = contacts,
                        searchQuery = contactSearch,
                        onSearchChange = { q ->
                            contactSearch = q
                            refreshDashboardData()
                        },
                        onCallUser = ::startOutgoingCall,
                        onMessageUser = { peer ->
                            activeChatPeer = peer
                            scope.launch {
                                chatMessages = api.getMessages(peer.id)
                                route = ScreenRoute.PRIVATE_CHAT
                            }
                        }
                    )
                    ScreenRoute.DIALER -> DialerScreen(
                        onDialNumber = { num ->
                            scope.launch {
                                runCatching { api.lookupByNumber(num) }
                                    .onSuccess { peer -> startOutgoingCall(peer) }
                            }
                        }
                    )
                    ScreenRoute.CHATS -> ChatListScreen(
                        conversations = conversations,
                        onSelectPeer = { peer ->
                            activeChatPeer = peer
                            scope.launch {
                                chatMessages = api.getMessages(peer.id)
                                route = ScreenRoute.PRIVATE_CHAT
                            }
                        }
                    )
                    ScreenRoute.PRIVATE_CHAT -> {
                        val user = currentUser
                        val peer = activeChatPeer
                        if (user != null && peer != null) {
                            PrivateChatScreen(
                                myUserId = user.id,
                                peer = peer,
                                messages = chatMessages,
                                onBack = { route = ScreenRoute.CHATS; refreshDashboardData() },
                                onCallPeer = { startOutgoingCall(peer) },
                                onSendMessage = { text ->
                                    scope.launch {
                                        runCatching { api.sendMessage(peer.id, text) }
                                            .onSuccess { msg -> chatMessages = chatMessages + msg }
                                    }
                                }
                            )
                        }
                    }
                    ScreenRoute.DEMO_NUMBER -> currentUser?.let { user ->
                        DemoNumberScreen(
                            user = user,
                            onRegenerate = {
                                scope.launch {
                                    runCatching { api.updateProfile(user.fullName, user.bio, regenerateNumber = true) }
                                        .onSuccess { currentUser = it }
                                }
                            }
                        )
                    }
                    ScreenRoute.PROFILE -> currentUser?.let { user ->
                        ProfileScreen(
                            user = user,
                            demoOtp = pendingOtp,
                            onUpdateProfile = { name, bio ->
                                scope.launch {
                                    runCatching { api.updateProfile(name, bio) }
                                        .onSuccess { currentUser = it }
                                }
                            },
                            onGenerateOtp = {
                                scope.launch {
                                    runCatching { api.generateDemoOtp() }.onSuccess { pendingOtp = it }
                                }
                            },
                            onVerifyOtp = { code ->
                                scope.launch {
                                    runCatching { api.verifyDemoOtp(code) }
                                        .onSuccess { currentUser = it; pendingOtp = null }
                                }
                            },
                            onLogout = {
                                socketManager.disconnect()
                                api.authToken = null
                                currentUser = null
                                route = ScreenRoute.LOGIN
                            }
                        )
                    }
                    ScreenRoute.SETTINGS -> SettingsScreen(
                        isDarkTheme = isDarkTheme,
                        onToggleTheme = { isDarkTheme = it },
                        onOpenDemoNumber = { route = ScreenRoute.DEMO_NUMBER },
                        onLogout = {
                            socketManager.disconnect()
                            api.authToken = null
                            currentUser = null
                            route = ScreenRoute.LOGIN
                        }
                    )
                    ScreenRoute.INCOMING_CALL -> IncomingCallScreen(
                        callerName = activeCallPeerName,
                        callerNumber = activeCallPeerNumber,
                        onAccept = {
                            micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                            val cid = activeCallId ?: return@IncomingCallScreen
                            val pid = activeCallPeerId ?: return@IncomingCallScreen
                            val offer = activeCallOffer ?: return@IncomingCallScreen
                            webRtc.createAnswer(offer) { answerSdp ->
                                socketManager.acceptCall(cid, pid, answerSdp)
                                isCallConnected = true
                                route = ScreenRoute.ACTIVE_CALL
                            }
                        },
                        onReject = {
                            val cid = activeCallId
                            val pid = activeCallPeerId
                            if (cid != null && pid != null) socketManager.rejectCall(cid, pid)
                            route = ScreenRoute.HOME
                        }
                    )
                    ScreenRoute.ACTIVE_CALL -> ActiveCallScreen(
                        peerName = activeCallPeerName,
                        peerNumber = activeCallPeerNumber,
                        callStateLabel = "Calling...",
                        isConnected = isCallConnected,
                        isMuted = isMuted,
                        isSpeakerOn = isSpeaker,
                        onToggleMute = {
                            isMuted = !isMuted
                            webRtc.setMuted(isMuted)
                        },
                        onToggleSpeaker = {
                            isSpeaker = !isSpeaker
                            webRtc.setSpeakerphone(isSpeaker)
                        },
                        onEndCall = { duration ->
                            val cid = activeCallId
                            val pid = activeCallPeerId
                            if (cid != null && pid != null) socketManager.endCall(cid, pid, duration)
                            webRtc.close()
                            isCallConnected = false
                            route = ScreenRoute.HOME
                            refreshDashboardData()
                        }
                    )
                }
            }
        }
    }
}
