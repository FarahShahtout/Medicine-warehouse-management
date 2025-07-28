// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');


router.post('/register', authController.register);

router.post('/login', authController.login);

router.delete('/delete-account', authMiddleware.authenticate, authController.deleteUser);
router.delete('/admin/delete-user/:id', authMiddleware.authenticate, authMiddleware.authorize('admin'), authController.deleteUser);

module.exports = router;
