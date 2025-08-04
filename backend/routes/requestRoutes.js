// backend/routes/requestRoutes.js

const express = require('express');
const router = express.Router();
const requestController = require('../controllers/requestController');
const authMiddleware = require('../middleware/authMiddleware');

// 1. Route: AI Chat for initial medicine inquiry (for patients)
router.post('/chat-ai', authMiddleware.authenticate, authMiddleware.authorize('patient'), requestController.chatWithAI);

// 2. Route: Create a medicine request (for patients)
router.post('/create', authMiddleware.authenticate, authMiddleware.authorize('patient'), requestController.createRequest);

// 3. Route: Process payment for a request (for patients)
router.post('/process-payment/:requestId', authMiddleware.authenticate, authMiddleware.authorize('patient'), requestController.processPayment);

// 4. Route: Fulfill a request (change status from 'paid' to 'fulfilled') (for employees)
router.post('/employee/fulfill/:id', authMiddleware.authenticate, authMiddleware.authorize('employee'), requestController.fulfillRequest);

// 5. Route to get all patient requests (for patients)
router.get('/my-requests', authMiddleware.authenticate, authMiddleware.authorize('patient'), requestController.getPatientRequests);

// 6. Route to get all pending requests (for admin and employee)
router.get('/admin/pending', authMiddleware.authenticate, authMiddleware.authorize('admin', 'employee'), requestController.getPendingRequests);

// 7. Route to approve a request (for admin and employee)
router.post('/admin/approve/:id', authMiddleware.authenticate, authMiddleware.authorize('admin', 'employee'), requestController.approveRequest);

// 8. Route to reject a request (for admin and employee)
router.post('/admin/reject/:id', authMiddleware.authenticate, authMiddleware.authorize('admin', 'employee'), requestController.rejectRequest);

// 9. New Route: Get all paid requests (for Admin and Employee)
router.get('/admin/paid', authMiddleware.authenticate, authMiddleware.authorize('admin', 'employee'), requestController.getPaidRequests); // <--- أضيفي هذا السطر

module.exports = router;
