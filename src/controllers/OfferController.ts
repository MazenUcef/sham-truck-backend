import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Offer, { IOffer } from '../models/Offer';
import Order from '../models/Order';
import { Server as SocketIOServer } from 'socket.io';
import Notification from '../models/Notification';
import { IPopulatedDriver } from '../models/Driver';

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
    body('order_id').isMongoId().withMessage('معرف الطلب غير صالح'),
    body('price').isNumeric().withMessage('يجب أن يكون السعر رقمًا').isFloat({ min: 0 }).withMessage('يجب أن يكون السعر موجبًا'),
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
      res.status(403).json({ message: 'غير مصرح: يمكن للسائقين فقط إنشاء العروض' });
      return;
    }

    const { order_id, price, notes }: OfferCreateData = req.body;

    const order = await Order.findById(order_id);
    if (!order) {
      res.status(404).json({ message: 'الطلب غير موجود' });
      return;
    }

    const existingOffer = await Offer.findOne({ order_id, driver_id: id });
    if (existingOffer) {
      res.status(400).json({ message: 'لديك بالفعل عرض لهذا الطلب' });
      return;
    }

    const offer = await Offer.create({
      order_id,
      driver_id: id,
      price,
      notes,
      status: 'Pending',
    });

    const populatedOffer = await Offer.findById(offer._id)
      .populate<{ driver_id: IPopulatedDriver }>('driver_id', 'fullName') // Type driver_id as IPopulatedDriver
      .populate('order_id');

    if (!populatedOffer) {
      res.status(500).json({ message: 'فشل في جلب العرض بعد الإنشاء' });
      return;
    }

    // Create notification for router
    await Notification.create({
      user_id: order.customer_id,
      order_id: order_id,
      type: 'new_offer',
      title: 'تم استلام عرض جديد',
      message: `لقد تلقيت عرضًا جديدًا بقيمة ${price} دولار لطلبك`,
      is_read: false,
    });

    // Create notification for driver
    await Notification.create({
      driver_id: id,
      order_id: order_id,
      type: 'offer_created',
      title: 'تم تقديم العرض',
      message: 'تم تقديم عرضك بنجاح',
      is_read: false,
    });

    if (req.io) {
      req.io.to(`user-${order.customer_id}`).emit('new-offer', {
        message: 'تم استلام عرض جديد لطلبك',
        offer: {
          id: offer._id.toString(),
          order_id: offer.order_id.toString(),
          driver_id: {
            _id: populatedOffer.driver_id._id.toString(),
            fullName: populatedOffer.driver_id.fullName || 'غير محدد',
          },
          price: offer.price,
          notes: offer.notes,
          status: offer.status,
          createdAt: offer.createdAt,
          updatedAt: offer.updatedAt,
        },
      });

      req.io.to(`user-${order.customer_id}`).emit('new-notification', {
        title: 'تم استلام عرض جديد',
        message: `لقد تلقيت عرضًا جديدًا بقيمة ${price} دولار لطلبك`,
      });

      req.io.to(`driver-${id}`).emit('offer-created', {
        message: 'تم تقديم عرضك بنجاح',
        offer: {
          id: offer._id.toString(),
          order_id: offer.order_id.toString(),
          driver_id: {
            _id: populatedOffer.driver_id._id.toString(),
            fullName: populatedOffer.driver_id.fullName || 'غير محدد',
          },
          price: offer.price,
          notes: offer.notes,
          status: offer.status,
          createdAt: offer.createdAt,
          updatedAt: offer.updatedAt,
        },
      });

      req.io.to(`driver-${id}`).emit('new-notification', {
        title: 'تم تقديم العرض',
        message: 'تم تقديم عرضك بنجاح',
      });
    }

    res.status(201).json({
      message: 'تم إنشاء العرض بنجاح',
      offer: {
        id: offer._id.toString(),
        order_id: offer.order_id.toString(),
        driver_id: offer.driver_id.toString(),
        price: offer.price,
        notes: offer.notes,
        status: offer.status,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Create offer error:', error);
    res.status(500).json({
      message: 'خطأ في إنشاء العرض',
      error: error.message,
    });
  }
};

export const getDriverOffers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'driver') {
            res.status(403).json({ message: 'غير مصرح: يمكن للسائقين فقط الوصول إلى عروضهم' });
            return;
        }

        const offers = await Offer.find({ driver_id: id }).populate('order_id');

        res.json({
            message: 'تم استرجاع العروض بنجاح',
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
            message: 'خطأ في استرجاع العروض',
            error: error.message,
        });
    }
};

