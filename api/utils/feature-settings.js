const config = require("../config");

function normalizeBoolean(value) {
	return value === true;
}

function buildUserSettings(row = {}) {
	return {
		deweyEnabled: normalizeBoolean(row.dewey_enabled ?? row.deweyEnabled)
	};
}

function buildFeatureState(settings = {}) {
	const available = Boolean(config.features?.dewey?.available);

	return {
		dewey: {
			available,
			enabled: available && normalizeBoolean(settings.deweyEnabled)
		}
	};
}

function buildUserFeatureContext(row = {}) {
	const settings = buildUserSettings(row);

	return {
		settings,
		features: buildFeatureState(settings)
	};
}

module.exports = {
	buildUserSettings,
	buildFeatureState,
	buildUserFeatureContext
};
