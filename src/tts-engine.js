// TTS engine for Readdit Pod

const ttsEngine = {
    speechSynthesis: window.speechSynthesis,
    voices: [],
    audioContext: null,
    audioDestination: null,
    
    // Initialize the TTS engine
    async initialize() {
        if (this.voices.length > 0) return;

        // Wait for voices to load
        if (this.speechSynthesis.getVoices().length === 0) {
            await new Promise(resolve => {
                this.speechSynthesis.onvoiceschanged = resolve;
            });
        }

        this.voices = this.speechSynthesis.getVoices();
        console.log(`Loaded ${this.voices.length} voices`);
        
        // Initialize audio context for recording if available
        if (window.audioContext && window.audioDestination) {
            this.audioContext = window.audioContext;
            this.audioDestination = window.audioDestination;
        } else {
            // Create local audio context if not already available
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    
    // Get available voices
    getAvailableVoices() {
        return this.voices.map(voice => ({
            id: voice.voiceURI,
            name: voice.name,
            lang: voice.lang
        }));
    },
    
    // Speak text
    speak(text, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                const utterance = new SpeechSynthesisUtterance(text);
                
                // Apply settings
                if (options.voiceType === 'male') {
                    // Find male voice
                    const maleVoices = this.voices.filter(v => 
                        v.name.toLowerCase().includes('male') || 
                        (!v.name.toLowerCase().includes('female') && Math.random() > 0.5)
                    );
                    utterance.voice = maleVoices.length > 0 ? maleVoices[0] : this.voices[0];
                } else if (options.voiceType === 'female') {
                    // Find female voice
                    const femaleVoices = this.voices.filter(v => 
                        v.name.toLowerCase().includes('female') || 
                        (!v.name.toLowerCase().includes('male') && Math.random() > 0.5)
                    );
                    utterance.voice = femaleVoices.length > 0 ? femaleVoices[0] : this.voices[1] || this.voices[0];
                } else if (options.voiceType) {
                    // Use the specified voice by ID
                    const voice = this.voices.find(v => v.voiceURI === options.voiceType);
                    if (voice) {
                        utterance.voice = voice;
                    }
                }
                
                // Set speaking rate
                utterance.rate = options.speakingRate || 1.0;
                
                // Events
                utterance.onend = () => {
                    resolve();
                };
                
                utterance.onerror = (event) => {
                    reject(new Error(`Speech synthesis error: ${event.error}`));
                };

                // Connect to audio destination for recording if available
                if (this.audioContext && this.audioDestination && window.audioDestination) {
                    // Create a MediaStreamAudioSourceNode
                    // Feed the HTMLMediaElement into it
                    const source = this.audioContext.createMediaStreamSource(window.audioDestination.stream);
                    
                    // Connect the source to the destination
                    source.connect(this.audioContext.destination);
                }
                
                // Start speaking
                this.speechSynthesis.speak(utterance);
            } catch (error) {
                reject(error);
            }
        });
    },
    
    // Cancel speech
    cancel() {
        this.speechSynthesis.cancel();
    }
};

export default ttsEngine;