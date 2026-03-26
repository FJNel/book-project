const path = require("path");
const { DataSource } = require("typeorm");

const { buildTypeOrmDataSourceOptions } = require("../db-connection-options");
const entities = require("./entities");

const appDataSource = new DataSource(
	buildTypeOrmDataSourceOptions({
		entities: Object.values(entities),
		migrations: [path.join(__dirname, "migrations", "*.js")],
	})
);

module.exports = appDataSource;
module.exports.appDataSource = appDataSource;
