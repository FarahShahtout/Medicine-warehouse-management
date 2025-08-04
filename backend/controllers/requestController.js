// backend/controllers/requestController.js

const db = require('../models');
const Request = db.Request;
const Medicine = db.Medicine;
const User = db.User;
const Warehouse = db.Warehouse;
const AIInteractionLog = db.AIInteractionLog;
const { z } = require('zod');
const { Op } = require('sequelize');
const aiService = require('../services/aiService'); // استيراد الخدمة الجديدة

// Zod schema for validating medicine request data
const requestSchema = z.object({
    medicineId: z.string().uuid("Medicine ID must be a valid UUID."),
    requestedQuantity: z.number().int().min(1, "Requested quantity must be an integer and greater than zero."),
    deliveryAddress: z.string().min(5, "Delivery address is required and must be at least 5 characters long.").optional(),
    warehouseId: z.string().uuid("Warehouse ID must be a valid UUID.").optional(),
    totalPrice: z.number().min(0, "Total price cannot be negative.").optional(),
    deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Delivery date must be in YYYY-MM-DD format.").optional(),
    deliveryTimeSlot: z.string().optional()
});

// Zod schema for AI chat initial inquiry
const chatInquirySchema = z.object({
    query: z.string().min(1, "Query text is required."),
    patientAddress: z.string().min(5, "Patient address is required for location-based services.").optional(),
});

// --- Helper Functions ---

const findNearestWarehouse = async (address) => {
    try {
        const warehouse = await Warehouse.findOne({
            where: {
                [Op.or]: [
                    { name: { [Op.like]: `%${address}%` } },
                    { address: { [Op.like]: `%${address}%` } }
                ]
            }
        });
        return warehouse;
    } catch (error) {
        console.error('Error finding nearest warehouse:', error);
        return null;
    }
};

const calculatePrice = async (medicineId, quantity) => {
    try {
        const medicine = await Medicine.findByPk(medicineId, { attributes: ['name', 'description', 'quantity'] });
        if (!medicine) {
            return null;
        }
        const pricePerUnit = 5.00; // Example price
        return parseFloat((quantity * pricePerUnit).toFixed(2));
    } catch (error) {
        console.error('Error calculating price:', error);
        return null;
    }
};

// --- Controller Functions ---

