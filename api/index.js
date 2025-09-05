const express = require("express"); // Express framework for building web applications
const cors = require("cors");		// Middleware to enable Cross-Origin Resource Sharing
require("dotenv").config();			// Load environment variables from .env file

// Import route handlers
const userRoutes = require("./routes/users");
const borrowerRoutes = require("./routes/borrowers");
const bookRoutes = require("./routes/books");

// Initialize Express application
const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON request bodies

// Routes for different functionalities
app.use("/api/users", userRoutes);
app.use("/api/borrowers", borrowerRoutes);
app.use("/api/books", bookRoutes);

// Start the server on the specified port
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
