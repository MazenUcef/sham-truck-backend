import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  user_id?: mongoose.Types.ObjectId;
  driver_id?: mongoose.Types.ObjectId;
  order_id?: mongoose.Types.ObjectId;
  type: 'new_offer' | 'offer_accepted' | 'offer_rejected' | 'order_created' | 'order_updated' | 'order_completed' | 'ring' | 'new_order_available';
  title: string;
  message: string;
  is_read: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    driver_id: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: false,
    },
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
    },
    type: {
      type: String,
      enum: ['new_offer', 'offer_accepted', 'offer_rejected', 'order_created', 'order_updated', 'order_completed', 'ring', 'new_order_available'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    is_read: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<INotification>('Notification', notificationSchema);