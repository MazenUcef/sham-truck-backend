import app from '..';
import Notification from '../models/Notification';

export const createNotification = async (data: {
  user_id?: string;
  driver_id?: string;
  order_id?: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
}) => {
  try {
    const notification = await Notification.create(data);
    const populatedNotification = await Notification.findById(notification._id)
      .populate('user_id', 'fullName phoneNumber')
      .populate('driver_id', 'fullName vehicleNumber')
      .populate('order_id', 'from_location to_location status');

    const io = app.get('io');

    if (data.user_id) {
      io.to(`user-${data.user_id}`).emit('new-notification', populatedNotification);
    }
    if (data.driver_id) {
      io.to(`driver-${data.driver_id}`).emit('new-notification', populatedNotification);
    }
    if (data.order_id) {
      io.to(`order-${data.order_id}`).emit('notification-created', populatedNotification);
    }

    return populatedNotification;
  } catch (error) {
    console.error('Create notification error:', error);
    throw error;
  }
};

export const notificationTemplates = {
  newOffer: (driverName: string, orderId: string) => ({
    title: '💰 New Offer Received',
    message: `${driverName} made an offer on your order`,
    type: 'new_offer' as const,
  }),
  offerAccepted: (customerName: string) => ({
    title: '✅ Offer Accepted',
    message: `${customerName} accepted your offer`,
    type: 'offer_accepted' as const,
  }),
  offerRejected: (customerName: string) => ({
    title: '❌ Offer Rejected', 
    message: `${customerName} rejected your offer`,
    type: 'offer_rejected' as const,
  }),
  orderCreated: (customerName: string) => ({
    title: '📦 New Order Available',
    message: `New order from ${customerName}`,
    type: 'order_created' as const,
  }),
};