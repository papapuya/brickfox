/**
 * Base Repository Interface
 * Defines common CRUD operations for all repositories
 */
export interface IRepository<T, CreateDto, UpdateDto> {
  findById(id: string, tenantId?: string): Promise<T | null>;
  findAll(tenantId?: string): Promise<T[]>;
  create(data: CreateDto, tenantId?: string): Promise<T>;
  update(id: string, data: UpdateDto, tenantId?: string): Promise<T>;
  delete(id: string, tenantId?: string): Promise<boolean>;
}

