import { KokoroTTS } from 'kokoro-js';

// Expose KokoroTTS to the window object so our extension can use it
window.KokoroModule = { 
  KokoroTTS: KokoroTTS 
};

console.log('KokoroJS bundle successfully loaded');
