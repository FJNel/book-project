/* Dev-only helper to validate Mailgun metrics aggregation parsing. */

function normalizeMailgunAggregateMetrics(aggregates = {}) {
	if (!aggregates || typeof aggregates !== "object") return {};
	if (aggregates.metrics && typeof aggregates.metrics === "object") {
		return aggregates.metrics;
	}
	return aggregates;
}

const MAILGUN_AGGREGATE_MAP = {
	processed_count: "processedCount",
	sent_count: "sentCount",
	delivered_count: "deliveredCount",
	failed_count: "failedCount",
	opened_count: "openedCount",
	clicked_count: "clickedCount",
	complained_count: "complainedCount",
	unsubscribed_count: "unsubscribedCount"
};

function mapMailgunAggregates(rawAggregates = {}) {
	const metrics = normalizeMailgunAggregateMetrics(rawAggregates);
	const result = {};
	Object.entries(MAILGUN_AGGREGATE_MAP).forEach(([key, mapped]) => {
		const value = metrics?.[key];
		result[mapped] = Number.isFinite(value) ? Number(value) : null;
	});
	return result;
}

const sampleResponse = {
	aggregates: {
		metrics: {
			processed_count: 123,
			sent_count: 120
		}
	},
	items: [{ metrics: { processed_count: 5 } }]
};

const mapped = mapMailgunAggregates(sampleResponse.aggregates);
const used = normalizeMailgunAggregateMetrics(sampleResponse.aggregates)?.processed_count ?? null;

if (mapped.processedCount !== 123 || mapped.sentCount !== 120) {
	throw new Error("Mailgun aggregate mapping failed.");
}
if (used !== 123) {
	throw new Error("Mailgun monthly used extraction failed.");
}

console.log("Mailgun metrics mapping sample passed.");
