import mongoose, { Document, Schema } from 'mongoose';
import { Types } from 'mongoose';

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  customer_id: mongoose.Types.ObjectId;
  from_location: string;
  to_location: string;
  vehicle_type: mongoose.Types.ObjectId;
  weight_or_volume: string;
  date_time_transport: Date;
  notes?: string;
  type?: string;
  status: 'Active' | 'Ended' | 'Pending' | 'Offered';
  createdAt: Date;
  updatedAt: Date;
  offered_drivers: Types.ObjectId[];
}

const orderSchema = new Schema<IOrder>(
  {
    customer_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    from_location: {
      type: String,
      required: true,
    },
    to_location: {
      type: String,
      required: true,
    },
    vehicle_type: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    weight_or_volume: {
      type: String,
      required: true,
    },
    date_time_transport: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Active', 'Ended', 'Pending','Offered'],
      default: 'Pending',
    },
    offered_drivers: [{
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      default: [],
    }],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IOrder>('Order', orderSchema);