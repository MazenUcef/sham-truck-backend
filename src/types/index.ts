import { Request } from 'express';
export interface User {
    _id?: string;
    fullName: string;
    email: string;
    password: string;
    phoneNumber: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Driver {
    _id?: string;
    fullName: string;
    email: string;
    password: string;
    phoneNumber: string;
    photo: string;
    photoPublicId?: string;
    vehicleNumber: string;
    vehicleType: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface JwtPayload {
  id: string;
  role: 'user' | 'driver' | 'admin';
  fullName: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface VehicleType {
  _id?: string;
  type: string;
  description?: string;
  image?: string;
  imagePublicId?: string;
}

