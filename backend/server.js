// backend/server.js


require('dotenv').config();
  


const express = require('express');


const db = require('./models');


const authRoutes = require('./routes/authRoutes');



const app = express(); 


app.use(express.json());           
app.use(express.urlencoded({ extended: false })); 


app.use('/api/auth', authRoutes); 



const connectDBAndSync = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');
        await db.sequelize.sync({ force: false }); // أو { force: true } في بيئة التطوير لمسح الجداول وإعادة إنشائها
        console.log('Database synced successfully. All models were synchronized.');
    } catch (error) {
        console.error('Unable to connect to the database or sync models:', error);
        process.exit(1); 
    }
};


connectDBAndSync();


const PORT = process.env.PORT || 5000; 
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));