# Figural Android App

An Android app that captures hand-drawn content through Meta Ray-Ban glasses and generates AI-powered output from the drawings.

## Features

- **Connect to Meta Ray-Ban Glasses** - Integration with Meta Wearables Device Access Toolkit
- **Live Camera Preview** - Stream video from your glasses in real-time
- **Capture Drawings** - Take photos of hand-drawn sketches
- **AI-Powered Generation** - Transform drawings into:
  - SwiftUI code from UI mockups
  - React components from wireframes
  - Mermaid chart syntax from diagrams
  - Design feedback and suggestions
  - Swift code from flowcharts

## Requirements

- Android 8.0 (API 26) or higher
- Android Studio Hedgehog (2023.1.1) or newer
- Meta Ray-Ban glasses
- Meta AI app installed on your device
- Anthropic API key

## Setup

### 1. Clone and Open Project

Open the `android` folder in Android Studio.

### 2. Add Meta Wearables SDK

The SDK is configured in `app/build.gradle.kts`. Make sure you have JitPack repository access.

### 3. Configure API Key

Open `app/src/main/java/com/figural/app/Constants.kt` and add your Anthropic API key:

```kotlin
const val ANTHROPIC_API_KEY = "your-api-key-here"
```

Get your API key from [console.anthropic.com](https://console.anthropic.com)

### 4. Build and Run

1. Connect your Android device
2. Enable USB debugging
3. Click Run in Android Studio

## Project Structure

```
android/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/figural/app/
│   │   │   ├── FiguralApplication.kt    # Application class
│   │   │   ├── MainActivity.kt          # Main activity + navigation
│   │   │   ├── Constants.kt             # API configuration
│   │   │   ├── manager/
│   │   │   │   └── GlassesManager.kt    # Device registration & permissions
│   │   │   ├── model/
│   │   │   │   └── GenerationMode.kt    # Generation mode enum
│   │   │   ├── viewmodel/
│   │   │   │   └── CaptureViewModel.kt  # Streaming & AI integration
│   │   │   └── ui/
│   │   │       ├── theme/
│   │   │       │   └── Theme.kt         # Material 3 theme
│   │   │       ├── components/
│   │   │       │   └── GradientButton.kt
│   │   │       └── screens/
│   │   │           ├── OnboardingScreen.kt
│   │   │           ├── PermissionScreen.kt
│   │   │           └── MainScreen.kt
│   │   └── res/
│   │       └── values/
│   │           ├── strings.xml
│   │           ├── colors.xml
│   │           └── themes.xml
│   └── build.gradle.kts
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

## Architecture

The app follows MVVM architecture with Jetpack Compose:

- **GlassesManager** - Handles device registration, permissions, and connection state using Kotlin Flows
- **CaptureViewModel** - Manages camera streaming, photo capture, and AI generation
- **Screens** - Jetpack Compose screens for onboarding, permissions, and main functionality

## Usage

1. **Connect Glasses** - Open the app and tap "Connect Glasses" to register with Meta AI
2. **Grant Permissions** - Allow camera access when prompted
3. **Start Stream** - Tap "Start" to begin streaming from your glasses
4. **Frame Your Drawing** - Position your hand-drawn sketch in view
5. **Select Mode** - Choose the type of output you want
6. **Capture** - Tap the Capture button to photograph your drawing
7. **View Results** - The AI will analyze your drawing and generate output

## Generation Modes

| Mode | Input | Output |
|------|-------|--------|
| UI Mockup | Hand-drawn UI sketch | SwiftUI code + suggestions |
| Wireframe | Wireframe drawing | React + Tailwind components |
| Diagram | Any diagram | Mermaid chart syntax |
| Design Feedback | Sketch | Professional design critique |
| Flowchart | Flowchart drawing | Pseudocode + Swift implementation |

## Developer Mode

The app is configured for developer mode (`MetaAppID = "0"`). For production deployment, obtain an App ID from the [Wearables Developer Center](https://wearables.developer.meta.com).

## Dependencies

- Meta Wearables DAT SDK
- Jetpack Compose + Material 3
- AndroidX Lifecycle & ViewModel
- OkHttp for networking
- Coil for image loading

## Troubleshooting

- **Registration fails**: Ensure Meta AI app is installed and you have internet connectivity
- **Stream won't start**: Check that glasses are connected and camera permission is granted
- **No preview**: Make sure glasses are being worn (wear detection may pause the stream)
- **AI generation fails**: Verify your API key is correctly configured

## License

MIT License
