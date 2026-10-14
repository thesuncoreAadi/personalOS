import { describe, expect, it } from 'vitest';
import {
  commercialFunnel,
  contentOutputByWeek,
  dealFunnel,
  engagementRate,
  followerGrowth,
  inquiryRate,
  interactions,
  leadRate,
  metricTotals,
  metricsByWeek,
} from '../metrics';
import type { AccountMetric, BrandDeal, ContentItem } from '../../types';

const metric = (over: Partial<AccountMetric> = {}): AccountMetric => ({
  id: `m${Math.random().toString(36).slice(2, 7)}`,
  date: '2026-10-12',
  views: 1000,
  reach: 800,
  likes: 50,
  comments: 5,
  shares: 4,
  saves: 11,
  watchTimeMinutes: 400,
  followers: 1000,
  profileVisits: 30,
  inquiries: 2,
  leads: 1,
  createdAt: '2026-10-12',
  ...over,
});

const deal = (over: Partial<BrandDeal> = {}): BrandDeal => ({
  id: `d${Math.random().toString(36).slice(2, 7)}`,
  brand: 'Brand',
  contact: '',
  contactLink: '',
  pitchLink: '',
  stage: 'prospect',
  deliverable: '',
  quotedFee: 0,
  agreedFee: 0,
  contractStatus: 'none',
  paymentStatus: 'none',
  amountReceived: 0,
  notes: '',
  nextAction: '',
  createdAt: '2026-10-01',
  ...over,
});

describe('engagement and conversion rates', () => {
  it('computes engagement rate from reach', () => {
    expect(engagementRate(metric())).toBeCloseTo(((50 + 5 + 4 + 11) / 800) * 100);
  });

  it('returns null instead of guessing when reach is zero', () => {
    expect(engagementRate(metric({ reach: 0 }))).toBeNull();
  });

  it('sums interactions', () => {
    expect(interactions(metric())).toBe(70);
  });

  it('computes lead and inquiry rates with their documented denominators', () => {
    expect(leadRate(metric())).toBeCloseTo(0.1);
    expect(leadRate(metric({ views: 0 }))).toBeNull();
    expect(inquiryRate(metric())).toBeCloseTo((2 / 30) * 100);
    // falls back to reach when profile visits are not recorded
    expect(inquiryRate(metric({ profileVisits: 0 }))).toBeCloseTo((2 / 800) * 100);
    expect(inquiryRate(metric({ profileVisits: 0, reach: 0 }))).toBeNull();
  });
});

describe('aggregation', () => {
  it('totals metrics across rows', () => {
    const t = metricTotals([metric(), metric({ views: 500, reach: 400, followers: 1200 })]);
    expect(t.views).toBe(1500);
    expect(t.reach).toBe(1200);
    expect(t.leads).toBe(2);
  });

  it('computes follower growth between first and last rows regardless of input order', () => {
    const g = followerGrowth([metric({ date: '2026-10-12', followers: 1200 }), metric({ date: '2026-09-01', followers: 1000 })]);
    expect(g.delta).toBe(200);
    expect(g.latest).toBe(1200);
    expect(g.pct).toBeCloseTo(20);
  });

  it('buckets metrics by ISO week', () => {
    const weeks = ['2026-10-12', '2026-10-19'];
    const rows = metricsByWeek([metric({ date: '2026-10-14' }), metric({ date: '2026-10-21' })], weeks);
    expect(rows[0].totals.views).toBe(1000);
    expect(rows[1].totals.views).toBe(1000);
  });

  it('counts only published content in output metrics', () => {
    const items: ContentItem[] = [
      { id: 'a', stage: 'published', publishedDate: '2026-10-14', kind: 'short_form' } as ContentItem,
      { id: 'b', stage: 'editing', kind: 'short_form' } as ContentItem,
      { id: 'c', stage: 'published', publishedDate: '2026-10-15', kind: 'portfolio_ad' } as ContentItem,
    ];
    const out = contentOutputByWeek(items, ['2026-10-12']);
    expect(out[0].count).toBe(2);
  });
});

describe('commercial funnel', () => {
  it('counts stages, revenue and rates', () => {
    const deals = [
      deal({ stage: 'prospect' }),
      deal({ stage: 'contacted', outreachDate: '2026-10-01' }),
      deal({ stage: 'replied', outreachDate: '2026-10-02' }),
      deal({ stage: 'negotiating', outreachDate: '2026-10-03' }),
      deal({ stage: 'won', outreachDate: '2026-10-04', agreedFee: 8000, amountReceived: 3000 }),
      deal({ stage: 'lost', outreachDate: '2026-10-05' }),
    ];
    const f = dealFunnel(deals, 2);
    expect(f.total).toBe(6);
    expect(f.prospects).toBe(1);
    expect(f.qualified).toBe(4); // contacted, replied, negotiating, won
    expect(f.outreach).toBe(5);
    expect(f.replied).toBe(3);
    expect(f.negotiating).toBe(2);
    expect(f.won).toBe(1);
    expect(f.lost).toBe(1);
    expect(f.revenueAgreed).toBe(8000);
    expect(f.revenueReceived).toBe(3000);
    expect(f.outstanding).toBe(5000);
    expect(f.portfolioAdsDone).toBe(2);
    expect(f.replyRate).toBeCloseTo((3 / 5) * 100);
    expect(f.winRate).toBeCloseTo(25);
  });

  it('returns null rates rather than dividing by zero', () => {
    const f = dealFunnel([], 0);
    expect(f.replyRate).toBeNull();
    expect(f.winRate).toBeNull();
    expect(f.revenueAgreed).toBe(0);
  });

  it('counts agreed revenue only from won deals', () => {
    const f = dealFunnel([deal({ stage: 'negotiating', agreedFee: 5000 }), deal({ stage: 'won', agreedFee: 2000 })], 0);
    expect(f.revenueAgreed).toBe(2000);
  });
});

describe('end-to-end funnel', () => {
  it('links published content through to paid deals', () => {
    const content: ContentItem[] = [
      { id: 'a', stage: 'published', kind: 'short_form' } as ContentItem,
      { id: 'b', stage: 'idea', kind: 'short_form' } as ContentItem,
    ];
    const steps = commercialFunnel(content, [metric()], [deal({ stage: 'won', outreachDate: '2026-10-01' })]);
    expect(steps.map((s) => s.value)).toEqual([1, 70, 2, 1, 1]);
  });
});
