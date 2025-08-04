// backend/controllers/distributionController.js

const db = require('../models');
const Distribution = db.Distribution;
const Medicine = db.Medicine;
const Warehouse = db.Warehouse;
const User = db.User; // لاستخدام نموذج المستخدم لمعرفة من طلب أو وافق
const { z } = require('zod');
const { Op } = require('sequelize');

// Zod schema for creating a distribution request
const createDistributionSchema = z.object({
    medicineId: z.string().uuid("Medicine ID must be a valid UUID."),
    requestedQuantity: z.number().int().min(1, "Requested quantity must be an integer and greater than zero."),
    sourceWarehouseId: z.string().uuid("Source Warehouse ID must be a valid UUID."),
    destinationWarehouseId: z.string().uuid("Destination Warehouse ID must be a valid UUID."),
}).refine(data => data.sourceWarehouseId !== data.destinationWarehouseId, {
    message: "Source and Destination warehouses cannot be the same.",
    path: ["destinationWarehouseId"],
});

// Zod schema for approving/rejecting a distribution request
const updateDistributionStatusSchema = z.object({
    rejectionReason: z.string().optional(), // مطلوب فقط عند الرفض
});

// 1. Function to create a new distribution request (by Employee or Admin)
const createDistributionRequest = async (req, res) => {
    console.log('--- Inside createDistributionRequest function ---');

    // Only employees or admins can create distribution requests
    if (!req.user || (req.user.userType !== 'employee' && req.user.userType !== 'admin')) {
        return res.status(403).json({ message: 'Forbidden: Only employees or admins can create distribution requests.' });
    }

    try {
        const validatedData = createDistributionSchema.parse(req.body);
        console.log('Distribution request data validation SUCCESSFUL.');

        const { medicineId, requestedQuantity, sourceWarehouseId, destinationWarehouseId } = validatedData;
        const requestedById = req.user.id;

        // Verify medicine availability in the source warehouse (if you track per-warehouse inventory)
        // Currently, our Medicine model has a global quantity.
        // If you implement per-warehouse inventory, you'll need to adjust this check.
        const medicine = await Medicine.findByPk(medicineId);
        if (!medicine) {
            return res.status(404).json({ message: 'Medicine not found.' });
        }
        if (medicine.quantity < requestedQuantity) {
            return res.status(400).json({ message: `Requested quantity (${requestedQuantity}) exceeds available global stock (${medicine.quantity}).` });
        }

        // Verify source and destination warehouses exist
        const sourceWarehouse = await Warehouse.findByPk(sourceWarehouseId);
        const destinationWarehouse = await Warehouse.findByPk(destinationWarehouseId);

        if (!sourceWarehouse || !destinationWarehouse) {
            return res.status(404).json({ message: 'Source or destination warehouse not found.' });
        }

        const distribution = await Distribution.create({
            medicineId,
            requestedQuantity,
            sourceWarehouseId,
            destinationWarehouseId,
            requestedById,
            status: 'pending' // Initial status
        });
        console.log('Distribution request created in DB:', distribution.id);

        res.status(201).json({
            message: 'Distribution request submitted successfully, awaiting approval.',
            distribution: distribution
        });
        console.log('Response sent: Distribution request submitted successfully.');

    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Distribution request data validation FAILED:', error.errors);
            return res.status(400).json({ message: error.errors[0].message });
        }
        console.error('General error in createDistributionRequest function:', error);
        res.status(500).json({ message: 'Server error during distribution request creation.' });
    }
};

// 2. Function to get all pending distribution requests (for Admin)
const getPendingDistributions = async (req, res) => {
    console.log('--- Inside getPendingDistributions function ---');

    // Only admins can view pending distributions
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Only admins can view pending distribution requests.' });
    }

    try {
        const pendingDistributions = await Distribution.findAll({
            where: { status: 'pending' },
            include: [
                { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'quantity'] },
                { model: Warehouse, as: 'sourceWarehouse', attributes: ['id', 'name', 'address'] },
                { model: Warehouse, as: 'destinationWarehouse', attributes: ['id', 'name', 'address'] },
                { model: User, as: 'requestedBy', attributes: ['id', 'name', 'userType'] }
            ]
        });

        res.status(200).json({
            message: 'Pending distribution requests retrieved successfully.',
            distributions: pendingDistributions
        });
        console.log('Response sent: Pending distribution requests retrieved successfully.');

    } catch (error) {
        console.error('Error fetching pending distributions:', error);
        res.status(500).json({ message: 'Server error fetching pending distribution requests.' });
    }
};

