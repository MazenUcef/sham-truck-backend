import mongoose, { Document, Schema } from 'mongoose';
import { VehicleType as VehicleTypeInterface } from '../types';


const vehicleTypeSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
    },
    description: {
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('VehicleType', vehicleTypeSchema);