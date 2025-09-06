import { config } from "dotenv";
config(); // Load environment variables from .env file

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// CORS configuration to allow uploads from main domain
app.use((req, res, next) => {
  // Allow requests from your main domain
  const allowedOrigins = [
    'https://game.thynxai.cloud',
    'http://game.thynxai.cloud',
    'http://localhost:5000', // For local development
    'https://localhost:5000'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

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
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });

  // Set server timeouts for very large file uploads
  server.timeout = 1800000; // 30 minutes
  server.keepAliveTimeout = 1800000; // 30 minutes
  server.headersTimeout = 1810000; // 30 minutes + 10 seconds
})();
