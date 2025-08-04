// backend/routes/warehouseRoutes.js

const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const authMiddleware = require('../middleware/authMiddleware');

// Route to create a new warehouse (Admin only)
router.post('/create', authMiddleware.authenticate, authMiddleware.authorize('admin'), warehouseController.createWarehouse);

// Route to get all warehouses (Admin and Employee)
router.get('/all', authMiddleware.authenticate, authMiddleware.authorize('admin', 'employee'), warehouseController.getAllWarehouses);

// Route to get a single warehouse by ID (Admin and Employee)
router.get('/:id', authMiddleware.authenticate, authMiddleware.authorize('admin', 'employee'), warehouseController.getWarehouseById);

// Route to update warehouse details by ID (Admin only)
router.put('/update/:id', authMiddleware.authenticate, authMiddleware.authorize('admin'), warehouseController.updateWarehouse);

// Route to delete a warehouse by ID (Admin only)
router.delete('/delete/:id', authMiddleware.authenticate, authMiddleware.authorize('admin'), warehouseController.deleteWarehouse);


module.exports = router;