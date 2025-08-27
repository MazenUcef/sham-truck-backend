import { Document, Types, Schema, Model, model } from 'mongoose';

interface Driver extends Document {
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
    type: Schema.Types.ObjectId, // Store only ObjectId
    ref: 'Vehicle', // Reference to Vehicle model
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