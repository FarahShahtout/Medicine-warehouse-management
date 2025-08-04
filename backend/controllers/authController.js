// backend/controllers/authController.js

const db = require('../models');
const User = db.User;

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { registerSchema, loginSchema } = require('../validation/authValidation');
const { isFieldAlreadyExists } = require('../utils/uniqueCheck');
const path = require('path');
const Formidable = require('formidable');
const fs = require('fs');


const register = async (req, res) => {
    console.log('--- Inside register function (using Formidable) ---');

    const form = new Formidable.IncomingForm({
        uploadDir: path.join(__dirname, '../uploads/medicalLicenses'),
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024,
        multiples: false,
        allowEmptyFiles: true,
        minFileSize: 0
    });

    form.parse(req, async (err, fields, files) => {
        console.log('Formidable parse completed.');
        console.log('Formidable Error:', err);
        console.log('Formidable Fields (raw):', fields);
        console.log('Formidable Files:', files);

        if (err) {
            console.error('Formidable parsing error:', err);
            if (err.code === Formidable.errors.biggerThanMaxFileSize) {
                return res.status(400).json({ message: 'File size exceeds the limit (5MB).' });
            }
            // تم تصحيح هذا الشرط لإضافة فحص إضافي
            if (err.code === 1010 && fields.userType && fields.userType.length > 0 && !['employee', 'donor'].includes(fields.userType[0])) {
                console.log('Ignoring empty file error for non-employee/non-donor user type.');
            } else {
                return res.status(400).json({ message: 'Error processing form data: ' + err.message });
            }
        }

        try {
            const userType = fields.userType?.[0];
            const name = fields.name?.[0];
            const phoneNumber = fields.phoneNumber?.[0];
            const email = fields.email?.[0];
            const password = fields.password?.[0];

            const requestBody = {
                userType: userType ? userType.trim() : userType,
                name: name ? name.trim() : name,
                phoneNumber: phoneNumber ? phoneNumber.trim() : phoneNumber,
                email: email ? email.trim() : email,
                password: password ? password.trim() : password
            };
            console.log('Request Body (from Formidable fields - extracted & trimmed vars):', requestBody);

            try {
                registerSchema.parse(requestBody);
                console.log('Zod Schema validation SUCCESSFUL.');
            } catch (zodError) {
                console.error('Zod Schema validation FAILED:', zodError);
                const errorMessage = zodError.errors && zodError.errors.length > 0
                                     ? zodError.errors[0].message
                                     : 'Validation failed with unknown error.';

                if (files.medicalLicenseFile && files.medicalLicenseFile[0]) {
                    fs.unlink(files.medicalLicenseFile[0].filepath, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
                    });
                }
                return res.status(400).json({ message: errorMessage });
            }

            if (await isFieldAlreadyExists('email', email)) {
                console.log('Email already exists:', email);
                if (files.medicalLicenseFile && files.medicalLicenseFile[0]) {
                    fs.unlink(files.medicalLicenseFile[0].filepath, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
                    });
                }
                return res.status(400).json({ message: 'User with this email already exists' });
            }

            if (await isFieldAlreadyExists('phoneNumber', phoneNumber)) {
                console.log('Phone number already exists:', phoneNumber);
                if (files.medicalLicenseFile && files.medicalLicenseFile[0]) {
                    fs.unlink(files.medicalLicenseFile[0].filepath, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting temp file:', unlinkErr);
                    });
                }
                return res.status(400).json({ message: 'User with this phone number already exists' });
            }

            let medicalLicensePath = null;
            const medicalLicenseFile = files.medicalLicenseFile && files.medicalLicenseFile[0];

            if ((userType === 'employee' || userType === 'donor')) {
                if (!medicalLicenseFile || medicalLicenseFile.size === 0) {
                    console.log('Medical license file missing or empty for employee/donor.');
                    return res.status(400).json({ message: 'Medical license file is required for employees and donors.' });
                }
                medicalLicensePath = medicalLicenseFile.filepath;
                console.log('Medical license file path:', medicalLicensePath);
            } else {
                if (medicalLicenseFile && medicalLicenseFile.size > 0) {
                    console.log('Medical license file provided for non-employee/donor user type.');
                    fs.unlink(medicalLicenseFile.filepath, (unlinkErr) => {
                        if (unlinkErr) console.error('Error deleting unnecessary file:', unlinkErr);
                    });
                    return res.status(400).json({ message: 'Medical license file is not allowed for this user type.' });
                }
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            console.log('Password hashed.');

            let userData = {
                userType,
                name,
                phoneNumber,
                email,
                password: hashedPassword,
                medicalLicenseFile: medicalLicensePath
            };

            const user = await User.create(userData);
            console.log('User created in DB:', user.id);

            const token = jwt.sign({ id: user.id, userType: user.userType }, process.env.JWT_SECRET, {
                expiresIn: process.env.JWT_EXPIRES_IN
            });
            console.log('JWT Token generated.');

            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
            });
            console.log('Cookie set.');

            res.status(201).json({
                message: 'User registered successfully',
                user: user
            });
            console.log('Response sent: User registered successfully.');

        } catch (error) {
            console.error('General error in register function:', error);
            if (files.medicalLicenseFile && files.medicalLicenseFile[0]) {
                fs.unlink(files.medicalLicenseFile[0].filepath, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting temp file on general error:', unlinkErr);
                });
            }
            if (error instanceof z.ZodError) {
                return res.status(400).json({ message: error.errors[0].message });
            }
            res.status(500).json({ message: 'Server error during registration' });
        }
    });
};

const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        loginSchema.parse(req.body);

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, userType: user.userType }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN
        });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        });

        res.json({
            message: 'Logged in successfully',
            user: user
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: error.errors[0].message });
        }
        console.error(error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

const deleteUser = async (req, res) => {
    try {
        let userIdToDelete;
        if (req.params.id) {
            userIdToDelete = req.params.id;
        } else if (req.user && req.user.id) {
            userIdToDelete = req.user.id;
        } else {
            return res.status(400).json({ message: 'User ID for deletion is missing.' });
        }

        if (req.user && req.user.userType === 'admin' && req.user.id == userIdToDelete) {
            return res.status(403).json({ message: 'Admin cannot delete their own account via this endpoint.' });
        }

        const user = await User.findByPk(userIdToDelete);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.medicalLicenseFile) {
            const filePath = path.resolve(user.medicalLicenseFile);
            
            fs.unlink(filePath, (err) => {
                if (err) {
                    console.error(`Error deleting medical license file at ${filePath}:`, err);
                } else {
                    
                }
            });
        } else {
           
        }

        await user.destroy();
        res.json({ message: `User with ID ${userIdToDelete} deleted successfully` });

    } catch (error) {
        console.error('Server error during user deletion:', error);
        res.status(500).json({ message: 'Server error during user deletion' });
    }
};

module.exports = {
    register,
    login,
    deleteUser,
};
