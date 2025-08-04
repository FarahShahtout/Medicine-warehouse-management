const cron = require('node-cron');
const db = require('../models');
const { Op } = require('sequelize');
const { sendEmail } = require('../utils/emailService'); // Assuming this service exists

const Medicine = db.Medicine;
const User = db.User;

// --- Helper Functions for Notifications ---

const sendLowStockNotifications = async () => {
    try {
        const threshold = 10;
        const lowStockMedicines = await Medicine.findAll({
            where: {
                quantity: {
                    [Op.lte]: threshold
                },
                status: 'approved'
            }
        });

        if (lowStockMedicines.length > 0) {
            const adminUsers = await User.findAll({ where: { userType: 'admin' } });
            if (adminUsers.length > 0) {
                const medicineNames = lowStockMedicines.map(m => m.name).join(', ');
                const emailSubject = 'Low Stock Alert';
                const emailBody = `The following medicines are running low on stock (quantity <= ${threshold}): ${medicineNames}. Please take action.`;

                for (const admin of adminUsers) {
                    // await sendEmail(admin.email, emailSubject, emailBody);
                }
                // console.log(`Low stock notification sent to admins for: ${medicineNames}`);
            }
        }
    } catch (error) {
        console.error('Error sending low stock notifications:', error);
    }
};

const sendExpiryNotifications = async () => {
    try {
        const today = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);

        const expiringMedicines = await Medicine.findAll({
            where: {
                expiryDate: {
                    [Op.between]: [today, thirtyDaysFromNow]
                },
                status: 'approved'
            }
        });

        if (expiringMedicines.length > 0) {
            const adminUsers = await User.findAll({ where: { userType: 'admin' } });
            if (adminUsers.length > 0) {
                const medicineNames = expiringMedicines.map(m => `${m.name} (expires: ${m.expiryDate})`).join('; ');
                const emailSubject = 'Medicine Expiry Alert';
                const emailBody = `The following medicines will expire within 30 days: ${medicineNames}. Please take action.`;

                for (const admin of adminUsers) {
                    // await sendEmail(admin.email, emailSubject, emailBody);
                }
                // console.log(`Expiry notification sent to admins for: ${medicineNames}`);
            }
        }
    } catch (error) {
        console.error('Error sending expiry notifications:', error);
    }
};

const sendDonorReports = async () => {
    try {
        const donorUsers = await User.findAll({ where: { userType: 'donor' } });
        if (donorUsers.length > 0) {
            const emailSubject = 'Monthly Donation Report';
            const emailBody = `Thank you for your donations. Here is your monthly report... (This is a mock report)`;

            for (const donor of donorUsers) {
                // await sendEmail(donor.email, emailSubject, emailBody);
            }
            // console.log(`Monthly donation report sent to all donors.`);
        }
    } catch (error) {
        console.error('Error sending donor reports:', error);
    }
};


// --- Scheduled Jobs ---
const startScheduledJobs = () => {
    // console.log('--- Starting Scheduled Notification Jobs ---');

    // 1. Low stock notification job (runs daily at 2:00 AM)
    // cron.schedule('0 2 * * *', () => {
    //     sendLowStockNotifications();
    //     // console.log('Low stock notification job scheduled for 2:00 AM daily.');
    // });

    // 2. Expiry notification job (runs daily at 2:05 AM)
    // cron.schedule('5 2 * * *', () => {
    //     sendExpiryNotifications();
    //     // console.log('Expiry notification job scheduled for 2:05 AM daily.');
    // });

    // 3. Donor report job (runs on the 1st of every month at 3:00 AM)
    // cron.schedule('0 3 1 * *', () => {
    //     sendDonorReports();
    //     // console.log('Donor report job scheduled for 3:00 AM on the 1st of every month.');
    // });
};

module.exports = {
    startScheduledJobs,
    sendLowStockNotifications, // Export for manual testing if needed
    sendExpiryNotifications,   // Export for manual testing if needed
    sendDonorReports         // Export for manual testing if needed
};
