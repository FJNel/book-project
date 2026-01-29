require("dotenv").config();
const config = require("./config");
const { logToFile } = require("./utils/logging");
const app = require("./app");

//Server start
const PORT = config.port;
app.listen(PORT, () => {
	console.log(`Server is running on port ${PORT}`);
	logToFile("SERVER_START", {
		port: PORT,
		environment: process.env.NODE_ENV || "development"
	}, "info");
}); // app.listen
