import { Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../types';

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    console.log('Request query parameters:', { page, limit, unreadOnly });
    console.log('User:', req.user);

    const query: any = {};
    if (req.user?.role === 'router') {
      query.user_id = req.user.id;
      console.log('Querying for router notifications with user_id:', req.user.id);
    } else if (req.user?.role === 'driver') {
      query.driver_id = req.user.id;
      console.log('Querying for driver notifications with driver_id:', req.user.id);
    } else {
      console.log('Invalid user role:', req.user?.role);
      res.status(403).json({ message: 'غير مصرح: دور المستخدم غير صالح' });
      return;
    }

    if (unreadOnly === 'true') {
      query.is_read = false;
      console.log('Filtering for unread notifications only');
    }

    console.log('Final query:', query);

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate('order_id', 'from_location to_location status')
      .populate('user_id', 'fullName phoneNumber')
      .populate('driver_id', 'fullName vehicleNumber');

    console.log('Notifications found:', notifications);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ ...query, is_read: false });
    console.log('Total notifications:', total, 'Unread count:', unreadCount);

    res.json({
      notifications,
      total,
      unreadCount,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'خطأ داخلي في الخادم' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
      id,
      { is_read: true },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ message: 'الإشعار غير موجود' });
      return;
    }

    res.json({ message: 'تم标记 الإشعار كمقروء', notification });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'خطأ داخلي في الخادم' });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query: any = {};

    if (req.user?.role === 'router') {
      query.user_id = req.user.id;
    } else if (req.user?.role === 'driver') {
      query.driver_id = req.user.id;
    }

    await Notification.updateMany(
      { ...query, is_read: false },
      { is_read: true }
    );

    res.json({ message: 'تم标记 جميع الإشعارات كمقروءة' });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ message: 'خطأ داخلي في الخادم' });
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      res.status(404).json({ message: 'الإشعار غير موجود' });
      return;
    }

    res.json({ message: 'تم حذف الإشعار بنجاح' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ message: 'خطأ داخلي في الخادم' });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query: any = {};

    if (req.user?.role === 'router') {
      query.user_id = req.user.id;
    } else if (req.user?.role === 'driver') {
      query.driver_id = req.user.id;
    }

    const unreadCount = await Notification.countDocuments({ ...query, is_read: false });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'خطأ داخلي في الخادم' });
  }
};