/**
 * Marketing metrics — every formula is explicit and labelled in the UI.
 * Nothing is fetched, estimated or invented: numbers come from manual entry or CSV.
 */
import type { AccountMetric, BrandDeal, ContentItem, DealStage } from '../types';
import { addDays, startOfWeek } from '../lib/date';

export const ENGAGEMENT_FORMULA =
  'Engagement rate = (likes + comments + shares + saves) ÷ reach × 100. If reach is 0 the metric is shown as "n/a" — it is never estimated from followers.';
export const CONVERSION_FORMULA =
  'Lead rate = leads ÷ views × 100. Inquiry rate = inquiries ÷ profile visits × 100 (or ÷ reach when profile visits are not recorded).';

export function engagementRate(m: Pick<AccountMetric, 'likes' | 'comments' | 'shares' | 'saves' | 'reach'>): number | null {
  const denom = m.reach;
  if (!denom || denom <= 0) return null;
  return ((m.likes + m.comments + m.shares + m.saves) / denom) * 100;
}

export function interactions(m: Pick<AccountMetric, 'likes' | 'comments' | 'shares' | 'saves'>): number {
  return m.likes + m.comments + m.shares + m.saves;
}

export function leadRate(m: Pick<AccountMetric, 'leads' | 'views'>): number | null {
  if (!m.views || m.views <= 0) return null;
  return (m.leads / m.views) * 100;
}

export function inquiryRate(m: Pick<AccountMetric, 'inquiries' | 'profileVisits' | 'reach'>): number | null {
  const denom = m.profileVisits > 0 ? m.profileVisits : m.reach;
  if (!denom || denom <= 0) return null;
  return (m.inquiries / denom) * 100;
}

export function metricTotals(metrics: AccountMetric[]) {
  return metrics.reduce(
    (acc, m) => ({
      views: acc.views + m.views,
      reach: acc.reach + m.reach,
      likes: acc.likes + m.likes,
      comments: acc.comments + m.comments,
      shares: acc.shares + m.shares,
      saves: acc.saves + m.saves,
      watchTimeMinutes: acc.watchTimeMinutes + m.watchTimeMinutes,
      profileVisits: acc.profileVisits + m.profileVisits,
      inquiries: acc.inquiries + m.inquiries,
      leads: acc.leads + m.leads,
    }),
    {
      views: 0,
      reach: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      watchTimeMinutes: 0,
      profileVisits: 0,
      inquiries: 0,
      leads: 0,
    },
  );
}

export function followerGrowth(metrics: AccountMetric[]): { delta: number; latest: number; pct: number | null } {
  if (metrics.length === 0) return { delta: 0, latest: 0, pct: null };
  const sorted = metrics.slice().sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].followers;
  const latest = sorted[sorted.length - 1].followers;
  return { delta: latest - first, latest, pct: first > 0 ? ((latest - first) / first) * 100 : null };
}

export function weeklyBucket(iso: string): string {
  return startOfWeek(iso);
}

export function metricsByWeek(metrics: AccountMetric[], weeks: string[]) {
  const map = new Map<string, AccountMetric[]>();
  for (const m of metrics) {
    const key = weeklyBucket(m.date);
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  return weeks.map((w) => {
    const rows = map.get(w) ?? [];
    return { week: w, rows, totals: metricTotals(rows) };
  });
}

export function contentOutputByWeek(content: ContentItem[], weeks: string[]) {
  const map = new Map<string, ContentItem[]>();
  for (const c of content) {
    if (!c.publishedDate) continue;
    const key = weeklyBucket(c.publishedDate);
    const arr = map.get(key) ?? [];
    arr.push(c);
    map.set(key, arr);
  }
  return weeks.map((w) => ({ week: w, items: map.get(w) ?? [], count: (map.get(w) ?? []).length }));
}

export const DEAL_STAGES: DealStage[] = [
  'prospect',
  'researched',
  'contacted',
  'replied',
  'negotiating',
  'won',
  'lost',
];

const QUALIFIED: DealStage[] = ['contacted', 'replied', 'negotiating', 'won'];

export function dealFunnel(deals: BrandDeal[], portfolioAdsDone: number) {
  const count = (s: DealStage) => deals.filter((d) => d.stage === s).length;
  const qualified = deals.filter((d) => QUALIFIED.includes(d.stage)).length;
  const outreach = deals.filter((d) => d.outreachDate).length;
  const replied = count('replied') + count('negotiating') + count('won');
  const negotiating = count('negotiating') + count('won');
  const won = count('won');
  const revenueAgreed = deals.filter((d) => d.stage === 'won').reduce((s, d) => s + d.agreedFee, 0);
  const revenueReceived = deals.reduce((s, d) => s + d.amountReceived, 0);
  return {
    total: deals.length,
    prospects: count('prospect'),
    qualified,
    outreach,
    replied,
    negotiating,
    won,
    lost: count('lost'),
    revenueAgreed,
    revenueReceived,
    portfolioAdsDone,
    replyRate: outreach > 0 ? (replied / outreach) * 100 : null,
    winRate: qualified > 0 ? (won / qualified) * 100 : null,
    outstanding: Math.max(0, revenueAgreed - revenueReceived),
  };
}

export function dueSoon(deals: BrandDeal[], nowISO: string, withinDays = 7): BrandDeal[] {
  return deals.filter((d) => {
    const date = d.followUpDate ?? d.deliverableDue;
    if (!date) return false;
    const diff = Math.round((Date.parse(date) - Date.parse(nowISO)) / 86_400_000);
    return diff <= withinDays;
  });
}

/**
 * The commercial funnel the Overview shows: published content → engagement →
 * inbound interest → outreach → paid deals. Each step is a real count from data.
 */
export function commercialFunnel(
  content: ContentItem[],
  metrics: AccountMetric[],
  deals: BrandDeal[],
) {
  const totals = metricTotals(metrics);
  const f = dealFunnel(deals, 0);
  return [
    { label: 'Published pieces', value: content.filter((c) => c.stage === 'published').length },
    { label: 'Interactions', value: totals.likes + totals.comments + totals.shares + totals.saves },
    { label: 'Inbound inquiries', value: totals.inquiries },
    { label: 'Outreach sent', value: f.outreach },
    { label: 'Paid deals', value: f.won },
  ];
}

export function nextWeekRange(nowISO: string) {
  const start = addDays(startOfWeek(nowISO), 7);
  return { start, end: addDays(start, 6) };
}
