          // backend/utils/uniqueCheck.js
        const db = require('../models');
        const User = db.User;

        const isFieldAlreadyExists = async (fieldName, value) => {
            const query = {};
            query[fieldName] = value;
            const user = await User.findOne({ where: query });
            return !!user;
        };

        module.exports = {
            isFieldAlreadyExists
        };
        
        