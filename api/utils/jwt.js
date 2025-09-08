const jwt = require("jsonwebtoken");
const { error } = require("./response");

// Sign a short-lived access token 
function signAccessToken(payload, expiresIn = "15m") {
	//Payload is an object containing data to store in the token, e.g., { id, role }
	//The token will expire after the specified duration
	return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
	//Generates and returnes a JWT signed with the server's secret key
}

//Require a valid JWT (Authorization: Bearer <token>)
function requireAuth(req, res, next) {
	const auth = req.headers.authorization; //Looks for the Authorization header
	if (!auth) {
		return error(res, ["Missing Authorization header"], "Unauthorized", 401);
	}
	const [scheme, token] = auth.split(" "); //Splits the header into scheme and token
	// (i.e. scheme should be Bearer and token should be the JWT)
	if (scheme !== "Bearer") {
		return error(res, ["Authorization header scheme must be Bearer"], "Unauthorized", 401);
	} else if (!token) {
		return error(res, ["Authorization header missing token"], "Unauthorized", 401);
	}
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		//Verifies the token using the server's secret key
		//If valid, decoded will contain the payload (e.g., { id, role })
		//If invalid or expired, an error will be thrown

		req.user = decoded; // { id, role, iat, exp } //Attach the decoded payload to req.user 
		// (i.e. further functions can use req.user.id or req.user.role to identify the user)
		return next(); //Token is valid, proceed to the next middleware/route handler
	} catch (err) {
		//If the token is invalid or expired we send an error
		return error(res, ["Invalid or expired token"], "Unauthorized", 401);
	}
}

// Require one of the roles in 'roles'
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return error(res, ["Insufficient permissions for this action"], "Forbidden", 403);
    }
    next();
  };
}

module.exports = { signAccessToken, requireAuth, requireRole };