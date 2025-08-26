import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Offer, { IOffer } from '../models/Offer';
import Order from '../models/Order';
import { Server as SocketIOServer } from 'socket.io';
import Notification from '../models/Notification';

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: string;
        fullName: string;
    };
    io?: SocketIOServer;
}

interface OfferCreateData {
    order_id: string;
    price: number;
    notes?: string;
}

export const validateOfferCreate = [
    body('order_id').isMongoId().withMessage('Invalid order ID'),
    body('price').isNumeric().withMessage('Price must be a number').isFloat({ min: 0 }).withMessage('Price must be positive'),
    body('notes').optional().trim(),
];

export const createOffer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { id, role } = req.user!;
        if (role !== 'driver') {
            res.status(403).json({ message: 'Unauthorized: Only drivers can create offers' });
            return;
        }

        const { order_id, price, notes }: OfferCreateData = req.body;

        const order = await Order.findById(order_id);
        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        const existingOffer = await Offer.findOne({ order_id, driver_id: id });
        if (existingOffer) {
            res.status(400).json({ message: 'You already have an offer for this order' });
            return;
        }

        const offer = await Offer.create({
            order_id,
            driver_id: id,
            price,
            notes,
            status: 'Pending',
        });

        // Populate the offer with driver and order details
        const populatedOffer = await Offer.findById(offer._id)
            .populate('driver_id')
            .populate('order_id');

        // Create a notification in the database
        await Notification.create({
            user_id: order.customer_id, // The router who created the order
            driver_id: id, // The driver who made the offer
            order_id: order_id,
            type: 'new_offer',
            title: 'New Offer Received',
            message: `You have received a new offer of $${price} for your order`,
            is_read: false,
        });

        // Emit Socket.IO events for new offer
        if (req.io) {
            // Notify the router about the new offer
            req.io.to(`user-${order.customer_id}`).emit('new-offer', {
                message: 'New offer received for your order',
                offer: populatedOffer
            });

            // Notify the driver who created the offer
            req.io.to(`driver-${id}`).emit('offer-created', {
                message: 'Your offer has been submitted successfully',
                offer: populatedOffer
            });

            // Also emit a notification event
            req.io.to(`user-${order.customer_id}`).emit('new-notification', {
                title: 'New Offer Received',
                message: `You have received a new offer of $${price} for your order`
            });
        }

        res.status(201).json({
            message: 'Offer created successfully',
            offer: {
                id: offer._id,
                order_id: offer.order_id,
                driver_id: offer.driver_id,
                price: offer.price,
                notes: offer.notes,
                status: offer.status,
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt,
            },
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error creating offer',
            error: error.message,
        });
    }
};

export const getDriverOffers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'driver') {
            res.status(403).json({ message: 'Unauthorized: Only drivers can access their offers' });
            return;
        }

        const offers = await Offer.find({ driver_id: id }).populate('order_id');

        res.json({
            message: 'Offers retrieved successfully',
            offers: offers.map((offer) => ({
                id: offer._id,
                order_id: offer.order_id,
                price: offer.price,
                notes: offer.notes,
                status: offer.status,
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt,
            })),
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error retrieving offers',
            error: error.message,
        });
    }
};

export const getOrderOffers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'Unauthorized: Only routers can access their order offers' });
            return;
        }

        const orderId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            res.status(400).json({ message: 'Invalid order ID' });
            return;
        }

        const order = await Order.findOne({ _id: orderId, customer_id: id });
        if (!order) {
            res.status(404).json({ message: 'Order not found or you do not have access to this order' });
            return;
        }

        const offers = await Offer.find({ order_id: orderId }).populate('driver_id');

        if (req.io && req.headers['socket-id']) {
            req.io.to(req.headers['socket-id']).emit('subscribe-order-offers', orderId);
        }

        res.json({
            message: 'Offers retrieved successfully',
            offers: offers.map((offer) => ({
                id: offer._id,
                driver_id: offer.driver_id,
                price: offer.price,
                notes: offer.notes,
                status: offer.status,
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt,
            })),
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error retrieving offers',
            error: error.message,
        });
    }
};

