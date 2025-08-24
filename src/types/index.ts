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
    vehicleTypeId: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface JwtPayload {
  id: string;
  role: 'router' | 'driver' | 'admin';
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
  category?: string;
  image?: string;
  imagePublicId?: string;
}

