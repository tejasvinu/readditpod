// Get URL for TTS engine
const ttsEnginePath = chrome.runtime.getURL('src/tts-engine.js');

// Functions will be initialized after importing TTS engine
let ttsEngine;
let audioContext;
let audioDestination;
let audioRecorder;
let audioChunks = [];

// Ensure storage is available
const storage = chrome.storage || browser.storage;
if (!storage) {
    console.error('Storage API not available. The extension may not work properly.');
}

// Error handling for extension context invalidation
function handleExtensionErrors(callback) {
    return async (...args) => {
        try {
            return await callback(...args);
        } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
                console.log('Extension was reloaded. Please refresh the page to use the extension.');
                
                // Show a notification to the user
                const notification = document.createElement('div');
                notification.style.position = 'fixed';
                notification.style.top = '10px';
                notification.style.left = '50%';
                notification.style.transform = 'translateX(-50%)';
                notification.style.backgroundColor = '#FF4500';
                notification.style.color = 'white';
                notification.style.padding = '10px 20px';
                notification.style.borderRadius = '5px';
                notification.style.zIndex = '10000';
                notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
                notification.textContent = 'Readdit Pod was updated. Please refresh the page to use it.';
                
                // Add close button
                const closeBtn = document.createElement('span');
                closeBtn.textContent = '✕';
                closeBtn.style.marginLeft = '10px';
                closeBtn.style.cursor = 'pointer';
                closeBtn.onclick = () => notification.remove();
                notification.appendChild(closeBtn);
                
                document.body.appendChild(notification);
                
                // Auto-remove after 10 seconds
                setTimeout(() => notification.remove(), 10000);
            } else {
                console.error('Error in extension:', error);
                throw error;
            }
        }
    };
}

// Audio recording functions
async function initAudioRecording() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioDestination = audioContext.createMediaStreamDestination();
    }
}

function startRecording() {
    audioChunks = [];
    audioRecorder = new MediaRecorder(audioDestination.stream);
    
    audioRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            audioChunks.push(event.data);
        }
    };
    
    audioRecorder.start();
    console.log('Started recording podcast audio');
}

function stopRecording() {
    return new Promise(resolve => {
        audioRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
            resolve(audioBlob);
        };
        
        audioRecorder.stop();
    });
}

function saveAudioToLocalStorage(audioBlob, podcastTitle) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            const base64Audio = reader.result;
            // Store in local storage with date-based key
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const key = `podcast_${timestamp}`;
            
            try {
                if (!storage || !storage.local) {
                    throw new Error('Chrome storage API not available');
                }
                
                storage.local.set({
                    [key]: {
                        title: podcastTitle,
                        audio: base64Audio,
                        date: new Date().toISOString()
                    }
                }, () => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        console.error('Error saving to storage:', error);
                        reject(error);
                    } else {
                        console.log('Podcast saved to local storage');
                        resolve(key);
                    }
                });
            } catch (error) {
                console.error('Failed to save podcast:', error);
                // Fallback: Try using RuntimeSendMessage instead
                chrome.runtime.sendMessage({
                    action: 'saveAudio',
                    key: key,
                    data: {
                        title: podcastTitle,
                        audio: base64Audio,
                        date: new Date().toISOString()
                    }
                }, response => {
                    if (response && response.success) {
                        console.log('Podcast saved via runtime message');
                        resolve(key);
                    } else {
                        reject(new Error('Failed to save podcast via runtime message'));
                    }
                });
            }
        };
        
        reader.onerror = (error) => {
            reject(error);
        };
    });
}

