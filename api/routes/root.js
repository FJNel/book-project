//The root route is used to display a message stating that the API is working as expected
//It also provides a link to the API and database documentation.

const express = require("express");
const router = express.Router();

//Import standard response handlers
const { successResponse } = require("../utils/response");
const config = require("../config");

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
    return successResponse(res, 200, "API_IS_WORKING", {
      timestamp,
      api_documentation_url: config.api.docsUrl
    //   db_documentation_url: `${config.api.baseUrl}/db_documentation.html`,
    });
}); // router.get("/")

module.exports = router;
