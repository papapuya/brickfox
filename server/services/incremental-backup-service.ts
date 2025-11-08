/**
 * Incremental Backup Service
 * Only backs up data that has changed since the last backup
 */

import { supabaseAdmin } from '../supabase';
import { logger } from '../utils/logger';

interface IncrementalBackupMetadata {
  lastBackupId: string;
  lastBackupTimestamp: string;
  tablesIncluded: string[];
  recordCounts: Record<string, number>;
  changedRecords: Record<string, number>;
  duration: number;
}

interface IncrementalBackupData {
  [tableName: string]: any[];
}

export class IncrementalBackupService {
  /**
   * Create an incremental backup (only changed data)
   */
  async createIncrementalBackup(options: {
    tenantId?: string;
    userId?: string;
    lastBackupId?: string;
    expiresInDays?: number;
  }): Promise<{ backupId: string; metadata: IncrementalBackupMetadata }> {
    const startTime = Date.now();
    const { tenantId, userId, lastBackupId, expiresInDays = 30 } = options;

    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    try {
      logger.info(`[Incremental Backup] Starting incremental backup for tenant: ${tenantId || 'ALL'}`);

      // Get last backup timestamp
      let lastBackupTimestamp: string | null = null;
      if (lastBackupId) {
        const { data: lastBackup } = await supabaseAdmin
          .from('backups')
          .select('created_at')
          .eq('id', lastBackupId)
          .single();

        if (lastBackup) {
          lastBackupTimestamp = lastBackup.created_at;
        }
      }

      const backupData: IncrementalBackupData = {};
      const recordCounts: Record<string, number> = {};
      const changedRecords: Record<string, number> = {};

      // Get changed records since last backup
      if (tenantId) {
        // Users
        let usersQuery = supabaseAdmin
          .from('users')
          .select('*')
          .eq('tenant_id', tenantId);
        
        if (lastBackupTimestamp) {
          usersQuery = usersQuery.gt('updated_at', lastBackupTimestamp);
        }
        
        const { data: users } = await usersQuery;
        backupData.users = users || [];
        recordCounts.users = users?.length || 0;
        changedRecords.users = users?.length || 0;

        // Projects
        let projectsQuery = supabaseAdmin
          .from('projects')
          .select('*')
          .eq('tenant_id', tenantId);
        
        if (lastBackupTimestamp) {
          projectsQuery = projectsQuery.gt('updated_at', lastBackupTimestamp);
        }
        
        const { data: projects } = await projectsQuery;
        backupData.projects = projects || [];
        recordCounts.projects = projects?.length || 0;
        changedRecords.projects = projects?.length || 0;

        // Products
        let productsQuery = supabaseAdmin
          .from('products_in_projects')
          .select('*')
          .eq('tenant_id', tenantId);
        
        if (lastBackupTimestamp) {
          productsQuery = productsQuery.gt('updated_at', lastBackupTimestamp);
        }
        
        const { data: products } = await productsQuery;
        backupData.products = products || [];
        recordCounts.products = products?.length || 0;
        changedRecords.products = products?.length || 0;

        // Suppliers
        let suppliersQuery = supabaseAdmin
          .from('suppliers')
          .select('*')
          .eq('tenant_id', tenantId);
        
        if (lastBackupTimestamp) {
          suppliersQuery = suppliersQuery.gt('updated_at', lastBackupTimestamp);
        }
        
        const { data: suppliers } = await suppliersQuery;
        backupData.suppliers = suppliers || [];
        recordCounts.suppliers = suppliers?.length || 0;
        changedRecords.suppliers = suppliers?.length || 0;
      } else {
        // Full incremental backup (all tenants)
        // Similar logic but without tenant filter
        logger.warn('[Incremental Backup] Full backup without tenantId - this may be large');
      }

      const duration = Date.now() - startTime;
      const backupDataString = JSON.stringify(backupData);
      const size = Buffer.byteLength(backupDataString, 'utf8');

      const metadata: IncrementalBackupMetadata = {
        lastBackupId: lastBackupId || '',
        lastBackupTimestamp: lastBackupTimestamp || '',
        tablesIncluded: Object.keys(recordCounts),
        recordCounts,
        changedRecords,
        duration,
      };

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Save incremental backup
      const { data: backup, error } = await supabaseAdmin
        .from('backups')
        .insert({
          tenant_id: tenantId || null,
          backup_type: 'scheduled',
          status: 'completed',
          backup_data: backupData,
          size,
          created_by: userId || null,
          expires_at: expiresAt.toISOString(),
          metadata: metadata as any,
        })
        .select()
        .single();

      if (error || !backup) {
        throw new Error(`Failed to save incremental backup: ${error?.message || 'Unknown error'}`);
      }

      logger.info(`[Incremental Backup] Created backup ${backup.id} (${(size / 1024 / 1024).toFixed(2)} MB, ${duration}ms)`);
      logger.info(`[Incremental Backup] Changed records: ${Object.entries(changedRecords).map(([k, v]) => `${k}=${v}`).join(', ')}`);

      return {
        backupId: backup.id,
        metadata,
      };
    } catch (error: any) {
      logger.error(`[Incremental Backup] Failed:`, error);
      throw new Error(`Incremental backup failed: ${error.message}`);
    }
  }

  /**
   * Restore from incremental backup (requires base backup + incremental backups)
   */
  async restoreIncrementalBackup(baseBackupId: string, incrementalBackupIds: string[], tenantId: string) {
    // Implementation would restore base backup first, then apply incremental changes
    logger.info(`[Incremental Backup] Restore from base ${baseBackupId} + ${incrementalBackupIds.length} incremental backups`);
    // TODO: Implement restore logic
  }
}

export const incrementalBackupService = new IncrementalBackupService();

