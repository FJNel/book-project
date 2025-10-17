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
}); // app.use(start time)

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
}); // app.use(request logging)

//Trust proxy headers for rate-limiting
app.set("trust proxy", 1);

//Middleware: Security and Parsing
app.use(helmet()); // Set HTTP headers for security

app.use(express.json()); // Parse JSON request bodies
// Allow requests from other domains (CORS)
const corsOptions = {
    origin: ['https://bookproject.fjnel.co.za', 'http://127.0.0.1:8000'], // Allow only your frontend
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

//Serve static documentation in the "public" folder
app.use(express.static("public"));



//Routes
app.use("/", rootRoute);
app.use("/users", userRoutes);
app.use("/auth", authRoutes);

//404 Handler
app.use((req, res) => {
    return errorResponse(
        res,
        404,
        "ENDPOINT_NOT_FOUND",
        [
            "ENDPOINT_NOT_FOUND_DETAIL_1",
            "ENDPOINT_NOT_FOUND_DETAIL_2"
        ]
    );
}); // 404 handler

//Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    // Optionally also log unhandled errors to file
    logToFile("UNHANDLED_ERROR", {
        message: err.message,
        stack: process.env.NODE_ENV === "production" ? undefined : err.stack
    }, "error");

    return errorResponse(res, 500, "INTERNAL_SERVER_ERROR", [
        "INTERNAL_SERVER_ERROR_DETAIL",
        err.message
    ]);
}); // global error handler

//Server start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); // app.listen
