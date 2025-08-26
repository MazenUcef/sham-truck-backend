import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Order from '../models/Order';
import Vehicle from '../models/Vehicle';
import Driver from '../models/Driver';
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

interface OrderCreateData {
    from_location: string;
    to_location: string;
    vehicle_type: string;
    weight_or_volume: string;
    date_time_transport: Date;
    loading_time: string;
    notes?: string;
    type: string;
}

export const validateOrderCreate = [
    body('from_location').trim().notEmpty().withMessage('From location is required'),
    body('to_location').trim().notEmpty().withMessage('To location is required'),
    body('vehicle_type').isMongoId().withMessage('Invalid vehicle type ID'),
    body('weight_or_volume').trim().notEmpty().withMessage('Weight or volume is required'),
    body('date_time_transport')
        .isISO8601()
        .toDate()
        .withMessage('Invalid date and time for transport'),
    body('loading_time').trim().notEmpty().withMessage('Loading time is required'),
    body('type').trim().notEmpty().withMessage('Order type is required'),
    body('notes').optional().trim(),
];

export const createOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'Unauthorized: Only routers can create orders' });
            return;
        }

        const {
            from_location,
            to_location,
            vehicle_type,
            weight_or_volume,
            date_time_transport,
            loading_time,
            notes,
            type,
        }: OrderCreateData = req.body;

        const vehicleType = await Vehicle.findById(vehicle_type);
        if (!vehicleType) {
            res.status(400).json({ message: 'Invalid vehicle type ID' });
            return;
        }

        const order = await Order.create({
            customer_id: id,
            from_location,
            to_location,
            vehicle_type,
            weight_or_volume,
            date_time_transport,
            loading_time,
            notes,
            type,
            status: 'Pending',
        });


        if (req.io) {
            req.io.emit('new-order-available', {
                order: {
                    id: order._id,
                    from_location: order.from_location,
                    to_location: order.to_location,
                    vehicle_type: order.vehicle_type,
                    weight_or_volume: order.weight_or_volume,
                    date_time_transport: order.date_time_transport,
                    loading_time: order.loading_time,
                    notes: order.notes,
                    type: order.type,
                    status: order.status,
                }
            })
        }


        const populatedOrder = await Order.findById(order._id)
            .populate('vehicle_type')
            .populate({
                path: 'customer_id',
                select: '-password'
            });


        
        await Notification.create({
            user_id: id,
            order_id: order._id,
            type: 'order_created',
            title: 'Order Created',
            message: 'Your order has been created successfully',
            is_read: false,
        });

        
        if (req.io) {
           
            req.io.emit('new-order', {
                message: 'New order available',
                order: populatedOrder
            });

          
            req.io.to(`user-${id}`).emit('order-created', {
                message: 'Your order has been created successfully',
                order: populatedOrder
            });

           
            req.io.to(`user-${id}`).emit('new-notification', {
                title: 'Order Created',
                message: 'Your order has been created successfully'
            });
        }

        res.status(201).json({
            message: 'Order created successfully',
            order: {
                id: populatedOrder!._id,
                customer: populatedOrder!.customer_id,
                from_location: populatedOrder!.from_location,
                to_location: populatedOrder!.to_location,
                vehicle_type: populatedOrder!.vehicle_type,
                weight_or_volume: populatedOrder!.weight_or_volume,
                date_time_transport: populatedOrder!.date_time_transport,
                loading_time: populatedOrder!.loading_time,
                notes: populatedOrder!.notes,
                type: populatedOrder!.type,
                status: populatedOrder!.status,
                createdAt: populatedOrder!.createdAt,
                updatedAt: populatedOrder!.updatedAt,
            },
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error creating order',
            error: error.message,
        });
    }
};

export const getRouterOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'Unauthorized: Only routers can access their orders' });
            return;
        }

        const orders = await Order.find({ customer_id: id })
            .populate('vehicle_type')
            .populate({
                path: 'customer_id',
                select: '-password'
            });

        if (req.io && req.headers['socket-id']) {
            req.io.to(req.headers['socket-id']).emit('subscribe-router-orders', id);
        }

        res.json({
            message: 'Orders retrieved successfully',
            orders: orders.map((order) => ({
                id: order._id,
                customer: order.customer_id,
                from_location: order.from_location,
                to_location: order.to_location,
                vehicle_type: order.vehicle_type,
                weight_or_volume: order.weight_or_volume,
                date_time_transport: order.date_time_transport,
                loading_time: order.loading_time,
                notes: order.notes,
                type: order.type,
                status: order.status,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
            })),
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error retrieving orders',
            error: error.message,
        });
    }
};

export const getOrderById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'Unauthorized: Only routers can access their orders' });
            return;
        }

        const orderId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            res.status(400).json({ message: 'Invalid order ID' });
            return;
        }

        const order = await Order.findOne({ _id: orderId, customer_id: id })
            .populate('vehicle_type')
            .populate({
                path: 'customer_id',
                select: '-password'
            });

        if (!order) {
            res.status(404).json({ message: 'Order not found or you do not have access to this order' });
            return;
        }

        res.json({
            message: 'Order retrieved successfully',
            order: {
                id: order._id,
                customer: order.customer_id,
                from_location: order.from_location,
                to_location: order.to_location,
                vehicle_type: order.vehicle_type,
                weight_or_volume: order.weight_or_volume,
                date_time_transport: order.date_time_transport,
                loading_time: order.loading_time,
                notes: order.notes,
                type: order.type,
                status: order.status,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
            },
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error retrieving order',
            error: error.message,
        });
    }
};

export const getDriverOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'driver') {
            res.status(403).json({ message: 'Unauthorized: Only drivers can access orders' });
            return;
        }

        const driver = await Driver.findById(id);
        if (!driver) {
            res.status(404).json({ message: 'Driver not found' });
            return;
        }

        const driverVehicleCategory = driver.vehicleType.category;

        const orders = await Order.find({
            status: 'Pending',
        })
            .populate({
                path: 'vehicle_type',
                match: { category: driverVehicleCategory },
            })
            .populate({
                path: 'customer_id',
                select: '-password'
            })
            .lean();

        const filteredOrders = orders.filter((order) => order.vehicle_type !== null);


        if (req.io && req.headers['socket-id']) {
            req.io.to(req.headers['socket-id']).emit('subscribe-driver-orders', id);
        }

        res.json({
            message: 'Orders retrieved successfully',
            orders: filteredOrders.map((order) => ({
                id: order._id,
                customer: order.customer_id,
                from_location: order.from_location,
                to_location: order.to_location,
                vehicle_type: order.vehicle_type,
                weight_or_volume: order.weight_or_volume,
                date_time_transport: order.date_time_transport,
                loading_time: order.loading_time,
                notes: order.notes,
                type: order.type,
                status: order.status,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
            })),
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error retrieving orders',
            error: error.message,
        });
    }
};