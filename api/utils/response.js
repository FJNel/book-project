//Calculate the response time and return it in the response
function getResponseTime(req) {
  if (!req._startTime) return null;
  const diff = process.hrtime(req._startTime);
  return (diff[0] * 1000 + diff[1] / 1e6).toFixed(2); // ms
}

//Returns a standardized success or error response
function success(res, data = {}, message = "Success", httpCode = 200) {
  return res.status(httpCode).json({
    status: "success",
    httpCode,
    timestamp: new Date().toISOString(),
    responseTime: getResponseTime(res.req), //Calculate response time if possible
    message,
    data,
    errors: [] //Empty array for consistency
  });
}

function error(res, errors = [], message = "Error", httpCode = 500) {
  // ensure errors is always an array
  if (!Array.isArray(errors)) errors = [errors];

  return res.status(httpCode).json({
    status: "error",
    httpCode,
    timestamp: new Date().toISOString(),
    responseTime: getResponseTime(res.req), //Calculate response time if possible
    message,
    data: {}, //Empty object for consistency
    errors
  });
}

// Export the functions for use in other files
module.exports = { success, error };
