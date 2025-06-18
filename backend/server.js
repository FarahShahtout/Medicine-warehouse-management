// backend/server.js

// 1. تحميل متغيرات البيئة من ملف .env في بداية التطبيق
// هذا مهم جداً لضمان أن process.env.JWT_SECRET و DB_PASSWORD وغيرها تكون متاحة
require('dotenv').config();

const express = require('express');
// 2. استيراد كائن db من models/index.js
// المسار الصحيح هو './models' 
const db = require('./models'); 
// 3. استيراد مسارات المصادقة (Auth Routes)
// المسار الصحيح هو './src/routes/authRoutes'
//const authRoutes = require('./src/routes/authRoutes');

const app = express();


app.use(express.json()); 
app.use(express.urlencoded({ extended: false })); // لتمكين Express من قراءة البيانات بصيغة URL-encoded (مثل بيانات الفورم)

const connectDBAndSync = async () => {
    try {
        // اختبار الاتصال بقاعدة البيانات
        await db.sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');

        await db.sequelize.sync({ force: false });
        console.log('Database synced successfully. All models were synchronized.');
    } catch (error) {
        console.error('Unable to connect to the database or sync models:', error);
        process.exit(1);
    }
};


connectDBAndSync();


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));