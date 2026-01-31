/* eslint-disable no-console */
const assert = require("assert");
const bookTypeRouter = require("../api/routes/booktype");

const routePaths = (bookTypeRouter.stack || [])
	.filter((layer) => layer.route && layer.route.path)
	.map((layer) => layer.route.path);

const trashIndex = routePaths.indexOf("/trash");
const idIndex = routePaths.indexOf("/:id");

assert(trashIndex !== -1, "Expected /trash route to exist on book type router.");
assert(idIndex !== -1, "Expected /:id route to exist on book type router.");
assert(
	trashIndex < idIndex,
	`Expected /trash route to be registered before /:id. Got /trash at ${trashIndex}, /:id at ${idIndex}.`
);

console.log("✓ Book type recycle route order verified.");
