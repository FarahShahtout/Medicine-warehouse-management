// backend/routes/aiRoutes.js

// استيراد المكتبات اللازمة
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService'); // استيراد الخدمة الجديدة

// مسار الذكاء الاصطناعي
router.post('/generate-description', async (req, res) => {
    try {
        const userPrompt = req.body.prompt;
        if (!userPrompt) {
            return res.status(400).json({ message: 'البرومبت (prompt) مطلوب في الجسم (body) الخاص بالطلب.' });
        }
        
        // استخدام خدمة الذكاء الاصطناعي المركزية
        const generatedText = await aiService.generateContent(userPrompt);

        // إرسال الاستجابة إلى المستخدم
        res.status(200).json({ generatedText });

    } catch (error) {
        console.error('خطأ في معالجة طلب الذكاء الاصطناعي:', error);
        res.status(500).json({
            message: 'حدث خطأ داخلي في الخادم.',
            error: error.message
        });
    }
});

module.exports = router;
