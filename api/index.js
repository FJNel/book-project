const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

const { success, error } = require("./utils/response");

// Import route handlers
const userRoutes = require("./routes/users");
const borrowerRoutes = require("./routes/borrowers");
const bookRoutes = require("./routes/books");
const authRoutes = require("./routes/auth");

// Initialize Express application
const app = express();

// --------------------
// Middleware
// --------------------

// Trust proxy headers (needed for express-rate-limit behind Cloudflare/Nginx)
app.set("trust proxy", 1);

// Log request start time
app.use((req, res, next) => {
  req._startTime = process.hrtime();
  next();
});

// Security and parsing
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(helmet()); // Set various HTTP headers for security

// Serve static files from the "public" directory
app.use(express.static("public"));

// --------------------
// Routes
// --------------------

// Root endpoint to check if the API is working
app.get("/", (req, res) => {
  const now = new Date();
  const timestamp = now.toLocaleString("en-GB", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return success(res, {
    message: "The Book Project API is working!",
    timestamp,
    api_documentation_url: "https://api.fjnel.co.za/docs/",
    db_documentation_url: "https://api.fjnel.co.za/db_documentation.html",
  });
});

// Feature routes
app.use("/users", userRoutes);
app.use("/borrowers", borrowerRoutes);
app.use("/books", bookRoutes);
app.use("/auth", authRoutes);

// --------------------
// Error Handling
// --------------------

// 404 handler
app.use((req, res) => {
  return error(
    res,
    ["Endpoint not found", "Make sure that you are also using the correct request type!"],
    "Not Found",
    404
  );
});

// General error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  return error(res, ["An unexpected error occurred", err.message], "Internal Server Error", 500);
});

// --------------------
// Server Startup
// --------------------

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});