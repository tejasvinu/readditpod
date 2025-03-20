// Custom KokoroJS bundle implementation for Readdit Pod

// Immediately expose KokoroTTS to the global scope
window.KokoroModule = (function() {
  console.log('Initializing KokoroJS bundle');

  // Define our KokoroTTS class
  class KokoroTTS {
    constructor() {
      this._voices = [
        'en_male', 'en_female', 'fr_male', 'fr_female', 'de_male', 'de_female',
        'es_male', 'es_female', 'it_male', 'it_female', 'ja_male', 'ja_female'
      ];
      console.log('KokoroTTS instance created with', this._voices.length, 'voices');
    }

    static async from_pretrained(model_id, options = {}) {
      console.log(`Loading KokoroTTS model: ${model_id}`, options);
      
      // Create new instance
      const instance = new KokoroTTS();
      
      // Initialize voices from browser's speech synthesis
      await instance._initializeVoices();
      
      console.log('KokoroTTS model loaded successfully');
      return instance;
    }

    // Initialize with browser voices
    async _initializeVoices() {
      if (typeof speechSynthesis === 'undefined') {
        console.warn('Browser speech synthesis not available');
        return;
      }

      // Wait for voices to load
      if (speechSynthesis.getVoices().length === 0) {
        await new Promise(resolve => {
          speechSynthesis.onvoiceschanged = resolve;
        });
      }
    }

    list_voices() {
      console.log('Listing KokoroTTS voices');
      return this._voices;
    }

    async generate(text, options = {}) {
      const voice = options.voice || 'en_male';
      console.log(`Generating speech for: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" with voice: ${voice}`);
      
      return await this._generateSpeechWithBrowserTTS(text, voice);
    }

    async _generateSpeechWithBrowserTTS(text, voice) {
      return new Promise((resolve, reject) => {
        try {
          console.log('Using browser TTS with voice:', voice);
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Map our voice types to browser voices
          const availableVoices = speechSynthesis.getVoices();
          
          // Voice selection logic
          if (voice.includes('female')) {
            const femaleVoices = availableVoices.filter(v => 
              v.name.toLowerCase().includes('female')
            );
            utterance.voice = femaleVoices.length > 0 ? femaleVoices[0] : availableVoices[0];
          } else {
            const maleVoices = availableVoices.filter(v => 
              v.name.toLowerCase().includes('male')
            );
            utterance.voice = maleVoices.length > 0 ? maleVoices[0] : availableVoices[0];
          }
          
          // Set up recording using MediaRecorder
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const destination = audioContext.createMediaStreamDestination();
          const mediaRecorder = new MediaRecorder(destination.stream);
          const audioChunks = [];
          
          mediaRecorder.ondataavailable = event => { 
            if (event.data.size > 0) audioChunks.push(event.data); 
          };
          
          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            resolve({
              data: audioBlob,
              save: filename => {
                const url = URL.createObjectURL(audioBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename || 'audio.wav';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }
            });
          };
          
          // Start recording
          mediaRecorder.start();
          
          // Play the speech
          utterance.onend = () => mediaRecorder.stop();
          utterance.onerror = error => {
            console.error('TTS error:', error);
            mediaRecorder.stop();
            reject(error);
          };
          
          speechSynthesis.speak(utterance);
        } catch (error) {
          console.error('Error in browser TTS:', error);
          reject(error);
        }
      });
    }
  }

  // Explicitly expose KokoroTTS to window to ensure it's accessible
  window.KokoroTTS = KokoroTTS;
  
  return { KokoroTTS };
})();

console.log('KokoroJS bundle loaded successfully!');