// 1. Function to handle AI chat interaction (patient inquiry)
const chatWithAI = async (req, res) => {
    console.log('--- Inside chatWithAI function ---');

    if (!req.user || req.user.userType !== 'patient') {
        return res.status(403).json({ message: 'Forbidden: Only patients can use AI chat for medicine inquiries.' });
    }

    const patientId = req.user.id;
    const { query, patientAddress } = req.body;

    let aiResponseText = "";
    let interactionType = 'general_health_question';
    let medicineId = null;
    let medicineName = null;
    let availableQuantity = 0;
    let suggestedQuantity = 0;
    let estimatedPrice = 0;
    let nearestWarehouseInfo = null;
    let available = false;

    try {
        // Validate request body using the Zod schema
        const validatedData = chatInquirySchema.safeParse(req.body);
        if (!validatedData.success) {
            console.error('Chat inquiry validation FAILED:', validatedData.error.errors);
            const errorMessage = validatedData.error.errors.map(err => err.message).join('; ');
            return res.status(400).json({ message: errorMessage });
        }

        const potentialDrugName = query.toLowerCase().replace(/دواء|علاج|اسم|عن|ما هو|ما اسم/g, '').trim();
        const medicine = await Medicine.findOne({
            where: {
                name: { [Op.like]: `%${potentialDrugName}%` },
                status: 'approved',
                quantity: { [Op.gt]: 0 }
            }
        });

        let llmPrompt = "";
        let responsePayload = {};

        if (medicine) {
            interactionType = 'medicine_inquiry';
            available = true;
            medicineId = medicine.id;
            medicineName = medicine.name;
            availableQuantity = medicine.quantity;
            suggestedQuantity = Math.min(medicine.quantity, 10);
            estimatedPrice = await calculatePrice(medicine.id, suggestedQuantity);

            const nearestWarehouse = patientAddress ? await findNearestWarehouse(patientAddress) : null;
            if (nearestWarehouse) {
                nearestWarehouseInfo = { id: nearestWarehouse.id, name: nearestWarehouse.name, address: nearestWarehouse.address };
            }

            llmPrompt = `
                أجب على المريض باللغة العربية. المريض يسأل عن "${query}". 
                البيانات المتوفرة في المخزون لدينا هي:
                اسم الدواء: ${medicine.name}
                الكمية المتوفرة: ${medicine.quantity} وحدة
                الوصف: ${medicine.description ? medicine.description.substring(0, 100) + '...' : 'لا يوجد وصف.'}
                السعر التقريبي لـ ${suggestedQuantity} وحدة: $${estimatedPrice}
                ${nearestWarehouseInfo ? `أقرب مستودع لعنوان "${patientAddress}": ${nearestWarehouseInfo.name} في ${nearestWarehouseInfo.address}.` : ''}

                صِغ إجابة ودية ومحادثية للمريض، تؤكد توفر الدواء، وكميته، وسعره التقريبي، ومعلومات المستودع. 
                أسأله إذا كان يرغب في تقديم طلب لـ ${suggestedQuantity} وحدة.
                هام: يجب أن تتضمن الإجابة تحذيراً طبياً واضحاً وصريحاً بأن هذه المعلومات ليست بديلاً عن استشارة الطبيب أو الصيدلي، ويجب عليه استشارة المختص قبل تناول أي دواء.
            `;

            responsePayload = {
                available: available,
                medicineId: medicineId,
                medicineName: medicineName,
                availableQuantity: availableQuantity,
                suggestedQuantity: suggestedQuantity,
                estimatedPrice: estimatedPrice,
                nearestWarehouse: nearestWarehouseInfo
            };

        } else {
            // No medicine found or it's a general/alternative inquiry
            if (query.toLowerCase().includes("بديل") || query.toLowerCase().includes("alternative")) {
                interactionType = 'alternative_suggestion';
                llmPrompt = `
                    المريض يسأل عن بديل لدواء، أو يسأل عن دواء غير متوفر لدينا. استفساره هو: "${query}".
                    يرجى الإجابة باللغة العربية.
                    يرجى تقديم اقتراحات عامة للأدوية التي لا تستلزم وصفة طبية للحالات الشائعة (على سبيل المثال: "لآلام الرأس، يمكن النظر في استخدام إيبوبروفين أو باراسيتامول").
                    إذا كان المريض قد ذكر دواءً محدداً ولم يتم العثور عليه، يجب إبلاغه بلطف أنه غير متوفر لدينا واقتراح بدائل عامة لاستخداماته الشائعة.
                    هام: يجب أن تتضمن الإجابة تحذيراً طبياً واضحاً وصريحاً بأن هذه المعلومات ليست بديلاً عن استشارة الطبيب أو الصيدلي، ويجب استشارة المختص قبل تناول أي دواء.
                `;
            } else {
                interactionType = 'general_health_question';
                llmPrompt = `
                    المريض يسأل: "${query}". لم يتم العثور على دواء محدد يطابق هذا الاستفسار في مخزوننا. 
                    يرجى الإجابة باللغة العربية.
                    إذا كان هذا سؤالاً صحياً عاماً (مثلاً: "لدي صداع، ماذا أفعل؟")، يرجى تقديم نصيحة صحية عامة ومفيدة.
                    إذا كان استفساراً عن دواء غير متوفر، يرجى إبلاغه بلطف بأنه غير متوفر واقتراح عليه استشارة طبيب. 
                    هام: يجب ألا تقوم بتأليف أسماء أدوية أو تقديم نصائح طبية محددة. يجب أن تتضمن الإجابة تحذيراً طبياً صريحاً بأن هذه المعلومات ليست بديلاً عن استشارة الطبيب.
                `;
            }
            responsePayload = { available: false };
        }

        // Using the centralized AI service
        aiResponseText = await aiService.generateContent(llmPrompt);
        console.log('AI response received:', aiResponseText);

        // Log the AI interaction
        await AIInteractionLog.create({
            patientId: patientId,
            queryText: query,
            aiResponseText: aiResponseText,
            medicineId: medicineId,
            interactionType: interactionType,
            success: available
        });

        res.status(200).json({
            message: aiResponseText,
            ...responsePayload
        });
        console.log('Response sent: AI Chat inquiry successful and logged.');

    } catch (error) {
        console.error('General error in chatWithAI function:', error);
        res.status(500).json({ message: 'Server error during AI chat inquiry.' });
    }
};

