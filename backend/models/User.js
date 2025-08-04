// backend/models/User.js

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.UUID, 
            defaultValue: DataTypes.UUIDV4, 
            primaryKey: true,
            allowNull: false
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

    User.associate = (models) => {
        User.hasMany(models.Medicine, {
            foreignKey: 'donorId',
            as: 'donatedMedicines'
        });
        User.hasMany(models.Request, { 
            foreignKey: 'patientId',
            as: 'requests'
        });
    };

    return User;
};

