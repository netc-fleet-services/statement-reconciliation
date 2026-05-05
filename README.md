# Statement Reconciler

Per-vendor PDF parsers that turn each vendor's statement into a standardized
record schema matching your QuickBooks transactions export. Once both sides are
in the same schema, comparison/reconciliation is straightforward.

## What's built

- **23 vendor parsers** covering all 27 statements in your folder (some parsers
  cover multiple vendors via shared template detection).
- **QB loader** that reads the standard QuickBooks Desktop transactions export.
- **Verification harness** that runs every parser against its sample and reports
  whether the extracted record sum matches the statement's stated total.
- **CLI** for vendor-by-vendor invocation.

## Project layout

```
reconciler/
  parsers/
    __init__.py        # registry — vendor key -> parser class
    base.py            # StatementRecord / ParsedStatement schema
    fleetpride.py      # one file per vendor (or vendor family)
    advantage.py
    cdk_global.py      # covers Ballard, Lucky's, Grappone, Portsmouth Ford
    sullivan.py        # ...etc
    zips.py            # OCR-based parser for scanned PDFs
  utils/
    dates.py           # date/amount parsing helpers
  qb_loader.py         # reads QuickBooks .xlsx export
  verify.py            # runs all parsers against samples
  cli.py               # command-line entry point
```

## Record schema

Every parser produces `ParsedStatement` containing a list of `StatementRecord`:

```python
StatementRecord(
    invoice_no:  str            # vendor's invoice / document number
    txn_date:    date           # invoice / posting date
    amount:      float          # positive for charges, negative for credits/payments
    type:        str            # "Bill", "Credit", or "Payment"
    po_ref:      Optional[str]  # customer PO if visible on statement
    raw:         str            # original text line (for debugging)
)
```

The QB loader produces the **same** schema. Comparison is then a matter of
joining on `invoice_no` and checking date/amount agreement.

## Statement modes

Each parser declares a `statement_mode`:

- `open_only` — the statement only lists currently-open invoices, so
  `period_total` (stated) ≈ sum(records). Examples: FleetPride, Whelen,
  Kimball, most others.
- `all_activity` — the statement lists all transactions in the period including
  paid bills and offsetting payments, so the stated "amount due" is current
  balance (not equal to record sum). Examples: CDK Global vendors (Ballard,
  Lucky's, Grappone, Portsmouth Ford), New England Kenworth, Sullivan Tire.

When reconciling against QB you'd typically use the **records** (line by line)
rather than the period total, since QB also records all activity.

## Verification

```bash
cd reconciler
python -m reconciler.verify
```

Output statuses:
- `OK` — extracted record sum matches the statement's stated total exactly.
- `ACTIVITY_MODE` — vendor uses `all_activity` mode, total ≠ sum is expected.
- `NO_STATED_TOTAL` — parser couldn't find a stated total; record extraction
  still works, just no auto-validation against the printed total.
- `MISMATCH(Δx)` — sum vs. stated total differ — parser bug, fix needed.

Current results: 26 of 27 statements pass cleanly. ArcSource is `NO_STATED_TOTAL`
(its PDF layout has letter-spaced labels in the header that drift away from
their values; record extraction is correct).

## Adding a new vendor

1. Create `reconciler/parsers/<key>.py`.
2. Subclass `StatementParser`, override `vendor` and `parse(pdf_path)`.
3. Register with `@register("<key>")`.
4. Add `"<key>"` to the import list in `parsers/__init__.py:_ensure_loaded`.
5. Add a sample row to `verify.SAMPLES`.
6. Run `python -m reconciler.verify`.

## Dependencies

- `pdfplumber` — primary PDF text extractor (pure Python, Windows-friendly)
- `openpyxl` — QuickBooks .xlsx reader
- `pytesseract` + `pdf2image` — only for the Zips parser (scanned PDFs)
- Tesseract binary required for OCR (Windows installer:
  https://github.com/UB-Mannheim/tesseract/wiki)
- Poppler binary required for `pdftoppm` (used by the Zips OCR parser)

```bash
pip install pdfplumber openpyxl pytesseract pdf2image
```

## CLI usage

```bash
# List all vendor keys
python -m reconciler.cli list-vendors

# Parse one statement and dump records as JSON
python -m reconciler.cli parse fleetpride "path/to/statement.pdf"

# Load a QB export
python -m reconciler.cli load-qb "path/to/Allegiance.xlsx"

# Run all verification tests
python -m reconciler.cli verify "path/to/Statements for Reconciliation"
```

## What's NOT yet built (next steps)

- The actual reconciliation comparator that joins parsed statement records
  against QB records and emits a discrepancy Excel report.
- A simple GUI (file picker + vendor dropdown) — currently CLI-only.
- ArcSource auto-detection of the stated total (parser works, total field is
  manual).

## Vendor key reference

| Key            | Vendor                                  | Sample PDFs                                               |
|----------------|-----------------------------------------|-----------------------------------------------------------|
| advantage      | Advantage Truck Group                   | ARStmt.pdf                                                |
| arcsource      | ArcSource Inc.                          | billing01_11097_c.pdf                                     |
| brookline      | Brookline Machine / APW                 | STMT-0-05210-043026.pdf                                   |
| castle         | Castle Packs / Finger Lakes             | Customer Receivables Aging_*.pdf                          |
| cdk            | CDK Global family (auto-detect by file) | Ballard, Lucky's, Grappone, Portsmouth Ford               |
| dennison       | Dennison Lubricants                     | NETC_statements .pdf                                      |
| fleetpride     | FleetPride                              | 600353_*.pdf, 600353-002_*.pdf                            |
| keystone       | Keystone Automotive (LKQ)               | statement-1135755.pdf                                     |
| kimball        | Kimball Midwest                         | CustomerAccountStatement.pdf, kimballCustomerAccountStatement.pdf |
| kljack         | K.L. Jack & Co.                         | CustState50659-*.pdf                                      |
| myers          | Myers Tire Supply                       | Statement_11530733.pdf                                    |
| nationaltire   | National Tire Wholesale                 | National Tire Wholesale-*.PDF                             |
| nekw           | New England Kenworth                    | Statement_11670.pdf                                       |
| omni           | Omni Services                           | CustState16297-*.pdf                                      |
| rctoolbox      | RC Toolbox                              | VFSTMFRM_NEENTR_*.PDF                                     |
| stmt_unknown   | Unidentified (acct 63168)               | stmt.PDF                                                  |
| sullivan       | Sullivan Tire                           | sullivantire_*.pdf                                        |
| unitedpacific  | United Pacific Industries               | Statement for NEW ENGLAND TRUCK CENTER.pdf                |
| whelen         | Whelen Engineering                      | d30a8bbf-*.pdf                                            |
| wisupply       | WI Supply Boston                        | Customer's statement of account NEW778 *.pdf              |
| zips           | Zips Truck Equipment (scanned, OCR)     | 20250504124538.pdf                                        |
