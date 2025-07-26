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
        medicalLicenseFile: {
            type: DataTypes.STRING,
            allowNull: true  
        },
    }, {
        timestamps: true 
    });
     User.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());
    delete values.password;
    return values;
};

    return User; 
};