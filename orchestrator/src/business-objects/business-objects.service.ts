import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../common/db.service';
import type { AuthUser } from '../common/types';
import { validationError } from '../common/errors';
import { contextualize, type BusinessObjectSummary } from './business-object-context';
import { SapIflowClient, type IflowOverride } from './sap-iflow.client';
import { ConnectionsService } from '../connections/connections.service';

export interface BusinessObjectRow {
  id: string;
  org_id: string | null;
  object_code: string;
  object_name: string;
  keywords: string;
  destination_name: string | null;
  odata_service_path: string;
  entity_set: string;
  default_filters: string | null;
  select_fields: string | null;
  date_field: string | null;
  status_field: string | null;
  status_labels: Record<string, string> | null;
  group_by: string | null;
  api_version: string;
  top_limit: number;
  is_active: boolean;
}

export interface BusinessObjectInput {
  object_code: string;
  object_name: string;
  keywords?: string;
  destination_name?: string | null;
  odata_service_path: string;
  entity_set: string;
  default_filters?: string | null;
  select_fields?: string | null;
  date_field?: string | null;
  status_field?: string | null;
  group_by?: string | null;
  api_version?: string;
  top_limit?: number;
  is_active?: boolean;
}

/**
 * Business Object registry (spec App #1): metadata-driven config so functional
 * consultants add SAP OData objects with no code change. The generic query path
 * resolves config here, builds the OData request, and calls the iFlow passthrough.
 */
@Injectable()
export class BusinessObjectsService {
  private readonly logger = new Logger(BusinessObjectsService.name);
  private readonly iflow = new SapIflowClient();

  constructor(
    private readonly db: DbService,
    private readonly connections: ConnectionsService,
  ) {}

  /**
   * Live landscape wins over mock (Phase AD): an active iFlow connection first,
   * else an active S/4HANA/BAH connection, else env vars, else the simulator.
   */
  private async resolveLandscape(orgId?: string | null, entitySet?: string): Promise<IflowOverride | undefined> {
    // With several fixed-endpoint iFlows registered, pick the one bound to this
    // object's entity set — otherwise a Sales Order query would be answered by
    // the material-stock endpoint.
    const iflow = entitySet
      ? await this.connections.resolveForEntitySet(entitySet, orgId)
      : await this.connections.resolveActive('iflow', orgId);
    if (iflow?.url) {
      return iflow as IflowOverride;
    }
    const s4 = await this.connections.resolveActive('s4hana', orgId);
    if (s4?.baseUrl) {
      return s4 as IflowOverride;
    }
    return undefined;
  }

  /** Rows visible to a user: global templates (org_id NULL) plus their org's. */
  async list(user: AuthUser): Promise<BusinessObjectRow[]> {
    const res = await this.db.query<BusinessObjectRow>(
      `SELECT * FROM business_objects
       WHERE org_id IS NULL OR org_id = $1
       ORDER BY object_name`,
      [user.orgId ?? null],
    );
    return res.rows;
  }

  /** Active objects for tool routing / prompt injection. */
  async activeObjects(user: AuthUser): Promise<Array<{ code: string; name: string; keywords: string }>> {
    const rows = await this.list(user);
    return rows
      .filter((r) => r.is_active)
      .map((r) => ({ code: r.object_code, name: r.object_name, keywords: r.keywords }));
  }

  private async resolve(user: AuthUser, objectCode: string): Promise<BusinessObjectRow | null> {
    const res = await this.db.query<BusinessObjectRow>(
      `SELECT * FROM business_objects
       WHERE object_code = $1 AND is_active = true AND (org_id IS NULL OR org_id = $2)
       ORDER BY org_id NULLS LAST
       LIMIT 1`,
      [objectCode, user.orgId ?? null],
    );
    return res.rows[0] ?? null;
  }