export const getOrderOffers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id, role } = req.user!;
        if (role !== 'router') {
            res.status(403).json({ message: 'غير مصرح: يمكن للراوتر فقط الوصول إلى عروض طلباتهم' });
            return;
        }

        const orderId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            res.status(400).json({ message: 'معرف الطلب غير صالح' });
            return;
        }

        const order = await Order.findOne({ _id: orderId, customer_id: id });
        if (!order) {
            res.status(404).json({ message: 'الطلب غير موجود أو ليس لديك الوصول إلى هذا الطلب' });
            return;
        }

        const offers = await Offer.find({ order_id: orderId }).populate('driver_id');

        if (req.io && req.headers['socket-id']) {
            req.io.to(req.headers['socket-id']).emit('subscribe-order-offers', orderId);
        }

        res.json({
            message: 'تم استرجاع العروض بنجاح',
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
            message: 'خطأ في استرجاع العروض',
            error: error.message,
        });
    }
};

export const acceptOffer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, role } = req.user!;
    if (role !== 'router') {
      res.status(403).json({ message: 'غير مصرح: يمكن للراوتر فقط قبول العروض' });
      return;
    }

    const offerId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      res.status(400).json({ message: 'معرف العرض غير صالح' });
      return;
    }

    const offer = await Offer.findById(offerId);
    if (!offer) {
      res.status(404).json({ message: 'العرض غير موجود' });
      return;
    }

    const order = await Order.findOne({ _id: offer.order_id, customer_id: id });
    if (!order) {
      res.status(404).json({ message: 'الطلب غير موجود أو ليس لديك الوصول إلى هذا الطلب' });
      return;
    }

    if (offer.status !== 'Pending') {
      res.status(400).json({ message: 'لا يمكن قبول العرض لأنه ليس قيد الانتظار' });
      return;
    }

    offer.status = 'Accepted';
    await offer.save();

    await Offer.updateMany(
      { order_id: offer.order_id, _id: { $ne: offer._id } },
      { $set: { status: 'Rejected' } }
    );

    await Order.findByIdAndUpdate(offer.order_id, { status: 'Active' });

    const populatedOffer = await Offer.findById(offer._id)
      .populate('driver_id')
      .populate('order_id');

    const updatedOrder = await Order.findById(offer.order_id)
      .populate('vehicle_type')
      .populate({ path: 'customer_id', select: '-password' });

    await Notification.create({
      driver_id: offer.driver_id,
      order_id: offer.order_id,
      type: 'offer_accepted',
      title: 'تم قبول العرض',
      message: 'تم قبول عرضك!',
      is_read: false,
    });

    const rejectedOffers = await Offer.find({
      order_id: offer.order_id,
      _id: { $ne: offer._id },
    });

    for (const rejectedOffer of rejectedOffers) {
      await Notification.create({
        driver_id: rejectedOffer.driver_id,
        order_id: offer.order_id,
        type: 'offer_rejected',
        title: 'لم يتم اختيار العرض',
        message: 'لم يتم اختيار عرضك لهذا الطلب',
        is_read: false,
      });
    }

    if (req.io) {
      req.io.to(`driver-${offer.driver_id}`).emit('offer-accepted', {
        message: 'تم قبول عرضك',
        offer: populatedOffer,
      });

      req.io.to(`user-${id}`).emit('offer-accepted-confirmation', {
        message: 'تم قبول العرض بنجاح',
        offer: populatedOffer,
      });

      // Emit order-updated event
      req.io.to(`driver-${offer.driver_id}`).emit('order-updated', {
        message: 'Order status updated to Active',
        order: updatedOrder,
      });
      req.io.to(`user-${id}`).emit('order-updated', {
        message: 'Order status updated to Active',
        order: updatedOrder,
      });

      rejectedOffers.forEach((rejectedOffer) => {
        req.io?.to(`driver-${rejectedOffer.driver_id}`).emit('offer-rejected', {
          message: 'لم يتم اختيار عرضك',
          order_id: rejectedOffer.order_id,
        });
      });

      req.io.to(`driver-${offer.driver_id}`).emit('new-notification', {
        title: 'تم قبول العرض',
        message: 'تم قبول عرضك!',
      });

      req.io.to(`user-${id}`).emit('new-notification', {
        title: 'تم قبول العرض',
        message: 'لقد قبلت عرضًا',
      });

      rejectedOffers.forEach((rejectedOffer) => {
        req.io?.to(`driver-${rejectedOffer.driver_id}`).emit('new-notification', {
          title: 'لم يتم اختيار العرض',
          message: 'لم يتم اختيار عرضك لهذا الطلب',
        });
      });
    }

    res.json({
      message: 'تم قبول العرض بنجاح',
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
      message: 'خطأ في قبول العرض',
      error: error.message,
    });
  }
};