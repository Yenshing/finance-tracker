import type { Broker } from '../db/types';
import type { Market } from '../services/prices/symbolNormalize';

export interface BrokerMeta {
  code: Broker;
  label: string;
  market: Market;
  currency: string;
  hint: string;
  /** True until backend pricing for this broker's market is implemented. */
  pricingNotYetSupported?: boolean;
}

export const BROKERS: BrokerMeta[] = [
  {
    code: 'sub_broker',
    label: '複委託',
    market: 'US',
    currency: 'USD',
    hint: '例：AAPL、MSFT',
  },
  {
    code: 'overseas',
    label: '海外券商',
    market: 'US',
    currency: 'USD',
    hint: '例：AAPL、MSFT',
  },
  {
    code: 'tw_broker',
    label: '台灣券商',
    market: 'TW',
    currency: 'TWD',
    hint: '例：2330',
    pricingNotYetSupported: true,
  },
];

export const BROKER_BY_CODE: Record<Broker, BrokerMeta> = Object.fromEntries(
  BROKERS.map((b) => [b.code, b]),
) as Record<Broker, BrokerMeta>;
