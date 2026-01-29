const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const yaml = require("yaml");

const { errorResponse } = require("./utils/response");
const { logToFile } = require("./utils/logging");
const { attachCorrelationId, createRequestLogger } = require("./utils/request-logger");
const { corsOptions, applyCorsHeaders } = require("./utils/cors-config");

//Start the Express app
const app = express();

const setStage = (label) => (req, res, next) => {
	req._debugStage = label;
	next();
};

// Health check endpoint (very top-level, no middleware)
app.get('/__ping', (req, res) => {
	res.status(200).send('pong');
  });

// Simple request logger for debugging
app.use((req, res, next) => {
	console.log('[REQ]', req.method, req.url);
	next();
});

// Request hang watchdog for diagnostics
app.use((req, res, next) => {
	req._debugStage = 'entry';
	const timeoutMs = Number(process.env.REQUEST_HANG_TIMEOUT_MS || 3000);
	const timer = setTimeout(() => {
		console.error('[HANG]', req.method, req.originalUrl || req.url, 'stage=', req._debugStage);
	}, timeoutMs);
	res.on('finish', () => clearTimeout(timer));
	res.on('close', () => clearTimeout(timer));
	next();
});

  

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

//Trust proxy headers for rate-limiting
app.set("trust proxy", 1);

// Allow requests from other domains (CORS)
app.use(setStage('cors'));
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

//Middleware: Security and Parsing
app.use(setStage('helmet'));
app.use(helmet()); // Set HTTP headers for security

// Attach correlation id early for request tracing
app.use(setStage('correlation'));
app.use(attachCorrelationId);

// Log all API requests to the database (sanitized + truncated)
app.use(setStage('request-logger'));
app.use(createRequestLogger);

app.use(setStage('json'));
app.use(express.json()); // Parse JSON request bodies

//Serve static documentation in the "public" folder
app.use(setStage('static'));
app.use(express.static("public"));

// OpenAPI single source of truth: load YAML once (cached in prod) and serve via /openapi.yaml and /docs
const isProduction = process.env.NODE_ENV === "production";
const openApiPath = path.join(__dirname, "docs", "openapi.yaml");
let cachedOpenApiYaml = "";
const loadOpenApiSpec = () => {
	cachedOpenApiYaml = fs.readFileSync(openApiPath, "utf8");
	yaml.parse(cachedOpenApiYaml);
};

// Initial load; in production we keep it cached until restart
loadOpenApiSpec();

app.get("/openapi.yaml", setStage('route:/openapi.yaml'), (req, res, next) => {
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

app.use("/docs", setStage('route:/docs'), swaggerUi.serve, swaggerUi.setup(null, swaggerUiOptions));

//Routes
app.use((req, res, next) => {
	req._debugStage = 'routes';
	next();
});
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

//Routes
app.use(setStage('routes'));
app.use("/", setStage('route:/'), rootRoute);
app.use("/users", setStage('route:/users'), userRoutes);
app.use("/auth", setStage('route:/auth'), authRoutes);
app.use("/temp", setStage('route:/temp'), tempRoutes);
app.use("/booktype", setStage('route:/booktype'), bookTypeRoutes);
app.use("/author", setStage('route:/author'), authorRoutes);
app.use("/publisher", setStage('route:/publisher'), publisherRoutes);
app.use("/bookseries", setStage('route:/bookseries'), bookSeriesRoutes);
app.use("/bookseriesbooks", setStage('route:/bookseriesbooks'), bookSeriesBooksRoutes);
app.use("/bookauthor", setStage('route:/bookauthor'), bookAuthorRoutes);
app.use("/languages", setStage('route:/languages'), languageRoutes);
app.use("/book", setStage('route:/book'), bookRoutes);
app.use("/books", setStage('route:/books'), bookRoutes);
app.use("/storagelocation", setStage('route:/storagelocation'), storageLocationRoutes);
app.use("/bookcopy", setStage('route:/bookcopy'), bookCopyRoutes);
app.use("/tags", setStage('route:/tags'), tagRoutes);
app.use("/booktags", setStage('route:/booktags'), bookTagRoutes);
app.use("/timeline", setStage('route:/timeline'), timelineRoutes);
app.use("/admin", setStage('route:/admin'), adminRoutes);
app.use("/search", setStage('route:/search'), searchRoutes);
app.use("/", setStage('route:/import-export'), importExportRoutes);
app.use("/logs", setStage('route:/logs'), logRoutes);
app.use("/authors", setStage('route:/authors'), authorRoutes);
app.use("/publishers", setStage('route:/publishers'), publisherRoutes);
app.use("/bookauthors", setStage('route:/bookauthors'), bookAuthorRoutes);
app.use("/seriesbooks", setStage('route:/seriesbooks'), bookSeriesBooksRoutes);
		method: req.method,
		path: req.originalUrl || req.url,
		correlation_id: req.correlationId || null
	}, "error");

	return errorResponse(res, 500, "Internal Server Error", [
		"An unexpected error occurred",
		err.message
	]);
}); // global error handler

module.exports = app;
