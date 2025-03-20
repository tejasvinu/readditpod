# Readdit Pod - Reddit to Podcast Extension

This Chrome extension converts Reddit posts into podcast-style narrations with KokoroJS TTS.

## Project Structure

```
Readditpod
├── src
│   ├── background.js       # Background script for handling events and the extension's lifecycle
│   ├── content.js          # Content script for interacting with Reddit pages
│   ├── tts-engine.js       # TTS engine implementation using KokoroJS
│   ├── lib
│   │   └── kokoro-wrapper.js # Wrapper for the KokoroJS library
│   └── popup
│       ├── popup.html      # HTML for the popup interface
│       ├── popup.js        # JavaScript for handling user interactions
│       └── popup.css       # Styles for the popup interface
├── package.json           # Node package configuration
├── webpack.config.js      # Webpack configuration for bundling
├── manifest.json          # Configuration file for the Chrome extension
├── icons
│   ├── icon16.png          # 16x16 pixel icon for the extension
│   ├── icon48.png          # 48x48 pixel icon for the extension
│   └── icon128.png         # 128x128 pixel icon for the extension
└── README.md               # Documentation for the project
```

## Development Setup

1. Clone the repository or download the source code.
2. Install dependencies:
   ```
   npm install
   ```
3. Build the extension:
   ```
   npm run build
   ```
4. For development with auto-rebuild:
   ```
   npm run watch
   ```

## Installation

1. Build the extension using the steps above.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click on "Load unpacked" and select the `dist` directory created from the build process.

## Usage

1. Visit any Reddit post.
2. Click the "🎙️ Create Podcast" button that appears at the top right of the page.
3. Enter your Gemini API key when prompted (required for script generation).
4. Wait for the extension to generate a podcast script and audio.
5. Use the audio player controls to listen to the podcast.
6. Optionally download the audio for later listening.

## Features

- Converts Reddit posts and comments into conversational podcast scripts
- Uses KokoroJS for text-to-speech generation
- Supports multiple voices for different podcast hosts
- Allows downloading generated podcasts as audio files
- Maintains history of generated podcasts

## API Key Requirements

This extension requires a Gemini API key for generating the podcast scripts. You can get a free API key from Google AI Studio.

## Troubleshooting

If you encounter issues:
1. Make sure you're on a Reddit post page
2. Ensure your Gemini API key is correct and has sufficient quota
3. Try refreshing the page if the extension doesn't appear to be working
4. Check the browser console for error messages

## Contributing

Feel free to submit issues or pull requests if you have suggestions or improvements for the extension.