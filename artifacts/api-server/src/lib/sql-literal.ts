/**
 * Pelolos string untuk literal SQL yang disusun manual (`'${...}'`).
 * Dengan standard_conforming_strings (default Postgres) satu-satunya karakter khusus di dalam '...' adalah tanda kutip tunggal.
 * Query baru sebaiknya memakai parameter (`sql` template drizzle); helper ini untuk query lama yang masih berbentuk teks.
 */
export const sqlStr = (v: unknown): string => String(v ?? "").replace(/'/g, "''").replace(/\0/g, "");
