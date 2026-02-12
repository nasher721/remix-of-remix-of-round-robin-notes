// Database module exports
export { DatabaseProvider, useDatabase, useDatabaseRequired } from './DatabaseProvider';
export { 
  createDatabase, 
  getDatabase, 
  resetDatabase, 
  flattenPatient, 
  unflattenPatient 
} from './database';
export type { RoundRobinDatabase, PatientDocType, PatientNested } from './database';
export { 
  startReplication, 
  stopReplication, 
  forceResync, 
  subscribeToReplicationState,
  getReplicationState 
} from './replication';
export type { ReplicationState } from './replication';
export { patientSchema } from './patient.schema';
