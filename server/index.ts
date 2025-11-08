import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-supabase";
import { serveStatic, log } from "./static-server";
import { errorHandler } from "./middleware/error-handler";
import { logger } from "./utils/logger";
import fs from 'fs';
import path from 'path';

// Load .env file if it exists
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
        console.log(`Loaded env var: ${key.trim()}=${value ? '***' + value.slice(-4) : 'empty'}`);
      }
    }
  }
} else {
  console.log('No .env file found');
}

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logData: any = {
        method: req.method,
        path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        userId: (req as any).user?.id,
        tenantId: (req as any).tenantId,
      };

      if (capturedJsonResponse) {
        logData.response = capturedJsonResponse;
      }

      // Use Winston logger for structured logging
      if (res.statusCode >= 400) {
        logger.warn('API Request', logData);
      } else {
        logger.info('API Request', logData);
      }

      // Also use old log for compatibility
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    logger.info('🚀 Starting server initialization...');
    // Serve product images statically
    const productImagesPath = path.join(process.cwd(), 'attached_assets', 'product_images');
    app.use('/product-images', express.static(productImagesPath));
    logger.info('Static file server enabled for /product-images');

    logger.info('📋 Registering routes...');
    const server = await registerRoutes(app);
    logger.info('✅ Routes registered successfully');

    // Use centralized error handler
    app.use(errorHandler);

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (process.env.NODE_ENV !== "production") {
      try {
        // Dynamic import to avoid bundling vite in production
        const { setupVite } = await import("./vite");
        await setupVite(app, server);
        log('Vite development server initialized');
      } catch (viteError: any) {
        logger.error('Failed to setup Vite (non-fatal)', { error: viteError.message });
        logger.info('Server will continue without Vite HMR');
        // Continue without Vite - serve static files as fallback
        serveStatic(app);
      }
    } else {
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    const host = '0.0.0.0';
    
    logger.info(`🌐 Starting server on ${host}:${port}...`);
    server.listen({
      port,
      host,
    }, async () => {
      const nodeEnv = process.env.NODE_ENV || 'development';
      logger.info(`✅ Server is now serving on port ${port} (${nodeEnv} mode on ${host})`);
      console.log(`✅ Server ready at http://localhost:${port}`);
      
      // Initialize scheduler for automated tasks
      if (process.env.ENABLE_SCHEDULED_BACKUPS === 'true') {
        const { schedulerService } = await import('./services/scheduler-service');
        logger.info('[Scheduler] Automated backup scheduler initialized');
      }
    });

    server.on('error', (err: any) => {
      logger.error('Server error', { error: err.message, code: err.code });
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use`);
        logger.error('Please stop the process using this port or change the PORT in .env');
      } else {
        logger.error('Server failed to start', { error: err.message });
      }
      process.exit(1);
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
})();
