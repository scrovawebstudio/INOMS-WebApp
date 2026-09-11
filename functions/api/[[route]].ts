/**
 * Cloudflare Pages Function Router
 * 
 * Intercepts all /api/* requests on Cloudflare Pages deployments
 * and delegates them to the INOMS Worker engine.
 * Prevents HTTP 405 Method Not Allowed on Cloudflare Pages.
 */

import workerHandler, { Env } from '../../src/worker';

interface PagesContext {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  waitUntil: (promise: Promise<any>) => void;
  next: () => Promise<Response>;
  data: Record<string, any>;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  // If request is OPTIONS, return CORS headers immediately
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-tenant-id, x-requested-with, Cache-Control',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Pass to worker handler
  return workerHandler.fetch(context.request, context.env);
}
