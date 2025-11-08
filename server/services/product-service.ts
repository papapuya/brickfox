import { IProductRepository, SupabaseProductRepository } from '../repositories/product-repository';
import { IProjectRepository, SupabaseProjectRepository } from '../repositories/project-repository';
import type { ProductInProject, CreateProductInProject, UpdateProductInProject } from '@shared/schema';
import { NotFoundError, AuthorizationError } from '../utils/errors';
import type { User } from '@shared/schema';

export class ProductService {
  constructor(
    private productRepository: IProductRepository = new SupabaseProductRepository(),
    private projectRepository: IProjectRepository = new SupabaseProjectRepository()
  ) {}

  async getProductById(id: string, user: User): Promise<ProductInProject> {
    const product = await this.productRepository.findById(id, user.tenantId);
    
    if (!product) {
      throw new NotFoundError('Product');
    }

    // Verify project ownership if projectRepository is available
    if (this.projectRepository) {
      const project = await this.projectRepository.findById(product.projectId, user.id, user.tenantId);
      if (!project) {
        throw new AuthorizationError('Keine Berechtigung für dieses Produkt');
      }
    }

    return product;
  }

  async getProductsByProject(projectId: string, user: User): Promise<ProductInProject[]> {
    // Verify project ownership
    if (this.projectRepository) {
      const project = await this.projectRepository.findById(projectId, user.id, user.tenantId);
      if (!project) {
        throw new AuthorizationError('Keine Berechtigung für dieses Projekt');
      }
    }

    return this.productRepository.findByProjectId(projectId, user.tenantId);
  }

  async createProduct(data: CreateProductInProject, user: User): Promise<ProductInProject> {
    // Verify project ownership
    if (this.projectRepository) {
      const project = await this.projectRepository.findById(data.projectId, user.id, user.tenantId);
      if (!project) {
        throw new AuthorizationError('Keine Berechtigung für dieses Projekt');
      }
    }

    return this.productRepository.create(data, user.tenantId);
  }

  async updateProduct(id: string, data: UpdateProductInProject, user: User): Promise<ProductInProject> {
    // Verify product ownership
    const existingProduct = await this.getProductById(id, user);

    return this.productRepository.update(id, data, user.tenantId);
  }

  async deleteProduct(id: string, user: User): Promise<boolean> {
    // Verify product ownership
    await this.getProductById(id, user);

    return this.productRepository.delete(id, user.tenantId);
  }
}

