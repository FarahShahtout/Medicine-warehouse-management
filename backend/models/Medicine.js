// backend/models/Medicine.js

module.exports = (sequelize, DataTypes) => {
    const Medicine = sequelize.define('Medicine', {
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
        description: {
            type: DataTypes.TEXT, 
            allowNull: true
        },
        expiryDate: {
            type: DataTypes.DATEONLY, 
            allowNull: false
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1 
            }
        },
       
        scientificName: { 
            type: DataTypes.STRING,
            allowNull: true
        },
        activeIngredients: { 
            type: DataTypes.TEXT,
            allowNull: true
        },
        drugUses: { 
            type: DataTypes.TEXT,
            allowNull: true
        },
        sideEffects: { 
            type: DataTypes.TEXT,
            allowNull: true
        },
        drugImageUrl: { 
            type: DataTypes.STRING,
            allowNull: true
        },
        
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected'),
            allowNull: false,
            defaultValue: 'pending' 
        }
    }, {
        timestamps: true 
    });

    // Define the relationship: A medicine belongs to one donor (User)
    Medicine.associate = (models) => {
        Medicine.belongsTo(models.User, {
            foreignKey: 'donorId', 
            as: 'donor', 
            onDelete: 'SET NULL' 
        });
    };

    return Medicine;
};