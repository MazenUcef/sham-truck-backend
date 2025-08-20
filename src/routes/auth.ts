import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
import upload from '../config/multer';
import { signIn, signUpDriver, signUpUser } from '../controllers/AuthController';

const router = express.Router();

const userSignupValidation = [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('phoneNumber').notEmpty().withMessage('Phone number is required'),
];

const driverSignupValidation = [
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('phoneNumber').notEmpty().withMessage('Phone number is required'),
    body('vehicleNumber').notEmpty().withMessage('Vehicle number is required'),
    body('vehicleType').notEmpty().withMessage('Vehicle type is required'),
];

const signinValidation = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('role').isIn(['user', 'driver']).withMessage('Role must be either user or driver'),
];

router.post('/signup/user', userSignupValidation, validate, signUpUser);
router.post('/signup/driver', upload.single('photo'), driverSignupValidation, validate, signUpDriver);
router.post('/signin', signinValidation, validate, signIn);

export default router;