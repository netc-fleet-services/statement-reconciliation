"""Vendor parser registry."""
from .base import StatementParser, ParsedStatement, StatementRecord

REGISTRY = {}


def register(key: str):
    def deco(cls):
        REGISTRY[key] = cls
        return cls
    return deco


def get_parser(key: str) -> StatementParser:
    _ensure_loaded()
    if key not in REGISTRY:
        raise KeyError(f"Unknown vendor key: {key}. Available: {sorted(REGISTRY)}")
    return REGISTRY[key]()


def list_vendors():
    _ensure_loaded()
    return sorted(REGISTRY.keys())


_loaded = False


def _ensure_loaded():
    global _loaded
    if _loaded:
        return
    _loaded = True
    # Import lazily so missing modules during incremental dev don't crash other parsers
    import importlib
    for mod in [
        "fleetpride", "omni", "kljack", "castle", "wisupply", "kimball",
        "nationaltire", "unitedpacific", "whelen", "keystone", "myers",
        "rctoolbox", "arcsource", "brookline", "dennison", "sullivan",
        "advantage", "cdk_global", "nekw", "stmt_unknown", "zips",
    ]:
        try:
            importlib.import_module(f"reconciler.parsers.{mod}")
        except ModuleNotFoundError:
            pass  # parser not yet built — that's fine during incremental dev
