import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { acceptOffer, createOffer, getDriverOffers, getOrderOffers, validateOfferCreate } from '../controllers/OfferController';

const router = Router();

router.post('/create', authenticate, validateOfferCreate, createOffer);
router.get('/driver/me', authenticate, getDriverOffers);
router.get('/order/:id', authenticate, getOrderOffers);
router.put('/accept/:id', authenticate, acceptOffer);

export default router;