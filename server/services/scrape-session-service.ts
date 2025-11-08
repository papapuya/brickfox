import { IScrapeSessionRepository, SupabaseScrapeSessionRepository, ScrapeSession, CreateScrapeSession, UpdateScrapeSession } from '../repositories/scrape-session-repository';
import type { User } from '@shared/schema';

export class ScrapeSessionService {
  constructor(
    private repository: IScrapeSessionRepository = new SupabaseScrapeSessionRepository()
  ) {}

  async getSession(user: User): Promise<ScrapeSession | null> {
    return this.repository.findByUserId(user.id, user.tenantId);
  }

  async createOrUpdateSession(data: { urlScraper?: any; pdfScraper?: any; generatedDescription?: string }, user: User): Promise<ScrapeSession> {
    // Check if session exists
    const existing = await this.repository.findByUserId(user.id, user.tenantId);

    if (existing) {
      // Merge existing data with new data
      const existingData = existing.scrapedProducts || {};
      const mergedData = {
        urlScraper: data.urlScraper || existingData.urlScraper || null,
        pdfScraper: data.pdfScraper || existingData.pdfScraper || null,
      };

      return this.repository.update(existing.id, {
        scrapedProducts: mergedData,
        generatedDescription: data.generatedDescription || existing.generatedDescription,
      });
    } else {
      // Create new session
      return this.repository.create({
        userId: user.id,
        tenantId: user.tenantId,
        scrapedProducts: {
          urlScraper: data.urlScraper || null,
          pdfScraper: data.pdfScraper || null,
        },
        generatedDescription: data.generatedDescription || null,
      });
    }
  }

  async deleteSession(user: User): Promise<boolean> {
    return this.repository.delete(user.id, user.tenantId);
  }
}

