import mongoose, { Document, Schema } from 'mongoose';

export interface IOffer extends Document {
  order_id: mongoose.Types.ObjectId;
  driver_id: mongoose.Types.ObjectId;
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