import express from 'express';
import { authenticate } from '../middleware/auth';
import { deleteNotification, getNotifications, getUnreadCount, markAllAsRead, markAsRead } from '../controllers/NotificationController';

const router = express.Router();

router.get('/', authenticate, getNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.patch('/:id/read', authenticate, markAsRead);
router.patch('/read-all', authenticate, markAllAsRead);
router.delete('/:id', authenticate, deleteNotification);

export default router;