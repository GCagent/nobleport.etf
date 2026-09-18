# FPSF Foundations in Coastal Massachusetts

## Common Permit Rejection Triggers

A PermitStream contractor reference. Use this before you submit, not after the
correction notice arrives.

---

> **Boundary statement — read this first.**
>
> This document is contractor-facing guidance for **identifying common
> documentation gaps** in frost-protected shallow foundation (FPSF) permit
> submissions in coastal Massachusetts. It is **not** an engineering opinion,
> a code-compliance certification, or a substitute for ASCE 32, IRC R403.3,
> 780 CMR, or the determination of the authority having jurisdiction (AHJ).
>
> When PermitStream reviews your plans it outputs language like:
>
> > *"Potential FPSF documentation deficiency detected based on submitted
> > insulation schedule."*
>
> It does **not** output "this design is code compliant." That call belongs to
> the design professional of record and the local building official. The
> contractor remains responsible for engaging a licensed engineer where the
> scope, soils, loads, or local interpretation requires one.
>
> Authoritative references for any specific project:
>
> - **ASCE/SEI 32-01** — *Design and Construction of Frost-Protected Shallow
>   Foundations* (the underlying standard referenced by the IRC).
> - **IRC R403.3** — Frost-protected shallow foundations.
> - **780 CMR** — Massachusetts amendments to the IRC; chapter and section
>   numbers can differ from the model code.
> - **Local AHJ interpretation** — the inspector and zoning office of the
>   municipality where the project is filed.

---

## 1. When FPSF is allowed

FPSFs are most commonly used on **heated buildings** founded on soils that
are not susceptible to ice lensing. In Massachusetts the conventional default
is a footing below the 48-inch frost line; FPSF is the engineered alternative
that uses insulation to keep the soil under the footing above freezing rather
than digging below frost.

FPSF is typically **allowed** for:

- Heated, year-round occupied residential structures (single-family, addition
  scopes that maintain heat year-round).
- Attached, heated additions to an existing heated dwelling.
- Some heated accessory structures, when the heat source is permanent and
  the design follows ASCE 32 Section 4.

FPSF is **typically restricted or pushed back on** for:

- Unheated detached garages, sheds, and barns unless explicitly designed per
  ASCE 32 Section 4 for unheated structures (different and stricter rules
  apply).
- Buildings in flood zones where the foundation strategy is dictated by FEMA
  flood-resistant construction rather than frost performance.
- Sites with organic, peat, or expansive soils flagged on the geotechnical
  report.

> **Documentation gap that gets you bounced:** the submission relies on FPSF
> but the plans never state which standard (ASCE 32) is being followed or
> whether the building is being treated as heated or unheated. That single
> missing note is one of the most common rejection triggers in this category.

## 2. Heated vs unheated structures

ASCE 32 treats these as **two different design problems** because the heat
loss out of the bottom of the building is part of what keeps the soil under
the footing above freezing.

| Aspect | Heated | Unheated |
|---|---|---|
| Insulation strategy | Perimeter vertical + horizontal wing as needed | Full insulated envelope, including under the slab |
| Wing insulation | Often required only at corners | Typically required around the full perimeter |
| Engineer involvement | Usually optional under the IRC prescriptive path | Almost always required (ASCE 32 Section 4) |
| Inspector scrutiny | Moderate — focused on insulation continuity | High — full assembly is reviewed |

A surprising amount of pushback comes from submissions that **don't declare
which case applies**. If the plan note says "FPSF per IRC R403.3" but the
structure is an unheated garage, expect a correction notice.

## 3. Required insulation details

The plan set should make a reviewer able to answer these four questions
without guessing:

1. **What product?** XPS is the most commonly specified rigid foam for FPSF
   in coastal MA because of its compressive strength and moisture tolerance.
   The manufacturer and product line should appear on the plan.
