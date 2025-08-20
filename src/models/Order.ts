import mongoose, { Document, Schema } from 'mongoose';

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  customer_id: mongoose.Types.ObjectId;
  from_location: string;
  to_location: string;
  vehicle_type: mongoose.Types.ObjectId;
  weight_or_volume: string;
  date_time_transport: Date;
  loading_time: string;
  notes?: string;
  status: 'Active' | 'Ended' | 'Pending';
  createdAt: Date;
  updatedAt: Date;
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
      ref: 'VehicleType',
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
    loading_time: {
      type: String,
      required: true,
    },
    notes: {
      type: String,
    },
    status: {
      type: String,
      enum: ['Active', 'Ended', 'Pending'],
      default: 'Pending',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IOrder>('Order', orderSchema);