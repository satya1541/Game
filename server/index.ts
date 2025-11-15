import { config } from "dotenv";
config(); // Load environment variables from .env file

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// CORS configuration with proper security
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Development environment: allow all origins for Replit compatibility
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // Production: only allow specific domains (HTTPS only for security)
    const allowedOrigins = [
      'https://game.thynxai.cloud'
    ];
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: false, // Set to true only if you need cookies/sessions
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Explicit preflight handling for all routes
app.options('*', cors(corsOptions));

// Remove all upload limits for unlimited file sizes
app.use(express.json({ limit: '50gb' }));
app.use(express.urlencoded({ extended: false, limit: '50gb' }));

// Set server timeout to 30 minutes for very large file uploads
app.use((req, res, next) => {
  req.setTimeout(1800000); // 30 minutes
  res.setTimeout(1800000); // 30 minutes
  next();
});

// Optimize for concurrent downloads - no limits on download requests
app.use((req, res, next) => {
  // Enable proper caching for S3 URLs to reduce database hits for same file
  if (req.path.startsWith('/api/download/')) {
    res.set({
      'Cache-Control': 'public, max-age=300', // Cache download URLs for 5 minutes
      'X-Concurrent-Downloads': 'unlimited'
    });
  }
  next();
});

(async () => {
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Handle CORS errors specifically
    if (err.message === 'Not allowed by CORS') {
      return res.status(403).json({ message: 'CORS: Origin not allowed' });
    }
    
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Don't throw the error - this would crash the server
  });

  // API 404 guard - prevent unmatched API routes from falling through to Vite
  app.all('/api/*', (req, res) => {
    res.status(404).json({ 
      message: 'API endpoint not found', 
      method: req.method, 
      path: req.path 
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });

  // Set server timeouts for very large file uploads
  server.timeout = 1800000; // 30 minutes
  server.keepAliveTimeout = 1800000; // 30 minutes
  server.headersTimeout = 1810000; // 30 minutes + 10 seconds
})();
