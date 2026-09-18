import { CATEGORY_LABELS, CATEGORY_ORDER } from './catalog';
import { JURISDICTIONS } from './jurisdictions';
import type { CheckCategory, PermitSubmission, ReviewRun } from './types';

/**
 * Renders the deficiency report as Markdown. The PDF generator wraps this —
 * keeping the body in Markdown means the same text drives the PDF, the
 * client portal, and the CSV export.
 */
export function renderDeficiencyReport(submission: PermitSubmission, run: ReviewRun): string {
  const rules = JURISDICTIONS[run.jurisdiction];
  const lines: string[] = [];

  lines.push(`# PermitStream Review Report`);
  lines.push('');
  lines.push(`**Permit:** ${submission.permitNumber ?? submission.id}`);
  lines.push(`**Jurisdiction:** ${rules.jurisdiction}`);
  lines.push(`**Property:** ${submission.property.addressNormalized ?? submission.property.addressRaw}`);
  lines.push(`**Contractor:** ${submission.contractor.name}`);
  lines.push(`**Scope:** ${submission.permitType}`);
  lines.push(`**Reviewer:** ${run.reviewer}`);
  lines.push(`**Ruleset version:** ${run.rulesetVersion}`);
  lines.push(`**Run id:** ${run.id}`);
  lines.push(`**Input hash:** ${run.inputHash}`);
  lines.push(`**Output hash:** ${run.outputHash}`);
  lines.push(`**Started:** ${run.startedAt}`);
  lines.push(`**Finished:** ${run.finishedAt}`);
  lines.push('');
  lines.push('## Risk Score');
  lines.push('');
  lines.push(`- Approval probability: **${run.score.approvalProbability}%**`);
  lines.push(`- Rejection likelihood: ${run.score.rejectionLikelihood}%`);
  lines.push(`- Estimated added delay: ${run.score.estimatedDelayDays} days`);
  lines.push(`- Completeness index: ${run.score.completenessIndex}/100`);
  lines.push(`- Extraction confidence: ${run.score.extractionConfidence}/100`);
  lines.push(`- Band: ${run.score.band.toUpperCase()}`);
  lines.push('');
  lines.push('## Deficiencies by Category');
  lines.push('');

  const byCat = new Map<CheckCategory, typeof run.deficiencies>();
  for (const d of run.deficiencies) {
    const list = byCat.get(d.category) ?? [];
    list.push(d);
    byCat.set(d.category, list);
  }

  for (const cat of CATEGORY_ORDER) {
    const list = byCat.get(cat);
    if (!list || list.length === 0) continue;
    lines.push(`### ${CATEGORY_LABELS[cat]} — ${list.length} item(s)`);
    lines.push('');
    for (const d of list) {
      lines.push(`- **[${d.severity.toUpperCase()}]** ${d.message}`);
      if (d.citations.length > 0) {
        const cites = d.citations
          .map((c) => `${c.source} ${c.section}${c.edition ? ` (${c.edition})` : ''}`)
          .join('; ');
        lines.push(`  - Citations: ${cites}`);
      }
    }
    lines.push('');
  }

  if (run.deficiencies.length === 0) {
    lines.push('_No deficiencies detected._');
    lines.push('');
  }

  lines.push('## Audit');
  lines.push('');
  lines.push('This report is signed by the input/output hash pair above. Any change to the');
  lines.push('submission inputs or the reviewer\'s outputs will produce a different hash and');
  lines.push('void the certification.');

  return lines.join('\n');
}

export function renderDeficiencyCsv(run: ReviewRun): string {
  const rows = [
    ['check_id', 'slug', 'category', 'severity', 'status', 'message', 'citations'].join(','),
  ];
  for (const d of run.deficiencies) {
    const cites = d.citations.map((c) => `${c.source} ${c.section}`).join('|');
    rows.push(
      [
        d.checkId,
        d.slug,
        d.category,
        d.severity,
        d.status,
        JSON.stringify(d.message),
        JSON.stringify(cites),
      ].join(','),
    );
  }
  return rows.join('\n');
}
