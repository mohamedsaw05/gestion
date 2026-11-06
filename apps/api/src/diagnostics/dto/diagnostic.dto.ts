import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RunScanDto {
  @IsNotEmpty()
  @IsIn(['FULL_SYSTEM', 'TENANT_INTEGRITY', 'ORPHAN_FILES', 'CACHE_AND_INDEX', 'OUTBOX_HEALTH'])
  type!: 'FULL_SYSTEM' | 'TENANT_INTEGRITY' | 'ORPHAN_FILES' | 'CACHE_AND_INDEX' | 'OUTBOX_HEALTH';
}

export class RunRepairDto {
  @IsNotEmpty()
  @IsIn(['RETRY_FAILED_OUTBOX', 'RECALCULATE_STOCK_PROJECTIONS', 'CLEANUP_ORPHAN_FILES', 'PURGE_TEMPORARY_CACHE'])
  repairType!: 'RETRY_FAILED_OUTBOX' | 'RECALCULATE_STOCK_PROJECTIONS' | 'CLEANUP_ORPHAN_FILES' | 'PURGE_TEMPORARY_CACHE';

  @IsOptional()
  @IsString()
  reason?: string;
}
