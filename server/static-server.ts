import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  // In production, the bundled server is in dist/index.js
  // and static files are in dist/public
  const isProduction = process.env.NODE_ENV === 'production';
  const distPath = isProduction 
    ? path.join(process.cwd(), 'dist', 'public')
    : path.resolve(import.meta.dirname, '..', 'dist', 'public');

  if (!fs.existsSync(distPath)) {
    console.error(`❌ Build directory not found at: ${distPath}`);
    console.error(`Current directory: ${process.cwd()}`);
    console.error(`NODE_ENV: ${process.env.NODE_ENV}`);
    try {
      console.error(`Files in cwd:`, fs.readdirSync(process.cwd()));
      if (fs.existsSync(path.join(process.cwd(), 'dist'))) {
        console.error(`Files in dist:`, fs.readdirSync(path.join(process.cwd(), 'dist')));
      }
    } catch (e) {
      console.error('Could not list files:', e);
    }
    throw new Error(
      `Could not find the build directory: ${distPath}`,
    );
  }

  console.log(`✅ Serving static files from: ${distPath}`);
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

