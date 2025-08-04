// backend/services/aiService.js

const fetch = require('node-fetch');

// Helper function for exponential backoff retry logic
// دالة مساعدة لإعادة محاولة الاتصال بالـ API مع تأخير متزايد (Exponential Backoff)
const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
            if (response.status === 429) { // Too Many Requests
                console.warn(`API rate limit exceeded. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                delay *= 2; // Exponential backoff
            } else {
                const errorText = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorText}`);
            }
        } catch (error) {
            if (i === retries - 1) {
                throw error;
            }
            console.error(`Fetch attempt ${i + 1} failed: ${error.message}. Retrying...`);
            await new Promise(res => setTimeout(res, delay));
            delay *= 2;
        }
    }
};

// Function to call the Gemini API
// دالة لإنشاء محتوى نصي باستخدام نموذج Gemini AI
const generateContent = async (userPrompt) => {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) {
        throw new Error('مفتاح API مفقود. يرجى ضبط GEMINI_API_KEY في ملف .env.');
    }

    // Using the gemini-2.5-flash-preview-05-20 model as a consistent choice
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const chatHistory = [{ role: "user", parts: [{ text: userPrompt }] }];
    const payload = { contents: chatHistory };

    const response = await fetchWithRetry(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
        return result.candidates[0].content.parts[0].text;
    } else {
        throw new Error('هيكل استجابة Gemini API غير متوقع.');
    }
};

module.exports = {
 generateContent
};
