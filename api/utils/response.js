// This document provides a standard response format for API responses.

function getResponseTime(request) {
	if (!request._startTime) return null;
	const diff = process.hrtime(request._startTime);
	return (diff[0] * 1000 + diff[1] / 1e6).toFixed(2); // ms
} // getResponseTime


// Normalize message to string which means
// if the value is null or undefined, it will be converted to an empty string
// if the value is a string, it will be returned as is
// if the value is an object with a message property, the message will be returned
// otherwise, the value will be converted to a string

function normalizeMessage(value) {
	if (value === null || value === undefined) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (value && typeof value.message === "string") {
		return value.message;
	}
	return String(value);
} // normalizeMessage

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
		message: normalizeMessage(message),
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
function errorResponse(res, httpCode = 500, message = "An error occurred", errors = [], data = {}) {
	if (!Array.isArray(errors)) {
		errors = [errors];
	}
	// Flatten nested error arrays
	try {
		errors = errors.flat ? errors.flat(Infinity) : errors;
	} catch (_) {
		// ignore if not supported; leave as-is
	}
	const resolvedErrors = errors
		.filter(Boolean)
		.map((e) => normalizeMessage(e))
		.filter(Boolean);

	return res.status(httpCode).json({
		status: "error",
		httpCode,
		responseTime: getResponseTime(res.req),
		message: normalizeMessage(message),
		data: data && typeof data === "object" ? data : {},
		errors: resolvedErrors
	});
} // errorResponse

module.exports = { successResponse, errorResponse };
