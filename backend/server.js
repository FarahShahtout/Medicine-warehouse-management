// backend/server.js

require('dotenv').config();

const express = require('express');
const db = require('./models');
const authRoutes = require('./routes/authRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const requestRoutes = require('./routes/requestRoutes'); 
const warehouseRoutes = require('./routes/warehouseRoutes');
const distributionRoutes = require('./routes/distributionRoutes');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { startScheduledJobs } = require('./jobs/scheduledNotifications');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cookieParser());

app.use(cors({
    origin: '*',
    credentials: true
}));

app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes); 
app.use('/api/requests', requestRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/distributions', distributionRoutes);
app.use('/api/ai', require('./routes/aiRoutes'));



const connectDBAndSync = async () => {
    try {
        await db.sequelize.authenticate();
        console.log('Connection to the database has been established successfully.');
        await db.sequelize.sync({ force: false }); 
        console.log('Database synced successfully. All models were synchronized.');
        startScheduledJobs(); 
    } catch (error) {
        console.error('Unable to connect to the database or sync models:', error);
        process.exit(1);
    }
};

connectDBAndSync();

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));