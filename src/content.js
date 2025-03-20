// Get URL for TTS engine
const ttsEnginePath = chrome.runtime.getURL('src/tts-engine.js');

// Functions will be initialized after importing TTS engine
let ttsEngine;
let audioContext;
let audioDestination;
let audioRecorder;
let audioChunks = [];
let isExtensionValid = true; // Flag to track extension validity

// Ensure storage is available
const storage = chrome.storage || browser.storage;
if (!storage) {
    console.error('Storage API not available. The extension may not work properly.');
}

// Enhanced error handling for extension context invalidation
function handleExtensionErrors(callback) {
    return async (...args) => {
        if (!isExtensionValid) {
            showExtensionUpdatedNotification();
            return;
        }
        
        try {
            return await callback(...args);
        } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
                console.log('Extension was reloaded. Please refresh the page to use the extension.');
                isExtensionValid = false;
                showExtensionUpdatedNotification();
            } else {
                console.error('Error in extension:', error);
                throw error;
            }
        }
    };
}

// Show notification when extension is updated
function showExtensionUpdatedNotification() {
    // Check if notification already exists
    if (document.querySelector('#readdit-updated-notification')) return;
    
    const notification = document.createElement('div');
    notification.id = 'readdit-updated-notification';
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
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.gap = '10px';
    notification.innerHTML = 'Readdit Pod was updated. <button id="refresh-page-btn" style="background: white; color: #FF4500; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Refresh Page</button>';
    
    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✕';
    closeBtn.style.marginLeft = '10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => notification.remove();
    notification.appendChild(closeBtn);
    
    document.body.appendChild(notification);
    
    // Add refresh button functionality
    document.getElementById('refresh-page-btn').addEventListener('click', () => {
        window.location.reload();
    });
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 30000);
}

