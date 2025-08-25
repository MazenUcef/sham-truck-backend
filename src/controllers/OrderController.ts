import { Request, Response } from 'express';
import Order from '../models/Order';
import Offer from '../models/Offer';
import { Socket } from 'socket.io';
import { AuthRequest } from '../types';
import mongoose from 'mongoose';
import VehicleType from '../models/Vehicle';
import { createNotification, notificationTemplates } from '../utils/notifications';
import Driver from '../models/Driver';
import Vehicle from '../models/Vehicle';

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const {
            from_location,
            to_location,
            vehicle_type,
            weight_or_volume,
            date_time_transport,
            loading_time,
            notes,
            type
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(vehicle_type)) {
            res.status(400).json({ message: 'Invalid vehicle type ID' });
            return;
        }

        const vehicleType = await VehicleType.findById(vehicle_type);
        if (!vehicleType) {
            res.status(400).json({ message: 'Vehicle type not found' });
            return;
        }

        const order = await Order.create({
            customer_id: req.user?.id,
            from_location,
            to_location,
            vehicle_type,
            weight_or_volume,
            date_time_transport,
            loading_time,
            notes,
            type,
            status: 'Pending'
        });

        const populatedOrder = await Order.findById(order._id)
            .populate('customer_id', 'fullName email phoneNumber')
            .populate('vehicle_type', 'category type image');


        const io = req.app.get('io');
        io.emit('new-order', populatedOrder);

        const orderNotificationData = {
            order_id: order._id.toString(),
            ...notificationTemplates.orderCreated(
                `${req.user?.fullName || 'A customer'}`
            ),
            metadata: { order_id: order._id }
        };

        await createNotification(orderNotificationData);

        res.status(201).json({
            message: 'Order created successfully',
            order: populatedOrder
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query: any = {};

        if (status) {
            query.status = status;
        }

        let orders;
        let total;

        if (req.user?.role === 'driver') {
            const driver = await Driver.findById(req.user.id).select('vehicleType');
            if (!driver) {
                res.status(404).json({ message: 'Driver not found' });
                return;
            }

            const driverVehicle = await Vehicle.findById(driver.vehicleType).select('category');
            if (!driverVehicle) {
                res.status(400).json({ message: 'Driver vehicle type not found' });
                return;
            }


            orders = await Order.aggregate([
                {
                    $lookup: {
                        from: 'vehicles',
                        localField: 'vehicle_type',
                        foreignField: '_id',
                        as: 'vehicle_type_data'
                    }
                },
                {
                    $unwind: '$vehicle_type_data'
                },
                {
                    $match: {
                        'vehicle_type_data.category': driverVehicle.category,
                        ...query
                    }
                },
                {
                    $lookup: {
                        from: 'routers',
                        localField: 'customer_id',
                        foreignField: '_id',
                        as: 'customer_id'
                    }
                },
                {
                    $unwind: '$customer_id'
                },
                {
                    $lookup: {
                        from: 'vehicles',
                        localField: 'vehicle_type',
                        foreignField: '_id',
                        as: 'vehicle_type'
                    }
                },
                {
                    $unwind: '$vehicle_type'
                },
                {
                    $project: {
                        'customer_id.fullName': 1,
                        'customer_id.email': 1,
                        'customer_id.phoneNumber': 1,
                        'vehicle_type.category': 1,
                        'vehicle_type.type': 1,
                        'vehicle_type.image': 1,
                        from_location: 1,
                        to_location: 1,
                        weight_or_volume: 1,
                        date_time_transport: 1,
                        loading_time: 1,
                        notes: 1,
                        type: 1,
                        status: 1,
                        createdAt: 1,
                        updatedAt: 1
                    }
                },
                {
                    $sort: { createdAt: -1 }
                },
                {
                    $skip: (Number(page) - 1) * Number(limit)
                },
                {
                    $limit: Number(limit)
                }
            ]);

            total = await Order.aggregate([
                {
                    $lookup: {
                        from: 'vehicles',
                        localField: 'vehicle_type',
                        foreignField: '_id',
                        as: 'vehicle_type_data'
                    }
                },
                {
                    $unwind: '$vehicle_type_data'
                },
                {
                    $match: {
                        'vehicle_type_data.category': driverVehicle.category,
                        ...query
                    }
                },
                {
                    $count: 'total'
                }
            ]).then(result => result[0]?.total || 0);
        } else {

            orders = await Order.find(query)
                .populate('customer_id', 'fullName email phoneNumber')
                .populate('vehicle_type', 'category type image')
                .select('from_location to_location weight_or_volume date_time_transport loading_time notes type status createdAt updatedAt')
                .sort({ createdAt: -1 })
                .limit(Number(limit) * 1)
                .skip((Number(page) - 1) * Number(limit));

            total = await Order.countDocuments(query);
        }

        res.json({
            orders,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            total
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer_id', 'fullName email phoneNumber');

        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        res.json(order);
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('customer_id', 'fullName email phoneNumber');

        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        // Notify about order update
        const io = req.app.get('io');
        io.to(`order-${order._id}`).emit('order-updated', order);

        res.json({
            message: 'Order updated successfully',
            order
        });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteOrder = async (req: Request, res: Response): Promise<void> => {
    try {
        const order = await Order.findByIdAndDelete(req.params.id);

        if (!order) {
            res.status(404).json({ message: 'Order not found' });
            return;
        }

        await Offer.deleteMany({ order_id: req.params.id });

        const io = req.app.get('io');
        io.to(`order-${req.params.id}`).emit('order-deleted', req.params.id);

        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Delete order error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserOrders = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const orders = await Order.find({ customer_id: req.user?.id })
            .populate('customer_id', 'fullName email phoneNumber')
            .populate('vehicle_type', 'type category image')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        console.error('Get user orders error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};