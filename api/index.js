const express = require("express"); // Express framework for building web applications
// Initialize Express application
const app = express();

// Middleware to log request start time
app.use((req, res, next) => {
  req._startTime = process.hrtime();
  next();
});

const cors = require("cors");		// Middleware to enable Cross-Origin Resource Sharing
const helmet = require("helmet"); // Middleware to enhance API security
const setupSwagger = require("./swagger"); // Swagger setup for API documentation
require("dotenv").config();			// Load environment variables from .env file


// Import route handlers
const userRoutes = require("./routes/users");
const borrowerRoutes = require("./routes/borrowers");
const bookRoutes = require("./routes/books");
const authRoutes = require("./routes/auth");
const adminApprovedUsersRoutes = require("./routes/adminApprovedUsers");
const { success, error } = require("./utils/response");

app.set('trust proxy', 1); // Trust proxy headers (needed for express-rate-limit behind Cloudflare/Nginx)

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(helmet()); // Use Helmet to set various HTTP headers for security
app.use(express.static("public"));
setupSwagger(app); // Setup Swagger for API documentation

//Root endpoint to check is api is working
/**
 * @swagger
 * /:
 *   get:
 *    summary: API Status Check
 *    description: Provides a simple health check for the API. It returns a success message, the current server timestamp, and links to the API and database documentation.
 *    tags: Status
 *    responses: 
 *      '200': 
 *        description: Successful response: The API is running successfully.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                message:
 *                  type: string
 *                  description: A status message indicating the API is operational.
 *                  example: "The Book Project API is working!"
 *                timestamp:
 *                  type: string
 *                  description: The current server date and time.
 *                  example: "10/09/2025, 20:47:15"
 *                api_documentation_url:
 *                  type: string
 *                  description: URL to the detailed API documentation.
 *                db_documentation_url:
 *                  type: string
 *                  description: URL to the database schema documentation.
 *      '500':
 *        description: Internal Server Error: An unexpected error occurred on the server.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties: 
 *                error: 
 *                  type: string
 *                  description: Error message indicating an internal server error.
 *                  example: "An unexpected error occurred"
 */
app.get("/", (req, res) => {
  const now = new Date();
  const timestamp = now.toLocaleString("en-GB", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  return success(res, {
    message: "The Book Project API is working!",
    timestamp,
    api_documentation_url: "https://api.fjnel.co.za/docs/",
    db_documentation_url: "https://api.fjnel.co.za/db_documentation.html"    
  });
});
  
// Routes for different functionalities
app.use("/users", userRoutes);
app.use("/borrowers", borrowerRoutes);
app.use("/books", bookRoutes);
app.use("/auth", authRoutes);
app.use("/admin/approved-users", adminApprovedUsersRoutes);

//404 handler
app.use((req, res) => {
  return error(res, ["Endpoint not found", "Make sure that you are also using the correct request type!"], "Not Found", 404);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  return error(res, ["An unexpected error occurred", err.message], "Internal Server Error", 500);
});

// Start the server on the specified port
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
