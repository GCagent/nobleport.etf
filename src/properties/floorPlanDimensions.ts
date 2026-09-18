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

export interface AdditionalMeasurement {
  location: string;
  dimension: Dimension;
}

export interface FloorPlan {
  name: string;
  label: string;
  rooms: Room[];
  overallDimensions?: {
    length?: Dimension;
    width?: Dimension;
  };
  additionalMeasurements?: AdditionalMeasurement[];
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
      notes: 'Primary bedroom with attached master bathroom. Planned work: replace closet with soaking tub, replace window, molding, patch hole in dry wall, add new outlet at door, new bay window, repair sheetrock and molding.'
    },
    {
      name: 'Master Bathroom',
      length: parseDimension("18' 10\""),
      span: parseDimension("22' 8 1/2\""),
      notes: 'Attached to bedroom, includes tubs and sinks. Span measurement is combined horizontal dimension with bedroom.'
    },
    {
      name: 'Dining/Living Area',
      length: parseDimension("6' 11 15/16\""),
      width: parseDimension("10' 6 1/16\""),
      notes: 'Central room with dining table'
    },
    {
      name: 'Kitchen',
      width: parseDimension("14' 6 1/6\""),
      notes: 'Area with counters and sinks'
    },
    {
      name: 'Deck',
      length: parseDimension("26' 5 3/4\""),
      depth: parseDimension("13' 11 1/2\""),
      notes: 'Exterior area on the right side of the house'
    },
    {
      name: 'Porch',
      length: parseDimension("18' 10\""),
      depth: parseDimension("4' 10\""),
      notes: 'Front entry area'
    },
    {
      name: 'Steps Down to Garage',
      width: parseDimension("17' 8\""),
      notes: 'Left side access down to garage'
    },
    {
      name: 'Steps to Cellar',
      notes: 'Access to cellar with 4 foot wall nearby'
    }
  ],
  overallDimensions: {
    length: parseDimension("47' 3\"")
  },
  additionalMeasurements: [
    { location: 'Bottom span (left section)', dimension: parseDimension("33' 2 1/4\"") },
    { location: 'Bottom span (center section)', dimension: parseDimension("12' 7 15/16\"") },
    { location: 'Bottom span (right section)', dimension: parseDimension("20' 7 5/8\"") }
  ],
  notes: [
    'Labeled "Week" at top of plan',
    'Work notes: replace closet, add soaking tub, replace window, molding repairs, new bay window',
    '"In five locations" and "and painted" noted at bottom',
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
      notes: 'Left side of floor plan, exterior'
    },
    {
      name: 'Kitchen',
      length: parseDimension("15'"),
      width: parseDimension("18'"),
      notes: 'Bottom left area of plan, labeled "15\'+" and "18\'"'
    },
    {
      name: 'Great Room',
      notes: 'Large central/right area labeled "Greatroom", with tree/plant symbol'
    },
    {
      name: 'Hallway',
      notes: 'Central corridor connecting rooms'
    },
    {
      name: 'Bathroom',
      notes: 'Contains tub symbol, located in upper area'
    },
    {
      name: 'Pantry',
      notes: 'Storage area near kitchen'
    },
    {
      name: 'Closet (Primary)',
      notes: 'Multiple closets labeled throughout, main closet near bathroom'
    },
    {
      name: 'Closet (Secondary)',
      notes: 'Additional closet space'
    },
    {
      name: 'Storage/Stairs',
      length: parseDimension("5' 11\""),
      notes: 'Bottom left area with arrow pointing to stairs going down'
    }
  ],
  notes: [
    'Hand-drawn on graph paper (likely 1 square = 1\')',
    'Features on right side: French doors, shadowbox windows, regular windows',
    'Multiple closet spaces throughout',
    'Stairs connect to first floor',
    'Door labeled at bottom left corner'
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
