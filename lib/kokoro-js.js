// KokoroJS module loader

// This is a placeholder module that will dynamically load KokoroJS from a CDN
// In a production environment, you would bundle KokoroJS with your extension

(function() {
    // Load KokoroJS from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/kokoro-js@latest/dist/index.min.js';
    script.async = true;
    
    script.onload = () => {
        console.log('KokoroJS loaded successfully');
    };
    
    script.onerror = (error) => {
        console.error('Failed to load KokoroJS:', error);
    };
    
    document.head.appendChild(script);
    
    // Export KokoroTTS for use in other modules
    if (typeof window.KokoroTTS === 'undefined') {
        Object.defineProperty(window, 'KokoroTTS', {
            get: function() {
                return window.kokoro?.KokoroTTS;
            }
        });
    }
})();

// Export the module interface
export const KokoroTTS = window.KokoroTTS;
