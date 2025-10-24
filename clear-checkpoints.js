// Clear EventStore checkpoints
db = db.getSiblingDB('BlogServiceDb');
print('Clearing es_checkpoints...');
const result = db.es_checkpoints.deleteMany({});
print('Deleted', result.deletedCount, 'checkpoint(s)');
