/**
 * Life-Safety Calculator — CO Detector Integration
 *
 * Dynamic quantity calculation and cost projection for CO/heat
 * detector integration on attached garage additions (MA compliant).
 *
 * Input: house stories/levels, garage config
 * Output: line-item takeoff with qty, locations, costs, code notes
 *
 * API endpoint: /api/gc/calculate-co-integration
 */

import {
  DwellingConfig,
  LifeSafetyLineItem,
  LifeSafetyTakeoff,
  DEFAULT_DWELLING_CONFIG,
  SAFETY_PRODUCTS,
  MA_CODE_REFERENCES,
  INSPECTION_CHECKPOINTS,
} from '../data/life-safety-takeoff';

// ============================================================================
// CALCULATOR SERVICE
// ============================================================================

export class LifeSafetyCalculator {
  /**
   * Calculate complete CO/heat detector takeoff for attached garage addition.
   *
   * Logic:
   * - CO alarms: 1 per level (not in garage)
   * - Bedroom levels: within 10 ft of bedroom doors
   * - Heat detector: 1 in attached garage (ceiling mount)
   * - Interconnect wiring: estimated by dwelling footprint
   * - All hardwired + battery backup for new construction
   */
  calculateCOIntegration(
    config: DwellingConfig = DEFAULT_DWELLING_CONFIG,
    projectName: string = 'Attached Garage Addition'
  ): LifeSafetyTakeoff {
    const lineItems: LifeSafetyLineItem[] = [];
    const codeNotes: string[] = [];
    const riskFlags: string[] = [];

    // Count total levels requiring CO protection
    const totalLevels = this.countProtectedLevels(config);

    // Determine alarm type based on preference
    const useCombo = config.preferCombo;
    const alarmProduct = useCombo
      ? SAFETY_PRODUCTS.find((p) => p.type === 'combo_smoke_co')!
      : SAFETY_PRODUCTS.find((p) => p.type === 'co')!;
    const heatProduct = SAFETY_PRODUCTS.find((p) => p.type === 'heat_detector')!;

    // LS-01 / LS-02: CO or Combo alarms for dwelling levels
    const alarmQty = this.calculateAlarmQuantity(config);
    const alarmItem: LifeSafetyLineItem = {
      itemId: useCombo ? 'LS-02' : 'LS-01',
      description: alarmProduct.name,
      spec: `${alarmProduct.model} — ${alarmProduct.listing}`,
      unit: 'EA',
      quantity: alarmQty,
      wastePercent: 0,
      totalQty: alarmQty,
      unitCostLow: alarmProduct.unitCostLow,
      unitCostHigh: alarmProduct.unitCostHigh,
      extendedCostLow: alarmQty * alarmProduct.unitCostLow,
      extendedCostHigh: alarmQty * alarmProduct.unitCostHigh,
      notes: this.getAlarmPlacementNotes(config),
      codeRef: '780 CMR R315 / 527 CMR 31',
      location: this.getAlarmLocations(config).join('; '),
    };
    lineItems.push(alarmItem);

    // LS-03: Heat detector in garage
    if (config.garageType === 'attached') {
      const heatItem: LifeSafetyLineItem = {
        itemId: 'LS-03',
        description: heatProduct.name,
        spec: `${heatProduct.model} — ${heatProduct.listing}`,
        unit: 'EA',
        quantity: 1,
        wastePercent: 0,
        totalQty: 1,
        unitCostLow: heatProduct.unitCostLow,
        unitCostHigh: heatProduct.unitCostHigh,
        extendedCostLow: heatProduct.unitCostLow,
        extendedCostHigh: heatProduct.unitCostHigh,
        notes: 'Required in attached garage (not CO). Ceiling mount, center of garage. Tie to house fire system if possible.',
        codeRef: '780 CMR R314.8',
        location: `Garage ceiling (${config.garageDimensions.width}' × ${config.garageDimensions.depth}')`,
      };
      lineItems.push(heatItem);
    }

    // LS-04: Interconnect wiring
    const wiringLF = this.estimateWiringLength(config);
    const wiringItem: LifeSafetyLineItem = {
      itemId: 'LS-04',
      description: 'Interconnect Wiring / Modules (low-voltage)',
      spec: '14/2 w/ ground + 18/2 interconnect; wireless modules if retrofit',
      unit: 'LOT',
      quantity: 1,
      wastePercent: 5,
      totalQty: 1,
      unitCostLow: Math.round(wiringLF * 0.5 + 50),
      unitCostHigh: Math.round(wiringLF * 1.5 + 150),
      extendedCostLow: Math.round(wiringLF * 0.5 + 50),
      extendedCostHigh: Math.round(wiringLF * 1.5 + 150),
      notes: `Est. ${wiringLF} LF runs between alarms + to panel. ${config.wiringType === 'hardwired' ? 'Hardwired preferred.' : 'Wireless adapters for existing hard-to-reach.'}`,
      codeRef: 'NEC 2023 (MA Amendments)',
      location: 'Throughout dwelling + garage connection',
    };
    lineItems.push(wiringItem);

    // LS-05: Mounting hardware
    const mountingItem: LifeSafetyLineItem = {
      itemId: 'LS-05',
      description: 'Mounting Hardware / Boxes / Trim',
      spec: 'New-work boxes, mounting brackets, trim plates per manufacturer',
      unit: 'LOT',
      quantity: 1,
      wastePercent: 0,
      totalQty: 1,
      unitCostLow: 20,
      unitCostHigh: 50,
      extendedCostLow: 20,
      extendedCostHigh: 50,
      notes: 'New-work boxes; secure per manufacturer specs. One set per alarm location.',
      codeRef: 'NEC 2023',
      location: 'All alarm locations',
    };
    lineItems.push(mountingItem);

    // LS-06: Testing / certification supplies
    const testingItem: LifeSafetyLineItem = {
      itemId: 'LS-06',
      description: 'Testing / Certification Supplies (labels, log book)',
      spec: 'Inspection prep kit: test log, labels, certification paperwork',
      unit: 'LOT',
      quantity: 1,
      wastePercent: 0,
      totalQty: 1,
      unitCostLow: 20,
      unitCostHigh: 50,
      extendedCostLow: 20,
      extendedCostHigh: 50,
      notes: 'For CO compliance cert. Local FD inspection often required on sale/transfer.',
      codeRef: 'MGL Ch. 148 §26F½',
      location: 'N/A — documentation',
    };
    lineItems.push(testingItem);

    // Calculate totals
    const materialCostLow = lineItems.reduce((s, i) => s + i.extendedCostLow, 0);
    const materialCostHigh = lineItems.reduce((s, i) => s + i.extendedCostHigh, 0);
    const laborCostLow = this.estimateLabor(config, alarmQty, 'low');
    const laborCostHigh = this.estimateLabor(config, alarmQty, 'high');

    // Code notes
    codeNotes.push(
      'Attached garages trigger CO alarm requirements house-wide (potential CO source from vehicles).',
      'No CO alarm required inside the garage itself — alarms do not go in garages.',
      'Heat detector (not CO/smoke) required in attached garage — ceiling mount.',
      `CO alarms required on every level: ${totalLevels} levels detected.`,
      'Bedroom levels: CO alarm outside bedrooms, within 10 ft of bedroom doors.',
      'Hardwired + interconnected with battery backup required for new construction/additions post-2008.',
      'Listed UL 2034 / UL 2075; combination smoke/CO allowed (photoelectric + voice alert).',
      'Final FD inspection for CO certification required (MGL Ch. 148).',
    );

    // Risk flags
    riskFlags.push(
      'No CO in garage — install on dwelling side near connecting door if needed (within 10 ft bedroom rule).',
      'Interconnect test mandatory — all devices must sound when one triggers.',
      'Heat detector in garage ceiling — not smoke (false alarms from exhaust).',
      'High safety priority — integrate early with electrical rough (Phase 3 MEP).',
    );

    if (!config.existingSystem) {
      riskFlags.push(
        'No existing system detected — full new backbone required. Verify electrical panel capacity.'
      );
    }

    const garageSize = `${config.garageDimensions.width}' × ${config.garageDimensions.depth}'`;

    return {
      projectName,
      garageSize,
      dwellingConfig: config,
      lineItems,
      materialCostLow,
      materialCostHigh,
      laborCostLow,
      laborCostHigh,
      totalCostLow: materialCostLow + laborCostLow,
      totalCostHigh: materialCostHigh + laborCostHigh,
      codeNotes,
      inspectionHolds: INSPECTION_CHECKPOINTS.map(
        (c) => `${c.phase}: ${c.description} (${c.codeRef})`
      ),
      riskFlags,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate voice readout text for Stephanie.ai.
   */
  generateVoiceReadout(takeoff: LifeSafetyTakeoff): string {
    const config = takeoff.dwellingConfig;
    const alarmItems = takeoff.lineItems.filter(
      (i) => i.itemId === 'LS-01' || i.itemId === 'LS-02'
    );
    const heatItems = takeoff.lineItems.filter((i) => i.itemId === 'LS-03');
    const alarmItem = alarmItems[0];
    const alarmType = alarmItem?.itemId === 'LS-02'
      ? 'combination smoke/CO alarms'
      : 'CO alarms';

    const stories = config.stories;
    const basement = config.hasBasement ? ' plus basement' : '';
    const totalDirect = Math.round(
      (takeoff.totalCostLow + takeoff.totalCostHigh) / 2
    );

    return [
      `CO integration update: ${takeoff.garageSize} attached garage addition,`,
      `${stories}-story house${basement}.`,
      `${alarmItem?.totalQty || 0} ${alarmType} hardwired interconnected,`,
      `${heatItems[0]?.totalQty || 0} heat detector in garage.`,
      `Total direct cost approximately $${totalDirect.toLocaleString()}.`,
      `780 CMR compliant — no CO inside garage, protect all dwelling levels.`,
      `Fire department certification required for occupancy.`,
    ].join(' ');
  }

  /**
   * Generate API response matching /api/gc/calculate-co-integration endpoint spec.
   */
  generateAPIResponse(config: DwellingConfig, projectName?: string) {
    const takeoff = this.calculateCOIntegration(config, projectName);
    return {
      success: true,
      data: {
        takeoff,
        voiceReadout: this.generateVoiceReadout(takeoff),
        codeReferences: MA_CODE_REFERENCES,
        inspectionCheckpoints: INSPECTION_CHECKPOINTS,
      },
      meta: {
        calculatorVersion: '1.0.0',
        codeEdition: '780 CMR 10th Edition (2021 IRC Amendments)',
        generatedAt: takeoff.generatedAt,
      },
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private countProtectedLevels(config: DwellingConfig): number {
    let levels = config.stories;
    if (config.hasBasement) levels += 1;
    if (config.hasHabitableAttic) levels += 1;
    return levels;
  }

  private calculateAlarmQuantity(config: DwellingConfig): number {
    // Base: 1 per level
    let qty = this.countProtectedLevels(config);

    // Bedroom levels may need additional alarms if multiple bedroom areas
    // (within 10 ft of each bedroom door)
    // For typical residential, 1 per bedroom level covers hallway placement
    // Add 1 extra for each bedroom level with >2 bedrooms spread across wings
    // Conservative: stick with 1 per level for typical layouts

    return qty;
  }

  private getAlarmLocations(config: DwellingConfig): string[] {
    const locations: string[] = [];

    if (config.hasBasement) {
      locations.push('Basement: hallway/common area near stairs');
    }

    for (let i = 1; i <= config.stories; i++) {
      const isBedroom = config.bedroomLevels.includes(i);
      if (isBedroom) {
        locations.push(
          `Floor ${i}: Hallway outside bedrooms, within 10 ft of bedroom doors`
        );
      } else {
        locations.push(`Floor ${i}: Central hallway or common area`);
      }
    }

    if (config.hasHabitableAttic) {
      locations.push('Attic level: Near sleeping area if habitable');
    }

    return locations;
  }

  private getAlarmPlacementNotes(config: DwellingConfig): string {
    const notes: string[] = [
      'Not in garage — dwelling side only.',
      'Ceiling mount preferred (wall OK if 4-12 inches from ceiling).',
      'Interconnect with all house alarms.',
      'Battery backup required.',
    ];

    if (config.bedroomLevels.length > 0) {
      notes.push(
        `Bedroom levels (${config.bedroomLevels.join(', ')}): within 10 ft of bedroom doors.`
      );
    }

    return notes.join(' ');
  }

  private estimateWiringLength(config: DwellingConfig): number {
    // Rough estimate: 30-50 LF per level for interconnect runs
    const levels = this.countProtectedLevels(config);
    const basePerLevel = 40;
    const garageRun = 30; // Run from garage heat detector to house system
    const contingency = 20;

    return levels * basePerLevel + garageRun + contingency;
  }

  private estimateLabor(
    config: DwellingConfig,
    alarmQty: number,
    tier: 'low' | 'high'
  ): number {
    // Labor per unit: $100-$300 depending on complexity
    const perUnit = tier === 'low' ? 100 : 300;
    const heatDetectorLabor = tier === 'low' ? 75 : 200;
    const wiringLabor = tier === 'low' ? 150 : 400;
    const testingLabor = tier === 'low' ? 75 : 200;

    return alarmQty * perUnit + heatDetectorLabor + wiringLabor + testingLabor;
  }
}
