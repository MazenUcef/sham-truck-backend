import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import Driver, { IDriver } from '../models/Driver';
import Vehicle from '../models/Vehicle';
import { generateToken } from '../utils/token';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import User from '../models/Router';
import mongoose from 'mongoose';

interface UserSignupData {
    fullName: string;
    email: string;
    password: string;
    phoneNumber: string;
}

interface DriverSignupData extends UserSignupData {
    vehicleNumber: string;
    vehicleTypeId: string;
}

interface UserUpdateData {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
}

interface DriverUpdateData extends UserUpdateData {
    vehicleNumber?: string;
    vehicleTypeId?: string;
}

interface LoginData {
    email: string;
    password: string;
    role: 'router' | 'driver';
}

interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: string;
        fullName: string;
    };
}

export const validateDriverSignup = [
    body('fullName').trim().notEmpty().withMessage('الاسم الكامل مطلوب'),
    body('email').isEmail().normalizeEmail().withMessage('عنوان البريد الإلكتروني غير صالح'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('يجب أن تكون كلمة المرور 6 أحرف على الأقل'),
    body('phoneNumber')
        .trim().notEmpty().withMessage('رقم الهاتف مطلوب'),
    body('vehicleNumber').trim().notEmpty().withMessage('رقم المركبة مطلوب'),
    body('vehicleTypeId').isMongoId().withMessage('معرف نوع المركبة غير صالح'),
];

export const validateUserUpdate = [
    body('fullName').optional().trim().notEmpty().withMessage('لا يمكن أن يكون الاسم الكامل فارغًا'),
    body('email').optional().isEmail().normalizeEmail().withMessage('عنوان البريد الإلكتروني غير صالح'),
    body('phoneNumber')
        .trim().notEmpty().withMessage('رقم الهاتف مطلوب'),
];

export const validateDriverUpdate = [
    body('fullName').optional().trim().notEmpty().withMessage('لا يمكن أن يكون الاسم الكامل فارغًا'),
    body('email').optional().isEmail().normalizeEmail().withMessage('عنوان البريد الإلكتروني غير صالح'),
    body('phoneNumber')
        .trim().notEmpty().withMessage('رقم الهاتف مطلوب'),
    body('vehicleNumber').optional().trim().notEmpty().withMessage('لا يمكن أن يكون رقم المركبة فارغًا'),
    body('vehicleTypeId').optional().isMongoId().withMessage('معرف نوع المركبة غير صالح'),
];

export const signupUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { fullName, email, password, phoneNumber }: UserSignupData = req.body;

        const existingUser = await User.findOne({
            $or: [{ email }, { phoneNumber }]
        });

        if (existingUser) {
            res.status(400).json({
                message: 'المستخدم موجود بالفعل مع هذا البريد الإلكتروني أو رقم الهاتف'
            });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            fullName,
            email,
            password: hashedPassword,
            phoneNumber
        });

        const token = generateToken({
            id: user._id.toString(),
            role: 'router',
            fullName: user.fullName
        });

        res.status(201).json({
            message: 'تم إنشاء المستخدم بنجاح',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: "router"
            }
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'خطأ في إنشاء المستخدم',
            error: error.message
        });
    }
};

export const signupDriver = async (req: Request, res: Response): Promise<void> => {
    let photoPublicId = '';
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { fullName, email, password, phoneNumber, vehicleNumber, vehicleTypeId }: DriverSignupData = req.body;

        const existingUser = await User.findOne({
            $or: [{ email }, { phoneNumber }],
        });
        const existingDriver = await Driver.findOne({
            $or: [{ email }, { phoneNumber }, { vehicleNumber }],
        });

        if (existingUser || existingDriver) {
            res.status(400).json({ errors: [{ msg: 'البريد الإلكتروني أو رقم الهاتف أو رقم المركبة موجود بالفعل', path: 'email or phoneNumber or vehicleNumber' }] });
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
            res.status(400).json({ errors: [{ msg: 'معرف نوع المركبة غير صالح', path: 'vehicleTypeId', value: vehicleTypeId }] });
            return;
        }

        const vehicleType = await Vehicle.findById(vehicleTypeId);
        if (!vehicleType) {
            res.status(400).json({ errors: [{ msg: 'نوع المركبة غير موجود', path: 'vehicleTypeId' }] });
            return;
        }

        let photo = '';
        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file);
                photo = uploadResult.secure_url;
                photoPublicId = uploadResult.public_id;
            } catch (uploadError) {
                console.error('Cloudinary upload error:', uploadError);
                res.status(500).json({ errors: [{ msg: 'فشل في رفع الصورة' }] });
                return;
            }
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const driver = await Driver.create({
            fullName,
            email,
            password: hashedPassword,
            phoneNumber,
            vehicleNumber,
            vehicleType: vehicleTypeId,
            photo,
            photoPublicId,
        });

        const token = generateToken({
            id: driver._id.toString(),
            role: 'driver',
            fullName: driver.fullName,
        });

        res.status(201).json({
            message: 'تم إنشاء السائق بنجاح',
            token,
            driver: {
                id: driver._id,
                fullName: driver.fullName,
                email: driver.email,
                phoneNumber: driver.phoneNumber,
                vehicleNumber: driver.vehicleNumber,
                vehicleTypeId,
                photo: driver.photo,
                role: 'driver',
            },
        });
    } catch (error: any) {
        console.error('Driver signup error:', error);
        if (photoPublicId) {
            try {
                await deleteFromCloudinary(photoPublicId);
            } catch (deleteError) {
                console.error('Error cleaning up Cloudinary image:', deleteError);
            }
        }
        res.status(500).json({
            errors: [{ msg: 'خطأ في إنشاء السائق', error: error.message }],
        });
    }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'غير مصرح: يمكن للراوتر فقط تحديث ملفهم الشخصي' });
            return;
        }

        const { fullName, email, phoneNumber }: UserUpdateData = req.body;

        const updateData: UserUpdateData = {};
        if (fullName) updateData.fullName = fullName;
        if (email) updateData.email = email;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;

        if (email || phoneNumber) {
            const existingUser = await User.findOne({
                $or: [
                    ...(email ? [{ email, _id: { $ne: id } }] : []),
                    ...(phoneNumber ? [{ phoneNumber, _id: { $ne: id } }] : []),
                ],
            });
            if (existingUser) {
                res.status(400).json({ message: 'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل' });
                return;
            }
        }

        const user = await User.findByIdAndUpdate(id, updateData, { new: true });
        if (!user) {
            res.status(404).json({ message: 'المستخدم غير موجود' });
            return;
        }

        res.json({
            message: 'تم تحديث المستخدم بنجاح',
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: 'router'
            }
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'خطأ في تحديث المستخدم',
            error: error.message
        });
    }
};

