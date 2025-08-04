// backend/models/AIInteractionLog.js

module.exports = (sequelize, DataTypes) => {
    const AIInteractionLog = sequelize.define('AIInteractionLog', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        patientId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            }
        },
        queryText: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        aiResponseText: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        medicineId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'Medicines',
                key: 'id',
            }
        },
        interactionType: {
            type: DataTypes.ENUM('medicine_inquiry', 'general_health_question', 'alternative_suggestion'),
            allowNull: false
        },
        success: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
    }, {
        timestamps: true
    });

    AIInteractionLog.associate = (models) => {
        AIInteractionLog.belongsTo(models.User, {
            foreignKey: 'patientId',
            as: 'patient'
        });
        AIInteractionLog.belongsTo(models.Medicine, {
            foreignKey: 'medicineId',
            as: 'medicine'
        });
    };

    return AIInteractionLog;
};