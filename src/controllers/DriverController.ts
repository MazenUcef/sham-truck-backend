import { Request, Response } from "express";
import Driver from "../models/Driver";
import { hashPassword, comparePassword } from "../utils/password";
import { deleteFromCloudinary, uploadToCloudinary } from "../utils/cloudinary";


export const getDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const drivers = await Driver.find().select('-password').populate('vehicleType');
    res.json(drivers);
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const getDriverById = async (req: Request, res: Response): Promise<void> => {
  try {
    const driver = await Driver.findById(req.params.id).select('-password').populate('vehicleType');
    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }
    res.json(driver);
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateDriver = async (req: Request, res: Response): Promise<void> => {
  let photoPublicId = '';
  
  try {
    const { fullName, phoneNumber, vehicleNumber, vehicleType } = req.body;
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }


    if (req.file) {
      try {
        if (driver.photoPublicId) {
          await deleteFromCloudinary(driver.photoPublicId);
        }

        const uploadResult = await uploadToCloudinary(req.file);
        driver.photo = uploadResult.secure_url;
        driver.photoPublicId = uploadResult.public_id;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        res.status(500).json({ message: 'Failed to upload photo' });
        return;
      }
    }

    driver.fullName = fullName || driver.fullName;
    driver.phoneNumber = phoneNumber || driver.phoneNumber;
    driver.vehicleNumber = vehicleNumber || driver.vehicleNumber;
    driver.vehicleType = vehicleType || driver.vehicleType;

    await driver.save();

    const updatedDriver = await Driver.findById(req.params.id)
      .select('-password')
      .populate('vehicleType');

    res.json({
      message: 'Driver updated successfully',
      driver: updatedDriver
    });
  } catch (error) {
    console.error('Update driver error:', error);
    
    if (photoPublicId) {
      try {
        await deleteFromCloudinary(photoPublicId);
      } catch (deleteError) {
        console.error('Error cleaning up Cloudinary image:', deleteError);
      }
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteDriver = async (req: Request, res: Response): Promise<void> => {
  try {
    const driver = await Driver.findById(req.params.id);
    
    if (!driver) {
      res.status(404).json({ message: 'Driver not found' });
      return;
    }

    if (driver.photoPublicId) {
      try {
        await deleteFromCloudinary(driver.photoPublicId);
      } catch (deleteError) {
        console.error('Error deleting Cloudinary image:', deleteError);
      }
    }

    await Driver.findByIdAndDelete(req.params.id);

    res.json({ message: 'Driver deleted successfully' });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const changeDriverPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const driver = await Driver.findById(req.params.id);
    
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

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


export const getDriversByVehicleType = async (req: Request, res: Response): Promise<void> => {
  try {
    const drivers = await Driver.find({ 
      vehicleType: req.params.vehicleTypeId 
    }).select('-password').populate('vehicleType');
    
    res.json(drivers);
  } catch (error) {
    console.error('Get drivers by vehicle type error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};