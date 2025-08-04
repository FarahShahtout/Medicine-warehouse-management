// backend/models/Request.js

module.exports = (sequelize, DataTypes) => {
    const Request = sequelize.define('Request', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            allowNull: false
        },
        medicineId: {
            type: DataTypes.UUID, // يجب أن يتطابق مع نوع ID في Medicine
            allowNull: false,
            references: {
                model: 'Medicines', // اسم الجدول الذي يشير إليه
                key: 'id',
            }
        },
        patientId: {
            type: DataTypes.UUID, // يجب أن يتطابق مع نوع ID في User
            allowNull: false,
            references: {
                model: 'Users', // اسم الجدول الذي يشير إليه
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
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected', 'paid', 'fulfilled'), // إضافة 'paid' و 'fulfilled'
            allowNull: false,
            defaultValue: 'pending'
        },
        rejectionReason: { // سبب الرفض (إذا تم رفض الطلب)
            type: DataTypes.STRING,
            allowNull: true
        },
        // --- حقول جديدة ---
        deliveryAddress: { // عنوان التسليم الذي يحدده المريض
            type: DataTypes.STRING,
            allowNull: true // يمكن أن يكون null في البداية إذا كان الطلب يتم عبر الدردشة ثم يتم تأكيده لاحقاً
        },
        warehouseId: { // المستودع الذي سيتم التسليم منه (يتم تحديده بناءً على العنوان)
            type: DataTypes.UUID, // يجب أن يتطابق مع نوع ID في Warehouse
            allowNull: true, // يمكن أن يكون null في البداية
            references: {
                model: 'Warehouses', // اسم الجدول الذي يشير إليه
                key: 'id',
            }
        },
        paymentStatus: { // حالة الدفع
            type: DataTypes.ENUM('pending', 'paid', 'failed'), // معلق، مدفوع، فشل
            allowNull: false,
            defaultValue: 'pending'
        },
        totalPrice: { // السعر الإجمالي للطلب
            type: DataTypes.DECIMAL(10, 2), // رقم عشري بدقة 10 أرقام، 2 منها بعد الفاصلة
            allowNull: true // يمكن أن يكون null في البداية ويتم تحديده بعد تأكيد السعر
        },
        deliveryDate: { // تاريخ التسليم المتوقع
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        deliveryTimeSlot: { // فترة زمنية للتسليم (مثال: 9-12 صباحاً)
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        timestamps: true
    });

    Request.associate = (models) => {
        // الطلب ينتمي إلى دواء واحد
        Request.belongsTo(models.Medicine, {
            foreignKey: 'medicineId',
            as: 'medicine'
        });
        // الطلب ينتمي إلى مريض واحد (مستخدم)
        Request.belongsTo(models.User, {
            foreignKey: 'patientId',
            as: 'patient'
        });
        // الطلب ينتمي إلى مستودع واحد (المستودع الذي سيتم التسليم منه)
        Request.belongsTo(models.Warehouse, {
            foreignKey: 'warehouseId',
            as: 'deliveryWarehouse'
        });
    };

    return Request;
};
