import { writeFile } from 'node:fs/promises';

// Relies on Task/PriorityTask/User already implementing toJSON(), so
// JSON.stringify() picks those up automatically instead of dumping raw
// instances (with methods, private fields, etc).
export async function exportToJSON({ tasks = [], users = [], statistics = {} } = {}, filePath) {
  const payload = {
    exportedAt: new Date().toISOString(),
    statistics,
    users,
    tasks
  };

  const json = JSON.stringify(payload, null, 2);
  await writeFile(filePath, json, 'utf-8');
  return filePath;
}
