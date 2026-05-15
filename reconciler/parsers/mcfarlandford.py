"""McFarland Ford Sales Inc.
   Format: DATE  SRC  REF NO.  APPLY TO  CHARGES  CREDITS  BALANCE
   Uses pdfplumber word-level x-positions to distinguish CHARGES vs CREDITS columns.
"""
from __future__ import annotations
import re
from collections import defaultdict
from . import register
from .base import StatementParser, ParsedStatement, StatementRecord
from ..utils.dates import parse_date, parse_amount

TOTAL_RE = re.compile(r"Pay This Amount\s+\$([\d,]+\.\d{2})", re.IGNORECASE)
DATE_RE  = re.compile(r"Date\s+(\d{2}/\d{2}/\d{4})", re.IGNORECASE)
DATE_RE2 = re.compile(r"(\d{2}/\d{2}/\d{4})\s*$", re.MULTILINE)


@register("mcfarlandford")
class McFarlandFord(StatementParser):
    vendor = "McFarland Ford Sales Inc."

    def parse(self, pdf_path: str) -> ParsedStatement:
        import pdfplumber

        records     = []
        period_total = None
        stmt_date   = None

        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                words = page.extract_words(x_tolerance=3, y_tolerance=3)

                # Locate CHARGES and CREDITS column left edges from header
                charge_x = credit_x = None
                for w in words:
                    if w["text"] == "CHARGES":
                        charge_x = w["x0"]
                    elif w["text"] == "CREDITS":
                        credit_x = w["x0"]

                # Group words by row
                rows: dict[int, list] = defaultdict(list)
                for w in words:
                    rows[round(w["top"])].append(w)

                for _, row_words in sorted(rows.items()):
                    row_words.sort(key=lambda w: w["x0"])
                    texts = [w["text"] for w in row_words]
                    if not texts:
                        continue

                    # Data rows start with MM/DD/YYYY
                    if not re.match(r"^\d{2}/\d{2}/\d{4}$", texts[0]):
                        continue
                    if len(texts) < 5:
                        continue

                    dt_s = texts[0]
                    ref  = texts[2]  # REF NO.

                    dollar_words = [w for w in row_words if re.match(r"^\$[\d,]+\.\d{2}$", w["text"])]
                    if not dollar_words:
                        continue

                    # Last dollar word is the running BALANCE — skip it
                    amount_words = dollar_words[:-1] or dollar_words

                    for aw in amount_words:
                        amt = parse_amount(aw["text"]) or 0.0
                        if credit_x is not None and charge_x is not None:
                            is_credit = aw["x0"] >= (charge_x + credit_x) / 2
                        else:
                            is_credit = False
                        if is_credit:
                            amt = -abs(amt)
                        records.append(StatementRecord(
                            invoice_no=ref,
                            txn_date=parse_date(dt_s),
                            amount=amt,
                            type="Credit" if is_credit else "Bill",
                            raw=" ".join(texts),
                        ))

        text    = self.extract_text(pdf_path)
        total_m = TOTAL_RE.search(text)
        date_m  = DATE_RE.search(text) or DATE_RE2.search(text)
        if total_m:
            period_total = parse_amount(total_m.group(1))
        if date_m:
            stmt_date = parse_date(date_m.group(1))

        return ParsedStatement(
            vendor=self.vendor,
            statement_date=stmt_date,
            account_no=None,
            period_total=period_total,
            records=records,
            source_file=pdf_path,
        )