export const acceptOffer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'Unauthorized: Only routers can accept offers' });
            return;
        }

        const offerId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(offerId)) {
            res.status(400).json({ message: 'Invalid offer ID' });
            return;
        }

        const offer = await Offer.findById(offerId);
        if (!offer) {
            res.status(404).json({ message: 'Offer not found' });
            return;
        }

        const order = await Order.findOne({ _id: offer.order_id, customer_id: id });
        if (!order) {
            res.status(404).json({ message: 'Order not found or you do not have access to this order' });
            return;
        }

        if (offer.status !== 'Pending') {
            res.status(400).json({ message: 'Offer cannot be accepted as it is not pending' });
            return;
        }

        offer.status = 'Accepted';
        await offer.save();

        await Offer.updateMany(
            { order_id: offer.order_id, _id: { $ne: offer._id } },
            { $set: { status: 'Rejected' } }
        );

        // Update the order status
        await Order.findByIdAndUpdate(offer.order_id, { status: 'Active' });

        // Populate the accepted offer with driver details
        const populatedOffer = await Offer.findById(offer._id)
            .populate('driver_id')
            .populate('order_id');;

        // Create notifications for acceptance
        await Notification.create({
            driver_id: offer.driver_id, // The driver whose offer was accepted
            order_id: offer.order_id,
            type: 'offer_accepted',
            title: 'Offer Accepted',
            message: 'Your offer has been accepted!',
            is_read: false,
        });

        await Notification.create({
            user_id: id, // The router who accepted the offer
            order_id: offer.order_id,
            type: 'offer_accepted',
            title: 'Offer Accepted',
            message: 'You have accepted an offer',
            is_read: false,
        });

        // Create notifications for rejected offers
        const rejectedOffers = await Offer.find({
            order_id: offer.order_id,
            _id: { $ne: offer._id }
        });

        for (const rejectedOffer of rejectedOffers) {
            await Notification.create({
                driver_id: rejectedOffer.driver_id,
                order_id: offer.order_id,
                type: 'offer_rejected',
                title: 'Offer Not Selected',
                message: 'Your offer was not selected for this order',
                is_read: false,
            });
        }

        // Emit Socket.IO events for offer acceptance
        if (req.io) {
            // Notify the driver whose offer was accepted
            req.io.to(`driver-${offer.driver_id}`).emit('offer-accepted', {
                message: 'Your offer has been accepted',
                offer: populatedOffer
            });

            // Notify the router who accepted the offer
            req.io.to(`user-${id}`).emit('offer-accepted-confirmation', {
                message: 'Offer accepted successfully',
                offer: populatedOffer
            });

            // Notify other drivers that their offers were rejected
            rejectedOffers.forEach(rejectedOffer => {
                req?.io?.to(`driver-${rejectedOffer.driver_id}`).emit('offer-rejected', {
                    message: 'Your offer was not selected',
                    order_id: rejectedOffer.order_id
                });
            });

            // Emit notification events
            req.io.to(`driver-${offer.driver_id}`).emit('new-notification', {
                title: 'Offer Accepted',
                message: 'Your offer has been accepted!'
            });

            req.io.to(`user-${id}`).emit('new-notification', {
                title: 'Offer Accepted',
                message: 'You have accepted an offer'
            });

            rejectedOffers.forEach(rejectedOffer => {
                req?.io?.to(`driver-${rejectedOffer.driver_id}`).emit('new-notification', {
                    title: 'Offer Not Selected',
                    message: 'Your offer was not selected for this order'
                });
            });
        }

        res.json({
            message: 'Offer accepted successfully',
            offer: {
                id: offer._id,
                order_id: offer.order_id,
                driver_id: offer.driver_id,
                price: offer.price,
                notes: offer.notes,
                status: offer.status,
                createdAt: offer.createdAt,
                updatedAt: offer.updatedAt,
            },
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error accepting offer',
            error: error.message,
        });
    }
};