import { ISupplierRepository, SupabaseSupplierRepository } from '../repositories/supplier-repository';
import type { Supplier, CreateSupplier, UpdateSupplier } from '@shared/schema';
import { NotFoundError, AuthorizationError } from '../utils/errors';
import type { User } from '@shared/schema';

export class SupplierService {
  constructor(
    private supplierRepository: ISupplierRepository = new SupabaseSupplierRepository()
  ) {}

  async getSupplierById(id: string, user: User, includeCredentials: boolean = false): Promise<Supplier> {
    const supplier = includeCredentials
      ? await this.supplierRepository.findWithCredentials(id, user.id, user.tenantId)
      : await this.supplierRepository.findById(id, user.id, user.tenantId);
    
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    // Check authorization (user must own supplier or be admin)
    if (!user.isAdmin && supplier.userId !== user.id) {
      throw new AuthorizationError('Keine Berechtigung für diesen Lieferanten');
    }

    return supplier;
  }

  async getSuppliers(user: User): Promise<Supplier[]> {
    if (user.isAdmin) {
      // Admins can see all suppliers in their tenant
      return this.supplierRepository.findAll(user.tenantId);
    }
    
    return this.supplierRepository.findByUserId(user.id, user.tenantId);
  }

  async createSupplier(data: CreateSupplier, user: User): Promise<Supplier> {
    return this.supplierRepository.create(data, user.id, user.tenantId);
  }

  async updateSupplier(id: string, data: UpdateSupplier, user: User): Promise<Supplier> {
    // Verify ownership
    await this.getSupplierById(id, user);

    return this.supplierRepository.update(id, data, user.id, user.tenantId);
  }

  async deleteSupplier(id: string, user: User): Promise<boolean> {
    // Verify ownership
    await this.getSupplierById(id, user);

    return this.supplierRepository.delete(id, user.id, user.tenantId);
  }
}

