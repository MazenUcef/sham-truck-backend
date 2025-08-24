import { Request, Response } from "express";
import { hashPassword, comparePassword } from "../utils/password";
import Driver from "../models/Driver";
import Router from "../models/Router";
import { deleteFromCloudinary, uploadToCloudinary } from "../utils/cloudinary";

export const getRouters = async (req: Request, res: Response): Promise<void> => {
    try {
        const routers = await Router.find().select('-password');
        res.json(routers);
    } catch (error) {
        console.error('Get routers error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { role } = req.query;

        if (role === 'driver') {
            const driver = await Driver.findById(id).select('-password');
            if (!driver) {
                res.status(404).json({ message: 'Driver not found' });
                return;
            }
            res.json({
                id: driver._id,
                fullName: driver.fullName,
                email: driver.email,
                phoneNumber: driver.phoneNumber,
                vehicleNumber: driver.vehicleNumber,
                vehicleType: driver.vehicleType,
                photo: driver.photo,
                role: 'driver'
            });
        } else {
            const router = await Router.findById(id).select('-password');
            if (!router) {
                res.status(404).json({ message: 'User not found' });
                return;
            }
            res.json({
                id: router._id,
                fullName: router.fullName,
                email: router.email,
                phoneNumber: router.phoneNumber,
                role: 'router'
            });
        }
    } catch (error) {
        console.error('Get user/driver error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
    let photoPublicId = '';
    try {
        const { fullName, phoneNumber, email, vehicleNumber, vehicleType, role } = req.body;

        if (role === 'driver') {
            const updateData: any = { fullName, phoneNumber, email, vehicleNumber, vehicleType };

            if (req.file) {
                try {
                    const uploadResult = await uploadToCloudinary(req.file);
                    updateData.photo = uploadResult.secure_url;
                    updateData.photoPublicId = uploadResult.public_id;
                    photoPublicId = uploadResult.public_id;
                } catch (uploadError) {
                    console.error('Cloudinary upload error:', uploadError);
                    res.status(500).json({ message: 'Failed to upload photo' });
                    return;
                }
            }

            const driver = await Driver.findById(req.params.id).select('-password');
            if (!driver) {
                if (req.file && photoPublicId) {
                    try {
                        await deleteFromCloudinary(photoPublicId);
                    } catch (deleteError) {
                        console.error('Error cleaning up Cloudinary image:', deleteError);
                    }
                }
                res.status(404).json({ message: 'Driver not found' });
                return;
            }

            if (req.file && driver.photoPublicId) {
                try {
                    await deleteFromCloudinary(driver.photoPublicId);
                } catch (deleteError) {
                    console.error('Error deleting old Cloudinary image:', deleteError);
                }
            }

            const updatedDriver = await Driver.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, runValidators: true }
            ).select('-password');

            if (!updatedDriver) {
                if (req.file && photoPublicId) {
                    try {
                        await deleteFromCloudinary(photoPublicId);
                    } catch (deleteError) {
                        console.error('Error cleaning up Cloudinary image:', deleteError);
                    }
                }
                res.status(404).json({ message: 'Driver not found' });
                return;
            }

            res.json({
                message: 'Driver updated successfully',
                user: {
                    id: updatedDriver._id,
                    fullName: updatedDriver.fullName,
                    email: updatedDriver.email,
                    phoneNumber: updatedDriver.phoneNumber,
                    vehicleNumber: updatedDriver.vehicleNumber,
                    vehicleType: updatedDriver.vehicleType,
                    photo: updatedDriver.photo,
                    role: 'driver'
                }
            });
        } else {
            const router = await Router.findByIdAndUpdate(
                req.params.id,
                { fullName, phoneNumber, email },
                { new: true, runValidators: true }
            ).select('-password');

            if (!router) {
                res.status(404).json({ message: 'Router not found' });
                return;
            }

            res.json({
                message: 'Router updated successfully',
                user: {
                    id: router._id,
                    fullName: router.fullName,
                    email: router.email,
                    phoneNumber: router.phoneNumber,
                    role: 'router'
                }
            });
        }
    } catch (error) {
        console.error('Update user/driver error:', error);
        if (req.file && photoPublicId) {
            try {
                await deleteFromCloudinary(photoPublicId);
            } catch (deleteError) {
                console.error('Error cleaning up Cloudinary image:', deleteError);
            }
        }
        res.status(500).json({ message: 'Internal server error' });
    }
};


export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await Router.findByIdAndDelete(req.params.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const changeUserPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { currentPassword, newPassword, role } = req.body;
        const { id } = req.params;

        if (role === 'driver') {
            const driver = await Driver.findById(id);
            if (!driver) {
                res.status(404).json({ message: 'Driver not found' });
                return;
            }

            const isPasswordValid = await comparePassword(currentPassword, driver.password);
            if (!isPasswordValid) {
                res.status(400).json({ message: 'Current password is incorrect' });
                return;
            }

            const hashedPassword = await hashPassword(newPassword);
            driver.password = hashedPassword;
            await driver.save();

            res.json({ message: 'Driver password updated successfully' });
        } else {
            const router = await Router.findById(id);
            if (!router) {
                res.status(404).json({ message: 'Router not found' });
                return;
            }

            const isPasswordValid = await comparePassword(currentPassword, router.password);
            if (!isPasswordValid) {
                res.status(400).json({ message: 'Current password is incorrect' });
                return;
            }

            const hashedPassword = await hashPassword(newPassword);
            router.password = hashedPassword;
            await router.save();

            res.json({ message: 'Router password updated successfully' });
        }
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};