export const updateDriver = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    let photoPublicId = '';
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { id, role } = req.user!;
        if (role !== 'driver') {
            res.status(403).json({ message: 'غير مصرح: يمكن للسائقين فقط تحديث ملفهم الشخصي' });
            return;
        }

        const { fullName, email, phoneNumber, vehicleNumber, vehicleTypeId }: DriverUpdateData = req.body;

        const updateData: any = {};
        if (fullName) updateData.fullName = fullName;
        if (email) updateData.email = email;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;
        if (vehicleNumber) updateData.vehicleNumber = vehicleNumber;
        if (vehicleTypeId) {
            if (!mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
                res.status(400).json({ message: 'معرف نوع المركبة غير صالح' });
                return;
            }

            const vehicleType = await Vehicle.findById(vehicleTypeId);
            if (!vehicleType) {
                res.status(400).json({ message: 'نوع المركبة غير موجود' });
                return;
            }

            updateData.vehicleType = vehicleTypeId;
        }

        if (email || phoneNumber || vehicleNumber) {
            const existingUser = await User.findOne({
                $or: [
                    ...(email ? [{ email }] : []),
                    ...(phoneNumber ? [{ phoneNumber }] : []),
                    ...(vehicleNumber ? [{ vehicleNumber }] : []),
                ],
            });
            const existingDriver = await Driver.findOne({
                $or: [
                    ...(email ? [{ email, _id: { $ne: id } }] : []),
                    ...(phoneNumber ? [{ phoneNumber, _id: { $ne: id } }] : []),
                    ...(vehicleNumber ? [{ vehicleNumber, _id: { $ne: id } }] : []),
                ],
            });
            if (existingUser || existingDriver) {
                res.status(400).json({ message: 'البريد الإلكتروني أو رقم الهاتف أو رقم المركبة مستخدم بالفعل' });
                return;
            }
        }

        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file);
                updateData.photo = uploadResult.secure_url;
                photoPublicId = uploadResult.public_id;
                updateData.photoPublicId = photoPublicId;
            } catch (uploadError) {
                console.error('Cloudinary upload error:', uploadError);
                res.status(500).json({ message: 'فشل في رفع الصورة' });
                return;
            }
        }

        const driver = await Driver.findById(id);
        if (!driver) {
            if (photoPublicId) {
                try {
                    await deleteFromCloudinary(photoPublicId);
                } catch (deleteError) {
                    console.error('Error cleaning up new Cloudinary image:', deleteError);
                }
            }
            res.status(404).json({ message: 'السائق غير موجود' });
            return;
        }

        if (req.file && driver.photoPublicId) {
            try {
                await deleteFromCloudinary(driver.photoPublicId);
            } catch (deleteError) {
                console.error('Error cleaning up old Cloudinary image:', deleteError);
            }
        }

        const updatedDriver = await Driver.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedDriver) {
            if (photoPublicId) {
                try {
                    await deleteFromCloudinary(photoPublicId);
                } catch (deleteError) {
                    console.error('Error cleaning up new Cloudinary image:', deleteError);
                }
            }
            res.status(404).json({ message: 'السائق غير موجود' });
            return;
        }

        res.json({
            message: 'تم تحديث السائق بنجاح',
            driver: {
                id: updatedDriver._id,
                fullName: updatedDriver.fullName,
                email: updatedDriver.email,
                phoneNumber: updatedDriver.phoneNumber,
                vehicleNumber: updatedDriver.vehicleNumber,
                vehicleType: updatedDriver.vehicleType,
                photo: updatedDriver.photo,
                role: 'driver'
            }
        });
    } catch (error: any) {
        console.error('Driver update error:', error);
        if (photoPublicId) {
            try {
                await deleteFromCloudinary(photoPublicId);
            } catch (deleteError) {
                console.error('Error cleaning up Cloudinary image:', deleteError);
            }
        }
        res.status(500).json({
            message: 'خطأ في تحديث السائق',
            error: error.message
        });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { email, password, role }: LoginData = req.body;

        let user;
        if (role === 'router') {
            user = await User.findOne({ email });
        } else if (role === 'driver') {
            user = await Driver.findOne({ email });
        } else {
            res.status(400).json({ message: 'الدور المحدد غير صالح' });
            return;
        }

        if (!user) {
            res.status(404).json({ message: 'المستخدم غير موجود' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'بيانات الاعتماد غير صالحة' });
            return;
        }

        const token = generateToken({
            id: user._id.toString(),
            role,
            fullName: user.fullName
        });

        if (role === 'router') {
            res.json({
                message: 'تسجيل الدخول ناجح',
                token,
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    role
                }
            });
        } else {
            const driver = user as IDriver;
            res.json({
                message: 'تسجيل الدخول ناجح',
                token,
                user: {
                    id: driver._id,
                    fullName: driver.fullName,
                    email: driver.email,
                    phoneNumber: driver.phoneNumber,
                    vehicleNumber: driver.vehicleNumber,
                    vehicleType: driver.vehicleType,
                    photo: driver.photo,
                    role
                }
            });
        }
    } catch (error: any) {
        res.status(500).json({
            message: 'خطأ أثناء تسجيل الدخول',
            error: error.message
        });
    }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { currentPassword, newPassword }: ChangePasswordData = req.body;
        const { id, role } = req.user!;

        let user;
        if (role === 'router') {
            user = await User.findById(id);
        } else {
            user = await Driver.findById(id);
        }

        if (!user) {
            res.status(404).json({ message: 'المستخدم غير موجود' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'كلمة المرور الحالية غير صحيحة' });
            return;
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        res.json({ message: 'تم تحديث كلمة المرور بنجاح' });
    } catch (error: any) {
        res.status(500).json({
            message: 'خطأ في تغيير كلمة المرور',
            error: error.message
        });
    }
};

