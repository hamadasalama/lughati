import { Pool, QueryResult, QueryResultRow, types } from 'pg';
import { env } from '../config';

// date كنص YYYY-MM-DD، numeric/int8 كأرقام — حتى لا تتفاجأ الواجهة بسلاسل
types.setTypeParser(1082, v => v);
types.setTypeParser(1700, v => (v === null ? null : parseFloat(v)));
types.setTypeParser(20,   v => (v === null ? null : parseInt(v, 10)));

export const pool = new Pool({ connectionString: env.databaseUrl, max: 10 });
export function q<T extends QueryResultRow = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
