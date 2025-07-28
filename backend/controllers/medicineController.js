// backend/controllers/medicineController.js

const db = require('../models');
const Medicine = db.Medicine;
const User = db.User;
const { z } = require('zod');
const axios = require('axios');


const medicineSchema = z.object({
    name: z.string().min(1, "Medicine name is required."),
    description: z.string().optional(),
    expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expiry date must be in YYYY-MM-DD format."),
    quantity: z.number().int().min(1, "Quantity must be an integer and greater than zero."),
});


const donateMedicine = async (req, res) => {
    console.log('--- Inside donateMedicine function ---');

    if (!req.user || (req.user.userType !== 'donor' && req.user.userType !== 'admin')) {
        return res.status(403).json({ message: 'Forbidden: Only donors or admins can donate medicine.' });
    }

    try {
        const validatedData = medicineSchema.parse(req.body);
        console.log('User-provided medicine data validation SUCCESSFUL.');

        const drugName = validatedData.name;
        let externalDrugInfo = {};
        let rxcui = null;

        // --- First API Call: RxNorm ---
        try {
            const rxNormSearchUrl = `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drugName)}`;
            console.log('Calling RxNorm API (search):', rxNormSearchUrl);
            const rxNormResponse = await axios.get(rxNormSearchUrl);

            if (rxNormResponse.status === 200) {
                const rxNormData = rxNormResponse.data;
                if (rxNormData.idGroup && rxNormData.idGroup.rxnormId && rxNormData.idGroup.rxnormId.length > 0) {
                    rxcui = rxNormData.idGroup.rxnormId[0];
                    const rxNormPropertyUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/property.json?propName=Active%20Ingredient`;
                    const rxNormPropertyResponse = await axios.get(rxNormPropertyUrl);
                    if (rxNormPropertyResponse.status === 200) {
                        const rxNormPropertyData = rxNormPropertyResponse.data;
                        if (rxNormPropertyData.propConceptGroup && rxNormPropertyData.propConceptGroup.propConcept) {
                            const activeIngredientsArray = rxNormPropertyData.propConceptGroup.propConcept.map(pc => pc.propValue);
                            if (activeIngredientsArray.length > 0) {
                                externalDrugInfo.activeIngredients = activeIngredientsArray.join('; ');
                            }
                        }
                    }
                }
            }
        } catch (apiError) {
            console.error('Error calling RxNorm API:', apiError.message);
        }

        // --- Second API Call: OpenFDA ---
        try {
            const openFdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}" OR openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`;
            console.log('Calling OpenFDA API:', openFdaUrl);

            const openFdaResponse = await axios.get(openFdaUrl);
            if (openFdaResponse.status === 200) {
                const openFdaData = openFdaResponse.data;
                if (openFdaData.results && openFdaData.results.length > 0) {
                    const result = openFdaData.results[0];
                    externalDrugInfo.scientificName = result.openfda?.generic_name ? result.openfda.generic_name[0] : null;

                    if (!externalDrugInfo.activeIngredients && result.active_ingredient) {
                        externalDrugInfo.activeIngredients = result.active_ingredient.join('; ');
                    }

                    externalDrugInfo.drugUses = result.indications_and_usage ? result.indications_and_usage.join('; ') : null;
                    externalDrugInfo.sideEffects = result.warnings ? result.warnings.join('; ') : null;

                    if (result.image && result.image.length > 0) {
                        externalDrugInfo.drugImageUrl = result.image[0];
                    } else if (result.openfda && result.openfda.product_image && result.openfda.product_image.length > 0) {
                        externalDrugInfo.drugImageUrl = result.openfda.product_image[0];
                    } else {
                        externalDrugInfo.drugImageUrl = null;
                    }

                    externalDrugInfo.description = result.description ? result.description.join('; ') :
                                                   result.purpose ? result.purpose.join('; ') :
                                                   result.indications_and_usage ? result.indications_and_usage.join('; ') :
                                                   null;

                    const MAX_TEXT_LENGTH = 65535;
                    for (const key of ['activeIngredients', 'drugUses', 'sideEffects', 'description']) {
                        if (externalDrugInfo[key] && externalDrugInfo[key].length > MAX_TEXT_LENGTH) {
                            externalDrugInfo[key] = externalDrugInfo[key].substring(0, MAX_TEXT_LENGTH);
                        }
                    }
                }
            }
        } catch (apiError) {
            console.error('Error calling OpenFDA API:', apiError.message);
        }

        // Merge user-provided data with external API data
        const finalMedicineData = {
            ...validatedData,
            donorId: req.user.id,
            description: externalDrugInfo.description || validatedData.description,
            scientificName: externalDrugInfo.scientificName,
            activeIngredients: externalDrugInfo.activeIngredients,
            drugUses: externalDrugInfo.drugUses,
            sideEffects: externalDrugInfo.sideEffects,
            drugImageUrl: externalDrugInfo.drugImageUrl,
            status: 'pending' 
        };

        const medicine = await Medicine.create(finalMedicineData);
        console.log('Medicine added to DB:', medicine.id);

        res.status(201).json({
            message: 'Medicine donated successfully, awaiting admin approval.',
            medicine: medicine
        });
        console.log('Response sent: Medicine donated successfully, awaiting admin approval.');

    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Medicine data validation FAILED:', error.errors);
            return res.status(400).json({ message: error.errors[0].message });
        }
        console.error('General error in donateMedicine function:', error);
        res.status(500).json({ message: 'Server error during medicine donation' });
    }
};

// New function: Get all pending donations (for Admin)
const getPendingDonations = async (req, res) => {
    try {
        const pendingMedicines = await Medicine.findAll({
            where: { status: 'pending' },
            include: [{ model: User, as: 'donor', attributes: ['id', 'name', 'email', 'phoneNumber'] }]
        });
        res.status(200).json({
            message: 'Pending donations retrieved successfully.',
            medicines: pendingMedicines
        });
    } catch (error) {
        console.error('Error fetching pending donations:', error);
        res.status(500).json({ message: 'Server error fetching pending donations.' });
    }
};

// New function: Approve a donation (for Admin)
const approveDonation = async (req, res) => {
    const { id } = req.params; 

    try {
        const medicine = await Medicine.findByPk(id);

        if (!medicine) {
            return res.status(404).json({ message: 'Medicine not found.' });
        }

        if (medicine.status !== 'pending') {
            return res.status(400).json({ message: 'Medicine is not in pending status and cannot be approved.' });
        }

        medicine.status = 'approved';
        await medicine.save();

        res.status(200).json({
            message: 'Donation approved successfully.',
            medicine: medicine
        });
    } catch (error) {
        console.error('Error approving donation:', error);
        res.status(500).json({ message: 'Server error approving donation.' });
    }
};

// New function: Reject a donation (for Admin)
const rejectDonation = async (req, res) => {
    const { id } = req.params; 

    try {
        const medicine = await Medicine.findByPk(id);

        if (!medicine) {
            return res.status(404).json({ message: 'Medicine not found.' });
        }

        if (medicine.status !== 'pending') {
            return res.status(400).json({ message: 'Medicine is not in pending status and cannot be rejected.' });
        }

        medicine.status = 'rejected';
        await medicine.save();

        res.status(200).json({
            message: 'Donation rejected successfully.',
            medicine: medicine
        });
    } catch (error) {
        console.error('Error rejecting donation:', error);
        res.status(500).json({ message: 'Server error rejecting donation.' });
    }
};

module.exports = {
    donateMedicine,
    getPendingDonations,
    approveDonation,
    rejectDonation
};
