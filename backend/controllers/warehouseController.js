// backend/controllers/warehouseController.js

const db = require('../models');
const Warehouse = db.Warehouse;
const { z } = require('zod'); // For Zod schema validation
const { Op } = require('sequelize'); // For Sequelize operators

// Zod schema for validating warehouse data
const warehouseSchema = z.object({
    name: z.string().min(1, "Warehouse name is required."),
    address: z.string().min(5, "Warehouse address is required and must be at least 5 characters long."),
    latitude: z.number().optional(), // Latitude is optional
    longitude: z.number().optional(), // Longitude is optional
    phoneNumber: z.string().optional(), // Phone number is optional
    email: z.string().email("Invalid email address.").optional(), // Email is optional and must be valid if provided
});

// 1. Function to create a new warehouse (for Admin only)
const createWarehouse = async (req, res) => {
    console.log('--- Inside createWarehouse function ---');

    // Check if the user is logged in and is an admin
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Only admins can create warehouses.' });
    }

    try {
        // Validate data using Zod
        const validatedData = warehouseSchema.parse(req.body);
        console.log('Warehouse data validation SUCCESSFUL.');

        // Check if a warehouse with the same name already exists
        const existingWarehouse = await Warehouse.findOne({ where: { name: validatedData.name } });
        if (existingWarehouse) {
            return res.status(409).json({ message: 'Warehouse with this name already exists.' });
        }

        const warehouse = await Warehouse.create(validatedData);
        console.log('Warehouse created in DB:', warehouse.id);

        res.status(201).json({
            message: 'Warehouse created successfully.',
            warehouse: warehouse
        });
        console.log('Response sent: Warehouse created successfully.');

    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Warehouse data validation FAILED:', error.errors);
            return res.status(400).json({ message: error.errors[0].message });
        }
        console.error('General error in createWarehouse function:', error);
        res.status(500).json({ message: 'Server error during warehouse creation.' });
    }
};

// 2. Function to get all warehouses (for Admin and Employee)
const getAllWarehouses = async (req, res) => {
    console.log('--- Inside getAllWarehouses function ---');

    // Check if the user is logged in and is an admin or employee
    if (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'employee')) {
        return res.status(403).json({ message: 'Forbidden: Only admins or employees can view warehouses.' });
    }

    try {
        const warehouses = await Warehouse.findAll();
        res.status(200).json({
            message: 'Warehouses retrieved successfully.',
            warehouses: warehouses
        });
        console.log('Response sent: Warehouses retrieved successfully.');

    } catch (error) {
        console.error('Error fetching warehouses:', error);
        res.status(500).json({ message: 'Server error fetching warehouses.' });
    }
};

// 3. Function to get a single warehouse by ID (for Admin and Employee)
const getWarehouseById = async (req, res) => {
    console.log('--- Inside getWarehouseById function ---');

    // Check if the user is logged in and is an admin or employee
    if (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'employee')) {
        return res.status(403).json({ message: 'Forbidden: Only admins or employees can view warehouse details.' });
    }

    const { id } = req.params; // Warehouse ID from URL parameter

    try {
        const warehouse = await Warehouse.findByPk(id);
        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse not found.' });
        }
        res.status(200).json({
            message: 'Warehouse retrieved successfully.',
            warehouse: warehouse
        });
        console.log('Response sent: Warehouse retrieved successfully.');

    } catch (error) {
        console.error('Error fetching warehouse by ID:', error);
        res.status(500).json({ message: 'Server error fetching warehouse.' });
    }
};

// 4. Function to update warehouse details (for Admin only)
const updateWarehouse = async (req, res) => {
    console.log('--- Inside updateWarehouse function ---');

    // Check if the user is logged in and is an admin
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Only admins can update warehouses.' });
    }

    const { id } = req.params; // Warehouse ID from URL parameter
    const { name, address, latitude, longitude, phoneNumber, email } = req.body;

    try {
        const warehouse = await Warehouse.findByPk(id);
        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse not found.' });
        }

        // Validate incoming data (only fields that are provided)
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (address !== undefined) updateData.address = address;
        if (latitude !== undefined) updateData.latitude = latitude;
        if (longitude !== undefined) updateData.longitude = longitude;
        if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
        if (email !== undefined) {
            // Basic email format validation if email is provided
            if (email && !z.string().email().safeParse(email).success) {
                return res.status(400).json({ message: "Invalid email address format." });
            }
            updateData.email = email;
        }

        // Check if updated name already exists for another warehouse
        if (updateData.name && updateData.name !== warehouse.name) {
            const existingWarehouse = await Warehouse.findOne({ where: { name: updateData.name, id: { [Op.ne]: id } } });
            if (existingWarehouse) {
                return res.status(409).json({ message: 'Another warehouse with this name already exists.' });
            }
        }

        await warehouse.update(updateData);

        res.status(200).json({
            message: 'Warehouse updated successfully.',
            warehouse: warehouse
        });
        console.log('Response sent: Warehouse updated successfully.');

    } catch (error) {
        if (error instanceof z.ZodError) { // Catch Zod errors if any validation is applied here
            console.error('Warehouse data validation FAILED during update:', error.errors);
            return res.status(400).json({ message: error.errors[0].message });
        }
        console.error('General error in updateWarehouse function:', error);
        res.status(500).json({ message: 'Server error updating warehouse.' });
    }
};

// 5. Function to delete a warehouse (for Admin only)
const deleteWarehouse = async (req, res) => {
    console.log('--- Inside deleteWarehouse function ---');

    // Check if the user is logged in and is an admin
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Only admins can delete warehouses.' });
    }

    const { id } = req.params; // Warehouse ID from URL parameter

    try {
        const warehouse = await Warehouse.findByPk(id);
        if (!warehouse) {
            return res.status(404).json({ message: 'Warehouse not found.' });
        }

        // Optional: Check for associated requests before deleting a warehouse
        // This prevents deleting a warehouse if there are requests linked to it.
        const associatedRequestsCount = await db.Request.count({
            where: { warehouseId: id }
        });

        if (associatedRequestsCount > 0) {
            return res.status(400).json({ message: 'Cannot delete warehouse: There are requests associated with it.' });
        }

        await warehouse.destroy();
        res.status(200).json({ message: 'Warehouse deleted successfully.' });
        console.log('Response sent: Warehouse deleted successfully.');

    } catch (error) {
        console.error('Error deleting warehouse:', error);
        res.status(500).json({ message: 'Server error deleting warehouse.' });
    }
};


module.exports = {
    createWarehouse,
    getAllWarehouses,
    getWarehouseById,
    updateWarehouse,
    deleteWarehouse
};