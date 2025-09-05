//Returns a standardized success or error response
function success(res, data = {}, message = "Success", httpCode = 200) {
  return res.status(httpCode).json({
    status: "success",
    httpCode,
    timestamp: new Date().toISOString(),
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
    message,
    data: {}, //Empty object for consistency
    errors
  });
}

// Export the functions for use in other files
module.exports = { success, error };
