import { Request, Response } from 'express';
import VehicleType from '../models/VehicleType';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';

export const getVehicleTypes = async (req: Request, res: Response): Promise<void> => {
    try {
        const vehicleTypes = await VehicleType.find().select('type description image');
        res.json(vehicleTypes);
    } catch (error) {
        console.error('Get vehicle types error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getVehicleTypeById = async (req: Request, res: Response): Promise<void> => {
    try {
        const vehicleType = await VehicleType.findById(req.params.id);
        if (!vehicleType) {
            res.status(404).json({ message: 'Vehicle type not found' });
            return;
        }
        res.json(vehicleType);
    } catch (error) {
        console.error('Get vehicle type error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const createVehicleType = async (req: Request, res: Response): Promise<void> => {
    let imagePublicId = '';

    try {
        const { type, description } = req.body;
        let image = '';

        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file);
                image = uploadResult.secure_url;
                imagePublicId = uploadResult.public_id;
            } catch (uploadError) {
                console.error('Cloudinary upload error:', uploadError);
                res.status(500).json({ message: 'Failed to upload image' });
                return;
            }
        }

        const vehicleType = await VehicleType.create({
            type,
            description,
            image,
            imagePublicId
        });

        res.status(201).json({
            message: 'Vehicle type created successfully',
            vehicleType,
        });
    } catch (error) {
        console.error('Create vehicle type error:', error);

        if (imagePublicId) {
            try {
                await deleteFromCloudinary(imagePublicId);
            } catch (deleteError) {
                console.error('Error cleaning up Cloudinary image:', deleteError);
            }
        }

        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateVehicleType = async (req: Request, res: Response): Promise<void> => {
    let imagePublicId = '';

    try {
        const { type, description } = req.body;
        const vehicleType = await VehicleType.findById(req.params.id);

        if (!vehicleType) {
            res.status(404).json({ message: 'Vehicle type not found' });
            return;
        }

        if (req.file) {
            try {
                if (vehicleType.imagePublicId) {
                    await deleteFromCloudinary(vehicleType.imagePublicId);
                }

                const uploadResult = await uploadToCloudinary(req.file);
                vehicleType.image = uploadResult.secure_url;
                vehicleType.imagePublicId = uploadResult.public_id;
            } catch (uploadError) {
                console.error('Cloudinary upload error:', uploadError);
                res.status(500).json({ message: 'Failed to upload image' });
                return;
            }
        }

        vehicleType.type = type || vehicleType.type;
        vehicleType.description = description || vehicleType.description;

        await vehicleType.save();

        res.json({
            message: 'Vehicle type updated successfully',
            vehicleType,
        });
    } catch (error) {
        console.error('Update vehicle type error:', error);

        if (imagePublicId) {
            try {
                await deleteFromCloudinary(imagePublicId);
            } catch (deleteError) {
                console.error('Error cleaning up Cloudinary image:', deleteError);
            }
        }

        res.status(500).json({ message: 'Internal server error' });
    }
};

export const deleteVehicleType = async (req: Request, res: Response): Promise<void> => {
    try {
        const vehicleType = await VehicleType.findById(req.params.id);

        if (!vehicleType) {
            res.status(404).json({ message: 'Vehicle type not found' });
            return;
        }

        if (vehicleType.imagePublicId) {
            try {
                await deleteFromCloudinary(vehicleType.imagePublicId);
            } catch (deleteError) {
                console.error('Error deleting Cloudinary image:', deleteError);
            }
        }

        await VehicleType.findByIdAndDelete(req.params.id);

        res.json({ message: 'Vehicle type deleted successfully' });
    } catch (error) {
        console.error('Delete vehicle type error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};