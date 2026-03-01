# Figural - Draw & Voice to Code

A browser-based app that transforms hand-drawn UI layouts and voice descriptions into working web applications.

## Features

### Drawing Canvas
- **Select & Move** - Click and drag elements to reposition them (V key)
- **Freehand drawing** - Sketch freely with pen tool
- **Basic shapes** - Rectangle, circle, and line tools
- **Text tool** - Add text labels to your designs
- **Image tool** - Add images via upload, drag & drop, or paste (Ctrl+V)
- **Eraser** - Remove unwanted strokes
- **Undo/Redo** - Full history support
- **Timestamped elements** - All drawing events are captured with timestamps

### Vision-Powered Generation
- **Canvas screenshot** - The entire canvas is captured and sent to Claude's vision API
- **Visual interpretation** - AI sees your actual drawing, not just coordinates
- **Image context** - Uploaded images are included in the visual analysis

### Voice Recording
- **MediaRecorder API** - Records audio while you draw
- **NVIDIA Parakeet ASR** - Accurate transcription using NVIDIA's speech recognition model
- **Web Speech API** - Optional real-time preview (fallback)
- **Synchronized input** - Drawing and voice are timestamp-aligned

### Text Prompt Input
- **Alternative to voice** - Type descriptions instead of recording
- **Combinable with voice** - Use both for richer context
- **Auto-save** - Persists with your session
- **Quick generate** - Press Enter to generate immediately

### AI App Generation
- Sends drawing structure + voice transcript to AI
- Interprets rough layouts to create clean code
- Generates:
  - `index.html` - Semantic HTML5
  - `styles.css` - Responsive CSS
  - `script.js` - Vanilla JavaScript interactions

### Preview Mode
- Live preview in iframe
- Edit code directly
- Download as separate files
- Regenerate with one click

## How to Run

**No build step required!** Simply open `index.html` in a modern browser.

### Option 1: Direct file open
Double-click `index.html` or drag it into your browser.

### Option 2: Local server (recommended for full features)
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Usage

1. **Draw your UI** - Use the toolbar to sketch rectangles, shapes, and add text
2. **Describe it** - Either:
   - **Record your voice** - Click "Record Voice" and speak your description
   - **Type a prompt** - Enter text in the prompt field (or use both!)
3. **Generate** - Click "Generate App" (or press Enter in the text field)
4. **Preview & Edit** - View the result, edit code if needed, download files

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select & Move tool |
| P | Pen tool |
| L | Line tool |
| R | Rectangle tool |
| C | Circle tool |
| T | Text tool |
| E | Eraser |
| I | Add image |
| Delete/Backspace | Delete selected element |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+V | Paste image from clipboard |
| Escape | Close dialogs / Deselect |

## API Configuration

### Speech Recognition (NVIDIA Parakeet)

The app uses NVIDIA Parakeet for accurate speech-to-text transcription. The API key is configured in `app.js`:

```javascript
const CONFIG = {
  // NVIDIA Parakeet ASR
  NVIDIA_API_KEY: 'your-nvidia-api-key',
  NVIDIA_ASR_URL: 'https://integrate.api.nvidia.com/v1/audio/transcriptions',
  NVIDIA_ASR_MODEL: 'nvidia/parakeet-ctc-1.1b-asr',
  // ...
};
```

Get your NVIDIA API key from [build.nvidia.com](https://build.nvidia.com)

### AI Code Generation (Anthropic Claude)

To use real AI generation instead of mock templates, add your Anthropic API key:

```javascript
const CONFIG = {
  AI_API_KEY: 'your-anthropic-api-key',
  AI_API_URL: 'https://api.anthropic.com/v1/messages',
  AI_MODEL: 'claude-sonnet-4-20250514',
  // ...
};
```

### Supported AI Providers

The code is structured to easily swap AI providers:

- **NVIDIA Parakeet** - Speech recognition (ASR)
- **Anthropic Claude** (default) - Code generation
- **OpenAI GPT-4** - Change endpoint and headers
- **NVIDIA Nemotron** - Change to NIM endpoint for code generation

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Canvas Drawing | ✅ | ✅ | ✅ | ✅ |
| MediaRecorder | ✅ | ✅ | ✅ | ✅ |
| Speech Recognition | ✅ | ❌ | ✅ | ✅ |
| localStorage | ✅ | ✅ | ✅ | ✅ |

> Note: Speech Recognition uses the Web Speech API which has limited Firefox support. Audio recording still works.

## Project Structure

```
web/
├── index.html      # Main HTML structure
├── styles.css      # All CSS styles
├── app.js          # Application logic
└── README.md       # This file
```

## Mock Generation

Without an API key, the app uses intelligent mock generation that detects:
- **Forms** - From keywords like "login", "signup", "form"
- **Cards/Products** - From multiple rectangles or "product", "card" keywords
- **Dashboards** - From "dashboard", "chart" keywords
- **Generic landing page** - Default fallback

Keywords are detected from both voice transcripts and text prompts.

## Data Persistence

Sessions are automatically saved to `localStorage`:
- Drawing elements
- Voice transcripts
- Text prompt input
- Timestamps

Clear browser data to reset.

## License

MIT License
