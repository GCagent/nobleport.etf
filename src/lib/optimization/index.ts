/**
 * NoblePort.eth Optimization Module Index
 *
 * Unified exports for the full stack optimization protocol
 *
 * @module optimization
 * @version 2.0.0
 */

// Core compression utilities
export {
  compressString,
  decompressString,
  encodeCapabilities,
  decodeCapabilities,
  calculateChecksum,
  createCompressedPacket,
  compressModule,
  decompressModule,
  compressPlatform,
  decompressPlatform,
  compressNetworkState,
  decompressNetworkState,
  createDeltaPacket,
  benchmarkCompression,
  COMPRESSION_LUT,
  CAPABILITY_BITS,
  PROVIDER_CODES,
  PROTOCOL_CODES,
  STATUS_CODES,
  type CompressedPacket,
  type OptimizedModule,
  type OptimizedPlatform,
  type OptimizedNetworkState,
  type DeltaPacket,
  type CompressionMetrics
} from '../dataCompression';

// Pre-optimized data packets
export {
  OPTIMIZED_MODULES,
  OPTIMIZED_PLATFORMS,
  packetFactory,
  encodeModuleHeader,
  encodePlatformHeader,
  encodeNetworkHeader,
  fragmentPacket,
  reassemblePackets,
  getCachedModulePacket,
  getCachedPlatformPacket,
  warmupCaches,
  clearCaches,
  type PacketFactory,
  type StreamPacket
} from '../optimizedDataPackets';

// Performance metrics and benchmarking
export {
  calculateLatencyMetrics,
  measureLatency,
  benchmarkSerialization,
  benchmarkNetworkTransfer,
  generateOptimizationReport,
  formatReportAsText,
  formatReportAsJson,
  type LatencyMetrics,
  type ThroughputMetrics,
  type OptimizationReport,
  type SerializationBenchmark,
  type NetworkBenchmark,
  type ModuleMetrics,
  type PlatformMetrics
} from '../performanceMetrics';

// ============================================================================
// QUICK START FUNCTIONS
// ============================================================================

import { warmupCaches as warmup } from '../optimizedDataPackets';
import { generateOptimizationReport, formatReportAsText } from '../performanceMetrics';

/**
 * Initialize the optimization system
 * Call this at application startup for best performance
 */
export function initializeOptimization(): void {
  warmup();
  console.log('[NoblePort Optimization] System initialized');
}

/**
 * Run full optimization report and return formatted text
 */
export function runOptimizationReport(): string {
  const report = generateOptimizationReport();
  return formatReportAsText(report);
}

/**
 * Get optimization status summary
 */
export function getOptimizationStatus(): {
  initialized: boolean;
  version: string;
  modules: number;
  platforms: number;
  compressionEnabled: boolean;
} {
  return {
    initialized: true,
    version: '2.0.0',
    modules: 12,
    platforms: 13,
    compressionEnabled: true
  };
}
