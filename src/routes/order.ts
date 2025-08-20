import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { createOrder, deleteOrder, getOrderById, getOrders, getUserOrders, updateOrder } from '../controllers/OrderController';
import mongoose from 'mongoose';

const router = express.Router();

const orderValidation = [
    body('from_location').notEmpty().withMessage('From location is required'),
    body('to_location').notEmpty().withMessage('To location is required'),
    body('vehicle_type')
        .notEmpty().withMessage('Vehicle type is required')
        .custom((value) => mongoose.Types.ObjectId.isValid(value)).withMessage('Invalid vehicle type ID'),
    body('weight_or_volume').notEmpty().withMessage('Weight or volume is required'),
    body('date_time_transport').isISO8601().withMessage('Valid date is required'),
    body('loading_time').notEmpty().withMessage('Loading time is required'),
];

router.post('/', authenticate, orderValidation, validate, createOrder);
router.get('/', authenticate, getOrders);
router.get('/user', authenticate, getUserOrders);
router.get('/:id', authenticate, getOrderById);
router.put('/:id', authenticate, updateOrder);
router.delete('/:id', authenticate, deleteOrder);

export default router;