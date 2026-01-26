const assert = (condition, message) => {
	if (!condition) {
		throw new Error(message);
	}
};

function isLocalHost(host) {
	if (!host) return false;
	const normalized = String(host).trim().toLowerCase();
	return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function buildPgSslConfig(mode, host, ca = '') {
	const explicitMode = Boolean(mode);
	if (!explicitMode && isLocalHost(host)) {
		return { ssl: false, sslMode: 'disable' };
	}

	const effectiveMode = explicitMode ? mode : 'require';
	if (effectiveMode === 'disable') {
		return { ssl: false, sslMode: 'disable' };
	}
	if (effectiveMode === 'allow-self-signed') {
		return { ssl: { rejectUnauthorized: false }, sslMode: 'allow-self-signed' };
	}
	if (effectiveMode === 'verify-ca' || effectiveMode === 'verify-full') {
		if (!String(ca || '').trim()) {
			return { ssl: { rejectUnauthorized: true }, sslMode: 'require' };
		}
		return { ssl: { rejectUnauthorized: true, ca }, sslMode: effectiveMode };
	}
	return { ssl: { rejectUnauthorized: true }, sslMode: 'require' };
}

(function run() {
	const localDefault = buildPgSslConfig('', 'localhost');
	assert(localDefault.ssl === false, 'Localhost default should disable SSL.');

	const remoteDefault = buildPgSslConfig('', 'db.example.com');
	assert(remoteDefault.ssl && remoteDefault.ssl.rejectUnauthorized === true, 'Remote default should require SSL with verification.');

	const allowSelfSigned = buildPgSslConfig('allow-self-signed', 'db.example.com');
	assert(allowSelfSigned.ssl && allowSelfSigned.ssl.rejectUnauthorized === false, 'allow-self-signed should disable cert verification.');

	const verifyCaNoCa = buildPgSslConfig('verify-ca', 'db.example.com');
	assert(verifyCaNoCa.sslMode === 'require', 'verify-ca without CA should fall back to require.');

	console.log('pg-ssl-mode-check passed.');
})();
