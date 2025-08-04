// backend/models/Warehouse.js

module.exports = (sequelize, DataTypes) => {
    const Warehouse = sequelize.define('Warehouse', {
        id: {
            type: DataTypes.UUID, // استخدام UUID كمعرف فريد للمستودع
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true // اسم المستودع يجب أن يكون فريداً
        },
        address: {
            type: DataTypes.STRING,
            allowNull: false
        },
        latitude: { // خط العرض للموقع الجغرافي
            type: DataTypes.DECIMAL(10, 8), // دقة عالية لخط العرض
            allowNull: true
        },
        longitude: { // خط الطول للموقع الجغرافي
            type: DataTypes.DECIMAL(11, 8), // دقة عالية لخط الطول
            allowNull: true
        },
        phoneNumber: {
            type: DataTypes.STRING,
            allowNull: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isEmail: true
            }
        }
    }, {
        timestamps: true // لإنشاء حقلي createdAt و updatedAt تلقائياً
    });

    Warehouse.associate = (models) => {
        // المستودع يمكن أن يحتوي على العديد من طلبات الأدوية التي يتم تسليمها منه
        Warehouse.hasMany(models.Request, {
            foreignKey: 'warehouseId',
            as: 'deliveryRequests'
        });
        // يمكن أيضاً ربط الأدوية بالمستودعات إذا أردتِ تتبع مخزون كل مستودع على حدة
        // Warehouse.hasMany(models.Medicine, {
        //     foreignKey: 'warehouseId',
        //     as: 'medicines'
        // });
    };

    return Warehouse;
};
