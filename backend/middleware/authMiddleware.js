
// backend/middlewares/authMiddleware.js

const jwt = require('jsonwebtoken');
const db = require('../models');    
const User = db.User;               


exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findByPk(decoded.id);

        if (!req.user) {
            return res.status(404).json({ message: 'User not found for this token' });
        }

        next();
    } catch (error) {
        console.error(error); 
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};


exports.authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.userType)) {
         
            return res.status(403).json({ message: 'Not authorized to access this route' });
        }
       
        next();
    };
};