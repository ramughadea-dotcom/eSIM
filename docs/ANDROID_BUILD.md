# Android Build & Testing Guide (eSIM Connect)

The complete Kotlin + Jetpack Compose Android project lives in `/android/`.

## 1. Prerequisites (100% Free & Open-Source)
- **Android Studio** (Ladybug or newer, free)
- **JDK 17** (Eclipse Temurin / OpenJDK)
- **Android SDK 35** (compileSdk 35, minSdk 26)
- **Local eSIM Connect Backend** running on `http://localhost:3000`

## 2. Key Open-Source Dependencies Used
- **Jetpack Compose + Material 3**: Modern declarative UI with Light/Dark dynamic surface tokens.
- **Navigation Compose**: Type-safe screen routing across all 13 user screens.
- **Ktor / OkHttp + Retrofit + Kotlinx Serialization**: REST API client for auth, contacts, messages, and call logs.
- **Socket.IO Java Client (`io.socket:socket.io-client:2.1.0`)**: Real-time presence, message delivery/read receipts, and WebRTC signaling.
- **Stream WebRTC Android (`io.getstream:stream-webrtc-android`)**: Free, maintained open-source Android WebRTC audio peer connection library.

## 3. Emulator & Physical Device Networking
- **Android Emulator**: Connects to host computer backend via `http://10.0.2.2:3000`.
- **Physical Android Phone (USB or Wi-Fi)**:
  1. Connect phone and computer to the same Wi-Fi network (or run `adb reverse tcp:3000 tcp:3000`).
  2. Set `BASE_URL` in `android/app/build.gradle.kts` to `http://<YOUR_LAN_IP>:3000` or `http://127.0.0.1:3000` (with `adb reverse`).

## 4. Building Debug & Release APK
Run from `/android`:
```bash
# Build Debug APK
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Install directly onto connected device/emulator
./gradlew installDebug

# Build Release APK (configure signingConfig in app/build.gradle.kts first)
./gradlew assembleRelease
```

### Free Cloud APK Build (No Android Studio Needed)
A GitHub Actions workflow is included at `.github/workflows/build-apk.yml`. Push this repository to GitHub and trigger **Actions → Build Android Debug APK** to download `app-debug.apk` directly from GitHub's free Linux runners.

## 5. Security Notes
- Admin credentials and admin API tokens are **never** compiled into the Android app.
- Passwords and Demo OTP codes are never persisted in plaintext on the client or server.
- Session tokens are stored via Android `EncryptedSharedPreferences` / memory state.