// 2. Function to create a medicine request (now, after AI chat or direct patient action)
const createRequest = async (req, res) => {
    console.log('--- Inside createRequest function ---');

    if (!req.user || req.user.userType !== 'patient') {
        return res.status(403).json({ message: 'Forbidden: Only patients can request medicine.' });
    }

    try {
        const validatedData = requestSchema.safeParse(req.body);
        if (!validatedData.success) {
            console.error('Request data validation FAILED:', validatedData.error.errors);
            const errorMessage = validatedData.error.errors.map(err => err.message).join('; ');
            return res.status(400).json({ message: errorMessage });
        }
        console.log('Request data validation SUCCESSFUL.');

        const { medicineId, requestedQuantity, deliveryAddress, warehouseId, totalPrice, deliveryDate, deliveryTimeSlot } = validatedData.data;
        const patientId = req.user.id;

        const medicine = await Medicine.findByPk(medicineId);
        if (!medicine) {
            return res.status(404).json({ message: 'Medicine not found.' });
        }
        if (medicine.status !== 'approved') {
            return res.status(400).json({ message: 'Medicine is not available for request (status not approved).' });
        }
        if (medicine.quantity < requestedQuantity) {
            return res.status(400).json({ message: `Requested quantity (${requestedQuantity}) exceeds available stock (${medicine.quantity}).` });
        }

        const finalPrice = totalPrice || await calculatePrice(medicine.id, requestedQuantity);
        if (finalPrice === null) {
            return res.status(500).json({ message: 'Could not calculate price for the request.' });
        }

        let finalWarehouseId = warehouseId;
        if (!finalWarehouseId && deliveryAddress) {
            const nearestWarehouse = await findNearestWarehouse(deliveryAddress);
            if (nearestWarehouse) {
                finalWarehouseId = nearestWarehouse.id;
            } else {
                return res.status(400).json({ message: 'Could not determine a suitable warehouse for the provided address. Please ensure the address contains a valid region (e.g., "North Gaza", "Central Gaza", "South Gaza").' });
            }
        } else if (!finalWarehouseId && !deliveryAddress) {
            return res.status(400).json({ message: 'Either a warehouse ID or a delivery address is required.' });
        }

        const request = await Request.create({
            medicineId,
            patientId,
            requestedQuantity,
            deliveryAddress,
            warehouseId: finalWarehouseId,
            totalPrice: finalPrice,
            deliveryDate: deliveryDate || null,
            deliveryTimeSlot: deliveryTimeSlot || null,
            status: 'pending',
            paymentStatus: 'pending'
        });
        console.log('Request created in DB:', request.id);

        res.status(201).json({
            message: 'Medicine request submitted successfully. Please proceed to payment.',
            request: request
        });
        console.log('Response sent: Medicine request submitted successfully.');

    } catch (error) {
        console.error('General error in createRequest function:', error);
        res.status(500).json({ message: 'Server error during medicine request.' });
    }
};

