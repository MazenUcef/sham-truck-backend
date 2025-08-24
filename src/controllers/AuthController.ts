import { Request, Response } from "express";
import { Driver as DriverInterface, User as UserInterface } from "../types";
import { comparePassword, hashPassword } from "../utils/password";
import { generateToken } from "../utils/token";
import Driver from "../models/Driver";
import { deleteFromCloudinary, uploadToCloudinary } from "../utils/cloudinary";
import Router from "../models/Router";
import Vehicle from "../models/Vehicle";


export const signUpRouter = async (req: Request, res: Response): Promise<void> => {
    try {
        const { fullName, email, password, phoneNumber }: UserInterface = req.body;
        const existingRouter = await Router.findOne({ email });
        const existingDriver = await Driver.findOne({ email });

        const existingPhoneNumberRouter = await Router.findOne({ phoneNumber });
        const existingPhoneNumberDriver = await Driver.findOne({ phoneNumber });

        if (existingRouter || existingDriver) {
            res.status(400).json({ message: 'Email already exists' });
            return;
        }

        if (existingPhoneNumberRouter || existingPhoneNumberDriver) {
            res.status(400).json({ message: 'Phone number already exists' });
            return;
        }
        const hashedPassword = await hashPassword(password);
        const user = await Router.create({
            fullName,
            email,
            password: hashedPassword,
            phoneNumber,
        })
        const token = generateToken({
            id: user._id.toString(),
            role: 'router',
            fullName: user.fullName
        });
        res.status(201).json({
            message: "User created successfully",
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
            }
        })
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}


export const signUpDriver = async (req: Request, res: Response): Promise<void> => {
    let photoPublicId = '';
    try {
        const { fullName, email, password, phoneNumber, vehicleNumber, vehicleTypeId }: DriverInterface = req.body;
        let photo = '';
        const existingUser = await Router.findOne({ email });
        const existingDriver = await Driver.findOne({ email });

        if (existingUser || existingDriver) {
            res.status(400).json({ message: 'Email already exists' });
            return;
        }

        const vehicleType = await Vehicle.findById(vehicleTypeId);
        if (!vehicleType) {
            res.status(400).json({ message: 'Invalid vehicle type ID' });
            return;
        }

        if (req.file) {
            try {
                const uploadResult = await uploadToCloudinary(req.file);
                photo = uploadResult.secure_url;
                photoPublicId = uploadResult.public_id;
            } catch (uploadError) {
                console.error('Cloudinary upload error:', uploadError);
                res.status(500).json({ message: 'Failed to upload photo' });
                return;
            }
        }
        const hashedPassword = await hashPassword(password);
        const driver = await Driver.create({
            fullName,
            email,
            password: hashedPassword,
            phoneNumber,
            photo,
            photoPublicId,
            vehicleNumber,
            vehicleType: vehicleTypeId,
        });
        const token = generateToken({
            id: driver._id.toString(),
            role: 'driver',
            fullName: driver.fullName
        });
        res.status(201).json({
            message: 'Driver created successfully',
            token,
            driver: {
                id: driver._id,
                fullName: driver.fullName,
                email: driver.email,
                phoneNumber: driver.phoneNumber,
                vehicleNumber: driver.vehicleNumber,
                vehicleType: vehicleType,
                photo: driver.photo,
            },
        });
    } catch (error) {
        console.error('Driver signup error:', error);
        if (photoPublicId) {
            try {
                await deleteFromCloudinary(photoPublicId);
            } catch (deleteError) {
                console.error('Error cleaning up Cloudinary image:', deleteError);
            }
        }
        res.status(500).json({ message: 'Internal server error' });
    }
}


export const signIn = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password, role } = req.body;

        let user;
        let vehicleType = null;

        if (role === 'driver') {
            user = await Driver.findOne({ email }).select('fullName email phoneNumber vehicleType vehicleNumber photo');
            if (!user) {
                const routerAccount = await Router.findOne({ email });
                if (routerAccount) {
                    res.status(400).json({
                        message: 'Email is registered as a router, not a driver. Please login as a router.'
                    });
                    return;
                }
            } else {
                // Fetch the full vehicle type for the driver
                vehicleType = await Vehicle.findById(user.vehicleType);
                if (!vehicleType) {
                    res.status(400).json({ message: 'Driver vehicle type not found' });
                    return;
                }
            }
        } else {
            user = await Router.findOne({ email }).select('fullName email phoneNumber');
            if (!user) {
                const driverAccount = await Driver.findOne({ email });
                if (driverAccount) {
                    res.status(400).json({
                        message: 'Email is registered as a driver, not a router. Please login as a driver.'
                    });
                    return;
                }
            }
        }

        if (!user) {
            res.status(400).json({ message: 'Invalid credentials - no account found with this email' });
            return;
        }

        // Fetch user with password for comparison
        const userWithPassword = role === 'driver'
            ? await Driver.findOne({ email }).select('password')
            : await Router.findOne({ email }).select('password');
        
        if (!userWithPassword) {
            res.status(400).json({ message: 'Invalid credentials - no account found with this email' });
            return;
        }

        const isPasswordValid = await comparePassword(password, userWithPassword.password);
        if (!isPasswordValid) {
            res.status(400).json({ message: 'Invalid credentials - incorrect password' });
            return;
        }

        const token = generateToken({
            id: user._id.toString(),
            role: role as 'router' | 'driver',
            fullName: user.fullName
        });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role,
                ...(role === 'driver' && {
                    vehicleNumber: (user as any).vehicleNumber,
                    vehicleType: vehicleType,
                    photo: (user as any).photo,
                }),
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};