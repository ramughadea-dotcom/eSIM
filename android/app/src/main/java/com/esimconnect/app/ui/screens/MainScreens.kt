package com.esimconnect.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Chat
import androidx.compose.material.icons.rounded.Backspace
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.PhoneForwarded
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.esimconnect.app.data.CallRecord
import com.esimconnect.app.data.ConversationSummary
import com.esimconnect.app.data.DemoOtpPayload
import com.esimconnect.app.data.UserProfile

@Composable
fun HomeDashboardScreen(
    user: UserProfile,
    contacts: List<UserProfile>,
    calls: List<CallRecord>,
    conversations: List<ConversationSummary>,
    onCallUser: (UserProfile) -> Unit,
    onOpenChat: (UserProfile) -> Unit,
    onOpenDemoNumber: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 1.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenDemoNumber() }
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "Demo Virtual ID (Not a Real SIM)",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = user.demoVirtualNumber,
                        style = MaterialTheme.typography.headlineSmall,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${user.fullName} · ${user.appUserId}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        item {
            Text("Recent Calls", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        if (calls.isEmpty()) {
            item {
                Text(
                    "No recent internet calls yet.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        } else {
            items(calls.take(4)) { call ->
                val isOutgoing = call.callerId == user.id
                val peerName = if (isOutgoing) call.calleeName else call.callerName
                val peerNumber = if (isOutgoing) call.calleeNumber else call.callerNumber
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(peerName, fontWeight = FontWeight.Medium)
                        Text(
                            "${if (isOutgoing) "Outgoing" else "Incoming"} · ${call.status} · ${call.durationSeconds}s",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Text(
                        peerNumber,
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                HorizontalDivider()
            }
        }

        item {
            Text("Recent Messages", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        items(conversations.take(4)) { convo ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenChat(convo.peer) }
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(convo.peer.fullName, fontWeight = FontWeight.Medium)
                    Text(
                        convo.lastMessage.body,
                        maxLines = 1,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = { onCallUser(convo.peer) }) {
                    Icon(Icons.Rounded.Call, contentDescription = "Call")
                }
            }
            HorizontalDivider()
        }

        item {
            Text("Quick Contacts", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        }
        items(contacts.take(4)) { peer ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(peer.fullName, fontWeight = FontWeight.Medium)
                    Text(
                        "${peer.demoVirtualNumber} · ${if (peer.isOnline == 1) "Online" else "Offline"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Row {
                    IconButton(onClick = { onOpenChat(peer) }) {
                        Icon(Icons.AutoMirrored.Rounded.Chat, contentDescription = "Message")
                    }
                    IconButton(onClick = { onCallUser(peer) }) {
                        Icon(Icons.Rounded.Call, contentDescription = "Call")
                    }
                }
            }
        }
    }
}

@Composable
fun ContactsScreen(
    contacts: List<UserProfile>,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    onCallUser: (UserProfile) -> Unit,
    onMessageUser: (UserProfile) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            label = { Text("Search name or +91 9000X demo ID") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(12.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(contacts) { peer ->
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surface,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(peer.fullName, fontWeight = FontWeight.SemiBold)
                            Text(
                                peer.demoVirtualNumber,
                                fontFamily = FontFamily.Monospace,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Text(
                                "${peer.appUserId} · ${if (peer.isOnline == 1) "Online" else "Offline"}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                        Row {
                            IconButton(onClick = { onMessageUser(peer) }) {
                                Icon(Icons.AutoMirrored.Rounded.Chat, contentDescription = "Message")
                            }
                            IconButton(onClick = { onCallUser(peer) }) {
                                Icon(Icons.Rounded.Call, contentDescription = "Voice Call")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DialerScreen(
    onDialNumber: (String) -> Unit
) {
    var input by remember { mutableStateOf("+91 9000") }
    val keys = listOf(
        listOf("1", "2", "3"),
        listOf("4", "5", "6"),
        listOf("7", "8", "9"),
        listOf("*", "0", "#")
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "App-to-App Internet Dialer",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = input.ifBlank { "+91" },
                style = MaterialTheme.typography.headlineMedium,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            keys.forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    row.forEach { digit ->
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.surfaceVariant,
                            modifier = Modifier
                                .size(72.dp)
                                .clickable { input += digit }
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Text(digit, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
            }
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            IconButton(onClick = { if (input.isNotEmpty()) input = input.dropLast(1) }) {
                Icon(Icons.Rounded.Backspace, contentDescription = "Backspace")
            }
            Button(
                onClick = { onDialNumber(input) },
                shape = CircleShape,
                modifier = Modifier.size(68.dp)
            ) {
                Icon(Icons.Rounded.PhoneForwarded, contentDescription = "Call")
            }
        }
    }
}

@Composable
fun DemoNumberScreen(
    user: UserProfile,
    onRegenerate: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Demo Virtual Number", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    "DEMO VIRTUAL ID · INDIA (+91)",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    user.demoVirtualNumber,
                    style = MaterialTheme.typography.headlineMedium,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text("App ID: ${user.appUserId}", color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
        }

        Text(
            text = "Important: This India (+91) formatted number is strictly an app-internal Demo Virtual ID for testing internet calling and messaging inside eSIM Connect. It is NOT a real mobile SIM, eSIM profile, or PSTN phone number.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        OutlinedButton(onClick = onRegenerate, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Rounded.Refresh, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Generate New Demo Number")
        }
    }
}

@Composable
fun ProfileScreen(
    user: UserProfile,
    demoOtp: DemoOtpPayload?,
    onUpdateProfile: (fullName: String, bio: String) -> Unit,
    onGenerateOtp: () -> Unit,
    onVerifyOtp: (String) -> Unit,
    onLogout: () -> Unit
) {
    var fullName by remember(user.fullName) { mutableStateOf(user.fullName) }
    var bio by remember(user.bio) { mutableStateOf(user.bio) }
    var otpInput by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Profile", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text("App User ID: ${user.appUserId} · ${user.email}", style = MaterialTheme.typography.bodySmall)
        Text("Demo Number: ${user.demoVirtualNumber}", fontFamily = FontFamily.Monospace)
        Text(
            "Verification: ${if (user.otpVerified == 1) "Demo OTP Verified" else "Not Verified"}",
            color = MaterialTheme.colorScheme.primary
        )

        OutlinedTextField(value = fullName, onValueChange = { fullName = it }, label = { Text("Full Name") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = bio, onValueChange = { bio = it }, label = { Text("Bio") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = { onUpdateProfile(fullName, bio) }, modifier = Modifier.fillMaxWidth()) {
            Text("Save Profile")
        }

        if (user.otpVerified == 0) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            OutlinedButton(onClick = onGenerateOtp, modifier = Modifier.fillMaxWidth()) {
                Text("Generate Local Demo OTP")
            }
            if (demoOtp != null) {
                Text("Local Demo OTP: ${demoOtp.code}", fontWeight = FontWeight.Bold)
                OutlinedTextField(value = otpInput, onValueChange = { otpInput = it }, label = { Text("Enter Demo OTP") }, modifier = Modifier.fillMaxWidth())
                Button(onClick = { onVerifyOtp(otpInput) }, modifier = Modifier.fillMaxWidth()) {
                    Text("Verify OTP")
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
            Text("Sign Out", color = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
fun SettingsScreen(
    isDarkTheme: Boolean,
    onToggleTheme: (Boolean) -> Unit,
    onOpenDemoNumber: () -> Unit,
    onLogout: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Dark Theme", fontWeight = FontWeight.Medium)
                Text("Switch between Light and Dark mode", style = MaterialTheme.typography.bodySmall)
            }
            Switch(checked = isDarkTheme, onCheckedChange = onToggleTheme)
        }
        HorizontalDivider()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onOpenDemoNumber() }
                .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Manage Demo Virtual Number (+91)")
        }
        HorizontalDivider()
        Text(
            text = "eSIM Connect Open-Source Stack: Kotlin + Jetpack Compose + Node.js + Socket.IO + SQLite + WebRTC (STUN).",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.weight(1f))
        OutlinedButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) {
            Text("Logout")
        }
    }
}