export const getUserById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'غير مصرح: يمكن للراوتر فقط الوصول إلى ملفهم الشخصي' });
            return;
        }

        const user = await User.findById(id).select('-password');
        if (!user) {
            res.status(404).json({ message: 'المستخدم غير موجود' });
            return;
        }

        res.json({
            message: 'تم استرجاع المستخدم بنجاح',
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: 'router'
            }
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'خطأ في استرجاع المستخدم',
            error: error.message
        });
    }
};

export const getDriverById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'driver') {
            res.status(403).json({ message: 'غير مصرح: يمكن للسائقين فقط الوصول إلى ملفهم الشخصي' });
            return;
        }

        const driver = await Driver.findById(id).populate('vehicleType').select('-password');

        if (!driver) {
            res.status(404).json({ message: 'السائق غير موجود' });
            return;
        }

        res.json({
            message: 'تم استرجاع السائق بنجاح',
            driver: {
                id: driver._id,
                fullName: driver.fullName,
                email: driver.email,
                phoneNumber: driver.phoneNumber,
                vehicleNumber: driver.vehicleNumber,
                vehicleType: driver.vehicleType,
                vehicleTypeId: driver.vehicleType,
                photo: driver.photo,
                role: 'driver'
            }
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'خطأ في استرجاع السائق',
            error: error.message
        });
    }
};

export const getUserGeneralById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.params;

        if (!role) {
            res.status(400).json({ message: 'الدور مطلوب' });
            return;
        }

        if (role === 'router') {
            const user = await User.findById(id).select('-password');
            if (!user) {
                res.status(404).json({ message: 'المستخدم غير موجود' });
                return;
            }

            res.json({
                message: 'تم استرجاع المستخدم بنجاح',
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    role: 'router'
                }
            });
        } else if (role === 'driver') {
            const driver = await Driver.findById(id).populate('vehicleType').select('-password');
            if (!driver) {
                res.status(404).json({ message: 'السائق غير موجود' });
                return;
            }

            res.json({
                message: 'تم استرجاع السائق بنجاح',
                user: {
                    id: driver._id,
                    fullName: driver.fullName,
                    email: driver.email,
                    phoneNumber: driver.phoneNumber,
                    vehicleNumber: driver.vehicleNumber,
                    vehicleType: driver.vehicleType,
                    vehicleTypeId: driver.vehicleType,
                    photo: driver.photo,
                    role: 'driver'
                }
            });
        } else {
            res.status(400).json({ message: 'الدور المحدد غير صالح' });
        }
    } catch (error: any) {
        res.status(500).json({
            message: 'خطأ في استرجاع المستخدم',
            error: error.message
        });
    }
};