// Safely access Chrome API
async function safelyAccessStorage(action) {
    if (!isExtensionValid) {
        throw new Error('Extension context invalidated');
    }
    
    try {
        return await action();
    } catch (error) {
        if (error.message && error.message.includes('Extension context invalidated')) {
            isExtensionValid = false;
            showExtensionUpdatedNotification();
            throw error;
        }
        throw error;
    }
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
    console.log("Fetching Reddit content...");
    
    // Show a temporary notification that content is being scraped
    const scrapingNotification = document.createElement('div');
    scrapingNotification.textContent = '🔍 Analyzing Reddit content...';
    scrapingNotification.style.position = 'fixed';
    scrapingNotification.style.bottom = '60px';
    scrapingNotification.style.left = '20px';
    scrapingNotification.style.backgroundColor = '#0079D3'; // Reddit blue
    scrapingNotification.style.color = 'white';
    scrapingNotification.style.padding = '10px 20px';
    scrapingNotification.style.borderRadius = '5px';
    scrapingNotification.style.zIndex = '10000';
    document.body.appendChild(scrapingNotification);
    
    // NEW: Check if this is a Shreddit post and use custom selectors
    const shredditTitleEl = document.querySelector('shreddit-title');
    if (shredditTitleEl) {
        // Custom scraping for Shreddit posts
        const title = shredditTitleEl.getAttribute('title') || '';
        const postEl = document.querySelector('shreddit-post');
        const selfText = postEl ? postEl.innerText.trim() : '';
        
        // Improved comment extraction for Shreddit
        let comments = [];
        
        // Try multiple selectors to find all comments
        const commentContainers = [
            ...document.querySelectorAll('#comment-tree, [id^="comment-tree-content-anchor"]')
        ];
        
        if (commentContainers.length > 0) {
            console.log(`Found ${commentContainers.length} comment containers`);
            
            // Process each container
            commentContainers.forEach(container => {
                // Use all comment elements, including shreddit-comment elements
                const allComments = container.querySelectorAll('shreddit-comment, .Comment');
                console.log(`Found ${allComments.length} comments in container`);
                
                allComments.forEach(comment => {
                    // Extract comment body text while avoiding UI elements
                    const commentBody = comment.querySelector('.comment-body, .RichTextJSON-root, .md-container');
                    if (commentBody) {
                        // Skip "more replies" buttons and other UI elements
                        const commentText = commentBody.innerText.trim()
                            .replace(/(\d+ more replies?|Show parent comments|Continue this thread)/g, '')
                            .trim();
                        
                        if (commentText && commentText.length > 5) {
                            comments.push(commentText);
                        }
                    } else {
                        // Fallback to taking all text content
                        const fullText = comment.innerText.trim();
                        if (fullText && fullText.length > 15 && !fullText.includes('level 1') && !fullText.includes('load more comments')) {
                            comments.push(fullText);
                        }
                    }
                });
            });
        } 
        
        // Fallback to XPath approach if no comments found
        if (comments.length === 0) {
            const xpathResult = document.evaluate(
                '/html/body/shreddit-app/div[2]/div/div/main/div',
                document,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );
            for (let i = 0; i < xpathResult.snapshotLength; i++) {
                const node = xpathResult.snapshotItem(i);
                if (node && node.innerText.trim()) {
                    comments.push(node.innerText.trim());
                }
            }
        }
        
        console.log("Custom scraped content for Shreddit:", { title, selfText, comments: comments.length });
        scrapingNotification.remove();
        return { title, selfText, comments: comments.slice(0, settings.commentCount) };
    }
    
    try {
        // Get the post title - try multiple methods
        let title = '';
        const titleSelectors = [
            'h1', 
            '[data-testid="post-title"]',
            '.Post__title',
            '.title'
        ];
        
        for (const selector of titleSelectors) {
            const titleElement = document.querySelector(selector);
            if (titleElement && titleElement.textContent.trim()) {
                title = titleElement.textContent.trim();
                console.log(`Found post title with selector "${selector}":`, title);
                break;
            }
        }
        
        // Try different selectors for post content to handle different Reddit layouts
        let selfText = '';
        const postContentSelectors = [
            '[data-test-id="post-content"]',
            '.Post__content',
            '.RichTextJSON-root',
            '.post-content',
            '[data-click-id="text"]',
            '.expando',
            '.usertext-body',
            '.PostContent',
            '.entry .md',
            '.ThreadPostContentContainer',
            'div[id^="post-rtjson"]',
            '.PostContent__contentContainer'
        ];
        
        // Try each selector
        for (const selector of postContentSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                // Skip any that might be in comments
                for (const element of elements) {
                    // Check if this element is inside a comment
                    if (!element.closest('.Comment') && !element.closest('.comment')) {
                        selfText = element.textContent.trim();
                        console.log(`Found post content with selector "${selector}":`, selfText);
                        
                        if (selfText) break;
                    }
                }
                if (selfText) break;
            }
        }
        
        // If still no content, try to find by proximity to the title
        if (!selfText && title) {
            const titleElement = document.querySelector('h1');
            if (titleElement) {
                // Check siblings and nearby elements
                let currentElement = titleElement.nextElementSibling;
                let checkCount = 0;
                while (currentElement && checkCount < 5) {
                    if (currentElement.textContent.trim() && 
                        !currentElement.querySelector('input') && // Skip form elements
                        currentElement.textContent.length > 20) { // Skip short text
                        selfText = currentElement.textContent.trim();
                        console.log("Found post content by proximity to title:", selfText);
                        break;
                    }
                    currentElement = currentElement.nextElementSibling;
                    checkCount++;
                }
            }
        }
        
        // Extract comments from the specific div - this is the part we're updating
        let comments = [];
        const commentContainer = document.querySelector('#comment-tree');
        if (commentContainer) {
            // Recursive function to extract all comments including nested replies
            function extractCommentsRecursively(element, depth = 0) {
                if (!element) return;
                
                // Find all comments at this level - both direct comments and replies
                const commentElements = element.querySelectorAll(':scope > div, :scope > shreddit-comment, :scope > .Comment');
                
                // Process each comment element
                commentElements.forEach(commentEl => {
                    // Extract the text from this comment (avoiding buttons, metadata, etc.)
                    const commentTextEls = commentEl.querySelectorAll('.comment-body, .RichTextJSON-root, .commentContent');
                    let commentText = '';
                    
                    if (commentTextEls.length > 0) {
                        // Use the first matching text element
                        commentText = commentTextEls[0].innerText.trim();
                    } else {
                        // Fallback to the comment's own text, excluding child comments
                        const clone = commentEl.cloneNode(true);
                        // Remove reply containers and buttons to avoid including nested content
                        clone.querySelectorAll('.replies, .reply-button, .comment-footer, .action-buttons').forEach(el => el.remove());
                        commentText = clone.innerText.trim();
                    }
                    
                    if (commentText) {
                        comments.push(commentText);
                    }
                    
                    // Find reply containers within this comment
                    const replyContainers = commentEl.querySelectorAll('.replies, .comment-replies, [id^="comment-tree-content-anchor"]');
                    
                    // Recursively process replies
                    replyContainers.forEach(replyContainer => {
                        extractCommentsRecursively(replyContainer, depth + 1);
                    });
                });
            }
            
            // Start the recursive extraction from the main comment tree
            extractCommentsRecursively(commentContainer);
            console.log(`Extracted ${comments.length} total comments including nested replies`);
            
            // Limit to requested number
            comments = comments.slice(0, settings.commentCount);
        } else {
            // Get comments - try multiple selectors and methods
            const commentSelectors = [
                '.Comment',
                '.comment',
                '[data-testid="comment"]',
                '.CommentListItem',
                '.usertext', 
                '.commentEntry'
            ];
            
            let commentElements = [];
            for (const selector of commentSelectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`Found ${elements.length} comments with selector "${selector}"`);
                    commentElements = Array.from(elements);
                    break;
                }
            }
            
            // Extract comment text
            comments = commentElements
                .slice(0, settings.commentCount)
                .map(comment => {
                    // Try different selectors to get comment text
                    const commentTextSelectors = [
                        '.md',
                        '[data-testid="comment"]',
                        '.Comment__body',
                        '.RichTextJSON-root',
                        '.comment-content',
                        '.usertext-body',
                        '.CommentContent'
                    ];
                    
                    let commentText = '';
                    for (const selector of commentTextSelectors) {
                        const element = comment.querySelector(selector);
                        if (element && element.textContent.trim()) {
                            commentText = element.textContent.trim();
                            break;
                        }
                    }
                    
                    // If no selector worked, just use the comment's own text content
                    if (!commentText) {
                        commentText = comment.textContent.trim();
                    }
                    
                    // Get username if needed
                    let username = '';
                    if (!settings.skipUsernames) {
                        const usernameSelectors = [
                            '.author', 
                            '[data-testid="username"]',
                            '.CommentAuthor',
                            '.head .tagline a',
                            '.CommentHeader__username'
                        ];
                        
                        for (const selector of usernameSelectors) {
                            const element = comment.querySelector(selector);
                            if (element && element.textContent.trim()) {
                                username = element.textContent.trim() + ' writes: ';
                                break;
                            }
                        }
                    }
                    
                    return username + commentText;
                })
                .filter(text => text.trim().length > 0);
        }
        
        // Clean up scraped text
        const cleanText = (text) => {
            if (!text) return '';
            // Remove excessive whitespace, common Reddit UI text
            return text
                .replace(/\s+/g, ' ')
                .replace(/share save (hide )?report/gi, '')
                .replace(/level \d+/gi, '')
                .replace(/reply give award/gi, '')
                .trim();
        };
        
        // Build final content object
        const result = {
            title: cleanText(title),
            selfText: cleanText(selfText),
            comments: comments.map(cleanText)
        };
        
        console.log("Final scraped content:", result);
        scrapingNotification.remove();
        return result;
    } catch (error) {
        console.error("Error scraping Reddit content:", error);
        scrapingNotification.textContent = '❌ Error analyzing Reddit content';
        setTimeout(() => scrapingNotification.remove(), 3000);
        
        return {
            title: document.title || '',
            selfText: '',
            comments: []
        };
    }
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
        try {
            const module = await import(ttsEnginePath);
            ttsEngine = module.default;
        } catch (error) {
            if (error.message && error.message.includes('Extension context invalidated')) {
                isExtensionValid = false;
                showExtensionUpdatedNotification();
                return;
            }
            console.error('Failed to import TTS engine:', error);
            return;
        }
        
        // Create and add the podcast button
        const button = createTTSButton();
        document.body.appendChild(button);
        console.log("Podcast button added to page");
        
        let currentParts = [];
        let currentPartIndex = 0;
        let isPlaying = false;
        
        // Wrap the click handler with our error handler
        button.addEventListener('click', handleExtensionErrors(async function() {
            if (!isExtensionValid) {
                showExtensionUpdatedNotification();
                return;
            }
            
            button.disabled = true;
            button.textContent = '⏳ Creating Podcast...';
            
            try {
                // Check for Gemini API key
                let apiKey = '';
                try {
                    if (storage && storage.local) {
                        const result = await safelyAccessStorage(() => new Promise((resolve) => {
                            storage.local.get('geminiApiKey', (data) => {
                                resolve(data);
                            });
                        }));
                        apiKey = result.geminiApiKey || '';
                    }
                } catch (error) {
                    console.warn('Error accessing storage:', error);
                    if (error.message && error.message.includes('Extension context invalidated')) {
                        button.disabled = false;
                        button.textContent = '🎙️ Create Podcast';
                        return;
                    }
                }
                
                if (!apiKey || apiKey.trim() === '') {
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
                        // Use safelyAccessStorage to avoid context invalidation errors
                        settings = await safelyAccessStorage(() => new Promise(resolve => {
                            storage.local.get({
                                voiceType: '',  // Will be filled with first available voice
                                speakingRate: 1.0,
                                commentCount: 10,
                                skipUsernames: true,
                                geminiApiKey: apiKey
                            }, resolve);
                        }));
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
                if (!error.message.includes('Extension context invalidated')) {
                    alert('Error creating podcast: ' + error.message);
                }
                button.disabled = false;
                button.textContent = '🎙️ Create Podcast';
            }
        }));
        
        // New helper function to remove markdown formatting from the Gemini response
        function stripMarkdown(text) {
            return text.replace(/\*\*(.*?)\*\*/g, '$1');
        }

        // Helper function to process the script and create the audio player
        async function processScriptAndCreatePlayer(scriptText, settings) {
            try {
                // Clean markdown formatting
                const cleanedScript = stripMarkdown(scriptText);
                console.log("Cleaned Script for Audio Generation:", cleanedScript);
                
                // Split cleaned script into lines
                const lines = cleanedScript.split('\n');
                let currentSpeaker = null;
                let currentText = '';
                const alexParts = [];
                const jamieParts = [];
                
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
                
                // Add the last part if any
                if (currentSpeaker === 'Alex') {
                    alexParts.push(currentText.trim());
                } else if (currentSpeaker === 'Jamie') {
                    jamieParts.push(currentText.trim());
                }
                
                // Interleave parts from both speakers
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
                
                // Log before starting audio generation
                console.log("Starting audio generation for", currentParts.length, "parts.");
                
                // Initialize TTS engine with improved error handling
                try {
                    console.log("Initializing TTS engine...");
                    await ttsEngine.initialize();
                    console.log("TTS engine initialized successfully");
                } catch (ttsError) {
                    console.error("Error initializing TTS engine:", ttsError);
                    // Show error notification
                    const errorNotification = document.createElement('div');
                    errorNotification.textContent = `🔊 TTS Error: ${ttsError.message}`;
                    errorNotification.style.position = 'fixed';
                    errorNotification.style.bottom = '60px';
                    errorNotification.style.left = '20px';
                    errorNotification.style.backgroundColor = '#FF4500';
                    errorNotification.style.color = 'white';
                    errorNotification.style.padding = '10px 20px';
                    errorNotification.style.borderRadius = '5px';
                    errorNotification.style.zIndex = '10000';
                    document.body.appendChild(errorNotification);
                    
                    // Auto-remove notification after 10 seconds
                    setTimeout(() => {
                        errorNotification.remove();
                    }, 10000);
                    
                    throw ttsError;
                }
                
                await initAudioRecording();
                
                // Changed declaration of playPart from const to let
                let playPart = async () => {
                    console.log("Starting playPart, currentPartIndex =", currentPartIndex);
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
                    
                    console.log(`Speaking part ${currentPartIndex + 1} of ${currentParts.length} (${part.speaker}):`, part.text);
                    
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
                
                // Add logging to the play button click handler
                player.playButton.addEventListener('click', () => {
                    console.log("Play button clicked");
                    if (isPlaying) {
                        isPlaying = false;
                        ttsEngine.cancel();
                        player.playButton.innerHTML = '&#9658;';
                    } else {
                        playPart();
                    }
                });
                
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
            isExtensionValid = false;
            showExtensionUpdatedNotification();
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
    if (!isExtensionValid) return;
    
    try {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('URL changed, reinitializing Readdit Pod');
            safeInitialize();
        }
    } catch (error) {
        if (error.message && error.message.includes('Extension context invalidated')) {
            isExtensionValid = false;
            showExtensionUpdatedNotification();
        } else {
            console.error('Error in URL change observer:', error);
        }
    }
}).observe(document, {subtree: true, childList: true});