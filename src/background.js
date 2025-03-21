// This file contains the background script for the Chrome extension. It handles events and manages the extension's lifecycle.

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
});

// Function to directly call Gemini API without curl
async function generateContentWithGemini(content, apiKey) {
    try {
        // Log what content we received from Reddit
        console.log("Content received from Reddit page:");
        console.log("- Title:", content.title);
        console.log("- Main content:", content.selfText || "(No main content)");
        console.log("- Comments:", content.comments.length ? `${content.comments.length} comments` : "No comments");
        
        // Create formatted content to improve Gemini's processing
        const formattedComments = content.comments.map((comment, index) => 
            `Comment ${index + 1}: ${comment.replace(/\n+/g, ' ').trim()}`
        ).join('\n\n');
        
        // Create payload for Gemini API
        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `Create an engaging podcast script from this Reddit content. Format it as a conversation between two hosts named Alex and Jamie. Make it sound natural and entertaining while covering these key points:

Title: ${content.title}
Main Content: ${content.selfText || "(No post content available)"}
Comments: ${content.comments.length > 0 ? formattedComments : "(No comments available)"}

Keep the tone conversational and include some light banter between hosts. Create a complete podcast discussion that explores multiple viewpoints from the comments.`
                        }
                    ]
                }
            ],
            systemInstruction: {
                role: "user",
                parts: [
                    {
                        text: "You are a podcast script creator who specializes in converting Reddit posts into entertaining dialogues between two hosts."
                    }
                ]
            },
            generationConfig: {
                temperature: 0.8,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 8192,
                responseMimeType: "text/plain"
            }
        };

        // Use the latest Gemini model (update as needed)
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${apiKey}`;
        console.log("Gemini Request URL:", apiUrl.replace(apiKey, "[API_KEY_REDACTED]"));
        console.log("Gemini Request Payload:", {...payload, contents: [{...payload.contents[0], parts: [{text: "Content redacted for logging"}]}]});

        // Make the API call directly
        const response = await fetch(
            apiUrl,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );

        // Check for HTTP errors first
        if (!response.ok) {
            // Get the error details
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 
                                errorData.error?.details?.[0]?.message || 
                                `HTTP error ${response.status}`;
            throw new Error(`Gemini API error: ${errorMessage}`);
        }

        const data = await response.json();
        console.log("Gemini Response Status:", data.promptFeedback?.blockReason || "Success");
        
        // Extract the script text from the response
        const scriptText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!scriptText) {
            throw new Error('No script was generated. Please try again.');
        }

        return {
            success: true,
            text: scriptText
        };
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        return { success: false, error: error.message };
    }
}

// Handle script generation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'generateScript') {
        generateContentWithGemini(request.content, request.apiKey)
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                console.error('Gemini API Error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep the message channel open for async response
    } else if (request.action === 'setApiKey') {
        chrome.storage.local.set({ geminiApiKey: request.apiKey }, () => {
            sendResponse({ success: true });
        });
        return true;
    } else if (request.action === 'submitGeneratedScript') {
        // Handle the script submitted by the user
        sendResponse({ 
            success: true, 
            text: request.script 
        });
        return true;
    }
});