// 3. Function to approve a distribution request (for Admin)
const approveDistribution = async (req, res) => {
    console.log('--- Inside approveDistribution function ---');

    // Only admins can approve distributions
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Only admins can approve distribution requests.' });
    }

    const { id } = req.params; // Distribution ID

    try {
        const distribution = await Distribution.findByPk(id);
        if (!distribution) {
            return res.status(404).json({ message: 'Distribution request not found.' });
        }
        if (distribution.status !== 'pending') {
            return res.status(400).json({ message: 'Distribution request is not in pending status and cannot be approved.' });
        }

        // Verify medicine availability again (global stock)
        const medicine = await Medicine.findByPk(distribution.medicineId);
        if (!medicine) {
            return res.status(404).json({ message: 'Associated medicine not found.' });
        }
        if (medicine.quantity < distribution.requestedQuantity) {
            return res.status(400).json({ message: 'Not enough medicine in global stock to fulfill this distribution.' });
        }

        // Update medicine quantity (decrease from global stock)
        // IMPORTANT: If you implement per-warehouse inventory, this logic needs to change
        // to decrease from source warehouse and increase in destination warehouse.
        medicine.quantity -= distribution.requestedQuantity;
        await medicine.save();

        // Update distribution status
        distribution.status = 'approved';
        distribution.approvalById = req.user.id;
        distribution.transferDate = new Date().toISOString().slice(0, 10); // Set transfer date to today
        await distribution.save();

        res.status(200).json({
            message: 'Distribution request approved and medicine quantity updated.',
            distribution: distribution,
            updatedMedicineQuantity: medicine.quantity
        });
        console.log('Response sent: Distribution request approved successfully.');

    } catch (error) {
        console.error('Error approving distribution:', error);
        res.status(500).json({ message: 'Server error approving distribution request.' });
    }
};

// 4. Function to reject a distribution request (for Admin)
const rejectDistribution = async (req, res) => {
    console.log('--- Inside rejectDistribution function ---');

    // Only admins can reject distributions
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Only admins can reject distribution requests.' });
    }

    const { id } = req.params; // Distribution ID
    const { rejectionReason } = req.body; // Optional rejection reason

    try {
        const distribution = await Distribution.findByPk(id);
        if (!distribution) {
            return res.status(404).json({ message: 'Distribution request not found.' });
        }
        if (distribution.status !== 'pending') {
            return res.status(400).json({ message: 'Distribution request is not in pending status and cannot be rejected.' });
        }

        // Update distribution status
        distribution.status = 'rejected';
        distribution.approvalById = req.user.id; // Record who rejected it
        distribution.rejectionReason = rejectionReason || 'No reason provided.';
        await distribution.save();

        res.status(200).json({
            message: 'Distribution request rejected successfully.',
            distribution: distribution
        });
        console.log('Response sent: Distribution request rejected successfully.');

    } catch (error) {
        console.error('Error rejecting distribution:', error);
        res.status(500).json({ message: 'Server error rejecting distribution request.' });
    }
};

// 5. Function to get all distributions (for Admin)
const getAllDistributions = async (req, res) => {
    console.log('--- Inside getAllDistributions function ---');

    // Only admins can view all distributions
    if (!req.user || req.user.userType !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: Only admins can view all distribution requests.' });
    }

    try {
        const distributions = await Distribution.findAll({
            include: [
                { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'quantity'] },
                { model: Warehouse, as: 'sourceWarehouse', attributes: ['id', 'name', 'address'] },
                { model: Warehouse, as: 'destinationWarehouse', attributes: ['id', 'name', 'address'] },
                { model: User, as: 'requestedBy', attributes: ['id', 'name', 'userType'] },
                { model: User, as: 'approvedBy', attributes: ['id', 'name', 'userType'] }
            ]
        });

        res.status(200).json({
            message: 'All distribution requests retrieved successfully.',
            distributions: distributions
        });
        console.log('Response sent: All distribution requests retrieved successfully.');

    } catch (error) {
        console.error('Error fetching all distributions:', error);
        res.status(500).json({ message: 'Server error fetching all distribution requests.' });
    }
};

module.exports = {
    createDistributionRequest,
    getPendingDistributions,
    approveDistribution,
    rejectDistribution,
    getAllDistributions
};
