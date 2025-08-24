import express from 'express';
import { body, query } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { changeUserPassword, deleteUser, getUserById, getUsers, updateUser } from '../controllers/UserController';

const router = express.Router();


const updateUserValidation = [
    body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
    body('phoneNumber').optional().notEmpty().withMessage('Phone number cannot be empty'),
];

const getUserByIdValidation = [
    query('role').optional().isIn(['user', 'driver']).withMessage('Role must be either "user" or "driver"'),
];

const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
    body('role').optional().isIn(['user', 'driver']).withMessage('Role must be either "user" or "driver"'),
];



router.get('/:id', authenticate, getUserByIdValidation, validate, getUserById);
router.get('/', authenticate, getUsers);

router.put('/:id', authenticate, updateUserValidation, validate, updateUser);
router.delete('/:id', authenticate, deleteUser);
router.post('/:id/change-password', authenticate, changePasswordValidation, validate, changeUserPassword);

export default router;