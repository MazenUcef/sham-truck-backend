import { Document, Types, Schema, Model, model } from 'mongoose';
import { Vehicle } from './Vehicle';

interface Driver extends Document {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  vehicleNumber: string;
  vehicleType: Vehicle; 
  photo?: string;
  photoPublicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const vehicleTypeSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  category: { type: String, required: true },
  type: { type: String },
  image: { type: String, required: false },
  imagePublicId: { type: String, required: false },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});

const driverSchema: Schema<Driver> = new Schema({
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
    type: vehicleTypeSchema,
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

const Driver: Model<Driver> = model<Driver>('Driver', driverSchema);

export default Driver;