import mongoose, { Document, Schema } from 'mongoose';
import { Driver as DriverInterface } from '../types';


const driverSchema = new Schema(
    {
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
        photo: {
            type: String,
            required: true,
        },
        photoPublicId: {
            type: String,
            required: false,
        },
        vehicleNumber: {
            type: String,
            required: true,
            uppercase: true,
        },
        vehicleType: {
            type: String,
            required: true,
            ref: 'VehicleType',
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model('Driver', driverSchema);