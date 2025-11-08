/**
 * Scheduler Service for automated tasks
 * Handles scheduled backups, cleanup, and other periodic tasks
 */

import { backupService } from './backup-service';
import { logger } from '../utils/logger';

interface ScheduledTask {
  id: string;
  name: string;
  schedule: string; // Cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export class SchedulerService {
  private tasks: Map<string, ScheduledTask> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.initializeDefaultTasks();
  }

  private initializeDefaultTasks() {
    // Daily backup at 2 AM
    this.registerTask({
      id: 'daily-backup',
      name: 'Daily Backup',
      schedule: '0 2 * * *', // 2 AM daily
      enabled: process.env.ENABLE_SCHEDULED_BACKUPS === 'true',
    });

    // Weekly backup on Sunday at 3 AM
    this.registerTask({
      id: 'weekly-backup',
      name: 'Weekly Backup',
      schedule: '0 3 * * 0', // 3 AM on Sunday
      enabled: process.env.ENABLE_SCHEDULED_BACKUPS === 'true',
    });

    // Cleanup expired backups daily at 4 AM
    this.registerTask({
      id: 'cleanup-backups',
      name: 'Cleanup Expired Backups',
      schedule: '0 4 * * *', // 4 AM daily
      enabled: true,
    });
  }

  /**
   * Register a scheduled task
   */
  registerTask(task: ScheduledTask) {
    this.tasks.set(task.id, task);
    
    if (task.enabled) {
      this.scheduleTask(task);
    }
  }

  /**
   * Schedule a task using cron-like intervals
   */
  private scheduleTask(task: ScheduledTask) {
    const cronParts = task.schedule.split(' ');
    if (cronParts.length !== 5) {
      logger.error(`[Scheduler] Invalid cron expression: ${task.schedule}`);
      return;
    }

    // Simple cron parser (minute hour day month weekday)
    const [minute, hour, day, month, weekday] = cronParts;

    const calculateNextRun = (): Date => {
      const now = new Date();
      const next = new Date(now);
      
      // For simplicity, run every hour if minute matches, or daily if hour matches
      // Full cron parser would be more complex
      if (minute !== '*' && parseInt(minute) === now.getMinutes()) {
        next.setHours(now.getHours() + 1);
      } else if (hour !== '*' && parseInt(hour) === now.getHours()) {
        next.setDate(now.getDate() + 1);
      } else {
        next.setMinutes(now.getMinutes() + 1);
      }
      
      return next;
    };

    const runTask = async () => {
      try {
        logger.info(`[Scheduler] Running task: ${task.name}`);
        task.lastRun = new Date();
        
        await this.executeTask(task.id);
        
        task.nextRun = calculateNextRun();
        logger.info(`[Scheduler] Task ${task.name} completed. Next run: ${task.nextRun}`);
      } catch (error: any) {
        logger.error(`[Scheduler] Task ${task.name} failed:`, error);
      }
    };

    // Calculate initial delay
    const nextRun = calculateNextRun();
    const delay = nextRun.getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(() => {
        runTask();
        // Schedule recurring execution
        const interval = this.getIntervalForSchedule(task.schedule);
        if (interval) {
          this.intervals.set(task.id, setInterval(runTask, interval));
        }
      }, delay);
    } else {
      runTask();
    }
  }

  /**
   * Get interval in milliseconds for a cron schedule
   */
  private getIntervalForSchedule(schedule: string): number | null {
    const [minute, hour] = schedule.split(' ');
    
    if (minute !== '*' && hour === '*') {
      // Every X minutes
      return parseInt(minute) * 60 * 1000;
    } else if (minute === '*' && hour !== '*') {
      // Every X hours
      return parseInt(hour) * 60 * 60 * 1000;
    } else if (minute !== '*' && hour !== '*') {
      // Daily at specific time
      return 24 * 60 * 60 * 1000; // 24 hours
    }
    
    return null;
  }

  /**
   * Execute a task by ID
   */
  private async executeTask(taskId: string) {
    switch (taskId) {
      case 'daily-backup':
        await this.runDailyBackup();
        break;
      case 'weekly-backup':
        await this.runWeeklyBackup();
        break;
      case 'cleanup-backups':
        await this.runCleanupBackups();
        break;
      default:
        logger.warn(`[Scheduler] Unknown task: ${taskId}`);
    }
  }

  /**
   * Run daily backup for all tenants
   */
  private async runDailyBackup() {
    try {
      logger.info('[Scheduler] Starting daily backup...');
      
      // Get all tenants (would need tenant service)
      // For now, create backup without tenantId (all data)
      const backup = await backupService.createBackup({
        backupType: 'scheduled',
        expiresInDays: 30, // Keep for 30 days
      });
      
      logger.info(`[Scheduler] Daily backup completed: ${backup.id}`);
    } catch (error: any) {
      logger.error('[Scheduler] Daily backup failed:', error);
      throw error;
    }
  }

  /**
   * Run weekly backup
   */
  private async runWeeklyBackup() {
    try {
      logger.info('[Scheduler] Starting weekly backup...');
      
      const backup = await backupService.createBackup({
        backupType: 'scheduled',
        expiresInDays: 90, // Keep for 90 days
      });
      
      logger.info(`[Scheduler] Weekly backup completed: ${backup.id}`);
    } catch (error: any) {
      logger.error('[Scheduler] Weekly backup failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup expired backups
   */
  private async runCleanupBackups() {
    try {
      logger.info('[Scheduler] Starting backup cleanup...');
      
      const result = await backupService.cleanupExpiredBackups();
      
      logger.info(`[Scheduler] Cleaned up ${result.deleted} expired backups`);
    } catch (error: any) {
      logger.error('[Scheduler] Backup cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get all scheduled tasks
   */
  getTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Enable/disable a task
   */
  setTaskEnabled(taskId: string, enabled: boolean) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    task.enabled = enabled;

    if (enabled) {
      this.scheduleTask(task);
    } else {
      const interval = this.intervals.get(taskId);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(taskId);
      }
    }
  }

  /**
   * Stop all scheduled tasks
   */
  stop() {
    for (const [taskId, interval] of this.intervals) {
      clearInterval(interval);
      logger.info(`[Scheduler] Stopped task: ${taskId}`);
    }
    this.intervals.clear();
  }
}

export const schedulerService = new SchedulerService();

