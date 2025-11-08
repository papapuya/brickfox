import { supabaseAdmin } from '../supabase';
import type { Project, CreateProject } from '@shared/schema';
import { NotFoundError } from '../utils/errors';

export interface IProjectRepository {
  findById(id: string, userId?: string, tenantId?: string): Promise<Project | null>;
  findByUserId(userId: string, tenantId?: string): Promise<Project[]>;
  findAll(tenantId?: string): Promise<Project[]>;
  create(data: CreateProject, userId: string, tenantId?: string): Promise<Project>;
  update(id: string, data: Partial<CreateProject>, userId?: string, tenantId?: string): Promise<Project>;
  delete(id: string, userId?: string, tenantId?: string): Promise<boolean>;
}

export class SupabaseProjectRepository implements IProjectRepository {
  async findById(id: string, userId?: string, tenantId?: string): Promise<Project | null> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return null;
    }

    return this.mapToProject(data);
  }

  async findByUserId(userId: string, tenantId?: string): Promise<Project[]> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToProject(item));
  }

  async findAll(tenantId?: string): Promise<Project[]> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(item => this.mapToProject(item));
  }

  async create(data: CreateProject, userId: string, tenantId?: string): Promise<Project> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const insertData: any = {
      user_id: userId,
      name: data.name,
      description: data.description || null,
    };

    if (tenantId) {
      insertData.tenant_id = tenantId;
    }

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert(insertData)
      .select()
      .single();

    if (error || !project) {
      throw new Error(`Failed to create project: ${error?.message || 'Unknown error'}`);
    }

    return this.mapToProject(project);
  }

  async update(id: string, data: Partial<CreateProject>, userId?: string, tenantId?: string): Promise<Project> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    let query = supabaseAdmin
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: project, error } = await query;

    if (error || !project) {
      throw new NotFoundError('Project');
    }

    return this.mapToProject(project);
  }

  async delete(id: string, userId?: string, tenantId?: string): Promise<boolean> {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    let query = supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', id);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { error } = await query;

    return !error;
  }

  private mapToProject(data: any): Project {
    return {
      id: data.id,
      userId: data.user_id,
      tenantId: data.tenant_id || undefined,
      name: data.name,
      description: data.description || undefined,
      createdAt: data.created_at,
    };
  }
}

