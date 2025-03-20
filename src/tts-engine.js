// TTS engine for Readdit Pod using KokoroJS

// Reference to KokoroTTS class
let KokoroTTS;

const ttsEngine = {
    kokoroInstance: null,
    voices: [],
    audioContext: null,
    audioDestination: null,
    currentAudio: null,
    
    // Initialize the TTS engine
    async initialize() {
        try {
            console.log('Initializing TTS engine with KokoroJS');
            
            // Load the bundled library
            console.log('Loading KokoroJS bundle...');
            await this._loadKokoroBundle();
            
            // Short delay to ensure script is fully processed
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log('Checking for KokoroTTS in window:', 
                        'KokoroModule' in window, 
                        'KokoroTTS' in window);
            
            // Try multiple ways to get KokoroTTS
            if (window.KokoroTTS) {
                console.log('Found KokoroTTS directly in window');
                KokoroTTS = window.KokoroTTS;
            } else if (window.KokoroModule && window.KokoroModule.KokoroTTS) {
                console.log('Found KokoroTTS in window.KokoroModule');
                KokoroTTS = window.KokoroModule.KokoroTTS;
            } else {
                console.error('KokoroTTS not found in window after loading bundle');
                throw new Error('KokoroTTS not available after loading bundle');
            }
            
            if (!this.kokoroInstance) {
                const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";
                console.log('Creating KokoroTTS instance with model:', model_id);
                this.kokoroInstance = await KokoroTTS.from_pretrained(model_id, {
                    dtype: "q8", 
                    device: "wasm"
                });
                
                // Get all available voices
                this.voices = this.kokoroInstance.list_voices().map(voice => ({
                    id: voice,
                    name: voice.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    lang: voice.split('_')[0]
                }));
                
                console.log(`Loaded ${this.voices.length} Kokoro voices`);
            }
            
            // Initialize audio context for recording
            if (window.audioContext && window.audioDestination) {
                this.audioContext = window.audioContext;
                this.audioDestination = window.audioDestination;
            } else {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        } catch (error) {
            console.error('Failed to initialize KokoroTTS:', error);
            throw error;
        }
    },
    
    // Helper to load the Kokoro bundle
    async _loadKokoroBundle() {
        // Get bundle URL from the extension
        const bundleUrl = chrome.runtime.getURL('lib/kokoro-bundle.js');
        console.log('Loading KokoroJS bundle from:', bundleUrl);
        
        return new Promise((resolve, reject) => {
            try {
                const script = document.createElement('script');
                script.src = bundleUrl;
                script.async = false; // Load synchronously
                
                script.onload = () => {
                    console.log('KokoroJS bundle script loaded successfully');
                    resolve();
                };
                
                script.onerror = (err) => {
                    console.error('Failed to load KokoroJS bundle:', err);
                    reject(new Error('Failed to load KokoroJS bundle'));
                };
                
                document.head.appendChild(script);
            } catch (error) {
                console.error('Error in _loadKokoroBundle:', error);
                reject(error);
            }
        });
    },
    
    // Helper method to load a script
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = false; // Load synchronously to ensure proper order
            script.onload = () => {
                console.log(`Successfully loaded script: ${src}`);
                resolve();
            };
            script.onerror = (err) => {
                console.error(`Failed to load script: ${src}`, err);
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(script);
        });
    },
    
    // Get available voices
    getAvailableVoices() {
        return this.voices;
    },
    
    // Helper method to get appropriate voice based on gender preference
    _getVoiceForType(voiceType) {
        // Default voices for male/female if specific voice not selected
        const maleVoices = this.voices.filter(v => 
            v.id.includes('male') || 
            v.id.includes('m_') ||
            ['en_ryan', 'en_daniel', 'en_dave'].includes(v.id)
        );
        
        const femaleVoices = this.voices.filter(v => 
            v.id.includes('female') || 
            v.id.includes('f_') ||
            ['en_grace', 'en_sarah', 'en_jenny'].includes(v.id)
        );
        
        if (voiceType === 'male') {
            return maleVoices.length > 0 ? maleVoices[0].id : this.voices[0].id;
        } else if (voiceType === 'female') {
            return femaleVoices.length > 0 ? femaleVoices[0].id : this.voices[0].id;
        } else {
            // Return the specific voice or default to first voice
            return voiceType || this.voices[0].id;
        }
    },
    
    // Speak text
    async speak(text, options = {}) {
        try {
            // Cancel any existing speech
            this.cancel();
            
            // Get appropriate voice
            const voice = this._getVoiceForType(options.voiceType);
            
            // Generate audio using Kokoro
            const audio = await this.kokoroInstance.generate(text, {
                voice: voice
                // Note: KokoroJS doesn't support speaking rate adjustment directly
            });
            
            // Create an audio element for playback
            const audioBlob = new Blob([audio.data], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);
            this.currentAudio = new Audio(audioUrl);
            
            // Connect to audio destination for recording if available
            if (this.audioContext && this.audioDestination && window.audioDestination) {
                // Create audio source from the audio element
                const audioElement = this.currentAudio;
                audioElement.crossOrigin = "anonymous";
                
                // We need to play the audio first
                await audioElement.play();
                
                // Create media element source
                const source = this.audioContext.createMediaElementSource(audioElement);
                
                // Connect the source to our destination for recording
                source.connect(this.audioDestination);
                source.connect(this.audioContext.destination);
            } else {
                // Just play the audio normally
                await this.currentAudio.play();
            }
            
            // Return a promise that resolves when audio playback completes
            return new Promise((resolve, reject) => {
                this.currentAudio.onended = () => {
                    // Clean up
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                
                this.currentAudio.onerror = (error) => {
                    URL.revokeObjectURL(audioUrl);
                    reject(error);
                };
            });
        } catch (error) {
            console.error('TTS Error:', error);
            throw error;
        }
    },
    
    // Cancel speech
    cancel() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
    }
};

export default ttsEngine;