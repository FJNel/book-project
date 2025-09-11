const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

//Import standard response handlers
const { successResponse, errorResponse } = require("./utils/response");

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

//Trust proxy headers for rate-limiting
app.set("trust proxy", 1);

//Middleware: Security and Parsing
app.use(helmet()); //Set HTTP headers for security
app.use(cors()); //Enable CORS
app.use(express.json()); //Parse JSON request bodies

//Serve static documentation in the "public" folder
app.use(express.static("public"));

//Routes
app.use("/", rootRoute);
// app.use("/users", userRoutes);
// app.use("/auth", authRoutes);

//404 Handler
app.use((req, res) => {
  return errorResponse(
    res,
    404,
    "Endpoint Not Found",
    [
      "Endpoint not found",
      "Make sure that you are also using the correct request type!"
    ]
  );
});

//Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
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