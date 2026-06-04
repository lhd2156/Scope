from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable


BLOCKED_REASON = 'blocked_slur_or_hate_term'

_LEET_TRANSLATION = str.maketrans(
    {
        '0': 'o',
        '1': 'i',
        '3': 'e',
        '4': 'a',
        '5': 's',
        '7': 't',
        '@': 'a',
        '$': 's',
    }
)

_BLOCKED_TERMS = {
    'chink',
    'coon',
    'fag',
    'faggot',
    'gook',
    'kike',
    'kill all',
    'kill yourself',
    'kys',
    'nigga',
    'nigger',
    'rape',
    'retard',
    'spic',
    'tranny',
    'wetback',
    # Harmless sentinel used by tests so assertions do not need to spell out a slur.
    'scope test blocked slur',
}

_TOKEN_BLOCKED_TERMS = {
    term
    for term in _BLOCKED_TERMS
    if ' ' not in term and len(term) > 1
}


@dataclass(frozen=True)
class SafetyResult:
    status: str
    reason: str = ''
    field: str | None = None

    @property
    def clean(self) -> bool:
        return self.status == 'clean'


def normalize_safety_text(value: object) -> str:
    normalized = unicodedata.normalize('NFKD', str(value or ''))
    ascii_text = ''.join(character for character in normalized if not unicodedata.combining(character))
    return ascii_text.casefold().translate(_LEET_TRANSLATION)


def _tokenize(value: object) -> list[str]:
    return [token for token in re.split(r'[^a-z0-9]+', normalize_safety_text(value)) if token]


def _contains_blocked_term(value: object) -> bool:
    tokens = _tokenize(value)
    if not tokens:
        return False

    token_set = set(tokens)
    if token_set.intersection(_TOKEN_BLOCKED_TERMS):
        return True

    compact_phrase = ' '.join(tokens)
    return any(term in compact_phrase for term in _BLOCKED_TERMS if ' ' in term)


def evaluate_text_fields(fields: Iterable[tuple[str, object]]) -> SafetyResult:
    for field, value in fields:
        if isinstance(value, (list, tuple, set)):
            values = value
        else:
            values = [value]

        if any(_contains_blocked_term(item) for item in values):
            return SafetyResult(status='blocked', reason=BLOCKED_REASON, field=field)

    return SafetyResult(status='clean')
