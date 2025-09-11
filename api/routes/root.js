//The root route is used to display a message stating that the API is working as expected
//It also provides a link to the API and database documentation.

const express = require("express");
const router = express.Router();

//Import standard response handlers
const { successResponse } = require("../utils/response");

router.get("/", (req, res) => {
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
	return successResponse(res, 200, "The API is working!", {
	  timestamp,
	  api_documentation_url: "https://api.fjnel.co.za/api-docs.html"
	//   db_documentation_url: "https://api.fjnel.co.za/db_documentation.html",
	});
});

module.exports = router;