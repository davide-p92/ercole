export function validateFrontmatter(data: any, ctx: string) {
	function ensure(field: string) {
		if (!data[field]) {
			throw new Error(`Missing '${field}' in frontmatter: ${ctx}`);
		}
	}

	ensure("id");
	ensure("title");
	ensure("created");
	ensure("updated");

	// ISO date strict
	const iso = /^\d{4}-\d{2}-\d{2}$/;
	if (!iso.test(data.created)) {
		throw new Error(`Invalid ISO date 'created' in ${ctx} (expected YYYY-MM-DD)`);
	}
	if (!iso.test(data.updated)) {
		throw new Error(`Invalid ISO date 'updated' in ${ctx} (expected YYYY-MM-DD)`);
	}

	// Optional fields normalization
	data.tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
	data.links = Array.isArray(data.links) ? data.links.map(String) : [];
	data.status = data.status ?? "active";
}
