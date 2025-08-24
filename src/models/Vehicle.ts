import mongoose, { Schema } from 'mongoose';


const VehicleSchema = new Schema(
  {
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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Vehicle', VehicleSchema);