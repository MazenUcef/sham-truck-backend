import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import Driver, { IDriver } from '../models/Driver';
import Vehicle from '../models/Vehicle';
import { generateToken } from '../utils/token';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary';
import User from '../models/Router';
import mongoose from 'mongoose';

interface UserSignupData {
    fullName: string;
    email: string;
    password: string;
    phoneNumber: string;
}

interface DriverSignupData extends UserSignupData {
    vehicleNumber: string;
    vehicleTypeId: string;
}

interface UserUpdateData {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
}

interface DriverUpdateData extends UserUpdateData {
  vehicleNumber?: string;
  vehicleTypeId?: string;
}


interface LoginData {
    email: string;
    password: string;
    role: 'router' | 'driver';
}

interface ChangePasswordData {
    currentPassword: string;
    newPassword: string;
}

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        role: string;
        fullName: string;
    };
}


export const validateDriverSignup = [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long'),
    body('phoneNumber')
        .trim().notEmpty().withMessage('Full name is required'),
    body('vehicleNumber').trim().notEmpty().withMessage('Vehicle number is required'),
    body('vehicleTypeId').isMongoId().withMessage('Invalid vehicle type ID'),
];


export const validateUserUpdate = [
    body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('phoneNumber')
        .optional()
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage('Invalid phone number'),
];


export const validateDriverUpdate = [
    body('fullName').optional().trim().notEmpty().withMessage('Full name cannot be empty'),
    body('email').optional().isEmail().normalizeEmail().withMessage('Invalid email address'),
    body('phoneNumber')
        .optional()
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage('Invalid phone number'),
    body('vehicleNumber').optional().trim().notEmpty().withMessage('Vehicle number cannot be empty'),
    body('vehicleTypeId').optional().isMongoId().withMessage('Invalid vehicle type ID'),
];


export const signupUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { fullName, email, password, phoneNumber }: UserSignupData = req.body;

        const existingUser = await User.findOne({
            $or: [{ email }, { phoneNumber }]
        });

        if (existingUser) {
            res.status(400).json({
                message: 'User already exists with this email or phone number'
            });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await User.create({
            fullName,
            email,
            password: hashedPassword,
            phoneNumber
        });

        const token = generateToken({
            id: user._id.toString(),
            role: 'router',
            fullName: user.fullName
        });

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: "router"
            }
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error creating user',
            error: error.message
        });
    }
};


export const signupDriver = async (req: Request, res: Response): Promise<void> => {
  let photoPublicId = '';
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { fullName, email, password, phoneNumber, vehicleNumber, vehicleTypeId }: DriverSignupData = req.body;

    // Check for existing user or driver
    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    });
    const existingDriver = await Driver.findOne({
      $or: [{ email }, { phoneNumber }, { vehicleNumber }],
    });

    if (existingUser || existingDriver) {
      res.status(400).json({ errors: [{ msg: 'Email, phone number, or vehicle number already exists', path: 'email or phoneNumber or vehicleNumber' }] });
      return;
    }

    // Validate vehicleTypeId as a MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
      res.status(400).json({ errors: [{ msg: 'Invalid vehicle type ID', path: 'vehicleTypeId', value: vehicleTypeId }] });
      return;
    }

    // Check if vehicle type exists
    const vehicleType = await Vehicle.findById(vehicleTypeId);
    if (!vehicleType) {
      res.status(400).json({ errors: [{ msg: 'Vehicle type not found', path: 'vehicleTypeId' }] });
      return;
    }

    // Handle photo upload
    let photo = '';
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file);
        photo = uploadResult.secure_url;
        photoPublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        res.status(500).json({ errors: [{ msg: 'Failed to upload photo' }] });
        return;
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create driver - store only the vehicleType ID
    const driver = await Driver.create({
      fullName,
      email,
      password: hashedPassword,
      phoneNumber,
      vehicleNumber,
      vehicleType: vehicleTypeId, // Store only the ID
      photo,
      photoPublicId,
    });

    // Generate JWT token
    const token = generateToken({
      id: driver._id.toString(),
      role: 'driver',
      fullName: driver.fullName,
    });

    // Send response with vehicleTypeId
    res.status(201).json({
      message: 'Driver created successfully',
      token,
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        email: driver.email,
        phoneNumber: driver.phoneNumber,
        vehicleNumber: driver.vehicleNumber,
        vehicleTypeId, // Return only the ID
        photo: driver.photo,
        role: 'driver',
      },
    });
  } catch (error: any) {
    console.error('Driver signup error:', error);
    if (photoPublicId) {
      try {
        await deleteFromCloudinary(photoPublicId);
      } catch (deleteError) {
        console.error('Error cleaning up Cloudinary image:', deleteError);
      }
    }
    res.status(500).json({
      errors: [{ msg: 'Error creating driver', error: error.message }],
    });
  }
};


export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id, role } = req.user!;
    if (role !== 'router') {
      res.status(403).json({ message: 'Unauthorized: Only routers can update their profile' });
      return;
    }

    const { fullName, email, phoneNumber }: UserUpdateData = req.body;

    const updateData: UserUpdateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    if (email || phoneNumber) {
      const existingUser = await User.findOne({
        $or: [
          ...(email ? [{ email, _id: { $ne: id } }] : []),
          ...(phoneNumber ? [{ phoneNumber, _id: { $ne: id } }] : []),
        ],
      });
      if (existingUser) {
        res.status(400).json({ message: 'Email or phone number already in use' });
        return;
      }
    }

    const user = await User.findByIdAndUpdate(id, updateData, { new: true });
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
        role: 'router'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Error updating user',
      error: error.message
    });
  }
};


