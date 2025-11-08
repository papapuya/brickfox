/**
 * OpenAPI/Swagger Documentation
 * Auto-generated API documentation
 */

import { Request, Response } from 'express';

const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'PIMPilot API',
    version: '1.0.0',
    description: 'REST API für PIMPilot SaaS - Produktdaten-Management und KI-gestützte Beschreibungen',
    contact: {
      email: 'support@pimpilot.com',
    },
  },
  servers: [
    {
      url: process.env.API_BASE_URL || 'http://localhost:5000',
      description: 'Production Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          articleNumber: { type: 'string' },
          productName: { type: 'string' },
          description: { type: 'string' },
        },
      },
      Supplier: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          url: { type: 'string', format: 'uri' },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health Check',
        description: 'Basic health check endpoint for load balancers',
        tags: ['Health'],
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string' },
                    uptime: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/projects': {
      get: {
        summary: 'List Projects',
        description: 'Get all projects for the authenticated user',
        tags: ['Projects'],
        responses: {
          '200': {
            description: 'List of projects',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    projects: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Project' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create Project',
        description: 'Create a new project',
        tags: ['Projects'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', example: 'My Project' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Project created',
          },
        },
      },
    },
    '/api/products': {
      get: {
        summary: 'List Products',
        description: 'Get all products in a project',
        tags: ['Products'],
        parameters: [
          {
            name: 'projectId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'List of products',
          },
        },
      },
    },
    '/api/suppliers': {
      get: {
        summary: 'List Suppliers',
        description: 'Get all suppliers',
        tags: ['Suppliers'],
        responses: {
          '200': {
            description: 'List of suppliers',
          },
        },
      },
    },
    '/api/pixi/compare': {
      post: {
        summary: 'Compare with Pixi ERP',
        description: 'Compare products with Pixi ERP system',
        tags: ['ERP Integration'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['csvFile', 'supplNr'],
                properties: {
                  csvFile: { type: 'string', format: 'binary' },
                  supplNr: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Comparison results',
          },
        },
      },
    },
    '/api/backups': {
      get: {
        summary: 'List Backups',
        description: 'Get all backups for the tenant',
        tags: ['Backups'],
        responses: {
          '200': {
            description: 'List of backups',
          },
        },
      },
      post: {
        summary: 'Create Backup',
        description: 'Create a manual backup',
        tags: ['Backups'],
        responses: {
          '201': {
            description: 'Backup created',
          },
        },
      },
    },
  },
};

/**
 * Serve OpenAPI specification
 */
export function serveOpenApiSpec(req: Request, res: Response) {
  res.json(openApiSpec);
}

/**
 * Serve Swagger UI (if swagger-ui-express is installed)
 */
export function serveSwaggerUI(req: Request, res: Response) {
  // Basic HTML for Swagger UI
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>PIMPilot API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/openapi.json',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.presets.standalone
      ]
    });
  </script>
</body>
</html>
  `;
  res.send(html);
}

