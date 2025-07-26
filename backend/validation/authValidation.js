// backend/validation/authValidation.js
        const { z } = require('zod');

        const registerSchema = z.object({
            userType: z.enum(['patient', 'employee', 'admin', 'donor'], {
                message: 'Invalid user type. Must be patient, employee, admin, or donor.'
            }),
            name: z.string().trim().min(3, 'Name must be at least 3 characters long.'),
            phoneNumber: z.string().trim().regex(/^\d{9,15}$/, 'Invalid phone number format. Must be 9-15 digits.'),
            email: z.string().trim().email('Invalid email address format.'),
            password: z.string().min(8, 'Password must be at least 8 characters long.')
                                 .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
                                 .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
                                 .regex(/[0-9]/, 'Password must contain at least one number.')
                                 .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character.'),
        }).refine((data) => {
            return true;
        });

        const loginSchema = z.object({
            email: z.string().trim().email('Invalid email address format.'),
            password: z.string().min(1, 'Password is required for login.')
        });

        module.exports = {
            registerSchema,
            loginSchema
        };
        