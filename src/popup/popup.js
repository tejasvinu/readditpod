document.addEventListener('DOMContentLoaded', async () => {
    const voiceTypeSelect = document.getElementById('voiceType');
    const speakingRateInput = document.getElementById('speakingRate');
    const rateValueSpan = document.getElementById('rateValue');
    const commentCountInput = document.getElementById('commentCount');
    const skipUsernamesCheckbox = document.getElementById('skipUsernames');
    const geminiApiKeyInput = document.getElementById('geminiApiKey');
    const toggleApiKeyButton = document.getElementById('toggleApiKey');
    const saveButton = document.getElementById('saveSettings');
    
    // Add tab switching functionality
    const settingsTab = document.getElementById('settingsTab');
    const historyTab = document.getElementById('historyTab');
    const settingsContent = document.getElementById('settingsContent');
    const historyContent = document.getElementById('historyContent');
    
    if (settingsTab && historyTab) {
        settingsTab.addEventListener('click', () => {
            settingsTab.classList.add('active');
            historyTab.classList.remove('active');
            settingsContent.style.display = 'block';
            historyContent.style.display = 'none';
        });
        
        historyTab.addEventListener('click', () => {
            historyTab.classList.add('active');
            settingsTab.classList.remove('active');
            historyContent.style.display = 'block';
            settingsContent.style.display = 'none';
            loadSavedPodcasts();
        });
    }
    
    // Function to load saved podcasts from local storage
    async function loadSavedPodcasts() {
        const historyList = document.getElementById('podcastHistory');
        if (!historyList) return;
        
        // Clear existing items
        historyList.innerHTML = '';
        
        try {
            // Get all items from storage
            const storage = await new Promise(resolve => chrome.storage.local.get(null, resolve));
            
            // Filter podcast items (keys starting with 'podcast_')
            const podcasts = Object.entries(storage)
                .filter(([key]) => key.startsWith('podcast_'))
                .map(([key, value]) => ({ key, ...value }))
                .sort((a, b) => new Date(b.date) - new Date(a.date));
            
            if (podcasts.length === 0) {
                const emptyMessage = document.createElement('div');
                emptyMessage.className = 'empty-history';
                emptyMessage.textContent = 'No saved podcasts yet';
                historyList.appendChild(emptyMessage);
                return;
            }
            
            // Create list items for each podcast
            podcasts.forEach(podcast => {
                const item = document.createElement('div');
                item.className = 'podcast-item';
                
                const title = document.createElement('div');
                title.className = 'podcast-title';
                title.textContent = podcast.title || 'Untitled Podcast';
                
                const date = document.createElement('div');
                date.className = 'podcast-date';
                date.textContent = new Date(podcast.date).toLocaleString();
                
                const controls = document.createElement('div');
                controls.className = 'podcast-controls';
                
                const playButton = document.createElement('button');
                playButton.innerHTML = '▶️';
                playButton.title = 'Play';
                playButton.className = 'podcast-control';
                playButton.addEventListener('click', () => {
                    // Create audio element to play the podcast
                    const audio = new Audio(podcast.audio);
                    audio.play();
                });
                
                const downloadButton = document.createElement('button');
                downloadButton.innerHTML = '⬇️';
                downloadButton.title = 'Download';
                downloadButton.className = 'podcast-control';
                downloadButton.addEventListener('click', () => {
                    // Download the audio file
                    const sanitizedTitle = (podcast.title || 'podcast').replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const a = document.createElement('a');
                    a.href = podcast.audio;
                    a.download = `${sanitizedTitle}_${Date.now()}.mp3`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                });
                
                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '🗑️';
                deleteButton.title = 'Delete';
                deleteButton.className = 'podcast-control';
                deleteButton.addEventListener('click', async () => {
                    if (confirm('Are you sure you want to delete this podcast?')) {
                        await new Promise(resolve => chrome.storage.local.remove(podcast.key, resolve));
                        loadSavedPodcasts(); // Reload the list
                    }
                });
                
                controls.appendChild(playButton);
                controls.appendChild(downloadButton);
                controls.appendChild(deleteButton);
                
                item.appendChild(title);
                item.appendChild(date);
                item.appendChild(controls);
                
                historyList.appendChild(item);
            });
        } catch (error) {
            console.error('Error loading podcasts:', error);
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = 'Error loading saved podcasts';
            historyList.appendChild(errorMessage);
        }
    }

    // Toggle API key visibility
    toggleApiKeyButton.addEventListener('click', () => {
        if (geminiApiKeyInput.type === 'password') {
            geminiApiKeyInput.type = 'text';
            toggleApiKeyButton.textContent = '🔒';
        } else {
            geminiApiKeyInput.type = 'password';
            toggleApiKeyButton.textContent = '👁️';
        }
    });

    // Import TTS engine directly
    const { default: ttsEngine } = await import(chrome.runtime.getURL('src/tts-engine.js'));

    // Initialize TTS engine and populate voices
    try {
        await ttsEngine.initialize();
        const voices = ttsEngine.getAvailableVoices();
        
        // Clear existing options
        voiceTypeSelect.innerHTML = '';
        
        // Group voices by language for better organization
        const langGroups = {};
        voices.forEach(voice => {
            if (!langGroups[voice.lang]) {
                langGroups[voice.lang] = document.createElement('optgroup');
                langGroups[voice.lang].label = voice.lang;
                voiceTypeSelect.appendChild(langGroups[voice.lang]);
            }
            
            const option = document.createElement('option');
            option.value = voice.id;
            option.textContent = voice.name;
            langGroups[voice.lang].appendChild(option);
        });

        // Load saved settings
        chrome.storage.local.get({
            // Default values
            voiceType: voices[0]?.id || '',
            speakingRate: 1.0,
            commentCount: 10,
            skipUsernames: true,
            geminiApiKey: ''
        }, (settings) => {
            if (settings.voiceType && voiceTypeSelect.querySelector(`option[value="${settings.voiceType}"]`)) {
                voiceTypeSelect.value = settings.voiceType;
            } else if (voices.length > 0) {
                // Default to first voice if saved one doesn't exist
                voiceTypeSelect.value = voices[0].id;
            }
            
            speakingRateInput.value = settings.speakingRate;
            rateValueSpan.textContent = settings.speakingRate.toFixed(1);
            commentCountInput.value = settings.commentCount;
            skipUsernamesCheckbox.checked = settings.skipUsernames;
            
            // Show API key (masked)
            if (settings.geminiApiKey) {
                geminiApiKeyInput.value = settings.geminiApiKey;
            }
        });
    } catch (error) {
        console.error('Failed to initialize TTS engine:', error);
        voiceTypeSelect.innerHTML = '<option value="">Failed to load voices</option>';
    }

    // Update rate value display when slider moves
    speakingRateInput.addEventListener('input', (e) => {
        rateValueSpan.textContent = parseFloat(e.target.value).toFixed(1);
    });

    // Save settings
    saveButton.addEventListener('click', async () => {
        const settings = {
            voiceType: voiceTypeSelect.value,
            speakingRate: parseFloat(speakingRateInput.value),
            commentCount: parseInt(commentCountInput.value, 10),
            skipUsernames: skipUsernamesCheckbox.checked,
            geminiApiKey: geminiApiKeyInput.value.trim()
        };

        // Also update the API key in the background script
        if (settings.geminiApiKey) {
            try {
                await new Promise(resolve => {
                    chrome.runtime.sendMessage({
                        action: 'setApiKey',
                        apiKey: settings.geminiApiKey
                    }, resolve);
                });
            } catch (error) {
                console.error('Error setting API key:', error);
            }
        }

        chrome.storage.local.set(settings, () => {
            saveButton.textContent = 'Saved!';
            setTimeout(() => {
                saveButton.textContent = 'Save Settings';
            }, 1500);
        });
    });

    // Add a helpful message about using the extension
    const helpMessage = document.createElement('div');
    helpMessage.style.marginTop = '20px';
    helpMessage.style.padding = '10px';
    helpMessage.style.backgroundColor = '#f0f0f0';
    helpMessage.style.borderRadius = '5px';
    helpMessage.style.fontSize = '12px';
    helpMessage.innerHTML = '<strong>How to use:</strong><br>1. Enter your Gemini API key above<br>2. Visit any Reddit post<br>3. Click the "🎙️ Create Podcast" button in the top-right of the page';
    document.body.appendChild(helpMessage);

    // Load saved podcasts if we're on the history tab initially
    if (historyTab && historyTab.classList.contains('active')) {
        loadSavedPodcasts();
    }
});