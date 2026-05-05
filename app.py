"""Statement Reconciliation Web App.

Run from the repo root:
    streamlit run app.py
"""
import os
import sys
import tempfile

import pandas as pd
import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reconciler.parsers import get_parser, list_vendors
from reconciler.qb_loader import load_qb
from reconciler.reconcile import ReconciliationResult, export_to_excel, reconcile

VENDOR_LABELS: dict[str, str] = {
    "advantage":     "Advantage Truck Group",
    "arcsource":     "ArcSource Inc.",
    "brookline":     "Brookline Machine / APW",
    "castle":        "Castle Packs / Finger Lakes",
    "cdk":           "CDK Global (Ballard, Lucky's, Grappone, Portsmouth Ford)",
    "dennison":      "Dennison Lubricants",
    "fleetpride":    "FleetPride",
    "keystone":      "Keystone Automotive (LKQ)",
    "kimball":       "Kimball Midwest",
    "kljack":        "K.L. Jack & Co.",
    "myers":         "Myers Tire Supply",
    "nationaltire":  "National Tire Wholesale",
    "nekw":          "New England Kenworth",
    "omni":          "Omni Services",
    "rctoolbox":     "RC Toolbox",
    "stmt_unknown":  "Unknown Vendor (acct 63168)",
    "sullivan":      "Sullivan Tire",
    "unitedpacific": "United Pacific Industries",
    "whelen":        "Whelen Engineering",
    "wisupply":      "WI Supply Boston",
    "zips":          "Zips Truck Equipment (OCR / Scanned)",
}


# ---------------------------------------------------------------------------
# Results display (defined before it's called below)
# ---------------------------------------------------------------------------

def show_results(result: ReconciliationResult, vendor_key: str) -> None:
    st.subheader(f"Results — {result.vendor}")

    m1, m2, m3, m4, m5, m6 = st.columns(6)
    m1.metric("Stmt Total",    f"${result.stmt_total:,.2f}" if result.stmt_total else "N/A")
    m2.metric("QB Total",      f"${result.qb_total:,.2f}")
    m3.metric("Match Rate",    f"{result.match_rate:.0%}")
    m4.metric("Clean Matches", len(result.matched))
    m5.metric("Mismatches",    len(result.amount_mismatches))
    m6.metric("Unmatched",     len(result.stmt_only) + len(result.qb_only))

    xlsx_bytes = export_to_excel(result)
    st.download_button(
        "⬇ Download Full Report (.xlsx)",
        data=xlsx_bytes,
        file_name=f"reconciliation_{vendor_key}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    st.divider()

    tab1, tab2, tab3, tab4 = st.tabs([
        f"✅ Matched ({len(result.matched)})",
        f"⚠️ Mismatches ({len(result.amount_mismatches)})",
        f"📄 Statement Only ({len(result.stmt_only)})",
        f"💼 QB Only ({len(result.qb_only)})",
    ])

    with tab1:
        if result.matched:
            st.dataframe(pd.DataFrame([{
                "Invoice No": r.invoice_no,
                "Stmt Date":  r.stmt_date,
                "QB Date":    r.qb_date,
                "Amount":     r.stmt_amount,
            } for r in result.matched]), use_container_width=True)
        else:
            st.info("No clean matches found.")

    with tab2:
        if result.amount_mismatches:
            df = pd.DataFrame([{
                "Invoice No":  r.invoice_no,
                "Stmt Date":   r.stmt_date,
                "QB Date":     r.qb_date,
                "Stmt Amount": r.stmt_amount,
                "QB Amount":   r.qb_amount,
                "Delta":       r.delta,
            } for r in result.amount_mismatches])
            st.dataframe(df, use_container_width=True)
        else:
            st.success("No amount mismatches.")

    with tab3:
        if result.stmt_only:
            st.caption("On the vendor statement but no matching QB entry.")
            st.dataframe(pd.DataFrame([{
                "Invoice No": r.invoice_no,
                "Date":       r.txn_date,
                "Amount":     r.amount,
                "Type":       r.type,
                "PO Ref":     r.po_ref or "",
            } for r in result.stmt_only]), use_container_width=True)
        else:
            st.success("All statement records found in QuickBooks.")

    with tab4:
        if result.qb_only:
            st.caption("In QuickBooks but not on the vendor statement.")
            st.dataframe(pd.DataFrame([{
                "Invoice No": r.invoice_no,
                "Date":       r.txn_date,
                "Amount":     r.amount,
                "Type":       r.type,
            } for r in result.qb_only]), use_container_width=True)
        else:
            st.success("All QB records found on the vendor statement.")


# ---------------------------------------------------------------------------
# Page layout
# ---------------------------------------------------------------------------

st.set_page_config(page_title="Statement Reconciler", page_icon="📊", layout="wide")
st.title("📊 Statement Reconciler")
st.caption("Upload a QuickBooks export and a vendor statement to generate a reconciliation report.")

with st.form("inputs"):
    col1, col2, col3 = st.columns([2, 2, 2])

    with col1:
        vendors = list_vendors()
        display_names = [VENDOR_LABELS.get(v, v) for v in vendors]
        selected_idx = st.selectbox(
            "Vendor",
            options=range(len(vendors)),
            format_func=lambda i: display_names[i],
        )

    with col2:
        qb_file = st.file_uploader("QuickBooks Export (.xlsx)", type=["xlsx"])

    with col3:
        stmt_file = st.file_uploader("Vendor Statement (.pdf)", type=["pdf"])

    submitted = st.form_submit_button("Run Reconciliation", type="primary")

# ---------------------------------------------------------------------------
# Reconciliation
# ---------------------------------------------------------------------------

if submitted:
    if not qb_file or not stmt_file:
        st.warning("Please upload both files before running.")
        st.stop()

    vendor_key = vendors[selected_idx]
    qb_path = stmt_path = None

    with st.spinner("Parsing files and running reconciliation…"):
        try:
            with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as f:
                f.write(qb_file.read())
                qb_path = f.name

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(stmt_file.read())
                stmt_path = f.name

            qb_stmt   = load_qb(qb_path)
            vend_stmt = get_parser(vendor_key).parse(stmt_path)
            result    = reconcile(vend_stmt, qb_stmt)

            st.session_state["result"]     = result
            st.session_state["vendor_key"] = vendor_key

        except Exception as exc:
            st.error(f"Processing error: {exc}")
            st.stop()
        finally:
            for p in (qb_path, stmt_path):
                if p and os.path.exists(p):
                    os.unlink(p)

if "result" in st.session_state:
    show_results(st.session_state["result"], st.session_state["vendor_key"])
