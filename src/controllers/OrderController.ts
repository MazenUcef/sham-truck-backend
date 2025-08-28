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

        console.log('Router ID:', id);
        console.log('Order vehicle_type:', vehicle_type);
        const vehicleType = await Vehicle.findById(vehicle_type);
        if (!vehicleType) {
            res.status(400).json({ message: 'Invalid vehicle type ID' });
            return;
        }
        console.log('Found vehicle:', vehicleType);
        console.log('Vehicle category:', vehicleType.category);

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
        console.log('Created order:', order._id);

        // Notify the router who created the order
        await Notification.create({
            user_id: id,
            order_id: order._id,
            type: 'order_created',
            title: 'Order Created',
            message: 'Your order has been created successfully',
            is_read: false,
        });
        console.log('Router notification created for user_id:', id);

        // Find drivers with vehicles in the same category
        const drivers = await Driver.find()
            .populate({
                path: 'vehicleType',
                match: { category: vehicleType.category },
                select: '_id category type'
            })
            .select('_id fullName vehicleNumber')
            .lean();
        // Filter out drivers where vehicleType is null (i.e., no matching category)
        const matchingDrivers = drivers.filter(driver => driver.vehicleType !== null);
        console.log('Matching drivers (by vehicle category):', matchingDrivers);

        // Create notifications for each matching driver
        const driverNotifications = matchingDrivers.map(driver => ({
            driver_id: driver._id,
            order_id: order._id,
            type: 'new_order_available',
            title: 'New Order Available',
            message: `A new order matching your vehicle category is available: ${order.from_location} to ${order.to_location}`,
            is_read: false,
        }));
        console.log('Driver notifications to create:', driverNotifications);

        if (driverNotifications.length > 0) {
            try {
                await Notification.insertMany(driverNotifications);
                console.log('Notifications created for drivers:', matchingDrivers.map(d => ({ id: d._id, fullName: d.fullName })));
            } catch (error) {
                console.error('Error creating driver notifications:', error);
            }
        } else {
            console.log('No driver notifications created (no matching drivers)');
        }

        // Populate the order for response and socket emissions
        const populatedOrder = await Order.findById(order._id)
            .populate('vehicle_type')
            .populate({
                path: 'customer_id',
                select: '-password'
            });

        // Emit Socket.IO events
        if (req.io) {
            console.log('Socket.IO instance available:', req.io);
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
            });

            req.io.to(`user-${id}`).emit('order-created', {
                message: 'Your order has been created successfully',
                order: populatedOrder
            });

            req.io.to(`user-${id}`).emit('new-notification', {
                title: 'Order Created',
                message: 'Your order has been created successfully'
            });

            matchingDrivers.forEach(driver => {
                console.log(`Emitting new-notification to driver-${driver._id}`);
                req.io!.to(`driver-${driver._id}`).emit('new-notification', {
                    title: 'New Order Available',
                    message: `A new order matching your vehicle category is available: ${order.from_location} to ${order.to_location}`
                });
            });
        } else {
            console.warn('Socket.IO instance not available on request object');
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
        console.error('Create order error:', error);
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

        // Populate with proper typing
        const driver = await Driver.findById(id).populate<{ vehicleType: any }>('vehicleType');
        if (!driver) {
            res.status(404).json({ message: 'Driver not found' });
            return;
        }

        // Type assertion to tell TypeScript that vehicleType is populated
        const populatedDriver = driver as any;
        const driverVehicleCategory = populatedDriver.vehicleType.category;

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