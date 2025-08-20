import { Response } from 'express';
import Notification from '../models/Notification';
import Order from '../models/Order';
import { AuthRequest } from '../types';
import Offer from '../models/Offer';

export const sendRing = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { order_id, message } = req.body;

        const order = await Order.findById(order_id)
            .populate('customer_id', 'fullName phoneNumber')
            .populate('vehicle_type', 'type description');

        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        let notification;
        const io = req.app.get('io');

        if (req.user?.role === 'driver') {
            notification = await Notification.create({
                user_id: order.customer_id,
                driver_id: req.user.id,
                order_id: order._id,
                type: 'ring',
                title: '🔔 Ring from Driver',
                message: message || `Driver is trying to contact you about your order`,
                metadata: {
                    ring_type: 'driver_to_customer',
                    urgent: true
                }
            });

            io.to(`user-${order.customer_id._id}`).emit('ring-notification', notification);
            io.to(`order-${order_id}`).emit('ring-sent', notification);

        } else if (req.user?.role === 'user') {
            const acceptedOffer = await Offer.findOne({
                order_id: order._id,
                status: 'Accepted'
            }).populate('driver_id');

            if (!acceptedOffer) {
                res.status(400).json({ message: 'No accepted offer found for this order' });
                return;
            }

            notification = await Notification.create({
                user_id: req.user.id,
                driver_id: acceptedOffer.driver_id._id,
                order_id: order._id,
                type: 'ring',
                title: '🔔 Ring from Customer',
                message: message || `Customer is trying to contact you about their order`,
                metadata: {
                    ring_type: 'customer_to_driver',
                    urgent: true
                }
            });

            io.to(`driver-${acceptedOffer.driver_id._id}`).emit('ring-notification', notification);
            io.to(`order-${order_id}`).emit('ring-sent', notification);
        }

        res.status(201).json({
            message: 'Ring sent successfully',
            notification
        });
    } catch (error) {
        console.error('Send ring error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getRingHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { order_id } = req.query;
        const query: any = { type: 'ring' };

        if (order_id) {
            query.order_id = order_id;
        }

        if (req.user?.role === 'user') {
            query.user_id = req.user.id;
        } else if (req.user?.role === 'driver') {
            query.driver_id = req.user.id;
        }

        const rings = await Notification.find(query)
            .sort({ createdAt: -1 })
            .populate('user_id', 'fullName phoneNumber')
            .populate('driver_id', 'fullName vehicleNumber')
            .populate('order_id', 'from_location to_location status');

        res.json(rings);
    } catch (error) {
        console.error('Get ring history error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};