# Add project specific ProGuard rules here.
# Keep Meta Wearables SDK classes
-keep class com.meta.wearable.** { *; }

# Keep data classes for JSON parsing
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
