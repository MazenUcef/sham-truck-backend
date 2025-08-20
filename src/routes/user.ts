import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { changeUserPassword, deleteUser, getUserById, getUsers, updateUser } from '../controllers/UserController';

const router = express.Router();


const updateUserValidation = [
    body('fullName').optional().notEmpty().withMessage('Full name cannot be empty'),
    body('phoneNumber').optional().notEmpty().withMessage('Phone number cannot be empty'),
];

const changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long'),
];



router.get('/:id', authenticate, getUserById);
router.get('/', authenticate, getUsers);

router.put('/:id', authenticate, updateUserValidation, validate, updateUser);
router.delete('/:id', authenticate, deleteUser);
router.post('/:id/change-password', authenticate, changePasswordValidation, validate, changeUserPassword);

export default router;