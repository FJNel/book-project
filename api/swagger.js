const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Book Project API',
      version: '1.0.0',
      description: "API for the Book Project, providing status and documentation links."
    },
    servers: [
      { url: 'https://api.fjnel.co.za', description: "Production server" }
    ],
  },
  apis: ['./index.js',
	'./routes/*.js'], // Path to your route files for JSDoc comments
};

const swaggerSpec = swaggerJSDoc(options);

function setupSwagger(app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = setupSwagger;