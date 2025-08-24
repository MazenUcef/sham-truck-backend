import { Request, Response } from 'express';
import Offer from '../models/Offer';
import Order from '../models/Order';
import { AuthRequest } from '../types';
import { createNotification, notificationTemplates } from '../utils/notifications';

export const createOffer = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { order_id, price, notes, type } = req.body;

        const order = await Order.findById(order_id);
        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        const existingOffer = await Offer.findOne({
            order_id,
            driver_id: req.user?.id
        });

        if (existingOffer) {
            res.status(400).json({ message: 'You already made an offer for this order' });
            return;
        }

        const offer = await Offer.create({
            order_id,
            driver_id: req.user?.id,
            price,
            notes,
            type,
            status: 'Pending'
        });

        const populatedOffer = await Offer.findById(offer._id)
            .populate({
                path: 'driver_id',
                select: 'fullName email phoneNumber vehicleNumber vehicleType photo',
                populate: {
                    path: 'vehicleType',
                    model: 'Vehicle',
                    select: '_id category type image imagePublicId createdAt updatedAt __v'
                }
            })
            .populate('order_id');

        const io = req.app.get('io');
        io.to(`user-${order.customer_id}`).emit('new-offer', populatedOffer);
        io.to(`order-${order_id}`).emit('offer-created', populatedOffer);

        const notificationData = {
            user_id: order.customer_id.toString(),
            driver_id: req.user?.id,
            order_id: order_id,
            ...notificationTemplates.newOffer(
                `${req.user?.fullName || 'A driver'}`,
                order_id
            ),
            metadata: { offer_id: offer._id, price: price }
        };

        await createNotification(notificationData);
        res.status(201).json({
            message: 'Offer created successfully',
            offer: populatedOffer
        });
    } catch (error) {
        console.error('Create offer error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getOffers = async (req: Request, res: Response): Promise<void> => {
    try {
        const offers = await Offer.find()
            .populate('driver_id', 'fullName email phoneNumber vehicleNumber vehicleType photo')
            .populate('order_id')
            .sort({ createdAt: -1 });

        res.json(offers);
    } catch (error) {
        console.error('Get offers error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getOfferById = async (req: Request, res: Response): Promise<void> => {
    try {
        const offer = await Offer.findById(req.params.id)
            .populate('driver_id', 'fullName email phoneNumber vehicleNumber vehicleType photo')
            .populate('order_id');

        if (!offer) {
            res.status(404).json({ message: 'Offer not found' });
            return;
        }

        res.json(offer);
    } catch (error) {
        console.error('Get offer error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateOffer = async (req: Request, res: Response): Promise<void> => {
    try {
        const offer = await Offer.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('driver_id', 'fullName email phoneNumber vehicleNumber vehicleType photo')
            .populate('order_id');

        if (!offer) {
            res.status(404).json({ message: 'Offer not found' });
            return;
        }

        const io = req.app.get('io');
        io.to(`order-${offer.order_id._id}`).emit('offer-updated', offer);

        res.json({
            message: 'Offer updated successfully',
            offer
        });
    } catch (error) {
        console.error('Update offer error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const acceptOffer = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const offer = await Offer.findById(req.params.id)
            .populate({
                path: 'driver_id',
                select: 'fullName email phoneNumber vehicleNumber vehicleType photo',
                populate: {
                    path: 'vehicleType',
                    model: 'Vehicle',
                    select: '_id category type image imagePublicId createdAt updatedAt __v'
                }
            })
            .populate('order_id');

        if (!offer) {
            res.status(404).json({ message: 'Offer not found' });
            return;
        }

        offer.status = 'Accepted';
        await offer.save();

        await Order.findByIdAndUpdate(offer.order_id._id, { status: 'Active' });

        await Offer.updateMany(
            {
                order_id: offer.order_id._id,
                _id: { $ne: offer._id }
            },
            { status: 'Rejected' }
        );

        const updatedOrder = await Order.findById(offer.order_id._id);

        const io = req.app.get('io');
        io.to(`driver-${offer.driver_id._id}`).emit('offer-accepted', offer);
        io.to(`order-${offer.order_id._id}`).emit('order-updated', updatedOrder);
        const acceptNotificationData = {
            driver_id: offer.driver_id._id.toString(),
            order_id: offer.order_id._id.toString(),
            ...notificationTemplates.offerAccepted(
                `${req.user?.fullName || 'The customer'}`
            ),
            metadata: { offer_id: offer._id }
        };

        await createNotification(acceptNotificationData);
        res.json({
            message: 'Offer accepted successfully',
            offer,
            order: updatedOrder
        });
    } catch (error) {
        console.error('Accept offer error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const rejectOffer = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const offer = await Offer.findByIdAndUpdate(
            req.params.id,
            { status: 'Rejected' },
            { new: true }
        ).populate('driver_id', 'fullName email phoneNumber vehicleNumber vehicleType photo')
            .populate('order_id');

        if (!offer) {
            res.status(404).json({ message: 'Offer not found' });
            return;
        }

        const io = req.app.get('io');
        io.to(`driver-${offer.driver_id._id}`).emit('offer-rejected', offer);
        const rejectNotificationData = {
            driver_id: offer.driver_id._id.toString(),
            order_id: offer.order_id._id.toString(),
            ...notificationTemplates.offerRejected(
                `${req.user?.fullName || 'The customer'}`
            ),
            metadata: { offer_id: offer._id }
        };

        await createNotification(rejectNotificationData);
        res.json({
            message: 'Offer rejected successfully',
            offer
        });
    } catch (error) {
        console.error('Reject offer error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getOrderOffers = async (req: Request, res: Response): Promise<void> => {
    try {
        const offers = await Offer.find({ order_id: req.params.orderId })
            .populate({
                path: 'driver_id',
                select: 'fullName email phoneNumber vehicleNumber vehicleType photo',
                populate: {
                    path: 'vehicleType',
                    model: 'Vehicle',
                    select: '_id category type image imagePublicId createdAt updatedAt __v'
                }
            })
            .sort({ createdAt: -1 });

        res.json(offers);
    } catch (error) {
        console.error('Get order offers error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getDriverOffers = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const offers = await Offer.find({ driver_id: req.user?.id })
            .populate({
                path: 'driver_id',
                select: 'fullName email phoneNumber vehicleNumber vehicleType photo',
                populate: {
                    path: 'vehicleType',
                    model: 'Vehicle',
                    select: '_id category type image imagePublicId createdAt updatedAt __v'
                }
            })
            .populate({
                path: 'order_id',
                populate: {
                    path: 'customer_id',
                    select: 'fullName email phoneNumber'
                }
            })
            .sort({ createdAt: -1 });

        res.json(offers);
    } catch (error) {
        console.error('Get driver offers error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};