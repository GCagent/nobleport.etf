import { NextResponse } from 'next/server';
import {
  featureGroups,
  featureStatusCounts,
  membershipPlans,
  paymentsAndSignatures,
  phase2Premium,
  positioning,
  revenueStreams,
  totalFeatures,
  valueProposition,
} from '@/lib/noblenest/features';
import { samplePassport } from '@/lib/noblenest/property-passport';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    product: 'NobleNest™',
    positioning,
    valueProposition,
    totalFeatures,
    statusCounts: featureStatusCounts(),
    featureGroups,
    phase2Premium,
    paymentsAndSignatures,
    membershipPlans,
    revenueStreams,
    samplePassport,
  });
}
