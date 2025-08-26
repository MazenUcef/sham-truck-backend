import express from 'express';
import { authenticate } from '../middleware/auth';
import multer from 'multer';
import { changePassword, getDriverById, getUserById, login, signupDriver, signupUser, updateDriver, updateUser, validateDriverSignup, validateDriverUpdate, validateUserUpdate } from '../controllers/AuthController';


const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();


router.post('/signup/user', signupUser);


router.post('/signup/driver', upload.single('photo'), validateDriverSignup, signupDriver);


router.put('/update/user', authenticate, validateUserUpdate, updateUser);


router.put('/update/driver', authenticate, upload.single('photo'), validateDriverUpdate, updateDriver);


router.post('/login', login);


router.put('/change-password', authenticate, changePassword);

router.get('/user/me', authenticate, getUserById);
router.get('/driver/me', authenticate, getDriverById);

export default router;