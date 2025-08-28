import mongoose, { Document, Schema, Types } from 'mongoose';
import { IDriver, IPopulatedDriver } from './Driver';
import { IOrder } from './Order';

export interface IOffer extends Document {
  _id: Types.ObjectId;
  order_id: Types.ObjectId | IOrder;
  driver_id: Types.ObjectId | IPopulatedDriver;
  price: number;
  notes?: string;
  status: 'Accepted' | 'Rejected' | 'Pending' | 'Expired';
  createdAt: Date;
  updatedAt: Date;
}

const offerSchema = new Schema<IOffer>(
  {
    order_id: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    driver_id: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Accepted', 'Rejected', 'Pending', 'Expired'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IOffer>('Offer', offerSchema);