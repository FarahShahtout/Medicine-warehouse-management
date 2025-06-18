// backend/controllers/authController.js

const db = require('../models'); 
const User = db.User; 

const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

// دالة لتسجيل المستخدمين
exports.register = async (req, res) => {
    const { userType, name, phoneNumber, email, password, medicalLicense } = req.body;

    try {
     
        if (!userType || !name || !phoneNumber || !!email || !password) {
            return res.status(400).json({ message: 'Please enter all required fields' });
        }

       
        let user = await User.findOne({ where: { email } });
        if (user) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        user = await User.findOne({ where: { phoneNumber } });
        if (user) {
            return res.status(400).json({ message: 'User with this phone number already exists' });
        }

       
        if ((userType === 'employee' || userType === 'donor') && !medicalLicense) {
            return res.status(400).json({ message: 'Medical license is required for employees and donors' });
        }

 
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

   
        user = await User.create({
            userType,
            name,
            phoneNumber,
            email,
            password: hashedPassword,
            medicalLicense: (userType === 'employee' || userType === 'donor') ? medicalLicense : null
        });

     
        const token = jwt.sign({ id: user.id, userType: user.userType }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN 
        });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                userType: user.userType
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};


exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
       
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

        res.json({
            message: 'Logged in successfully',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                userType: user.userType
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during login' });
    }
};


exports.deleteMyAccount = async (req, res) => {
    try {
 
        const userId = req.user.id; 

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await user.destroy();
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during account deletion' });
    }
};


exports.deleteUserById = async (req, res) => {
    try {
        const { id } = req.params; 

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        
        if (req.user && req.user.id === user.id) { 
            return res.status(403).json({ message: 'Admin cannot delete their own account via this endpoint' });
        }

        await user.destroy();
        res.json({ message: `User with ID ${id} deleted successfully` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during user deletion' });
    }
};