  async create(user: AuthUser, input: BusinessObjectInput): Promise<BusinessObjectRow> {
    const res = await this.db.query<BusinessObjectRow>(
      `INSERT INTO business_objects
        (org_id, object_code, object_name, keywords, destination_name, odata_service_path,
         entity_set, default_filters, select_fields, date_field, status_field, group_by,
         api_version, top_limit, is_active, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        user.orgId ?? null,
        input.object_code.trim().toUpperCase(),
        input.object_name,
        input.keywords ?? '',
        input.destination_name ?? null,
        input.odata_service_path,
        input.entity_set,
        input.default_filters ?? null,
        input.select_fields ?? null,
        input.date_field ?? null,
        input.status_field ?? null,
        input.group_by ?? null,
        input.api_version ?? 'v2',
        input.top_limit ?? 50,
        input.is_active ?? true,
        user.displayName,
      ],
    );
    return res.rows[0];
  }

  async update(user: AuthUser, id: string, patch: Partial<BusinessObjectInput>): Promise<BusinessObjectRow> {
    const existing = await this.byId(user, id);
    if (!existing) {
      validationError('business object not found');
    }
    const res = await this.db.query<BusinessObjectRow>(
      `UPDATE business_objects SET
         object_name = COALESCE($2, object_name),
         keywords = COALESCE($3, keywords),
         destination_name = COALESCE($4, destination_name),
         odata_service_path = COALESCE($5, odata_service_path),
         entity_set = COALESCE($6, entity_set),
         default_filters = COALESCE($7, default_filters),
         select_fields = COALESCE($8, select_fields),
         date_field = COALESCE($9, date_field),
         status_field = COALESCE($10, status_field),
         group_by = COALESCE($11, group_by),
         api_version = COALESCE($12, api_version),
         top_limit = COALESCE($13, top_limit),
         is_active = COALESCE($14, is_active),
         modified_by = $15,
         modified_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        patch.object_name ?? null,
        patch.keywords ?? null,
        patch.destination_name ?? null,
        patch.odata_service_path ?? null,
        patch.entity_set ?? null,
        patch.default_filters ?? null,
        patch.select_fields ?? null,
        patch.date_field ?? null,
        patch.status_field ?? null,
        patch.group_by ?? null,
        patch.api_version ?? null,
        patch.top_limit ?? null,
        patch.is_active ?? null,
        user.displayName,
      ],
    );
    return res.rows[0];
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const existing = await this.byId(user, id);
    if (!existing) {
      validationError('business object not found');
    }
    await this.db.query('DELETE FROM business_objects WHERE id = $1', [id]);
  }

  private async byId(user: AuthUser, id: string): Promise<BusinessObjectRow | null> {
    const res = await this.db.query<BusinessObjectRow>(
      'SELECT * FROM business_objects WHERE id = $1 AND (org_id IS NULL OR org_id = $2)',
      [id, user.orgId ?? null],
    );
    return res.rows[0] ?? null;
  }

  /** Ping the object's entity set through the iFlow (or simulator) to validate config. */
  async testConnection(user: AuthUser, id: string): Promise<{ ok: boolean; mode: string; message: string }> {
    const row = await this.byId(user, id);
    if (!row) {
      validationError('business object not found');
    }
    const landscape = await this.resolveLandscape(user.orgId, row!.entity_set);
    return this.iflow.testConnection(row!.odata_service_path, row!.entity_set, landscape);
  }

  /** Format a date-equality clause per OData version (v2 needs a datetime literal). */
  private dateEq(field: string, isoDate: string, apiVersion: string): string {
    return apiVersion === 'v4' ? `${field} eq ${isoDate}` : `${field} eq datetime'${isoDate}T00:00:00'`;
  }

  /** Build the OData filter from config template + runtime args, then query. */
  async query(
    user: AuthUser,
    args: { objectCode: string; warehouseId?: string; todayOnly?: boolean; top?: number },
  ): Promise<{
    objectCode: string;
    objectName: string;
    dataSource: string;
    summary: BusinessObjectSummary;
    records: Array<Record<string, unknown>>;
  }> {
    const row = await this.resolve(user, args.objectCode);
    if (!row) {
      validationError(
        `no business object registered for code '${args.objectCode}'. Ask an admin to add it in Access Control → Business objects.`,
      );
    }
    const cfg = row!;

    const clauses: string[] = [];
    if (cfg.default_filters) {
      if (cfg.default_filters.includes('{warehouseId}')) {
        if (args.warehouseId) {
          clauses.push(cfg.default_filters.replace(/\{warehouseId\}/g, args.warehouseId.replace(/'/g, "''")));
        }
        // no warehouse → skip the warehouse-scoped default filter
      } else {
        clauses.push(cfg.default_filters);
      }
    }
    if (args.todayOnly && cfg.date_field) {
      const today = new Date().toISOString().slice(0, 10);
      clauses.push(this.dateEq(cfg.date_field, today, cfg.api_version));
    }

    let result: Awaited<ReturnType<SapIflowClient['query']>>;
    try {
      const landscape = await this.resolveLandscape(user.orgId, cfg.entity_set);
      result = await this.iflow.query(
        {
          service: cfg.odata_service_path,
          entitySet: cfg.entity_set,
          filter: clauses.length ? clauses.join(' and ') : undefined,
          select: cfg.select_fields || undefined,
          top: Math.min(args.top || cfg.top_limit, 200),
          objectCode: cfg.object_code,
          warehouseId: args.warehouseId,
          todayOnly: args.todayOnly,
        },
        landscape,
      );
    } catch (error) {
      validationError(error instanceof Error ? error.message : 'business object query failed');
    }
    const records = result!.records;
    const summary = contextualize(records, {
      objectName: cfg.object_name,
      statusField: cfg.status_field,
      statusLabels: cfg.status_labels,
      groupBy: (cfg.group_by || '').split(',').map((s) => s.trim()).filter(Boolean),
      dateField: cfg.date_field,
    });
    return {
      objectCode: cfg.object_code,
      objectName: cfg.object_name,
      dataSource: result!.dataSource,
      summary,
      records,
    };
  }
}