export const updateDriver = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let photoPublicId = '';
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { id, role } = req.user!;
    if (role !== 'driver') {
      res.status(403).json({ message: 'Unauthorized: Only drivers can update their profile' });
      return;
    }

    const { fullName, email, phoneNumber, vehicleNumber, vehicleTypeId }: DriverUpdateData = req.body;

    const updateData: any = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (vehicleNumber) updateData.vehicleNumber = vehicleNumber;
    if (vehicleTypeId) {
      // Validate vehicleTypeId
      if (!mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
        res.status(400).json({ message: 'Invalid vehicle type ID' });
        return;
      }
      
      // Check if vehicle type exists
      const vehicleType = await Vehicle.findById(vehicleTypeId);
      if (!vehicleType) {
        res.status(400).json({ message: 'Vehicle type not found' });
        return;
      }
      
      updateData.vehicleType = vehicleTypeId; // Store only the ID
    }


    if (email || phoneNumber || vehicleNumber) {
      const existingUser = await User.findOne({
        $or: [
          ...(email ? [{ email }] : []),
          ...(phoneNumber ? [{ phoneNumber }] : []),
          ...(vehicleNumber ? [{ vehicleNumber }] : []),
        ],
      });
      const existingDriver = await Driver.findOne({
        $or: [
          ...(email ? [{ email, _id: { $ne: id } }] : []),
          ...(phoneNumber ? [{ phoneNumber, _id: { $ne: id } }] : []),
          ...(vehicleNumber ? [{ vehicleNumber, _id: { $ne: id } }] : []),
        ],
      });
      if (existingUser || existingDriver) {
        res.status(400).json({ message: 'Email, phone number, or vehicle number already in use' });
        return;
      }
    }

    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(req.file);
        updateData.photo = uploadResult.secure_url;
        photoPublicId = uploadResult.public_id;
        updateData.photoPublicId = photoPublicId;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        res.status(500).json({ message: 'Failed to upload photo' });
        return;
      }
    }

    const driver = await Driver.findById(id);
    if (!driver) {
      if (photoPublicId) {
        try {
          await deleteFromCloudinary(photoPublicId);
        } catch (deleteError) {
          console.error('Error cleaning up new Cloudinary image:', deleteError);
        }
      }
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    if (req.file && driver.photoPublicId) {
      try {
        await deleteFromCloudinary(driver.photoPublicId);
      } catch (deleteError) {
        console.error('Error cleaning up old Cloudinary image:', deleteError);
      }
    }

    const updatedDriver = await Driver.findByIdAndUpdate(id, updateData, { new: true });
    if (!updatedDriver) {
      if (photoPublicId) {
        try {
          await deleteFromCloudinary(photoPublicId);
        } catch (deleteError) {
          console.error('Error cleaning up new Cloudinary image:', deleteError);
        }
      }
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    res.json({
      message: 'Driver updated successfully',
      driver: {
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
  } catch (error: any) {
    console.error('Driver update error:', error);
    if (photoPublicId) {
      try {
        await deleteFromCloudinary(photoPublicId);
      } catch (deleteError) {
        console.error('Error cleaning up Cloudinary image:', deleteError);
      }
    }
    res.status(500).json({
      message: 'Error updating driver',
      error: error.message
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, role }: LoginData = req.body;

    let user;
    if (role === 'router') {
      user = await User.findOne({ email });
    } else if (role === 'driver') {
      user = await Driver.findOne({ email });
    } else {
      res.status(400).json({ message: 'Invalid role specified' });
      return;
    }

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      id: user._id.toString(),
      role,
      fullName: user.fullName
    });

    if (role === 'router') {
      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role
        }
      });
    } else {
      const driver = user as IDriver;
      res.json({
        message: 'Login successful',
        token,
        user: {
          id: driver._id,
          fullName: driver.fullName,
          email: driver.email,
          phoneNumber: driver.phoneNumber,
          vehicleNumber: driver.vehicleNumber,
          vehicleType: driver.vehicleType,
          photo: driver.photo,
          role
        }
      });
    }
  } catch (error: any) {
    res.status(500).json({
      message: 'Error during login',
      error: error.message
    });
  }
};


export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }

        const { currentPassword, newPassword }: ChangePasswordData = req.body;
        const { id, role } = req.user!;

        let user;
        if (role === 'router') {
            user = await User.findById(id);
        } else {
            user = await Driver.findById(id);
        }

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Current password is incorrect' });
            return;
        }

        user.password = await bcrypt.hash(newPassword, 12);
        await user.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error: any) {
        res.status(500).json({
            message: 'Error changing password',
            error: error.message
        });
    }
};


export const getUserById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, role } = req.user!;
    if (role !== 'router') {
      res.status(403).json({ message: 'Unauthorized: Only routers can access their profile' });
      return;
    }

    const user = await User.findById(id).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      message: 'User retrieved successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: 'router'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Error retrieving user',
      error: error.message
    });
  }
};

export const getDriverById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, role } = req.user!;
    if (role !== 'driver') {
      res.status(403).json({ message: 'Unauthorized: Only drivers can access their profile' });
      return;
    }

    // Populate vehicleType if you want the full vehicle details
    const driver = await Driver.findById(id).populate('vehicleType').select('-password');
    
    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    res.json({
      message: 'Driver retrieved successfully',
      driver: {
        id: driver._id,
        fullName: driver.fullName,
        email: driver.email,
        phoneNumber: driver.phoneNumber,
        vehicleNumber: driver.vehicleNumber,
        vehicleType: driver.vehicleType, // This will be populated if you used populate()
        vehicleTypeId: driver.vehicleType, // This will be just the ID if not populated
        photo: driver.photo,
        role: 'driver'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Error retrieving driver',
      error: error.message
    });
  }
};