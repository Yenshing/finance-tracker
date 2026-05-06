import { z } from 'zod';
import { db } from '../../db/database';

const EXPORT_VERSION = 1;

const CategorySchema = z.enum(['liquid', 'investment', 'fixed']);
const AssetTypeSchema = z.enum([
  'cash',
  'stock',
  'crypto',
  'real_estate',
  'vehicle',
  'custom',
]);
const BrokerSchema = z.enum(['sub_broker', 'overseas', 'tw_broker']);

const AssetSchema = z.object({
  id: z.number().optional(),
  category: CategorySchema,
  type: AssetTypeSchema,
  name: z.string(),
  currency: z.string(),
  symbol: z.string().optional(),
  quantity: z.number().optional(),
  broker: BrokerSchema.optional(),
  manualValue: z.number().optional(),
  manualUnitPrice: z.number().optional(),
  notes: z.string().optional(),
  archivedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const SnapshotSchema = z.object({
  id: z.number().optional(),
  takenAt: z.number(),
  localDate: z.string(),
  baseCurrency: z.string(),
  totalNetWorth: z.number(),
  byCategory: z.record(CategorySchema, z.number()),
  source: z.enum(['auto', 'manual']),
});

const SettingsSchema = z.object({
  key: z.literal('app'),
  baseCurrency: z.string(),
  lastAutoSnapshotDate: z.string().optional(),
});

export const ExportFileSchema = z.object({
  version: z.number(),
  exportedAt: z.number(),
  settings: SettingsSchema.nullable(),
  assets: z.array(AssetSchema),
  snapshots: z.array(SnapshotSchema),
});

export type ExportFile = z.infer<typeof ExportFileSchema>;

export async function exportAll(): Promise<ExportFile> {
  const [assets, snapshots, rawSettings] = await Promise.all([
    db.assets.toArray(),
    db.snapshots.toArray(),
    db.settings.get('app'),
  ]);
  // Strip non-serializable / machine-local fields (e.g. linkedFile holds a
  // FileSystemFileHandle that doesn't survive JSON round-trips and is
  // intentionally not portable across machines).
  const settings = rawSettings
    ? {
        key: rawSettings.key,
        baseCurrency: rawSettings.baseCurrency,
        ...(rawSettings.lastAutoSnapshotDate !== undefined && {
          lastAutoSnapshotDate: rawSettings.lastAutoSnapshotDate,
        }),
      }
    : null;
  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    settings,
    assets,
    snapshots,
  };
}

export interface ImportSummary {
  assets: number;
  snapshots: number;
  hasSettings: boolean;
}

export function parseImportFile(raw: unknown): ExportFile {
  return ExportFileSchema.parse(raw);
}

export async function replaceAll(file: ExportFile): Promise<ImportSummary> {
  await db.transaction(
    'rw',
    [db.assets, db.snapshots, db.settings, db.priceCache, db.fxCache],
    async () => {
      // Preserve the local machine's linked-file metadata across import — it
      // is intentionally not part of the portable export.
      const existing = await db.settings.get('app');
      const linkedFile = existing?.linkedFile;

      await db.assets.clear();
      await db.snapshots.clear();
      await db.settings.clear();
      // caches are derived; clear them too so stale prices don't bleed in
      await db.priceCache.clear();
      await db.fxCache.clear();

      if (file.settings) {
        await db.settings.put({ ...file.settings, linkedFile });
      } else if (linkedFile) {
        await db.settings.put({
          key: 'app',
          baseCurrency: 'TWD',
          linkedFile,
        });
      }
      if (file.assets.length) await db.assets.bulkAdd(file.assets);
      if (file.snapshots.length) await db.snapshots.bulkAdd(file.snapshots);
    },
  );
  return {
    assets: file.assets.length,
    snapshots: file.snapshots.length,
    hasSettings: file.settings !== null,
  };
}

export function suggestedFileName(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `finance-tracker-${yyyy}-${mm}-${dd}.json`;
}
