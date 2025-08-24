import { Request, Response } from "express";
import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/password";
import Driver from "../models/Driver";

export const getUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { role } = req.query; // Get role from query params

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
            const user = await User.findById(id).select('-password');
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }
            res.json({
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: 'user'
            });
        }
    } catch (error) {
        console.error('Get user/driver error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { fullName, phoneNumber, email, vehicleNumber, vehicleType, role } = req.body;

        if (role === 'driver') {
            const driver = await Driver.findByIdAndUpdate(
                req.params.id,
                { fullName, phoneNumber, email, vehicleNumber, vehicleType },
                { new: true, runValidators: true }
            ).select('-password');

            if (!driver) {
                res.status(404).json({ message: 'Driver not found' });
                return;
            }

            res.json({
                message: 'Driver updated successfully',
                user: {
                    id: driver._id,
                    fullName: driver.fullName,
                    email: driver.email,
                    phoneNumber: driver.phoneNumber,
                    vehicleNumber: driver.vehicleNumber,
                    vehicleType: driver.vehicleType,
                    photo: driver.photo,
                    role: 'driver'
                }
            });
        } else {
            const user = await User.findByIdAndUpdate(
                req.params.id,
                { fullName, phoneNumber, email },
                { new: true, runValidators: true }
            ).select('-password');

            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            res.json({
                message: 'User updated successfully',
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    role: 'user'
                }
            });
        }
    } catch (error) {
        console.error('Update user/driver error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
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
            const user = await User.findById(id);
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            const isPasswordValid = await comparePassword(currentPassword, user.password);
            if (!isPasswordValid) {
                res.status(400).json({ message: 'Current password is incorrect' });
                return;
            }

            const hashedPassword = await hashPassword(newPassword);
            user.password = hashedPassword;
            await user.save();

            res.json({ message: 'User password updated successfully' });
        }
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};