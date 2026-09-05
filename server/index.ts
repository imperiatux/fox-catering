/**
 * Local / Docker server entry point.
 *
 * Serves the pre-built Vite frontend from ../dist and mounts all API
 * handlers using a thin Vercel-to-Express adapter so the same handler
 * code runs both on Vercel and in a standalone Docker container.
 *
 * Storage: when REDIS_URL is set (Docker), api/lib/kv.ts uses ioredis.
 *          Otherwise it uses @vercel/kv (Upstash REST).
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// --------------------------------------------------------------------------
// Handler imports — one per route
// --------------------------------------------------------------------------
import configHandler from '../api/config.js';
import healthHandler from '../api/health.js';
import menuImageHandler from '../api/menu-image.js';
import ordersHandler from '../api/orders.js';
import adminCutoffHandler from '../api/admin/cutoff.js';
import adminLoginHandler from '../api/admin/login.js';
import adminLogoutHandler from '../api/admin/logout.js';
import adminOrdersHandler from '../api/admin/orders.js';
import adminExportHandler from '../api/admin/export.js';
import adminParseMenuHandler from '../api/admin/parse-menu.js';
import adminSettingsHandler from '../api/admin/settings.js';

// --------------------------------------------------------------------------
// Vercel → Express adapter
// --------------------------------------------------------------------------
type VercelHandler = (req: VercelRequest, res: VercelResponse) => unknown;

function adapt(handler: VercelHandler) {
  return (req: Request, res: Response, _next: NextFunction) => {
    // VercelRequest is a superset of IncomingMessage; cast is safe here
    // because Express Request already has query, body, headers, method.
    return handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  };
}

// --------------------------------------------------------------------------
// App
// --------------------------------------------------------------------------
const app = express();

// Parse JSON and URL-encoded bodies (mirrors Vercel's automatic body parsing).
// The parse-menu route uses multipart — bypass body parsing for that route so
// the raw stream reaches busboy inside the handler (same as Vercel's bodyParser:false).
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/admin/parse-menu') return next();
  express.json()(req, res, next);
});
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/admin/parse-menu') return next();
  express.urlencoded({ extended: true })(req, res, next);
});

// Cookie parsing for admin session (no external library needed)
// Express passes raw header; auth.ts parses it manually — nothing to add here.

// --- API routes -----------------------------------------------------------
app.all('/api/config', adapt(configHandler));
app.all('/api/health', adapt(healthHandler));
app.all('/api/menu-image', adapt(menuImageHandler));
app.all('/api/orders', adapt(ordersHandler));
app.all('/api/admin/cutoff', adapt(adminCutoffHandler));
app.all('/api/admin/login', adapt(adminLoginHandler));
app.all('/api/admin/logout', adapt(adminLogoutHandler));
app.all('/api/admin/orders', adapt(adminOrdersHandler));
app.all('/api/admin/export', adapt(adminExportHandler));
app.post('/api/admin/parse-menu', adapt(adminParseMenuHandler));
app.all('/api/admin/settings', adapt(adminSettingsHandler));

// --- Static frontend ------------------------------------------------------
// process.cwd() is the repo root when run via `node dist-server/server/index.js`
const distDir = path.resolve(process.cwd(), 'dist');
app.use(express.static(distDir));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

// --------------------------------------------------------------------------
// Start
// --------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT ?? '3000', 10);
app.listen(PORT, () => {
  console.log(`Fox Catering server running on http://localhost:${PORT}`);
  console.log(`Storage backend: ${process.env.REDIS_URL ? 'Redis (' + process.env.REDIS_URL + ')' : '@vercel/kv'}`);
});
