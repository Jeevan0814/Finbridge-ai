export async function fetchNav(fundId: string) {
  // TODO: Praneeth — live mfapi.in + cached fallback
  return { fundId, nav: 123.45, asOf: new Date().toISOString() };
}
