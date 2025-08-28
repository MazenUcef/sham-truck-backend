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
    body('from_location').trim().notEmpty().withMessage('الموقع الابتدائي مطلوب'),
    body('to_location').trim().notEmpty().withMessage('الموقع النهائي مطلوب'),
    body('vehicle_type').isMongoId().withMessage('معرف نوع المركبة غير صالح'),
    body('weight_or_volume').trim().notEmpty().withMessage('الوزن أو الحجم مطلوب'),
    body('date_time_transport')
        .isISO8601()
        .toDate()
        .withMessage('تاريخ ووقت النقل غير صالح'),
    body('loading_time').trim().notEmpty().withMessage('وقت التحميل مطلوب'),
    body('type').trim().notEmpty().withMessage('نوع الطلب مطلوب'),
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
            res.status(403).json({ message: 'غير مصرح: يمكن للراوتر فقط إنشاء الطلبات' });
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
            res.status(400).json({ message: 'معرف نوع المركبة غير صالح' });
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

        await Notification.create({
            user_id: id,
            order_id: order._id,
            type: 'order_created',
            title: 'تم إنشاء الطلب',
            message: 'تم إنشاء طلبك بنجاح',
            is_read: false,
        });
        console.log('Router notification created for user_id:', id);

        const drivers = await Driver.find()
            .populate({
                path: 'vehicleType',
                match: { category: vehicleType.category },
                select: '_id category type'
            })
            .select('_id fullName vehicleNumber')
            .lean();
        const matchingDrivers = drivers.filter(driver => driver.vehicleType !== null);
        console.log('Matching drivers (by vehicle category):', matchingDrivers);

        const driverNotifications = matchingDrivers.map(driver => ({
            driver_id: driver._id,
            order_id: order._id,
            type: 'new_order_available',
            title: 'طلب جديد متاح',
            message: `طلب جديد يتطابق مع فئة مركبتك متاح: من ${order.from_location} إلى ${order.to_location}`,
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

        const populatedOrder = await Order.findById(order._id)
            .populate('vehicle_type')
            .populate({
                path: 'customer_id',
                select: '-password'
            });

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
                message: 'تم إنشاء طلبك بنجاح',
                order: populatedOrder
            });

            req.io.to(`user-${id}`).emit('new-notification', {
                title: 'تم إنشاء الطلب',
                message: 'تم إنشاء طلبك بنجاح'
            });

            matchingDrivers.forEach(driver => {
                console.log(`Emitting new-notification to driver-${driver._id}`);
                req.io!.to(`driver-${driver._id}`).emit('new-notification', {
                    title: 'طلب جديد متاح',
                    message: `طلب جديد يتطابق مع فئة مركبتك متاح: من ${order.from_location} إلى ${order.to_location}`
                });
            });
        } else {
            console.warn('Socket.IO instance not available on request object');
        }

        res.status(201).json({
            message: 'تم إنشاء الطلب بنجاح',
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
            message: 'خطأ في إنشاء الطلب',
            error: error.message,
        });
    }
};

export const getRouterOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'غير مصرح: يمكن للراوتر فقط الوصول إلى طلباتهم' });
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
            message: 'تم استرجاع الطلبات بنجاح',
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
            message: 'خطأ في استرجاع الطلبات',
            error: error.message,
        });
    }
};

export const getOrderById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'غير مصرح: يمكن للراوتر فقط الوصول إلى طلباتهم' });
            return;
        }

        const orderId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            res.status(400).json({ message: 'معرف الطلب غير صالح' });
            return;
        }

        const order = await Order.findOne({ _id: orderId, customer_id: id })
            .populate('vehicle_type')
            .populate({
                path: 'customer_id',
                select: '-password'
            });

        if (!order) {
            res.status(404).json({ message: 'الطلب غير موجود أو ليس لديك الوصول إلى هذا الطلب' });
            return;
        }

        res.json({
            message: 'تم استرجاع الطلب بنجاح',
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
            message: 'خطأ في استرجاع الطلب',
            error: error.message,
        });
    }
};

export const getDriverOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'driver') {
            res.status(403).json({ message: 'غير مصرح: يمكن للسائقين فقط الوصول إلى الطلبات' });
            return;
        }

        const driver = await Driver.findById(id).populate<{ vehicleType: any }>('vehicleType');
        if (!driver) {
            res.status(404).json({ message: 'السائق غير موجود' });
            return;
        }

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
            message: 'تم استرجاع الطلبات بنجاح',
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
            message: 'خطأ في استرجاع الطلبات',
            error: error.message,
        });
    }
};