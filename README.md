# Figural

An iOS app that captures hand-drawn content through Meta Ray-Ban glasses and generates AI-powered output from the drawings.

## Features

- **Connect to Meta Ray-Ban Glasses** - Seamless integration with Meta Wearables Device Access Toolkit
- **Live Camera Preview** - Stream video from your glasses in real-time
- **Capture Drawings** - Take photos of hand-drawn sketches through the glasses
- **AI-Powered Generation** - Transform drawings into:
  - SwiftUI code from UI mockups
  - React components from wireframes
  - Mermaid chart syntax from diagrams
  - Design feedback and suggestions
  - Swift code from flowcharts

## Requirements

- iOS 16.0+
- Xcode 15.0+
- Meta Ray-Ban glasses
- Meta AI app installed on your device
- Anthropic API key

## Setup

### 1. Clone and Open Project

```bash
cd Figural
open Package.swift
```

Or create a new Xcode project and add the Swift package dependency.

### 2. Add Meta Wearables SDK

Add the Swift Package dependency:
- URL: `https://github.com/facebook/meta-wearables-dat-ios`
- Version: 0.4.0+

### 3. Configure API Key

Open `Figural/Constants.swift` and add your Anthropic API key:

```swift
static let anthropicAPIKey: String = "your-api-key-here"
```

Get your API key from [console.anthropic.com](https://console.anthropic.com)

### 4. Info.plist Configuration

The `Info.plist` is pre-configured with all required keys:
- Custom URL scheme (`sketchai://`) for Meta AI callbacks
- Bluetooth and external accessory background modes
- Meta Wearables DAT configuration

## Usage

1. **Connect Glasses** - Open the app and tap "Connect Glasses" to register with Meta AI
2. **Grant Permissions** - Allow camera access when prompted
3. **Start Stream** - Tap "Start" to begin streaming from your glasses
4. **Frame Your Drawing** - Position your hand-drawn sketch in view
5. **Select Mode** - Choose the type of output you want (UI Mockup, Wireframe, etc.)
6. **Capture** - Tap the Capture button to photograph your drawing
7. **View Results** - The AI will analyze your drawing and generate output

## Architecture

The app follows MVVM architecture:

- **GlassesManager** - Handles device registration, permissions, and connection state
- **CaptureViewModel** - Manages camera streaming, photo capture, and AI generation
- **Views** - SwiftUI views for onboarding, permissions, and main functionality

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

## Troubleshooting

- **Registration fails**: Ensure Meta AI app is installed and you have internet connectivity
- **Stream won't start**: Check that glasses are connected and camera permission is granted
- **No preview**: Make sure glasses are being worn (wear detection may pause the stream)
- **AI generation fails**: Verify your API key is correctly configured in `Constants.swift`

## License

MIT License
