import { Document, Schema, Model, model, Types } from 'mongoose';

export interface Vehicle extends Document {
  _id: Types.ObjectId;
  category: string;
  type: string;
  image?: string;
  imagePublicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VehicleSchema: Schema<Vehicle> = new Schema({
  category: {
    type: String,
    required: true,
  },
  type: {
    type: String,
  },
  image: {
    type: String,
    required: false,
  },
  imagePublicId: {
    type: String,
    required: false,
  },
}, {
  timestamps: true
});

const Vehicle: Model<Vehicle> = model<Vehicle>('Vehicle', VehicleSchema);

export default Vehicle;