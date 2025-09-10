const express = require("express"); // Express framework for building web applications
const cors = require("cors");		// Middleware to enable Cross-Origin Resource Sharing
const helmet = require("helmet"); // Middleware to enhance API security
require("dotenv").config();			// Load environment variables from .env file

// Import route handlers
const userRoutes = require("./routes/users");
const borrowerRoutes = require("./routes/borrowers");
const bookRoutes = require("./routes/books");
const authRoutes = require("./routes/auth");
const adminApprovedUsersRoutes = require("./routes/adminApprovedUsers");
const { success, error } = require("./utils/response");

// Initialize Express application
const app = express();

app.set('trust proxy', 1); // Trust proxy headers (needed for express-rate-limit behind Cloudflare/Nginx)

app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON request bodies
app.use(helmet()); // Use Helmet to set various HTTP headers for security
app.use(express.static("public"));

// Middleware to log request start time
app.use((req, res, next) => {
  req._startTime = process.hrtime();
  next();
});

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
    api_documentation_url: "https://api.fjnel.co.za/api_documentation.html",
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
