import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { createOrder, getDriverOrders, getOrderById, getRouterOrders, validateOrderCreate } from '../controllers/OrderController';

const router = Router();

router.post('/create', authenticate, validateOrderCreate, createOrder);
router.get('/router/me', authenticate, getRouterOrders);
router.get('/:id', authenticate, getOrderById);
router.get('/driver/me', authenticate, getDriverOrders);

export default router;