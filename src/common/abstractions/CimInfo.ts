/**
 * Each CIM file (CIM: Compressed Image) has a 64K (65536 bytes) information block describing its 
 * structure. The first 16 bytes define the file format information, and the remaining 65520 bytes 
 * describe 32760 cluster pointers. A cluster pointer value is an index of the physical cluster 
 * representing the sectors within the particular cluster. A value of 0xffff represents an empty 
 * (non-created-yet) cluster. 
 * 
 * A cluster is several adjacent sectors, a multiple of 64K.
 */
export type CimInfo = {
  // The "CIMF" string
  // Offset: 0x00, 4 bytes  
  header: string;
  // Offset: 0x04, 1 byte
  versionMajor: number;
  // Offset: 0x05, 1 byte
  versionMinor: number;
  // Offset: 0x06, 1 byte
  // Sector size (multiple of 512 bytes)
  sectorSize: number;
  // Number of clusters in the file
  // Offset: 0x07, 2 bytes
  clusterCount: number;
  // Size of a cluster
  // Offset: 0x09, 1 byte
  clusterSize: number;
  // Offset: 0x0a, 2 bytes
  maxClusters: number;
  // Maximum size in MBytes
  // Offset: 0x0c, 2 bytes
  maxSize: number;
  // Reserved for future use (use 0)
  // Offset: 0x0e, 2 bytes
  reserved: number;
  // Offset: 0x10, 65520 bytes
  clusterMap: number[];
};