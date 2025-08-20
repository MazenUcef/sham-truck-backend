import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate, authorize } from '../middleware/auth';
import { acceptOffer, createOffer, getDriverOffers, getOfferById, getOffers, getOrderOffers, rejectOffer, updateOffer } from '../controllers/OfferController';

const router = express.Router();

const offerValidation = [
  body('order_id').notEmpty().withMessage('Order ID is required'),
  body('price').isNumeric().withMessage('Valid price is required'),
];


router.post('/', authenticate, authorize(['driver']), offerValidation, validate, createOffer);


router.get('/', authenticate, getOffers);
router.get('/driver', authenticate, authorize(['driver']), getDriverOffers);
router.get('/order/:orderId', authenticate, getOrderOffers);
router.get('/:id', authenticate, getOfferById);


router.put('/:id', authenticate, authorize(['driver']), updateOffer);


router.post('/:id/accept', authenticate, authorize(['user']), acceptOffer);
router.post('/:id/reject', authenticate, authorize(['user']), rejectOffer);

export default router;