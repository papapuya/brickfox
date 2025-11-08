import { IProjectRepository, SupabaseProjectRepository } from '../repositories/project-repository';
import type { Project, CreateProject } from '@shared/schema';
import { NotFoundError, AuthorizationError } from '../utils/errors';
import type { User } from '@shared/schema';

export class ProjectService {
  constructor(
    private projectRepository: IProjectRepository = new SupabaseProjectRepository()
  ) {}

  async getProjectById(id: string, user: User): Promise<Project> {
    const project = await this.projectRepository.findById(id, user.id, user.tenantId);
    
    if (!project) {
      throw new NotFoundError('Project');
    }

    // Check authorization (user must own project or be admin)
    if (!user.isAdmin && project.userId !== user.id) {
      throw new AuthorizationError('Keine Berechtigung für dieses Projekt');
    }

    return project;
  }

  async getProjects(user: User): Promise<Project[]> {
    if (user.isAdmin) {
      // Admins can see all projects in their tenant
      return this.projectRepository.findAll(user.tenantId);
    }
    
    return this.projectRepository.findByUserId(user.id, user.tenantId);
  }

  async createProject(data: CreateProject, user: User): Promise<Project> {
    return this.projectRepository.create(data, user.id, user.tenantId);
  }

  async updateProject(id: string, data: Partial<CreateProject>, user: User): Promise<Project> {
    // Verify ownership
    await this.getProjectById(id, user);

    return this.projectRepository.update(id, data, user.id, user.tenantId);
  }

  async deleteProject(id: string, user: User): Promise<boolean> {
    // Verify ownership
    await this.getProjectById(id, user);

    return this.projectRepository.delete(id, user.id, user.tenantId);
  }
}

