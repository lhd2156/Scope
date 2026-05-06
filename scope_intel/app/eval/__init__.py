"""Offline recommendation evaluation harness.

This package exists as a separate namespace so production request code never
imports it. CI (and ad-hoc ops) drives it via `python -m app.eval.offline`.
"""
