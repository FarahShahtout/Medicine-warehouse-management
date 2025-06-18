// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');


const authMiddleware = require('../middlewares/authMiddleware');




router.post('/register', authController.register);


router.post('/login', authController.login);


router.delete('/delete-account', authMiddleware.protect, authController.deleteMyAccount);


router.delete('/admin/delete-user/:id', authMiddleware.protect, authMiddleware.authorize('admin'), authController.deleteUserById);

module.exports = router;