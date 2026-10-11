export async function findRunTenant(call, slug) {
  // Never create after an incomplete scan: a lost response may have committed.
  for (let offset = 0; offset < 10000; offset += 100) {
    const {tenants} = await call(`platform-tenant-reconcile-${offset}`, `/v1/platform/tenants?offset=${offset}`, {cache:false});
    if (!Array.isArray(tenants) || tenants.length > 100) throw Error('Invalid tenant page');
    const matches = tenants.filter(tenant => tenant.slug === slug);
    if (matches.length > 1) throw Error('Ambiguous qualification tenant');
    if (matches.length) return matches[0];
    if (tenants.length < 100) return null;
  }
  throw Error('Bounded tenant reconciliation exceeded');
}