// 3. Function to simulate payment processing
const processPayment = async (req, res) => {
    console.log('--- Inside processPayment function ---');

    if (!req.user || req.user.userType !== 'patient') {
        return res.status(403).json({ message: 'Forbidden: Only patients can process payments.' });
    }

    const { requestId } = req.params;
    const { paymentMethod, amountPaid } = req.body;

    try {
        const request = await Request.findByPk(requestId, {
            include: [
                { model: Medicine, as: 'medicine', attributes: ['name'] },
                { model: Warehouse, as: 'deliveryWarehouse', attributes: ['name', 'address'] }
            ]
        });
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        if (request.patientId !== req.user.id) {
            return res.status(403).json({ message: 'Forbidden: You can only process payment for your own requests.' });
        }

        if (request.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'Payment for this request has already been processed.' });
        }

        if (request.status !== 'pending' && request.status !== 'approved') {
            return res.status(400).json({ message: 'Payment can only be processed for pending or approved requests.' });
        }

        if (amountPaid < request.totalPrice) {
            request.paymentStatus = 'failed';
            await request.save();
            console.log(`Payment failed for Request ${requestId}. Amount paid: ${amountPaid}, required: ${request.totalPrice}`);
            return res.status(400).json({ message: 'Payment failed: Amount paid is less than total price.' });
        }

        request.paymentStatus = 'paid';
        request.status = 'paid';
        await request.save();

        const deliveryDetails = {
            pickupDate: request.deliveryDate,
            pickupTimeSlot: request.deliveryTimeSlot,
            warehouseName: request.deliveryWarehouse ? request.deliveryWarehouse.name : 'N/A',
            warehouseAddress: request.deliveryWarehouse ? request.deliveryWarehouse.address : 'N/A',
            medicineName: request.medicine ? request.medicine.name : 'N/A',
            totalPrice: request.totalPrice
        };

        res.status(200).json({
            message: 'Payment processed successfully. Your request status is now paid. Please check the website for pickup details.',
            request: request,
            deliveryDetails: deliveryDetails
        });
        console.log('Response sent: Payment processed successfully.');

    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ message: 'Server error during payment processing.' });
    }
};

// 4. Function to fulfill a request (change status from 'paid' to 'fulfilled')
const fulfillRequest = async (req, res) => {
    console.log('--- Inside fulfillRequest function ---');

    if (!req.user || req.user.userType !== 'employee') {
        return res.status(403).json({ message: 'Forbidden: Only employees can fulfill requests.' });
    }

    const { id } = req.params;

    try {
        const request = await Request.findByPk(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }
        if (request.status !== 'paid') {
            return res.status(400).json({ message: 'Request is not in paid status and cannot be fulfilled.' });
        }

        request.status = 'fulfilled';
        await request.save();

        res.status(200).json({
            message: 'Request fulfilled successfully (marked as delivered).',
            request: request
        });
        console.log('Response sent: Request fulfilled successfully.');

    } catch (error) {
        console.error('Error fulfilling request:', error);
        res.status(500).json({ message: 'Server error fulfilling request.' });
    }
};

// 5. Function to retrieve all patient requests (for patients)
const getPatientRequests = async (req, res) => {
    console.log('--- Inside getPatientRequests function ---');

    if (!req.user || req.user.userType !== 'patient') {
        return res.status(403).json({ message: 'Forbidden: Only patients can view their requests.' });
    }

    try {
        const patientId = req.user.id;
        const requests = await Request.findAll({
            where: { patientId: patientId },
            include: [
                { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'description', 'expiryDate', 'quantity', 'drugImageUrl'] },
                { model: Warehouse, as: 'deliveryWarehouse', attributes: ['id', 'name', 'address'] }
            ]
        });

        res.status(200).json({
            message: 'Patient requests retrieved successfully.',
            requests: requests
        });
        console.log('Response sent: Patient requests retrieved successfully.');

    } catch (error) {
        console.error('Error fetching patient requests:', error);
        res.status(500).json({ message: 'Server error fetching patient requests.' });
    }
};

