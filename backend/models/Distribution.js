// backend/models/Distribution.js

module.exports = (sequelize, DataTypes) => {
    const Distribution = sequelize.define('Distribution', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        medicineId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Medicines',
                key: 'id',
            }
        },
        requestedQuantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1
            }
        },
        sourceWarehouseId: { // المستودع الذي سيتم النقل منه
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Warehouses',
                key: 'id',
            }
        },
        destinationWarehouseId: { // المستودع الذي سيتم النقل إليه
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Warehouses',
                key: 'id',
            }
        },
        requestedById: { // الموظف أو المدير الذي طلب النقل
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Users',
                key: 'id',
            }
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected', 'completed'), // حالات طلب النقل
            allowNull: false,
            defaultValue: 'pending'
        },
        approvalById: { // المدير الذي وافق على طلب النقل
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'Users',
                key: 'id',
            }
        },
        rejectionReason: { // سبب الرفض (إذا تم رفض الطلب)
            type: DataTypes.STRING,
            allowNull: true
        },
        transferDate: { // تاريخ إتمام عملية النقل
            type: DataTypes.DATEONLY,
            allowNull: true
        }
    }, {
        timestamps: true
    });

    Distribution.associate = (models) => {
        Distribution.belongsTo(models.Medicine, {
            foreignKey: 'medicineId',
            as: 'medicine'
        });
        Distribution.belongsTo(models.Warehouse, {
            foreignKey: 'sourceWarehouseId',
            as: 'sourceWarehouse'
        });
        Distribution.belongsTo(models.Warehouse, {
            foreignKey: 'destinationWarehouseId',
            as: 'destinationWarehouse'
        });
        Distribution.belongsTo(models.User, {
            foreignKey: 'requestedById',
            as: 'requestedBy'
        });
        Distribution.belongsTo(models.User, {
            foreignKey: 'approvalById',
            as: 'approvedBy'
        });
    };

    return Distribution;
};