function downloadAudio(audioBlob, filename) {
    const url = URL.createObjectURL(audioBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

async function getRedditContent(settings) {
    const title = document.querySelector('h1')?.textContent || '';
    const selfText = document.querySelector('[data-test-id="post-content"]')?.textContent || '';
    const comments = Array.from(document.querySelectorAll('.Comment'))
        .slice(0, settings.commentCount)
        .map(comment => {
            const text = comment.querySelector('[data-testid="comment"]')?.textContent || '';
            const username = settings.skipUsernames ? '' : 
                (comment.querySelector('.author')?.textContent + ' writes: ');
            return username + text.trim();
        })
        .filter(text => text.length > 0);

    return {
        title,
        selfText,
        comments
    };
}

function createTTSButton() {
    const button = document.createElement('button');
    button.textContent = '🎙️ Create Podcast';
    button.style.position = 'fixed';
    button.style.top = '80px';
    button.style.right = '20px';
    button.style.zIndex = '9999';
    button.style.padding = '10px 20px';
    button.style.backgroundColor = '#FF4500';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '20px';
    button.style.cursor = 'pointer';
    button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    return button;
}

function createAudioPlayer() {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.background = 'white';
    container.style.padding = '15px';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    container.style.width = '300px';

    const title = document.createElement('div');
    title.textContent = 'Reddit Podcast';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.style.borderBottom = '1px solid #eee';
    title.style.paddingBottom = '5px';
    container.appendChild(title);

    const loadingText = document.createElement('div');
    loadingText.textContent = 'Generating podcast...';
    loadingText.style.marginBottom = '10px';
    container.appendChild(loadingText);

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '10px';
    controls.style.alignItems = 'center';

    const playButton = document.createElement('button');
    playButton.innerHTML = '&#9658;'; // Play triangle
    playButton.style.fontSize = '24px';
    playButton.style.cursor = 'pointer';
    playButton.style.border = 'none';
    playButton.style.background = 'none';
    playButton.style.width = '40px';
    playButton.style.height = '40px';
    playButton.style.borderRadius = '50%';
    playButton.style.backgroundColor = '#eee';
    controls.appendChild(playButton);

    const stopButton = document.createElement('button');
    stopButton.innerHTML = '&#9632;'; // Stop square
    stopButton.style.fontSize = '20px';
    stopButton.style.cursor = 'pointer';
    stopButton.style.border = 'none';
    stopButton.style.background = 'none';
    stopButton.style.width = '40px';
    stopButton.style.height = '40px';
    stopButton.style.borderRadius = '50%';
    stopButton.style.backgroundColor = '#eee';
    controls.appendChild(stopButton);

    const progressContainer = document.createElement('div');
    progressContainer.style.flex = '1';
    progressContainer.style.height = '10px';
    progressContainer.style.background = '#eee';
    progressContainer.style.borderRadius = '5px';
    progressContainer.style.overflow = 'hidden';
    
    const progress = document.createElement('div');
    progress.style.width = '0%';
    progress.style.height = '100%';
    progress.style.background = '#FF4500';
    progress.style.borderRadius = '5px';
    progress.style.transition = 'width 0.3s';
    progressContainer.appendChild(progress);
    
    controls.appendChild(progressContainer);
    container.appendChild(controls);

    const transcript = document.createElement('div');
    transcript.style.marginTop = '10px';
    transcript.style.fontSize = '14px';
    transcript.style.color = '#555';
    transcript.style.maxHeight = '100px';
    transcript.style.overflowY = 'auto';
    transcript.style.padding = '5px';
    transcript.style.border = '1px solid #eee';
    transcript.style.borderRadius = '5px';
    transcript.style.display = 'none';
    container.appendChild(transcript);

    return {
        container,
        loadingText,
        playButton,
        stopButton,
        progress,
        transcript
    };
}

async function initializeApp() {
    // Add a check to ensure we're on Reddit
    if (!window.location.href.includes('reddit.com')) return;
    
    try {
        console.log("Initializing Readdit Pod on Reddit page");
        
        // Import TTS engine
        const module = await import(ttsEnginePath);
        ttsEngine = module.default;
        
        // Create and add the podcast button
        const button = createTTSButton();
        document.body.appendChild(button);
        console.log("Podcast button added to page");
        
        let currentParts = [];
        let currentPartIndex = 0;
        let isPlaying = false;
        
        // Wrap the click handler with our error handler
        button.addEventListener('click', handleExtensionErrors(async function() {
            button.disabled = true;
            button.textContent = '⏳ Creating Podcast...';
            
            try {
                // Check for Gemini API key
                let apiKey = '';
                try {
                    if (storage && storage.local) {
                        const apiKeyResult = await new Promise((resolve) => {
                            storage.local.get('geminiApiKey', (result) => {
                                resolve(result);
                            });
                        });
                        apiKey = apiKeyResult.geminiApiKey;
                    }
                } catch (error) {
                    console.warn('Error accessing storage:', error);
                }
                
                if (!apiKey) {
                    apiKey = prompt('Please enter your Gemini API key:');
                    if (!apiKey) {
                        throw new Error('Gemini API key is required');
                    }
                    
                    // Save API key
                    await new Promise(resolve => {
                        chrome.runtime.sendMessage({
                            action: 'setApiKey',
                            apiKey
                        }, resolve);
                    });
                }
                
                // Get current settings
                let settings;
                try {
                    if (storage && storage.local) {
                        settings = await new Promise(resolve => {
                            storage.local.get({
                                voiceType: '',  // Will be filled with first available voice
                                speakingRate: 1.0,
                                commentCount: 10,
                                skipUsernames: true,
                                geminiApiKey: apiKey
                            }, resolve);
                        });
                    } else {
                        settings = {
                            voiceType: '',
                            speakingRate: 1.0,
                            commentCount: 10,
                            skipUsernames: true,
                            geminiApiKey: apiKey
                        };
                    }
                } catch (error) {
                    console.warn('Error accessing storage for settings:', error);
                    settings = {
                        voiceType: '',
                        speakingRate: 1.0,
                        commentCount: 10,
                        skipUsernames: true,
                        geminiApiKey: apiKey
                    };
                }
                
                // Show loading notification
                const loadingNotification = document.createElement('div');
                loadingNotification.textContent = '🎙️ Generating podcast content...';
                loadingNotification.style.position = 'fixed';
                loadingNotification.style.bottom = '20px';
                loadingNotification.style.left = '20px';
                loadingNotification.style.backgroundColor = '#FF4500';
                loadingNotification.style.color = 'white';
                loadingNotification.style.padding = '10px 20px';
                loadingNotification.style.borderRadius = '5px';
                loadingNotification.style.zIndex = '10000';
                document.body.appendChild(loadingNotification);
                
                // Scrape content from Reddit
                const content = await getRedditContent(settings);
                
                // Generate podcast script using Gemini API
                const scriptResult = await new Promise(resolve => {
                    chrome.runtime.sendMessage({
                        action: 'generateScript',
                        content,
                        apiKey: settings.geminiApiKey
                    }, resolve);
                });
                
                // Remove loading notification
                loadingNotification.remove();
                
                if (!scriptResult.success) {
                    throw new Error(scriptResult.error || 'Failed to generate script');
                }
                
                // Process the script and create audio player
                await processScriptAndCreatePlayer(scriptResult.text, settings);
                
            } catch (error) {
                console.error('Error:', error);
                alert('Error creating podcast: ' + error.message);
                button.disabled = false;
                button.textContent = '🎙️ Create Podcast';
            }
        }));
        
        // Helper function to process script and create player
        async function processScriptAndCreatePlayer(scriptText, settings) {
            try {
                // Print the script to console
                console.log('==== Generated Podcast Script ====');
                console.log(scriptText);
                console.log('=================================');
                
                // Split script into parts by speaker
                const alexParts = [];
                const jamieParts = [];
                
                // Process the script to separate speakers
                const lines = scriptText.split('\n');
                let currentSpeaker = null;
                let currentText = '';
                
                lines.forEach(line => {
                    if (line.startsWith('Alex:')) {
                        if (currentSpeaker === 'Jamie' && currentText.trim()) {
                            jamieParts.push(currentText.trim());
                        }
                        currentSpeaker = 'Alex';
                        currentText = line.replace('Alex:', '').trim();
                    } else if (line.startsWith('Jamie:')) {
                        if (currentSpeaker === 'Alex' && currentText.trim()) {
                            alexParts.push(currentText.trim());
                        }
                        currentSpeaker = 'Jamie';
                        currentText = line.replace('Jamie:', '').trim();
                    } else {
                        currentText += ' ' + line.trim();
                    }
                });
                
                // Add the last part
                if (currentSpeaker === 'Alex') {
                    alexParts.push(currentText.trim());
                } else if (currentSpeaker === 'Jamie') {
                    jamieParts.push(currentText.trim());
                }
                
                // Interleave the parts
                currentParts = [];
                for (let i = 0; i < Math.max(alexParts.length, jamieParts.length); i++) {
                    if (i < alexParts.length) {
                        currentParts.push({
                            text: alexParts[i],
                            speaker: 'Alex',
                            voiceType: 'alex'
                        });
                    }
                    if (i < jamieParts.length) {
                        currentParts.push({
                            text: jamieParts[i],
                            speaker: 'Jamie',
                            voiceType: 'jamie'
                        });
                    }
                }
                
                currentPartIndex = 0;
                
                // Remove any existing player
                const existingPlayer = document.querySelector('#reddit-tts-player');
                if (existingPlayer) {
                    existingPlayer.remove();
                }
                
                const player = createAudioPlayer();
                player.container.id = 'reddit-tts-player';
                document.body.appendChild(player.container);
                
                // Initialize TTS engine
                await ttsEngine.initialize();
                
                // Initialize audio recording
                await initAudioRecording();
                
                const playPart = async () => {
                    if (currentPartIndex >= currentParts.length) {
                        currentPartIndex = 0;
                        isPlaying = false;
                        player.playButton.innerHTML = '&#9658;';
                        player.progress.style.width = '0%';
                        return;
                    }
                    
                    isPlaying = true;
                    player.playButton.innerHTML = '&#10074;&#10074;'; // Pause symbol
                    
                    const part = currentParts[currentPartIndex];
                    const voiceType = part.speaker === 'Alex' ? 'male' : 'female';
                    
                    // Show current transcript
                    player.transcript.style.display = 'block';
                    player.transcript.innerHTML = `<strong>${part.speaker}:</strong> ${part.text}`;
                    
                    try {
                        await ttsEngine.speak(part.text, { 
                            ...settings, 
                            voiceType: voiceType 
                        });
                        
                        // Update progress bar
                        player.progress.style.width = `${((currentPartIndex + 1) / currentParts.length) * 100}%`;
                        
                        // Move to next part
                        currentPartIndex++;
                        
                        if (isPlaying) {
                            playPart();
                        }
                    } catch (error) {
                        console.error('TTS Error:', error);
                        isPlaying = false;
                        player.playButton.innerHTML = '&#9658;';
                    }
                };
                
                player.playButton.addEventListener('click', () => {
                    if (isPlaying) {
                        isPlaying = false;
                        ttsEngine.cancel();
                        player.playButton.innerHTML = '&#9658;';
                    } else {
                        playPart();
                    }
                });
                
                player.stopButton.addEventListener('click', () => {
                    isPlaying = false;
                    ttsEngine.cancel();
                    currentPartIndex = 0;
                    player.playButton.innerHTML = '&#9658;';
                    player.progress.style.width = '0%';
                    player.transcript.style.display = 'none';
                });
                
                // Add download button to player
                const downloadButton = document.createElement('button');
                downloadButton.innerHTML = '⬇️';
                downloadButton.title = 'Download Podcast';
                downloadButton.style.fontSize = '20px';
                downloadButton.style.cursor = 'pointer';
                downloadButton.style.border = 'none';
                downloadButton.style.background = 'none';
                downloadButton.style.width = '40px';
                downloadButton.style.height = '40px';
                downloadButton.style.borderRadius = '50%';
                downloadButton.style.backgroundColor = '#eee';
                downloadButton.style.marginLeft = '10px';
                
                // Find the correct container for the download button
                const controlsContainer = player.stopButton.parentNode; // Get the parent of stop button
                controlsContainer.appendChild(downloadButton);
                
                // Start recording when playing
                let isRecording = false;
                const originalPlayPart = playPart;
                
                playPart = async function() {
                    if (currentPartIndex === 0 && !isRecording) {
                        startRecording();
                        isRecording = true;
                    }
                    
                    await originalPlayPart();
                    
                    // If we've reached the end, stop recording and save
                    if (currentPartIndex >= currentParts.length && isRecording) {
                        isRecording = false;
                        const audioBlob = await stopRecording();
                        const podcastTitle = document.querySelector('h1')?.textContent || 'Reddit Podcast';
                        const key = await saveAudioToLocalStorage(audioBlob, podcastTitle);
                        
                        // Enable download button
                        downloadButton.onclick = () => {
                            const sanitizedTitle = podcastTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                            downloadAudio(audioBlob, `${sanitizedTitle}_${Date.now()}.mp3`);
                        };
                        downloadButton.style.backgroundColor = '#FF4500';
                        downloadButton.style.color = 'white';
                    }
                };
                
                player.loadingText.remove();
                
                button.disabled = false;
                button.textContent = '🎙️ Create Podcast';
            } catch (error) {
                console.error('Error processing script:', error);
                alert('Error processing script: ' + error.message);
                button.disabled = false;
                button.textContent = '🎙️ Create Podcast';
            }
        }
    } catch (error) {
        if (error.message && error.message.includes('Extension context invalidated')) {
            console.log('Extension was reloaded. Please refresh the page to use the extension.');
        } else {
            console.error('Failed to initialize app:', error);
        }
    }
}

// Initialize with error handling
const safeInitialize = handleExtensionErrors(initializeApp);
safeInitialize();

// Add event listeners with error handling
window.addEventListener('popstate', safeInitialize);
window.addEventListener('pushstate', safeInitialize);

// For Reddit's SPA, monitor for URL changes with error handling
let lastUrl = location.href; 
new MutationObserver(() => {
    try {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('URL changed, reinitializing Readdit Pod');
            safeInitialize();
        }
    } catch (error) {
        if (error.message && error.message.includes('Extension context invalidated')) {
            console.log('Extension was reloaded. Cannot reinitialize. Please refresh the page.');
        } else {
            console.error('Error in URL change observer:', error);
        }
    }
}).observe(document, {subtree: true, childList: true});