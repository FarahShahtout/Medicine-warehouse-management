// backend/models/User.js

module.exports = (sequelize, DataTypes) => { 
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        phoneNumber: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true 
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        userType: { 
            type: DataTypes.ENUM('admin', 'employee', 'donor', 'patient'),
            allowNull: false
        },
        medicalLicense: {
            type: DataTypes.STRING,
            allowNull: true  
        },
    }, {
        timestamps: true 
    });


    return User; 
};