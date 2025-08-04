// backend/routes/distributionRoutes.js

const express = require('express');
const router = express.Router();
const distributionController = require('../controllers/distributionController');
const authMiddleware = require('../middleware/authMiddleware');

// Route to create a new distribution request (Employee or Admin)
router.post('/create', authMiddleware.authenticate, authMiddleware.authorize('employee', 'admin'), distributionController.createDistributionRequest);

// Route to get all pending distribution requests (Admin only)
router.get('/admin/pending', authMiddleware.authenticate, authMiddleware.authorize('admin'), distributionController.getPendingDistributions);

// Route to approve a distribution request (Admin only)
router.post('/admin/approve/:id', authMiddleware.authenticate, authMiddleware.authorize('admin'), distributionController.approveDistribution);

// Route to reject a distribution request (Admin only)
router.post('/admin/reject/:id', authMiddleware.authenticate, authMiddleware.authorize('admin'), distributionController.rejectDistribution);

// Route to get all distribution requests (Admin only)
router.get('/admin/all', authMiddleware.authenticate, authMiddleware.authorize('admin'), distributionController.getAllDistributions);

module.exports = router;