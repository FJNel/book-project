// User input validators

function validateName(name) {
  const errors = [];
  if (!name) errors.push("Name is required");
  else {
    if (name.length < 2 || name.length > 100)
      errors.push("Name must be between 2 and 100 characters");
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    if (!nameRegex.test(name))
      errors.push("Name contains invalid characters. Only letters, spaces, hyphens, and apostrophes are allowed");
  }
  return errors;
}

function validateEmail(email) {
  const errors = [];
  if (!email) errors.push("Email is required");
  else {
    if (email.length > 255)
      errors.push("Email must be less than 255 characters");
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email))
      errors.push("Invalid email format");
  }
  return errors;
}

function validatePassword(password) {
  const errors = [];
  if (!password) errors.push("Password is required");
  else {
    if (password.length < 6)
      errors.push("Password must be at least 6 characters");
    if (password.length > 100)
      errors.push("Password must be less than 100 characters");
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
    if (!passwordRegex.test(password))
      errors.push("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
  }
  return errors;
}

function validatePhone(phone) {
  const errors = [];
  if (!phone) errors.push("Phone number is required");
  else {
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone))
      errors.push("Phone number must contain only digits with a length of 10 digits. Do not include country code or special characters (e.g. +27)");
  }
  return errors;
}

function validateRole(role) {
  const errors = [];
  if (role) {
    role = role.toLowerCase().trim();
    if (role !== 'user' && role !== 'admin')
      errors.push("Role must be either 'user' or 'admin'");
  }
  return errors;
}

module.exports = {
  validateName,
  validateEmail,
  validatePassword,
  validatePhone,
  validateRole
};