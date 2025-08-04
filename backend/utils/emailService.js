// backend/utils/emailService.js

const nodemailer = require('nodemailer');

// إنشاء transporter باستخدام Nodemailer
// يستخدم معلومات البريد الإلكتروني من ملف .env
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // SMTP host for Gmail
    port: 587,              // Standard SMTP port with STARTTLS
    secure: false,          // Use STARTTLS, so 'secure' is false for port 587
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // This option helps with some connection issues, but it's not recommended for production
    // as it disables SSL certificate verification. Use it for testing only if nothing else works.
    tls: {
        rejectUnauthorized: false // Keep this for testing if needed, but be aware of security implications
    }
});

// دالة لإرسال البريد الإلكتروني
const sendEmail = async (to, subject, htmlContent) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER, // Sender
            to: to, // Recipient(s) (can be a comma-separated string for multiple recipients)
            subject: subject, // Email subject
            html: htmlContent // Email content in HTML format
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${to} with subject: ${subject}`);
    } catch (error) {
        console.error(`Error sending email to ${to} with subject "${subject}":`, error);
        // You can send the error to a logging system here
    }
};

module.exports = {
    sendEmail
};
