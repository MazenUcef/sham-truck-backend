import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cron from 'node-cron';
import https from 'https';
import http from 'http';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import morgan from 'morgan';


import authRoutes from './routes/auth';
import vehicleRoutes from './routes/vehicel';
import connectDB from './config/database';
import orderRoutes from './routes/order';
import offerRoutes from './routes/offer';
import notificationRoutes from './routes/notification';
import ringRoutes from './routes/ring';





dotenv.config();
const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "https://sham-truck-backend-1.onrender.com",
    methods: ["GET", "POST", "put", "DELETE"]
  }
});
connectDB()
app.use(morgan("dev"))
app.use(helmet());


app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req: any, res: any, next: any) => {
  req.io = io;
  next();
});



const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));


app.get('/health', (req, res) => {
  res.status(200).json({
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});


app.use('/api/auth', authRoutes);
app.use('/api/vehicle', vehicleRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ring', ringRoutes);


app.use((err: any, req: any, res: any, next: any) => {
    if (res.headersSent) {
        return next(err);
    }

    console.error(err.stack);

    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            message: 'CORS policy: Request not allowed',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    res.status(err.status || 500).json({
        message: err.message || 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});




io.on('connection', (socket) => {
  console.log('User connected:', socket.id);


  socket.on('join-notification-room', (userId: string, role: string) => {
    if (role === 'user') {
      socket.join(`user-${userId}`);
      console.log(`User ${userId} joined notification room`);
    } else if (role === 'driver') {
      socket.join(`driver-${userId}`);
      console.log(`Driver ${userId} joined notification room`);
    }
  });

  socket.on('subscribe-driver-offers', (driverId: string) => {
    socket.join(`driver-offers-${driverId}`);
    console.log(`Driver ${driverId} subscribed to offers updates`);
  });

  socket.on('unsubscribe-driver-offers', (driverId: string) => {
    socket.leave(`driver-offers-${driverId}`);
    console.log(`Driver ${driverId} unsubscribed from offers updates`);
  });

  socket.on('subscribe-order-offers', (orderId: string) => {
    socket.join(`order-offers-${orderId}`);
    console.log(`Socket ${socket.id} subscribed to order ${orderId} offers`);
  });

  socket.on('unsubscribe-order-offers', (orderId: string) => {
    socket.leave(`order-offers-${orderId}`);
    console.log(`Socket ${socket.id} unsubscribed from order ${orderId} offers`);
  });

  socket.on('subscribe-router-orders', (routerId: string) => {
    socket.join(`router-orders-${routerId}`);
    console.log(`Router ${routerId} subscribed to orders updates`);
  });

  socket.on('unsubscribe-router-orders', (routerId: string) => {
    socket.leave(`router-orders-${routerId}`);
    console.log(`Router ${routerId} unsubscribed from orders updates`);
  });

  socket.on('subscribe-driver-orders', (driverId: string) => {
    socket.join(`driver-orders-${driverId}`);
    console.log(`Driver ${driverId} subscribed to available orders`);
  });

  socket.on('unsubscribe-driver-orders', (driverId: string) => {
    socket.leave(`driver-orders-${driverId}`);
    console.log(`Driver ${driverId} unsubscribed from available orders`);
  });

  socket.on('ring-answered', (data: { ringId: string; answered: boolean }) => {
    io.to(`ring-${data.ringId}`).emit('ring-response', data);
  });


  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });


  socket.on('join-driver-room', (driverId) => {
    socket.join(`driver-${driverId}`);
    console.log(`Driver ${driverId} joined their room`);
  });


  socket.on('join-order-room', (orderId) => {
    socket.join(`order-${orderId}`);
    console.log(`Socket ${socket.id} joined order room ${orderId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});


app.set('io', io);

const pingServer = () => {
  const protocol = process.env.NODE_ENV === 'production' ? https : http;
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

  protocol.get(`${baseUrl}/health`, (res) => {
    console.log(`Ping successful at ${new Date().toISOString()}, Status: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('Ping failed:', err.message);
  });
};


cron.schedule('*/14 * * * *', () => {
  console.log('Pinging server to keep it awake...');
  pingServer();
});


setTimeout(pingServer, 80);

const PORT = process.env.PORT || 80;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;