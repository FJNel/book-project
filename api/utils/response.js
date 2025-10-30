// This document provides a standard response format for API responses.

function getResponseTime(request) {
	if (!request._startTime) return null;
	const diff = process.hrtime(request._startTime);
	return (diff[0] * 1000 + diff[1] / 1e6).toFixed(2); // ms
} // getResponseTime

//Success Response
// {
// 	"status": "success",
// 	"httpCode": 200,
// 	"responseTime": "15.42", // Response time in milliseconds
// 	"message": "A success message",
// 	"data": {
// 	},
// 	"errors": [] // Always an empty array on success
// }
function successResponse(res, httpCode = 200, message = "Success", data = {}) {
	return res.status(httpCode).json({
		status: "success",
		httpCode,
		responseTime: getResponseTime(res.req),
		message,
		data,
		errors: []
	});
} // successResponse

//Error Response
// {
// 	"status": "error",
// 	"httpCode": 400,
// 	"responseTime": "10.01", // Response time in milliseconds
// 	"message": "A general error message (e.g., 'Validation Error')",
// 	"data": {}, // Always an empty object on error
// 	"errors": [
// 		"Specific error message 1.",
// 		"Specific error message 2."
//   	]
// }
function errorResponse(res, httpCode = 500, message = "An error occurred", errors = []) {
	if (!Array.isArray(errors)) {
		errors = [errors];
	}
	// Flatten nested error arrays
	try {
		errors = errors.flat ? errors.flat(Infinity) : errors;
	} catch (_) {
		// ignore if not supported; leave as-is
	}
	errors = errors
		.filter(Boolean)
		.map((e) => (typeof e === "string" ? e : (e && e.message) || String(e)));

	return res.status(httpCode).json({
		status: "error",
		httpCode,
		responseTime: getResponseTime(res.req),
		message,
		data: {},
		errors
	});
} // errorResponse

module.exports = { successResponse, errorResponse };
