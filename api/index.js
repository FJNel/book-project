const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();
const config = require("./config");
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const yaml = require("yaml");

//Import standard response handlers
const { successResponse, errorResponse } = require("./utils/response");
const { logToFile, sanitizeInput } = require("./utils/logging");

//Start the Express app
const app = express();

//Import route handlers
const rootRoute = require("./routes/root");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const tempRoutes = require("./routes/temp");
const bookTypeRoutes = require("./routes/booktype");
const authorRoutes = require("./routes/author");
const publisherRoutes = require("./routes/publisher");
const bookSeriesRoutes = require("./routes/bookseries");
const bookAuthorRoutes = require("./routes/bookauthor");
const bookSeriesBooksRoutes = require("./routes/bookseriesbooks");
const languageRoutes = require("./routes/languages");
const bookRoutes = require("./routes/book");
const storageLocationRoutes = require("./routes/storagelocation");
const bookCopyRoutes = require("./routes/bookcopy");
const tagRoutes = require("./routes/tags");
const bookTagRoutes = require("./routes/booktags");
const timelineRoutes = require("./routes/timeline");
const adminRoutes = require("./routes/admin");
const searchRoutes = require("./routes/search");
const importExportRoutes = require("./routes/import-export");
const logRoutes = require("./routes/logs");

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
			http_status: res.statusCode,
			duration_ms: durationMs,
			ip: req.ip,
			user_agent: req.get("user-agent"),
			user_id: (req.user && req.user.id) || null,
			request: sanitizeInput(req.body || {}),
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
	origin: config.cors.allowedOrigins,
	credentials: config.cors.credentials,
	methods: config.cors.methods,
	allowedHeaders: config.cors.allowedHeaders,
	optionsSuccessStatus: config.cors.optionsSuccessStatus,
};
app.use(cors(corsOptions));

//Serve static documentation in the "public" folder
app.use(express.static("public"));

// OpenAPI single source of truth: load YAML once (cached in prod) and serve via /openapi.yaml and /docs
const isProduction = process.env.NODE_ENV === "production";
const openApiPath = path.join(__dirname, "docs", "openapi.yaml");
let cachedOpenApiYaml = "";
let parsedOpenApiObject = null;

const loadOpenApiSpec = () => {
	cachedOpenApiYaml = fs.readFileSync(openApiPath, "utf8");
	parsedOpenApiObject = yaml.parse(cachedOpenApiYaml);
};

// Initial load; in production we keep it cached until restart
loadOpenApiSpec();

app.get("/openapi.yaml", (req, res, next) => {
	try {
		if (!isProduction) {
			loadOpenApiSpec(); // keep hot-reloading in development
		}
		res.type("text/yaml").send(cachedOpenApiYaml);
	} catch (err) {
		next(err);
	}
});

const swaggerUiOptions = {
	swaggerOptions: {
		url: "/openapi.yaml",
		persistAuthorization: true
	},
	customSiteTitle: "Book Project API Docs"
};

app.use("/docs", swaggerUi.serve, swaggerUi.setup(null, swaggerUiOptions));



//Routes
app.use("/", rootRoute);
app.use("/users", userRoutes);
app.use("/auth", authRoutes);
app.use("/temp", tempRoutes);
app.use("/booktype", bookTypeRoutes);
app.use("/author", authorRoutes);
app.use("/publisher", publisherRoutes);
app.use("/bookseries", bookSeriesRoutes);
app.use("/bookseriesbooks", bookSeriesBooksRoutes);
app.use("/bookauthor", bookAuthorRoutes);
app.use("/languages", languageRoutes);
app.use("/book", bookRoutes);
app.use("/books", bookRoutes);
app.use("/storagelocation", storageLocationRoutes);
app.use("/bookcopy", bookCopyRoutes);
app.use("/tags", tagRoutes);
app.use("/booktags", bookTagRoutes);
app.use("/timeline", timelineRoutes);
app.use("/admin", adminRoutes);
app.use("/search", searchRoutes);
app.use("/", importExportRoutes);
app.use("/logs", logRoutes);
app.use("/authors", authorRoutes);
app.use("/publishers", publisherRoutes);
app.use("/bookauthors", bookAuthorRoutes);
app.use("/seriesbooks", bookSeriesBooksRoutes);

//404 Handler
app.use((req, res) => {
	logToFile("ENDPOINT_NOT_FOUND", {
		method: req.method,
		path: req.originalUrl || req.url,
		ip: req.ip,
		user_agent: req.get("user-agent"),
		user_id: (req.user && req.user.id) || null
	}, "warn");
	return errorResponse(
		res,
		404,
		"Endpoint Not Found",
		[
			"Endpoint not found!",
			"Make sure that you are also using the correct request type!"
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

	return errorResponse(res, 500, "Internal Server Error", [
		"An unexpected error occurred",
		err.message
	]);
}); // global error handler

//Server start
const PORT = config.port;
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	logToFile("SERVER_START", {
		port: PORT,
		environment: process.env.NODE_ENV || "development"
	}, "info");
}); // app.listen
