// The funding sources this release ships (CLAUDE.md rule 6). The build validates each file
// against schemas/funding-source.schema.json, so the casts below are safe.
import type { FundingSourceConfig } from '../core/types';
import regenGeneralOperating from './regen-general-operating.json';
import tisupp from './tisupp.json';

export const FUNDING_SOURCES = [tisupp, regenGeneralOperating] as FundingSourceConfig[];

export function findFundingSource(id: string): FundingSourceConfig | undefined {
  return FUNDING_SOURCES.find((source) => source.id === id);
}
