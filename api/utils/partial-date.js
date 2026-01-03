const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December"
];
const { logToFile } = require("./logging");

function normalizeDateText(value) {
	if (typeof value !== "string") return "";
	return value.trim().replace(/\s+/g, " ");
}

function formatPartialDate(day, month, year) {
	if (day && month && year) return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
	if (!day && month && year) return `${MONTH_NAMES[month - 1]} ${year}`;
	if (!day && !month && year) return String(year);
	return "";
}

function validatePartialDateObject(value, fieldLabel) {
	const errors = [];
	if (value === undefined || value === null) {
		logToFile("PARTIAL_DATE_VALIDATION", { status: "SKIPPED", field: fieldLabel }, "info");
		return errors;
	}
	if (typeof value !== "object") {
		errors.push(`${fieldLabel} must be an object with day, month, year, and text.`);
		logToFile("PARTIAL_DATE_VALIDATION", { status: "FAILURE", field: fieldLabel, reason: "NOT_OBJECT" }, "warn");
		return errors;
	}
	const day = value.day;
	const month = value.month;
	const year = value.year;
	const text = value.text;

	const hasDay = day !== null && day !== undefined;
	const hasMonth = month !== null && month !== undefined;
	const hasYear = year !== null && year !== undefined;

	if (hasDay && (!Number.isInteger(day) || day < 1 || day > 31)) {
		errors.push(`${fieldLabel} day must be between 1 and 31.`);
	}
	if (hasMonth && (!Number.isInteger(month) || month < 1 || month > 12)) {
		errors.push(`${fieldLabel} month must be between 1 and 12.`);
	}
	if (hasYear && (!Number.isInteger(year) || year < 1 || year > 9999)) {
		errors.push(`${fieldLabel} year must be between 1 and 9999.`);
	}

	if (hasDay && !hasMonth) {
		errors.push(`${fieldLabel} month is required when a day is provided.`);
	}
	if (hasMonth && !hasYear) {
		errors.push(`${fieldLabel} year is required when a month is provided.`);
	}

	const textValue = normalizeDateText(text);
	if (!textValue) {
		errors.push(`${fieldLabel} text must be provided.`);
	}

	if (errors.length > 0) {
		logToFile("PARTIAL_DATE_VALIDATION", { status: "FAILURE", field: fieldLabel, errors }, "warn");
		return errors;
	}

	if (hasDay && hasMonth && hasYear) {
		const probe = new Date(year, month - 1, day);
		if (probe.getFullYear() !== year || probe.getMonth() + 1 !== month || probe.getDate() !== day) {
			errors.push(`${fieldLabel} is not a valid calendar date.`);
		}
	}

	const expectedText = formatPartialDate(hasDay ? day : null, hasMonth ? month : null, hasYear ? year : null);
	if (!expectedText) {
		errors.push(`${fieldLabel} must include at least a year.`);
	} else if (expectedText.toLowerCase() !== textValue.toLowerCase()) {
		errors.push(`${fieldLabel} text must match the provided day, month, and year.`);
	}

	if (errors.length > 0) {
		logToFile("PARTIAL_DATE_VALIDATION", { status: "FAILURE", field: fieldLabel, errors }, "warn");
		return errors;
	}

	logToFile("PARTIAL_DATE_VALIDATION", {
		status: "SUCCESS",
		field: fieldLabel,
		day: hasDay ? day : null,
		month: hasMonth ? month : null,
		year: hasYear ? year : null,
		text: textValue
	}, "info");
	return errors;
}

module.exports = {
	normalizeDateText,
	formatPartialDate,
	validatePartialDateObject
};
