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
/** Rows returned to the model per business-object answer (see LiveDataService). */
const ROW_BUDGET = Number(process.env.LIVE_ROW_BUDGET || 30);

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

  /**
   * Sample real rows for an object and report the fields SAP actually returned.
   * A fixed-endpoint iFlow often serves a different entity set than configured,
   * so this shows the truth rather than what the registry claims.
   */
  async preview(
    user: AuthUser,
    id: string,
  ): Promise<{
    objectCode: string;
    entitySet: string;
    dataSource: string;
    rowCount: number;
    fields: string[];
    sample: Array<Record<string, unknown>>;
  }> {
    const row = await this.byId(user, id);
    if (!row) {
      validationError('business object not found');
    }
    const cfg = row!;
    const landscape = await this.resolveLandscape(user.orgId, cfg.entity_set);
    const result = await this.iflow.query(
      { service: cfg.odata_service_path, entitySet: cfg.entity_set, top: 5, objectCode: cfg.object_code },
      landscape,
    );
    const fields = [...new Set(result.records.flatMap((r) => Object.keys(r)))].sort();
    return {
      objectCode: cfg.object_code,
      entitySet: cfg.entity_set,
      dataSource: result.dataSource,
      rowCount: result.records.length,
      fields,
      sample: result.records.slice(0, 3),
    };
  }

  /** Field names referenced by an object's configuration. */
  private configuredFields(cfg: BusinessObjectRow): Array<{ field: string; setting: string }> {
    const out: Array<{ field: string; setting: string }> = [];
    // "Plant eq '{warehouseId}'" → Plant. Only the left-hand side of a clause.
    for (const m of (cfg.default_filters || '').matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s+(?:eq|ne|gt|ge|lt|le)\s/g)) {
      out.push({ field: m[1], setting: 'default_filters' });
    }
    if (cfg.date_field) out.push({ field: cfg.date_field, setting: 'date_field' });
    if (cfg.status_field) out.push({ field: cfg.status_field, setting: 'status_field' });
    for (const g of (cfg.group_by || '').split(',').map((x) => x.trim()).filter(Boolean)) {
      out.push({ field: g, setting: 'group_by' });
    }
    for (const f of (cfg.select_fields || '').split(',').map((x) => x.trim()).filter(Boolean)) {
      out.push({ field: f, setting: 'select_fields' });
    }
    return out;
  }

  /**
   * Check an object's configuration against the fields SAP actually returns.
   *
   * PURCHASING was configured with `Plant eq '{warehouseId}'` while its endpoint
   * serves the purchase order HEADER entity, which has no Plant — so the filter
   * silently matched nothing and read as "this plant has no purchase orders".
   * Nothing in the app noticed. This is that check, run on demand.
   */
  async validate(
    user: AuthUser,
    id: string,
  ): Promise<{
    objectCode: string;
    entitySet: string;
    ok: boolean;
    fieldsReturned: number;
    issues: Array<{ field: string; setting: string; message: string }>;
    error?: string;
  }> {
    const row = await this.byId(user, id);
    if (!row) {
      validationError('business object not found');
    }
    const cfg = row!;
    let fields: string[] = [];
    try {
      const preview = await this.preview(user, id);
      fields = preview.fields;
    } catch (error) {
      return {
        objectCode: cfg.object_code,
        entitySet: cfg.entity_set,
        ok: false,
        fieldsReturned: 0,
        issues: [],
        error: error instanceof Error ? error.message : 'preview failed',
      };
    }

    // An endpoint that returned nothing tells us nothing — do not report every
    // configured field as missing on the strength of an empty response.
    if (!fields.length) {
      return {
        objectCode: cfg.object_code,
        entitySet: cfg.entity_set,
        ok: false,
        fieldsReturned: 0,
        issues: [],
        error: 'the endpoint returned no rows, so its fields could not be checked',
      };
    }

    const known = new Set(fields);
    const issues = this.configuredFields(cfg)
      .filter((c) => !known.has(c.field))
      .map((c) => ({
        field: c.field,
        setting: c.setting,
        message:
          c.setting === 'default_filters'
            ? `filters on '${c.field}', which this endpoint does not return — the filter will match nothing`
            : `'${c.field}' is not returned by this endpoint`,
      }));

    return {
      objectCode: cfg.object_code,
      entitySet: cfg.entity_set,
      ok: issues.length === 0,
      fieldsReturned: fields.length,
      issues,
    };
  }

  /** Validate every active object the user can see. */
  async validateAll(user: AuthUser) {
    const rows = (await this.list(user)).filter((r) => r.is_active);
    const results = [];
    for (const row of rows) {
      results.push(await this.validate(user, row.id));
    }
    return { checked: results.length, results };
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
    endpoint?: string;
    entitySet?: string;
    summary: BusinessObjectSummary;
    records: Array<Record<string, unknown>>;
    rowCount?: number;
    truncated?: { shown: number; total: number };
    note?: string;
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
    // Cap what the model reads, but say so — the summary above still describes
    // every row, so counts and breakdowns remain correct.
    const shown = records.length > ROW_BUDGET ? records.slice(0, ROW_BUDGET) : records;
    return {
      objectCode: cfg.object_code,
      objectName: cfg.object_name,
      dataSource: result!.dataSource,
      // Evidence trail for the activity timeline (Phase AQ).
      endpoint: result!.endpoint,
      entitySet: cfg.entity_set,
      summary,
      rowCount: records.length,
      ...(shown.length < records.length
        ? {
            truncated: { shown: shown.length, total: records.length },
            note: `Showing ${shown.length} of ${records.length} rows; the summary covers all of them.`,
          }
        : {}),
      records: shown,
    };
  }
}
