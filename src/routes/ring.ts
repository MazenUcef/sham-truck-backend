import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { getRingHistory, sendRing } from '../controllers/RingController';

const router = express.Router();

const ringValidation = [
  body('order_id').notEmpty().withMessage('Order ID is required'),
  body('message').optional().isLength({ max: 500 }).withMessage('Message too long'),
];

router.post('/', authenticate, ringValidation, validate, sendRing);
router.get('/', authenticate, getRingHistory);

export default router;