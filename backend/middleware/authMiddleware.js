// backend/middlewares/authMiddleware.js

const jwt = require('jsonwebtoken');


const authenticate = (req, res, next) => { 
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token && req.cookies && req.cookies.token) { 
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = {
            id: decoded.id,
            userType: decoded.userType
        };

        next();
    } catch (error) {
        console.error(error);
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.userType || !allowedRoles.includes(req.user.userType)) {
            return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
        }
        next();
    };
};

module.exports = {
    authenticate,
    authorize
};