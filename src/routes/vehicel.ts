import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import upload from '../config/multer';
import { createVehicle, deleteVehicleType, getVehicleTypeById, getVehicleTypes, updateVehicleType } from '../controllers/VehicleController';

const router = express.Router();


const vehicleTypeValidation = [
    body('type').notEmpty().withMessage('Vehicle type is required'),
];

router.get('/types', getVehicleTypes);
router.get('/types/:id', getVehicleTypeById);
router.post(
    '/types',
    authenticate,
    upload.single('image'),
    vehicleTypeValidation,
    validate,
    createVehicle
);
router.put(
    '/types/:id',
    authenticate,
    upload.single('image'),
    vehicleTypeValidation,
    validate,
    updateVehicleType
);
router.delete(
    '/types/:id',
    authenticate,
    deleteVehicleType
);

export default router;