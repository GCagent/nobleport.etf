# Production-Grade Investor One-Pager Generator
# NoblePort Systems / Stephanie.ai — June 2026
# ========================================================
# Usage: python OnePager_Production.py
# Output: Stephanie_OnePager_Snapshot_{date}.pdf

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black
from reportlab.pdfgen import canvas
from datetime import datetime

class InvestorOnePager:
    """
    Production-grade single-page PDF generator for NoblePort/Stephanie.ai
    Designed for institutional investor distribution and Reg D compliance.
    """

    def __init__(self, output_filename=None):
        self.output_path = output_filename or f"Stephanie_OnePager_Snapshot_{datetime.now().strftime('%Y-%m-%d')}.pdf"
        self.width, self.height = letter
        self.canvas = canvas.Canvas(self.output_path, pagesize=letter)
        self.margin = 72  # 1 inch margins (standard)
        self.col_width = (self.width - 2*self.margin) / 2

    def add_header(self, title, subtitle):
        """Header section with title and metadata."""
        y = self.height - self.margin

        # Title
        self.canvas.setFont("Helvetica-Bold", 18)
        self.canvas.drawString(self.margin, y, title)

        # Subtitle/metadata
        y -= 20
        self.canvas.setFont("Helvetica", 10)
        self.canvas.drawString(self.margin, y, subtitle)

        # Divider line
        y -= 12
        self.canvas.setLineWidth(1.5)
        self.canvas.line(self.margin, y, self.width - self.margin, y)

        return y - 20

    def add_metrics_column(self, metrics, start_y, title="Key Metrics"):
        """Left column: structured metrics display."""
        x = self.margin
        y = start_y

        # Section title
        self.canvas.setFont("Helvetica-Bold", 12)
        self.canvas.drawString(x, y, title)
        y -= 18

        # Metrics rows
        label_width = 200
        for key, value in metrics.items():
            self.canvas.setFont("Helvetica", 9)
            self.canvas.drawString(x, y, key + ":")

            self.canvas.setFont("Helvetica-Bold", 9)
            self.canvas.drawString(x + label_width, y, str(value))
            y -= 15

        return y

    def add_executive_summary(self, summary_text, bullets, start_y):
        """Right column: executive summary with bullet points."""
        x = self.margin + self.col_width + 20
        y = start_y

        # Section title
        self.canvas.setFont("Helvetica-Bold", 12)
        self.canvas.drawString(x, y, "Executive Summary")
        y -= 16

        # Summary paragraphs
        self.canvas.setFont("Helvetica", 9)
        for line in summary_text:
            self.canvas.drawString(x, y, line)
            y -= 11

        y -= 6

        # Strategic bullet points
        for bullet in bullets:
            self.canvas.drawString(x, y, "▪ " + bullet)
            y -= 12

        return y

    def add_cta_box(self, title, items, y_pos):
        """Call-to-action box with tactical next steps."""
        x = self.margin
        box_height = 68

        # Draw box
        self.canvas.setStrokeColorRGB(0.15, 0.15, 0.15)
        self.canvas.setLineWidth(1.5)
        self.canvas.rect(x, y_pos - box_height, self.width - 2*self.margin, box_height,
                         stroke=1, fill=0)

        # Title
        self.canvas.setFont("Helvetica-Bold", 11)
        self.canvas.drawString(x + 10, y_pos - 18, title)

        # Items
        self.canvas.setFont("Helvetica", 9)
        y = y_pos - 35
        for item in items:
            self.canvas.drawString(x + 10, y, item)
            y -= 14

    def add_footer(self, footer_text):
        """Footer with contact and document metadata."""
        self.canvas.setFont("Helvetica", 8)
        self.canvas.setFillColorRGB(0.4, 0.4, 0.4)
        self.canvas.drawString(self.margin, 30, footer_text)

    def generate(self, metrics, summary_lines, bullet_points, cta_items, footer_text):
        """
        Main generation method.

        Args:
            metrics (dict): Key metric name → value pairs
            summary_lines (list): Narrative summary lines
            bullet_points (list): Strategic bullet points
            cta_items (list): Call-to-action items
            footer_text (str): Footer contact/metadata
        """
        # Header
        y = self.add_header(
            "NoblePort / Stephanie.ai — Executive Snapshot",
            f"Generated: {datetime.now().strftime('%Y-%m-%d')} • Author: Stephanie A. (CEO)"
        )

        # Two-column layout
        y_left = self.add_metrics_column(metrics, y)
        y_right = self.add_executive_summary(summary_lines, bullet_points, y)

        # CTA box
        y_cta = min(y_left, y_right) - 10
        self.add_cta_box("Next Steps — Tactical (Recommended)", cta_items, y_cta)

        # Footer
        self.add_footer(footer_text)

        # Save
        self.canvas.showPage()
        self.canvas.save()
        print(f"✅ PDF generated: {self.output_path}")
        return self.output_path


# ========================================================
# EXECUTION: Production metrics snapshot
# ========================================================

if __name__ == "__main__":

    # Snapshot metrics (canonical as of Jun 12, 2026)
    metrics = {
        "IQ (Primary)": "131,004",
        "IQ (Alternate Composite)": "305,432",
        "Operational Throughput": "15.1 B ops/sec",
        "CUDA Peak Throughput": "621.78 B ops/sec",
        "P95 Render Latency": "88 ms",
        "Active Nodes / Validators": "3,012",
        "Error Band": "6–8%",
        "zkSBT Holders": "977,023+",
        "Tokenized Parcels": "17,511",
        "DeFi TVL (approx.)": "$154,000,000",
        "Canary Batch": "1B tasks (Aug 8, 2025)",
    }

    summary_lines = [
        "Stephanie.ai operates as NoblePort's production-grade AGI orchestration layer.",
        "Live mesh validated via 1B canary task batch (Aug 8, 2025) with real-time",
        "auditability and multi-chain anchoring (IPFS / Arweave / Ethereum).",
        "",
        "Strategic Positioning:",
    ]

    bullet_points = [
        "Compliance-driven: zkSBT gating, Chainlink oracles, Snapshot DAO governance.",
        "Operational scale: 88ms P95 latency, 15.1B ops/sec sustained throughput.",
        "Tokenomics: NBPT utilities, staking for contractor access, DeFi integration.",
        "Auditability: IPFS/Arweave anchoring, on-chain notary, cryptographic proof.",
    ]

    cta_items = [
        "1) Finalize Reg D filings + legal documentation for tokenized offerings.",
        "2) Run 5k-transaction compliance regression (target <0.5% ambiguous transfers).",
        "3) Anchor canonical one-pager + CSV to IPFS for immutable audit trail.",
    ]

    footer_text = "Contact: NoblePort Systems • CEO: Stephanie A. • Document Status: Snapshot-based, production-ready for LP distribution"

    # Generate
    pager = InvestorOnePager()
    pager.generate(
        metrics=metrics,
        summary_lines=summary_lines,
        bullet_points=bullet_points,
        cta_items=cta_items,
        footer_text=footer_text
    )
