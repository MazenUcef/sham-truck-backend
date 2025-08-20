import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import upload from '../config/multer';
import { changeDriverPassword, deleteDriver, getDriverById, getDrivers, getDriversByVehicleType, updateDriver } from '../controllers/DriverController';

const router = express.Router();


const updateDriverValidation = [
    body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
    body('phoneNumber').optional().notEmpty().withMessage('Phone number cannot be empty'),
    body('vehicleNumber').optional().notEmpty().withMessage('Vehicle number cannot be empty'),
    body('vehicleType').optional().notEmpty().withMessage('Vehicle type cannot be empty'),
];

const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
];



router.get('/vehicle-type/:vehicleTypeId', authenticate, getDriversByVehicleType);
router.get('/:id', authenticate, getDriverById);
router.get('/', authenticate, getDrivers);
router.put('/:id', authenticate, upload.single('photo'), updateDriverValidation, validate, updateDriver);
router.delete('/:id', authenticate, deleteDriver);
router.post('/:id/change-password', authenticate, changePasswordValidation, validate, changeDriverPassword);

export default router;