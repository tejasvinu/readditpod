const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'lib/kokoro-bundle': './src/lib/kokoro-wrapper.js',
    'src/content': './src/content.js',
    'src/background': './src/background.js',
    'src/tts-engine': './src/tts-engine.js',
    'src/popup/popup': './src/popup/popup.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  mode: 'production',
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '' },
        { from: 'src/popup/popup.html', to: 'src/popup/popup.html' },
        { from: 'src/popup/popup.css', to: 'src/popup/popup.css' }
      ]
    })
  ]
};
