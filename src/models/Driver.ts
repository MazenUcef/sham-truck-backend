import { Document, Types, Schema, Model, model } from 'mongoose';
import { Vehicle } from './Vehicle';

export interface IDriver extends Document {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  vehicleNumber: string;
  vehicleType: Types.ObjectId;
  photo?: string;
  photoPublicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPopulatedDriver extends Omit<IDriver, 'vehicleType'> {
  vehicleType: Vehicle;
}


const driverSchema: Schema<IDriver> = new Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  vehicleNumber: {
    type: String,
    required: true,
    unique: true,
  },
  vehicleType: {
    type: Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true,
  },
  photo: {
    type: String,
    required: false,
  },
  photoPublicId: {
    type: String,
    required: false,
  },
}, {
  timestamps: true
});

const Driver: Model<IDriver> = model<IDriver>('Driver', driverSchema);

export default Driver;