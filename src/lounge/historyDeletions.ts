import type { SQLiteDatabase } from 'expo-sqlite';

export async function deletionTimes(db: SQLiteDatabase, scope: string) {
  const rows = await db.getAllAsync<{ peer: string; deleted_at: number }>(
    'SELECT peer, deleted_at FROM deletions WHERE scope = ?', scope);
  return Object.fromEntries(rows.map(row => [row.peer, row.deleted_at]));
}

/** Keep the cutoff even after all content is gone so offline devices cannot restore deleted records. */
export async function deleteBefore(db: SQLiteDatabase, { scope, peer, time }: {
  scope: string; peer: string; time: number;
}) {
  await db.execAsync('BEGIN IMMEDIATE');
  try {
    await db.runAsync(`INSERT INTO deletions(scope, peer, deleted_at) VALUES (?, ?, ?)
      ON CONFLICT(scope, peer) DO UPDATE SET deleted_at = MAX(deleted_at, excluded.deleted_at)`, scope, peer, time);
    await db.runAsync(`DELETE FROM messages WHERE scope = ? AND json_extract(content, '$.conversation') = ?
      AND time <= (SELECT deleted_at FROM deletions WHERE scope = ? AND peer = ?)`, scope, peer, scope, peer);
    const retained = await db.getFirstAsync<{ key: string }>(
      "SELECT key FROM messages WHERE scope = ? AND json_extract(content, '$.conversation') = ? LIMIT 1", scope, peer);
    if (!retained) await db.runAsync('DELETE FROM contacts WHERE scope = ? AND id = ?', scope, peer);
    await db.execAsync('COMMIT');
  } catch (error) { await db.execAsync('ROLLBACK'); throw error; }
}