2. **What R-value, vertical?** The R-value at the foundation perimeter wall.
3. **What R-value, horizontal wing?** The R-value of any horizontal wing
   insulation, plus the dimensions of the wing.
4. **What depth?** How far below grade the vertical insulation extends, and
   how the wing is buried and protected.

If any of those four numbers are missing from the plan, the submission is
incomplete regardless of whether the design itself is sound.

> **Authority callout.** The specific R-values and wing dimensions depend on
> the local Air Freezing Index (AFI). Coastal Massachusetts typically falls
> in an AFI range that ASCE 32 places in the higher end of its tables, but
> **do not pull a number from this document into a stamped plan.** Verify
> against the ASCE 32 tables (or your engineer's calculation) for your
> specific town.

## 4. Common missing notes

The notes block on the foundation sheet is where reviewers look first.
These are the omissions PermitStream sees most often:

- **No manufacturer / product line stated for the rigid insulation.**
- **R-value called out but not the thickness**, or vice versa, with no way to
  reconcile the two against the manufacturer's data.
- **No detail showing how the insulation is protected** above grade (UV,
  mechanical damage, rodents).
- **No drainage note** at the base of the vertical insulation.
- **No statement of design assumptions**: heated vs unheated, AFI used,
  ground-surface conditions assumed.
- **No reference standard cited.** "FPSF" with no mention of ASCE 32 or IRC
  R403.3 is a red flag for the reviewer.

A clean submission states the standard, the case (heated/unheated), the AFI
or local frost assumption, the product, the R-values, and the protection
strategy — on the plan, not in a separate email.

## 5. Corner wing extension mistakes

ASCE 32 requires the horizontal wing insulation at corners to be **wider and
longer than it is along the typical wall** because corners lose heat in two
directions. The exact multiplier comes out of the ASCE 32 tables, but the
detail itself is repeatedly missed.

The most common contractor mistakes:

- **Showing a uniform-width wing all the way around the perimeter** with no
  enlarged corner.
- **Showing an enlarged corner in one detail but not dimensioning it on the
  plan view**, so the framer in the field never knows the corner wing should
  be different.
- **Wrapping the wing at the corner but not extending it the required
  distance back along each leg.**
- **Stopping the wing short at door thresholds and exterior stair landings**
  where the slab geometry changes.

The corner-wing detail is one of the cheapest fixes pre-submission and one
of the most expensive things to fix in the field. PermitStream specifically
looks for a callout that shows both the typical wing and the corner wing,
dimensioned.

## 6. Inspector pushback triggers

These are the questions a Massachusetts building inspector tends to ask
when they see an FPSF submission. If the plans don't answer them on the
sheet, expect a correction request:

- "Why isn't this below frost?"
- "Where is the standard cited?"
- "Is this heated year-round? Show me the heat source and the design
  interior temperature."
- "What's the AFI you used?"
- "What product and R-value? Where's the manufacturer cut sheet?"
- "How is the foam protected above grade?"
- "How is the foam protected at the corners?"
- "How is water moving away from the bottom of the foam?"
- "Who stamped this? If nobody, are you on the prescriptive path?"

A submission that puts answers to all nine on the foundation sheet rarely
gets a frost-related correction.

## 7. Typical XPS thickness expectations

Most coastal Massachusetts heated-building FPSFs end up specifying **rigid
XPS at the foundation perimeter, with corner wings**, in thickness ranges
that fall within the ASCE 32 tables for the local AFI.

This document deliberately does not publish a single thickness number,
because:

1. The right number depends on the local AFI and the design heat loss, and
2. Manufacturers' R-per-inch values differ slightly by product line.

What contractors should know commercially:

- The thickness called out on the plan must match a product the supplier
  actually stocks, in a length that fits the foundation depth.
- The R-value, not just the thickness, must satisfy the ASCE 32 table the
  designer is working from.
- If the plan shows a thickness that is unusually thin compared to typical
  coastal MA jobs, expect the inspector to ask for the calculation.

PermitStream flags **suspiciously thin or suspiciously thick** schedules as
documentation gaps that warrant designer confirmation. It does not assert
the design is wrong; it asserts the documentation does not let the reviewer
confirm it is right.

## 8. Drainage and protection requirements

FPSF performance depends on the soil under the footing being **dry, well-
drained, and not subject to frost-susceptible water movement**. Five details
that should be on the plan:

1. **Gravel/crushed-stone base** under the footing with a stated thickness.
2. **Free-draining backfill** against the foundation wall.
3. **Perimeter drain** (foundation drain) connected to daylight or a sump.
4. **Surface drainage away from the building**, with a stated minimum slope.
5. **UV / mechanical protection** for any foam exposed above grade — cement
   board, stucco, parging, or a manufacturer-approved protection board.

Coastal Massachusetts sites add two specific concerns:

- **Sandy, fast-draining barrier-island soils** can still trap water at the
  insulation interface if the drainage layer is missing.
- **Salt air and wind-driven rain** make UV-degraded or cracked above-grade
  foam protection a real durability problem, not just a cosmetic one.

A missing drainage detail is almost always a correction notice, even when
the structural design is sound.

## 9. When engineer coordination is needed

The IRC prescriptive path covers a narrow envelope. Step outside it and the
project needs a stamped engineering design — almost always under ASCE 32.
Triggers to bring in an engineer before submission:

- **Unheated structure** of any meaningful size.
- **Heavy snow load zones** or unusual roof geometry.
- **Sites flagged** in a geotechnical report for organic, peat, fill, or
  expansive soils.
- **Floodplain elevation requirements** that interact with the foundation.
- **Additions where the new footprint is colder than the existing**, or
  where the existing footing is below frost and the new footing isn't.
- **Stepped foundations** down a sloped lot, where the wing geometry needs
  to be worked out per step.
- **AHJ-specific guidance** in towns that have published their own FPSF
  expectations.

Engaging the engineer early costs hundreds. Engaging them after a rejection
costs weeks of cycle time plus the cost of revised plans.

## 10. What PermitStream checks for in a $250 review

PermitStream's FPSF documentation review surfaces specific deficiency
triggers against the catalog. These are documentation flags — they tell you
where a reviewer or inspector is most likely to push back. They are not an
engineering opinion.

The checks include:

- **Standard cited?** Is ASCE 32 or IRC R403.3 referenced on the foundation
  sheet?
- **Case declared?** Is the building stated to be heated or unheated for
  FPSF purposes?
- **AFI / frost assumption stated?**
- **Insulation product and manufacturer named?**
- **Vertical R-value and depth specified?**
- **Wing R-value, thickness, and dimensions specified?**
- **Corner-wing extension dimensioned on the plan view?**
- **Above-grade protection specified?**
- **Drainage strategy detailed?**
- **Design professional stamp present where the scope requires one?**

Each flag in the report includes the relevant standard reference and the
specific plan sheet where the gap was detected.

The output language is consistent with the boundary stated at the top of
this document. A flag reads, for example:

> *Potential FPSF documentation deficiency detected: corner-wing dimensions
> not shown on plan view (Sheet S-1). ASCE 32 requires expanded corner wing
> insulation; the reviewer cannot confirm dimensions from the submitted
> set.*

PermitStream's value is in catching these gaps **before** the AHJ does.

---

### About PermitStream

PermitStream is the contractor-facing permit-review workflow built for
coastal Massachusetts AHJs (Newburyport, Newbury, Salisbury, Amesbury,
Boston and surrounding). The $250 review surfaces structured deficiency
flags across 200 catalog checks spanning intake, scope, zoning, building
code, deck/exterior, site plan, deficiency detection, risk scoring,
contractor operations, and reporting/audit.

This document is one of a series of contractor reference sheets. It is
**not** a substitute for engineering, legal, or AHJ guidance, and the
boundary language at the top of this document applies to every example,
table, and check in it.
