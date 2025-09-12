const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

//Import standard response handlers
const { successResponse, errorResponse } = require("./utils/response");
const { logToFile, sanitizeInput } = require("./utils/logging");

//Start the Express app
const app = express();

//Import route handlers
const rootRoute = require("./routes/root");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");

//Log start time
app.use((request, response, nextFunction) => {
  request._startTime = process.hrtime();
  nextFunction();
});

// Log all API requests to rotating files
app.use((req, res, next) => {
  res.on("finish", () => {
    const diff = process.hrtime(req._startTime || process.hrtime());
    const durationMs = Number((diff[0] * 1e3 + diff[1] / 1e6).toFixed(2));
    logToFile("HTTP_REQUEST", {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: durationMs,
      ip: req.ip,
      user_agent: req.get("user-agent"),
      user_id: (req.user && req.user.id) || null,
      request_object: sanitizeInput(req.body || {}),
    });
  });
  next();
});

//Trust proxy headers for rate-limiting
app.set("trust proxy", 1);

//Middleware: Security and Parsing
app.use(helmet()); //Set HTTP headers for security
// app.use(cors()); //Enable CORS
app.use(express.json()); //Parse JSON request bodies

//Serve static documentation in the "public" folder
app.use(express.static("public"));

// Allow requests from other domains (CORS)
const corsOptions = {
  origin: 'https://fjnel.co.za', // Allow only your frontend
  credentials: true, // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

//Routes
app.use("/", rootRoute);
app.use("/users", userRoutes);
app.use("/auth", authRoutes);

//404 Handler
app.use((req, res) => {
  return errorResponse(
    res,
    404,
    "Endpoint Not Found",
    [
      "Endpoint not found!",
      "Make sure that you are also using the correct request type!"
    ]
  );
});

//Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  // Optionally also log unhandled errors to file
  logToFile("UNHANDLED_ERROR", {
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack
  }, "error");

  return errorResponse(res, 500, "Internal Server Error", [
    "An unexpected error occurred",
    err.message
  ]);
});

//Server start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});