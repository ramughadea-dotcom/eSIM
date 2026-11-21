# eSIM Connect ProGuard Rules (Kotlinx Serialization, OkHttp, Socket.IO, WebRTC)
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keep,includedescriptorclasses class com.esimconnect.app.data.**$$serializer { *; }
-keepclassmembers class com.esimconnect.app.data.** {
    *** Companion;
}
-keepclasseswithmembers class com.esimconnect.app.data.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class org.webrtc.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