// 6. Function to retrieve all pending requests (for admin and employee)
const getPendingRequests = async (req, res) => {
    console.log('--- Inside getPendingRequests function ---');

    if (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'employee')) {
        return res.status(403).json({ message: 'Forbidden: Only admins or employees can view pending requests.' });
    }

    try {
        const pendingRequests = await Request.findAll({
            where: { status: 'pending' },
            include: [
                { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'expiryDate', 'quantity', 'drugImageUrl'] },
                { model: User, as: 'patient', attributes: ['id', 'name', 'email', 'phoneNumber'] },
                { model: Warehouse, as: 'deliveryWarehouse', attributes: ['id', 'name', 'address'] }
            ]
        });

        res.status(200).json({
            message: 'Pending requests retrieved successfully.',
            requests: pendingRequests
        });
        console.log('Response sent: Pending requests retrieved successfully.');

    } catch (error) {
        console.error('Error fetching pending requests:', error);
        res.status(500).json({ message: 'Server error fetching pending requests.' });
    }
};

const getPaidRequests = async (req, res) => {
    console.log('--- Inside getPaidRequests function ---');

    if (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'employee')) {
        return res.status(403).json({ message: 'Forbidden: Only admins or employees can view paid requests.' });
    }

    try {
        const paidRequests = await Request.findAll({
            where: { status: 'paid' },
            include: [
                { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'expiryDate', 'quantity', 'drugImageUrl'] },
                { model: User, as: 'patient', attributes: ['id', 'name', 'email', 'phoneNumber'] },
                { model: Warehouse, as: 'deliveryWarehouse', attributes: ['id', 'name', 'address'] }
            ]
        });

        res.status(200).json({
            message: 'Paid requests retrieved successfully.',
            requests: paidRequests
        });
        console.log('Response sent: Paid requests retrieved successfully.');
    } catch (error) {
        console.error('Error fetching paid requests:', error);
        res.status(500).json({ message: 'Server error fetching paid requests.' });
    }
};

// 7. NEW: Function to approve a request (for admin and employee)
const approveRequest = async (req, res) => {
    console.log('--- Inside approveRequest function ---');

    if (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'employee')) {
        return res.status(403).json({ message: 'Forbidden: Only admins or employees can approve requests.' });
    }

    const { id } = req.params;

    try {
        const request = await Request.findByPk(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Only pending requests can be approved.' });
        }
        
        // Update request status to 'approved'
        request.status = 'approved';
        await request.save();

        res.status(200).json({
            message: 'Request approved successfully.',
            request: request
        });
        console.log('Response sent: Request approved successfully.');

    } catch (error) {
        console.error('Error approving request:', error);
        res.status(500).json({ message: 'Server error approving request.' });
    }
};

// 8. NEW: Function to reject a request (for admin and employee)
const rejectRequest = async (req, res) => {
    console.log('--- Inside rejectRequest function ---');

    if (!req.user || (req.user.userType !== 'admin' && req.user.userType !== 'employee')) {
        return res.status(403).json({ message: 'Forbidden: Only admins or employees can reject requests.' });
    }

    const { id } = req.params;

    try {
        const request = await Request.findByPk(id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found.' });
        }
        if (request.status !== 'pending' && request.status !== 'approved') {
            return res.status(400).json({ message: 'Only pending or approved requests can be rejected.' });
        }
        
        // Update request status to 'rejected'
        request.status = 'rejected';
        await request.save();

        res.status(200).json({
            message: 'Request rejected successfully.',
            request: request
        });
        console.log('Response sent: Request rejected successfully.');

    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ message: 'Server error rejecting request.' });
    }
};

module.exports = {
    chatWithAI,
    createRequest,
    processPayment,
    fulfillRequest,
    getPatientRequests,
    getPendingRequests,
    getPaidRequests,
    approveRequest,
    rejectRequest
};
