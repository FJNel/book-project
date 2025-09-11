// This document deals as middleware to validate common input parameters, like name, surname, etc.


//Validate Full Name:
//String
// The user's full name. This allows for flexibility in name formats. 
// Must be between 2 and 255 characters. 
// Only alphabetic characters, spaces, hyphens, full stops and apostrophes are allowed.
function validateFullName(fullName) {
  const errors = [];
  if (typeof fullName !== "string" || !fullName.trim()) {
    errors.push("Full Name must be provided.");
    return errors;
  }
  const name = fullName.trim();
  if (name.length < 2 || name.length > 255) {
    errors.push("Full Name must be between 2 and 255 characters.");
  }
  if (!/^[A-Za-z\s\-.'’]+$/.test(name)) {
    errors.push("Full Name can only contain alphabetic characters, spaces, hyphens, full stops, and apostrophes.");
  }
  return errors;
}

//Validate Preferred Name:
//String
// The user's preferred name. This name will be used in UI elements. 
// Must be between 2 and 100 characters. 
// Only alphabetic characters are allowed.
function validatePreferredName(preferredName) {
  const errors = [];
  if (preferredName === undefined || preferredName === null || preferredName === "") {
    return errors; // Not required
  }
  if (typeof preferredName !== "string") {
    errors.push("Preferred Name must be a string.");
    return errors;
  }
  const name = preferredName.trim();
  if (name.length < 2 || name.length > 100) {
    errors.push("Preferred Name must be between 2 and 100 characters.");
  }
  if (!/^[A-Za-z]+$/.test(name)) {
    errors.push("Preferred Name can only contain alphabetic characters (no spaces or symbols).");
  }
  return errors;
}

//Validate Email:
//String
// Note: This only makes sure that the email is in a valid format! 
// It does not check if the email actually exists or belongs to the user.
// The user's email address which will be used for login. 
// It must be unique. 
// It must be between 5 and 255 characters and follow standard email formatting rules. 
function validateEmail(email) {
  const errors = [];
  if (typeof email !== "string" || !email.trim()) {
    errors.push("Email must be provided.");
    return errors;
  }
  const e = email.trim();
  if (e.length < 5 || e.length > 255) {
    errors.push("Email must be between 5 and 255 characters.");
  }
  // Simple email regex for format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    errors.push("Email format is incorrect.");
  }
  return errors;
}

//Validate Password:
//String
// The user's password. 
// It must be between 10 and 100 characters 
// and include at least one uppercase letter, one lowercase letter, one number, 
// and one special character.
function validatePassword(password) {
  const errors = [];
  if (typeof password !== "string" || !password.trim()) {
    errors.push("Password must be provided.");
    return errors;
  }
  const p = password.trim();
  if (p.length < 10 || p.length > 100) {
    errors.push("Password must be between 10 and 100 characters.");
  }
  if (!/[A-Z]/.test(p)) {
    errors.push("Password must include at least one uppercase letter.");
  }
  if (!/[a-z]/.test(p)) {
    errors.push("Password must include at least one lowercase letter.");
  }
  if (!/[0-9]/.test(p)) {
    errors.push("Password must include at least one number.");
  }
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;/']/g.test(p)) {
    errors.push("Password must include at least one special character.");
  }
  return errors;
}

//Compare Password and ConfirmPassword:
//Strings
// Makes sure that the two passwords match exactly.
function validatePasswordMatch(password, confirmPassword) {
  const errors = [];
  if (typeof password !== "string" || typeof confirmPassword !== "string") {
    errors.push("Both password and confirmPassword must be provided.");
    return errors;
  }
  if (password !== confirmPassword) {
    errors.push("Passwords do not match.");
  }
  return errors;
}

module.exports = {
  validateFullName,
  validatePreferredName,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
};
