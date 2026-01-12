/**
 * Noble Port ETF - Property Floor Plan Dimensions
 *
 * Structured floor plan data for tokenized real estate assets.
 * All measurements are in feet and inches (imperial).
 */

export interface Dimension {
  feet: number;
  inches: number;
  /** Original string representation */
  raw: string;
}

export interface Room {
  name: string;
  width?: Dimension;
  length?: Dimension;
  depth?: Dimension;
  span?: Dimension;
  notes?: string;
}

export interface FloorPlan {
  name: string;
  label: string;
  rooms: Room[];
  overallDimensions?: {
    length?: Dimension;
    width?: Dimension;
  };
  notes?: string[];
}

export interface PropertyFloorPlans {
  propertyId: string;
  propertyName: string;
  floors: FloorPlan[];
  metadata: {
    measurementUnit: 'imperial' | 'metric';
    source: string;
    lastUpdated: string;
    revisionMarkers?: string[];
  };
}

/**
 * Parse dimension string to structured Dimension object
 * @example parseDimension("14' 1 1/2\"") => { feet: 14, inches: 1.5, raw: "14' 1 1/2\"" }
 */
export function parseDimension(raw: string): Dimension {
  const match = raw.match(/(\d+)'?\s*(?:(\d+)(?:\s+(\d+)\/(\d+))?"?)?/);
  if (!match) {
    return { feet: 0, inches: 0, raw };
  }

  const feet = parseInt(match[1], 10) || 0;
  let inches = parseInt(match[2], 10) || 0;

  if (match[3] && match[4]) {
    inches += parseInt(match[3], 10) / parseInt(match[4], 10);
  }

  return { feet, inches, raw };
}

/**
 * Convert dimension to total inches for calculations
 */
export function toTotalInches(dim: Dimension): number {
  return dim.feet * 12 + dim.inches;
}

/**
 * Convert dimension to total feet (decimal)
 */
export function toTotalFeet(dim: Dimension): number {
  return dim.feet + dim.inches / 12;
}

/**
 * Calculate square footage from width and length dimensions
 */
export function calculateSquareFootage(width: Dimension, length: Dimension): number {
  return toTotalFeet(width) * toTotalFeet(length);
}

// =============================================================================
// FLOOR PLAN DATA
// =============================================================================

export const existingFirstFloor: FloorPlan = {
  name: 'first-floor',
  label: 'Existing 1st Floor',
  rooms: [
    {
      name: 'Master Bedroom',
      width: parseDimension("14' 1 1/2\""),
      length: parseDimension("17' 4 7/16\""),
      notes: 'Primary bedroom with attached master bathroom'
    },
    {
      name: 'Master Bathroom',
      length: parseDimension("18' 10\""),
      span: parseDimension("22' 8 1/2\""),
      notes: 'Attached to bedroom, includes tubs and sinks. Span measurement is combined horizontal dimension with bedroom.'
    },
    {
      name: 'Dining/Living Area',
      length: parseDimension("19' 0 1/2\""),
      width: parseDimension("11' 0\""),
      notes: 'Central room with dining table'
    },
    {
      name: 'Kitchen',
      width: parseDimension("14' 5 1/6\""),
      notes: 'Area with counters and sinks'
    },
    {
      name: 'Kitchen Entry/Closet',
      width: parseDimension("1' 5 1/6\""),
      notes: 'Small feature, possibly entry or closet adjacent to kitchen'
    },
    {
      name: 'Deck',
      length: parseDimension("26' 5 3/4\""),
      depth: parseDimension("13' 1 1/2\""),
      notes: 'Exterior area on the right side of the house'
    },
    {
      name: 'Porch',
      depth: parseDimension("4' 10\""),
      notes: 'Front entry area'
    },
    {
      name: 'Steps to Garage',
      width: parseDimension("17' 8\""),
      notes: 'Left side access to garage/cellar'
    }
  ],
  overallDimensions: {
    length: parseDimension("47' 3\"")
  },
  notes: [
    'Revision markers on plan: 8/15 1-20, 9/15 1-21',
    'Access to garage and cellar included',
    'Measurements in feet and inches'
  ]
};

export const proposedSecondFloor: FloorPlan = {
  name: 'second-floor',
  label: 'Proposed 2nd Floor (Hand-Drawn)',
  rooms: [
    {
      name: 'Balcony',
      span: parseDimension("18'"),
      notes: 'Left side of floor plan'
    },
    {
      name: 'Kitchen',
      length: parseDimension("15' 9\""),
      width: parseDimension("18'"),
      notes: 'Bottom left area of plan'
    },
    {
      name: 'Great Room',
      length: parseDimension("20'"),
      width: parseDimension("12'"),
      notes: 'Large central/right area. Original notation "20\' 12\"" may indicate 20\' x 12\' or require clarification.'
    },
    {
      name: 'Hallway',
      width: parseDimension("1' 6\""),
      notes: 'Top central area, measurement labeled near stair'
    },
    {
      name: 'Steps Down',
      length: parseDimension("5' 11\""),
      notes: 'Bottom left, arrow points to stairs or door leading down'
    }
  ],
  notes: [
    'Hand-drawn on graph paper (likely 1 square = 1\')',
    'Some dimensions sparsely labeled and handwritten',
    'Additional scattered measurements: 10\' 5", 8\' 7", 20\' 5" (possibly room spans)',
    'Features labeled but without dimensions: French Doors, Windows, Pantry, Door'
  ]
};

/**
 * Complete property floor plan data
 */
export const propertyFloorPlans: PropertyFloorPlans = {
  propertyId: 'NP-PROP-001',
  propertyName: 'Noble Port Residential Property',
  floors: [existingFirstFloor, proposedSecondFloor],
  metadata: {
    measurementUnit: 'imperial',
    source: 'Architectural floor plans and hand-drawn sketches',
    lastUpdated: '2026-01-12',
    revisionMarkers: ['8/15 1-20', '9/15 1-21']
  }
};

// =============================================================================
// UTILITY FUNCTIONS FOR FLOOR PLAN ANALYSIS
// =============================================================================

/**
 * Calculate total square footage for a floor
 */
export function calculateFloorSquareFootage(floor: FloorPlan): number {
  let total = 0;

  for (const room of floor.rooms) {
    if (room.width && room.length) {
      total += calculateSquareFootage(room.width, room.length);
    } else if (room.length && room.depth) {
      total += calculateSquareFootage(room.length, room.depth);
    }
  }

  return Math.round(total * 100) / 100;
}

/**
 * Get room dimensions summary
 */
export function getRoomSummary(room: Room): string {
  const dims: string[] = [];

  if (room.width) dims.push(`Width: ${room.width.raw}`);
  if (room.length) dims.push(`Length: ${room.length.raw}`);
  if (room.depth) dims.push(`Depth: ${room.depth.raw}`);
  if (room.span) dims.push(`Span: ${room.span.raw}`);

  return dims.length > 0 ? dims.join(', ') : 'No dimensions available';
}

/**
 * Generate floor plan report
 */
export function generateFloorPlanReport(property: PropertyFloorPlans): string {
  const lines: string[] = [
    `# Floor Plan Report: ${property.propertyName}`,
    `Property ID: ${property.propertyId}`,
    `Last Updated: ${property.metadata.lastUpdated}`,
    `Measurement Unit: ${property.metadata.measurementUnit}`,
    '',
  ];

  for (const floor of property.floors) {
    lines.push(`## ${floor.label}`);
    lines.push('');

    const sqft = calculateFloorSquareFootage(floor);
    if (sqft > 0) {
      lines.push(`**Calculated Area:** ${sqft.toFixed(2)} sq ft (rooms with both dimensions)`);
      lines.push('');
    }

    lines.push('### Rooms');
    lines.push('');

    for (const room of floor.rooms) {
      lines.push(`**${room.name}**`);
      lines.push(`- Dimensions: ${getRoomSummary(room)}`);
      if (room.notes) {
        lines.push(`- Notes: ${room.notes}`);
      }
      lines.push('');
    }

    if (floor.overallDimensions) {
      lines.push('### Overall Dimensions');
      if (floor.overallDimensions.length) {
        lines.push(`- Length: ${floor.overallDimensions.length.raw}`);
      }
      if (floor.overallDimensions.width) {
        lines.push(`- Width: ${floor.overallDimensions.width.raw}`);
      }
      lines.push('');
    }

    if (floor.notes && floor.notes.length > 0) {
      lines.push('### Notes');
      for (const note of floor.notes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// Export default for easy import
export default propertyFloorPlans;
