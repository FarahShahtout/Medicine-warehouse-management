// backend/routes/medicineRoutes.js

const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');
const authMiddleware = require('../middleware/authMiddleware');

// Route to add a new medicine (requires authentication and user to be donor or admin)
router.post('/donate', authMiddleware.authenticate, authMiddleware.authorize('donor', 'admin'), medicineController.donateMedicine);

// Admin Routes for Donation Approval System
// Route to get all pending donations (requires authentication and user to be admin)
router.get('/admin/pending', authMiddleware.authenticate, authMiddleware.authorize('admin'), medicineController.getPendingDonations);

// Route to approve a specific donation by ID (requires authentication and user to be admin)
router.post('/admin/approve/:id', authMiddleware.authenticate, authMiddleware.authorize('admin'), medicineController.approveDonation);

// Route to reject a specific donation by ID (requires authentication and user to be admin)
router.post('/admin/reject/:id', authMiddleware.authenticate, authMiddleware.authorize('admin'), medicineController.rejectDonation);

module.exports = router;

